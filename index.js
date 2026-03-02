const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const { EvolutionService, SchedulerService } = require('./src/services/scheduler');
const OCRService = require('./src/services/ocr');
const IntentService = require('./src/services/intent');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const dbPath = path.resolve(__dirname, process.env.DATABASE_PATH || './database/database.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

let db;

(async () => {
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    console.log('Connected to the SQLite database.');

    // Initialize Scheduler
    SchedulerService.init(db);
})();

// Webhook for Evolution API
app.post('/webhook/evolution', async (req, res) => {
    try {
        const payload = req.body;
        const event = payload.event;
        const data = payload.data;

        if (event === 'MESSAGES_UPSERT') {
            const message = data.message;
            const remoteJid = data.key.remoteJid;
            const fromMe = data.key.fromMe;
            const messageType = data.messageType;
            const whatsappNumber = remoteJid.split('@')[0];

            if (fromMe) return res.sendStatus(200);

            // 1. Get Client
            let client = await db.get('SELECT * FROM clients WHERE whatsapp_number = ?', [whatsappNumber]);
            if (!client) {
                console.log(`Msg from unknown: ${whatsappNumber}`);
                return res.sendStatus(200);
            }

            // 2. Log & Process Logic
            let textContent = '';
            if (messageType === 'conversation') {
                textContent = message.conversation;
            } else if (messageType === 'extendedTextMessage') {
                textContent = message.extendedTextMessage.text;
            } else if (messageType === 'imageMessage') {
                textContent = '[Imagen Recibida]';

                // OCR Processing
                // Evolution API sends base64 or a URL depending on config. 
                // Let's assume URL for this demo/logic.
                const imageUrl = data.message.imageMessage.url; // Placeholder logic

                console.log('Processing OCR for client:', client.name);
                const ocrResult = await OCRService.processPaymentScreenshot(imageUrl);

                if (ocrResult.success) {
                    console.log(`OCR Match: S/ ${ocrResult.amount}, Op: ${ocrResult.operationNumber}`);

                    // Mark as paid
                    await db.run(
                        'UPDATE payments SET status = "pagado", operation_number = ?, paid_at = CURRENT_TIMESTAMP, next_reminder_at = NULL WHERE client_id = ? AND status = "pendiente"',
                        [ocrResult.operationNumber, client.id]
                    );

                    // Send Thank You
                    const thankYouMsg = `Cobro recibido con éxito, ¡gracias por su pago! (Monto: S/ ${ocrResult.amount})`;
                    await EvolutionService.sendMessage(whatsappNumber, thankYouMsg);

                    await db.run(
                        'INSERT INTO conversations (client_id, message_from, content) VALUES (?, "bot", ?)',
                        [client.id, thankYouMsg]
                    );
                }
            }

            // Save Conversation
            await db.run(
                'INSERT INTO conversations (client_id, message_from, content, message_type) VALUES (?, ?, ?, ?)',
                [client.id, 'client', textContent, messageType]
            );

            // 3. Process Intents (Promesas de pago)
            if (textContent) {
                const handledPromise = await IntentService.handleClientMessage(db, client.id, textContent, EvolutionService, whatsappNumber);
                if (handledPromise) {
                    console.log(`Promise detected for client ${client.name}`);
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error in webhook:', error);
        res.status(500).send('Webhook error');
    }
});

// Admin Route: Manual Payment Override (For Cash Payments)
app.post('/api/payments/:id/manual-pay', async (req, res) => {
    try {
        const paymentId = req.params.id;
        const payment = await db.get('SELECT p.*, c.whatsapp_number FROM payments p JOIN clients c ON p.client_id = c.id WHERE p.id = ?', [paymentId]);

        if (payment) {
            await db.run(
                'UPDATE payments SET status = "pagado", payment_method = "efectivo", paid_at = CURRENT_TIMESTAMP, next_reminder_at = NULL WHERE id = ?',
                [paymentId]
            );

            const thankYouMsg = `Cobro recibido con éxito (Pago en efectivo), ¡gracias por su pago!`;
            await EvolutionService.sendMessage(payment.whatsapp_number, thankYouMsg);

            res.send({ success: true, message: 'Pago marcado como manual con éxito' });
        } else {
            res.status(404).send('Pago no encontrado');
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Dashboard Data API
app.get('/api/dashboard/summary', async (req, res) => {
    try {
        const totalPending = await db.get('SELECT SUM(amount) as total FROM payments WHERE status = "pendiente"');
        const todayCollections = await db.get('SELECT COUNT(*) as count FROM payments WHERE DATE(paid_at) = DATE("now")');
        const payments = await db.all(`
            SELECT p.*, c.name, c.whatsapp_number, c.payment_frequency 
            FROM payments p 
            JOIN clients c ON p.client_id = c.id 
            ORDER BY status DESC, p.due_date ASC LIMIT 20
        `);
        const logs = await db.all(`
            SELECT conv.*, c.name 
            FROM conversations conv 
            LEFT JOIN clients c ON conv.client_id = c.id 
            ORDER BY conv.created_at DESC LIMIT 10
        `);

        res.json({
            totalPending: totalPending.total || 0,
            todayCollections: todayCollections.count || 0,
            payments,
            logs
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Register New Client
app.post('/api/clients', async (req, res) => {
    try {
        const { name, whatsappNumber, frequency, initialAmount } = req.body;

        // 1. Create Client
        const result = await db.run(
            'INSERT INTO clients (name, whatsapp_number, payment_frequency) VALUES (?, ?, ?)',
            [name, whatsappNumber, frequency]
        );
        const clientId = result.lastID;

        // 2. Create Initial Payment
        const dueDate = moment().format('YYYY-MM-DD HH:mm:ss');
        await db.run(
            'INSERT INTO payments (client_id, amount, due_date, status, next_reminder_at) VALUES (?, ?, ?, ?, ?)',
            [clientId, initialAmount, dueDate, 'pendiente', dueDate]
        );

        res.json({ success: true, message: 'Cliente registrado con éxito' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).send('El número de WhatsApp ya está registrado');
        }
        res.status(500).send(error.message);
    }
});

// Debug: Seed Test Data
app.get('/api/debug/seed', async (req, res) => {
    try {
        await db.run('INSERT OR IGNORE INTO clients (name, whatsapp_number, payment_frequency) VALUES (?, ?, ?)',
            ['Juan Perez', '51987654321', 'diario']);
        const client = await db.get('SELECT id FROM clients WHERE whatsapp_number = ?', ['51987654321']);

        await db.run('INSERT INTO payments (client_id, amount, due_date, status, next_reminder_at) VALUES (?, ?, ?, ?, ?)',
            [client.id, 30.00, moment().format('YYYY-MM-DD'), 'pendiente', moment().format('YYYY-MM-DD HH:mm:ss')]);

        res.send("Seed data created! Check the dashboard.");
    } catch (e) { res.status(500).send(e.message); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
