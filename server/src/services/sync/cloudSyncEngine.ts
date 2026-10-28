import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { ConfigManager, GoogleAccountProfile, CloudSyncConfig, CloudProviderId } from '../configManager.js';
import { TellusNoteEngine } from '../notes/tellusNoteEngine.js';
import { SessionManager } from '../sessionManager.js';
import { ProjectManager } from '../projectManager.js';
import { SecurityShield } from './securityShield.js';

export interface CloudStorageMonitorReport {
  provider: CloudProviderId;
  providerLabel: string;
  mirrorPath: string;
  quotaSource: 'google_drive_api' | 'microsoft_graph_api' | 'cloud_drive_volume' | 'estimated';
  accountTotalBytes: number;
  accountUsedBytes: number;
  accountFreeBytes: number;
  usagePercent: number;
  status: 'healthy' | 'warning' | 'critical';
  isNearLimit: boolean;
  isCriticalLimit: boolean;
  warningMessage: string | null;
  tellusBreakdown: {
    notesBytes: number;
    notesCount: number;
    inkBytes: number;
    inkCount: number;
    attachmentsBytes: number;
    attachmentsCount: number;
    chatsBytes: number;
    chatsCount: number;
    cloudCapsuleBytes: number;
    totalTellusBytes: number;
  };
}

export interface SyncReport {
  success: boolean;
  syncedAt: number;
  timestamp: number;
  deviceName: string;
  mirrorPath: string;
  notesPushed: number;
  notesPulled: number;
  inkPushed: number;
  inkPulled: number;
  chatsPushed: number;
  chatsPulled: number;
  configSynced: boolean;
  e2eeActive: boolean;
  details: string[];
  errors: string[];
  error?: string;
}

export class CloudSyncEngine {
  /**
   * Detect available cloud folders on the current Windows PC (Google Drive, Microsoft OneDrive, Dropbox)
   * or fallback to ~/.tellus/cloud-sync
   */
  public static detectCloudFolders(): Array<{
    providerId: CloudProviderId;
    provider: string;
    path: string;
    available: boolean;
  }> {
    const candidates: Array<{
      providerId: CloudProviderId;
      provider: string;
      path: string;
      available: boolean;
    }> = [];
    const home = os.homedir();
    const envOneDrive = process.env.OneDrive || process.env.OneDriveConsumer || process.env.OneDriveCommercial;

    const possibleProviders: Array<{ providerId: CloudProviderId; provider: string; path: string }> = [
      { providerId: 'google_drive', provider: 'Google Drive (G:)', path: 'G:\\Meu Drive\\Tellus Cloud Sync' },
      { providerId: 'google_drive', provider: 'Google Drive (G:)', path: 'G:\\My Drive\\Tellus Cloud Sync' },
      { providerId: 'google_drive', provider: 'Google Drive', path: path.join(home, 'Google Drive', 'Tellus Cloud Sync') },
      ...(envOneDrive
        ? [{ providerId: 'microsoft_onedrive' as CloudProviderId, provider: 'Microsoft OneDrive', path: path.join(envOneDrive, 'Tellus Cloud Sync') }]
        : []),
      { providerId: 'microsoft_onedrive', provider: 'Microsoft OneDrive', path: path.join(home, 'OneDrive', 'Tellus Cloud Sync') },
      { providerId: 'dropbox', provider: 'Dropbox Cloud', path: path.join(home, 'Dropbox', 'Tellus Cloud Sync') },
    ];

    const seenPaths = new Set<string>();
    for (const item of possibleProviders) {
      const norm = item.path.toLowerCase();
      if (seenPaths.has(norm)) continue;
      const parentDir = path.dirname(item.path);
      if (fs.existsSync(parentDir)) {
        seenPaths.add(norm);
        candidates.push({ ...item, available: true });
      }
    }

    // Default local/custom cloud capsule hub directory
    const defaultSyncHub = path.join(home, '.tellus', 'cloud-sync');
    candidates.push({
      providerId: 'custom_cloud',
      provider: 'Cápsula Cloud Personalizada',
      path: defaultSyncHub,
      available: true
    });

    return candidates;
  }

  /**
   * Automatically discovers logged-in Google Drive / Microsoft OneDrive accounts on this PC
   * so the user can select them in the browser portal without typing from scratch.
   */
  public static discoverLocalCloudAccounts(): Array<{
    email: string;
    name: string;
    provider: CloudProviderId;
    providerLabel: string;
    mirrorPath: string;
  }> {
    const discovered: Array<{
      email: string;
      name: string;
      provider: CloudProviderId;
      providerLabel: string;
      mirrorPath: string;
    }> = [];
    const seen = new Set<string>();
    const home = os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

    // 1. Check saved accounts in Tellus config
    const cfg = ConfigManager.getConfig();
    if (Array.isArray(cfg.syncConfig?.savedAccounts)) {
      for (const acc of cfg.syncConfig!.savedAccounts!) {
        if (acc.email && !seen.has(acc.email.toLowerCase())) {
          seen.add(acc.email.toLowerCase());
          const prov = acc.provider || 'google_drive';
          discovered.push({
            email: acc.email,
            name: acc.name || acc.email.split('@')[0],
            provider: prov,
            providerLabel: prov === 'microsoft_onedrive' ? 'Microsoft OneDrive' : prov === 'dropbox' ? 'Dropbox' : 'Google Drive',
            mirrorPath: cfg.syncConfig?.cloudMirrorPath || this.getEffectiveMirrorPath(prov)
          });
        }
      }
    }

    // 2. Inspect Microsoft OneDrive settings folder (%LOCALAPPDATA%\Microsoft\OneDrive\settings\Personal)
    try {
      const oneDrivePersonal = path.join(localAppData, 'Microsoft', 'OneDrive', 'settings', 'Personal');
      if (fs.existsSync(oneDrivePersonal)) {
        const files = fs.readdirSync(oneDrivePersonal);
        for (const f of files) {
          if (f.endsWith('.ini') || f.endsWith('.dat')) {
            try {
              const raw = fs.readFileSync(path.join(oneDrivePersonal, f), 'utf16le');
              const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch && !seen.has(emailMatch[0].toLowerCase())) {
                const email = emailMatch[0].toLowerCase();
                seen.add(email);
                discovered.push({
                  email,
                  name: email.split('@')[0],
                  provider: 'microsoft_onedrive',
                  providerLabel: 'Microsoft OneDrive (Conta do Windows)',
                  mirrorPath: this.getEffectiveMirrorPath('microsoft_onedrive')
                });
              }
            } catch {}
          }
        }
      }
    } catch {}

