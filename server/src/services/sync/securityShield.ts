import crypto from 'crypto';
import os from 'os';

const ENCRYPTED_PREFIX = 'enc:v1:';
const VAULT_ENC_HEADER = '<!-- TELLUS_ENCRYPTED_NOTE_V1:';
const VAULT_ENC_FOOTER = '-->';

export interface AuthBrowserSession {
  challenge: string;
  codeVerifier: string;
  codeChallenge: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  result?: {
    email: string;
    name: string;
    picture?: string;
    sub: string;
    authMethod: 'google_oauth_pkce' | 'google_token_verified' | 'google_browser_vault_key';
    accountHash: string;
  };
}

export class SecurityShield {
  private static activeVaultKey: Buffer | null = null;
  private static activeAccountHash: string | null = null;
  private static browserSessions = new Map<string, AuthBrowserSession>();

  /**
   * Derives a 256-bit hardware-bound key for encrypting local config secrets at rest (~/.tellus/config.json)
   */
  private static getMachineKey(): Buffer {
    const machineSeed = `tellus-machine-shield:${os.hostname()}:${os.userInfo().username}:${os.platform()}:${os.arch()}`;
    return crypto.scryptSync(machineSeed, 'tellus-local-at-rest-salt-v1', 32);
  }

  /**
   * Encrypts a sensitive string (e.g. API key) for local storage at rest using AES-256-GCM
   */
  public static encryptAtRest(plainText?: string): string | undefined {
    if (!plainText || !plainText.trim()) return undefined;
    if (plainText.startsWith(ENCRYPTED_PREFIX)) return plainText;
    const key = this.getMachineKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts an at-rest encrypted string transparently
   */
  public static decryptAtRest(value?: string): string | undefined {
    if (!value) return undefined;
    if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
    try {
      const payload = value.slice(ENCRYPTED_PREFIX.length);
      const [ivHex, tagHex, dataHex] = payload.split(':');
      if (!ivHex || !tagHex || !dataHex) return undefined;
      const key = this.getMachineKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final()
      ]);
      return decrypted.toString('utf8');
    } catch {
      return undefined;
    }
  }

  /**
   * Derives the user's personal 256-bit Vault Key and deterministic Account Ownership Hash
   * using PBKDF2-HMAC-SHA256 (100,000 iterations).
   */
  public static deriveAccountVaultCredentials(email: string, vaultPassphrase: string): {
    vaultKey: Buffer;
    accountHash: string;
    keyVerifier: string;
  } {
    const normalizedEmail = email.trim().toLowerCase();
    const accountHash = crypto
      .createHash('sha256')
      .update(`tellus-owner-id:${normalizedEmail}`)
      .digest('hex')
      .slice(0, 24);

    const salt = `tellus-vault-e2ee-salt:${normalizedEmail}:${accountHash}`;
    const vaultKey = crypto.pbkdf2Sync(vaultPassphrase, salt, 100000, 32, 'sha256');
    const keyVerifier = crypto
      .createHmac('sha256', vaultKey)
      .update(`tellus-verify:${normalizedEmail}`)
      .digest('hex');

    return { vaultKey, accountHash, keyVerifier };
  }

  /**
   * Unlocks the active session's Vault Key in memory
   */
  public static unlockSessionVault(email: string, vaultPassphrase: string, expectedVerifier?: string): {
    success: boolean;
    accountHash: string;
    keyVerifier: string;
  } {
    const { vaultKey, accountHash, keyVerifier } = this.deriveAccountVaultCredentials(email, vaultPassphrase);
    if (expectedVerifier && expectedVerifier !== keyVerifier) {
      return { success: false, accountHash, keyVerifier };
    }
    this.activeVaultKey = vaultKey;
    this.activeAccountHash = accountHash;
    return { success: true, accountHash, keyVerifier };
  }

  /**
   * Restores the active Vault Key from the local machine's encrypted session cache on startup
   */
  public static restoreSessionFromEncryptedKey(accountHash: string, encryptedVaultKeyHex?: string) {
    if (!encryptedVaultKeyHex) return;
    const decryptedHex = this.decryptAtRest(encryptedVaultKeyHex);
    if (decryptedHex && decryptedHex.length === 64) {
      this.activeVaultKey = Buffer.from(decryptedHex, 'hex');
      this.activeAccountHash = accountHash;
    }
  }

  public static getEncryptedActiveVaultKeyForMachine(): string | undefined {
    if (!this.activeVaultKey) return undefined;
    return this.encryptAtRest(this.activeVaultKey.toString('hex'));
  }

  public static lockSessionVault() {
    this.activeVaultKey = null;
    this.activeAccountHash = null;
  }

  public static isVaultUnlocked(): boolean {
    return this.activeVaultKey !== null && this.activeAccountHash !== null;
  }

  public static getActiveAccountHash(): string | null {
    return this.activeAccountHash;
  }

  /**
   * Encrypts arbitrary buffer/string with the active user's E2EE Vault Key (AES-256-GCM)
   */
  public static encryptWithVaultKey(plainText: string, customKey?: Buffer): string {
    const key = customKey || this.activeVaultKey;
    if (!key) throw new Error('Cofre bloqueado: autentique sua conta Google para criptografar dados vinculados.');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      v: 1,
      alg: 'AES-256-GCM',
      owner: this.activeAccountHash,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64')
    });
  }

  /**
   * Decrypts E2EE payload using the active user's Vault Key
   */
  public static decryptWithVaultKey(jsonPayload: string, customKey?: Buffer): string | null {
    const key = customKey || this.activeVaultKey;
    if (!key) return null;
    try {
      const parsed = JSON.parse(jsonPayload);
      if (parsed.v !== 1 || !parsed.iv || !parsed.tag || !parsed.data) return null;
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(parsed.data, 'base64')),
        decipher.final()
      ]);
      return decrypted.toString('utf8');
    } catch {
      return null;
    }
  }

  /**
   * Wraps a Markdown note body in an encrypted envelope if it is bound to a Google Account
   * and the user opts to protect linked notes on disk.
   */
  public static wrapProtectedNoteContent(plainMarkdown: string, ownerAccountHash: string): string {
    if (!this.activeVaultKey) return plainMarkdown;
    const encryptedJson = this.encryptWithVaultKey(plainMarkdown);
    const base64Envelope = Buffer.from(encryptedJson, 'utf8').toString('base64');
    return `${VAULT_ENC_HEADER}${ownerAccountHash}:${base64Envelope}${VAULT_ENC_FOOTER}\n🔒 *Esta nota está vinculada e criptografada (AES-256-GCM) para a conta proprietária.*`;
  }

  /**
   * Inspects raw Markdown note content to check if it belongs to a specific Google Account
   * and decrypts it only if the matching owner is currently authenticated.
   */
  public static inspectAndUnwrapNote(rawMarkdown: string): {
    isEncrypted: boolean;
    ownerAccountHash: string | null;
    canAccess: boolean;
    content: string;
  } {
    // Check frontmatter owner hash or encrypted envelope
    const encStart = rawMarkdown.indexOf(VAULT_ENC_HEADER);
    if (encStart !== -1) {
      const encEnd = rawMarkdown.indexOf(VAULT_ENC_FOOTER, encStart);
      if (encEnd !== -1) {
        const inner = rawMarkdown.slice(encStart + VAULT_ENC_HEADER.length, encEnd).trim();
        const sepIdx = inner.indexOf(':');
        if (sepIdx !== -1) {
          const ownerHash = inner.slice(0, sepIdx);
          const base64Envelope = inner.slice(sepIdx + 1);
          if (this.activeAccountHash !== ownerHash || !this.activeVaultKey) {
            return {
              isEncrypted: true,
              ownerAccountHash: ownerHash,
              canAccess: false,
              content: ''
            };
          }
          try {
            const encryptedJson = Buffer.from(base64Envelope, 'base64').toString('utf8');
            const decrypted = this.decryptWithVaultKey(encryptedJson);
            if (decrypted !== null) {
              return {
                isEncrypted: true,
                ownerAccountHash: ownerHash,
                canAccess: true,
                content: decrypted
              };
            }
          } catch {}
          return {
            isEncrypted: true,
            ownerAccountHash: ownerHash,
            canAccess: false,
            content: ''
          };
        }
      }
    }

    // Also check metadata comment <!-- owner_account: <hash> -->
    const ownerMatch = rawMarkdown.match(/<!--\s*tellus_owner:\s*([a-f0-9]+)\s*-->/i);
    if (ownerMatch) {
      const ownerHash = ownerMatch[1];
      const canAccess = this.activeAccountHash === ownerHash;
      return {
        isEncrypted: false,
        ownerAccountHash: ownerHash,
        canAccess,
        content: canAccess ? rawMarkdown : ''
      };
    }

    // Otherwise it's a local personal PC note (accessible on this PC)
    return {
      isEncrypted: false,
      ownerAccountHash: null,
      canAccess: true,
      content: rawMarkdown
    };
  }

  /**
   * Creates a one-time PKCE + CSRF challenge for authenticating in the external system browser
   */
  public static createBrowserAuthSession(): AuthBrowserSession {
    const challenge = crypto.randomBytes(24).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const now = Date.now();
    const session: AuthBrowserSession = {
      challenge,
      codeVerifier,
      codeChallenge,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      status: 'pending'
    };
    this.browserSessions.set(challenge, session);
    return session;
  }

  public static getBrowserAuthSession(challenge: string): AuthBrowserSession | undefined {
    const session = this.browserSessions.get(challenge);
    if (!session) return undefined;
    if (Date.now() > session.expiresAt) {
      this.browserSessions.delete(challenge);
      return undefined;
    }
    return session;
  }

  public static completeBrowserAuthSession(
    challenge: string,
    result: NonNullable<AuthBrowserSession['result']>
  ): boolean {
    const session = this.getBrowserAuthSession(challenge);
    if (!session) return false;
    session.status = 'completed';
    session.result = result;
    return true;
  }

  /**
   * Deterministic Account Identifier Hash (SHA-256)
   */
  public static hashAccountIdentifier(email: string): string {
    const normalized = email.trim().toLowerCase();
    return crypto.createHash('sha256').update(`tellus-owner-id:${normalized}`).digest('hex');
  }

  /**
   * Explicit Note Encryption with user's 2FA secret (AES-256-GCM)
   */
  public static encryptNoteContent(plainText: string, passphrase: string): {
    encrypted: boolean;
    ciphertext: string;
    iv: string;
    tag: string;
    algorithm: string;
  } {
    const key = crypto.pbkdf2Sync(passphrase, 'tellus-direct-note-salt', 50000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      encrypted: true,
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      algorithm: 'AES-256-GCM'
    };
  }

  /**
   * Explicit Note Decryption with user's 2FA secret (AES-256-GCM)
   */
  public static decryptNoteContent(
    payload: { ciphertext: string; iv: string; tag: string },
    passphrase: string
  ): string {
    const key = crypto.pbkdf2Sync(passphrase, 'tellus-direct-note-salt', 50000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }

  /**
   * Evaluates cloud storage quota thresholds
   */
  public static evaluateStorageThreshold(usedBytes: number, totalBytes: number): {
    percentage: number;
    isNearLimit: boolean;
    status: 'safe' | 'warning' | 'critical';
  } {
    if (totalBytes <= 0) return { percentage: 0, isNearLimit: false, status: 'safe' };
    const percentage = (usedBytes / totalBytes) * 100;
    const isNearLimit = percentage >= 85;
    const status = percentage >= 95 ? 'critical' : percentage >= 85 ? 'warning' : 'safe';
    return { percentage, isNearLimit, status };
  }
}
