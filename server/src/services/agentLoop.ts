import fs from 'fs';
import path from 'path';
import { FileTools } from './tools/fileTools.js';
import { TerminalRunner } from './tools/terminalRunner.js';
import { ScreenCapture } from './tools/screenCapture.js';
import { WebScraper } from './tools/webScraper.js';
import { MemoryEngine } from './memory/memoryEngine.js';
import { FrankNoteEngine } from './notes/frankNoteEngine.js';
import { SkillManager } from './skills/skillManager.js';
import { ProviderHub } from './providers/providerHub.js';
import { ChatMessage, ToolDefinition } from './providers/openrouter.js';
import { ConfigManager } from './configManager.js';

// Strict Portunhol / Spanish replacement map for Portuguese responses (especially from DeepSeek)
const PORTUNHOL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bdesarrollo\b/gi, 'desenvolvimento'],
  [/\bdesarrollos\b/gi, 'desenvolvimentos'],
  [/\bdesarrollar\b/gi, 'desenvolver'],
  [/\bdesarrollando\b/gi, 'desenvolvendo'],
  [/\bdesarrollador\b/gi, 'desenvolvedor'],
  [/\bdesarrolladores\b/gi, 'desenvolvedores'],
  [/\btambien\b/gi, 'também'],
  [/\bademas\b/gi, 'além disso'],
  [/\bcarpetas?\b/gi, 'pasta'],
  [/\barchivos?\b/gi, 'arquivo'],
  [/\bpantallas?\b/gi, 'tela'],
  [/\barquitectura\b/gi, 'arquitetura'],
  [/\barquitecturas\b/gi, 'arquiteturas'],
  [/\bejercicios?\b/gi, 'exercício'],
  [/\bpreguntas?\b/gi, 'pergunta'],
  [/\brespuestas?\b/gi, 'resposta'],
  [/\bherramientas?\b/gi, 'ferramenta'],
  [/\bcrear\b/gi, 'criar'],
  [/\bhacer\b/gi, 'fazer'],
  [/\bhaciendo\b/gi, 'fazendo'],
  [/\bhecho\b/gi, 'feito'],
  [/\bguardar\b/gi, 'salvar'],
  [/\busted\b/gi, 'você'],
  [/\bustedes\b/gi, 'vocês'],
  [/\bdespues\b/gi, 'depois'],
  [/\bentonces\b/gi, 'então'],
  [/\bpero\b/gi, 'mas'],
  [/\bcodigo\b/gi, 'código'],
  [/\bcodigos\b/gi, 'códigos'],
  [/\bseguridad\b/gi, 'segurança'],
  [/\bcomunicacion\b/gi, 'comunicação'],
  [/\bconfiguracion\b/gi, 'configuração'],
  [/\bfuncionalidad\b/gi, 'funcionalidade'],
  [/\bfuncionalidades\b/gi, 'funcionalidades'],
  [/\bautenticacion\b/gi, 'autenticação'],
  [/\bautorizacion\b/gi, 'autorização'],
  [/\bvalidacion\b/gi, 'validação'],
  [/\boptimizacion\b/gi, 'otimização'],
  [/\bintroduccion\b/gi, 'introdução'],
  [/\bconclusiones\b/gi, 'conclusões'],
  [/\bconclusion\b/gi, 'conclusão'],
  [/\bejecutar\b/gi, 'executar'],
  [/\bejecucion\b/gi, 'execução'],
  [/\bdiseno\b/gi, 'design'],
  [/\binterfaz\b/gi, 'interface'],
  [/\binterfaces\b/gi, 'interfaces'],
  [/\busuario\b/gi, 'usuário'],
  [/\busuarios\b/gi, 'usuários']
];

