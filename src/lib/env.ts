export class EnvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EnvError';
    }
}

function getRequiredEnv(key: string): string {
    const val = process.env[key];
    if (!val) {
        throw new EnvError(`Missing required env var: ${key}`);
    }
    return val;
}

// Single source of truth for OAuth credentials
// We prefer INSTAGRAM_CLIENT_ID / SECRET / REDIRECT_URI
// but check META_APP_ID variants as fallback if user configured those in Vercel.
// Crucially, we export ONE final constant for each.

const RAW_CLIENT_ID = process.env.META_APP_ID || process.env.INSTAGRAM_CLIENT_ID || process.env.IG_BIZ_CLIENT_ID;
const RAW_CLIENT_SECRET = process.env.META_APP_SECRET || process.env.INSTAGRAM_CLIENT_SECRET || process.env.IG_BIZ_CLIENT_SECRET;
const RAW_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || process.env.IG_BIZ_REDIRECT_URI;

export const IG_CLIENT_ID = RAW_CLIENT_ID!;
export const IG_CLIENT_SECRET = RAW_CLIENT_SECRET!;
export const IG_REDIRECT_URI = RAW_REDIRECT_URI!;
export const AUTH_STATE_SECRET = process.env.AUTH_STATE_SECRET!;
export const APP_URL = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
export const CRON_SECRET = process.env.CRON_SECRET;

// Helper to validate needed envs on startup/usage
export function validateInstagramEnv() {
    if (!IG_CLIENT_ID) throw new EnvError("Missing INSTAGRAM_CLIENT_ID (or META_APP_ID)");
    if (!IG_CLIENT_SECRET) throw new EnvError("Missing INSTAGRAM_CLIENT_SECRET (or META_APP_SECRET)");
    if (!IG_REDIRECT_URI) throw new EnvError("Missing INSTAGRAM_REDIRECT_URI");
    if (!AUTH_STATE_SECRET) throw new EnvError("Missing AUTH_STATE_SECRET");

    if (!IG_REDIRECT_URI.startsWith("http")) {
        throw new EnvError(`INSTAGRAM_REDIRECT_URI must be absolute. Got: ${IG_REDIRECT_URI}`);
    }
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
