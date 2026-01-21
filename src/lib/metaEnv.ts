export class MetaConfigError extends Error {
    constructor(public message: string) {
        super(message);
        this.name = 'MetaConfigError';
    }
}

export function getMetaEnvOrThrow() {
    const appId = (process.env.META_APP_ID || '').trim();
    const appSecret = (process.env.META_APP_SECRET || '').trim();
    const redirectUri = (process.env.META_REDIRECT_URI || '').trim();

    // Validate App ID (numeric, usually 15-16 digits)
    if (!appId || !/^\d{10,}$/.test(appId)) {
        throw new MetaConfigError('Configuração inválida: META_APP_ID deve conter apenas números e ter pelo menos 10 dígitos.');
    }

    // Validate App Secret (32 char hex)
    if (!appSecret || !/^[a-f0-9]{32}$/i.test(appSecret)) {
        throw new MetaConfigError('Configuração inválida: META_APP_SECRET deve ser uma string hexadecimal de 32 caracteres.');
    }

    // Validate Redirect URI (must be strict HTTPS and exact callback path)
    if (!redirectUri || !redirectUri.startsWith('https://') || !redirectUri.includes('/api/meta/callback')) {
        throw new MetaConfigError(
            `Configuração inválida: META_REDIRECT_URI deve iniciar com "https://" e apontar para /api/meta/callback. Valor atual: ${redirectUri || 'vazio'}`
        );
    }

    return {
        appId,
        appSecret,
        redirectUri
    };
}
