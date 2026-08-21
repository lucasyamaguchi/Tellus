# 🧠 Agentic IDE — Documentação Completa do Projeto

> **Versão Atual**: 1.0 — Desktop App Local para Windows  
> **Stack**: Electron · Node.js + Express · React 19 + Vite · TypeScript  
> **Gerado em**: Agosto 2026

---

## 📖 O Que É Este Projeto

O **Agentic IDE** é um ambiente de desenvolvimento pessoal local, projetado para ser um hub de IA que permite:

- Conversar com **qualquer modelo de IA** disponível no mercado (OpenRouter, Google Gemini, Anthropic Claude, OpenAI GPT) usando apenas suas chaves de API.
- Monitorar em tempo real seu **saldo e consumo de créditos na OpenRouter** diretamente na barra superior.
- **FrankMD Safe Note Taker & Knowledge Graph**: Sistema de anotações com Data Safety (auto-backup, proteção contra deleção acidental), wikilinks `[[Link]]`, tags `#tag` e **Grafo de Conhecimento Visual Interativo (estilo Obsidian)** para conectar ideias entre todos os projetos.
- **Skills dos Agentes & Galeria de Artefatos**: Pastas dedicadas para catalogar e criar novas skills por agente (`Architect`, `Debugger`, `Fast Coder`, etc.) e gerenciar entregas estruturadas do projeto (`.agentic/artifacts/`).
- Executar um **agente autônomo** capaz de ler, criar e modificar arquivos do seu computador, rodar comandos no terminal, capturar sua tela, fazer scraping de páginas web e manter memória contínua entre conversas.
- Tudo isso com uma interface visual elegante, sem precisar abrir nenhum terminal manualmente.

**Filosofia central**: Nenhum dado sai da sua máquina exceto as mensagens enviadas diretamente para as APIs dos provedores usando *suas* chaves. Não há servidor intermediário, sem banco de dados externo, sem proxy. É 100% local.

---

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON SHELL                           │
│  ┌────────────────────────────┐  ┌────────────────────────────┐ │
│  │   Frontend React 19        │  │  Backend Express (Node.js) │ │
│  │   client/                  │◄─┤  server/                   │ │
│  │   Port: 3001 (via Express) │  │  Port: 3001                │ │
│  └────────────────────────────┘  └──────────────┬─────────────┘ │
└─────────────────────────────────────────────────┼───────────────┘
                                                   │ HTTPS (fetch)
                              ┌────────────────────┤
                              │                    │
                    ┌─────────▼────────┐  ┌────────▼────────────┐
                    │   OpenRouter API │  │  Google / Anthropic  │
                    │   (+ 300 modelos)│  │  OpenAI APIs         │
                    └──────────────────┘  └─────────────────────┘
