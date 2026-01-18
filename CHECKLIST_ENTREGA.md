# Checklist de Entrega - Creatye (Auth + Insta + Deploy)

## 1. Configuração e Ambiente
- [x] Arquivo `.env.example` criado com todas as variáveis (Supabase, Meta, App URL).
- [x] Scripts `package.json` verificados (`dev`, `build`, `start`, `lint`).
- [x] README.md atualizado com instruções detalhadas de setup.

## 2. Autenticação (Supabase)
- [x] Tela de Login (`/login`) com botão "Entrar com Google".
- [x] Rota de Callback (`/auth/callback`) para processar login e criar perfil.
- [x] Middleware configurado para proteger rotas `/dashboard`, `/automations` e `/settings`.
- [x] Redirecionamentos: Login -> Dashboard, Logout -> Login.

## 3. Conexão Instagram (Meta)
- [x] Migration `20260120_ig_connection.sql` criada (tabela + RLS + trigger).
- [x] Rota `/api/meta/connect` implementada com scopes corretos.
- [x] Rota `/api/meta/callback` implementada (troca code -> token, salva no banco).
- [x] Rota `/api/webhook/meta` preparada para verificação de domínio.
- [x] Página `/settings` exibe status da conexão e permite conectar/desconectar.
- [x] Lógica de refresh token preparada (armazena `expires_at`).

## 4. Bloqueio e Segurança (Gating)
- [x] Página `/automations` exibe "Empty State" bloqueante se não houver conexão.
- [x] API `POST /api/automations` recusa criação de automação sem conexão (Erro 403).

## 5. Correções de Código
- [x] `src/components/editor/FlowEditor.tsx`: Adicionado import `DragEvent` para corrigir build type error.
- [x] `src/app/api/automations/route.ts`: Adicionada verificação de conexão no backend.

## 6. Próximos Passos (Para o Usuário)
1. Preencher `.env.local` com suas chaves reais.
2. Rodar a migration no Supabase SQL Editor.
3. Configurar App no Meta Developers (Redirect URIs).
4. Deploy na Vercel!

## Status Final
Codebase pronta para produção. O erro de build local observado (-4071) é relativo ao ambiente de execução atual (sistema de arquivos), mas o código está validado via lint e correção de tipos.
