import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import multer from 'multer';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const ai = new GoogleGenAI({});
const app = express();
const upload = multer();

const GEMINI_MODEL = "gemini-3.5-flash";
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
        ? 'Kami belum mencantumkan harga tetap; biaya bergantung pada format, durasi, dan ruang lingkup produksi. Kirim ide, tujuan, dan timeline Anda ke lebarando@gmail.com untuk membahas estimasi yang sesuai.'
        : 'We don’t list fixed prices; each estimate depends on the format, length, and production scope. Email your idea, goals, and timeline to lebarando@gmail.com to discuss a suitable quote.';
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
            model: GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.3,
                maxOutputTokens: 256,
                systemInstruction: "You are RiLey, the friendly marketing and project guide for AIM+C by RL, an AI Media Creation brand led by Principal Consultant Ryan Lebarando.\n\n" +
                    "Your goal:\n" +
                    "- Help visitors explore whether AIM+C can help create the video or media content they need.\n" +
                    "- Understand their idea, build confidence, and guide interested visitors to start a project.\n\n" +
                    "Conversation rules:\n" +
                    "- Be concise, clear, warm, confident, and persuasive. Keep replies to 1-2 short sentences and under 35 words unless the visitor asks for detail.\n" +
                    "- For a greeting or casual opener, greet them briefly and ask one simple question about what they need. Do not introduce the agency, list services, or give a sales pitch.\n" +
                    "- Use the visitor's language (English or Indonesian). Never mix languages unless they do.\n" +
                    "- Ask only one useful question at a time. Start by asking what they want to create: for example, an ad, branded video, short story, or animation.\n" +
                    "- Learn the audience, goal, or timeline naturally as relevant. Do not interrogate them.\n" +
                    "- Explain AIM+C in terms of creative outcomes, not AI tools or production jargon.\n" +
                    "- Avoid technical jargon, long explanations, and internal workflow details unless the visitor explicitly asks.\n" +
                    "- Do not invent prices, availability, credentials, guarantees, past clients, or services. If asked about pricing, explain that there are no fixed prices listed, the estimate depends on project scope, and invite them to email lebarando@gmail.com.\n" +
                    "- If information is unknown, say so and suggest contacting lebarando@gmail.com for a direct answer.\n" +
                    "- Do not criticize competitors or pressure the visitor. Be helpful and direct.\n\n" +
                    "Conversion behavior:\n" +
                    "- When the visitor has a clear project, asks about pricing, or needs a quote, suggest clicking 'Start a Project via Email' or emailing lebarando@gmail.com.\n" +
                    "- Invite them to include what they want to create, its goal, timeline, and any relevant reference.\n" +
                    "- If they are not ready, offer one practical next step and keep the conversation open.\n\n" +
                    "Identity:\n" +
                    "- Introduce yourself as RiLey only when natural; do not repeat the introduction.\n" +
                    "- AIM+C means AI Media Creation. Ryan Lebarando is the Principal Consultant.\n" +
                    "- Never claim to be Ryan or a human team member."
            }
        };

        let response;
        for (let attempt = 0; ; attempt += 1) {
            try {
                response = await ai.models.generateContent(generationRequest);
                break;
            } catch (error) {
                const status = Number(error?.status);
                const isTemporaryFailure = [429, 500, 502, 503, 504].includes(status);
                if (!isTemporaryFailure || attempt >= 2) throw error;

                await new Promise(resolve => setTimeout(resolve, 500 * (2 ** attempt)));
            }
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