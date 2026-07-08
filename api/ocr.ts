import { GoogleGenAI } from "@google/genai";

// Vercel serverless function for /api/ocr (Singapore region via vercel.json).
// Mirrors the Express handler in server.ts, which is used for local dev.
// Disable Google Cloud telemetry/tracing (avoids org-policy errors on serverless).
process.env.GOOGLE_CLOUD_DISABLE_TRACING = "1";
process.env.OC_DISABLE_GCP_TRACING = "true";
process.env.GOOGLE_APP_ENGINE_DISABLE_TRACES = "1";

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { base64Image, mimeType, apiKey, model } = req.body || {};
  // Prefer the key/model configured from the web UI (Settings), then env.
  const key = apiKey || process.env.GEMINI_API_KEY;
  const modelName = model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  if (!key) {
    return res.status(500).json({ success: false, error: "ยังไม่ได้ตั้งค่า Gemini API Key (ตั้งได้ที่หน้า ตั้งค่า > AI/OCR หรือ env GEMINI_API_KEY)" });
  }

  try {
    if (!base64Image) {
      return res.status(400).json({ success: false, error: "Missing base64Image" });
    }

    const rawBase64 = base64Image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const promptText = `
      Analyze this image of an identification document (like a Thai ID card, passport, or driving license).
      Extract the following information and format it strictly as JSON.
      Ensure you pull THAI logic for the name or English if not available.
      Fields to extract:
      - full_name_th: <string> name in Thai, if available
      - full_name_en: <string> name in English, if available
      - id_number: <string> primary identification number (usually 13 digits for Thai ID)
      - phone: <string> try to extract phone number if exists
      - address: <string> the full address mentioned
      - document_type: <string> tell whether it is a "Thai ID Card", "Passport", "Driver License" or "Unknown"

      Return cleanly. If a field isn't found, leave it empty string "".
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        { text: promptText },
        { inlineData: { data: rawBase64, mimeType: mimeType || "image/jpeg" } },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            full_name_th: { type: "STRING" },
            full_name_en: { type: "STRING" },
            id_number: { type: "STRING" },
            phone: { type: "STRING" },
            address: { type: "STRING" },
            document_type: { type: "STRING" },
          },
        },
      },
    });

    const text = response.text;
    let parsedData = {};
    try {
      parsedData = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({ success: false, error: "Failed to parse Gemini output as JSON" });
    }

    return res.json({
      success: true,
      data: { success: true, duplicate: false, data: parsedData },
    });
  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to process OCR" });
  }
}
