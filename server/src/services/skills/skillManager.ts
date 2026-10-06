import fs from 'fs';
import path from 'path';
import os from 'os';

export interface TellusSkill {
  id: string;
  name: string;
  category: string; // e.g. "Architecture", "Debugging", "Security", "Frontend", "Backend", "Testing"
  agentAssigned?: string; // e.g. "architect", "debugger", "fast_coder", "all"
  description: string;
  promptInstructions: string;
  isProjectSpecific?: boolean;
  isActive?: boolean; // Active state in the current project context
  updatedAt: number;
}

export interface TellusArtifact {
  id: string;
  title: string;
  type: 'plan' | 'walkthrough' | 'diff' | 'diagram' | 'report' | 'code';
  filename: string;
  content: string;
  relativePath: string;
  isGlobal?: boolean;
  createdAt: number;
  updatedAt: number;
}

const GLOBAL_SKILLS_DIR = path.join(os.homedir(), '.tellus', 'skills');
const GLOBAL_ARTIFACTS_DIR = path.join(os.homedir(), '.tellus', 'artifacts');

const DEFAULT_GLOBAL_SKILLS: TellusSkill[] = [
  {
    id: 'architecture-planner',
    name: 'Architecture & System Design',
    category: 'Architecture',
    agentAssigned: 'architect',
    description: 'Planejamento modular de alto nível, definição de entidades e diagramas Mermaid.',
    promptInstructions: 'Sempre estruture a arquitetura separando domínio, infraestrutura e apresentação. Forneça diagramas Mermaid quando relevante e liste decisões técnicas críticas.',
    isProjectSpecific: false,
    updatedAt: Date.now()
  },
  {
    id: 'deep-debugger',
    name: 'Root Cause & Log Investigator',
    category: 'Debugging',
    agentAssigned: 'debugger',
    description: 'Diagnóstico analítico profundo de erros em tempo de execução, memory leaks e exceções.',
    promptInstructions: 'Adote raciocínio passo a passo rigoroso. Localize a linha e a causa raiz antes de sugerir alterações. Priorize correções definitivas que previnam regressões.',
    isProjectSpecific: false,
    updatedAt: Date.now()
  },
  {
    id: 'security-reviewer',
    name: 'Security & Vulnerability Auditor',
    category: 'Security',
    agentAssigned: 'all',
    description: 'Auditoria de segurança, sanitização de inputs, proteção contra SQLi, XSS e vazamento de chaves.',
    promptInstructions: 'Verifique se nenhuma chave de API ou credencial está exposta no código. Valide todos os inputs e restrinja permissões de acesso e dados sensíveis.',
    isProjectSpecific: false,
    updatedAt: Date.now()
  },
  {
    id: 'api-generator',
    name: 'RESTful API & Service Generator',
    category: 'Backend',
    agentAssigned: 'fast_coder',
    description: 'Geração rápida e tipada de endpoints Express, rotas REST e contratos de dados.',
    promptInstructions: 'Escreva endpoints com validação robusta de tipos, tratamento de exceções padronizado e respostas JSON limpas com códigos HTTP semânticos.',
    isProjectSpecific: false,
    updatedAt: Date.now()
  },
  {
    id: 'modern-web-guidance',
    name: 'Modern Web & Clean Frontend',
    category: 'Frontend',
    agentAssigned: 'all',
    description: 'Boas práticas modernas de React, Tailwind CSS, acessibilidade, responsividade e layout.',
    promptInstructions: 'Priorize componentes funcionais limpos, hooks customizados quando necessário, Tailwind moderno, layout flexível responsivo e descanso visual com bom contraste.',
    isProjectSpecific: false,
    updatedAt: Date.now()
  },
  {
    id: 'unit-testing-best-practices',
    name: 'Testing & Quality Assurance',
    category: 'Testing',
    agentAssigned: 'all',
    description: 'Criação de testes unitários e de integração confiáveis e livres de efeitos colaterais.',
    promptInstructions: 'Escreva testes que cubram casos de sucesso, valores de borda e cenários de falha. Mantenha os testes determinísticos e de rápida execução.',
    isProjectSpecific: false,
    updatedAt: Date.now()
  },
  {
    id: 'tellus-study-engine',
    name: 'Tellus Universal Study & Mentorship Engine (Anti-Infodump | Full Roadmap & Aligned Practice)',
    category: 'Mentorship',
    agentAssigned: 'all',
    description: 'Motor universal de estudo esquematizado para Concursos Públicos, Exames, Legislação, Tecnologia e Programação. Entrega o roadmap completo e todos os módulos e atividades no Vault, sem fatiamento artificial e sem infodump prolixo, com exercícios 100% acoplados tópico por tópico em casos práticos e padrão de bancas.',
    promptInstructions: `VOCÊ É O TUTOR UNIVERSAL DE ESTUDO ESQUEMATIZADO E MENTORIA TÉCNICA DO TELLUS.

Gatilhos de Ativação:
Quando o usuário disser "Quero estudar sobre X", "Quero aprender sobre X", "Vamos estudar X", "Pesquisar sobre X", "Quero me candidatar a essa vaga: [requisitos]", "Estudar para o concurso de [cargo/órgão]", enviar o PDF de um edital/prova, pedir resolução/avaliação de questões, OU quando confirmar o início ("do zero", "comece do zero", "iniciante", "pode começar", "vamos lá", "bora"), ATIVE este protocolo imediatamente.

PRINCÍPIOS METODOLÓGICOS FUNDAMENTAIS:

1. ENTREGA TOTAL DO ROADMAP & MÓDULOS (SEM CONTEÚDO PICADO / SEM FATIAMENTO ARTIFICIAL):
   - O estudante deve ter a visão panorâmica e o roteiro completo IMEDIATAMENTE.
   - NUNCA retenha conteúdo nem force entrega a conta-gotas dizendo "vamos ver só o primeiro pedaço e depois eu crio o resto".
   - Todas as notas da trilha completa (Roadmap, Módulos e Caderno de Atividades) devem ser criadas estruturadas no Vault logo no primeiro turno para que o aluno possa navegar livremente.

2. ANTI-INFODUMP POR ESQUEMATIZAÇÃO (ZERO PROSA PROLIXA):
   - Proibição de blocos gigantescos de texto acadêmico ou capítulos soníferos.
   - O material deve ter ALTA DENSIDADE e RÁPIDA ESCANEABILIDADE VISUAL:
     a) Mapas conceituais e fluxogramas de decisão (em Mermaid ou esquemas ASCII).
     b) Tabelas comparativas diretas (Regra Geral vs. Exceção; Conceito A vs. Conceito B; Competência Privativa vs. Concorrente; etc.).
     c) Bullets objetivos com regras e artigos em negrito.
     d) ⚠️ 'Pegadinha da Banca / Ponto de Quebra': Como as bancas examinadoras (FGV, Cebraspe, FCC, Vunesp) ou sistemas em produção tentam induzir ao erro.
     e) 💡 'Mnemônicos & Fórmulas Práticas' para fixação imediata.

3. EXERCÍCIOS 100% ACOPLADOS AO TÓPICO (CONEXÃO DIRETA CAUSA-EFEITO):
   - A queixa central do aluno é: "os exercícios não fazem sentido com o conteúdo que estou estudando e nem sentido com o próprio tópico que tem a pergunta ao final".
   - REGRAS INEGOCIÁVEIS DOS EXERCÍCIOS:
     a) Vinculação Explícita: Toda atividade deve explicitar o subtópico exato a que pertence.
     b) Casos Práticos Reais / Padrão de Banca:
        - Para Concursos (Direito, Legislação, etc.): Cenários hipotéticos ("O servidor público João fez X..."), cobrança de súmulas e jurisprudência vinculada ao tópico.
        - Para Tecnologia (Programação, Arquitetura): Cenários reais de aplicação, refatoração de nós e análise de causa-raiz.
     c) Sentido com o Tópico: A pergunta deve testar EXATAMENTE a regra ou critério distintivo ensinado naquele tópico específico, sem misturar matérias futuras ou conceitos não apresentados.
     d) Gabarito Justificado: Toda questão deve vir com resolução comentada explicando por que cada alternativa está certa ou errada, com remissão direta à regra do módulo.

4. UNIVERSALIDADE DE APLICAÇÃO:
   - A metodologia atende perfeitamente:
     * Concursos Públicos e Exames (Direito Administrativo, Constitucional, Legislação Específica, Português, Raciocínio Lógico, etc.).
     * Tecnologia e Engenharia de Software (Linguagens, Frameworks, Cloud, DevOps, Arquitetura).
     * Preparação para Vagas e Processos Seletivos Técnicos.

ESTRUTURA COMPLETA NO VAULT (chame note_save / frank_note_save):
Crie dentro de 'Estudos/[Assunto ou Concurso]' (ou 'Carreira/Vaga - [Cargo]'):
- '00_Roadmap_e_Ementa_Geral': Raio-X do edital/assunto, checklist de todos os módulos (- [ ] [[Modulo_01_...]]) e referências oficiais/bancas de questões.
- 'Modulo_01_[Tema]', 'Modulo_02_[Tema]' ... 'Modulo_N_[Tema]': Todos os módulos da ementa esquematizados, com tabelas comparativas, fluxogramas e alertas de pegadinha.
- 'Caderno_de_Questoes_e_Atividades': Todas as questões e atividades contextualizadas de cada módulo, agrupadas por subtópico, com gabarito comentado ao final.

FLUXO NO CHAT:
1. Apresente em 2 parágrafos a visão geral do Roadmap, confirmando que todos os módulos e o caderno de exercícios já estão criados e disponíveis no Vault com wikilinks.
2. Forneça uma síntese executiva de alto impacto do Módulo 01 (máx 3 parágrafos esquematizados com tabela ou fluxo visual).
3. Destaque as primeiras 2 a 3 questões do Módulo 01 para o aluno resolver agora no chat ou praticar no seu ritmo.
4. Dê liberdade ao aluno: ele pode responder as questões no chat para validação socrática, pedir aprofundamento de qualquer tópico, ou navegar pelas notas no Vault.`,
    isProjectSpecific: false,
    updatedAt: Date.now()
  }
];

