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

export const getServerEnv = () => ({
    NEXT_PUBLIC_SUPABASE_URL: getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    CRON_SECRET: process.env.CRON_SECRET,
});

export function getAppUrl(): string {
    const raw = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return raw.trim().replace(/\/$/, "");
}
