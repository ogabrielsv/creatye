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
 * Returns server-side environment variables.
 * Safe to call inside handlers. Not safe at top-level if envs are missing during build.
 */
export const getServerEnv = () => ({
    NEXT_PUBLIC_SUPABASE_URL: getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    CRON_SECRET: process.env.CRON_SECRET,
    // Add OAuth vars here if needed by consumers of getServerEnv, 
    // though consumers should prefer direct getEnv call or specific exports.
    INSTAGRAM_CLIENT_ID: getEnv('INSTAGRAM_CLIENT_ID'),
    INSTAGRAM_CLIENT_SECRET: getEnv('INSTAGRAM_CLIENT_SECRET'),
    INSTAGRAM_REDIRECT_URI: getEnv('INSTAGRAM_REDIRECT_URI'),
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: getEnv('INSTAGRAM_WEBHOOK_VERIFY_TOKEN'),
    AUTH_STATE_SECRET: getEnv('AUTH_STATE_SECRET'),
});

export function getAppUrl(): string {
    const raw = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return raw.trim().replace(/\/$/, "");
}
