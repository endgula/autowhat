const AIService = require('./ai');

/**
 * Logic to detect payment promises in text using AI
 */
const IntentService = {
    async handleClientMessage(db, clientId, text, EvolutionService, whatsappNumber) {
        // 1. Use AI to analyze the message
        const aiResult = await AIService.analyzeMessage(text);

        // 2. If it's a promise, update the record
        if (aiResult.isPromise && aiResult.date) {
            await db.run(
                'UPDATE payments SET next_reminder_at = ? WHERE client_id = ? AND status = "pendiente"',
                [aiResult.date, clientId]
            );
            console.log(`AI confirmed promise: ${aiResult.date} for client ${clientId}`);
        }

        // 3. Send the AI-generated response back to the client
        if (aiResult.response) {
            await EvolutionService.sendMessage(whatsappNumber, aiResult.response);

            // Log bot's conversation
            await db.run(
                'INSERT INTO conversations (client_id, message_from, content) VALUES (?, "bot", ?)',
                [clientId, aiResult.response]
            );
        }

        return aiResult.isPromise;
    }
};

module.exports = IntentService;
