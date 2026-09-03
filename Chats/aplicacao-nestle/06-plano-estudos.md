# 🎓 Plano de Estudos — Data Engineer Coordinator (AI Engineering) — Nestlé

> Objetivo: transformar os requisitos da vaga em um plano de estudo **priorizado, com recursos curados e entregáveis concretos** que você possa citar na entrevista.
> Como usar: preencha seu nível atual (🔵 Básico / 🟢 Intermediário / 🟠 Avançado) em cada bloco e foque primeiro no que estiver em nível mais baixo + maior prioridade da vaga.

---

## 1. Mapa Vaga → O Que Estudar (ordem de prioridade)

| Prioridade | Bloco (requisito da vaga) | O que estudar | Tópicos-chave |
|---|---|---|---|
| 🔴 P0 | **AI Engineering — RAG, agentes, LLM APIs** (R10, D6) — o **diferencial** da vaga | APIs de LLM (OpenAI/Azure OpenAI), embeddings, RAG ponta a ponta, orquestração de agentes (tool calling), evals, segurança de agentes | function calling, chunking, vector store, hybrid search, re-ranking, prompt injection, guardrails |
| 🔴 P0 | **LLMOps / Produtização** (R10, D6) | Observabilidade, custo de inferência, seleção de modelo, cache, tracing, drift | Langfuse/LangSmith, tokens/request, modelo por complexidade, evals de regressão |
| 🔴 P0 | **Snowflake avançado** (R2, D1) | Performance tuning, clustering, custo, segurança, modelagem | micro-partitions, clustering keys, EXPLAIN, resource monitors, time travel, zero-copy clone, secure views, masking |
| 🟠 P1 | **Databricks + Lakehouse** (R3, D2) | Spark, Delta Lake, Unity Catalog, orquestração | transformações Spark, shuffle, OPTIMIZE/Z-ORDER, MERGE/CDC, grants/lineage, Workflows, Asset Bundles |
| 🟠 P1 | **SQL avançado** (R4) | Window functions, CTEs, otimização de plano | ROW_NUMBER/RANK/LAG/LEAD, particionamento, padrões de tuning |
| 🟠 P1 | **dbt** (R6) | Modelagem versionada, testes, documentação | materializações, ref/source, testes generic/singular, macros, CI slim |
| 🟠 P1 | **CI/CD + Governança + Qualidade** (R7, R8, D4, D5) | Pipelines de deploy, data contracts, lineage, observabilidade | GitHub Actions, Azure DevOps, secret scanning, dbt test, DataHub/OpenMetadata, logs/alertas |
| 🟡 P2 | **Azure** (R9, D3) | ADF, ADLS Gen2, Functions, Key Vault, Azure OpenAI, AI Search | orquestração ADF, ACLs/RBAC, serverless, RAG com AI Search |
| 🟡 P2 | **Liderança técnica** (bloco comportamental) | Mentoria, code review, comunicação com negócio | método STAR, histórias de influência sem autoridade |

---

## 2. Roadmap de 6 Semanas (execução prática)

> Regra de ouro: **todo tópico termina com um entregável** (lab, exercício, projeto ou nota) — é isso que você leva para a entrevista.

### Semana 1 — Snowflake avançado + SQL
- [ ] Criar conta **trial do Snowflake** (grátis, 400 créditos)
- [ ] Hands-On Essentials (curso oficial gratuito na plataforma de cursos da Snowflake)
- [ ] Praticar: clustering keys, warehouse sizing, `EXPLAIN`, query profile, time travel, zero-copy clone, resource monitors
- [ ] SQL: 10–15 exercícios de window functions (LeetCode/HackerRank nível Hard/Medium)

**Entregável:** documento "Snowflake Tuning Playbook" com 5 queries lentas → otimizadas e o motivo da melhora (ou post/LinkedIn).

### Semana 2 — Databricks / Spark / Delta / Unity Catalog
- [ ] Curso gratuito Databricks Academy: "Data Engineering with Databricks" (parte 1)
- [ ] Labs: Delta Lake (OPTIMIZE, Z-ORDER, MERGE/CDC, time travel), Unity Catalog (grants, lineage)
- [ ] Spark: joins, broadcast, particionamento — entender quando há shuffle

**Entregável:** pipeline bronze → silver → gold em notebook Databricks com tabelas Delta + permissões no Unity Catalog.

### Semana 3 — dbt + CI/CD + Governança
- [ ] Cursos gratuitos dbt Learn ("Fundamentals" + "Advanced")
- [ ] Projeto pessoal: modelo analítico com dbt (ref, sources, testes, docs)
- [ ] CI/CD: GitHub Actions rodando `dbt build` + testes no PR (dbt cloud ou CLI)
- [ ] Estudar data contracts, lineage (dbt docs), observabilidade de pipeline

**Entregável:** repositório público (ou privado com README) com dbt project versionado + pipeline de CI com testes.

