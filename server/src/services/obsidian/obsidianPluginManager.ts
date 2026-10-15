import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

export interface ObsidianPluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion?: string;
  description: string;
  author?: string;
  authorUrl?: string;
  isDesktopOnly?: boolean;
}

export interface ObsidianPluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  dirPath: string;
  hasMainJs: boolean;
  hasStylesCss: boolean;
  hasDataJson: boolean;
  isCustomTellus: boolean;
}

export interface RecommendedObsidianPlugin {
  id: string;
  name: string;
  repo: string;
  description: string;
  category: 'queries' | 'diagrams' | 'git' | 'ai' | 'tables' | 'organization';
  installed: boolean;
  whyUsefulForTellus: string;
}

const DEFAULT_VAULT_DIR = 'E:\\Die-Sonne\\Vault';
const TELLUS_GLOBAL_PLUGINS_DIR = path.join(os.homedir(), '.tellus', 'obsidian_plugins');

export class ObsidianPluginManager {
  private static getVaultDir(customVaultDir?: string): string {
    const dir = customVaultDir || process.env.TELLUS_VAULT_DIR || process.env.OBSIDIAN_VAULT_DIR || DEFAULT_VAULT_DIR;
    return dir;
  }

  private static getPluginsDir(customVaultDir?: string): string {
    const vaultDir = this.getVaultDir(customVaultDir);
    const pluginsDir = path.join(vaultDir, '.obsidian', 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      try {
        fs.mkdirSync(pluginsDir, { recursive: true });
      } catch {}
    }
    return pluginsDir;
  }

  private static getCommunityPluginsConfigPath(customVaultDir?: string): string {
    const vaultDir = this.getVaultDir(customVaultDir);
    return path.join(vaultDir, '.obsidian', 'community-plugins.json');
  }

