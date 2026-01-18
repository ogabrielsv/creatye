
export async function sendInstagramDM(accessToken: string, recipientId: string, text: string) {
    try {
        const url = `https://graph.instagram.com/v19.0/me/messages?access_token=${accessToken}`;

        const payload = {
            recipient: {
                id: recipientId
            },
            message: {
                text: text
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.error) {
            throw new Error(data.error.message || JSON.stringify(data.error));
        }

        return data;
    } catch (error: any) {
        console.error('Error sending Instagram DM:', error);
        throw error;
    }
}