export function sanitizePortugueseText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;
  for (const [pattern, replacement] of PORTUNHOL_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match[0] === match[0].toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }
  return sanitized;
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lê o conteúdo completo de um arquivo de texto no projeto.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo do arquivo no projeto (ex: "src/index.ts")' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Cria ou sobrescreve um arquivo no projeto com o conteúdo especificado.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo do arquivo no projeto (ex: "src/utils.ts")' },
          content: { type: 'string', description: 'Conteúdo completo a ser gravado no arquivo' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edita um arquivo substituindo exatamente um trecho existente por um novo trecho de código.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo do arquivo (ex: "src/app.tsx")' },
          target_content: { type: 'string', description: 'Trecho exato de código a ser substituído (incluindo quebras de linha e indentação)' },
          replacement_content: { type: 'string', description: 'Novo trecho de código que substituirá o target_content' }
        },
        required: ['path', 'target_content', 'replacement_content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'Lista arquivos e diretórios dentro do projeto.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo do diretório (padrão: ".")' },
          depth: { type: 'number', description: 'Profundidade máxima de busca (padrão: 2)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep_search',
      description: 'Procura um termo ou padrão em todos os arquivos de código do projeto.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo a ser pesquisado' },
          path_filter: { type: 'string', description: 'Filtro de pasta opcional (ex: "src")' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Executa um comando no terminal do projeto (ex: "npm test", "npm run build", "git status") e retorna a saída.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Comando de terminal a ser executado' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'memory_query',
      description: 'Pesquisa na base de memória de longo prazo do projeto (decisões anteriores, gotchas, procedimentos, handoffs).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Palavras-chave ou tópico a consultar na memória' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'memory_write_page',
      description: 'Grava uma página permanente no wiki de memória do projeto para nunca perder o contexto.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['decisions', 'procedures', 'gotchas'],
            description: 'Categoria da memória: "decisions" (arquitetura), "procedures" (como rodar/scripts), "gotchas" (erros/armadilhas)'
          },
          filename: { type: 'string', description: 'Nome do arquivo (ex: "0003-auth-strategy.md" ou "fix-cors.md")' },
          title: { type: 'string', description: 'Título claro da nota' },
          content: { type: 'string', description: 'Conteúdo em Markdown' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags opcionais para recuperação' }
        },
        required: ['category', 'filename', 'title', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'memory_update_context',
      description: 'Atualiza o active_context.md com o objetivo ativo, progresso e próximos passos para manter a continuidade.',
      parameters: {
        type: 'object',
        properties: {
          new_content: { type: 'string', description: 'Conteúdo Markdown completo e atualizado para active_context.md' }
        },
        required: ['new_content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'screenshot_screen',
      description: 'Captura a tela atual do computador para inspecionar erros no VS Code, navegador ou aplicativos visualmente.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_scrape',
      description: 'Faz o scraping do conteúdo de uma página da web e opcionalmente exporta para um diretório ou arquivo no projeto.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL da página web a ser raspada' },
          export_path: { type: 'string', description: 'Caminho do arquivo de destino no projeto (ex: "data/scrapes/artigo.md")' },
          format: { type: 'string', enum: ['markdown', 'text', 'html', 'json'], description: 'Formato de saída desejado' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'artifact_create',
      description: 'Gera e salva um artefato estruturado no projeto (.agentic/artifacts/) como planos, walkthroughs, diagramas ou relatórios.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título do artefato' },
          type: { type: 'string', enum: ['plan', 'walkthrough', 'diff', 'diagram', 'report'], description: 'Tipo do artefato' },
          content: { type: 'string', description: 'Conteúdo Markdown completo do artefato' },
          filename: { type: 'string', description: 'Nome opcional do arquivo (ex: "implementation_plan.md")' }
        },
        required: ['title', 'type', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'note_save',
      description: 'Cria ou atualiza uma anotação estruturada no Notes Module / Obsidian Vault dentro de um Caderno e Subpasta especificados com wikilinks [[Nota]] e tags #tag.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título claro da nota em português (sem espanhol)' },
          folder: { type: 'string', description: 'Caminho hierárquico do Caderno e Subpasta no cofre usando barras (ex: "Estudos/Arquitetura de Software", "Carreira/Nestle"). NUNCA use hífen como separador de pasta!' },
          subject: { type: 'string', description: 'Assunto ou tema principal da nota' },
          content: { type: 'string', description: 'Conteúdo em Markdown com wikilinks [[Outra Nota]] e #tags' },
          is_project_specific: { type: 'boolean', description: 'Se true salva no projeto atual, se false salva no cofre global' }
        },
        required: ['title', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'frank_note_save',
      description: '[Alias de compatibilidade legado para note_save] Cria ou atualiza uma anotação no Notes Module.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título claro da nota' },
          folder: { type: 'string', description: 'Caminho do Caderno e Subpasta no cofre' },
          subject: { type: 'string', description: 'Assunto ou tema principal da nota' },
          content: { type: 'string', description: 'Conteúdo em Markdown' },
          is_project_specific: { type: 'boolean', description: 'Se true salva no projeto atual, se false salva no cofre global' }
        },
        required: ['title', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'memory_create_handoff',
      description: 'Gera um snapshot de transição (handoff) para outro modelo ou próxima sessão.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Resumo claro do que foi feito e do estado atual do sistema' },
          next_steps: { type: 'array', items: { type: 'string' }, description: 'Lista de próximos passos imediatos' },
          open_questions: { type: 'array', items: { type: 'string' }, description: 'Perguntas ou pendências em aberto' }
        },
        required: ['summary']
      }
    }
  }
];

