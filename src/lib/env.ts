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
        META_APP_ID: process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID, // fallback
        META_APP_SECRET: process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET, // fallback
        META_REDIRECT_URI: process.env.META_REDIRECT_URI,
        META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
    };

    const missing = Object.entries(vars)
        .filter(([_, val]) => !val)
        .map(([key]) => key);

    if (missing.length > 0) {
        console.error('[ENV_ERROR] Missing variables:', missing.join(', '));
        throw new EnvError(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);
    }

    return vars as Record<keyof typeof vars, string>;
}

export function getClientEnv() {
    const vars = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };

    const missing = Object.entries(vars)
        .filter(([_, val]) => !val)
        .map(([key]) => key);

    if (missing.length > 0) {
        console.error('[ENV_ERROR] Client variables missing:', missing.join(', '));
        // Don't throw to avoid crashing entire client bundle, but log error
    }

    return vars;
}
