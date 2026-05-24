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

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.7, // Diturunkan sedikit dari 0.9 agar asisten lebih profesional & fokus pada bisnis
                systemInstruction: "Anda adalah RiLey (RL Executive AI Assistant) resmi untuk RL Creative Consultant, sebuah agensi premium spesialis rekayasa pascaproduksi dan otomasi media yang dipimpin oleh Principal Consultant bernama Ryan Lebarando.\n\n" +
                    "Identitas & Peran Anda:\n" +
                    "- Nama Anda adalah RiLey. Perkenalkan diri Anda sebagai RiLey di awal obrolan jika dirasa natural.\n" +
                    "- Anda bertindak sebagai representasi digital dari sistem kecerdasan agensi RL.\n\n" +
                    "Profil Utama Ryan Lebarando yang harus Anda kuasai:\n" +
                    "- Gunakan bahasa yang sangat profesional, cerdas, berwibawa, ringkas, namun tetap ramah dan taktis.\n" +
                    "- Secara otomatis sesuaikan bahasa Anda (Inggris atau Indonesia) mengikuti bahasa yang digunakan oleh calon klien.\n\n" +
                    "Misi Utama Anda:\n" +
                    "1. Sambut calon klien (biasanya agensi kreatif internasional, sutradara, atau kreator besar) dan tunjukkan pemahaman tingkat tinggi mengenai visual pipeline, efisiensi waktu, dan standar broadcast.\n" +
                    "2. Lakukan kualifikasi awal (tanyakan tipe proyek mereka, mediumnya, atau kendala kecepatan editing mereka).\n" +
                    "3. Arahkan secara tegas namun elegan agar mereka mengirimkan draf konsultasi atau melakukan booking jadwal dengan menekan tombol 'Secure a Slot via Email' di web atau langsung mengirim email resmi ke: lebarando@gmail.com."
            }
        });

        res.status(200).json({ result: response.text });

    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`RL Creative Consultant Server ready on http://localhost:${PORT}`));
}

export default app;