import fs from 'fs';
import path from 'path';
import { ConfigManager } from './configManager.js';

export type ExecutionSecurityPreset = 'request_review' | 'default' | 'turbo' | 'inherit';
export type PlanReviewPolicy = 'always_proceed' | 'always_review';
export type DirectoryAccessPolicy = 'ask_permission' | 'unrestricted';

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
  directoryAccessPolicy?: DirectoryAccessPolicy;
  fileAccess: FileAccessRules;
  network: NetworkAccessRules;
  terminal: TerminalExecutionRules;
  sandboxAndMcp: SandboxAndMcpRules;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  securityPreset: 'default',
  planReviewPolicy: 'always_review',
  directoryAccessPolicy: 'ask_permission',
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
        directoryAccessPolicy: parsed.directoryAccessPolicy || DEFAULT_PROJECT_SETTINGS.directoryAccessPolicy,
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
      directoryAccessPolicy: updates.directoryAccessPolicy || current.directoryAccessPolicy,
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
    projectPath: string,
    chatDirectoryPolicy?: DirectoryAccessPolicy | 'inherit'
  ): {
    preset: 'request_review' | 'default' | 'turbo';
    planReviewPolicy: PlanReviewPolicy;
    directoryAccessPolicy: DirectoryAccessPolicy;
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

    let directoryAccessPolicy: DirectoryAccessPolicy = 'ask_permission';
    if (chatDirectoryPolicy && chatDirectoryPolicy !== 'inherit') {
      directoryAccessPolicy = chatDirectoryPolicy;
    } else if (projectSettings.directoryAccessPolicy) {
      directoryAccessPolicy = projectSettings.directoryAccessPolicy;
    } else if (preset === 'turbo') {
      directoryAccessPolicy = 'unrestricted';
    }

    return {
      preset,
      planReviewPolicy: projectSettings.planReviewPolicy || config.defaultPlanReviewPolicy || 'always_review',
      directoryAccessPolicy,
      source,
      settings: projectSettings
    };
  }

  public static checkFileAccess(
    projectPath: string,
    targetRelPath: string,
    action: 'read' | 'write',
    options?: {
      directoryAccessPolicy?: DirectoryAccessPolicy;
      approvedExternalPaths?: string[];
    }
  ): { allowed: boolean; reason?: string; isExternal?: boolean; requiresPermission?: boolean } {
    const settings = this.getSettings(projectPath);

    if (action === 'read' && !settings.fileAccess.readAllowed) {
      return { allowed: false, reason: 'Leitura de arquivos desativada nas permissões locais do projeto.' };
    }

    if (action === 'write' && !settings.fileAccess.writeAllowed) {
      return { allowed: false, reason: 'Modificação de arquivos desativada nas permissões locais do projeto.' };
    }

    // Directory Scope & External Paths Check
    if (projectPath && targetRelPath) {
      const resolvedTarget = path.isAbsolute(targetRelPath) 
        ? path.resolve(targetRelPath) 
        : path.resolve(projectPath, targetRelPath);
      const resolvedProject = path.resolve(projectPath);
      const relToProject = path.relative(resolvedProject, resolvedTarget);
      const isExternal = relToProject.startsWith('..') || path.isAbsolute(relToProject);

      if (isExternal) {
        const effectivePolicy = options?.directoryAccessPolicy || settings.directoryAccessPolicy || 'ask_permission';
        const isApproved = options?.approvedExternalPaths?.some(p => resolvedTarget.startsWith(path.resolve(p)));

        if (effectivePolicy !== 'unrestricted' && !isApproved) {
          return {
            allowed: false,
            isExternal: true,
            requiresPermission: true,
            reason: `Acesso externo bloqueado: O Tellus está configurado para pedir permissão antes de acessar ou inserir arquivos em outros diretórios fora do projeto (${targetRelPath}). Você pode alterar nas configurações de segurança do chat/projeto para 'Seguir com tudo' se desejar acesso amplo automático.`
          };
        }
      }
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
