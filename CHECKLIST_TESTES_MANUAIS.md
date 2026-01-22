# Checklist de Testes Manuais - Creatye Instagram Fix

Siga estes passos para validar a correção da integração com Instagram, Webhook e Automações.

## 1. Login com Instagram (Fluxo Oauth)
- [ ] Acesse `/settings?tab=integracoes`.
- [ ] Clique no botão **"Entrar com Instagram"**.
- [ ] Verifique se você foi redirecionado para `instagram.com` (não facebook.com).
- [ ] Autorize a aplicação.
- [ ] Verifique se foi redirecionado de volta para o Dashboard com sucesso.
- [ ] **Validação técnica**: Verifique no Supabase (Table Editor) se a tabela `instagram_accounts` tem um novo registro com `status='connected'` e `username` preenchido.
  - Tabela: `instagram_accounts`

## 2. Webhook (Ingestão de Eventos)
Para testar webhooks sem o Instagram enviar eventos reais, você pode simular via cURL ou Postman.

**Endpoint**: `POST /api/webhook`

**Exemplo de Payload:**
```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000000",
      "time": 1706000000,
      "messaging": [
        {
          "sender": { "id": "123456789" },
          "recipient": { "id": "17841400000000000" },
          "timestamp": 1706000000,
          "message": { "mid": "m_...", "text": "Teste de Automação" }
        }
      ]
    }
  ]
}
```

- [ ] Envie o POST acima.
- [ ] Deve retornar `200 OK` ("EVENT_RECEIVED").
- [ ] **Validação técnica**: Verifique se a tabela `webhook_events` tem uma nova linha com o payload JSON.

## 3. Automação e Cron (Processamento)
A automação roda via Cron Job ou chamada manual do endpoint.

- [ ] Tenha eventos não processados em `webhook_events`.
- [ ] Chame `GET /api/cron/run?secret=SEU_CRON_SECRET` 
      (ou use Header `Authorization: Bearer SEU_CRON_SECRET`).
- [ ] Verifique a resposta JSON. Deve conter `ran: true` e `processedEvents > 0`.
- [ ] **Validação técnica**: 
  - A linha em `webhook_events` deve ter `processed_at` preenchido.
  - A tabela `automation_logs` deve conter logs do processamento ("Processing webhook entry", "New DM received...").

## 4. Build e Deploy
- [ ] Rode `npm run build` localmente para garantir que não há erros de tipos ou env (ETAPA A).
- [ ] O deploy na Vercel deve ficar VERDE.
- [ ] Os logs da Vercel devem mostrar `[IG CONNECT]`, `[IG CALLBACK]`, `[WEBHOOK]` etc.
