# 📚 Issue #02: Tellus Notes Standalone (Módulo de Estudos & Chat com Notas)

## 📌 Contexto & Objetivo
Separar a experiência do módulo de anotações da IDE principal de programação, criando um ambiente focado 100% em **estudo ativo, síntese, memorização e diálogo com o cofre de conhecimento**, sem distrações de terminal, arquivos de código ou dependências de software.

---

## 🎨 Principais Funcionalidades

### 1. Modo Estudo Puro (Study Focus)
* Interface minimalista com tema customizado para leitura prolongada e escrita sem ruído.
* Visualização por **Cadernos Temáticos**, **Subpastas** e **Grafo de Conhecimento**.
* Zero painéis de terminal, compiladores ou arquivos de código de projeto.

### 2. Conversas com as Notas (RAG Local Zero-Token)
* **Chat Direcionado ao Caderno**:
  * Ao invés de um agente de programação, um **Tutor Socrático de Estudos**.
  * Opções pré-configuradas:
    * *"Faça perguntas para testar meus conhecimentos sobre este caderno"* (Active Recall)
    * *"Identifique contradições ou lacunas nas minhas anotações"*
    * *"Gere um roteiro de estudos de 7 dias com base nestas notas"*
    * *"Explique o conceito X usando a técnica de Feynman"*
* Busca semântica e contextual por BM25-lite com injeção automática de contexto das notas.

### 3. Digitalização com "Anote isso"
* Suporte nativo para arrastar fotos de páginas de caderno manuscritas ou apostilas.
* Transcrição OCR assistida por visão multimodal gerando Markdown estruturado, diagramas Mermaid e tabelas limpas.

---

## 🏗️ Modos de Distribuição
* **Opção 1**: Alternador de modo na inicialização do Tellus (`Modo Dev` vs `Modo Estudos`).
* **Opção 2**: Binário Electron separado (`Tellus Notes.exe`) compartilhando o mesmo backend e o cofre `E:\Die-Sonne\Vault`.
* **Opção 3**: PWA web instalável no celular e desktop.
