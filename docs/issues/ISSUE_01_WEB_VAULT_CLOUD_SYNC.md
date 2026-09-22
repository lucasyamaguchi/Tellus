# 🌐 Issue #01: Web Vault & Sincronização em Nuvem (Tellus Notes Cloud)

## 📌 Contexto & Objetivo
Permitir que o usuário acesse, leia, escreva e organize suas anotações do cofre em qualquer lugar (celular, tablet ou outro computador) através de um navegador web, mantendo a soberania dos dados em `E:\Die-Sonne\Vault` e sem risco de vazamento de credenciais (GitSafe nativo).

---

## 🏗️ Alternativas Técnicas

### Alternativa A: PWA Web com Cloudflare R2 / S3 Buffer (Recomendada para PC desligado)
* **Como funciona**:
  * Uma instância web leve (Vercel / Cloudflare Pages / Fly.io) serve a interface do Tellus Notes (PWA).
  * As notas são armazenadas em um bucket S3/R2 privado criptografado (gratuito até 10GB no Cloudflare R2).
  * No celular, o usuário adiciona o Tellus Notes à tela inicial como PWA, podendo escrever offline ou online.
  * **Sincronização com o PC**:
    * Ao abrir o Tellus Desktop, um job de sincronização bidirecional compara os timestamps (ETags) entre `E:\Die-Sonne\Vault` e o R2, aplicando as alterações pendentes e criando backups em `.backups/`.

### Alternativa B: Acesso Remoto Direto via Tailscale / Cloudflare Tunnel (Zero Infraestrutura)
* **Como funciona**:
  * Quando o PC está ligado, o servidor local do Tellus (`localhost:3001`) é exposto com um túnel criptografado ponto-a-ponto com domínio privado (ex: `notes.tellus.me`).
  * Autenticação segura por chave de sessão ou Google OAuth.
  * **Vantagem**: Zero custo de servidor, dados nunca saem do HD do computador, resposta imediata.
  * **Limitação**: O computador precisa estar ligado para acessar.

---

## 📋 Tarefas de Implementação
- [ ] Definir camada de autenticação para acesso web (Single User Token / Google Auth).
- [ ] Criar adaptador de armazenamento abstrato (`IVaultStorage`) que suporte tanto sistema de arquivos local (`fs`) quanto provedor de nuvem (R2 / S3 / Supabase).
- [ ] Implementar motor de sincronização incremental com resolução de conflitos por timestamp e backups preventivos.
- [ ] Proteger todas as transações com o `PrivacySanitizer` (GitSafe).
