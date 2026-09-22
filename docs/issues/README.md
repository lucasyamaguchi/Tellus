# 🧭 Tellus Architectural Roadmap & Issues

Este diretório contém o detalhamento técnico e as especificações das próximas grandes evoluções do ecossistema Tellus:

| Issue | Título | Foco Principal |
| :--- | :--- | :--- |
| **[#01](file:///e:/Die-Sonne/Projects/AgenticIDE/docs/issues/ISSUE_01_WEB_VAULT_CLOUD_SYNC.md)** | **Web Vault & Sincronização em Nuvem** | Acessar, ler e redigir notas de qualquer lugar via navegador/celular com PC desligado |
| **[#02](file:///e:/Die-Sonne/Projects/AgenticIDE/docs/issues/ISSUE_02_TELLUS_NOTES_STANDALONE.md)** | **Tellus Notes Standalone** | Módulo/App dedicado exclusivamente a estudos, memória e chat direcionado com notas |
| **[#03](file:///e:/Die-Sonne/Projects/AgenticIDE/docs/issues/ISSUE_03_REMOTE_DROPZONE_DRIVE_SYNC.md)** | **Ingestão Remota via Google Drive ➔ Dropzone** | Enviar fotos de cadernos e arquivos pelo celular no Drive e auto-organizar ao ligar o PC |

---

## 🛡️ Diretrizes Globais de Segurança e Arquitetura

> [!IMPORTANT]
> **1. IA e Modelos Exclusivamente Locais (Desktop-Only):**  
> Nenhuma LLM, agente autônomo ou inteligência artificial opera na nuvem ou em servidores web públicos. Todo o processamento cognitivo (OCR multimodal, organização de dropzone, tutor de estudos RAG) roda estritamente dentro da aplicação Desktop no computador local do usuário. A nuvem atua apenas como armazenamento passivo em repouso.

> [!CAUTION]
> **2. Blindagem contra Prompt Injection Indireto:**  
> Notas editadas remotamente ou arquivos baixados do Google Drive podem conter instruções maliciosas ocultas (ex: *"Ignore previous instructions..."*). Nenhuma nota ou arquivo vindo do exterior é injetado no contexto de um modelo sem passar pelo filtro de higienização de prompt e bloqueio de comandos executáveis.

> [!TIP]
> **3. Sanitização Pré-Input Obrigatória (GitSafe Nativo):**  
> Todo dado que entra no Tellus passa por sanitização pré-input antes de ser persistido no cofre ou lido pelas IAs locais, higienizando tokens, credenciais, tags de injeção e delimitadores de sistema.

