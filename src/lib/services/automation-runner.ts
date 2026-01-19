import { createAdminClient } from "@/lib/supabase/admin";

interface IncomingMessage {
    platform: "instagram";
    channel: "dm";
    senderId: string;
    recipientId: string;
    text: string;
    timestamp: number;
    rawEvent: any;
}

export async function processIncomingMessage(params: IncomingMessage) {
    const { senderId, recipientId, text, timestamp } = params;
    const supabase = createAdminClient();

    console.log(`[DM_EVENT] Processing msg from ${senderId} to ${recipientId}: "${text}"`);

    // A) Identificar conta (recipientId = instagram_business_account_id ou instagram_scoped_id?)
    // Normalmente o webhook envia o ID da página/IG ID no 'id' root do entry,
    // mas aqui estamos recebendo via params.
    // Vamos tentar achar a connection que tem esse ID.

    // Tentar achar pelo recipientId (que pode ser o ID do IG Business)
    let { data: connection, error: connErr } = await supabase
        .from('ig_connections')
        .select('*')
        .or(`instagram_business_account_id.eq.${recipientId},instagram_scoped_id.eq.${recipientId}`)
        .maybeSingle();

    // Se não achou, fallback: pega a account mais recente (modo de debug/dev apenas se desejado,
    // mas o user pediu "Se não encontrar, logar NO_ACCOUNT_MAPPING e retornar 200")
    if (!connection) {
        console.log(`[DM_EVENT] NO_ACCOUNT_MAPPING for recipient ${recipientId}`);
        // Tentar fallback se for dev (opcional), mas vamos seguir estrito
        return;
    }

    const userId = connection.user_id;
    const accessToken = connection.access_token;

    // B) Buscar automações
    const { data: automations } = await supabase
        .from('automations')
        .select(`
            id, name, published_version_id,
            automation_triggers (
                id, trigger_type, trigger_filter,
                keyword, match_mode 
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .or('channel.eq.dm,channel.is.null'); // DM channels

    if (!automations || automations.length === 0) {
        console.log(`[DM_EVENT] No active DM automations for user ${userId}`);
        return;
    }

    // C) Matching
    const cleanText = text.trim().toLowerCase();
    // Helper para remover pontuação simples se necessário, mas 'includes' resolve a maioria.
    // User pediu: "oi" casa com "oi", "oi!"
    // Regex simples para word boundary seria melhor, mas vamos de contains/equals.

    let matchedAuto: any = null;
    let matchedTrigger: any = null;

    for (const auto of automations) {
        if (!auto.automation_triggers) continue;

        for (const trig of auto.automation_triggers) {
            // Unify keyword access
            // trigger_filter jsonb usually has preference, fallback to cols
            const filter = trig.trigger_filter || {};
            const keyword = (filter.keyword || trig.keyword || '').toLowerCase().trim();
            const matchMode = (filter.match_mode || trig.match_mode || 'contains').toLowerCase();

            if (!keyword) continue;

            let isMatch = false;
            if (matchMode === 'exact' || matchMode === 'equals') {
                isMatch = cleanText === keyword;
            } else {
                // Contains
                isMatch = cleanText.includes(keyword);
            }

            if (isMatch) {
                matchedAuto = auto;
                matchedTrigger = trig;
                break;
            }
        }
        if (matchedAuto) break;
    }

    if (!matchedAuto) {
        console.log(`[DM_EVENT] [NO_MATCH] Text="${cleanText}" User=${userId}`);
        // Logar execução NO_MATCH 'automation_id' null? 
        // User pediu: "Se não houver automação válida, logar NO_MATCH e retornar 200"
        // E também: "Sempre gravar execução em automation_executions"
        // Se não tem automação ID, gravamos com automation_id NULL se o banco permitir, ou ignoramos gravacao de NO_MATCH globale
        // O user disse: "Se não encontrar, logar ... e retornar". 
        // "Gravar execução (status no_match)" -> qual automation_id?
        // Vamos gravar sem automation_id se a tabela permitir, ou não gravar se for FK not null.
        // A tabela automation_executions TEM automation_id NOT NULL geralmente? Verifiquei antes: sim, referencia automations(id).
        // Então não dá pra gravar NO_MATCH sem automation_id.
        // Vou apenas logar no console.
        return;
    }

    console.log(`[MATCH] automationId=${matchedAuto.id} trigger=${matchedTrigger.id}`);

    // D) Execução
    // 1. Log START
    const { data: exec, error: execErr } = await supabase.from('automation_executions').insert({
        automation_id: matchedAuto.id,
        user_id: userId,
        version_id: matchedAuto.published_version_id,
        status: 'running',
        payload: {
            source: 'dm',
            input: text,
            sender: senderId
        },
        updated_at: new Date().toISOString()
    }).select('id').single();

    if (execErr) {
        console.error('[EXEC_LOG] Insert failed:', execErr);
        return;
    }
    const execId = exec.id;

    // 2. Fetch Actions
    const { data: actions } = await supabase
        .from('automation_actions')
        .select('*')
        .eq('automation_id', matchedAuto.id)
        .order('created_at', { ascending: true });

    if (!actions || actions.length === 0) {
        console.log(`[MATCH] No actions found for automation ${matchedAuto.id}`);
        await supabase.from('automation_executions').update({ status: 'success', error_message: 'No actions' }).eq('id', execId);
        return;
    }

    // 3. Execute Loop
    try {
        for (const act of actions) {
            if (act.kind === 'send_dm') {
                await sendInstagramDM({
                    accessToken,
                    recipientId: senderId, // We reply TO the sender
                    text: act.message_text
                });
            } else if (act.kind === 'buttons' || act.kind === 'cards') {
                // Logic for structured msg
                // This logic is duplicated from webhook/meta logic, ideally unified msg builder.
                // Doing basic text fallback or implementing builder if needed.
                // Let's implement basic builder here for buttons.
                let content = null;
                if (act.kind === 'buttons') {
                    const buttons = (act.metadata?.buttons || []).slice(0, 3).map((b: any) =>
                        (b.type === 'link' ? { type: 'web_url', url: b.url, title: b.label } : { type: 'postback', title: b.label, payload: 'NEXT' })
                    );
                    content = { attachment: { type: "template", payload: { template_type: "button", text: act.message_text || "Opções", buttons } } };
                } else if (act.kind === 'cards') {
                    const elements = (act.metadata?.cards || []).slice(0, 10).map((c: any) => ({
                        title: c.title, subtitle: c.description, image_url: c.image,
                        buttons: (c.buttons || []).slice(0, 3).map((b: any) => (b.type === 'link' ? { type: 'web_url', url: b.url, title: b.label } : { type: 'postback', title: b.label, payload: 'N' }))
                    }));
                    content = { attachment: { type: "template", payload: { template_type: "generic", elements } } };
                }

                if (content) {
                    await sendInstagramDM({ accessToken, recipientId: senderId, content });
                }
            }
        }

        // Success
        await supabase.from('automation_executions').update({ status: 'success' }).eq('id', execId);
        console.log(`[EXEC_LOG] Success ${execId}`);

    } catch (err: any) {
        console.error(`[EXEC_ERROR] ${err.message}`);
        await supabase.from('automation_executions')
            .update({ status: 'failed', error_message: err.message })
            .eq('id', execId);
    }
}

// 3) Funcao de Envio (SERVICE)
// Agora usando axios ou fetch robusto
async function sendInstagramDM({ accessToken, recipientId, text, content }: { accessToken: string, recipientId: string, text?: string, content?: any }) {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;

    let body: any = { recipient: { id: recipientId } };
    if (content) {
        body.message = content;
    } else {
        body.message = { text: text };
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const responseBody = await res.json();

    if (!res.ok) {
        console.error("[SEND_ERROR]", { status: res.status, body: responseBody });
        throw new Error(`Graph API Info: ${JSON.stringify(responseBody)}`);
    }

    console.log("[SEND] OK", { recipientId });
    return responseBody;
}
