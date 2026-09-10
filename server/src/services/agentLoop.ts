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
      name: 'frank_note_save',
      description: 'Cria ou atualiza uma nota segura no sistema FrankMD / Obsidian Vault dentro de um Caderno e Subpasta especificados com wikilinks [[Nota]] e tags #tag.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título claro da nota' },
          folder: { type: 'string', description: 'Caminho do Caderno e Subpasta no cofre (ex: "Carreira/Nestle", "Estudos/SPREGULA", "Caderno de Anotações/Manuscritos")' },
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
        case 'frank_note_save': {
          const folder = args.folder || args.subject || 'Geral';
          const note = FrankNoteEngine.saveNote({
            title: args.title,
            folder,
            subject: args.subject || folder,
            content: args.content,
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
    
    // 1. Dynamic User Language Detection:
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    let userText = '';
    if (typeof lastUserMsg?.content === 'string') {
      userText = lastUserMsg.content;
    } else if (Array.isArray(lastUserMsg?.content)) {
      userText = lastUserMsg.content.map(p => p.text || '').join(' ');
    }

    const isEnglish = /\b(the|and|is|are|please|write|create|solve|how|what|why|code)\b/i.test(userText) && !/\b(você|para|como|quero|estudar|anote|vaga|não|com|de|em)\b/i.test(userText);
    const isSpanishExplicit = /\b(quiero|estudiar|anota|esto|por favor|prueba|preguntas)\b/i.test(userText) && !/\b(você|para|como|quero|anote|vaga|não|com|de|em|estudos)\b/i.test(userText);
    
    let targetLanguage = 'PORTUGUÊS DO BRASIL (pt-BR)';
    if (isEnglish) targetLanguage = 'INGLÊS (English)';
    else if (isSpanishExplicit) targetLanguage = 'ESPANHOL (Español)';

    // Dynamic Language Enforcement Anchor:
    const languageAnchor = `[🌐 DIRETRIZ MANDATÓRIA DE IDIOMA - RECONHECIMENTO DINÂMICO]
- IDIOMA DE ENTRADA DO USUÁRIO IDENTIFICADO: **${targetLanguage}**.
- Você DEVE OBRIGATORIAMENTE responder, dialogar, explicar e redigir TODAS as anotações, planos de estudo, cadernos e notas do FrankMD estritamente no idioma de entrada: **${targetLanguage}**.
- SE O USUÁRIO ESCREVEU EM PORTUGUÊS, É ESTRITAMENTE PROIBIDO RESPONDER OU GERAR ARQUIVOS EM ESPANHOL OU PORTUNHOL!
- Ignore e rejeite qualquer contaminação linguística de mensagens antigas do histórico que tenham sido redigidas em outro idioma.
- NUNCA use termos em espanhol como "preguntas", "análisis", "derecho", "orzamento", "desconhecimento" se o idioma for português; use sempre os termos corretos da língua portuguesa ("questões", "análise", "direito", "orçamento", etc.).`;

    // Handwritten Notebook OCR & Visual Note-Taking Policy
    const handwrittenOcrPolicy = `[📸 RECONHECIMENTO DE FOTOS DE CADERNO E ANOTAÇÕES MANUSCRITAS ("Anote Isso")]
- Quando o usuário anexar uma foto de caderno, anotação manuscrita, lousa ou papel e pedir para "anotar", "anote isso", "digitalizar", "transcrever" ou "salvar nas notas":
  1. Realize OCR visual minucioso da caligrafia, transcrevendo com precisão o texto manuscrito para Markdown estruturado e limpo.
  2. Preserve fórmulas matemáticas em LaTeX ($...$ ou $$...$$), diagramas (em Mermaid ou blocos de código), tabelas, títulos e listas com marcadores.
  3. Salve AUTOMATICAMENTE a anotação transcrita chamando a ferramenta 'frank_note_save', escolhendo um título expressivo e direcionando para o Caderno apropriado (ex: folder: "Caderno de Anotações/Manuscritos" ou "Estudos/Anotações à Mão").
  4. Responda no chat em português confirmando a digitalização com um resumo objetivo e o link clicável da nota criada.`;

    // Notebooks & Subfolders System Guidelines
    const notebooksPolicy = `[📓 SISTEMA DE CADERNOS (NOTEBOOKS) E SUBPASTAS DO FRANKMD VAULT]
- O cofre é organizado na hierarquia: CADERNO (Pasta Principal) ➔ SUBPASTA ➔ NOTA.
- Sempre que criar notas com 'frank_note_save', defina o parâmetro 'folder' com a estrutura "Caderno/Subpasta" (ex: "Carreira/Vaga Nestle", "Estudos/SPREGULA", "Caderno de Anotações/Manuscritos").`;

    // Strict Deleted Notes & Live Vault State Guidelines
    const deletedNotesPolicy = `[🗑️ DIRETRIZ MANDATÓRIA DE NOTAS EXCLUÍDAS E ESTADO ATIVO DO VAULT]
- Verificação de Existência Real: NUNCA presuma que arquivos, roteiros, cadernos de estudo ou pacotes de candidatura (ex: aplicacao-nestle/, cadernos de concurso, etc.) já estão prontos apenas porque constam em mensagens antigas do chat.
- Notas Excluídas são INATIVAS / NÃO CONCLUÍDAS: Se o usuário reenviar um pedido de estudo ou candidatura para uma vaga/conteúdo cujo diretório ou notas foram excluídos, desconsidere o material antigo e crie um NOVO roteiro, plano de estudos, atividades e módulos do zero no Vault ativo.
- Consulta sobre Notas Excluídas: Se o usuário perguntar especificamente sobre uma nota, roteiro ou assunto que foi excluído, consulte o histórico de exclusões e informe claramente quando foi excluída, o contexto do arquivo e por que pode ser útil mantê-la ou restaurá-la.`;

    const enrichedSystemPrompt = `${languageAnchor}\n\n${handwrittenOcrPolicy}\n\n${notebooksPolicy}\n\n${deletedNotesPolicy}\n\n${systemPrompt}\n\n${memoryContext}${skillsContext ? `\n\n${skillsContext}` : ''}`;

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
              assistantContent += chunk;
              onEvent({ type: 'content', data: chunk });
            },
            onReasoningChunk: (chunk) => {
              assistantReasoning += chunk;
              onEvent({ type: 'reasoning', data: chunk });
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
