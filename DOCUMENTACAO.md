# 🌐 Tellus v1.0.0 — Documentação Oficial & Manual de Arquitetura

> **Versão Oficial**: 1.0.0 — Ambiente Integrado de Desenvolvimento Agêntico & Gestão de Conhecimento  
> **Stack Tecnológica**: Electron · Node.js + Express · React 19 + Vite · Monaco Editor · TailwindCSS v4 · TypeScript  
> **Arquitetura de Dados**: 100% Local-First · Obsidian Compatible (`TellusMD Vault`) · E2EE AES-256-GCM  

---

## 📖 1. Visão Geral e Filosofia

O **Tellus** é uma central agêntica unificada desenvolvida para programadores, pesquisadores e estudantes de alta performance. Ele combina:

1. **Desenvolvimento Agêntico Local**: Orquestração multi-modelo de inteligência artificial com chamadas autônomas de ferramentas de terminal, sistema de arquivos, scraping e captura de tela.
2. **Tellus Code Studio**: Editor de código robusto baseado no Monaco (núcleo do VS Code) com suporte a abas simultâneas, atalhos nativos, formatação automática com **Prettier** (`Shift + Alt + F`), ícones estilizados **Material Icons** por extensão de arquivo e menu de contexto inteligente com ações de IA acionáveis por clique direito em qualquer arquivo ou pasta.
3. **TellusMD Vault & Canvas Caligráfico**: Cofre de anotações 100% compatível com a sintaxe do **Obsidian** (`[[Wikilinks]]`, `#tags`, metadados Frontmatter), com editor de texto, visualização em grafo de conceitos interativo e **NoteInkCanvas** para caligrafia digital vetorial (Perfect Freehand) e desenho livre.
4. **Smart Dropzone Multimodal**: Console de despejo unificado para mensagens brutas (ex: WhatsApp, transcrições de vídeos e anexos em PDF/imagens) com decomposição automática pelo **AI Archivist** e relatórios auditáveis de organização.
5. **Multi-PC Cloud Sync Seguro com 2FA**: Sincronização opcional com Google Drive ou OneDrive blindada por criptografia ponta a ponta (**AES-256-GCM**), garantindo que os servidores em nuvem jamais visualizem anotações ou códigos em texto puro.

### 🔒 Princípio de Privacidade Absoluta (Local-First BYOK)
- **Zero Intermediários:** As requisições de IA saem diretamente da sua máquina para as APIs oficiais dos provedores usando suas próprias credenciais (*Bring Your Own Key - BYOK*).
- **Zero Telemetria Oculta:** Nenhum arquivo do seu computador ou anotação é enviado para servidores proprietários.
- **Isolamento de Dados Sensíveis:** Arquivos pessoais de conversas (`Chats/`), credenciais (`.env`), tokens e diretórios de cofres privados são estritamente excluídos do versionamento e mantidos em pastas locais seguras.

---

## 🚀 2. Guia de Primeiro Uso (Onboarding & Setup)

Ao iniciar o Tellus em uma nova máquina, o aplicativo oferece um assistente interativo de primeiro uso (**Guia de Início**). O setup é concluído em poucos minutos seguindo estes passos:

