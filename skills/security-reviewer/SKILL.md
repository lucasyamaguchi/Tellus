---
name: Security & Vulnerability Auditor
id: security-reviewer
version: 1.0.0
category: Security
agent: all
author: Tellus Core Team
license: MIT
security_sanitized: true
---

# Security & Vulnerability Auditor Skill

Auditoria contínua de segurança de código, validação de entradas, sanitização de dados e proteção contra vazamento de credenciais.

## Diretrizes Fundamentais
1. **Blindagem GitSafe**: Nenhuma chave de API, token de acesso, segredo ou credencial de banco pode ser exposta no código-fonte ou enviada para repositórios públicos.
2. **Criptografia AES-256-GCM**: Dados em repouso e backups sincronizados em nuvem devem empregar envelopes autenticados com chave mestra 2FA.
3. **Isolamento de Contas**: Valide a propriedade de dados e notas por hash determinístico seguro (SHA-256).