export class AgentLoop {
  public static async executeTool(
    projectPath: string,
    toolName: string,
    rawArgs: string,
    currentModel: string
  ): Promise<any> {
    let args: any = {};
    try {
      args = JSON.parse(rawArgs);
    } catch {
      return { error: 'Argumentos de ferramenta inválidos (JSON malformado)' };
    }

    try {
      switch (toolName) {
        case 'read_file': {
          const result = FileTools.readFile(projectPath, args.path);
          return { status: 'success', path: args.path, size: result.size, content: result.content };
        }
        case 'write_file': {
          const res = FileTools.writeFile(projectPath, args.path, args.content);
          return { status: 'success', path: args.path, bytesWritten: res.bytesWritten, message: `Arquivo ${args.path} gravado com sucesso.` };
        }
        case 'edit_file': {
          const res = FileTools.editFile(projectPath, args.path, args.target_content, args.replacement_content);
          return { status: 'success', path: args.path, message: res.message };
        }
        case 'list_dir': {
          const items = FileTools.listDir(projectPath, args.path || '.', args.depth || 2);
          return { status: 'success', count: items.length, items };
        }
        case 'grep_search': {
          const matches = FileTools.grepSearch(projectPath, args.query, args.path_filter);
          return { status: 'success', query: args.query, matchCount: matches.length, matches };
        }
        case 'run_command': {
          const res = await TerminalRunner.runCommand(projectPath, args.command);
          return {
            status: res.exitCode === 0 ? 'success' : 'error',
            command: args.command,
            exitCode: res.exitCode,
            output: res.output.slice(0, 8000)
          };
        }
        case 'memory_query': {
          const results = MemoryEngine.queryMemory(projectPath, args.query);
          return {
            status: 'success',
            query: args.query,
            count: results.length,
            results: results.slice(0, 5).map(r => ({
              category: r.page.category,
              title: r.page.title,
              filename: r.page.filename,
              snippets: r.matchedSnippets,
              preview: r.page.content.slice(0, 400)
            }))
          };
        }
        case 'memory_write_page': {
          const page = MemoryEngine.writeMemoryPage(
            projectPath,
            args.category,
            args.filename,
            args.title,
            args.content,
            args.tags
          );
          return { status: 'success', page: { category: page.category, filename: page.filename, title: page.title } };
        }
        case 'memory_update_context': {
          MemoryEngine.updateActiveContext(projectPath, args.new_content);
          return { status: 'success', message: 'active_context.md atualizado com sucesso.' };
        }
        case 'screenshot_screen': {
          const capture = await ScreenCapture.captureScreen(projectPath);
          return { status: 'success', message: 'Captura de tela realizada.', attachment: capture };
        }
        case 'web_scrape': {
          const scraped = await WebScraper.scrapeUrl(projectPath, args.url, args.export_path, args.format);
          return { status: 'success', ...scraped };
        }
        case 'artifact_create': {
          const artifact = SkillManager.saveArtifact(
            projectPath,
            args.title,
            args.content,
            args.type || 'report',
            args.filename
          );
          return { status: 'success', artifact: { id: artifact.id, title: artifact.title, path: artifact.relativePath } };
        }
        case 'note_save':
        case 'frank_note_save': {
          const cfg = ConfigManager.getConfig();
          const isPt = (cfg.locale || 'pt-BR').startsWith('pt');
          let rawFolder = (args.folder || args.subject || 'Geral').replace(/\\/g, '/').trim();
          rawFolder = rawFolder.replace(/\s+-\s+/g, '/');
          const cleanTitle = isPt ? sanitizePortugueseText(args.title) : args.title;
          const cleanFolder = isPt ? sanitizePortugueseText(rawFolder) : rawFolder;
          let rawSubject = args.subject || (cleanFolder.includes('/') ? cleanFolder.split('/').slice(1).join('/') : cleanFolder);
          if (rawSubject.includes(' - ')) {
            const parts = rawSubject.split(/\s+-\s+/);
            rawSubject = parts[parts.length - 1];
          }
          const cleanSubject = isPt ? sanitizePortugueseText(rawSubject) : rawSubject;
          const cleanContent = isPt ? sanitizePortugueseText(args.content) : args.content;
          const note = FrankNoteEngine.saveNote({
            title: cleanTitle,
            folder: cleanFolder,
            subject: cleanSubject,
            content: cleanContent,
            isProjectSpecific: args.is_project_specific
          }, projectPath);
          return { 
            status: 'success', 
            note: { 
              id: note.id, 
              title: note.title, 
              folder: note.folder, 
              subject: note.subject,
              relativePath: note.relativePath 
            } 
          };
        }
        case 'memory_create_handoff': {
          const handoff = MemoryEngine.createHandoff(
            projectPath,
            currentModel,
            args.summary,
            args.next_steps || [],
            args.open_questions || []
          );
          return { status: 'success', handoff: { filename: handoff.filename, title: handoff.title } };
        }
        default:
          return { error: `Ferramenta desconhecida: ${toolName}` };
      }
    } catch (err: any) {
      return { error: err.message || 'Erro durante a execução da ferramenta' };
    }
  }

