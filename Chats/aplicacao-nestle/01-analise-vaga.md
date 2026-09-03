# 📋 Análise da Vaga — Data Engineer Coordinator (AI Engineering) — Nestlé

## 1. Leitura Rápida do Perfil

| Dimensão | O que a vaga pede |
|---|---|
| **Cargo** | Data Engineer Coordinator (AI Engineering) |
| **Empresa** | Nestlé — uma das maiores empresas de bens de consumo do mundo, com forte investimento em dados, analytics e IA generativa em escala global |
| **Nível** | Coordenador / Referência técnica — liderança técnica de squad, sem necessariamente gestão direta de pessoas, mas com **mentoria**, **revisões técnicas** e **liderança de iniciativas** |
| **Foco central** | Ponta a ponta: pipelines de dados clássicos (Snowflake/Databricks) **+** AI Engineering (RAG, agentes de IA, LLMs, LLMOps) |
| **Ambiente cloud** | Azure (Azure Data Factory, Data Lake Gen2, Functions) ou cloud equivalente |
| **Natureza** | Posição híbrida rara: **Data Engineering + AI Engineering**. Quem domina os dois lados tem diferencial forte |

---

## 2. Mapa das Responsabilidades (o que você vai FAZER)

### Bloco A — AI Engineering (o diferencial da vaga)
1. **Arquitetura de Agentes de IA** — desenhar e implementar soluções agentivas corporativas: orquestração de LLMs, fluxos de raciocínio, ferramentas externas (tool calling), integração com APIs e dados internos.
2. **RAG (Retrieval-Augmented Generation)** — pipelines de indexação, recuperação e enriquecimento de contexto; reduzir alucinações e aumentar acurácia.
3. **Integração de ferramentas e conectores** — agentes consultando bases de conhecimento, sistemas analíticos e corporativos, com **autenticação e controle de acesso rigorosos**.
4. **Produtização e LLMOps** — observabilidade, custo de inferência, seleção de LLM por contexto, segurança em cloud.

### Bloco B — Engenharia de Dados Clássica
5. Desenvolver e otimizar **pipelines de dados escaláveis, seguros e de alta performance**.
6. Liderar tecnicamente com **Snowflake**, **Databricks** e plataformas cloud.
7. Boas práticas de **desenvolvimento, testes, observabilidade e automação**.
8. **Modelagem de dados** e soluções analíticas **reutilizáveis e sustentáveis**.
9. Otimização de **performance, eficiência operacional e custos**.

### Bloco C — Liderança & Governança
10. Revisões técnicas e **capacitação de engenheiros menos experientes**.
11. Aderência a **segurança, governança e qualidade de dados**.
12. Parceria com **negócio, analytics e tecnologia**.

> 💡 **Insight-chave:** o ponto central da vaga não é só "construir pipeline"; é **produtizar IA confiável** (agentes + RAG) em cima de uma plataforma de dados corporativa madura. Toda história de entrevista deve conectar: **dados → contexto → IA → valor de negócio com governança**.

---

## 3. Mapa dos Requisitos (o que a vaga pede × como provar)

