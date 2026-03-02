const axios = require('axios');
const cron = require('node-cron');
const moment = require('moment');

const EvolutionService = {
    /**
     * Send WhatsApp message via Evolution API
     */
    async sendMessage(number, text) {
        try {
            const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
            const response = await axios.post(url, {
                number: number,
                text: text,
                delay: 1200,
                linkPreview: false
            }, {
                headers: {
                    'apikey': process.env.EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error sending message:', error.response?.data || error.message);
            return null;
        }
    }
};

/**
 * Scheduler Service to handle reminders and payment coordination
 */
const SchedulerService = {
    init(db) {
        // Run every minute to check for items to remind
        cron.schedule('* * * * *', async () => {
            console.log('Checking for pending reminders...');
            const now = moment().format('YYYY-MM-DD HH:mm:ss');

            const pendingReminders = await db.all(
                'SELECT p.*, c.whatsapp_number, c.name FROM payments p JOIN clients c ON p.client_id = c.id WHERE p.status = "pendiente" AND p.next_reminder_at <= ?',
                [now]
            );

            for (const payment of pendingReminders) {
                console.log(`Sending reminder to ${payment.name} (${payment.whatsapp_number})`);

                const message = `Hola ${payment.name}, te recordamos que tienes un pago pendiente por S/ ${payment.amount}. Por favor, envía tu comprobante o confírmanos a qué hora podrás realizarlo.`;

                const sent = await EvolutionService.sendMessage(payment.whatsapp_number, message);

                if (sent) {
                    // Update next reminder for 1 hour later
                    const nextReminder = moment().add(process.env.REMINDER_INTERVAL_HOURS || 1, 'hours').format('YYYY-MM-DD HH:mm:ss');
                    await db.run(
                        'UPDATE payments SET next_reminder_at = ?, reminder_count = reminder_count + 1 WHERE id = ?',
                        [nextReminder, payment.id]
                    );

                    await db.run(
                        'INSERT INTO conversations (client_id, message_from, content) VALUES (?, "bot", ?)',
                        [payment.client_id, message]
                    );
                }
            }
        });
    }
};

module.exports = { EvolutionService, SchedulerService };
