/* =====================================================================
   /api/assistant — server-side proxy for the Nortem AI assistant.

   Why this exists: an API key can never be safely embedded in frontend
   JavaScript — anyone could open dev tools and steal it. This function
   keeps the key on the server (as a Vercel Environment Variable) and the
   browser only ever talks to this endpoint. Whoever deploys this app
   sets ONE key here, and every visitor gets a working AI assistant
   automatically — nobody else has to configure anything.

   ---------------------------------------------------------------------
   SETUP (do this once, in the Vercel dashboard for this project):
     Project → Settings → Environment Variables → add ONE of:

       GEMINI_API_KEY     (recommended — genuinely free, no credit card)
                           Get one at https://aistudio.google.com/apikey
       GROQ_API_KEY        (also free, no credit card)
                           Get one at https://console.groq.com/keys
       ANTHROPIC_API_KEY   (paid, if you'd rather use Claude)
                           Get one at https://console.anthropic.com

     Then redeploy. That's it — no code changes needed.
   ---------------------------------------------------------------------
   If none of these are set, this endpoint returns 503 "not_configured"
   and the app's assistant automatically falls back to its offline
   rule-based mode (still useful, just less conversational).
   ===================================================================== */

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { system, messages } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages_required" });
    return;
  }

  try {
    let reply;
    if (process.env.GEMINI_API_KEY) {
      reply = await callGemini(system, messages);
    } else if (process.env.GROQ_API_KEY) {
      reply = await callGroq(system, messages);
    } else if (process.env.ANTHROPIC_API_KEY) {
      reply = await callAnthropic(system, messages);
    } else {
      res.status(503).json({ error: "not_configured" });
      return;
    }
    res.status(200).json({ reply });
  } catch (err) {
    console.error("assistant proxy error:", err);
    res.status(502).json({ error: err.message || "upstream_error" });
  }
};

async function callGemini(system, messages) {
  // "gemini-flash-latest" is Google's floating alias for their current fast
  // model — safer as a default than pinning a dated version name that can
  // get deprecated. Override with GEMINI_MODEL if you want a specific one.
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));
  const body = { contents, generationConfig: { maxOutputTokens: 1000 } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  // Google's current recommendation is the x-goog-api-key header rather
  // than putting the key in the URL as a ?key= query parameter.
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini HTTP ${r.status}`);
  const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text).join("");
  return text.trim() || "Não recebi uma resposta da IA agora.";
}

async function callGroq(system, messages) {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const chatMessages = [];
  if (system) chatMessages.push({ role: "system", content: system });
  messages.forEach(m => chatMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model, messages: chatMessages, max_tokens: 1000 }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Groq HTTP ${r.status}`);
  return (data?.choices?.[0]?.message?.content || "").trim() || "Não recebi uma resposta da IA agora.";
}

async function callAnthropic(system, messages) {
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model, max_tokens: 1200, system,
      messages: messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic HTTP ${r.status}`);
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim()
    || "Não recebi uma resposta da IA agora.";
}
