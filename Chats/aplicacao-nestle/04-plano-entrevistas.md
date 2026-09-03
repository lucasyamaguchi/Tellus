# 🎤 Plano de Preparação para Entrevistas — Data Engineer Coordinator (AI Engineering) — Nestlé

> Guia prático para as rodadas típicas do processo: triagem de RH → entrevista técnica/gestor → system design → painel comportamental.

---

## 1. Mapa de Rodadas Prováveis

| Rodada | Foco | Duração típica | O que esperar |
|---|---|---|---|
| **Triagem RH** | Fit, salário, disponibilidade, inglês | 30 min | Perguntas de alinhamento de expectativas; não aprofundar técnica |
| **Técnica — Dados** | SQL, Snowflake, Databricks, dbt, pipelines | 60–90 min | Desafio de SQL (window functions, tuning), arquitetura de pipeline, modelagem |
| **Técnica — IA** | RAG, agentes, LLM APIs, LLMOps | 60–90 min | Design de solução RAG, orquestração de agentes, evals, custo, segurança |
| **System Design** | Ponta a ponta | 45–60 min | Desenhar solução: dados corporativos + IA generativa com governança |
| **Comportamental** | Liderança, mentoria, conflitos, decisões | 45–60 min | STAR: conflitos, influência sem autoridade, priorização, erros |
| **Painel final** | Executivo/tech lead | 45 min | Visão, aderência cultural, estratégia |

---

## 2. Tópicos Técnicos Essenciais (Mapa de Estudo)

### 2.1 SQL Avançado e Snowflake
- **Window functions**: `ROW_NUMBER`, `RANK`, `LAG/LEAD`, `SUM() OVER (PARTITION BY ... ORDER BY ...)`
- **CTEs** e subqueries; diferença para views; performance
- **Otimização no Snowflake**: micro-partitions, clustering keys (quando usar, custo), pruning, `EXPLAIN`, warehouse sizing (XS→XL), auto-suspend/auto-resume, caching (query result cache)
- **Materialized Views** (quando valem a pena, refresh)
- **Time Travel** (`AT(TIMESTAMP => ...)`, `UNDROP`), **Zero-Copy Cloning**, **Data Sharing**, **Resource Monitors** (créditos, alertas), **RBAC** (roles, grants, `SECURE VIEWS`, masking/PII)
- **Modelagem**: dimensional (star), Data Vault (conceito), medalhão (bronze/silver/gold)
- **Custo**: como medir e reduzir (query profile, `WAREHOUSE`, cache, clustering, `RESOURCE MONITORS`, descarte de dados duplicados)

### 2.2 Databricks
- **Spark** (transformações, shuffles, `broadcast join`, partições) e **Delta Lake** (ACID, time travel, `OPTIMIZE`, `Z-ORDER`, `VACUUM`, MERGE/CDC)
- **Unity Catalog**: catálogo, schema, grants, lineage, gestão de acessos centralizada
- **Workflows** (orquestração de jobs, retries, alertas) e **Asset Bundles** (IaC para pipelines)
- Diferença de abordagens: Databricks × Snowflake (engenharia × warehousing); quando usar cada um

### 2.3 dbt, CI/CD e Observabilidade
- **dbt**: models, materializações, testes (singular/generic), `ref`/`source`, macros, `dbt docs`, `dbt test`, `dbt build`
- **CI/CD**: GitHub Actions / Azure DevOps; pipeline de build-test-deploy; validação de SQL; `dbt run --select state:modified` (incremental/slim CI)
- **DevSecOps**: secret scanning, SAST, mínimo privilégio, IaC review
- **Observabilidade**: logs estruturados, métricas de pipeline, alertas, data quality monitors, lineage

### 2.4 Azure
- **Azure Data Factory** (orquestração, linked services, parametrização, triggers) — e como se compara a Airflow/Databricks Workflows
- **ADLS Gen2** (hierarchical namespace, ACLs, RBAC)
- **Azure Functions** (serverless, triggers HTTP/Blob/Queue), **Key Vault** (segredos), **Entra ID** (autenticação, service principals), **Azure OpenAI** (deploy de modelos, quotas, RAG com AI Search)