```

### Como as Camadas se Conectam

1. **Electron** inicia o servidor Node.js em background (silenciosamente, sem janela de terminal) e abre o frontend React em uma janela nativa.
2. O **frontend React** (rodando na porta 3001 servida pelo próprio Express) se comunica com o backend via `fetch()` e SSE (Server-Sent Events) para streaming.
3. O **backend Express** recebe as mensagens, seleciona o provedor certo, faz as chamadas para a API externa e executa as ferramentas locais (arquivos, terminal, tela).
4. As **respostas da IA** chegam em streaming de volta via SSE, aparecendo na interface em tempo real.

---

## 📁 Estrutura de Arquivos

```
AgenticIDE/
├── electron/
│   └── main.js                  # Ponto de entrada Electron (janela, overlay, server)
├── server/
│   └── src/
│       ├── index.ts             # Servidor Express principal — todas as rotas REST e SSE
│       └── services/
│           ├── agentLoop.ts     # Loop autônomo do agente (tool calling, reasoning)
│           ├── configManager.ts # Chaves de API e rotinas em ~/.agentic-ide/config.json
│           ├── projectManager.ts# Abre e rastreia pastas de projetos
│           ├── sessionManager.ts# Salva e recupera histórico (.agentic/sessions/)
│           ├── memory/
│           │   └── memoryEngine.ts  # Motor de memória contínua (ai-memory pattern)
│           ├── providers/
│           │   ├── openrouter.ts    # Cliente da API OpenRouter
│           │   ├── gemini.ts        # Cliente da API Google Gemini
│           │   ├── anthropic.ts     # Cliente da API Anthropic Claude
│           │   ├── openai.ts        # Cliente da API OpenAI
│           │   └── providerHub.ts   # Despachante central — seleciona o provedor correto
│           └── tools/
│               ├── fileTools.ts     # read_file, write_file, edit_file, list_dir
│               ├── terminalRunner.ts# Executa comandos no shell local, captura logs
│               ├── fileParser.ts    # PDF→texto, CSV→amostra, PNG→base64, MP3→player
│               ├── screenCapture.ts # Captura tela inteira ou janela específica
│               └── webScraper.ts    # Scraping de páginas web → Markdown/HTML
├── client/
│   └── src/
│       ├── App.tsx              # Raiz — gerencia estado global, splitters, modais
│       ├── api.ts               # Funções de cliente HTTP para o backend Express
│       ├── types.ts             # Interfaces TypeScript compartilhadas
│       └── components/
│           ├── Navbar.tsx           # Barra superior (modelo, CLI launcher, Overlay)
│           ├── Sidebar.tsx          # Painel lateral (chats, arquivos, memória, rotinas)
│           ├── ChatArea.tsx         # Chat com streaming, ferramentas, anexos
│           ├── CodeViewer.tsx       # Editor Monaco integrado
│           ├── MemoryInspector.tsx  # Visualizador/editor do Active Context e wiki
│           ├── TerminalView.tsx     # Terminal integrado com lançadores de CLI
│           ├── FloatingOverlay.tsx  # Widget flutuante always-on-top
│           ├── ModelSelectorModal.tsx  # Catálogo de modelos com filtros
│           ├── SettingsModal.tsx    # Configuração de chaves de API
│           ├── ProjectModal.tsx     # Abrir/trocar de projeto
│           ├── MentionModal.tsx     # Citação de mensagens de outros chats (@)
│           └── WindowPickerModal.tsx # Seletor de janela do Windows para captura
├── resources/
│   └── icon.ico / icon.png      # Ícone customizado do executável
├── scripts/
│   ├── generate-icons.js        # Gera ícones a partir da imagem original
│   └── create-shortcut.ps1      # Cria o atalho .lnk com ícone no Explorer
├── AgenticIDE.vbs               # Launcher VBScript (sem janela de CMD)
├── start.bat                    # Launcher alternativo via .bat
└── Agentic IDE.lnk              # Atalho do Windows com ícone customizado
```

---

## 🔄 Fluxo de uma Mensagem (do clique ao código)

Quando você digita uma mensagem e clica em Enviar:

```
[1] Você digita no ChatArea.tsx
        │
        ▼
[2] api.ts → fetch POST /api/chat/stream (SSE)
        │
        ▼
[3] server/index.ts recebe a requisição
        ├─ Injeta o Active Context da memória do projeto
        └─ Identifica o provedor e modelo ativos
        │
        ▼
[4] agentLoop.ts inicia o loop de raciocínio
        │
        ▼
[5] providerHub.ts → chama a API externa com streaming
        │
        ├─ chunk de texto → SSE "content" → ChatArea exibe em tempo real
        ├─ chunk de raciocínio → SSE "reasoning" → bloco expansível 🧠
        └─ tool_call da IA → SSE "tool_start"
                │
                ▼
          [6] agentLoop.executeTool()
                ├─ read_file    → fileTools.readFile()
                ├─ write_file   → fileTools.writeFile()
                ├─ run_command  → terminalRunner.run()
                ├─ screenshot   → screenCapture.captureScreen()
                ├─ web_scrape   → webScraper.scrapeUrl()
                └─ memory_*     → memoryEngine.*()
                │
                └─ resultado volta para a IA → loop continua
```

---

## 🧠 Sistema de Memória Contínua (ai-memory Engine)

Inspirado no padrão [akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory), o sistema garante que nenhum contexto seja perdido entre sessões, mesmo trocando de modelo.

### Estrutura de Diretórios (por projeto)

```
seu-projeto/
└── .agentic/
    ├── memory/
    │   ├── active_context.md   ← O "estado atual do projeto" (atualizado pelo agente)
    │   ├── decisions/          ← Decisões arquiteturais registradas
    │   ├── procedures/         ← Procedimentos recorrentes
    │   ├── gotchas/            ← Armadilhas e erros conhecidos
    │   └── handoffs/           ← Snapshots ao trocar de modelo/sessão
    ├── sessions/               ← Histórico JSON de cada conversa
    └── attachments/            ← Arquivos importados (PDF, PNG, MP3, screenshots)
