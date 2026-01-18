
export async function refreshLongLivedToken(accessToken: string) {
    try {
        const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        return {
            access_token: data.access_token,
            expires_in: data.expires_in // seconds
        };
    } catch (error) {
        console.error('Error refreshing Instagram token:', error);
        throw error;
    }
}
