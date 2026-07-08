import { GoogleGenAI } from "@google/genai";

// Vercel serverless function for /api/gemini (Singapore region via vercel.json).
// Mirrors the Express handler in server.ts, which is used for local dev.
process.env.GOOGLE_CLOUD_DISABLE_TRACING = "1";
process.env.OC_DISABLE_GCP_TRACING = "true";
process.env.GOOGLE_APP_ENGINE_DISABLE_TRACES = "1";

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, apiKey, model } = req.body || {};
  const key = apiKey || process.env.GEMINI_API_KEY;
  const modelName = model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  if (!key) {
    return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า Gemini API Key (ตั้งได้ที่หน้า ตั้งค่า > AI/OCR หรือ env GEMINI_API_KEY)" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return res.json({ response: response.text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "Failed to call Gemini API" });
  }
}