```

### Por Que Funciona

Antes de cada mensagem enviada para a IA, o backend **automaticamente injeta**:
1. O conteúdo completo do `active_context.md` (estado atual do projeto)
2. O último `handoff` (onde parou o agente anterior)
3. As 5 decisões mais recentes de `decisions/`
4. Os 5 gotchas mais críticos de `gotchas/`

Isso significa que mesmo se você mudar de Claude para Gemini, ou fechar o app e reabrir dias depois, o novo modelo já sabe exatamente o que está acontecendo no projeto.

---

## 🔌 Provedores de IA Suportados

| Provedor | Chave Necessária | Modelos Notáveis |
|---|---|---|
| **OpenRouter** | `OPENROUTER_API_KEY` | DeepSeek R1, Claude 3.7, Gemini 2.0 Flash, Llama 3.3, Qwen 2.5, +300 modelos |
| **Google Gemini** | `GOOGLE_API_KEY` | Gemini 2.0 Pro, Gemini 2.0 Flash, Gemini 1.5 Pro |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude 3.7 Sonnet, Claude 3.5 Haiku, Claude 3 Opus |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4o, GPT-4o mini, o3-mini |

### Onde as Chaves São Armazenadas

```
C:\Users\[seu_usuario]\.agentic-ide\config.json
```

As chaves **nunca saem da sua máquina** — ficam em um arquivo JSON local dentro do seu perfil de usuário do Windows. O backend as lê diretamente do disco quando precisa fazer uma chamada de API. Não há nenhum servidor intermediário.

---

## 🛠️ Ferramentas do Agente (Tool Calling)

| Ferramenta | O Que Faz |
|---|---|
| `read_file` | Lê o conteúdo de qualquer arquivo do projeto |
| `write_file` | Cria ou sobrescreve um arquivo completamente |
| `edit_file` | Edita trechos específicos de um arquivo |
| `list_directory` | Lista o conteúdo de uma pasta do projeto |
| `run_command` | Executa comandos de shell no diretório do projeto |
| `screenshot_screen` | Captura a tela inteira ou janela específica |
| `web_scrape` | Raspa o conteúdo de uma URL → Markdown/HTML |
| `memory_update_context` | Atualiza o `active_context.md` |
| `memory_write_page` | Cria nova página de decisão, procedimento ou gotcha |
| `memory_query` | Busca na base de memória por relevância |
| `memory_create_handoff` | Gera um snapshot de transição para o próximo agente |

---

## 🔒 Por Que É Seguro

### 1. Execução 100% Local
O aplicativo roda inteiramente no seu computador. Não há nenhum servidor remoto nosso envolvido. Toda a lógica, armazenamento de memória, histórico de chats e arquivos do projeto ficam no seu disco.

### 2. Suas Chaves, Seu Controle
As chaves de API ficam em `~/.agentic-ide/config.json` — um arquivo de texto simples no seu perfil de usuário. Você pode abrir, editar ou deletar manualmente a qualquer momento. São enviadas apenas diretamente para as APIs dos provedores (OpenRouter, Google, Anthropic, OpenAI) que você já confia.

### 3. Acesso a Arquivos Restrito ao Projeto Ativo
As ferramentas `read_file`, `write_file` e `list_directory` são implementadas com sanitização que impede travessia de diretórios (`../`). O agente só pode tocar em arquivos dentro da pasta raiz do projeto atualmente aberto.

### 4. Comandos de Terminal sob Sua Supervisão
Os comandos via `run_command` são executados no diretório do projeto e os logs aparecem em tempo real no Terminal Integrado. Você vê tudo o que está acontecendo.

### 5. Sem Telemetria ou Rastreamento
Não há chamadas analíticas, sem logging de uso, sem identificadores de usuário. O app é completamente silencioso em termos de rede exceto pelas chamadas explícitas às APIs que você configurou.

---

## 🎨 Funcionalidades da Interface

### Barra Superior (Navbar)
- **Seletor de Projeto**: Abre ou troca de pasta de projeto
- **Seletor de Modelo**: Catálogo completo de modelos com preços e contexto
- **Rotina Ativa**: Exibe qual especialista está ativo (Architect, Debugger, Fast Coder, etc.)
- **Modo Sobreposto** ✨: Ativa o widget flutuante always-on-top sobre qualquer janela
- **Abrir CLI**: Lança Claude Code, Gemini CLI, Antigravity CLI ou PowerShell no projeto
- **Configurar Chaves**: Gerencia as chaves de API de todos os provedores

### Barra Lateral (Sidebar) — Painéis Redimensionáveis
- **Aba Conversas**: Lista todas as sessões de chat salvas com pré-visualização
- **Aba Arquivos**: Explorador de arquivos do projeto com acesso ao editor Monaco
- **Aba Memória**: Visualiza e edita as páginas da wiki de memória
- **Aba Rotinas**: Lista os especialistas configurados com troca rápida

### Área de Chat (ChatArea)
- **Streaming em Tempo Real**: Tokens chegam progressivamente
- **Blocos de Raciocínio** 🧠: Para modelos como DeepSeek R1 e Claude 3.7, o raciocínio interno aparece em um bloco expansível separado
- **Cartões de Ferramenta**: Cada chamada de ferramenta aparece com nome, argumentos e resultado
- **Citação entre Chats** (@): Cite qualquer mensagem de uma conversa anterior no prompt atual
- **Importação Multimodal**: PDF (extração de texto), CSV, imagens (visão), MP3 (player)
- **Captura de Tela / Escolher Janela**: Screenshot da tela inteira ou de uma janela específica

### Painel Direito (Splitável e Redimensionável)
- **Aba Código**: Editor Monaco integrado para ver e editar arquivos
- **Aba Memória**: Inspector do Active Context com gerador de Handoff
- **Aba Terminal**: Terminal integrado com execução de comandos e lançadores de CLI

### Modo Sobreposto Flutuante (FloatingOverlay)
- Widget sempre no topo que permanece visível sobre o VS Code, Chrome, Figma, etc.
- Permite capturar a tela ou escolher uma janela e enviar um comando rápido sem trocar de janela
- A IA inspeciona visualmente e aplica correções diretamente no código do projeto

---

## 🚀 Como Executar

### Modo Desktop (Electron) — Recomendado
```
Duplo clique em: Agentic IDE.lnk
```
Ou via script:
```
AgenticIDE.vbs  →  Inicia silenciosamente (sem janela de CMD)
start.bat       →  Alternativa via terminal
```

### Modo Web (Desenvolvimento)
```bash
npm run dev
```
Abre em `http://localhost:5173` com hot-reload. O backend sobe automaticamente em paralelo.