### 2.1. Obtenção da Chave de API (OpenRouter — Recomendado)
O Tellus utiliza o **OpenRouter** como agregador central para mais de 300 modelos de ponta sem a necessidade de assinar dezenas de plataformas:
1. Acesse [openrouter.ai](https://openrouter.ai) e crie sua conta.
2. Navegue até a seção de chaves em [openrouter.ai/keys](https://openrouter.ai/keys) e clique em **Create Key**.
3. Dê um nome (ex: `Tellus-Desktop`) e copie o token gerado (formato `sk-or-v1-...`).
4. Adicione créditos de acordo com sua demanda (um valor inicial de \$5 a \$10 dólares é suficiente para meses de uso rotineiro).
5. No Tellus, clique em **Guia de Início** ou no ícone de engrenagem (**Configurações & Chaves API**) e cole a chave no campo **OpenRouter Key**.

#### Modelos de Alta Eficiência de Custo
- **Google Gemini 2.5 Flash** (`google/gemini-2.5-flash`): Ultrarrápido para ferramentas e arquivamento de notas (~$0.00045 por lote).
- **DeepSeek R1** (`deepseek/deepseek-r1`): Raciocínio lógico e matemático profundo para planejamento e arquitetura de software (~$0.0035 por requisição complexa).

### 2.2. Voz Natural com Fish Audio (TTS & Orbe de Voz)
Para utilizar a síntese de voz neural ultra-realista no Tellus:
1. Crie uma conta gratuita em [fish.audio](https://fish.audio).
2. Acesse a área de desenvolvedor e gere uma **API Key**.
3. Cole o token no campo **Fish Audio Key** nas Configurações do Tellus.
4. Você poderá conversar em tempo real com o Orbe de Voz ou ouvir o resumo de notas e roteiros de estudo.

### 2.3. Diretórios Padrão de Execução
O Tellus gerencia seus dados organizados em pastas no diretório do usuário:
- **TellusMD Vault:** `~/Documents/Tellus Vault` (Cofre padrão de notas Markdown).
- **Tellus Workspace:** `~/Documents/Tellus Workspace` (Projetos e arquivos de código).
*Nota: É possível alternar ou selecionar qualquer pasta existente do computador a qualquer momento.*

---

## 💻 3. Tellus Code Studio & Navegador de Arquivos

O **Tellus Code Studio** transforma a IDE em uma estação de trabalho completa com o Monaco Editor:

- **Abas Multi-Arquivos:** Abra e alterne entre dezenas de arquivos com persistência de estado e rolagem horizontal suave.
- **Material File Icons:** Sistema de tipagem de ícones visuais para mais de 50 extensões (`.ts`, `.tsx`, `.js`, `.py`, `.json`, `.md`, `.sql`, `.css`, `.html`, `.png`, etc.) e ícones específicos para pastas (`src/`, `tests/`, `docs/`, `config/`).
- **Formatação Automática com Prettier:** Integração nativa acionada pelo atalho mundial `Shift + Alt + F` ou pelo botão **Formatar** na barra de status inferior.
- **Menu de Contexto de IA no Navegador Lateral:** Ao clicar com o botão direito em qualquer arquivo ou pasta na árvore de diretórios, o usuário pode:
  - 📝 **Abrir no Editor**
  - 💡 **Explicar Arquivo com IA**
  - 🛠️ **Refatorar / Sugerir Melhorias com IA**
  - 🧪 **Gerar Testes Unitários Automatizados**
  - 🔍 **Examinar Arquitetura do Diretório**
  - 🗑️ **Excluir com Confirmação Segura**

---

## 📚 4. TellusMD Vault & Canvas Caligráfico (Ink)

O motor **TellusNoteEngine** garante compatibilidade completa com o Obsidian e proteção contra perda acidental:

- **Sintaxe Híbrida e Wikilinks:** Suporte total a `[[Link para Nota]]`, destaque semântico de blocos `#tag` e formatação Markdown padrão.
- **NoteInkCanvas (Caligrafia Vetorial):**
  - Permite desenhar à mão livre, criar anotações manuscritas com caneta/mesa digitalizadora (Wacom, Apple Pencil) ou mouse sobre as notas.
  - Renderização fluida com curvas calculadas via `perfect-freehand`.
  - Controle de espessura de traço, cor da tinta, opacidade e palm rejection.
  - Exportação e inserção de camadas em formato SVG vetorial ou PNG de alta resolução.
- **Grafo de Conhecimento Interativo:**
  - Visualização de nós interconectados por links semânticos com simulação física em tempo real (força de repulsão, gravidade central e colisão elástica).
- **Lixeira com Retenção Configurável:**
  - Notas excluídas são preservadas em uma pasta interna protegida (`.backups`) com políticas de retenção de 30, 90, 120 dias, 1 ano ou permanente.

---

## 📥 5. Smart Dropzone Multimodal & AI Archivist

Projetado para eliminar a sobrecarga de informações:
- **Entrada Agrupada de Despejo (Brain Dump):** Cole trechos soltos de transcrições de vídeos, conversas encaminhadas de aplicativos de mensagens e anexe arquivos (PDF, CSV, imagens).
- **Classificação e Decomposição Atômica:** O modelo especialista divide tópicos desconexos em notas atômicas separadas dentro de pastas correspondentes do Vault (ex: `00_Inbox`, `Estudos/`, `Projetos/`).
- **Relatório de Auditoria:** Cada execução gera um relatório de transparência em `Relatórios de Organização/`, detalhando o raciocínio por trás de cada classificação.

---

## ☁️ 6. Sincronização em Nuvem Segura (Multi-PC Cloud Sync)

Para quem utiliza mais de um computador (ex: Desktop de desenvolvimento e Laptop pessoal):
- **Criptografia Local Ponta a Ponta (E2EE):** Antes de qualquer arquivo sair da sua máquina para o Google Drive ou OneDrive, ele é cifrado com uma chave derivada via **PBKDF2** e criptografia simétrica autenticada **AES-256-GCM**.
- **Chave Mestra / Segundo Fator (2FA):** O cofre remoto só pode ser descriptografado em outra máquina se a chave mestra cadastrada for fornecida. Provedores de nuvem visualizam apenas blocos binários ilegíveis.
- **Resolução de Conflitos e Modo Offline:** Suporte a edições desconectadas com reconciliação por carimbo de data/hora (timestamp).

---

## 🧠 7. Orquestração Multi-Agente & Pipeline Mind Map

O Tellus distribui tarefas cognitivas entre papéis especializados:
- **Planner / Architect:** Analisa a solicitação inicial e gera um plano de execução passo a passo.
- **Deep Thinking Engine:** Processa desafios algorítmicos complexos, análise de gaps de arquitetura e lógica avançada.
- **Fast Tools & Coder:** Executa manipulações rápidas no sistema de arquivos, comandos no terminal e edição pontual de código.
- **AI Archivist:** Curadoria e estruturação contínua do conhecimento no Vault.
- **Pipeline Mind Map:** Interface visual que exibe o fluxo em tempo real de mensagens e estados entre os modelos participantes.

---

## 🛠️ 8. Auto-Cura (Autonomous Self-Healing) & Testes

- **Mecanismo de Auto-Diagnóstico:** O Tellus inspeciona em tempo real a integridade da conexão com a API, status do sistema de arquivos e integridade das notas.
- **Suíte de Testes Automatizados:** O backend conta com mais de 80 testes unitários e de integração (`npm test`) cobrindo sanitização de conteúdo, motor do cofre, criptografia e orquestração de chamadas.

---

## 🛡️ 9. Diretrizes de Versionamento e Segurança Local

O repositório do Tellus segue regras estritas de higienização de código:
1. **Zero Segredos no Controle de Versão:** Arquivos `.env`, chaves de API, tokens e senhas nunca são rastreados.
2. **Privacidade Absoluta de Conversas:** As pastas de conversas pessoais e anotações privadas são 100% blindadas pelo `.gitignore`.
3. **Caminhos Dinâmicos:** Nenhum caminho absoluto de diretórios locais é fixado em código-fonte; o sistema utiliza sempre caminhos relativos ao diretório do usuário (`os.homedir()`).
4. **Build Limpo Obrigatório:** Todo commit exige compilação sem falhas no frontend (`vite build`) e no backend (`tsc`).

---

## 🚀 10. Executando o Projeto

### Pré-requisitos
- **Node.js** (v18.0.0 ou superior)
- **npm** ou gerenciador de pacotes equivalente

### Instalação e Execução
```bash
# 1. Instalar dependências do Backend
cd server
npm install

# 2. Instalar dependências do Frontend
cd ../client
npm install

# 3. Executar o servidor de desenvolvimento
# Terminal 1: Backend (porta 3001)
cd server
npm run dev

# Terminal 2: Frontend (porta 5173)
cd client
npm run dev
```

Acesse a interface no navegador através de `http://localhost:5173` ou inicialize o shell nativo via `npm run electron:dev`.

---

<div align="center">
  <sub>Tellus IDE v1.0.0 — Autonomia, Privacidade e Inteligência Local.</sub>
</div>
