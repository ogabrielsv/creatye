import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
        // IMPORTANTE: tem que retornar o challenge como TEXTO puro
        return new Response(challenge ?? "", { status: 200 });
    }

    return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
}

export async function POST(req: Request) {
    const body = await req.json();
    // aqui você processa os eventos e salva logs etc
    return NextResponse.json({ ok: true });
}