  public static getEnabledPluginIds(customVaultDir?: string): string[] {
    const configPath = this.getCommunityPluginsConfigPath(customVaultDir);
    if (!fs.existsSync(configPath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      const list = JSON.parse(data);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  public static setEnabledPluginIds(enabledIds: string[], customVaultDir?: string): void {
    const configPath = this.getCommunityPluginsConfigPath(customVaultDir);
    const parentDir = path.dirname(configPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(Array.from(new Set(enabledIds)), null, 2), 'utf-8');
  }

  public static listInstalledPlugins(customVaultDir?: string): ObsidianPluginInfo[] {
    const pluginsDir = this.getPluginsDir(customVaultDir);
    const enabledIds = new Set(this.getEnabledPluginIds(customVaultDir));
    const result: ObsidianPluginInfo[] = [];

    const scanDir = (baseDir: string, isCustom: boolean) => {
      if (!fs.existsSync(baseDir)) return;
      try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const pluginDir = path.join(baseDir, entry.name);
          const manifestPath = path.join(pluginDir, 'manifest.json');
          if (!fs.existsSync(manifestPath)) continue;

          try {
            const raw = fs.readFileSync(manifestPath, 'utf-8');
            const manifest: ObsidianPluginManifest = JSON.parse(raw);
            const hasMainJs = fs.existsSync(path.join(pluginDir, 'main.js'));
            const hasStylesCss = fs.existsSync(path.join(pluginDir, 'styles.css'));
            const hasDataJson = fs.existsSync(path.join(pluginDir, 'data.json'));

            result.push({
              id: manifest.id || entry.name,
              name: manifest.name || entry.name,
              version: manifest.version || '1.0.0',
              description: manifest.description || '',
              author: manifest.author || 'Desconhecido',
              enabled: enabledIds.has(manifest.id || entry.name),
              dirPath: pluginDir,
              hasMainJs,
              hasStylesCss,
              hasDataJson,
              isCustomTellus: isCustom
            });
          } catch {}
        }
      } catch {}
    };

    scanDir(pluginsDir, false);
    if (fs.existsSync(TELLUS_GLOBAL_PLUGINS_DIR)) {
      scanDir(TELLUS_GLOBAL_PLUGINS_DIR, true);
    }

    return result;
  }

  public static togglePlugin(pluginId: string, enabled: boolean, customVaultDir?: string): boolean {
    const currentEnabled = new Set(this.getEnabledPluginIds(customVaultDir));
    if (enabled) {
      currentEnabled.add(pluginId);
    } else {
      currentEnabled.delete(pluginId);
    }
    this.setEnabledPluginIds(Array.from(currentEnabled), customVaultDir);
    return true;
  }

  public static importPluginFromDir(sourceDir: string, customVaultDir?: string): ObsidianPluginInfo {
    const manifestPath = path.join(sourceDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Diretório inválido: arquivo manifest.json não encontrado em ${sourceDir}`);
    }

    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest: ObsidianPluginManifest = JSON.parse(raw);
    const pluginId = manifest.id || path.basename(sourceDir);

    const targetDir = path.join(this.getPluginsDir(customVaultDir), pluginId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copy manifest.json, main.js, styles.css, data.json
    const filesToCopy = ['manifest.json', 'main.js', 'styles.css', 'data.json'];
    for (const f of filesToCopy) {
      const src = path.join(sourceDir, f);
      const dst = path.join(targetDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      }
    }

    // Enable by default on import
    this.togglePlugin(pluginId, true, customVaultDir);

    return {
      id: pluginId,
      name: manifest.name || pluginId,
      version: manifest.version || '1.0.0',
      description: manifest.description || '',
      author: manifest.author || 'Local',
      enabled: true,
      dirPath: targetDir,
      hasMainJs: fs.existsSync(path.join(targetDir, 'main.js')),
      hasStylesCss: fs.existsSync(path.join(targetDir, 'styles.css')),
      hasDataJson: fs.existsSync(path.join(targetDir, 'data.json')),
      isCustomTellus: false
    };
  }

  public static listCuratedRecommendations(customVaultDir?: string): RecommendedObsidianPlugin[] {
    const installed = new Set(this.listInstalledPlugins(customVaultDir).map(p => p.id));

    const recommendations: Omit<RecommendedObsidianPlugin, 'installed'>[] = [
      {
        id: 'dataview',
        name: 'Dataview',
        repo: 'blacksmithgu/obsidian-dataview',
        description: 'Poderoso motor de consultas estruturadas (DQL e JavaScript) sobre notas, metadados, tarefas e tabelas.',
        category: 'queries',
        whyUsefulForTellus: 'Gera dashboards em tempo real das notas do vault e das decisões do agente diretamente nas notas.'
      },
      {
        id: 'obsidian-git',
        name: 'Obsidian Git',
        repo: 'denolehs/obsidian-git',
        description: 'Sincronização e backup automático com Git (commit e push periódicos) para manter o cofre versionado.',
        category: 'git',
        whyUsefulForTellus: 'Complementa perfeitamente o GitSafe e o Palácio de Memória do Tellus, garantindo zero perda de dados.'
      },
      {
        id: 'obsidian-excalidraw-plugin',
        name: 'Excalidraw',
        repo: 'zsviczian/obsidian-excalidraw-plugin',
        description: 'Criação de diagramas, fluxogramas e esboços visuais incorporados diretamente nas notas.',
        category: 'diagrams',
        whyUsefulForTellus: 'Permite esboçar arquiteturas de software, modelos de dados e fluxos de telas integrados ao Tellus.'
      },
      {
        id: 'obsidian-kanban',
        name: 'Obsidian Kanban',
        repo: 'mgmeyers/obsidian-kanban',
        description: 'Quadros Kanban interativos completos criados diretamente a partir de arquivos Markdown padrão.',
        category: 'organization',
        whyUsefulForTellus: 'Gerenciamento visual de tarefas e backlog de projetos sincronizado com o Tellus ProjectManager.'
      },
      {
        id: 'advanced-tables-obsidian',
        name: 'Advanced Tables',
        repo: 'tgrosinger/advanced-tables-obsidian',
        description: 'Formatação instantânea, navegação com Tab e cálculos de fórmulas em tabelas Markdown.',
        category: 'tables',
        whyUsefulForTellus: 'Edição ágil de métricas de benchmarks, planos de teste e especificações técnicas.'
      },
      {
        id: 'obsidian-linter',
        name: 'Obsidian Linter',
        repo: 'platers/obsidian-linter',
        description: 'Padronização consistente de formatação de notas, espaçamento, tags e frontmatter YAML.',
        category: 'organization',
        whyUsefulForTellus: 'Garante que anotações criadas tanto por humanos quanto por agentes de IA sigam as diretrizes do Tellus.'
      }
    ];

    return recommendations.map(r => ({
      ...r,
      installed: installed.has(r.id)
    }));
  }

  // Install plugin files (manifest.json, main.js, styles.css) directly from GitHub Releases
  public static async installPluginFromGitHub(repo: string, customVaultDir?: string): Promise<ObsidianPluginInfo> {
    const cleanRepo = repo.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
    const baseUrl = `https://github.com/${cleanRepo}/releases/latest/download`;

    const downloadText = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const fetchUrl = (currentUrl: string, redirectsRemaining = 5) => {
          if (redirectsRemaining <= 0) return reject(new Error('Muitos redirecionamentos'));
          https.get(currentUrl, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return fetchUrl(res.headers.location, redirectsRemaining - 1);
            }
            if (res.statusCode !== 200) {
              return reject(new Error(`Falha no download (HTTP ${res.statusCode}) de ${currentUrl}`));
            }
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve(data));
          }).on('error', reject);
        };
        fetchUrl(url);
      });
    };

    // 1. Download manifest.json
    const manifestRaw = await downloadText(`${baseUrl}/manifest.json`);
    const manifest: ObsidianPluginManifest = JSON.parse(manifestRaw);
    const pluginId = manifest.id;
    if (!pluginId) throw new Error('manifest.json não contém o campo "id"');

    const targetDir = path.join(this.getPluginsDir(customVaultDir), pluginId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(path.join(targetDir, 'manifest.json'), manifestRaw, 'utf-8');

    // 2. Download main.js
    const mainJsRaw = await downloadText(`${baseUrl}/main.js`);
    fs.writeFileSync(path.join(targetDir, 'main.js'), mainJsRaw, 'utf-8');

    // 3. Download styles.css (optional)
    try {
      const stylesCssRaw = await downloadText(`${baseUrl}/styles.css`);
      if (stylesCssRaw && stylesCssRaw.length > 0) {
        fs.writeFileSync(path.join(targetDir, 'styles.css'), stylesCssRaw, 'utf-8');
      }
    } catch {
      // styles.css is optional
    }

    // Enable by default
    this.togglePlugin(pluginId, true, customVaultDir);

    return {
      id: pluginId,
      name: manifest.name || pluginId,
      version: manifest.version || '1.0.0',
      description: manifest.description || '',
      author: manifest.author || 'GitHub',
      enabled: true,
      dirPath: targetDir,
      hasMainJs: true,
      hasStylesCss: fs.existsSync(path.join(targetDir, 'styles.css')),
      hasDataJson: false,
      isCustomTellus: false
    };
  }
}
