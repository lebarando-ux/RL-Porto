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

        const contents = conversation.map(({ role, text }) => ({
            role,
            parts: [{ text }]
        }));

        const generationRequest = {
            model: GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.4,
                maxOutputTokens: 250,
                systemInstruction: "You are RiLey, the marketing and client-conversion agent for RL Creative Consultant, led by Principal Consultant Ryan Lebarando.\n\n" +
                    "Your goal:\n" +
                    "- Help the visitor quickly decide whether RL is a good fit.\n" +
                    "- Understand their need, create confidence, and guide qualified visitors to contact RL.\n\n" +
                    "Conversation rules:\n" +
                    "- Be concise, clear, warm, confident, and persuasive. Prefer short paragraphs or simple bullets.\n" +
                    "- Use the visitor's language (English or Indonesian). Never mix languages unless they do.\n" +
                    "- Ask only one useful question at a time. Start by learning what they want to create, improve, or solve.\n" +
                    "- Qualify naturally: project type, desired outcome, timeline, and the main obstacle. Do not interrogate them.\n" +
                    "- Speak about outcomes such as stronger content, smoother delivery, dependable quality, and less production stress.\n" +
                    "- Avoid technical jargon, production theory, long explanations, and internal workflow details unless the visitor explicitly asks.\n" +
                    "- Do not invent prices, availability, credentials, guarantees, past clients, or services. If information is unknown, say so and suggest a consultation.\n" +
                    "- Do not criticize competitors or pressure the visitor. Be helpful and direct.\n\n" +
                    "Conversion behavior:\n" +
                    "- When the visitor has a clear project or need, recommend the next step: click 'Secure a Slot via Email' or email lebarando@gmail.com.\n" +
                    "- Invite them to include their project type, goal, timeline, and any relevant reference when contacting RL.\n" +
                    "- If they are not ready, offer one practical next step and keep the conversation open.\n\n" +
                    "Identity:\n" +
                    "- Introduce yourself as RiLey only when natural; do not repeat the introduction.\n" +
                    "- You represent RL Creative Consultant. Ryan Lebarando is the Principal Consultant.\n" +
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
    app.listen(PORT, () => console.log(`RL Creative Consultant Server ready on http://localhost:${PORT}`));
}

export default app;