### Semana 4 — RAG ponta a ponta (projeto-âncora 🎯)
- [ ] Curso DeepLearning.AI: "Building and Evaluating Advanced RAG" (Lance Martin) e "Understanding and Applying Text Embeddings"
- [ ] Construir mini-projeto: PDFs/notas → chunking → embeddings → vector store → chat com citações
- [ ] Implementar: hybrid search (semântico + BM25), re-ranking, filtros por metadados, prompts com system context

**Entregável:** projeto RAG funcional com **evals** (faithfulness, answer relevancy, hit rate) — use Langfuse ou LangSmith para trace.

### Semana 5 — Agentes de IA + segurança
- [ ] LangGraph (curso "AI Agents in LangGraph" da DeepLearning.AI) ou LangChain tool calling
- [ ] Praticar: agente que consulta 2–3 ferramentas (uma sendo SQL read-only sobre seus dados)
- [ ] Segurança: RBAC por tool, sanitização de input, prompt injection, rate limits, limite de iterações

**Entregável:** agente com tool calling + documento de decisões de segurança (por que cada escolha).

### Semana 6 — LLMOps + Azure + System Design
- [ ] LLMOps: custo de tokens, cache de prompts, roteamento por modelo, alertas de custo
- [ ] Azure: quickstarts de Azure OpenAI + AI Search + Functions (RAG serverless simplificado)
- [ ] System design: desenhar "analista de negócio pergunta em linguagem natural sobre dados corporativos" (cenário do `04-plano-entrevistas.md`)
- [ ] Simular entrevista: 5 histórias STAR + 1 whiteboard de RAG + perguntas de Snowflake/Databricks

**Entregável:** 1 exercício de system design escrito + gravação de autoentrevista (ou simulação com colega).

---

## 3. Fontes Curadas (onde estudar)

