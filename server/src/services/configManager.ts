import fs from 'fs';
import path from 'path';
import os from 'os';
import { SecurityShield } from './sync/securityShield.js';

export interface AgentPipelineConfig {
  primaryModel: string;
  plannerModel?: string;
  codingModel?: string;
  reasoningModel?: string;
  fastToolsModel?: string;
}

export type CloudProviderId = 'google_drive' | 'microsoft_onedrive' | 'dropbox' | 'custom_cloud';

export interface GoogleAccountProfile {
  email: string;
  name: string;
  provider?: CloudProviderId;
  picture?: string;
  sub?: string;
  accountHash?: string;
  authMethod?:
    | 'google_oauth_pkce'
    | 'microsoft_oauth_pkce'
    | 'google_token_verified'
    | 'microsoft_token_verified'
    | 'cloud_desktop_verified'
    | 'google_browser_vault_key';
  verifiedByGoogle?: boolean;
  verifiedByPlatform?: boolean;
  twoFactorUnlocked?: boolean;
  keyVerifier?: string;
  encryptedVaultKey?: string;
  encryptedCloudAccessToken?: string;
  connectedAt: number;
}

export interface CloudSyncConfig {
  enabled: boolean;
  autoSync: boolean;
  deviceName: string;
  deviceId: string;
  cloudProvider?: CloudProviderId;
  googleAccount?: GoogleAccountProfile | null;
  savedAccounts?: GoogleAccountProfile[];
  vaultViewScope?: 'all_accessible' | 'account_only' | 'local_only';
  googleOAuthClientId?: string;
  microsoftOAuthClientId?: string;
  cloudMirrorPath?: string;
  peerSyncUrl?: string;
  peerSyncEnabled?: boolean;
  lastSyncedAt?: number;
  syncNotes?: boolean;
  syncInk?: boolean;
  syncChats?: boolean;
  syncConfigs?: boolean;
  syncAiConfig?: boolean;
  e2eeEnabled?: boolean;
  isolateAccountNotes?: boolean;
  encryptedSessionVaultKey?: string;
}

export interface AppConfig {
  keys: {
    openrouter?: string;
    google?: string;
    anthropic?: string;
    openai?: string;
    fishAudio?: string;
  };
  voiceSettings?: {
    provider?: 'system' | 'fish-audio';
    fishAudioVoiceId?: string;
    fishAudioModel?: string;
  };
  vaultPath?: string;
  syncConfig?: CloudSyncConfig;
  defaultModel: string;
  defaultProvider: 'openrouter' | 'google' | 'anthropic' | 'openai';
  recentProjects: string[];
  openProjects?: string[];
  currentProject?: string;
  customRoutines: Array<{
    id: string;
    name: string;
    description: string;
    provider: string;
    model: string;
    systemPrompt: string;
    temperature?: number;
  }>;
  pipeline?: AgentPipelineConfig;
  theme?: 'dark' | 'light';
  deletedNotesRetention?: '30_days' | '90_days' | '120_days' | '1_year' | 'never';
  locale?: 'pt-BR' | 'en-US' | 'es-ES' | string;
  language?: string;
  country?: string;
  enforceStrictLanguage?: boolean;
  defaultSecurityPreset?: 'request_review' | 'default' | 'turbo';
  defaultPlanReviewPolicy?: 'always_proceed' | 'always_review';
}

const CONFIG_DIR = path.join(os.homedir(), '.tellus');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function resolveDefaultVaultPath(): string {
  if (process.env.TELLUS_VAULT_DIR) {
    return process.env.TELLUS_VAULT_DIR;
  }
  return path.join(os.homedir(), 'Documents', 'Tellus Vault');
}

