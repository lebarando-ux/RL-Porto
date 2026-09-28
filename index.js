import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import multer from 'multer';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const ai = new GoogleGenAI({});
const app = express();
const upload = multer();

const DEFAULT_MODEL_TIER_SEQUENCE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash',
    'gemini-3.8-flash'
];

const MODEL_TIER_SEQUENCE = (() => {
    const configured = (process.env.GEMINI_MODEL_TIER_SEQUENCE || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    return configured.length > 0 ? configured : DEFAULT_MODEL_TIER_SEQUENCE;
})();

const PORT = process.env.PORT || 3000;

// Konfigurasi __dirname untuk ES Modules agar pembacaan folder statis aman
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// Menjadikan folder public sebagai penyedia file statis (HTML, Logo, Videos)
app.use(express.static(path.join(__dirname, 'public')));

function getGreetingReply(text) {
    const normalized = text.trim().toLowerCase().replace(/[.!?,]+$/g, '');
    const englishGreeting = /^(hi|hello|hey|howdy)( there)?$/.test(normalized)
        || /^(good morning|good afternoon|good evening)$/.test(normalized);
    const indonesianGreeting = /^(halo|hai|hei|pagi|siang|sore|malam)$/.test(normalized)
        || /^selamat (pagi|siang|sore|malam)$/.test(normalized);

    if (indonesianGreeting) {
        return 'Halo! Apa yang ingin Anda buat atau tingkatkan?';
    }
    if (englishGreeting) {
        return 'Hi! What are you looking to create or improve?';
    }
    return null;
}

function getPricingReply(text) {
    const normalized = text.toLowerCase();
    const asksAboutPricing = /\b(price|prices|pricing|cost|costs|how much|quote|quotes|rate|rates|fee|fees|budget)\b/.test(normalized)
        || /\b(harga|biaya|berapa bayar|tarif|anggaran|estimasi biaya)\b/.test(normalized);

    if (!asksAboutPricing) return null;

    const asksInIndonesian = /\b(harga|biaya|berapa bayar|tarif|anggaran|estimasi biaya)\b/.test(normalized);
    return asksInIndonesian
        ? 'Kami tidak mencantumkan harga tetap karena biaya disesuaikan dengan tujuan, format, durasi, dan ruang lingkup proyek. Untuk mendapat estimasi yang tepat, email lebarando@gmail.com dengan ide proyek, audiens, hasil yang dibutuhkan, dan timeline Anda—kami bisa membantu menentukan pendekatan yang paling sesuai.'
        : 'We don’t publish fixed prices because each estimate depends on your goals, format, length, and project scope. For a tailored quote, email lebarando@gmail.com with your idea, audience, deliverables, and timeline—we can help shape the right approach for your needs.';
}

// Endpoint Utama untuk Chatbot Portofolio
app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;

    try {
        if (!Array.isArray(conversation)) {
            throw new Error('Messages must be an array!');
        }

        let isValid = true;
        conversation.forEach(({ role, text }) => {
            if (!isValid) return;
            if (!['model', 'user'].includes(role)) isValid = false;
            if (!text || typeof text !== 'string') isValid = false;
        });

        if (!isValid) {
            return res.status(400).json({ message: "Payload tidak valid!" });
        }

        const latestMessage = conversation.at(-1);
        if (latestMessage?.role === 'user') {
            const greetingReply = getGreetingReply(latestMessage.text);
            if (greetingReply) {
                return res.status(200).json({ result: greetingReply });
            }

            const pricingReply = getPricingReply(latestMessage.text);
            if (pricingReply) {
                return res.status(200).json({ result: pricingReply });
            }
        }

        const contents = conversation.map(({ role, text }) => ({
            role,
            parts: [{ text }]
        }));

        const generationRequest = {
            contents,
            config: {
                temperature: 0.3,
                maxOutputTokens: 512,
                systemInstruction: "You are RiLey, the friendly marketing and project guide for AIM+C by RL, an AI Media Creation brand led by Principal Consultant Ryan Lebarando.\n\n" +
                    "Your goal:\n" +
                    "- Act like a thoughtful, commercially aware marketing consultant—not a terse FAQ bot or pushy salesperson.\n" +
                    "- Help visitors solve a communication or marketing need with the right video or media approach, then guide qualified interest toward starting a project.\n" +
                    "- Connect recommendations to the visitor's goal, audience, message, and constraints. Explain briefly why the suggested approach could help.\n\n" +
                    "Conversation rules:\n" +
                    "- Be warm, confident, useful, and persuasive without pressure. Give a complete answer: normally 2-4 concise sentences, using more detail when the question or solution needs it. Do not default to one-line replies or impose an arbitrary word limit.\n" +
                    "- Lead with a direct answer or recommendation, then offer a practical next step. Use short bullets when they make a multi-part answer easier to act on.\n" +
                    "- For a greeting or casual opener, greet briefly and ask one natural question about what they want to achieve.\n" +
                    "- Use the visitor's language (English or Indonesian). Never mix languages unless they do.\n" +
                    "- When a visitor describes a challenge, give a tailored solution using known AIM+C offerings: video ads, branded content, short-form stories, and animation. Suggest an appropriate format or direction and explain how it could serve their goal; do not merely repeat their request.\n" +
                    "- Ask at most one focused discovery question at a time, and only when the answer would materially improve your recommendation. Do not make the visitor answer a questionnaire before being helpful.\n" +
                    "- Explain creative and business outcomes in plain language. Avoid production jargon and internal workflow details unless requested.\n" +
                    "- Never invent prices, availability, credentials, guarantees, clients, or services. Pricing questions are answered deterministically before reaching you; if pricing comes up in another context, clearly direct the visitor to email lebarando@gmail.com for a project-specific estimate.\n" +
                    "- If information is unknown, say so plainly, provide any useful known context, and offer lebarando@gmail.com as the direct route for confirmation.\n" +
                    "- Do not criticize competitors or pressure the visitor. Be helpful and direct.\n\n" +
                    "Conversion behavior:\n" +
                    "- When the visitor has a clear need or buying intent, summarize the recommended solution and confidently invite them to start by emailing lebarando@gmail.com or using the site's 'Start a Project via Email' button.\n" +
                    "- Make the next step easy: suggest including the project idea, audience, goal, desired deliverables, timeline, and any useful reference. Do not imply every detail is required.\n" +
                    "- When they are still exploring, help them make progress with a useful recommendation or one relevant question; do not force a close before they are ready.\n\n" +
                    "Identity:\n" +
                    "- Introduce yourself as RiLey only when natural; do not repeat the introduction.\n" +
                    "- AIM+C means AI Media Creation. Ryan Lebarando is the Principal Consultant.\n" +
                    "- Never claim to be Ryan or a human team member."
            }
        };

        let response;
        let lastError = null;
        for (let modelIndex = 0; modelIndex < MODEL_TIER_SEQUENCE.length; modelIndex += 1) {
            const model = MODEL_TIER_SEQUENCE[modelIndex];
            const request = { ...generationRequest, model };

            try {
                response = await ai.models.generateContent(request);
                break;
            } catch (error) {
                lastError = error;
                const status = Number(error?.status);
                const isRetryable = [429, 500, 502, 503, 504].includes(status);
                const isLastModel = modelIndex === MODEL_TIER_SEQUENCE.length - 1;

                if (!isRetryable || isLastModel) {
                    throw error;
                }

                console.warn(`Gemini model ${model} failed (${status || 'unknown'}), retrying with ${MODEL_TIER_SEQUENCE[modelIndex + 1]}`);
                await new Promise(resolve => setTimeout(resolve, 500 * (2 ** modelIndex)));
            }
        }

        if (!response) {
            throw lastError || new Error('No Gemini response received');
        }

        res.status(200).json({ result: response.text });

    } catch (e) {
        const status = Number(e?.status);
        const temporarilyUnavailable = status === 429 || status === 503;
        console.error('RiLey chat request failed:', e);
        res.status(temporarilyUnavailable ? 503 : 500).json({
            code: temporarilyUnavailable ? 'CHAT_TEMPORARILY_UNAVAILABLE' : 'CHAT_REQUEST_FAILED'
        });
    }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`AIM+C by RL server ready on http://localhost:${PORT}`));
}

export default app;