    return discovered;
  }

  public static getEffectiveMirrorPath(preferredProvider?: CloudProviderId): string {
    const config = ConfigManager.getConfig();
    const detected = this.detectCloudFolders();

    if (preferredProvider) {
      const match = detected.find((d) => d.providerId === preferredProvider);
      if (match) return match.path;
    }

    if (config.syncConfig?.cloudMirrorPath && config.syncConfig.cloudMirrorPath.trim()) {
      return config.syncConfig.cloudMirrorPath.trim();
    }

    if (config.syncConfig?.cloudProvider) {
      const match = detected.find((d) => d.providerId === config.syncConfig?.cloudProvider);
      if (match) return match.path;
    }

    return detected[0].path;
  }

  /**
   * Checks if a Cloud Account already has a 2FA Vault Lock in the selected Cloud Provider folder.
   */
  public static checkAccount2FAStatusInCloud(email: string, provider?: CloudProviderId, customMirrorPath?: string): {
    accountHash: string;
    hasExistingCloudVault: boolean;
    cloudProvider: CloudProviderId;
    mirrorPath: string;
    lastUpdatedAt?: number;
  } {
    const cleanEmail = (email || '').trim().toLowerCase();
    const { accountHash } = SecurityShield.deriveAccountVaultCredentials(cleanEmail, 'probe-only');
    const cloudProvider = provider || ConfigManager.getConfig().syncConfig?.cloudProvider || 'google_drive';
    const mirrorBase = customMirrorPath?.trim() || this.getEffectiveMirrorPath(cloudProvider);
    const lockFilePath = path.join(mirrorBase, 'accounts', accountHash, 'tellus-account-lock.json');

    if (fs.existsSync(lockFilePath)) {
      try {
        const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
        return {
          accountHash,
          hasExistingCloudVault: Boolean(lockData.keyVerifier),
          cloudProvider,
          mirrorPath: mirrorBase,
          lastUpdatedAt: lockData.updatedAt
        };
      } catch {}
    }

    return {
      accountHash,
      hasExistingCloudVault: false,
      cloudProvider,
      mirrorPath: mirrorBase
    };
  }

  /**
   * Step 1 + Step 2 (2FA): Authenticates the Cloud Platform Account (Google or Microsoft)
   * AND verifies/unlocks the 2nd Factor (2FA Encrypted Vault Key).
   */
  public static authenticateGoogleWithVaultKey(params: {
    email: string;
    name: string;
    vaultPassphrase: string;
    provider?: CloudProviderId;
    picture?: string;
    sub?: string;
    authMethod?: GoogleAccountProfile['authMethod'];
    verifiedByGoogle?: boolean;
    verifiedByPlatform?: boolean;
    cloudAccessToken?: string;
    cloudMirrorPath?: string;
  }): { syncConfig: CloudSyncConfig; accountHash: string; isFirstTimeVault: boolean } {
    const email = params.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('E-mail da conta Cloud inválido.');
    }
    if (!params.vaultPassphrase || params.vaultPassphrase.trim().length < 6) {
      throw new Error('O 2º Fator (Chave Encriptada 2FA) deve ter pelo menos 6 caracteres para proteger e destrancar seus dados (AES-256-GCM).');
    }

    const config = ConfigManager.getConfig();
    const provider: CloudProviderId =
      params.provider || config.syncConfig?.cloudProvider || (email.includes('@outlook.') || email.includes('@hotmail.') || email.includes('@live.') ? 'microsoft_onedrive' : 'google_drive');
    const mirrorBase =
      params.cloudMirrorPath?.trim() ||
      this.getEffectiveMirrorPath(provider);

    const { accountHash } = SecurityShield.deriveAccountVaultCredentials(email, params.vaultPassphrase);

    // Check if this Cloud Account already has an encrypted 2FA vault in the Cloud Mirror
    const accountCloudDir = path.join(mirrorBase, 'accounts', accountHash);
    const lockFilePath = path.join(accountCloudDir, 'tellus-account-lock.json');

    let existingVerifier: string | undefined =
      config.syncConfig?.googleAccount?.email === email
        ? config.syncConfig?.googleAccount?.keyVerifier
        : undefined;
    let isFirstTimeVault = true;

    if (fs.existsSync(lockFilePath)) {
      try {
        const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
        if (lockData.keyVerifier) {
          existingVerifier = lockData.keyVerifier;
          isFirstTimeVault = false;
        }
      } catch {}
    }

    // Unlock session vault and verify 2FA passphrase matches the account's cryptographic verifier
    const unlockRes = SecurityShield.unlockSessionVault(email, params.vaultPassphrase, existingVerifier);
    if (!unlockRes.success) {
      throw new Error(
        '2º Fator (Chave Encriptada 2FA) incorreto! Você precisa informar exatamente a mesma Chave Encriptada criada na primeira vez para acessar as notas e chats desta conta.'
      );
    }

    // Write/update encapsulated 2FA lock file in the account's isolated cloud folder
    try {
      if (!fs.existsSync(accountCloudDir)) {
        fs.mkdirSync(accountCloudDir, { recursive: true });
      }
      fs.writeFileSync(
        lockFilePath,
        JSON.stringify(
          {
            accountHash,
            provider,
            keyVerifier: unlockRes.keyVerifier,
            twoFactorRequired: true,
            algorithm: 'PBKDF2-SHA256 (100k) + AES-256-GCM',
            updatedAt: Date.now()
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch {}

    const encryptedActiveKey = SecurityShield.getEncryptedActiveVaultKeyForMachine();
    const encryptedToken = params.cloudAccessToken
      ? SecurityShield.encryptAtRest(params.cloudAccessToken.trim())
      : config.syncConfig?.googleAccount?.encryptedCloudAccessToken;

    const googleAccount: GoogleAccountProfile = {
      email,
      name: params.name.trim() || email.split('@')[0],
      provider,
      picture:
        params.picture ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(params.name || email)}`,
      sub: params.sub || `${provider}_${accountHash}`,
      accountHash,
      authMethod: params.authMethod || 'google_browser_vault_key',
      verifiedByGoogle: Boolean(params.verifiedByGoogle || params.verifiedByPlatform),
      verifiedByPlatform: Boolean(params.verifiedByPlatform || params.verifiedByGoogle),
      twoFactorUnlocked: true,
      keyVerifier: unlockRes.keyVerifier,
      encryptedVaultKey: encryptedActiveKey,
      encryptedCloudAccessToken: encryptedToken,
      connectedAt: Date.now()
    };

    const existingSaved = Array.isArray(config.syncConfig?.savedAccounts)
      ? config.syncConfig!.savedAccounts!
      : [];
    const filteredSaved = existingSaved.filter(
      (acc) => acc.email.toLowerCase() !== email && acc.accountHash !== accountHash
    );
    const savedAccounts: GoogleAccountProfile[] = [googleAccount, ...filteredSaved];

    const currentScope = config.syncConfig?.vaultViewScope;
    const nextScope =
      !currentScope || currentScope === 'local_only' ? 'all_accessible' : currentScope;

    const updatedSync: CloudSyncConfig = {
      ...(config.syncConfig || {
        enabled: true,
        autoSync: true,
        deviceName: os.hostname() || 'Tellus-PC',
        deviceId: 'dev_' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_'),
        syncNotes: true,
        syncInk: true,
        syncChats: true,
        syncConfigs: true,
        syncAiConfig: true,
        e2eeEnabled: true,
        isolateAccountNotes: true
      }),
      enabled: true,
      cloudProvider: provider,
      googleAccount,
      savedAccounts,
      vaultViewScope: nextScope,
      cloudMirrorPath: mirrorBase,
      e2eeEnabled: true,
      isolateAccountNotes: config.syncConfig?.isolateAccountNotes ?? true,
      encryptedSessionVaultKey: encryptedActiveKey
    };

    ConfigManager.updateConfig({ syncConfig: updatedSync });
    return { syncConfig: updatedSync, accountHash, isFirstTimeVault };
  }

  /**
   * Verify a real Google OAuth Access Token or ID Token directly against Google's official endpoints
   */
  public static async verifyGoogleOAuthToken(token: string): Promise<{
    email: string;
    name: string;
    picture?: string;
    sub: string;
  }> {
    const cleanToken = token.trim();
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    if (userInfoRes.ok) {
      const data: any = await userInfoRes.json();
      if (data && data.email) {
        return {
          email: data.email,
          name: data.name || data.given_name || data.email.split('@')[0],
          picture: data.picture,
          sub: data.sub || data.email
        };
      }
    }

    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cleanToken)}`
    );
    if (tokenInfoRes.ok) {
      const data: any = await tokenInfoRes.json();
      if (data && data.email) {
        return {
          email: data.email,
          name: data.name || data.given_name || data.email.split('@')[0],
          picture: data.picture,
          sub: data.sub || data.email
        };
      }
    }

    throw new Error('Token OAuth da Google inválido ou expirado.');
  }

  /**
   * Verify a real Microsoft OAuth Access Token directly against Microsoft Graph API (OneDrive / Microsoft Account)
   */
  public static async verifyMicrosoftOAuthToken(token: string): Promise<{
    email: string;
    name: string;
    sub: string;
  }> {
    const cleanToken = token.trim();
    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    if (graphRes.ok) {
      const data: any = await graphRes.json();
      const email = data.mail || data.userPrincipalName;
      if (email) {
        return {
          email: String(email).toLowerCase(),
          name: data.displayName || data.givenName || String(email).split('@')[0],
          sub: data.id || String(email)
        };
      }
    }
    throw new Error('Token OAuth da Microsoft (Graph / OneDrive) inválido ou expirado.');
  }

  /**
   * Opens the user's default system browser to perform external Cloud + 2FA Authentication
   */
  public static launchExternalBrowserAuth(serverPort = 3001, provider?: CloudProviderId): {
    challenge: string;
    authUrl: string;
    expiresAt: number;
  } {
    const session = SecurityShield.createBrowserAuthSession();
    const provParam = provider ? `&provider=${encodeURIComponent(provider)}` : '';
    const authUrl = `http://localhost:${serverPort}/api/auth/google/browser?challenge=${encodeURIComponent(session.challenge)}${provParam}`;

    try {
      if (process.platform === 'win32') {
        exec(`start "" "${authUrl}"`);
      } else if (process.platform === 'darwin') {
        exec(`open "${authUrl}"`);
      } else {
        exec(`xdg-open "${authUrl}"`);
      }
    } catch (e) {
      console.warn('[CloudSyncEngine] Não foi possível abrir navegador automaticamente:', e);
    }

    return {
      challenge: session.challenge,
      authUrl,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Locks ONLY the 2nd Factor (2FA Encrypted Key) while keeping the Cloud Account logged in (`pending_2fa`).
   * The user remains signed into Google/Microsoft, but must re-enter their 2FA Key to view/decrypt linked notes.
   */
  public static lock2FAVaultKeyOnly(): CloudSyncConfig {
    const config = ConfigManager.getConfig();
    SecurityShield.lockSessionVault();
    const currentAcc = config.syncConfig?.googleAccount;
    const updatedSync: CloudSyncConfig = {
      ...(config.syncConfig || {
        enabled: false,
        autoSync: true,
        deviceName: os.hostname() || 'Tellus-PC',
        deviceId: 'dev_' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_')
      }),
      googleAccount: currentAcc ? { ...currentAcc, twoFactorUnlocked: false } : null,
      encryptedSessionVaultKey: undefined
    };
    ConfigManager.updateConfig({ syncConfig: updatedSync });
    return updatedSync;
  }

  /**
   * Computes a comprehensive Cloud Storage & Quota Report (Tellus breakdown + Cloud Drive quota & near-limit alerts)
   */
  public static async getStorageMonitorReport(): Promise<CloudStorageMonitorReport> {
    const config = ConfigManager.getConfig();
    const provider: CloudProviderId =
      config.syncConfig?.cloudProvider || config.syncConfig?.googleAccount?.provider || 'google_drive';
    const providerLabel =
      provider === 'microsoft_onedrive'
        ? 'Microsoft OneDrive'
        : provider === 'dropbox'
        ? 'Dropbox Cloud'
        : provider === 'custom_cloud'
        ? 'Cápsula Cloud Personalizada'
        : 'Google Drive';

    const mirrorPath = this.getEffectiveMirrorPath(provider);

    // 1. Calculate Tellus Vault & Capsule Size Breakdown
    const calcFolderSize = (dir: string, extFilter?: string, excludeSubdir?: string): { bytes: number; count: number } => {
      let bytes = 0;
      let count = 0;
      if (!fs.existsSync(dir)) return { bytes, count };
      const walk = (cur: string) => {
        try {
          for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
            if (excludeSubdir && entry.isDirectory() && entry.name === excludeSubdir) continue;
            const full = path.join(cur, entry.name);
            if (entry.isDirectory()) {
              walk(full);
            } else if (entry.isFile()) {
              if (!extFilter || entry.name.endsWith(extFilter)) {
                try {
                  bytes += fs.statSync(full).size;
                  count++;
                } catch {}
              }
            }
          }
        } catch {}
      };
      walk(dir);
      return { bytes, count };
    };

    const notesStat = calcFolderSize(TellusNoteEngine.VAULT_DIR, '.md', '.ink');
    const inkStat = calcFolderSize(TellusNoteEngine.INK_DIR, '.ink.json');
    const attachStat = calcFolderSize(TellusNoteEngine.ATTACHMENTS_DIR);
    const currentProject = ProjectManager.getCurrentProject();
    const chatsStat = calcFolderSize(SessionManager.getSessionsDir(currentProject), '.json');
    const activeHash = SecurityShield.getActiveAccountHash() || config.syncConfig?.googleAccount?.accountHash;
    const capsuleDir = activeHash ? path.join(mirrorPath, 'accounts', activeHash) : mirrorPath;
    const capsuleStat = calcFolderSize(capsuleDir);

    const totalTellusBytes = notesStat.bytes + inkStat.bytes + attachStat.bytes + chatsStat.bytes;

    // 2. Query Cloud Account Quota (API first if token available, then volume statfsSync fallback)
    let accountTotalBytes = 15 * 1024 * 1024 * 1024; // Default 15 GB (Google Drive free tier) or 5 GB (OneDrive)
    if (provider === 'microsoft_onedrive') accountTotalBytes = 5 * 1024 * 1024 * 1024;
    let accountUsedBytes = Math.max(totalTellusBytes, capsuleStat.bytes);
    let quotaSource: CloudStorageMonitorReport['quotaSource'] = 'estimated';

    const rawToken = config.syncConfig?.googleAccount?.encryptedCloudAccessToken
      ? SecurityShield.decryptAtRest(config.syncConfig.googleAccount.encryptedCloudAccessToken)
      : undefined;

    if (rawToken) {
      if (provider === 'google_drive') {
        try {
          const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
            headers: { Authorization: `Bearer ${rawToken}` }
          });
          if (res.ok) {
            const data: any = await res.json();
            if (data?.storageQuota?.limit) {
              accountTotalBytes = Number(data.storageQuota.limit);
              accountUsedBytes = Number(data.storageQuota.usage || 0);
              quotaSource = 'google_drive_api';
            }
          }
        } catch {}
      } else if (provider === 'microsoft_onedrive') {
        try {
          const res = await fetch('https://graph.microsoft.com/v1.0/me/drive?$select=quota', {
            headers: { Authorization: `Bearer ${rawToken}` }
          });
          if (res.ok) {
            const data: any = await res.json();
            if (data?.quota?.total) {
              accountTotalBytes = Number(data.quota.total);
              accountUsedBytes = Number(data.quota.used || 0);
              quotaSource = 'microsoft_graph_api';
            }
          }
        } catch {}
      }
    }

    // Fallback to checking the mounted Cloud Drive volume (e.g., G:\ Google Drive or C:\ OneDrive)
    if (quotaSource === 'estimated' && typeof (fs as any).statfsSync === 'function') {
      try {
        const targetCheckDir = fs.existsSync(mirrorPath) ? mirrorPath : path.dirname(mirrorPath);
        if (fs.existsSync(targetCheckDir)) {
          const statFs = (fs as any).statfsSync(targetCheckDir);
          const total = Number(statFs.blocks) * Number(statFs.bsize);
          const free = Number(statFs.bfree) * Number(statFs.bsize);
          if (total > 0) {
            accountTotalBytes = total;
            accountUsedBytes = Math.max(0, total - free);
            quotaSource = 'cloud_drive_volume';
          }
        }
      } catch {}
    }

    const accountFreeBytes = Math.max(0, accountTotalBytes - accountUsedBytes);
    const usagePercent =
      accountTotalBytes > 0
        ? Math.min(100, Math.round((accountUsedBytes / accountTotalBytes) * 1000) / 10)
        : 0;

    const isCriticalLimit = usagePercent >= 90;
    const isNearLimit = usagePercent >= 75;
    const status: CloudStorageMonitorReport['status'] = isCriticalLimit
      ? 'critical'
      : isNearLimit
      ? 'warning'
      : 'healthy';

    let warningMessage: string | null = null;
    if (isCriticalLimit) {
      warningMessage = `🚨 Crítico: Seu armazenamento no ${providerLabel} atingiu ${usagePercent}% da capacidade! Libere espaço na conta para evitar falhas de sincronização.`;
    } else if (isNearLimit) {
      warningMessage = `⚠️ Atenção: Seu armazenamento no ${providerLabel} está próximo do limite (${usagePercent}% utilizado).`;
    }

    return {
      provider,
      providerLabel,
      mirrorPath,
      quotaSource,
      accountTotalBytes,
      accountUsedBytes,
      accountFreeBytes,
      usagePercent,
      status,
      isNearLimit,
      isCriticalLimit,
      warningMessage,
      tellusBreakdown: {
        notesBytes: notesStat.bytes,
        notesCount: notesStat.count,
        inkBytes: inkStat.bytes,
        inkCount: inkStat.count,
        attachmentsBytes: attachStat.bytes,
        attachmentsCount: attachStat.count,
        chatsBytes: chatsStat.bytes,
        chatsCount: chatsStat.count,
        cloudCapsuleBytes: capsuleStat.bytes,
        totalTellusBytes
      }
    };
  }

  public static logoutGoogle(): CloudSyncConfig {
    const config = ConfigManager.getConfig();
    // Immediately wipe active Vault E2EE key from memory so linked notes are locked/hidden
    SecurityShield.lockSessionVault();

    const updatedSync: CloudSyncConfig = {
      ...(config.syncConfig || {
        enabled: false,
        autoSync: true,
        deviceName: os.hostname() || 'Tellus-PC',
        deviceId: 'dev_' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_')
      }),
      enabled: false,
      googleAccount: null,
      vaultViewScope: 'local_only',
      encryptedSessionVaultKey: undefined
    };
    ConfigManager.updateConfig({ syncConfig: updatedSync });
    return updatedSync;
  }

  /**
   * Switch between saved Google Accounts or enter "Local Files Only" mode (no account logged in).
   */
  public static switchAccount(
    targetEmailOrMode: string,
    vaultPassphrase?: string
  ): { syncConfig: CloudSyncConfig; mode: 'local_only' | 'account'; activeEmail?: string } {
    const config = ConfigManager.getConfig();
    const target = (targetEmailOrMode || '').trim().toLowerCase();

    if (!target || target === 'local_only' || target === 'none' || target === 'logout') {
      const updated = this.logoutGoogle();
      return { syncConfig: updated, mode: 'local_only' };
    }

    const savedList = Array.isArray(config.syncConfig?.savedAccounts)
      ? config.syncConfig!.savedAccounts!
      : [];
    const found = savedList.find(
      (acc) => acc.email.toLowerCase() === target || acc.accountHash?.toLowerCase() === target
    );

    if (!found) {
      throw new Error(`Conta "${targetEmailOrMode}" não encontrada nas contas salvas deste PC.`);
    }

    // Unlock using provided passphrase or stored machine-encrypted vault key
    if (vaultPassphrase && vaultPassphrase.trim()) {
      const unlockRes = SecurityShield.unlockSessionVault(
        found.email,
        vaultPassphrase.trim(),
        found.keyVerifier
      );
      if (!unlockRes.success) {
        throw new Error('Chave/Senha Mestra incorreta para esta conta.');
      }
      found.encryptedVaultKey = SecurityShield.getEncryptedActiveVaultKeyForMachine();
    } else if (found.encryptedVaultKey && found.accountHash) {
      SecurityShield.restoreSessionFromEncryptedKey(found.accountHash, found.encryptedVaultKey);
      if (!SecurityShield.isVaultUnlocked()) {
        throw new Error('Sessão criptografada expirou. Informe a Chave Mestra para desbloquear esta conta.');
      }
    } else {
      throw new Error('Informe a Chave Mestra para desbloquear as notas desta conta.');
    }

    const updatedSaved = [
      { ...found, connectedAt: Date.now() },
      ...savedList.filter((a) => a.email.toLowerCase() !== found.email.toLowerCase())
    ];

    const currentScope = config.syncConfig?.vaultViewScope;
    const nextScope =
      !currentScope || currentScope === 'local_only' ? 'all_accessible' : currentScope;

    const updatedSync: CloudSyncConfig = {
      ...(config.syncConfig || {
        enabled: true,
        autoSync: true,
        deviceName: os.hostname() || 'Tellus-PC',
        deviceId: 'dev_' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_')
      }),
      enabled: true,
      googleAccount: { ...found, connectedAt: Date.now() },
      savedAccounts: updatedSaved,
      vaultViewScope: nextScope,
      encryptedSessionVaultKey: found.encryptedVaultKey
    };

    ConfigManager.updateConfig({ syncConfig: updatedSync });
    return { syncConfig: updatedSync, mode: 'account', activeEmail: found.email };
  }

  /**
   * Remove an account from the saved accounts list on this PC
   */
  public static removeSavedAccount(emailOrHash: string): CloudSyncConfig {
    const config = ConfigManager.getConfig();
    const target = (emailOrHash || '').trim().toLowerCase();
    const savedList = Array.isArray(config.syncConfig?.savedAccounts)
      ? config.syncConfig!.savedAccounts!
      : [];
    const remaining = savedList.filter(
      (a) => a.email.toLowerCase() !== target && a.accountHash?.toLowerCase() !== target
    );

    const isActiveRemoved =
      config.syncConfig?.googleAccount &&
      (config.syncConfig.googleAccount.email.toLowerCase() === target ||
        config.syncConfig.googleAccount.accountHash?.toLowerCase() === target);

    if (isActiveRemoved) {
      SecurityShield.lockSessionVault();
    }

    const updatedSync: CloudSyncConfig = {
      ...(config.syncConfig || {
        enabled: false,
        autoSync: true,
        deviceName: os.hostname() || 'Tellus-PC',
        deviceId: 'dev_' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_')
      }),
      savedAccounts: remaining,
      ...(isActiveRemoved
        ? {
            enabled: false,
            googleAccount: null,
            vaultViewScope: 'local_only',
            encryptedSessionVaultKey: undefined
          }
        : {})
    };

    ConfigManager.updateConfig({ syncConfig: updatedSync });
    return updatedSync;
  }

  /**
   * Set which notes are displayed in the Vault UI:
   * - 'all_accessible': Notes from active Google Account + local unlinked PC notes
   * - 'account_only': Only notes belonging to the active Google Account
   * - 'local_only': Only local unlinked PC notes (ignores Google Account notes)
   */
  public static setVaultViewScope(
    scope: 'all_accessible' | 'account_only' | 'local_only'
  ): CloudSyncConfig {
    const config = ConfigManager.getConfig();
    const updatedSync: CloudSyncConfig = {
      ...(config.syncConfig || {
        enabled: false,
        autoSync: true,
        deviceName: os.hostname() || 'Tellus-PC',
        deviceId: 'dev_' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_')
      }),
      vaultViewScope: scope
    };
    ConfigManager.updateConfig({ syncConfig: updatedSync });
    return updatedSync;
  }

  /**
   * Smart Stroke-Level Union Merge for .ink.json files when edited on two devices simultaneously.
   * Preserves all unique vector strokes by stroke.id and sorts chronologically by createdAt.
   */
  public static mergeInkJsonContents(localRaw: string, remoteRaw: string): {
    mergedJson: string;
    totalStrokes: number;
    hadNewForLocal: boolean;
    hadNewForRemote: boolean;
  } {
    try {
      const localDoc = JSON.parse(localRaw);
      const remoteDoc = JSON.parse(remoteRaw);

      const localStrokes: any[] = Array.isArray(localDoc.strokes) ? localDoc.strokes : [];
      const remoteStrokes: any[] = Array.isArray(remoteDoc.strokes) ? remoteDoc.strokes : [];

      const deletedIds = new Set<string>([
        ...(Array.isArray(localDoc.deletedStrokeIds) ? localDoc.deletedStrokeIds : []),
        ...(Array.isArray(remoteDoc.deletedStrokeIds) ? remoteDoc.deletedStrokeIds : [])
      ]);

      const strokeMap = new Map<string, any>();
      const localIds = new Set<string>();
      const remoteIds = new Set<string>();

      for (const s of localStrokes) {
        if (s && s.id && !deletedIds.has(s.id)) {
          strokeMap.set(s.id, s);
          localIds.add(s.id);
        }
      }
      for (const s of remoteStrokes) {
        if (s && s.id && !deletedIds.has(s.id)) {
          remoteIds.add(s.id);
          if (!strokeMap.has(s.id)) {
            strokeMap.set(s.id, s);
          }
        }
      }

      const mergedStrokes = Array.from(strokeMap.values()).sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
      );

      let hadNewForLocal = mergedStrokes.length !== localIds.size;
      let hadNewForRemote = mergedStrokes.length !== remoteIds.size;

      if (!hadNewForLocal) {
        for (const id of remoteIds) {
          if (!localIds.has(id)) {
            hadNewForLocal = true;
            break;
          }
        }
      }
      if (!hadNewForRemote) {
        for (const id of localIds) {
          if (!remoteIds.has(id)) {
            hadNewForRemote = true;
            break;
          }
        }
      }

      const latestDoc =
        (remoteDoc.updatedAt || 0) > (localDoc.updatedAt || 0) ? remoteDoc : localDoc;

      const mergedDoc = {
        ...localDoc,
        ...latestDoc,
        version: 1,
        updatedAt: Math.max(localDoc.updatedAt || 0, remoteDoc.updatedAt || 0, Date.now()),
        strokes: mergedStrokes,
        deletedStrokeIds: Array.from(deletedIds)
      };

      return {
        mergedJson: JSON.stringify(mergedDoc, null, 2),
        totalStrokes: mergedStrokes.length,
        hadNewForLocal,
        hadNewForRemote
      };
    } catch {
      return {
        mergedJson: localRaw,
        totalStrokes: 0,
        hadNewForLocal: false,
        hadNewForRemote: false
      };
    }
  }

  /**
   * Smart Paragraph/Line-Level Merge for Markdown (.md) notes when two devices edit the same note concurrently.
   * If one content is a superset of the other, keeps the newer/larger one cleanly;
   * if both have distinct concurrent additions, merges unique paragraphs/lines without losing any text.
   */
  public static mergeMarkdownNotes(localMd: string, remoteMd: string): {
    mergedMd: string;
    wasCombined: boolean;
  } {
    const normLocal = localMd.replace(/\r\n/g, '\n').trim();
    const normRemote = remoteMd.replace(/\r\n/g, '\n').trim();

    if (normLocal === normRemote) {
      return { mergedMd: localMd, wasCombined: false };
    }
    if (normLocal.includes(normRemote)) {
      return { mergedMd: localMd, wasCombined: false };
    }
    if (normRemote.includes(normLocal)) {
      return { mergedMd: remoteMd, wasCombined: false };
    }

    // Split into paragraphs (double newline) and merge preserving order + unique blocks from both devices
    const localBlocks = normLocal.split(/\n\n+/);
    const remoteBlocks = normRemote.split(/\n\n+/);

    const remoteSet = new Set(remoteBlocks.map((b) => b.trim()));
    const localSet = new Set(localBlocks.map((b) => b.trim()));

    const uniqueToRemote = remoteBlocks.filter(
      (b) => b.trim() && !localSet.has(b.trim()) && !b.trim().startsWith('<!-- tellus_owner:')
    );

    if (uniqueToRemote.length === 0) {
      return { mergedMd: localMd, wasCombined: false };
    }

    const uniqueToLocal = localBlocks.filter(
      (b) => b.trim() && !remoteSet.has(b.trim()) && !b.trim().startsWith('<!-- tellus_owner:')
    );

    if (uniqueToLocal.length === 0) {
      return { mergedMd: remoteMd, wasCombined: false };
    }

    // Both devices added/edited different blocks concurrently -> combine cleanly!
    const combined = `${normLocal}\n\n${uniqueToRemote.join('\n\n')}\n`;
    return { mergedMd: combined, wasCombined: true };
  }

  /**
   * Returns local LAN IPv4 addresses so a second device (e.g. Notebook with Stylus on Wi-Fi)
   * can connect directly to this PC for real-time Peer-to-Peer Co-Editing.
   */
  public static getLocalNetworkInfo(port = 3001): {
    deviceName: string;
    deviceId: string;
    lanUrls: string[];
    peerSyncUrl: string;
    peerSyncEnabled: boolean;
  } {
    const config = ConfigManager.getConfig();
    const interfaces = os.networkInterfaces();
    const lanUrls: string[] = [];

    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          lanUrls.push(`http://${net.address}:${port}`);
        }
      }
    }

    return {
      deviceName: config.syncConfig?.deviceName || os.hostname() || 'Tellus-PC',
      deviceId:
        config.syncConfig?.deviceId ||
        'dev_' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_'),
      lanUrls,
      peerSyncUrl: config.syncConfig?.peerSyncUrl || '',
      peerSyncEnabled: Boolean(config.syncConfig?.peerSyncEnabled)
    };
  }

  /**
   * Exports all accessible notes (.md) and ink drawings (.ink.json) for Peer-to-Peer LAN sync
   */
  public static exportPeerSyncBundle(requestedAccountHash?: string): {
    deviceName: string;
    accountHash: string | null;
    exportedAt: number;
    notes: Array<{ relPath: string; content: string; mtimeMs: number }>;
    inks: Array<{ relPath: string; content: string; mtimeMs: number }>;
  } {
    const config = ConfigManager.getConfig();
    const activeHash = SecurityShield.getActiveAccountHash();

    // If an accountHash is requested by peer, verify it matches active hash (or allow local if both in local mode)
    if (requestedAccountHash && activeHash && requestedAccountHash !== activeHash) {
      throw new Error('As contas ativas nos dois dispositivos são diferentes.');
    }

    const vaultDir = TellusNoteEngine.VAULT_DIR;
    const inkDir = TellusNoteEngine.INK_DIR;
    const notes: Array<{ relPath: string; content: string; mtimeMs: number }> = [];
    const inks: Array<{ relPath: string; content: string; mtimeMs: number }> = [];

    const scanMd = (baseDir: string, curDir: string) => {
      if (!fs.existsSync(curDir)) return;
      for (const entry of fs.readdirSync(curDir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(curDir, entry.name);
        if (entry.isDirectory()) {
          scanMd(baseDir, full);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const raw = fs.readFileSync(full, 'utf-8');
            const check = SecurityShield.inspectAndUnwrapNote(raw);
            if (!check.canAccess) continue;
            const relPath = path.relative(baseDir, full).replace(/\\/g, '/');
            const stat = fs.statSync(full);
            notes.push({ relPath, content: check.content, mtimeMs: stat.mtimeMs });
          } catch {}
        }
      }
    };

    const scanInk = (baseDir: string, curDir: string) => {
      if (!fs.existsSync(curDir)) return;
      for (const entry of fs.readdirSync(curDir, { withFileTypes: true })) {
        const full = path.join(curDir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.ink.json')) {
          try {
            const raw = fs.readFileSync(full, 'utf-8');
            const relPath = path.relative(baseDir, full).replace(/\\/g, '/');
            const stat = fs.statSync(full);
            inks.push({ relPath, content: raw, mtimeMs: stat.mtimeMs });
          } catch {}
        }
      }
    };

    scanMd(vaultDir, vaultDir);
    scanInk(inkDir, inkDir);

    return {
      deviceName: config.syncConfig?.deviceName || os.hostname() || 'Tellus-PC',
      accountHash: activeHash,
      exportedAt: Date.now(),
      notes,
      inks
    };
  }

  /**
   * Applies and smart-merges an incoming Peer Sync Bundle (from LAN device) into local Vault & Ink files
   */
  public static applyPeerSyncBundle(bundle: {
    deviceName?: string;
    notes?: Array<{ relPath: string; content: string; mtimeMs: number }>;
    inks?: Array<{ relPath: string; content: string; mtimeMs: number }>;
  }): { notesUpdated: number; inksUpdated: number; details: string[] } {
    let notesUpdated = 0;
    let inksUpdated = 0;
    const details: string[] = [];
    const vaultDir = TellusNoteEngine.VAULT_DIR;
    const inkDir = TellusNoteEngine.INK_DIR;

    if (Array.isArray(bundle.notes)) {
      for (const item of bundle.notes) {
        if (!item.relPath || item.relPath.includes('..')) continue;
        const localPath = path.join(vaultDir, item.relPath);
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (!fs.existsSync(localPath)) {
          fs.writeFileSync(localPath, item.content, 'utf-8');
          notesUpdated++;
          details.push(`⬇️ Nota recebida de ${bundle.deviceName || 'Dispositivo Par'}: ${item.relPath}`);
        } else {
          const stat = fs.statSync(localPath);
          const localRaw = fs.readFileSync(localPath, 'utf-8');
          const check = SecurityShield.inspectAndUnwrapNote(localRaw);
          if (!check.canAccess) continue;

          // If both modified within 60 seconds, smart-merge; otherwise if remote is newer, update/merge
          const timeDiff = Math.abs(item.mtimeMs - stat.mtimeMs);
          if (timeDiff < 60000 && check.content.trim() !== item.content.trim()) {
            const merged = this.mergeMarkdownNotes(check.content, item.content);
            if (merged.mergedMd.trim() !== check.content.trim()) {
              fs.writeFileSync(localPath, merged.mergedMd, 'utf-8');
              notesUpdated++;
              details.push(`🤝 Co-Edição mesclada (${item.relPath})`);
            }
          } else if (item.mtimeMs > stat.mtimeMs + 1000 && check.content.trim() !== item.content.trim()) {
            fs.writeFileSync(localPath, item.content, 'utf-8');
            notesUpdated++;
            details.push(`⬇️ Nota atualizada (${item.relPath})`);
          }
        }
      }
    }

    if (Array.isArray(bundle.inks)) {
      for (const item of bundle.inks) {
        if (!item.relPath || item.relPath.includes('..')) continue;
        const localPath = path.join(inkDir, item.relPath);
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (!fs.existsSync(localPath)) {
          fs.writeFileSync(localPath, item.content, 'utf-8');
          inksUpdated++;
          details.push(`🎨 Traços Ink recebidos (${item.relPath})`);
        } else {
          const localRaw = fs.readFileSync(localPath, 'utf-8');
          const mergedInk = this.mergeInkJsonContents(localRaw, item.content);
          if (mergedInk.hadNewForLocal) {
            fs.writeFileSync(localPath, mergedInk.mergedJson, 'utf-8');
            inksUpdated++;
            details.push(`🎨 Traços Ink mesclados em tempo real (${mergedInk.totalStrokes} traços)`);
          }
        }
      }
    }

    return { notesUpdated, inksUpdated, details };
  }

  /**
   * Synchronize directly over LAN/Wi-Fi with a second Tellus device (peerSyncUrl)
   */
  public static async syncWithPeerDevice(peerUrl?: string): Promise<{
    success: boolean;
    peerUrl: string;
    notesUpdated: number;
    inksUpdated: number;
    details: string[];
    error?: string;
  }> {
    const config = ConfigManager.getConfig();
    const rawUrl = (peerUrl || config.syncConfig?.peerSyncUrl || '').trim().replace(/\/+$/, '');
    if (!rawUrl) {
      return {
        success: false,
        peerUrl: '',
        notesUpdated: 0,
        inksUpdated: 0,
        details: [],
        error: 'Nenhum endereço de Dispositivo Par (IP da Rede Local) configurado.'
      };
    }

    const baseUrl = rawUrl.startsWith('http') ? rawUrl : `http://${rawUrl}`;
    try {
      // 1. Pull bundle from peer
      const pullRes = await fetch(`${baseUrl}/api/sync/peer-bundle`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!pullRes.ok) {
        throw new Error(`Dispositivo Par respondeu com status ${pullRes.status}`);
      }
      const remoteBundle: any = await pullRes.json();
      const applyRes = this.applyPeerSyncBundle(remoteBundle);

      // 2. Push our merged bundle back to peer so both devices stay 100% identical
      const localBundle = this.exportPeerSyncBundle();
      await fetch(`${baseUrl}/api/sync/peer-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localBundle)
      });

      return {
        success: true,
        peerUrl: baseUrl,
        notesUpdated: applyRes.notesUpdated,
        inksUpdated: applyRes.inksUpdated,
        details: applyRes.details
      };
    } catch (e: any) {
      return {
        success: false,
        peerUrl: baseUrl,
        notesUpdated: 0,
        inksUpdated: 0,
        details: [],
        error: e.message || 'Falha ao conectar ao segundo dispositivo na rede.'
      };
    }
  }

  /**
   * Recursively synchronize two directories using Last-Write-Wins (mtimeMs)
   * with optional AES-256-GCM E2EE encryption on the remote mirror.
   */
  private static syncDirectoriesBidirectional(
    localDir: string,
    remoteDir: string,
    extFilter: string,
    useE2EE: boolean,
    activeAccountHash: string,
    isolateAccountNotes: boolean,
    details: string[]
  ): { pushed: number; pulled: number } {
    let pushed = 0;
    let pulled = 0;

    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    if (!fs.existsSync(remoteDir)) fs.mkdirSync(remoteDir, { recursive: true });

    const collectLocalFiles = (baseDir: string, currentDir: string, map: Map<string, { fullPath: string; mtimeMs: number }>) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.ink') continue;
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (extFilter === '.md' && entry.name === '.ink') continue;
          collectLocalFiles(baseDir, full, map);
        } else if (entry.isFile() && entry.name.endsWith(extFilter)) {
          // If syncing .md notes, ensure we only push notes accessible by the active account
          if (extFilter === '.md') {
            try {
              const raw = fs.readFileSync(full, 'utf-8');
              const check = SecurityShield.inspectAndUnwrapNote(raw);
              if (!check.canAccess) continue;
            } catch {}
          }
          const rel = path.relative(baseDir, full).replace(/\\/g, '/');
          const stat = fs.statSync(full);
          map.set(rel, { fullPath: full, mtimeMs: stat.mtimeMs });
        }
      }
    };

    const collectRemoteFiles = (baseDir: string, currentDir: string, map: Map<string, { fullPath: string; mtimeMs: number }>) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.ink') continue;
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (extFilter === '.md' && entry.name === '.ink') continue;
          collectRemoteFiles(baseDir, full, map);
        } else if (entry.isFile() && entry.name.endsWith(extFilter)) {
          const rel = path.relative(baseDir, full).replace(/\\/g, '/');
          const stat = fs.statSync(full);
          map.set(rel, { fullPath: full, mtimeMs: stat.mtimeMs });
        }
      }
    };

    const localFiles = new Map<string, { fullPath: string; mtimeMs: number }>();
    const remoteFiles = new Map<string, { fullPath: string; mtimeMs: number }>();

    collectLocalFiles(localDir, localDir, localFiles);
    collectRemoteFiles(remoteDir, remoteDir, remoteFiles);

    // Helper to decrypt remote content if it is an AES-256-GCM envelope
    const readAndDecryptRemote = (remotePath: string): string | null => {
      const rawRemote = fs.readFileSync(remotePath, 'utf-8');
      if (rawRemote.trim().startsWith('{"v":1,"alg":"AES-256-GCM"')) {
        return SecurityShield.decryptWithVaultKey(rawRemote);
      }
      return rawRemote;
    };

    const writeRemoteContent = (remotePath: string, plainContent: string) => {
      const targetDir = path.dirname(remotePath);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      if (useE2EE && SecurityShield.isVaultUnlocked()) {
        fs.writeFileSync(remotePath, SecurityShield.encryptWithVaultKey(plainContent), 'utf-8');
      } else {
        fs.writeFileSync(remotePath, plainContent, 'utf-8');
      }
    };

    // 1. Local -> Remote & Co-Editing Smart Merge (.ink.json stroke union + .md paragraph merge)
    for (const [rel, localInfo] of localFiles.entries()) {
      const remoteInfo = remoteFiles.get(rel);
      const targetRemotePath = path.join(remoteDir, rel);

      if (!remoteInfo) {
        const rawLocal = fs.readFileSync(localInfo.fullPath, 'utf-8');
        writeRemoteContent(targetRemotePath, rawLocal);
        pushed++;
        details.push(`⬆️ Enviado (Criptografado AES-256): ${rel}`);
        continue;
      }

      // Both local and remote exist: check if .ink.json needs stroke-level union merge
      if (extFilter === '.ink.json') {
        const rawLocal = fs.readFileSync(localInfo.fullPath, 'utf-8');
        const decryptedRemote = readAndDecryptRemote(remoteInfo.fullPath);
        if (decryptedRemote !== null) {
          const mergedInk = this.mergeInkJsonContents(rawLocal, decryptedRemote);
          if (mergedInk.hadNewForLocal) {
            fs.writeFileSync(localInfo.fullPath, mergedInk.mergedJson, 'utf-8');
            pulled++;
            details.push(`🎨 Co-Edição Ink mesclada no PC (${mergedInk.totalStrokes} traços): ${rel}`);
          }
          if (mergedInk.hadNewForRemote) {
            writeRemoteContent(targetRemotePath, mergedInk.mergedJson);
            pushed++;
            details.push(`⬆️ Co-Edição Ink sincronizada na nuvem (${mergedInk.totalStrokes} traços): ${rel}`);
          }
        }
        continue;
      }

      // For .md files: if both modified within 120s or local is newer, check smart paragraph merge
      if (extFilter === '.md') {
        const timeDiff = Math.abs(localInfo.mtimeMs - remoteInfo.mtimeMs);
        if (timeDiff <= 120000) {
          const rawLocal = fs.readFileSync(localInfo.fullPath, 'utf-8');
          const decryptedRemote = readAndDecryptRemote(remoteInfo.fullPath);
          if (decryptedRemote !== null && rawLocal.trim() !== decryptedRemote.trim()) {
            const mergedMd = this.mergeMarkdownNotes(rawLocal, decryptedRemote);
            if (mergedMd.wasCombined) {
              let finalMd = mergedMd.mergedMd;
              if (isolateAccountNotes && activeAccountHash && !finalMd.match(/<!--\s*tellus_owner:\s*([a-f0-9]+)\s*-->/i)) {
                finalMd = `<!-- tellus_owner: ${activeAccountHash} -->\n${finalMd}`;
              }
              fs.writeFileSync(localInfo.fullPath, finalMd, 'utf-8');
              writeRemoteContent(targetRemotePath, finalMd);
              pushed++;
              pulled++;
              details.push(`🤝 Co-Edição de texto mesclada entre dispositivos: ${rel}`);
              continue;
            }
          }
        }
      }

      if (localInfo.mtimeMs > remoteInfo.mtimeMs + 1000) {
        const rawLocal = fs.readFileSync(localInfo.fullPath, 'utf-8');
        writeRemoteContent(targetRemotePath, rawLocal);
        pushed++;
        details.push(`⬆️ Enviado (Criptografado AES-256): ${rel}`);
      }
    }

    // 2. Remote -> Local (Pull & Decrypt with AES-256-GCM E2EE)
    for (const [rel, remoteInfo] of remoteFiles.entries()) {
      const localInfo = localFiles.get(rel);
      if (localInfo && extFilter === '.ink.json') {
        // Already union-merged in step 1
        continue;
      }
      const targetLocalPath = path.join(localDir, rel);
      if (!localInfo || remoteInfo.mtimeMs > localInfo.mtimeMs + 1000) {
        const targetDir = path.dirname(targetLocalPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const decrypted = readAndDecryptRemote(remoteInfo.fullPath);
        if (decrypted === null) {
          continue;
        }
        let finalLocalContent = decrypted;

        // Stamp pulled .md notes with ownerAccountHash so if user logs out, these synced notes are hidden
        if (extFilter === '.md' && isolateAccountNotes && activeAccountHash) {
          if (!finalLocalContent.match(/<!--\s*tellus_owner:\s*([a-f0-9]+)\s*-->/i)) {
            finalLocalContent = `<!-- tellus_owner: ${activeAccountHash} -->\n${finalLocalContent}`;
          }
        }

        fs.writeFileSync(targetLocalPath, finalLocalContent, 'utf-8');
        pulled++;
        details.push(`⬇️ Recebido e Descriptografado: ${rel}`);
      }
    }

    return { pushed, pulled };
  }

  /**
   * Perform full bi-directional E2EE synchronization (Notes + Ink + Chats + AI Config)
   */
  public static syncNow(): SyncReport {
    const config = ConfigManager.getConfig();
    const mirrorBase = this.getEffectiveMirrorPath();
    const deviceName = config.syncConfig?.deviceName || os.hostname() || 'Tellus-PC';
    const details: string[] = [];
    const errors: string[] = [];

    let notesPushed = 0;
    let notesPulled = 0;
    let inkPushed = 0;
    let inkPulled = 0;
    let chatsPushed = 0;
    let chatsPulled = 0;
    let configSynced = false;

    const activeAccount = config.syncConfig?.googleAccount;
    const activeHash = SecurityShield.getActiveAccountHash() || activeAccount?.accountHash;

    if (!activeAccount || !activeHash || !SecurityShield.isVaultUnlocked()) {
      return {
        success: false,
        syncedAt: Date.now(),
        timestamp: Date.now(),
        deviceName,
        mirrorPath: mirrorBase,
        notesPushed: 0,
        notesPulled: 0,
        inkPushed: 0,
        inkPulled: 0,
        chatsPushed: 0,
        chatsPulled: 0,
        configSynced: false,
        e2eeActive: false,
        details: [],
        errors: ['Cofre não autenticado. Faça o login com sua Conta Google + Chave Mestra para sincronizar.'],
        error: 'Cofre não autenticado. Faça o login com sua Conta Google + Chave Mestra para sincronizar.'
      };
    }

    // Isolate each Google Account into its own cryptographic directory inside the Cloud Mirror
    const accountMirrorRoot = path.join(mirrorBase, 'accounts', activeHash);
    const useE2EE = config.syncConfig?.e2eeEnabled !== false;
    const isolateAccountNotes = config.syncConfig?.isolateAccountNotes !== false;

    try {
      if (!fs.existsSync(accountMirrorRoot)) {
        fs.mkdirSync(accountMirrorRoot, { recursive: true });
      }

      // 1. Sync Markdown Notes (.md)
      if (config.syncConfig?.syncNotes !== false) {
        const vaultDir = TellusNoteEngine.VAULT_DIR;
        const remoteNotesDir = path.join(accountMirrorRoot, 'vault');
        const noteRes = this.syncDirectoriesBidirectional(
          vaultDir,
          remoteNotesDir,
          '.md',
          useE2EE,
          activeHash,
          isolateAccountNotes,
          details
        );
        notesPushed = noteRes.pushed;
        notesPulled = noteRes.pulled;
      }

      // 2. Sync Ink Mode Vector Files (.ink.json)
      if (config.syncConfig?.syncInk !== false) {
        const localInkDir = TellusNoteEngine.INK_DIR;
        const remoteInkDir = path.join(accountMirrorRoot, 'vault', '.ink');
        const inkRes = this.syncDirectoriesBidirectional(
          localInkDir,
          remoteInkDir,
          '.ink.json',
          useE2EE,
          activeHash,
          isolateAccountNotes,
          details
        );
        inkPushed = inkRes.pushed;
        inkPulled = inkRes.pulled;
      }

      // 3. Sync Chat Sessions (.json)
      if (config.syncConfig?.syncChats !== false) {
        const currentProject = ProjectManager.getCurrentProject();
        const localSessionsDir = SessionManager.getSessionsDir(currentProject);
        const remoteSessionsDir = path.join(accountMirrorRoot, 'sessions');
        const chatRes = this.syncDirectoriesBidirectional(
          localSessionsDir,
          remoteSessionsDir,
          '.json',
          useE2EE,
          activeHash,
          false,
          details
        );
        chatsPushed = chatRes.pushed;
        chatsPulled = chatRes.pulled;
      }

      // 4. Sync AI Configurations & Routines (Encrypted with AES-256-GCM)
      if (config.syncConfig?.syncConfigs !== false && config.syncConfig?.syncAiConfig !== false) {
        const remoteConfigPath = path.join(accountMirrorRoot, 'tellus-cloud-profile.enc.json');
        const cloudProfile = {
          updatedAt: Date.now(),
          deviceName,
          defaultModel: config.defaultModel,
          defaultProvider: config.defaultProvider,
          customRoutines: config.customRoutines,
          voiceSettings: config.voiceSettings,
          theme: config.theme,
          locale: config.locale,
          language: config.language,
          keys: config.keys
        };
        const encryptedProfile = SecurityShield.encryptWithVaultKey(JSON.stringify(cloudProfile));
        fs.writeFileSync(remoteConfigPath, encryptedProfile, 'utf-8');
        configSynced = true;
      }

      const now = Date.now();
      // 5. Write Encapsulated Cloud Manifest (for zero-IP multi-PC simultaneous co-editing)
      try {
        const manifestPath = path.join(accountMirrorRoot, 'capsule-manifest.json');
        let existingDevices: Record<string, any> = {};
        if (fs.existsSync(manifestPath)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            if (parsed.devices) existingDevices = parsed.devices;
          } catch {}
        }
        existingDevices[deviceName] = {
          deviceName,
          lastSyncedAt: now,
          notesPushed,
          notesPulled,
          inkPushed,
          inkPulled
        };
        fs.writeFileSync(
          manifestPath,
          JSON.stringify(
            {
              capsuleVersion: 2,
              accountHash: activeHash,
              provider: config.syncConfig?.cloudProvider || activeAccount.provider || 'google_drive',
              encryption: 'AES-256-GCM + 2FA-PBKDF2-SHA256',
              updatedAt: now,
              lastModifiedByDevice: deviceName,
              devices: existingDevices
            },
            null,
            2
          ),
          'utf-8'
        );
      } catch {}

      if (config.syncConfig) {
        ConfigManager.updateConfig({
          syncConfig: {
            ...config.syncConfig,
            lastSyncedAt: now
          }
        });
      }

      return {
        success: true,
        syncedAt: now,
        timestamp: now,
        deviceName,
        mirrorPath: accountMirrorRoot,
        notesPushed,
        notesPulled,
        inkPushed,
        inkPulled,
        chatsPushed,
        chatsPulled,
        configSynced,
        e2eeActive: useE2EE,
        details,
        errors
      };
    } catch (err: any) {
      errors.push(err.message || 'Erro desconhecido na sincronização');
      return {
        success: false,
        syncedAt: Date.now(),
        timestamp: Date.now(),
        deviceName,
        mirrorPath: accountMirrorRoot,
        notesPushed,
        notesPulled,
        inkPushed,
        inkPulled,
        chatsPushed,
        chatsPulled,
        configSynced,
        e2eeActive: useE2EE,
        details,
        errors,
        error: err.message
      };
    }
  }
}
