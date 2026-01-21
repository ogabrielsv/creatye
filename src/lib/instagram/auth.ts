import crypto from "crypto";

function base64url(input: Buffer | string) {
    return Buffer.from(input).toString("base64url");
}

export function createSignedState(payload: any, secret: string) {
    const body = base64url(JSON.stringify(payload));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

export function verifySignedState(state: string, secret: string) {
    const parts = state.split(".");
    if (parts.length !== 2) throw new Error("Formato de estado inválido");

    const [body, sig] = parts;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");

    // Constant time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(sig);
    const expectedBuffer = Buffer.from(expected);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        throw new Error("Assinatura de estado inválida");
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Date.now() > payload.exp) throw new Error("Sessão expirada");

    return payload;
}
