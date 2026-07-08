import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Set environment variables to disable Google Cloud automatic telemetry and tracing
// This prevents "cloudtrace.googleapis.com" organization policy errors on Cloud Run without affecting the app functionality.
process.env.GOOGLE_CLOUD_DISABLE_TRACING = "1";
process.env.OC_DISABLE_GCP_TRACING = "true";
process.env.GOOGLE_APP_ENGINE_DISABLE_TRACES = "1";

// Default Gemini model used when the web UI / env does not override it.
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  
  // Use JSON middleware with increased limit for images
  app.use(express.json({ limit: '20mb' }));

  app.post("/api/ocr", async (req, res) => {
    const { base64Image, mimeType, apiKey, model } = req.body;
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

      // Extract raw base64 if it has the data URI prefix
      const rawBase64 = base64Image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
      
      const ai = new GoogleGenAI({ 
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
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
          { inlineData: { data: rawBase64, mimeType: mimeType || 'image/jpeg' } }
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
              document_type: { type: "STRING" }
            }
          }
        }
      });

      const text = response.text;
      let parsedData = {};
      try {
        parsedData = JSON.parse(text);
      } catch (err) {
        return res.status(500).json({ success: false, error: "Failed to parse Gemini output as JSON" });
      }

      res.json({
        success: true,
        data: {
          success: true,
          duplicate: false, // You could run logic here to check against the DB if needed
          data: parsedData
        }
      });

    } catch (error: any) {
      console.error("Gemini OCR Error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to process OCR" });
    }
  });

  // API route to proxy Gemini API
  app.post("/api/gemini", async (req, res) => {
    const { prompt, apiKey, model } = req.body;
    const key = apiKey || process.env.GEMINI_API_KEY;
    const modelName = model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    if (!key) {
      return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า Gemini API Key (ตั้งได้ที่หน้า ตั้งค่า > AI/OCR หรือ env GEMINI_API_KEY)" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: key });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt
      });
      res.json({ response: response.text });
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to call Gemini API" });
    }
  });

  // API route to push a LINE message via the Messaging API.
  // Token + target userId come from the web UI (Settings > LINE), env fallback.
  app.post("/api/line", async (req, res) => {
    const { message, token, userId } = req.body || {};
    const accessToken = token || process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const to = userId || process.env.LINE_USER_ID;
    if (!accessToken || !to) {
      return res.status(400).json({ success: false, error: "ยังไม่ได้ตั้งค่า LINE Channel Access Token หรือ User ID" });
    }
    if (!message) {
      return res.status(400).json({ success: false, error: "Missing message" });
    }
    try {
      const r = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to,
          messages: [{ type: "text", text: String(message).slice(0, 4900) }],
        }),
      });
      if (!r.ok) {
        const detail = await r.text();
        return res.status(r.status).json({ success: false, error: `LINE API ${r.status}: ${detail}` });
      }
      return res.json({ success: true });
    } catch (error: any) {
      console.error("LINE push error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to send LINE message" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
