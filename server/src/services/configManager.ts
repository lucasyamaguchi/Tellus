import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AgentPipelineConfig {
  primaryModel: string;
  plannerModel?: string;
  codingModel?: string;
  reasoningModel?: string;
  fastToolsModel?: string;
}

export interface AppConfig {
  keys: {
    openrouter?: string;
    google?: string;
    anthropic?: string;
    openai?: string;
  };
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
}

const CONFIG_DIR = path.join(os.homedir(), '.tellus');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  keys: {},
  defaultModel: 'deepseek/deepseek-r1',
  defaultProvider: 'openrouter',
  recentProjects: [],
  openProjects: [],
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
      return { ...DEFAULT_CONFIG, ...parsed, keys: { ...DEFAULT_CONFIG.keys, ...parsed.keys } };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  public static updateConfig(updates: Partial<AppConfig>): AppConfig {
    const current = this.getConfig();
    const merged: AppConfig = {
      ...current,
      ...updates,
      keys: { ...current.keys, ...(updates.keys || {}) },
      customRoutines: updates.customRoutines || current.customRoutines
    };

    this.ensureDir();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
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
