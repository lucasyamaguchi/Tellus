# Guia de Estudo
## Arquitetura de Software

**Do nível iniciante ao avançado**

---

## Objetivo

Aprender a projetar, avaliar, documentar e evoluir arquiteturas de software robustas, escaláveis, sustentáveis e alinhadas às necessidades do negócio.

## Como usar este guia

1. Estude o primeiro tema do currículo.
2. Registre conceitos, exemplos e dúvidas.
3. Compare suas anotações com a fonte estudada.
4. Resolva exercícios sobre o conteúdo estudado.
5. Explique o assunto pela Técnica de Feynman.
6. Registre lacunas e avance para o próximo tópico.

---

# 1. Currículo completo

## Módulo 1 — Fundamentos de Arquitetura de Software

- O que é arquitetura de software
- Diferença entre arquitetura, design e implementação
- Papel do arquiteto de software
- Requisitos funcionais e não funcionais
- Atributos de qualidade: manutenibilidade, escalabilidade, disponibilidade, segurança, desempenho, testabilidade e observabilidade
- Trade-offs e decisões arquiteturais

**Fundamentos essenciais:** decisões estruturais, requisitos de qualidade, trade-offs e relação entre arquitetura e negócio.

## Módulo 2 — Princípios de Design de Software

- SOLID, coesão e acoplamento
- Separação de responsabilidades e encapsulamento
- DRY, KISS, YAGNI e Lei de Demeter
- Design orientado a mudanças
- Débito técnico

## Módulo 3 — Estilos e Padrões Arquiteturais

- Monólitos, camadas e modularidade
- Arquitetura hexagonal e Clean Architecture
- SOA, microservices, event-driven, serverless e plugins
- Critérios de escolha e impactos operacionais

## Módulo 4 — Modelagem de Domínio

- DDD, domínios e subdomínios
- Entidades, objetos de valor, agregados e serviços
- Eventos de domínio, bounded contexts e context mapping
- Linguagem ubíqua

## Módulo 5 — Integração e Comunicação

- REST, GraphQL, RPC/gRPC
- Mensageria, filas e tópicos
- Comunicação síncrona e assíncrona
- Idempotência, retries, timeouts e circuit breakers
- Contratos e versionamento de APIs

## Módulo 6 — Dados e Persistência

- Bancos relacionais e NoSQL
- Consistência, disponibilidade e transações
- Cache, replicação e sharding
- CQRS, Event Sourcing e persistência poliglota

## Módulo 7 — Escalabilidade, Desempenho e Resiliência

- Escalabilidade vertical e horizontal
- Balanceamento, alta disponibilidade e tolerância a falhas
- Bulkhead, rate limiting, backpressure e autoscaling
- Disaster recovery, RTO/RPO e testes de carga

## Módulo 8 — Segurança

- Security by design
- Autenticação, autorização, OAuth 2.0 e OpenID Connect
- Criptografia, segredos, segurança de APIs e OWASP
- Threat modeling, menor privilégio, auditoria e cloud security

## Módulo 9 — Sistemas Distribuídos

- Latência, falhas de rede e consistência
- Replicação, particionamento, eleição de líder e consensus
- Descoberta de serviços, coordenação e transações distribuídas

## Módulo 10 — Cloud e Infraestrutura

- IaaS, PaaS e SaaS
- Containers, Kubernetes e infraestrutura como código
- Redes cloud, serviços gerenciados, multi-region/multi-cloud
- FinOps e arquitetura cloud-native

## Módulo 11 — Observabilidade e Operação

- Logs, métricas e traces
- SLIs, SLOs e SLAs
- Monitoramento, alertas, incidentes e capacidade
- Runbooks, post-mortems e chaos engineering

## Módulo 12 — Documentação e Comunicação

- Modelo C4 e diagramas de contexto, contêineres e componentes
- Diagramas de sequência
- Architecture Decision Records (ADRs)
- Documentação viva, revisões e governança

## Módulo 13 — Evolução e Modernização

- Refatoração arquitetural e sistemas legados
- Strangler Fig Pattern e migração incremental
- Compatibilidade, feature flags e versionamento
- Modernização de monólitos, riscos e planos de migração

## Módulo 14 — Prática Avançada

- Avaliação de arquiteturas e cenários de qualidade
- Trade-offs, threat modeling e capacity planning
- Custos, governança evolutiva, Lei de Conway e Team Topologies
- Liderança técnica

---

# 2. Fontes recomendadas

1. **Fundamentals of Software Architecture — Mark Richards e Neal Ford**  
   Melhor ponto de partida para fundamentos, estilos, características de qualidade e arquitetura evolutiva.

2. **Software Architecture in Practice — Len Bass, Paul Clements e Rick Kazman**  
   Referência clássica para atributos de qualidade e avaliação arquitetural.

3. **Software Architecture: The Hard Parts — Neal Ford, Mark Richards, Pramod Sadalage e Zhamak Dehghani**  
   Explora trade-offs e decisões difíceis, especialmente em sistemas distribuídos.

4. **Designing Software Architectures: A Practical Approach — Humberto Cervantes e Rick Kazman**  
   Conecta teoria, projeto e avaliação de alternativas arquiteturais.

5. **Documenting Software Architectures: Views and Beyond — Paul Clements et al.**  
   Ensina a documentar e comunicar arquiteturas por diferentes visões.

## Ordem recomendada

1. *Fundamentals of Software Architecture*
2. *Software Architecture in Practice*
3. *Software Architecture: The Hard Parts*
4. *Designing Software Architectures*
5. *Documenting Software Architectures: Views and Beyond*

---

# 3. Prompts de estudo ativo

## Prompt 3 — Revisão das anotações

> Compare minhas anotações `[NOME DO ARQUIVO]` com o conteúdo estudado `[CONTEÚDO ESTUDADO]` da fonte `[FONTE ESTUDADA]`. Verifique se estão corretas e completas. Liste conceitos ausentes, informações incorretas, ambiguidades e sugestões de melhoria. Corrija erros de redação sem alterar o sentido.

## Prompt 4 — Exercícios

> Crie questões somente sobre `[CONTEÚDO ESTUDADO]` da fonte `[FONTE ESTUDADA]`. Organize-as do nível básico ao avançado e não forneça as respostas antes que eu tente resolvê-las.

## Prompt 5 — Técnica Feynman

> Faça uma apresentação somente sobre `[CONTEÚDO ESTUDADO]` da fonte `[FONTE ESTUDADA]`, usando linguagem simples, analogias, exemplos práticos, trade-offs e perguntas de verificação. Ao final, destaque o que um iniciante precisa conseguir explicar sem consultar material.

---

# 4. Primeira sessão sugerida

**Fonte:** *Fundamentals of Software Architecture*  
**Conteúdo:** definição de arquitetura, papel do arquiteto, diferença entre arquitetura e design, características de qualidade, trade-offs, decisões arquiteturais e arquitetura evolutiva.

## Modelo de registro

- **Data:**
- **Fonte e capítulo:**
- **Conteúdo estudado:**
- **Minhas anotações:**
- **Dúvidas:**
- **Exercícios concluídos:**
- **Explicação Feynman:**
- **Próximo passo:**

---

*Guia preparado para estudo progressivo de Arquitetura de Software.*
