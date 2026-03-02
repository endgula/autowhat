const Tesseract = require('tesseract.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * OCR Service to process payment screenshots
 */
const OCRService = {
    /**
     * Extract data from a screenshot URL
     * @param {string} imageUrl 
     * @returns {Promise<{amount: number, operationNumber: string, success: boolean}>}
     */
    async processPaymentScreenshot(imageUrl) {
        try {
            console.log(`Processing image: ${imageUrl}`);

            const { data: { text } } = await Tesseract.recognize(
                imageUrl,
                'spa', // Spanish for Yape/Plin
                { logger: m => console.log(m) }
            );

            console.log('OCR Result:', text);

            // Regex for Yape/Plin patterns in Peru
            const amountRegex = /(?:S\/|S\.\/|Total|Monto|Pagaste)\s*(\d+[\.,]\d{2})/i;
            const opNumberRegex = /(?:Nro\. de operación|Operación[:\s]*)\s*(\d+)/i;

            const amountMatch = text.match(amountRegex);
            const opMatch = text.match(opNumberRegex);

            return {
                success: !!(amountMatch || opMatch),
                amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null,
                operationNumber: opMatch ? opMatch[1] : null,
                rawText: text
            };
        } catch (error) {
            console.error('OCR Error:', error);
            return { success: false, error: error.message };
        }
    }
};

module.exports = OCRService;