### Build de Produção
```bash
npm run build
```
Gera os assets em `client/dist/` (servidos pelo Express) e o servidor compilado em `server/dist/`.

---

## 💡 Alternativas para Melhorar o Projeto

Organizadas por nível de esforço e impacto esperado:

---

### 🟢 Baixo Esforço — Alto Impacto Imediato

**1. Transcrição Automática de Áudio (Whisper)**  
Quando um arquivo MP3 é importado, enviar automaticamente para o Whisper (OpenAI ou local) e exibir a transcrição como contexto para a conversa. Ideal para importar reuniões gravadas e pedir resumos de decisões.

**2. Diff Visual Interativo (Aprovar Antes de Gravar)**  
Antes de o agente aplicar um `write_file`, exibir um diff `antes/depois` lado a lado no painel direito. O usuário aprova ou rejeita cada mudança antes de ela ser salva em disco. Aumenta dramaticamente o controle e a confiança.

**3. Atalho Global de Teclado para o Overlay**  
Registrar um atalho global via Electron `globalShortcut` (ex: `Ctrl+Shift+A`) para ativar/desativar o widget flutuante sem precisar clicar na janela do Agentic IDE.

**4. Histórico de Comandos no Terminal Integrado**  
Tecla ↑ e ↓ para navegar no histórico de comandos executados, igual ao comportamento do terminal nativo.

**5. Busca Semântica na Wiki de Memória**  
A busca atual é léxica (palavras-chave). Usar embeddings locais (ex: `@xenova/transformers` com `all-MiniLM-L6-v2`) para busca por similaridade semântica, encontrando contextos relevantes mesmo quando as palavras exatas não coincidem.

---

### 🟡 Médio Esforço — Alto Impacto Estratégico

