const { OpenAI } = require('openai');
const moment = require('moment');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const AIService = {
    /**
     * Analyze message to find payment promises or general intent
     * @param {string} text 
     * @returns {Promise<{isPromise: boolean, date: string|null, response: string}>}
     */
    async analyzeMessage(text) {
        try {
            const prompt = `
                Eres un asistente de cobranza amable. Analiza el siguiente mensaje de un cliente: "${text}"
                Hoy es ${moment().format('LLLL')}.
                
                Instrucciones:
                1. Identifica si el cliente está haciendo una promesa de pago con una hora o fecha específica hoy.
                2. Si hay una promesa, extrae la fecha y hora en formato YYYY-MM-DD HH:mm:ss.
                3. Genera una respuesta corta y amable confirmando que has recibido el mensaje y, si aplica, que has programado el recordatorio.
                
                Responde ÚNICAMENTE en formato JSON:
                {
                    "isPromise": boolean,
                    "date": "YYYY-MM-DD HH:mm:ss" o null,
                    "response": "tu respuesta al cliente"
                }
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(completion.choices[0].message.content);
            return result;
        } catch (error) {
            console.error('AI Service Error:', error);
            return { isPromise: false, date: null, response: "Gracias por tu mensaje. Lo revisaremos pronto." };
        }
    }
};

module.exports = AIService;