### 2.5 AI Engineering — o diferencial
- **LLM APIs**: OpenAI / Azure OpenAI — completions, chat, function calling, tokens, temperaturas, max tokens, context windows
- **Embeddings**: o que são, modelos (text-embedding-*, BGE, etc.), dimensionalidade, custo
- **RAG ponta a ponta**:
  - Indexação: ingestão, chunking (estratégias), metadados, dedup, updates/CDC
  - Armazenamento vetorial: [Azure AI Search / pgvector / Pinecone / FAISS], filtros por metadados, hibrid search
  - Recuperação: embedding search + keyword (BM25), re-ranking, top-k, diversidade
  - Geração: prompt design, system prompt, contexto, citações/fontes
  - **Evals**: ground-truth, métricas (f1, faithfulness, answer relevancy, context precision, MRR, hit rate), testes de regressão
- **Agentes de IA**:
  - Orquestração: loop agente, tool calling / function calling, plan-and-execute, ReAct
  - Ferramentas: integração com APIs internas, SQL, sistemas corporativos
  - **Segurança**: RBAC/autenticação por agente, sanitização de inputs, prevenção de prompt injection, guardrails, rate limits, PII
  - **Observabilidade**: tracing (LangSmith/Langfuse/OpenTelemetry), logs de decisões, custo por execução
- **LLMOps**:
  - **Custo de inferência**: tokens por request, cache de prompts, batch, modelo por complexidade (pequeno/grande), quotas
  - **Seleção de modelo**: latência × qualidade × custo; quando usar GPT-4o/4o-mini/outros
  - **Segurança e compliance**: data residency, PII, versionamento de prompts, drift de qualidade
- **Frameworks**: LangChain, LlamaIndex, LangGraph (para orquestração de agentes), AutoGen (se aplicável)
- **Falhas comuns de RAG/agentes**: chunking ruim, falta de metadados, top-k pequeno, contexto poluído, falta de evals, ausência de fallback, custo descontrolado — fale sobre como evita

---

## 3. Perguntas Prováveis (com gabarito-resumo)

### SQL / Snowflake
1. *"Como você reduziria custo de queries lentas no Snowflake?"*
   → Verificar `QUERY PROFILE`, warehouse sizing, caching, clustering keys, evitar full scans, revisar joins e CTEs, usar resource monitors + alertas, agendar workloads com auto-suspend.
2. *"Quando usar Materialized View vs View vs tabela?"*
   → MV para agregações pesadas repetidas com dados quase estáticos; view para lógica de negócio reutilizável e segura (secure view); tabela para dados brutos/estágios e necessidade de controle (clustering, grants finos).
3. *"O que é Zero-Copy Cloning e quando usar?"*
   → `CREATE TABLE ... CLONE` sem duplicar storage; usar para ambientes dev/test, backups rápidos, reprodução de cenários.
4. *"Como garantir que uma tabela PII seja segura?"*
   → RBAC + Secure Views + Dynamic Data Masking / external tokenization; revogar acesso direto; provider de dados com sharing controlado.

### Databricks
5. *"Spark: como evitar shuffle excessivo?"*
   → Broadcast join para tabelas pequenas, particionamento correto, evitar `repartition` desnecessário, usar `Z-ORDER`/`OPTIMIZE` no Delta para pruning.
6. *"Diferença entre Data Lake e Lakehouse? Quando usar Databricks?"*
   → Lakehouse = Delta Lake sobre ADLS Gen2 com ACID, schema enforcement, time travel; Databricks para transformações pesadas/ML, Snowflake para BI/consultas SQL leves e colaboração analítica.

### dbt / CI / Governança
7. *"Como estrutura testes no dbt?"*
   → Generic tests (unique, not_null, accepted_values, relationships) + singular tests para lógica de negócio; cobertura de fontes e modelos críticos, `severity`, `store_failures`; testes no CI com `--select state:modified`.
8. *"O que é lineage e como você garante?"*
   → Unity Catalog lineage + dbt docs; registrar metadados de fontes→models→dashboards; monitorar impacto de mudança antes do deploy.

### AI Engineering
9. *"Desenhe um pipeline RAG para documentos corporativos."*
   → ① Ingestão (conectores, parse, chunking com overlap, metadados, dedup) ② Indexação (embeddings + vector store + filtros) ③ Retrieval (hybrid search + re-ranking, top-k com contexto enriquecido) ④ Geração (LLM com system prompt + citações) ⑤ Evals e monitoramento contínuo + guardrails de PII.
10. *"Como reduzir alucinações?"*
    → Contexto de alta qualidade (chunking/metadados), instruções claras ("responda apenas com base no contexto; se não souber, diga"), citações, fallback, evals de faithfulness, validação de respostas, restrição de escopo e temperatura baixa.
