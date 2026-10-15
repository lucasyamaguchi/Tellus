import fs from 'fs';
import path from 'path';
import { ConfigManager } from './configManager.js';

export type ExecutionSecurityPreset = 'request_review' | 'default' | 'turbo' | 'inherit';
export type PlanReviewPolicy = 'always_proceed' | 'always_review';

export interface FileAccessRules {
  readAllowed: boolean;
  writeAllowed: boolean;
  deniedPaths: string[];
}

export interface NetworkAccessRules {
  allowed: boolean;
}

export interface TerminalExecutionRules {
  allowed: boolean;
  deniedCommands: string[];
}

export interface SandboxAndMcpRules {
  allowOutsideSandbox: boolean;
  enableMcp: boolean;
}

export interface ProjectSettings {
  securityPreset: ExecutionSecurityPreset;
  planReviewPolicy: PlanReviewPolicy;
  fileAccess: FileAccessRules;
  network: NetworkAccessRules;
  terminal: TerminalExecutionRules;
  sandboxAndMcp: SandboxAndMcpRules;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  securityPreset: 'default',
  planReviewPolicy: 'always_review',
  fileAccess: {
    readAllowed: true,
    writeAllowed: true,
    deniedPaths: ['.env', '.git', 'node_modules', '*.pem', '*.key', 'id_rsa']
  },
  network: {
    allowed: true
  },
  terminal: {
    allowed: true,
    deniedCommands: ['rm -rf /', 'format', 'mkfs', 'dd if=', ':(){ :|:& };:']
  },
  sandboxAndMcp: {
    allowOutsideSandbox: false,
    enableMcp: true
  }
};

export class ProjectSettingsManager {
  public static getSettingsPath(projectPath: string): string {
    return path.join(projectPath, '.agentic', 'project_settings.json');
  }

