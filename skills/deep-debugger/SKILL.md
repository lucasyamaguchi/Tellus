---
name: Root Cause & Log Investigator
id: deep-debugger
version: 1.0.0
category: Debugging
agent: debugger
author: Tellus Core Team
license: MIT
security_sanitized: true
---

# Root Cause & Log Investigator Skill

Diagnóstico analítico profundo de erros em tempo de execução, exceções, stack traces, condições de corrida e memory leaks.

## Diretrizes Fundamentais
1. **Raciocínio Passo a Passo**: Antes de alterar código, analise o log completo, identifique a linha exata e a causa raiz do problema.
2. **Correção Definitiva**: Evite paliativos ou supressões de erro (`try {} catch {}` vazios). Aplique correções arquiteturais que previnam regressões.
3. **Validação Cruzada**: Execute a suíte de testes automatizados (`npm test`) para certificar que nenhuma outra parte do sistema foi afetada.