### 📘 Livros (1–2 por área, priorize estes)
| Livro | Por que | Área |
|---|---|---|
| **"AI Engineering" — Chip Huyen (2025)** | O guia mais completo e atual sobre construção de aplicações com foundation models, do pipeline de dados ao LLMOps. **Leitura #1 para esta vaga** | AI Engineering |
| "Snowflake: The Definitive Guide" (O'Reilly) | Cobre modelagem, performance e administração na profundidade que a vaga pede | Snowflake |
| "Learning Spark" (O'Reilly) | Fundamentos sólidos de Spark para o bloco Databricks | Spark/Databricks |
| "Fundamentals of Data Engineering" (O'Reilly) | Base conceitual para arquiteturas de dados em escala + vocabulário de entrevista | Eng. de Dados |

### 🎓 Cursos (gratuitos, de maior custo-benefício)
- **Snowflake Hands-On Essentials** — curso oficial gratuito (na área de cursos da conta Snowflake)
- **Databricks Academy — Data Engineering with Databricks** — gratuito com certificado de conclusão
- **dbt Learn — Fundamentals + Advanced Analytics Engineering** — gratuitos
- **DeepLearning.AI (Coursera, auditável)**: *Building and Evaluating Advanced RAG* · *AI Agents in LangGraph* · *Understanding and Applying Text Embeddings* · *Finetuning LLMs* — cada um ~1–2h, altíssima qualidade
- **Microsoft Learn**: trilhas DP-203 (Data Engineering on Azure), DP-600 (Fabric), AI-102 (Azure AI) — gratuitas, com labs em sandbox

### 📺 Canais / YouTube
- **Andreas Kretz** — engenharia de dados end-to-end (arquitetura e pipelines na prática)
- **Seattle Data Guy** — dbt, analytics engineering moderno
- **Data with Marc** — dbt + Snowflake, casos práticos de entrevista
- **The AI Engineer** (podcast/canal) + **Latent Space** — estado da arte em AI Engineering

### 📄 Documentação oficial (leitura dirigida, não do início ao fim)
- Snowflake Docs: Key Concepts → Performance → Cost Management → Security
- Databricks Docs: Delta Lake, Unity Catalog, Workflows, Asset Bundles
- dbt Docs: Tests, Materializations, CI/CD (slim CI)
- OpenAI/Azure OpenAI: function calling, embeddings, structured outputs
- LangGraph / LangChain docs: agent concepts, tool calling, safety

---

## 4. Certificações Estratégicas (na ordem de ROI)

| Certificação | Custo/tempo | Impacto |
|---|---|---|
| **Azure DP-203 (Data Engineering on Azure)** | ~1–2 meses | Cobre R9 (Azure) e dá crédito de proficiência em cloud |
| **SnowPro Advanced: Architect** (ou Core primeiro) | ~2–3 semanas por prova | Cobre R2/D1 — tuning, custo, segurança |
| **Databricks Certified Data Engineer Professional** | ~2 semanas | Cobre R3/D2 — Delta, Unity Catalog, produtização |
| **dbt Analytics Engineering Certification** | ~1 semana | Cobre R6 + governança |
| **Microsoft AI-102 (Azure AI Engineer)** | ~1 mês | Cobre R10 + Azure OpenAI na prática |

> Estratégia: se tiver pouco tempo, priorize **DP-203 + AI-102** (Azure vale para os dois lados da vaga) e deixe SnowPro/Databricks como plano B. Certificações **contam pontos no ATS** e ajudam a mitigar gaps.

---

## 5. Projeto-Âncora Recomendado (evidência nº 1 da candidatura)

> Nada fala mais alto que um projeto **documentado e com evals**. Sugestão de artefato único que cobre os 3 pilares da vaga:

**"Data Copilot"** — chatbot que responde em linguagem natural sobre um dataset real seu:
1. **Dados**: carregue um dataset interessante (ex.: nutricional/pedidos — tema Nestlé) no Snowflake/Databricks via dbt (medallion)
2. **RAG**: documentos/contexto do negócio → chunking → embeddings → vector store
3. **Agente**: LangGraph com 2 tools — (a) SQL executor read-only com guardrails e (b) busca vetorial; RBAC simulado
4. **LLMOps**: tracing (Langfuse) + evals (faithfulness, relevância) + controle de custo (modelo pequeno para rotas simples)
5. **Governança**: lineage do dbt, masking de PII, documentação

**Por que funciona**: é a vaga inteira em um único case — dados em escala + IA confiável + governança. Você pode apresentar o repo na entrevista e através dele responder QUALQUER pergunta dos blocos técnicos.

---

## 6. Checklists de Domínio (marque à medida que avança)

### Snowflake
- [ ] Micro-partitions e pruning (por que a query lê menos)
- [ ] Clustering keys (quando usar, custo, auto-clustering)
- [ ] Warehouse sizing, auto-suspend/resume, multi-cluster
- [ ] Query cache e result cache
- [ ] Time Travel + UNDROP
- [ ] Zero-Copy Cloning (dev/test)
- [ ] Resource Monitors (créditos, alertas, suspensão)
- [ ] Materialized Views (quando usar)
- [ ] Data Sharing (reader accounts, secure views)
- [ ] RBAC + Dynamic Data Masking + External Tokenization
- [ ] Modelagem star/snowflake + medallion

### Databricks / Spark
- [ ] Leitura de dados de ADLS Gen2/abfss
- [ ] Transformações com DataFrame API
- [ ] Broadcast joins e particionamento (evitar shuffle)
- [ ] Delta Lake: ACID, time travel, OPTIMIZE, Z-ORDER, VACUUM, MERGE (CDC)
- [ ] Unity Catalog: catálogos/esquemas, grants, lineage, data quality
- [ ] Workflows: jobs, retries, alertas, parâmetros
- [ ] Asset Bundles (IaC de pipeline)

### dbt / CI-CD / Governança
- [ ] models, sources, ref, seeds, macros
- [ ] materializações (table, view, incremental, ephemeral)
- [ ] testes generic (unique, not_null, relationships, accepted_values) + singular
- [ ] dbt docs + lineage
- [ ] Slim CI (`--select state:modified`) em GitHub Actions/Azure DevOps
- [ ] Data contracts, data quality monitors, observabilidade (logs/alertas)
- [ ] DevSecOps: secret scanning, SAST, menor privilégio

### Azure
- [ ] ADLS Gen2 (hierarchical namespace, ACLs, RBAC)
- [ ] ADF (linked services, parametrização, triggers) — comparado a Airflow/Workflows
- [ ] Azure Functions (HTTP/Blob/Queue triggers)
- [ ] Key Vault (segredos), Entra ID (service principals)
- [ ] Azure OpenAI (deploy, quotas, embeddings)
- [ ] Azure AI Search (indexação, hybrid search, RAG)

### AI Engineering / LLMOps
- [ ] OpenAI/Azure OpenAI API: chat, completions, function calling, parâmetros (temperatura, max tokens)
- [ ] Embeddings: modelos, dimensionalidade, custo
- [ ] RAG: ingestão → chunking (estratégias, overlap) → indexação → retrieval (hybrid + re-ranking) → geração
- [ ] Evals: faithfulness, answer relevancy, context precision, hit rate, MRR
- [ ] Agentes: loop agente, tool calling, ReAct, plan-and-execute, LangGraph
- [ ] Segurança de agentes: prompt injection, RBAC por tool, guardrails, rate limits, PII
- [ ] Observabilidade: tracing (Langfuse/LangSmith), custo por execução, métricas
- [ ] Custo: cache de prompts, roteamento por complexidade, batch, quotas
- [ ] Seleção de modelo: latência × qualidade × custo

---

## 7. Plano de 1º Passo (comece AGORA — próximas 72h)

1. **Hoje**: responder o mini-questionário abaixo para eu personalizar a ordem dos módulos.
2. **Amanhã**: criar conta **Snowflake trial** + rodar o primeiro lab de clustering/EXPLAIN.
3. **Dia 2–3**: iniciar **"Building and Evaluating Advanced RAG"** (DeepLearning.AI) e abrir o livro da Chip Huyen no capítulo de RAG.

---

> 💡 **Para personalizar o plano**, me diga: por área (Snowflake, Databricks, dbt, Python, LLM/RAG/agentes, Azure) seu nível atual é 🔵/🟢/🟠? Quantas horas por semana consegue estudar? Tem data limite da entrevista?