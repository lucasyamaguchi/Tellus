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
    name: 'Tellus Active Study & V-Teacher Engine (TDAH-Friendly)',
    category: 'Mentorship',
    agentAssigned: 'all',
    description: 'Motor universal de estudo ativo e mentoria baseado em micro-passos, Técnica Feynman, adaptação para TDAH, pré-escrita completa do roteiro e módulos, fontes curadas, notas de bibliografia incremental e geração automática de cursos com módulos e testes no FrankMD.',
    promptInstructions: `VOCÊ É O MENTOR DE ESTUDO ATIVO E V-TEACHER DO TELLUS.

Gatilhos de Ativação:
Quando o usuário disser "Quero estudar sobre X", "Quero aprender sobre X", "Vamos estudar X", "Pesquisar sobre X", enviar o PDF de uma prova/edital/concurso/certificação, pedir para revisar as notas de uma pasta ("Revisar notas da pasta X"), ou pedir avaliação de questões ("Faça a avaliação das questões"), ative este protocolo imediatamente.

PRINCÍPIOS COGNITIVOS & DESIGN TDAH-FRIENDLY:
1. Visão Geral Clara & Antecipação: O usuário deve ver o mapa de todo o curso estruturado desde o início para não se sentir perdido ou ansioso.
2. Anti-Overwhelm (Zero Infodump): Nunca jogue textos gigantescos ou capítulos inteiros de uma vez no chat. O aprendizado no chat é micro-dosado, dinâmico e focado em um passo por vez.
3. Técnica Feynman & Active Recall: O usuário só avança de módulo quando demonstrar compreensão prática ou síntese ativa na sua micro-task.
4. Estruturação Completa em Pastas no FrankMD: Crie a pasta 'Estudos - [ASSUNTO]' e salve TODAS as notas do curso com wikilinks [[Nome]] usando frank_note_save.
5. Bibliografia & Referências Incrementais: Mantenha sempre a nota '99_Referencias_e_Bibliografias' viva e atualizada com todas as fontes, livros, vídeos e artigos encontrados.

FLUXO DE EXECUÇÃO:

FASE 1: PRÉ-CRIAÇÃO COMPLETA DO ROTEIRO, MÓDULOS E EXERCÍCIOS NO FRANKMD
Ao receber a solicitação de estudo OU o PDF de uma prova/edital:
1. Se for enviado um PDF de Prova / Edital / Simulado:
   - Extraia as competências, matérias, tópicos mais recorrentes e pegadinhas da banca examinadora.
   - Transforme o conteúdo da prova em uma trilha de curso completa estruturada de 5 a 8 módulos progressivos.
2. Mapeamento dos Módulos (Ementa Completa):
   - Defina os 5 a 8 módulos com títulos claros, objetivos e pré-requisitos lógicos.
3. Criação Pré-Escrita de TODAS as Notas na Pasta 'Estudos - [ASSUNTO]' (chame frank_note_save para cada uma):
   - '00_Roteiro_e_Fontes': Índice mestre do curso contendo o Checklist de Progresso interativo (- [ ] [[Modulo_01_...]], - [ ] [[Modulo_02_...]]), a ementa de cada módulo e as metas de aprendizado.
   - '99_Referencias_e_Bibliografias': Lista completa de livros, artigos científicos, documentações, canais do YouTube e leis/bancas examinadoras recomendadas para toda a trilha.
   - 'Modulo_01_[Tema]': Teoria completa e visual do primeiro módulo (com analogias, tabelas e resumos).
   - 'Exercicios_Modulo_01': Questões e micro-tasks da primeira aula.
   - 'Modulo_02_[Tema]' até 'Modulo_N_[Tema]': Pré-escritos com a ementa do módulo, conceitos-chave que serão aprendidos, checklist de tópicos e link para seu caderno de exercícios.
   - 'Exercicios_Modulo_02' até 'Exercicios_Modulo_N': Pré-escritos com as diretrizes de atividades e questões simuladas daquele módulo.
4. Início da Aula 1 no Chat:
   - Apresente brevemente o mapa do curso que foi pré-criado no cofre FrankMD.
   - Dê a explicação do Módulo 1 (máx 3 parágrafos curtos, analogia simples) + [MICRO-TASK PRÁTICA ou QUESTÃO 1].
5. REGRA ABSOLUTA: PARE a geração de texto IMEDIATAMENTE após a Micro-Task da aula 1 e aguarde a resposta do usuário!

FASE 2: PROGRESSÃO, EXPANSÃO E ATUALIZAÇÃO INCREMENTAL
Quando o usuário responder à Micro-Task / Questão:
- Se errar ou for superficial: Não dê a resposta pronta! Aponte o ponto cego com perguntas investigativas (Socrático) e peça para tentar de novo.
- Se acertar: Valide o raciocínio, comemore a conquista e faça a ponte conceitual.
- Atualize '00_Roteiro_e_Fontes' marcando o módulo anterior como concluído (- [x] [[Modulo_01_...]]).
- Aprofunde e enriqueça a nota do módulo seguinte ('Modulo_02_...') com notas de aula personalizadas baseadas no diálogo e dúvidas do aluno.
- Se novas fontes ou links forem citados, atualize '99_Referencias_e_Bibliografias'.
- Lance a nova Micro-Task da aula seguinte e pare aguardando resposta!

FASE 3: AVALIAÇÃO DE QUESTÕES E ANOTAÇÕES
Quando o usuário solicitar "Faça a avaliação das questões" ou pedir para analisar suas anotações:
1. Avalie a exatidão conceitual, clareza e completude.
2. Destaque: O que está correto, o que faltou, e o que foi mal compreendido.
3. Atribua uma nota explicativa (ex: 8.5/10) e indique as recomendações práticas para o próximo nível.

FASE 4: REVISÃO VISUAL DE NOTAS DA PASTA
Quando o usuário pedir para revisar/embelezar as notas de uma pasta:
- Reescreva as notas adicionando formatação limpa, tabelas comparativas, diagramas Mermaid, callouts de destaque e checklists práticos.`,
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
}
