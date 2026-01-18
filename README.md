
# Creatye - Automation Console

## Visão Geral
Plataforma de automação para Instagram baseada em Next.js (App Router) e Supabase.

## Como Rodar Localmente

1. **Pré-requisitos**:
   - Node.js 18+
   - Conta no Supabase
   - Conta Meta Developer (para Instagram API)

2. **Instalação**:
   ```bash
   npm install
   ```

3. **Configuração de Ambiente**:
   - Copie `.env.example` para `.env.local`
   - Preencha as variáveis do Supabase (URL e Anon Key)

4. **Banco de Dados**:
   - Rode as migrations SQL na pasta `supabase/migrations` via Dashboard do Supabase ou CLI.
   - Certifique-se de que a migration `20260120_ig_connection.sql` foi aplicada.

5. **Executar**:
   ```bash
   npm run dev
   ```
   Acesse http://localhost:3000

## Configuração Supabase Auth (Google)

1. No painel do Supabase, vá em **Authentication -> Providers**.
2. Ative **Google**.
3. Adicione o Client ID e Secret obtidos no Google Cloud Console.
4. Em **URL Configuration**, adicione `http://localhost:3000/auth/callback` (e a URL de produção depois).

## Configuração Meta (Instagram)

1. Crie um App no [Meta Developers](https://developers.facebook.com/).
2. Adicione o produto **Instagram Graph API**.
3. Em **App Settings -> Basic**, pegue o `App ID` e `App Secret`.
4. Configure as variáveis `META_APP_ID` e `META_APP_SECRET` no `.env.local`.
5. Adicione `http://localhost:3000/api/meta/callback` em **Facebook Login -> Settings -> Valid OAuth Redirect URIs**.
6. Para Webhooks: configure a URL `https://seu-dominio.vercel.app/api/webhook/meta` e o Verify Token igual ao do `.env`.

## Deploy na Vercel

1. Importe o projeto do GitHub.
2. Configure as Environment Variables na Vercel (copie do `.env.local` de produção).
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_WEBHOOK_VERIFY_TOKEN`
3. O deploy deve ocorrer automaticamente.

## Stack
- Framework: Next.js 14 (App Router)
- CSS: TailwindCSS + Lucide Icons
- DB/Auth: Supabase
- Deploy: Vercel
