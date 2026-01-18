
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Create Automation
        const { data: automation, error: autoError } = await supabase
            .from('automations')
            .insert({
                name: 'Teste - OI',
                description: 'Automação de teste criada via seed',
                user_id: user.id,
                status: 'published',
                type: 'dm',
                channels: ['dm']
            })
            .select()
            .single();

        if (autoError) throw autoError;

        // 2. Create Trigger (Keyword "oi")
        const { error: trigError } = await supabase
            .from('automation_triggers')
            .insert({
                automation_id: automation.id,
                user_id: user.id,
                kind: 'keyword',
                keyword_text: 'oi',
                match_mode: 'contains',
                case_insensitive: true
            });

        if (trigError) throw trigError;

        // 3. Create Action (Send Link)
        const { error: actError } = await supabase
            .from('automation_actions')
            .insert({
                automation_id: automation.id,
                user_id: user.id,
                kind: 'send_dm',
                message_text: 'link do sorteio: https://google.com'
            });

        if (actError) throw actError;

        return NextResponse.json({
            success: true,
            automation_id: automation.id,
            message: 'Authomation seeded successfully. Send "oi" to your Instagram DM to test.'
        });

    } catch (err: any) {
        console.error('Seed error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