**6. Modo Multi-Agente (Painéis Paralelos)**  
Abrir múltiplos painéis de chat onde cada um tem um modelo/rotina diferente. Ex: o Architect (Claude) planeja na esquerda enquanto o Fast Coder (Gemini Flash) implementa na direita, ambos compartilhando a mesma memória `.agentic/`.

**7. Integração Nativa com Git**  
Painel de diff git dentro do app. O agente pode criar branches, fazer commits com mensagens descritivas e abrir PRs diretamente pelo chat. Ex: *"Commita tudo que você fez hoje"*.

**8. Captura de Tela Contínua (Auto-Pilot Mode)**  
Modo onde o agente captura a tela periodicamente (ex: a cada 10 segundos) e monitora por erros, agindo automaticamente ao detectar algo crítico. Útil durante builds ou deploys em andamento.

**9. Suporte a MCP (Model Context Protocol)**  
Integrar o [protocolo MCP da Anthropic](https://modelcontextprotocol.io) como servidor local. Outros apps compatíveis (como Claude Desktop ou Cursor) poderiam se conectar ao Agentic IDE e usar suas ferramentas de arquivo e memória.

**10. Detecção Automática de Stack do Projeto**  
Ao abrir um projeto, detectar a stack automaticamente (`package.json` → Node.js, `requirements.txt` → Python, `Cargo.toml` → Rust) e carregar rotinas e prompts de sistema otimizados para aquela tecnologia.

---

### 🔴 Alto Esforço — Impacto Transformador

**11. Execução em Sandbox (Docker ou Windows Sandbox)**  
Executar os comandos de terminal do agente dentro de um container Docker isolado. Zero risco de o agente modificar arquivos fora do projeto ou executar algo destrutivo no sistema.

**12. Entrada por Voz (Speech-to-Text Local)**  
Usar `whisper.cpp` via WebAssembly ou binário nativo para transcrever voz em texto diretamente na caixa de mensagem. Permite ditar instruções para o agente sem digitar.

**13. Gravação e Replay de Sessões**  
Gravar cada sessão com todos os tool calls, resultados e respostas como um replay reproduzível. Permite "voltar no tempo" e ver exatamente o que o agente fez e por quê, etapa por etapa.

**14. Sistema de Plugins de Ferramentas**  
Permitir que o usuário crie novas ferramentas em JavaScript que o agente usa automaticamente. Ex: `query_database`, `send_slack_message`, `deploy_to_vercel`. Transforma o Agentic IDE em uma plataforma extensível.

**15. Modo Colaborativo em Rede Local**  
Sincronizar o `active_context.md` e as sessões via um servidor local na rede (usando WebSockets). Uma equipe pequena poderia compartilhar o mesmo agente e contexto de projeto em tempo real, sem nenhum serviço na nuvem.

---

## 📊 Dependências Principais

| Pacote | Propósito |
|---|---|
| `electron` | Shell desktop nativo |
| `express` | Servidor HTTP/SSE backend |
| `react` + `vite` | Interface frontend moderna |
| `typescript` | Tipagem estática em toda a stack |
| `axios` | Requisições HTTP no backend (web scraping, APIs) |
| `pdf-parse` | Extração de texto de arquivos PDF |
| `sharp` | Processamento de imagens para geração de ícones |
| `@monaco-editor/react` | Editor de código integrado |
| `react-markdown` + `remark-gfm` | Renderização de Markdown nas mensagens |
| `lucide-react` | Ícones consistentes na interface |

---

## 🗂️ Dados e Privacidade

| O Que | Onde Fica | Sai da Máquina? |
|---|---|---|
| Chaves de API | `~/.agentic-ide/config.json` | Nunca — apenas nas chamadas diretas aos provedores |
| Histórico de Chats | `projeto/.agentic/sessions/` | Não |
| Memória do Projeto | `projeto/.agentic/memory/` | Não (exceto ao injetar no contexto da IA) |
| Arquivos Importados | `projeto/.agentic/attachments/` | Não (exceto ao enviar para a IA como contexto) |
| Screenshots | `projeto/.agentic/attachments/` | Não (exceto ao enviar para a IA) |
| Código do Projeto | No seu disco | Não (exceto quando o agente lê via `read_file`) |

---

*Documentação gerada internamente pelo Agentic IDE — Agosto 2026.*