  public static async runAutonomousTurn(
    projectPath: string,
    provider: 'openrouter' | 'google' | 'anthropic' | 'openai' | 'auto',
    model: string,
    messages: ChatMessage[],
    systemPrompt: string,
    onEvent: (event: {
      type: 'content' | 'reasoning' | 'tool_start' | 'tool_end' | 'turn_complete' | 'error';
      data: any;
    }) => void,
    maxToolSteps = 10,
    abortSignal?: AbortSignal
  ): Promise<{ fullMessages: ChatMessage[] }> {
    const memoryContext = MemoryEngine.buildContextPrompt(projectPath);
    const skillsContext = SkillManager.buildSkillsContextPrompt(projectPath);
    
    // 1. Language Harness based on Configuration & Input:
    const config = ConfigManager.getConfig();
    const configuredLocale = config.locale || 'pt-BR';
    const configuredLanguage = config.language || 'Português (Brasil)';
    const configuredCountry = config.country || 'Brasil';
    const isStrict = config.enforceStrictLanguage !== false;

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    let userText = '';
    if (typeof lastUserMsg?.content === 'string') {
      userText = lastUserMsg.content;
    } else if (Array.isArray(lastUserMsg?.content)) {
      userText = lastUserMsg.content.map(p => p.text || '').join(' ');
    }

    const isTargetPortuguese = configuredLocale.startsWith('pt') || configuredLanguage.toLowerCase().includes('portugu');
    let targetLanguage = configuredLanguage;
    let targetLocale = configuredLocale;
    if (!isStrict) {
      const isEnglishOnly = /\b(the|and|is|are|please|write|create|solve|how|what|why|code)\b/i.test(userText) && !/\b(você|para|como|quero|estudar|anote|vaga|não|com|de|em|olá|oi|bom|boa)\b/i.test(userText);
      if (isEnglishOnly) {
        targetLanguage = 'INGLÊS (English - en-US)';
        targetLocale = 'en-US';
      }
    }

    // Dynamic Language Enforcement Anchor:
    const languageAnchor = `[🚨 HARNESS OFICIAL E MANDATÓRIA DE IDIOMA E REGIONALIZAÇÃO TELLUS - ZERO TOLERÂNCIA A PORTUNHOL/ESPANHOL]
- IDIOMA OFICIAL MANDATÓRIO CONFIGURADO PELO USUÁRIO: **${targetLanguage}** (Locale: ${targetLocale}, Regionalização: ${configuredCountry}).
${isTargetPortuguese ? `- DIRETRIZ CRÍTICA PARA MODELOS DEEPSEEK (V3, V4, R1) E OUTROS MODELOS MULTILÍNGUES:
  Modelos DeepSeek frequentemente contaminam respostas em português com termos em espanhol. ISTO É TERMINANTEMENTE PROIBIDO NESTE SISTEMA!
  - NUNCA use termos em espanhol como: "desarrollo", "tambien", "pero", "ademas", "hacer", "pantalla", "archivo", "carpeta", "arquitectura", "ejercicios", "preguntas", "codigo", "requisitos".
  - SEMPRE use português brasileiro legítimo: "desenvolvimento", "também", "mas / porém", "além disso", "fazer", "tela", "arquivo", "pasta", "arquitetura", "exercícios", "perguntas", "código", "requisitos".
  - 100% de todas as palavras, explicações, saídas, raciocínios (deep thought/reasoning), títulos de notas, nomes de pastas e chamadas de ferramenta devem ser em ${targetLanguage}.` : `- VOCÊ DEVE RESPONDER 100% NO IDIOMA OFICIAL: **${targetLanguage}** (${targetLocale}).
  Todas as explicações, raciocínios, anotações, títulos e respostas devem seguir rigorosamente o idioma configurado.`}
- Toda e qualquer nota deve ser salva chamando a ferramenta 'note_save' com o título e a pasta no idioma oficial configurado.
- Ignore e rejeite qualquer contaminação linguística de mensagens antigas do histórico que tenham sido redigidas em outro idioma.`;

    // Handwritten Notebook OCR & Visual Note-Taking Policy
    const handwrittenOcrPolicy = `[📸 RECONHECIMENTO DE FOTOS DE CADERNO E ANOTAÇÕES MANUSCRITAS ("Anote Isso")]
- Quando o usuário anexar uma foto de caderno, anotação manuscrita, lousa ou papel e pedir para "anotar", "anote isso", "digitalizar", "transcrever" ou "salvar nas notas":
  1. Realize OCR visual minucioso da caligrafia, transcrevendo com precisão o texto manuscrito para Markdown estruturado e limpo.
  2. Preserve fórmulas matemáticas em LaTeX ($...$ ou $$...$$), diagramas (em Mermaid ou blocos de código), tabelas, títulos e listas com marcadores.
  3. Salve AUTOMATICAMENTE a anotação transcrita chamando a ferramenta 'note_save', escolhendo um título expressivo e direcionando para o Caderno apropriado (ex: folder: "Caderno de Anotações/Manuscritos" ou "Estudos/Anotações à Mão").
  4. Responda no chat no idioma oficial (${targetLanguage}) confirmando a digitalização com um resumo objetivo e o link clicável da nota criada.`;

    // Notebooks & Subfolders System Guidelines
    const notebooksPolicy = `[📓 SISTEMA DE CADERNOS (NOTEBOOKS) E SUBPASTAS DO NOTES MODULE VAULT]
- O cofre é organizado na hierarquia: CADERNO (Pasta Principal) ➔ SUBPASTA ➔ NOTA.
- Sempre que criar notas com 'note_save', defina o parâmetro 'folder' com a estrutura "Caderno/Subpasta" (ex: "Carreira/Vaga Nestle", "Estudos/Arquitetura de Software", "Caderno de Anotações/Manuscritos").`;

    // Strict Deleted Notes & Live Vault State Guidelines with Real Vault Inspection
    const activeNotes = FrankNoteEngine.listNotes(projectPath);
    const activeNotesSummary = activeNotes.length > 0 
      ? activeNotes.map(n => `- "${n.title}" (Pasta: ${n.folder || 'Geral'})`).join('\n')
      : '(Nenhuma nota ativa no Vault no momento)';

    const deletedNotesPolicy = `[🛡️ VERIFICAÇÃO MANDATÓRIA DE NOTAS ATIVAS NO COFRE DO OBSIDIAN/TELLUS]
- LISTA REAL E ATUALIZADA DE NOTAS ATIVAS NO VAULT NESTE MOMENTO:
${activeNotesSummary}

REGRAS INEGOCIÁVEIS DE NÃO-PRESUMÇÃO DE ESTUDOS E PLANOS:
1. SE NÃO HÁ NOTAS ATIVAS NO VAULT PARA O TEMA SOLICITADO:
   - Se o usuário pedir para aprender ou estudar um assunto (ex: "quero aprender arquitetura de software", "quero estudar X", "preparação para vaga Y"):
     NUNCA presuma que já existe um plano pronto, roteiro em andamento ou módulo concluído/iniciado!
     MESMO QUE mensagens antigas do histórico ou o bloco de active_context mencionem anotações ou módulos anteriores, se essas notas NÃO constam na lista de NOTAS ATIVAS acima, significa que o usuário EXCLUIU o material e quer RECOMEÇAR ou CRIAR UM PLANO NOVO!
   - É TOTALMENTE PROIBIDO dizer frases como: "Ótimo! Já começamos pelo Módulo 01...", "Como já temos o plano feito...", "Continuando de onde paramos...".
   - Você DEVE tratar o tema como um NOVO ESTUDO / NOVO PLANO, propor a trilha e CRIAR NOTAS ATIVAS NOVAS chamando a ferramenta 'note_save' (ou 'frank_note_save').
2. NOTAS EXCLUÍDAS (.backups) NÃO SÃO ATIVAS:
   - Arquivos na lixeira (.backups) são considerados INEXISTENTES para o fluxo de estudo atual. Nunca espere respostas de microtarefas de notas que já foram excluídas.
   - Só consulte ou mencione arquivos excluídos se o usuário perguntar expressamente: "o que foi para a lixeira?", "posso restaurar o que apaguei?". Caso contrário, crie notas novas ativas no Vault.
3. DISPARO IMEDIATO DO MOTOR DE ENSINO ("QUERO APRENDER..." + "DO ZERO" / INICIANTE):
   - Se o usuário pediu para aprender ou estudar um assunto ("quero aprender [X]", "vamos estudar Y", "quero me preparar para vaga Z", "concurso para W") E na sequência disser "do zero", "comece do zero", "quero do zero", "iniciante", "pode começar", "vamos lá", "sim", "bora":
     VOCÊ DEVE ATIVAR IMEDIATAMENTE O PROTOCOLO DO MOTOR UNIVERSAL DE ESTUDO ESQUEMATIZADO ('tellus-study-engine') NESTA MESMA RESPOSTA!
   - É PROIBIDO continuar enrolando no chat com novas perguntas ou textos soltos sem criar as notas!
   - EXECUÇÃO MANDATÓRIA NESTE TURNO (ROADMAMP COMPLETO + SEM FATIAMENTO + ANTI-INFODUMP):
     a) Crie imediatamente a subpasta 'Estudos/[Assunto]' (ou 'Carreira/Vaga - [Cargo]') chamando a ferramenta 'note_save' (ou 'frank_note_save') com a ESTRUTURA COMPLETA:
        - '00_Roadmap_e_Ementa_Geral': Raio-X geral, checklist de todos os módulos (- [ ] [[Modulo_01_...]]) e referências oficiais/bancas de questões.
        - 'Modulo_01_[Tema]', 'Modulo_02_[Tema]' ... 'Modulo_N_[Tema]': Todos os módulos com conteúdo em ALTA DENSIDADE ESQUEMATIZADA (mapas conceituais, tabelas comparativas, regras essenciais, mnemônicos e avisos de pegadinha da banca/pontos de quebra — ZERO prosa prolixa acadêmica!).
        - 'Caderno_de_Questoes_e_Atividades': Questões e atividades práticas 100% ACOPLADAS tópico a tópico (situações hipotéticas de concurso ou cenários reais de engenharia com gabarito justificado ao final).
        * NUNCA faça conteúdo picado ou retenha módulos futuros! Entregue o material completo para livre navegação.
     b) No chat: Apresente em 2 parágrafos a visão panorâmica do Roadmap, confirme as notas completas criadas no Vault com wikilinks, dê uma síntese esquematizada do Módulo 01 e destaque as primeiras questões para aquecimento.
     c) Dê autonomia ao aluno para resolver no chat, pedir aprofundamento ou avançar pelas notas no Vault no seu próprio ritmo!`;

    const voiceGuideline = `[🎙️ DIRETRIZ DE RETORNO EM VOZ & SÍNTESE CONCISA [FALA]]
- Quando houver interação por voz ou modo Live Voice / Retorno por voz ativo:
- Inclua SEMPRE no início da sua resposta um bloco [FALA]...[/FALA] curto (máximo de 2 a 3 frases, cerca de 30 a 45 palavras):
  1. Explique em alto nível o que foi criado/feito (SEM citar nomes de módulos, nomes de arquivos ou wikilinks [[...]]).
  2. Destaque a importância prática ou regra de ouro do conceito (o que fazer ou evitar).
  3. Indique o próximo passo prático.
  4. Inicie com uma tag de emoção em colchetes correspondente ao tom (ex: [calm], [thoughtful], [happy], [whispering]).
- NUNCA leia listas de arquivos ou notas dentro de [FALA]. Todo o detalhamento escrito, código e links permanecem no chat e nas notas.`;

    const enrichedSystemPrompt = `${languageAnchor}\n\n${handwrittenOcrPolicy}\n\n${notebooksPolicy}\n\n${deletedNotesPolicy}\n\n${voiceGuideline}\n\n${systemPrompt}\n\n${memoryContext}${skillsContext ? `\n\n${skillsContext}` : ''}`;

    // Process Multimodal Images from .agentic/attachments/
    const processedMessages: ChatMessage[] = messages.map(m => {
      if (m.role === 'user' && typeof m.content === 'string') {
        const imageMatch = m.content.match(/\.agentic[\\\/]attachments[\\\/]([a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp|gif))/i);
        if (imageMatch) {
          const imgFilename = imageMatch[1];
          const imgPath = path.join(projectPath, '.agentic', 'attachments', imgFilename);
          if (fs.existsSync(imgPath)) {
            try {
              const buf = fs.readFileSync(imgPath);
              const ext = path.extname(imgPath).toLowerCase().replace('.', '');
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
              const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
              
              return {
                ...m,
                content: [
                  { type: 'text', text: m.content },
                  { type: 'image_url', image_url: { url: dataUrl } }
                ]
              };
            } catch {
              // fallback to original text content
            }
          }
        }
      }
      return m;
    });

    const currentHistory: ChatMessage[] = [
      { role: 'system', content: enrichedSystemPrompt },
      ...processedMessages
    ];

    let stepCount = 0;

    while (stepCount < maxToolSteps) {
      stepCount++;
      let assistantContent = '';
      let assistantReasoning = '';
      let toolCalls: any[] = [];

      try {
        const streamResult = await ProviderHub.streamChat(
          provider,
          model,
          currentHistory,
          AGENT_TOOLS,
          {
            onContentChunk: (chunk) => {
              const processedChunk = isTargetPortuguese ? sanitizePortugueseText(chunk) : chunk;
              assistantContent += processedChunk;
              onEvent({ type: 'content', data: processedChunk });
            },
            onReasoningChunk: (chunk) => {
              const processedChunk = isTargetPortuguese ? sanitizePortugueseText(chunk) : chunk;
              assistantReasoning += processedChunk;
              onEvent({ type: 'reasoning', data: processedChunk });
            },
            onToolCalls: (tcs) => {
              toolCalls = tcs;
            }
          },
          abortSignal
        );

        if (streamResult.toolCalls && streamResult.toolCalls.length > 0) {
          toolCalls = streamResult.toolCalls;
        }

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined
        };

        currentHistory.push(assistantMsg);

        if (!toolCalls || toolCalls.length === 0) {
          // Se ferramentas foram executadas durante este turno mas o modelo não enviou mensagem final em texto:
          if (stepCount > 1 && (!assistantContent || !assistantContent.trim())) {
            const toolResults = currentHistory.filter(m => m.role === 'tool');
            if (toolResults.length > 0) {
              const summaryMsg = "✅ Todas as notas, diretórios e estruturas solicitadas foram criados e organizados com sucesso no seu Vault.";
              assistantContent = summaryMsg;
              assistantMsg.content = summaryMsg;
              onEvent({ type: 'content', data: summaryMsg });
            }
          }
          // No tools called, agent has finished its turn
          onEvent({ type: 'turn_complete', data: { totalSteps: stepCount } });
          break;
        }

        // Execute all tool calls sequentially
        for (const tc of toolCalls) {
          const fnName = tc.function.name;
          const fnArgs = tc.function.arguments;

          onEvent({
            type: 'tool_start',
            data: { toolCallId: tc.id, name: fnName, arguments: fnArgs }
          });

          const result = await this.executeTool(projectPath, fnName, fnArgs, model);

          onEvent({
            type: 'tool_end',
            data: { toolCallId: tc.id, name: fnName, result }
          });

          currentHistory.push({
            role: 'tool',
            name: fnName,
            tool_call_id: tc.id,
            content: JSON.stringify(result)
          });
        }
      } catch (err: any) {
        onEvent({ type: 'error', data: err.message || 'Erro inesperado no loop do agente' });
        throw err;
      }
    }

    return { fullMessages: currentHistory };
  }
}