export class SkillManager {
  private static ensureDirs(projectPath?: string) {
    if (!fs.existsSync(GLOBAL_SKILLS_DIR)) {
      fs.mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true });
    }
    if (!fs.existsSync(GLOBAL_ARTIFACTS_DIR)) {
      fs.mkdirSync(GLOBAL_ARTIFACTS_DIR, { recursive: true });
    }
    if (projectPath) {
      const projSkills = path.join(projectPath, '.agentic', 'skills');
      const projArtifacts = path.join(projectPath, '.agentic', 'artifacts');
      if (!fs.existsSync(projSkills)) fs.mkdirSync(projSkills, { recursive: true });
      if (!fs.existsSync(projArtifacts)) fs.mkdirSync(projArtifacts, { recursive: true });
    }
  }

  // Get list of active skill IDs for a project
  private static getProjectActiveSkillIds(projectPath: string): { [id: string]: boolean } | null {
    try {
      const activeConfigPath = path.join(projectPath, '.agentic', 'active_skills.json');
      if (fs.existsSync(activeConfigPath)) {
        const content = fs.readFileSync(activeConfigPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch {}
    return null;
  }

  // Set active skill state in project
  public static toggleSkillActive(skillId: string, isActive: boolean, projectPath: string): boolean {
    this.ensureDirs(projectPath);
    const activeConfigPath = path.join(projectPath, '.agentic', 'active_skills.json');
    let map: { [id: string]: boolean } = {};
    if (fs.existsSync(activeConfigPath)) {
      try {
        map = JSON.parse(fs.readFileSync(activeConfigPath, 'utf-8'));
      } catch {}
    }
    map[skillId] = isActive;
    fs.writeFileSync(activeConfigPath, JSON.stringify(map, null, 2), 'utf-8');
    return true;
  }

  public static listSkills(projectPath?: string): TellusSkill[] {
    this.ensureDirs(projectPath);
    const skillsMap = new Map<string, TellusSkill>();

    // Ensure all default global skills exist in global dir
    for (const s of DEFAULT_GLOBAL_SKILLS) {
      const skillPath = path.join(GLOBAL_SKILLS_DIR, `${s.id}.json`);
      if (!fs.existsSync(skillPath)) {
        try {
          fs.writeFileSync(skillPath, JSON.stringify(s, null, 2), 'utf-8');
        } catch {}
      }
    }

    // 1. Read Global Skills
    if (fs.existsSync(GLOBAL_SKILLS_DIR)) {
      const files = fs.readdirSync(GLOBAL_SKILLS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(GLOBAL_SKILLS_DIR, file), 'utf-8');
            const parsed: TellusSkill = JSON.parse(raw);
            parsed.isProjectSpecific = false;
            parsed.isActive = true; // Global skills active by default
            skillsMap.set(parsed.id, parsed);
          } catch {}
        }
      }
    }

    // 2. Read Project-Specific Skills
    if (projectPath) {
      const projSkillsDir = path.join(projectPath, '.agentic', 'skills');
      if (fs.existsSync(projSkillsDir)) {
        const files = fs.readdirSync(projSkillsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const raw = fs.readFileSync(path.join(projSkillsDir, file), 'utf-8');
              const parsed: TellusSkill = JSON.parse(raw);
              parsed.isProjectSpecific = true;
              parsed.isActive = true;
              skillsMap.set(parsed.id, parsed);
            } catch {}
          }
        }
      }

      // Apply project active status overrides if configured
      const activeOverrides = this.getProjectActiveSkillIds(projectPath);
      if (activeOverrides) {
        for (const [id, skill] of skillsMap.entries()) {
          if (typeof activeOverrides[id] === 'boolean') {
            skill.isActive = activeOverrides[id];
          }
        }
      }
    }

    return Array.from(skillsMap.values()).sort((a, b) => {
      if (a.isProjectSpecific === b.isProjectSpecific) {
        return a.name.localeCompare(b.name);
      }
      return a.isProjectSpecific ? -1 : 1;
    });
  }

  public static saveSkill(skill: TellusSkill, projectPath?: string): TellusSkill {
    this.ensureDirs(projectPath);
    const isProj = !!skill.isProjectSpecific && !!projectPath;
    const targetDir = isProj
      ? path.join(projectPath!, '.agentic', 'skills')
      : GLOBAL_SKILLS_DIR;

    const id = skill.id || skill.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fullSkill: TellusSkill = {
      ...skill,
      id,
      isProjectSpecific: isProj,
      isActive: skill.isActive !== false,
      updatedAt: Date.now()
    };

    fs.writeFileSync(path.join(targetDir, `${id}.json`), JSON.stringify(fullSkill, null, 2), 'utf-8');

    if (projectPath && typeof skill.isActive === 'boolean') {
      this.toggleSkillActive(id, skill.isActive, projectPath);
    }

    return fullSkill;
  }

  // Import skill from Markdown (.md / SKILL.md)
  public static importMarkdownSkill(
    filename: string,
    content: string,
    isProjectSpecific?: boolean,
    projectPath?: string
  ): TellusSkill {
    let name = filename.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
    let description = '';
    let category = 'General';
    let promptInstructions = content;

    // 1. Check for YAML frontmatter
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const yamlContent = frontmatterMatch[1];
      promptInstructions = frontmatterMatch[2].trim();

      const nameMatch = yamlContent.match(/^name:\s*(.+)$/m);
      if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, '');

      const descMatch = yamlContent.match(/^description:\s*(.+)$/m);
      if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, '');

      const catMatch = yamlContent.match(/^category:\s*(.+)$/m);
      if (catMatch) category = catMatch[1].trim().replace(/^["']|["']$/g, '');
    } else {
      // 2. Check for # Heading 1
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        name = titleMatch[1].trim();
      }

      // Check for first short paragraph as description
      const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      if (lines.length > 0) {
        description = lines[0].slice(0, 150);
      }
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40) || 'imported-skill';

    const skillData: TellusSkill = {
      id,
      name,
      description: description || `Skill importada de ${filename}`,
      category: category || 'General',
      agentAssigned: 'all',
      promptInstructions,
      isProjectSpecific: !!isProjectSpecific,
      isActive: true,
      updatedAt: Date.now()
    };

    return this.saveSkill(skillData, projectPath);
  }

  public static deleteSkill(id: string, isProjectSpecific?: boolean, projectPath?: string): boolean {
    const isProj = isProjectSpecific && projectPath;
    const targetDir = isProj
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

  public static listArtifacts(projectPath?: string): TellusArtifact[] {
    this.ensureDirs(projectPath);
    const artifacts: TellusArtifact[] = [];

    // 1. Project Artifacts
    if (projectPath) {
      const artifactsDir = path.join(projectPath, '.agentic', 'artifacts');
      if (fs.existsSync(artifactsDir)) {
        const files = fs.readdirSync(artifactsDir);
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
              isGlobal: false,
              createdAt: stat.birthtimeMs || stat.mtimeMs,
              updatedAt: stat.mtimeMs
            });
          }
        }
      }
    }

    // 2. Global Artifacts / Blueprints
    if (fs.existsSync(GLOBAL_ARTIFACTS_DIR)) {
      const files = fs.readdirSync(GLOBAL_ARTIFACTS_DIR);
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.txt')) {
          const filePath = path.join(GLOBAL_ARTIFACTS_DIR, file);
          const stat = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf-8');
          const id = `global_${file.replace(/\.[^.]+$/, '')}`;
          
          let type: TellusArtifact['type'] = 'report';
          if (file.includes('plan')) type = 'plan';
          else if (file.includes('walkthrough')) type = 'walkthrough';
          else if (file.includes('diff')) type = 'diff';
          else if (file.includes('diagram')) type = 'diagram';

          const firstLine = content.split('\n')[0] || file;
          const title = firstLine.replace(/^#+\s*/, '') || file;

          artifacts.push({
            id,
            title: `[Global] ${title}`,
            type,
            filename: file,
            content,
            relativePath: file,
            isGlobal: true,
            createdAt: stat.birthtimeMs || stat.mtimeMs,
            updatedAt: stat.mtimeMs
          });
        }
      }
    }

    return artifacts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public static saveArtifact(
    projectPath: string,
    title: string,
    content: string,
    type: TellusArtifact['type'] = 'report',
    filename?: string,
    isGlobal = false
  ): TellusArtifact {
    this.ensureDirs(projectPath);
    const targetDir = isGlobal
      ? GLOBAL_ARTIFACTS_DIR
      : path.join(projectPath, '.agentic', 'artifacts');

    const safeFilename = filename || `${type}_${Date.now()}.md`;
    const filePath = path.join(targetDir, safeFilename);

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
      relativePath: isGlobal ? safeFilename : path.relative(projectPath, filePath).replace(/\\/g, '/'),
      isGlobal,
      createdAt: stat.birthtimeMs || stat.mtimeMs,
      updatedAt: stat.mtimeMs
    };
  }

  public static deleteArtifact(filename: string, isGlobal = false, projectPath?: string): boolean {
    const targetDir = isGlobal || !projectPath
      ? GLOBAL_ARTIFACTS_DIR
      : path.join(projectPath, '.agentic', 'artifacts');

    const filePath = path.join(targetDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // Build Context for the Agent System Prompt
  public static buildSkillsContextPrompt(projectPath: string): string {
    const allSkills = this.listSkills(projectPath);
    const activeSkills = allSkills.filter(s => s.isActive !== false);

    if (activeSkills.length === 0) return '';

    let prompt = `## 🎯 ACTIVE SKILLS & CAPABILITIES CONFIGURATION\n`;
    prompt += `The user has enabled the following specialized skills for this project. Adhere strictly to these domain guidelines:\n\n`;

    for (const skill of activeSkills) {
      const scopeLabel = skill.isProjectSpecific ? '[Project Skill]' : '[Global Default Skill]';
      prompt += `### ${scopeLabel} ${skill.name} (Category: ${skill.category})\n`;
      prompt += `*Description:* ${skill.description}\n`;
      prompt += `*Instructions:* ${skill.promptInstructions}\n\n`;
    }

    // List available project artifacts if any exist
    const artifacts = this.listArtifacts(projectPath).filter(a => !a.isGlobal);
    if (artifacts.length > 0) {
      prompt += `## 📋 PROJECT ARTIFACTS & SPECIFICATIONS (.agentic/artifacts)\n`;
      prompt += `The following project artifacts and architectural blueprints are available in this project:\n`;
      for (const art of artifacts) {
        prompt += `- \`${art.relativePath}\`: ${art.title} (Type: ${art.type})\n`;
      }
      prompt += `You can inspect them using \`read_file\` whenever necessary.\n\n`;
    }

    return prompt;
  }

  // Generate Interactive Skills & Agents Graph
  public static getSkillsGraphData(projectPath?: string): {
    nodes: Array<{ id: string; label: string; type: string; val: number; color?: string; details?: string }>;
    links: Array<{ source: string; target: string; type: string }>;
  } {
    const allSkills = this.listSkills(projectPath);
    const nodes: Array<{ id: string; label: string; type: string; val: number; color?: string; details?: string }> = [];
    const links: Array<{ source: string; target: string; type: string }> = [];

    const categories = new Set<string>();
    const agents = new Set<string>();

    for (const skill of allSkills) {
      const cat = skill.category || 'General';
      const agent = skill.agentAssigned || 'all';
      categories.add(cat);
      agents.add(agent);

      const isActive = skill.isActive !== false;
      const skillColor = !isActive 
        ? '#64748b' 
        : (skill.isProjectSpecific ? '#38bdf8' : '#06b6d4');

      nodes.push({
        id: `skill_${skill.id}`,
        label: skill.name,
        type: 'skill',
        val: 12,
        color: skillColor,
        details: skill.description
      });

      // Link Skill -> Category
      links.push({
        source: `skill_${skill.id}`,
        target: `cat_${cat}`,
        type: 'skill_category'
      });

      // Link Skill -> Agent
      links.push({
        source: `skill_${skill.id}`,
        target: `agent_${agent}`,
        type: 'skill_agent'
      });
    }

    // Category Nodes
    for (const cat of Array.from(categories)) {
      nodes.push({
        id: `cat_${cat}`,
        label: `📂 ${cat}`,
        type: 'category',
        val: 18,
        color: '#f59e0b',
        details: `Categoria de competências técnicas: ${cat}`
      });
    }

    // Agent Nodes
    const agentLabels: Record<string, string> = {
      all: '🤖 Todos os Agentes (Universal)',
      architect: '🏛️ Agente Arquiteto (High-Level)',
      debugger: '🔍 Agente Diagnóstico (Deep Debugger)',
      fast_coder: '⚡ Agente Codificador Rápido',
    };

    for (const agent of Array.from(agents)) {
      nodes.push({
        id: `agent_${agent}`,
        label: agentLabels[agent] || `🤖 Agente ${agent}`,
        type: 'agent',
        val: 16,
        color: '#a855f7',
        details: `Especialista responsável pelas rotinas de execução: ${agent}`
      });
    }

    // Inter-skill synergy connections (e.g. Architecture <-> API Generator, Debugger <-> Testing)
    const synergyPairs: Array<[string, string]> = [
      ['architecture-planner', 'api-generator'],
      ['architecture-planner', 'security-reviewer'],
      ['deep-debugger', 'unit-testing-best-practices'],
      ['modern-web-guidance', 'api-generator'],
      ['tellus-study-engine', 'architecture-planner'],
      ['tellus-study-engine', 'unit-testing-best-practices']
    ];

    for (const [s1, s2] of synergyPairs) {
      if (allSkills.some(s => s.id === s1) && allSkills.some(s => s.id === s2)) {
        links.push({
          source: `skill_${s1}`,
          target: `skill_${s2}`,
          type: 'synergy'
        });
      }
    }

    return { nodes, links };
  }
}

