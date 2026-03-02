const moment = require('moment');

/**
 * Logic to detect payment promises in text
 */
const IntentService = {
    /**
     * Parse text to find "payment promises" (e.g., "pago a las 5pm")
     * @param {string} text 
     * @returns {{isPromise: boolean, date: string|null}}
     */
    parsePaymentPromise(text) {
        text = text.toLowerCase();

        // Simple regex for "a las XX"
        const timeRegex = /a\s*las\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|pm\.)?/i;
        const match = text.match(timeRegex);

        if (match) {
            let hour = parseInt(match[1]);
            const minutes = match[2] ? parseInt(match[2]) : 0;
            const ampm = match[3];

            if (ampm && (ampm.includes('pm')) && hour < 12) {
                hour += 12;
            } else if (ampm && ampm.includes('am') && hour === 12) {
                hour = 0;
            }

            const promiseTime = moment().set({
                hour: hour,
                minute: minutes,
                second: 0
            });

            // If the time already passed today, assume it's for tomorrow or just handle it
            if (promiseTime.isBefore(moment())) {
                // Option: promiseTime.add(1, 'day');
                // But usually if they say "at 5" they mean today.
            }

            return {
                isPromise: true,
                date: promiseTime.format('YYYY-MM-DD HH:mm:ss')
            };
        }

        return { isPromise: false, date: null };
    },

    async handleClientMessage(db, clientId, text, EvolutionService) {
        const promise = this.parsePaymentPromise(text);

        if (promise.isPromise) {
            // Update the payment record with the new reminder time
            await db.run(
                'UPDATE payments SET next_reminder_at = ? WHERE client_id = ? AND status = "pendiente"',
                [promise.date, clientId]
            );

            const responseMsg = `Entendido. He programado tu recordatorio para las ${moment(promise.date).format('HH:mm')}. ¡Gracias!`;
            await EvolutionService.sendMessage(clientId, responseMsg); // Note: Simplified, needs actual number

            return true;
        }
        return false;
    }
};

module.exports = IntentService;
