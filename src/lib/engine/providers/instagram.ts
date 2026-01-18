export async function sendInstagramMessage(userId: string, contactId: string, message: string) {
    console.log(`[Instagram Provider] Mock sending to contact ${contactId}: "${message}"`);
    // Mock success
    return { success: true, messageId: 'mock_msg_' + Date.now() };
}

export async function sendInstagramCards(userId: string, contactId: string, cards: any[]) {
    console.log(`[Instagram Provider] Mock sending cards to contact ${contactId}`, cards);
    return { success: true };
}
