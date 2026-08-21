import fs from 'fs';
import path from 'path';
import os from 'os';

export interface TellusSkill {
  id: string;
  name: string;
  category: string; // e.g. "Architecture", "Debugging", "Security", "Frontend", "Database"
  agentAssigned?: string; // e.g. "architect", "debugger", "fast_coder", "all"
  description: string;
  promptInstructions: string;
  isProjectSpecific?: boolean;
  updatedAt: number;
}

export interface TellusArtifact {
  id: string;
  title: string;
  type: 'plan' | 'walkthrough' | 'diff' | 'diagram' | 'report' | 'code';
  filename: string;
  content: string;
  relativePath: string;
  createdAt: number;
  updatedAt: number;
}

const GLOBAL_SKILLS_DIR = path.join(os.homedir(), '.tellus', 'skills');

const DEFAULT_SKILLS: TellusSkill[] = [
  {
    id: 'architecture-planner',
    name: 'Architecture & System Design',
    category: 'Architecture',
    agentAssigned: 'architect',
    description: 'Planejamento modular de alto nível, definição de entidades e diagramas Mermaid.',
    promptInstructions: 'Sempre estruture a arquitetura separando domínio, infraestrutura e apresentação. Forneça diagramas Mermaid quando relevante e liste decisões técnicas críticas.',
    updatedAt: Date.now()
  },
  {
    id: 'deep-debugger',
    name: 'Root Cause & Log Investigator',
    category: 'Debugging',
    agentAssigned: 'debugger',
    description: 'Diagnóstico analítico profundo de erros em tempo de execução, memory leaks e exceções.',
    promptInstructions: 'Adote raciocínio passo a passo rigoroso. Localize a linha e a causa raiz antes de sugerir alterações. Priorize correções que previnam regressões.',
    updatedAt: Date.now()
  },
  {
    id: 'security-reviewer',
    name: 'Security & Vulnerability Auditor',
    category: 'Security',
    agentAssigned: 'all',
    description: 'Auditoria de segurança, sanitização de inputs, proteção contra SQLi, XSS e vazamento de chaves.',
    promptInstructions: 'Verifique se nenhuma chave de API ou credencial está exposta no código. Valide todos os inputs e restrinja permissões de acesso.',
    updatedAt: Date.now()
  },
  {
    id: 'api-generator',
    name: 'RESTful API & Service Generator',
    category: 'Backend',
    agentAssigned: 'fast_coder',
    description: 'Geração rápida e tipada de endpoints Express, rotas REST e documentação Swagger.',
    promptInstructions: 'Escreva endpoints com validação robusta de tipos, tratamento de exceções padronizado e respostas JSON limpas com códigos HTTP corretos.',
    updatedAt: Date.now()
  }
];

export class SkillManager {
  private static ensureDirs(projectPath?: string) {
    if (!fs.existsSync(GLOBAL_SKILLS_DIR)) {
      fs.mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true });
    }
    if (projectPath) {
      const projSkills = path.join(projectPath, '.agentic', 'skills');
      const projArtifacts = path.join(projectPath, '.agentic', 'artifacts');
      if (!fs.existsSync(projSkills)) fs.mkdirSync(projSkills, { recursive: true });
      if (!fs.existsSync(projArtifacts)) fs.mkdirSync(projArtifacts, { recursive: true });
    }
  }

  public static listSkills(projectPath?: string): TellusSkill[] {
    this.ensureDirs(projectPath);
    const skills: TellusSkill[] = [];

    // 1. Read Global Skills
    if (fs.existsSync(GLOBAL_SKILLS_DIR)) {
      const files = fs.readdirSync(GLOBAL_SKILLS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(GLOBAL_SKILLS_DIR, file), 'utf-8');
            skills.push(JSON.parse(raw));
          } catch {}
        }
      }
    }

    // 2. Read Project Skills
    if (projectPath) {
      const projSkillsDir = path.join(projectPath, '.agentic', 'skills');
      if (fs.existsSync(projSkillsDir)) {
        const files = fs.readdirSync(projSkillsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const raw = fs.readFileSync(path.join(projSkillsDir, file), 'utf-8');
              skills.push({ ...JSON.parse(raw), isProjectSpecific: true });
            } catch {}
          }
        }
      }
    }

    // Seed defaults if empty
    if (skills.length === 0) {
      for (const s of DEFAULT_SKILLS) {
        this.saveSkill(s);
      }
      return DEFAULT_SKILLS;
    }

    return skills;
  }

  public static saveSkill(skill: TellusSkill, projectPath?: string): TellusSkill {
    this.ensureDirs(projectPath);
    const targetDir = skill.isProjectSpecific && projectPath
      ? path.join(projectPath, '.agentic', 'skills')
      : GLOBAL_SKILLS_DIR;

    const id = skill.id || skill.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fullSkill: TellusSkill = {
      ...skill,
      id,
      updatedAt: Date.now()
    };

    fs.writeFileSync(path.join(targetDir, `${id}.json`), JSON.stringify(fullSkill, null, 2), 'utf-8');
    return fullSkill;
  }

  public static deleteSkill(id: string, isProjectSpecific?: boolean, projectPath?: string): boolean {
    const targetDir = isProjectSpecific && projectPath
      ? path.join(projectPath, '.agentic', 'skills')
      : GLOBAL_SKILLS_DIR;

    const filePath = path.join(targetDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // --- ARTIFACTS MANAGEMENT ---

  public static listArtifacts(projectPath: string): TellusArtifact[] {
    this.ensureDirs(projectPath);
    const artifactsDir = path.join(projectPath, '.agentic', 'artifacts');
    if (!fs.existsSync(artifactsDir)) return [];

    const files = fs.readdirSync(artifactsDir);
    const artifacts: TellusArtifact[] = [];

    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.txt')) {
        const filePath = path.join(artifactsDir, file);
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const id = file.replace(/\.[^.]+$/, '');
        
        let type: TellusArtifact['type'] = 'report';
        if (file.includes('plan')) type = 'plan';
        else if (file.includes('walkthrough')) type = 'walkthrough';
        else if (file.includes('diff')) type = 'diff';
        else if (file.includes('diagram')) type = 'diagram';

        const firstLine = content.split('\n')[0] || file;
        const title = firstLine.replace(/^#+\s*/, '') || file;

        artifacts.push({
          id,
          title,
          type,
          filename: file,
          content,
          relativePath: path.relative(projectPath, filePath).replace(/\\/g, '/'),
          createdAt: stat.birthtimeMs || stat.mtimeMs,
          updatedAt: stat.mtimeMs
        });
      }
    }

    return artifacts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public static saveArtifact(
    projectPath: string,
    title: string,
    content: string,
    type: TellusArtifact['type'] = 'report',
    filename?: string
  ): TellusArtifact {
    this.ensureDirs(projectPath);
    const artifactsDir = path.join(projectPath, '.agentic', 'artifacts');
    const safeFilename = filename || `${type}_${Date.now()}.md`;
    const filePath = path.join(artifactsDir, safeFilename);

    let fullBody = content;
    if (!content.trim().startsWith('#')) {
      fullBody = `# ${title}\n\n${content}`;
    }

    fs.writeFileSync(filePath, fullBody, 'utf-8');
    const stat = fs.statSync(filePath);

    return {
      id: safeFilename.replace(/\.[^.]+$/, ''),
      title,
      type,
      filename: safeFilename,
      content: fullBody,
      relativePath: path.relative(projectPath, filePath).replace(/\\/g, '/'),
      createdAt: stat.birthtimeMs || stat.mtimeMs,
      updatedAt: stat.mtimeMs
    };
  }
}
