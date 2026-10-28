---
name: Testing & Quality Assurance
id: unit-testing-best-practices
version: 1.0.0
category: Testing
agent: all
author: Tellus Core Team
license: MIT
security_sanitized: true
---

# Testing & Quality Assurance Skill

Criação e manutenção de testes unitários e de integração determinísticos, rápidos e confiáveis.

## Diretrizes Fundamentais
1. **Isolamento de Estado**: Utilize diretórios temporários (`os.tmpdir()`) e limpe recursos em hooks `before()` e `after()`.
2. **Cobertura Abrangente**: Teste cenários de sucesso, limites de borda e rejeição de dados corrompidos ou chaves incorretas.
3. **Execução Determinística**: Evite dependências de rede externa ou timers longos que causem interrupções em esteiras de CI/CD.
