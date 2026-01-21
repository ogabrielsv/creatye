export class EnvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EnvError';
    }
}

function getRequiredEnv(key: string): string {
    const val = process.env[key];
    if (!val || !val.trim()) {
        throw new EnvError(`Variável de ambiente obrigatória ausente ou vazia: ${key}`);
    }
    return val.trim();
}

// 1. Normalized APP_URL
const RAW_APP_URL = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
export const APP_URL = RAW_APP_URL.trim().replace(/\/$/, ""); // Remove trailing slash

// 2. Strict Instagram Credentials
// We remove INSTAGRAM_APP_ID usage as requested. Only INSTAGRAM_CLIENT_ID / SECRET.
export const IG_CLIENT_ID = getRequiredEnv("INSTAGRAM_CLIENT_ID");
export const IG_CLIENT_SECRET = getRequiredEnv("INSTAGRAM_CLIENT_SECRET");
export const AUTH_STATE_SECRET = getRequiredEnv("AUTH_STATE_SECRET");
export const CRON_SECRET = process.env.CRON_SECRET;

// 3. Centralized Redirect URI Logic
export function getInstagramRedirectUri(): string {
    let uri = process.env.INSTAGRAM_REDIRECT_URI;

    // Fallback if empty
    if (!uri || !uri.trim()) {
        uri = `${APP_URL}/api/auth/instagram/callback`;
    }

    uri = uri.trim();

    if (!uri.startsWith("https://") && !uri.startsWith("http://")) {
        throw new EnvError(`INSTAGRAM_REDIRECT_URI deve ser absoluta (começar com http:// ou https://). Valor atual: ${uri}`);
    }

    return uri;
}

export const IG_REDIRECT_URI = getInstagramRedirectUri();

export function validateInstagramEnv() {
    // Just accessing the exports will trigger the throws if missing (due to top-level calls for consts),
    // but we can re-check here for runtime safety or specific logging.
    if (!IG_CLIENT_ID) throw new EnvError("INSTAGRAM_CLIENT_ID ausente");
    if (!IG_CLIENT_SECRET) throw new EnvError("INSTAGRAM_CLIENT_SECRET ausente");
    if (!IG_REDIRECT_URI) throw new EnvError("INSTAGRAM_REDIRECT_URI ausente");
}

export function getServerEnv() {
    return {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        INSTAGRAM_CLIENT_ID: IG_CLIENT_ID,
        INSTAGRAM_CLIENT_SECRET: IG_CLIENT_SECRET,
        INSTAGRAM_REDIRECT_URI: IG_REDIRECT_URI,
        AUTH_STATE_SECRET: AUTH_STATE_SECRET,
        CRON_SECRET: CRON_SECRET,
        APP_URL: APP_URL
    };
}