11. *"Como você orquestraria um agente que consulta 3 sistemas internos com autenticação?"*
    → Service principal/identidade gerenciada + RBAC por ferramenta; cada tool = função com auth própria (token/OAuth/SPN), rate limiting, validação de entrada, logs de chamadas, tracing; loop do agente com limite de iterações e fallback.
12. *"Como controlar custo de LLM em produção?"*
    → Cache de prompts/respostas, roteamento por complexidade (modelo menor para tarefas simples), batch de embeddings, monitoramento de tokens por usuário/sessão, quotas e alertas, revisão de prompts (reduzir contexto desnecessário).

---

## 4. System Design — Roteiro para o Exercício

**Cenário típico:** *"Desenhe uma solução que permita a um analista de negócio fazer perguntas em linguagem natural sobre dados da empresa, com alta confiabilidade e governança."*

Estrutura de resposta (15 min de design + discussão):
1. **Requisitos**: funcionais (perguntas, respostas com fonte, suporte a múltiplos domínios), não-funcionais (latência, segurança, custo, compliance)
2. **Desenho de alto nível** (diagrama mental):
   - Fontes → pipelines ELT (dbt) → Snowflake/Databricks (medallion) → catálogo/linhagem
   - RAG: documentos/contexto → chunking → embeddings → vector store (+ metadata filters)
   - Orquestração: agente com tools (SQL executor read-only + busca vetorial + API de KPI)
   - Segurança: Identidade federada (Entra ID), RBAC por tool, masking, audit
   - Observabilidade: tracing, custo por conversa, evals
3. **Decisões-chave e trade-offs**: vector store escolhido, chunk size, hybrid search, top-k, modelo, cache
4. **Riscos**: prompt injection via dados, vazamento de PII, custo, drift; mitigação com guardrails
5. **Plano de rollout**: pilotar em domínio único, evals com ground-truth, features flags, feedback loop

---

## 5. Comportamental — Método STAR (prepare 5 histórias)

Monte 1 história por bloco com métricas e papel pessoal claro:

| Bloco | História sugerida |
|---|---|
| **Liderança técnica** | Padronizou boas práticas de um squad que reduziu [X]% de rework |
| **Mentoria/capacitação** | Treinou N engenheiros; um deles passou a liderar entregas próprias |
| **Conflito técnico** | Discordou de arquitetura (ex.: monólito vs microsserviços) e como resolveu com dados |
| **Erro e aprendizado** | Incidente de dados (ex.: pipeline quebrado, dado errado) — o que aprendeu e mudou |
| **IA/LLMOps na prática** | Projeto desafiador de RAG/agente: problema, solução, evals, resultado |

Estrutura do STAR: **S**ituação (contexto) → **T**arefa (seu papel) → **A**ção (o que fez, sem "nós" genérico) → **R**esultado (número, aprendizado).

---

## 6. Perguntas para FAZER ao entrevistador (mostram maturidade)

- *"Como a Nestlé está estruturando a governança de IA generativa (policies, guardrails, data residency) em escala global?"*
- *"Qual é o nível atual de maturidade da plataforma de dados na qual o time de AI Engineering vai rodar (Unity Catalog, catálogo de dados, data quality)?"*
- *"Quais são os casos de uso de agentes de IA prioritários: interno ou externo (clientes)? Qual o volume esperado?"*
- *"Como o time mede sucesso de uma solução RAG: evals, feedback de usuários, ROI?"*
- *"Como está estruturado o time: quantos engenheiros, quais frentes, como funciona a mentoria?"*

---

## 7. Plano de Estudo 14 dias (se precisar reforçar alguma área)

| Dia | Foco |
|---|---|
| 1–3 | SQL avançado + Snowflake tuning (handson com trial) |
| 4–5 | Databricks/Delta + Unity Catalog (labs) |
| 6–7 | dbt + CI/CD (projeto pequeno com GitHub Actions) |
| 8–9 | RAG: construir um mini-projeto (pdfs → embeddings → chat com citações) |
| 10 | Agentes: LangGraph ou LangChain com tool calling |
| 11 | LLMOps: evals + tracing + custo (LangSmith/Langfuse) |
| 12 | Azure: OpenAI + AI Search + Functions (quickstarts) |
| 13–14 | Revisar histórico de projetos e preparar 5 histórias STAR + simular system design |

> **Dica:** se tiver uma conta trial do Snowflake/Databricks/Azure, faça 1 exercício real por dia e anote o que aprendeu — você pode citar na entrevista.