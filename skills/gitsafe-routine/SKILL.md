---
name: GitSafe & Data Sanitization Routine
id: gitsafe-routine
version: 1.0.0
category: Security & Governance
agent: all
author: Tellus Core Team
license: MIT
security_sanitized: true
---

# 🛡️ GitSafe & Data Sanitization Routine (Verificação Interna do Tellus)

Esta skill define a **rotina operacional mandatória de auditoria interna, higienização de dados sensíveis e política estrita de versionamento** no ecossistema Tellus. Deve ser ativada antes de qualquer `git commit`, `git push`, criação de release ou publicação de código.

---

## 🎯 1. Gatilhos de Ativação & Uso

Ative esta rotina imediatamente quando:
- For realizar commits ou pushes no repositório de qualquer projeto.
- O usuário solicitar: *"verificar dados sensíveis"*, *"fazer limpeza no git"*, *"auditar repositório"*, *"preparar para commit/push"*, *"rodar o gitsafe"*, *"verificar se vazou alguma coisa"*.
- For preparar uma versão para publicação no GitHub ou geração de executáveis de release.
- For adicionar novos arquivos, módulos ou modificar configurações de ambiente.

---

## 📋 2. Protocolo de Auditoria em 5 Etapas

### Etapa 1: Privacidade Absoluta de Conversas e Dados Pessoais
- [ ] **Zero Pastas de Conversas**: Garantir que diretórios de bate-papos (`Chats/`, `chats/`, `transcripts/`, `sessions/`) estejam 100% ausentes do índice do Git (`git ls-files`).
- [ ] **Zero Dados Pessoais e Vagas**: Nenhuma carta de apresentação, currículo, anotação de processo seletivo ou menção a vagas reais de empresas/órgãos deve existir no código ou no histórico.
- [ ] **Zero Vaults Pessoais**: Pastas de notas (`Vault/`, `vault/`, `.tellus/`, `.obsidian/`) devem ser estritamente bloqueadas no `.gitignore`.

### Etapa 2: Higienização de Caminhos Locais de Máquina (Zero Hardcoded Paths)
- [ ] **Zero Caminhos Absolutos**: Nenhum caminho contendo diretórios locais de desenvolvedor (ex: `C:\Users\...`, `E:\...`, `/home/...`) pode estar fixado no código-fonte.
- [ ] **Resolução Dinâmica**: Todo caminho de arquivo ou cofre deve utilizar `path.join(os.homedir(), ...)` ou ler de variáveis de ambiente configuráveis (`TELLUS_VAULT_DIR`).

### Etapa 3: Varredura de Segredos, Tokens e Chaves de API
- [ ] **Blindagem do `.gitignore`**: Arquivos `.env`, `.env.*`, `config.json` e credenciais locais devem estar bloqueados.
- [ ] **Varredura Regex Ativa**: Buscar ativamente no repositório por padrões de chaves:
  - OpenRouter (`sk-or-v1-...`)
  - OpenAI / Anthropic (`sk-...`, `sk-ant-...`)
  - Google Gemini (`AIzaSy...`)
  - GitHub Tokens (`ghp_...`, `github_pat_...`)
  - JWTs e chaves privadas (`*.pem`, `*.key`)

### Etapa 4: Bloqueio de Binários e Artefatos Pesados
- [ ] **Zero Executáveis Rastreados**: Nenhum `.exe`, `.dll`, `.node`, `.bin` ou instalador local pode ser commitado na árvore do repositório.
- [ ] **Distribuição Exclusiva por Releases**: Binários compilados devem ser disponibilizados apenas via GitHub Releases e GitHub Actions (`.github/workflows/release.yml`), nunca no commit git.

### Etapa 5: Validação da Política de Versionamento & Compilação
- [ ] **Mensagens Semânticas**: Seguir estritamente o padrão Conventional Commits:
  - `feat(...)`: Novas funcionalidades
  - `fix(...)`: Correções de bugs
  - `chore(...)`: Manutenção e higienização
  - `docs(...)`: Documentação
  - `refactor(...)`: Refatoração sem mudança de comportamento
  - `test(...)`: Adição ou ajuste de testes
- [ ] **Gatekeeper de Compilação & Testes**:
  - Compilação limpa com 0 erros (`npm run build`).
  - Suíte completa de testes aprovada com 100% de sucesso (`npm test`).

---

## 🛠️ 3. Comandos Automatizados de Execução da Rotina

Ao rodar a rotina de auditoria interna, execute sequencialmente no terminal:

```bash
# 1. Verificar arquivos modificados e rastreados
git status -s

# 2. Auditar arquivos rastreados por palavras sensíveis
git grep -iE 'die-sonne|users/|api_key|token|sk-ant|sk-or'

# 3. Validar se alguma pasta de chats ou binário está no índice
git ls-files | Select-String -Pattern "^Chats/|\.exe$|\.env$"

# 4. Validar integridade e compilação do TypeScript
npm run build

# 5. Executar suíte de testes automatizados
npm test
```

---

## 📜 4. Procedimento de Purgação Histórica (Caso Arquivos Sensíveis Tenham Sido Commitados)

Se algum arquivo pessoal, chat ou binário tiver sido commitado no passado:

```bash
# Purgar pasta ou binário de TODOS os commits históricos
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch -r PastaSensivel Arquivo.exe" --prune-empty --tag-name-filter cat -- --all

# Limpar referências e forçar garbage collection
Remove-Item -Path .git/refs/original -Recurse -Force -ErrorAction SilentlyContinue
git reflog expire --expire=now --all
git gc --prune=now

# Sincronizar com o remoto substituindo a árvore
git push origin main --force
```

---

## 💡 5. Regra de Confidencialidade Externa

> [!IMPORTANT]
> Esta especificação e o protocolo interno **NUNCA devem ser citados nominalmente no README.md público do repositório**. Repositórios públicos devem utilizar seções genéricas como `🛡️ Política de Versionamento & Segurança Local`.