const DEFAULT_CONFIG: AppConfig = {
  keys: {},
  vaultPath: resolveDefaultVaultPath(),
  syncConfig: {
    enabled: false,
    autoSync: true,
    deviceName: os.hostname() || 'Tellus-PC',
    deviceId: 'dev_' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_'),
    googleAccount: null,
    syncNotes: true,
    syncInk: true,
    syncChats: true,
    syncConfigs: true,
    syncAiConfig: true,
    e2eeEnabled: true,
    isolateAccountNotes: true
  },
  defaultModel: 'deepseek/deepseek-r1',
  defaultProvider: 'openrouter',
  defaultSecurityPreset: 'default',
  defaultPlanReviewPolicy: 'always_review',
  recentProjects: [],
  openProjects: [],
  theme: 'dark',
  deletedNotesRetention: '90_days',
  locale: 'pt-BR',
  language: 'Português (Brasil)',
  country: 'Brasil',
  enforceStrictLanguage: true,
  customRoutines: [
    {
      id: 'architect',
      name: 'Architect & Planner',
      description: 'Planejamento de alto nível, arquitetura de sistemas e decomposição de tarefas complexas.',
      provider: 'openrouter',
      model: 'anthropic/claude-3.7-sonnet',
      systemPrompt: 'Você é um Engenheiro de Software Principal e Arquiteto de Sistemas. Foque em soluções escaláveis, limpas, modulares e crie planos de execução precisos.'
    },
    {
      id: 'debugger',
      name: 'Deep Debugger (R1 Reasoning)',
      description: 'Raciocínio analítico profundo para rastreamento de bugs, logs de erro e problemas difíceis.',
      provider: 'openrouter',
      model: 'deepseek/deepseek-r1',
      systemPrompt: 'Você é um especialista em debugging e análise profunda. Use raciocínio passo a passo rigoroso para identificar causas raiz e propor correções completas.'
    },
    {
      id: 'fast_coder',
      name: 'Fast Coder (Gemini 2.0 Flash)',
      description: 'Geração e refatoração rápida de código com grande capacidade de contexto.',
      provider: 'openrouter',
      model: 'google/gemini-2.0-flash-001',
      systemPrompt: 'Você é um desenvolvedor de software ágil e preciso. Escreva código moderno, limpo, bem documentado e pronto para produção.'
    },
    {
      id: 'memory_curator',
      name: 'Memory & Docs Curator',
      description: 'Organização da memória de longo prazo, atualização do active_context e consolidação de decisões.',
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      systemPrompt: 'Você é o curador de memória do projeto. Sintetize o progresso, atualize os registros de decisões (decisions/), dicas/erros (gotchas/) e garanta que a continuidade do contexto nunca seja perdida.'
    }
  ]
};

export class ConfigManager {
  private static ensureDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  public static getConfig(): AppConfig {
    this.ensureDir();
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      return DEFAULT_CONFIG;
    }

    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      const rawKeys = { ...DEFAULT_CONFIG.keys, ...(parsed.keys || {}) };
      const decryptedKeys = {
        openrouter: SecurityShield.decryptAtRest(rawKeys.openrouter),
        google: SecurityShield.decryptAtRest(rawKeys.google),
        anthropic: SecurityShield.decryptAtRest(rawKeys.anthropic),
        openai: SecurityShield.decryptAtRest(rawKeys.openai),
        fishAudio: SecurityShield.decryptAtRest(rawKeys.fishAudio),
      };
      const syncCfg: CloudSyncConfig = { ...DEFAULT_CONFIG.syncConfig!, ...(parsed.syncConfig || {}) };

      // Restore active Vault E2EE key in memory if user is logged in on this trusted PC
      if (syncCfg.googleAccount?.accountHash && syncCfg.encryptedSessionVaultKey && !SecurityShield.isVaultUnlocked()) {
        SecurityShield.restoreSessionFromEncryptedKey(syncCfg.googleAccount.accountHash, syncCfg.encryptedSessionVaultKey);
      }

      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        vaultPath: parsed.vaultPath || DEFAULT_CONFIG.vaultPath,
        syncConfig: syncCfg,
        keys: decryptedKeys
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  public static updateConfig(updates: Partial<AppConfig>): AppConfig {
    const current = this.getConfig();
    const mergedKeys = { ...current.keys, ...(updates.keys || {}) };
    const merged: AppConfig = {
      ...current,
      ...updates,
      vaultPath: updates.vaultPath !== undefined ? updates.vaultPath : current.vaultPath,
      syncConfig: updates.syncConfig
        ? { ...current.syncConfig!, ...updates.syncConfig }
        : current.syncConfig,
      keys: mergedKeys,
      customRoutines: updates.customRoutines || current.customRoutines
    };

    // Persist to disk with AES-256-GCM At-Rest encryption for all API keys
    const diskPayload: AppConfig = {
      ...merged,
      keys: {
        openrouter: SecurityShield.encryptAtRest(mergedKeys.openrouter),
        google: SecurityShield.encryptAtRest(mergedKeys.google),
        anthropic: SecurityShield.encryptAtRest(mergedKeys.anthropic),
        openai: SecurityShield.encryptAtRest(mergedKeys.openai),
        fishAudio: SecurityShield.encryptAtRest(mergedKeys.fishAudio),
      }
    };

    this.ensureDir();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(diskPayload, null, 2), 'utf-8');
    return merged;
  }

  public static addRecentProject(projectPath: string): AppConfig {
    const current = this.getConfig();
    const updatedProjects = [projectPath, ...current.recentProjects.filter(p => p !== projectPath)].slice(0, 10);
    return this.updateConfig({
      recentProjects: updatedProjects,
      currentProject: projectPath
    });
  }
}
