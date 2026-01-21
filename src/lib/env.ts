export class EnvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EnvError';
    }
}

export function getServerEnv() {
    const vars = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        INSTAGRAM_CLIENT_ID: process.env.INSTAGRAM_CLIENT_ID || process.env.IG_BIZ_CLIENT_ID,
        INSTAGRAM_CLIENT_SECRET: process.env.INSTAGRAM_CLIENT_SECRET || process.env.IG_BIZ_CLIENT_SECRET,
        INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_REDIRECT_URI || process.env.IG_BIZ_REDIRECT_URI,
        AUTH_STATE_SECRET: process.env.AUTH_STATE_SECRET,
        CRON_SECRET: process.env.CRON_SECRET,
        APP_URL: process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    };

    const missing = Object.entries(vars)
        .filter(([_, val]) => !val)
        .map(([key]) => key);

    if (missing.length > 0) {
        // We log minimal info to avoid leaking secrets
        console.error('[ENV_ERROR] Missing required server variables:', missing.join(', '));
        // Don't throw immediately to allow safe fallback checks in routes, but log heavily
    }

    return vars as Record<keyof typeof vars, string>;
}

export function getClientEnv() {
    const vars = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    };

    const missing = Object.entries(vars)
        .filter(([_, val]) => !val)
        .map(([key]) => key);

    if (missing.length > 0) {
        console.error('[ENV_ERROR] Client variables missing:', missing.join(', '));
    }

    return vars;
}

// Single source of truth for Redirect URI
export function getInstagramRedirectUri(): string {
    const env = getServerEnv();
    const uri = env.INSTAGRAM_REDIRECT_URI;

    if (!uri) {
        // Try to construct from APP_URL
        if (env.APP_URL) {
            return `${env.APP_URL}/api/auth/instagram/callback`;
        }
        throw new EnvError("INSTAGRAM_REDIRECT_URI ausente e impossível de construir.");
    }

    if (!uri.startsWith("http")) {
        throw new EnvError(`INSTAGRAM_REDIRECT_URI deve ser absoluta (começar com http/s). Valor atual: ${uri}`);
    }

    return uri;
}
