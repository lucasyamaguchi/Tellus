---
name: RESTful API & Service Generator
id: api-generator
version: 1.0.0
category: Backend
agent: fast_coder
author: Tellus Core Team
license: MIT
security_sanitized: true
---

# RESTful API & Service Generator Skill

Geração de rotas RESTful tipadas em Express / TypeScript com validação de payload, respostas com status HTTP semânticos e tratamento de erros padronizado.

## Diretrizes Fundamentais
1. **Contratos Claros**: Defina interfaces TypeScript de Request e Response para cada endpoint.
2. **Segurança de Entrada**: Sanitize parâmetros de query e strings de caminho para evitar travessia de diretório (`path traversal`).
3. **Respostas Estruturadas**: Retorne payloads no padrão `{ success: true, data: ... }` ou `{ error: ... }` com códigos HTTP adequados.