| # | Requisito | Nível | Como demonstrar na candidatura |
|---|---|---|---|
| R1 | Engenharia de Dados em escala | Obrigatório | Métricas de volume (TB/pb), SLA, e tempo de processamento; arquiteturas medallion/bronze-silver-gold |
| R2 | Snowflake avançado | Obrigatório | Modelagem (star, snowflake, VWT), performance tuning, clustering, custo (resource monitors), segurança (RBAC, PII), time travel, zero-copy clone, data sharing |
| R3 | Databricks + cloud moderno | Obrigatório | Spark/DELTA, Unity Catalog, Workflows, Asset Bundles, autoscaling, orquestração |
| R4 | SQL avançado | Obrigatório | CTEs, window functions, otimização de plano, janelas, pivot |
| R5 | Python | Obrigatório | ETL/ELT, automação, integração, pandas/pyspark, consumo de APIs/LLMs |
| R6 | dbt (ou equivalente) | Obrigatório | Modelagem versionada, testes de dados, docs, jinja/macros, materializações |
| R7 | CI/CD, versionamento, deploy automatizado | Obrigatório | GitHub Actions, Azure DevOps, dbt cloud CI, testes automatizados, blue/green |
| R8 | Governança, catálogo e qualidade | Obrigatório | Unity Catalog / Snowflake governance, lineage, data contracts, dbt tests, observabilidade |
| R9 | Azure ou cloud equivalente | Obrigatório | ADF, ADLS Gen2, Functions, Key Vault, Entra ID, monitoramento |
| R10 | AI Engineering: APIs de IA, RAG, agentes | Obrigatório | Projetos com LLM APIs (OpenAI/Azure OpenAI), embeddings, vector DB, agentes com tool calling |
| D1 | Snowflake avançado (clustering, MV, time travel, zero-copy, resource monitoring, sharing) | Desejável | Mesmo de R2 + exemplos práticos de economia de custo |
| D2 | Databricks (Spark, Delta, Unity, Workflows, Bundles) | Desejável | Mesmo de R3 + exemplos de produtização |
| D3 | ADF, ADLS Gen2, Azure Functions, integração | Desejável | Pipelines end-to-end com orquestração |
| D4 | GitHub, Azure DevOps, DevSecOps | Desejável | Pipelines com secret scanning, IaC (Terraform/Bicep) |
| D5 | Data Catalog, Lineage, Observabilidade, Metadata | Desejável | DataHub/OpenMetadata, dbt docs, logs estruturados, alertas |
| D6 | Frameworks de AI Eng, LLMOps, Agentic AI | Desejável | LangChain/LlamaIndex, prompt engineering, eval, tracing, cost tracking |

**Fatores de desempate prováveis:**
- Experiência **real** em produção com agentes de IA (não só POC).
- Estratégias de **avaliação de RAG** (evals, métricas de acurácia, redução de alucinação).
- Controle de **custo de inferência** e **seleção de modelo**.
- Capacidade de **liderança técnica/mentoria** com exemplos concretos.

---

## 4. Estratégia Global de Candidatura

1. **Currículo orientado a impacto**: verbo + ação + métrica (ex.: "Reduzi custo de consulta no Snowflake em 40% via clustering e resource monitors").
2. **Carta de apresentação**: 3 parágrafos que conectam ① engenharia de dados em escala ② AI Engineering (RAG + agentes) ③ liderança técnica/mentoria — sempre ancorado em valor de negócio e governança.
3. **Portfólio/evidências** (se tiver): repositórios públicos, artigos, talks, projetos de RAG/agentes documentados.
4. **Preparação para entrevistas** (ver `04-plano-entrevistas.md`): sistema de design de agentes, RAG end-to-end, Snowflake tuning, Databricks/Delta, LLMOps.

---

## 5. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Pouca experiência formal em IA generativa | Posicionar o que já construiu (inclusive POCs) como "projetos em produção/homologação"; enfatizar fundamentos (embeddings, retrieval, LLM APIs) |
| Gap em Databricks/Snowflake específico | Focar nos pontos fortes reais e demonstrar aprendizado acelerado (certificações, cursos, labs próprios) |
| Falta de métricas quantificadas | Em entrevista, usar método STAR; mesmo números aproximados com "em torno de X%" valem mais que nada |
| Concorrência com perfil senior | Enfatizar a palavra **Coordinator**: liderança, mentoria, padronização e boas práticas — não só execução |

---

## 6. Palavras-chave para ATS (salvar no currículo)

`Snowflake` · `Databricks` · `Spark` · `Delta Lake` · `Azure` · `Azure Data Factory` · `ADLS Gen2` · `Azure Functions` · `SQL` · `Python` · `dbt` · `Airflow` · `CI/CD` · `GitHub Actions` · `Azure DevOps` · `Data Governance` · `Data Quality` · `Data Catalog` · `Data Lineage` · `Observabilidade` · `RAG` · `Retrieval-Augmented Generation` · `LLM` · `Agentes de IA` · `LLMOps` · `OpenAI` · `Azure OpenAI` · `Embeddings` · `Vector Database` · `LangChain` · `LlamaIndex` · `UNITY CATALOG` (sic, caso esteja na descrição) · `Time Travel` · `Zero-Copy Cloning` · `Resource Monitoring` · `Data Sharing` · `Materialized Views` · `Clustering` · `Terraform` · `Bicep` · `Medallion` · `ELT` · `ETL`

> ⚠️ Use as palavras-chave **exatamente** como aparecem na descrição da vaga (ex.: "Retrieval-Augmented Generation" por extenso) para maximizar compatibilidade com ATS.