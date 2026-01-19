
export async function sendInstagramDM(accessToken: string, recipientId: string, content: string | any) {
    try {
        const url = `https://graph.instagram.com/v19.0/me/messages?access_token=${accessToken}`;

        let messagePayload;
        if (typeof content === 'string') {
            messagePayload = { text: content };
        } else {
            // It's already a structured payload (attachment, template, etc.)
            messagePayload = content;
        }

        const payload = {
            recipient: {
                id: recipientId
            },
            message: messagePayload
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
            console.error('IG API Error:', JSON.stringify(data.error));
            throw new Error(data.error.message || JSON.stringify(data.error));
        }

        return data;
    } catch (error: any) {
        console.error('Error sending Instagram DM:', error);
        throw error;
    }
}
