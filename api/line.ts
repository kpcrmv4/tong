// Vercel serverless function for /api/line (Singapore region via vercel.json).
// Pushes a LINE message via the Messaging API. Token + target userId come
// from the web UI (Settings > LINE); env vars are the fallback.
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

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
}