  public static getSettings(projectPath: string): ProjectSettings {
    const filePath = this.getSettingsPath(projectPath);
    if (!fs.existsSync(filePath)) {
      return { ...DEFAULT_PROJECT_SETTINGS };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        securityPreset: parsed.securityPreset || DEFAULT_PROJECT_SETTINGS.securityPreset,
        planReviewPolicy: parsed.planReviewPolicy || DEFAULT_PROJECT_SETTINGS.planReviewPolicy,
        fileAccess: {
          readAllowed: parsed.fileAccess?.readAllowed !== undefined ? parsed.fileAccess.readAllowed : DEFAULT_PROJECT_SETTINGS.fileAccess.readAllowed,
          writeAllowed: parsed.fileAccess?.writeAllowed !== undefined ? parsed.fileAccess.writeAllowed : DEFAULT_PROJECT_SETTINGS.fileAccess.writeAllowed,
          deniedPaths: Array.isArray(parsed.fileAccess?.deniedPaths) ? parsed.fileAccess.deniedPaths : [...DEFAULT_PROJECT_SETTINGS.fileAccess.deniedPaths]
        },
        network: {
          allowed: parsed.network?.allowed !== undefined ? parsed.network.allowed : DEFAULT_PROJECT_SETTINGS.network.allowed
        },
        terminal: {
          allowed: parsed.terminal?.allowed !== undefined ? parsed.terminal.allowed : DEFAULT_PROJECT_SETTINGS.terminal.allowed,
          deniedCommands: Array.isArray(parsed.terminal?.deniedCommands) ? parsed.terminal.deniedCommands : [...DEFAULT_PROJECT_SETTINGS.terminal.deniedCommands]
        },
        sandboxAndMcp: {
          allowOutsideSandbox: parsed.sandboxAndMcp?.allowOutsideSandbox !== undefined ? parsed.sandboxAndMcp.allowOutsideSandbox : DEFAULT_PROJECT_SETTINGS.sandboxAndMcp.allowOutsideSandbox,
          enableMcp: parsed.sandboxAndMcp?.enableMcp !== undefined ? parsed.sandboxAndMcp.enableMcp : DEFAULT_PROJECT_SETTINGS.sandboxAndMcp.enableMcp
        }
      };
    } catch {
      return { ...DEFAULT_PROJECT_SETTINGS };
    }
  }

  public static saveSettings(projectPath: string, updates: Partial<ProjectSettings>): ProjectSettings {
    const current = this.getSettings(projectPath);
    const updated: ProjectSettings = {
      securityPreset: updates.securityPreset || current.securityPreset,
      planReviewPolicy: updates.planReviewPolicy || current.planReviewPolicy,
      fileAccess: {
        ...current.fileAccess,
        ...(updates.fileAccess || {})
      },
      network: {
        ...current.network,
        ...(updates.network || {})
      },
      terminal: {
        ...current.terminal,
        ...(updates.terminal || {})
      },
      sandboxAndMcp: {
        ...current.sandboxAndMcp,
        ...(updates.sandboxAndMcp || {})
      }
    };

    const dir = path.join(projectPath, '.agentic');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.getSettingsPath(projectPath), JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  public static resolveEffectiveSecurity(
    chatMode: ExecutionSecurityPreset | undefined,
    projectPath: string
  ): {
    preset: 'request_review' | 'default' | 'turbo';
    planReviewPolicy: PlanReviewPolicy;
    source: 'chat' | 'project' | 'global';
    settings: ProjectSettings;
  } {
    const projectSettings = this.getSettings(projectPath);
    const config = ConfigManager.getConfig();

    let preset: 'request_review' | 'default' | 'turbo' = 'default';
    let source: 'chat' | 'project' | 'global' = 'default' as any;

    if (chatMode && chatMode !== 'inherit') {
      preset = chatMode;
      source = 'chat';
    } else if (projectSettings.securityPreset && projectSettings.securityPreset !== 'inherit') {
      preset = projectSettings.securityPreset;
      source = 'project';
    } else {
      preset = config.defaultSecurityPreset || 'default';
      source = 'global';
    }

    return {
      preset,
      planReviewPolicy: projectSettings.planReviewPolicy || config.defaultPlanReviewPolicy || 'always_review',
      source,
      settings: projectSettings
    };
  }

  public static checkFileAccess(
    projectPath: string,
    targetRelPath: string,
    action: 'read' | 'write'
  ): { allowed: boolean; reason?: string } {
    const settings = this.getSettings(projectPath);

    if (action === 'read' && !settings.fileAccess.readAllowed) {
      return { allowed: false, reason: 'Leitura de arquivos desativada nas permissões locais do projeto.' };
    }

    if (action === 'write' && !settings.fileAccess.writeAllowed) {
      return { allowed: false, reason: 'Modificação de arquivos desativada nas permissões locais do projeto.' };
    }

    // Denied paths check
    const normalizedTarget = targetRelPath.replace(/\\/g, '/').toLowerCase();
    const baseName = path.basename(normalizedTarget);

    for (const denied of settings.fileAccess.deniedPaths) {
      const normalizedDenied = denied.trim().replace(/\\/g, '/').toLowerCase();
      if (!normalizedDenied) continue;

      if (normalizedDenied.startsWith('*.')) {
        const ext = normalizedDenied.slice(1); // e.g. '.pem'
        if (normalizedTarget.endsWith(ext) || baseName.endsWith(ext)) {
          return { allowed: false, reason: `Acesso bloqueado: arquivos com padrão '${denied}' estão na lista de caminhos negados do projeto.` };
        }
      } else {
        if (
          normalizedTarget === normalizedDenied ||
          baseName === normalizedDenied ||
          normalizedTarget.includes(`/${normalizedDenied}/`) ||
          normalizedTarget.startsWith(`${normalizedDenied}/`) ||
          normalizedTarget.endsWith(`/${normalizedDenied}`)
        ) {
          return { allowed: false, reason: `Acesso bloqueado: '${denied}' está na lista de caminhos negados do projeto.` };
        }
      }
    }

    return { allowed: true };
  }

  public static checkTerminalCommand(
    projectPath: string,
    command: string
  ): { allowed: boolean; reason?: string } {
    const settings = this.getSettings(projectPath);

    if (!settings.terminal.allowed) {
      return { allowed: false, reason: 'Execução de comandos de terminal está desativada nas permissões do projeto.' };
    }

    const lowerCmd = command.toLowerCase().trim();
    for (const denied of settings.terminal.deniedCommands) {
      const lowerDenied = denied.toLowerCase().trim();
      if (lowerDenied && lowerCmd.includes(lowerDenied)) {
        return { allowed: false, reason: `Comando bloqueado: '${denied}' está na lista de comandos restritos do projeto.` };
      }
    }

    return { allowed: true };
  }

  public static checkNetworkAccess(projectPath: string): { allowed: boolean; reason?: string } {
    const settings = this.getSettings(projectPath);
    if (!settings.network.allowed) {
      return { allowed: false, reason: 'Acesso à rede / scraping externo desativado nas permissões do projeto.' };
    }
    return { allowed: true };
  }
}
