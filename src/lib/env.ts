export class EnvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EnvError';
    }
}

// Runtime validator - call this INSIDE handlers
export function getEnv(key: string): string {
    const val = process.env[key];
    if (!val || !val.trim()) {
        throw new EnvError(`Variável de ambiente obrigatória ausente ou vazia: ${key}`);
    }
    return val.trim();
}

/**
 * Returns server-side environment variables as an object.
 * Safe to call inside handlers. Not safe at top-level.
 */
export const getServerEnv = () => ({
    NEXT_PUBLIC_SUPABASE_URL: getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    CRON_SECRET: getEnv('CRON_SECRET'),
    INSTAGRAM_CLIENT_ID: getEnv('INSTAGRAM_CLIENT_ID'),
    INSTAGRAM_CLIENT_SECRET: getEnv('INSTAGRAM_CLIENT_SECRET'),
    INSTAGRAM_REDIRECT_URI: getEnv('INSTAGRAM_REDIRECT_URI'),
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '', // Optional? Prompts says "se houver". 
    AUTH_STATE_SECRET: getEnv('AUTH_STATE_SECRET'),
    APP_URL: getAppUrl()
});

export function getAppUrl(): string {
    const raw = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return raw.trim().replace(/\/$/, "");
}
