export default {

  // ═══════════════════════════════════════
  // CATCH INCOMING EMAILS
  // ═══════════════════════════════════════
  async email(message, env) {
    try {
      const reader = message.raw.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const raw = new Uint8Array(
        chunks.reduce((a, c) => a + c.length, 0)
      );
      let offset = 0;
      for (const chunk of chunks) {
        raw.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(raw);
      const subject = getHeader(text, "Subject") || "(no subject)";
      const body = getBody(text);
      const id = crypto.randomUUID().slice(0, 8);

      await env.DB.prepare(
        "INSERT INTO emails (id, recipient, sender, subject, body, received_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          message.to.toLowerCase(),
          message.from,
          subject.slice(0, 500),
          body.slice(0, 50000),
          Date.now()
        )
        .run();

      console.log(`Email: ${message.from} -> ${message.to}`);
    } catch (err) {
      console.log("Email error:", err.message);
    }
  },

  // ═══════════════════════════════════════
  // API ENDPOINTS
  // ═══════════════════════════════════════
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // GET EMAILS
    if (path.startsWith("/api/emails/")) {
      const address = decodeURIComponent(
        path.replace("/api/emails/", "")
      ).toLowerCase();

      const { results } = await env.DB.prepare(
        "SELECT * FROM emails WHERE recipient = ? ORDER BY received_at DESC LIMIT 50"
      )
        .bind(address)
        .all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // HEALTH CHECK
    if (path === "/api/health") {
      return new Response(
        JSON.stringify({
          status: "running",
          domain: "lemondrop.qzz.io",
        }),
        { headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // CLEANUP
    if (path === "/api/cleanup" && request.method === "POST") {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const result = await env.DB.prepare(
        "DELETE FROM emails WHERE received_at < ?"
      )
        .bind(oneHourAgo)
        .run();

      return new Response(
        JSON.stringify({ deleted: result.changes }),
        { headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // DEFAULT
    return new Response("LemonDrop API 🍋", {
      headers: { "Content-Type": "text/plain" },
    });
  },

  // ═══════════════════════════════════════
  // AUTO CLEANUP EVERY HOUR
  // ═══════════════════════════════════════
  async scheduled(event, env) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    await env.DB.prepare(
      "DELETE FROM emails WHERE received_at < ?"
    )
      .bind(oneHourAgo)
      .run();
    console.log("Cleanup done");
  },
};

// ═══════════════════════════════════════
// EMAIL PARSING
// ═══════════════════════════════════════
function getHeader(text, name) {
  const regex = new RegExp(`^${name}:\\s*(.+)$`, "mi");
  const match = text.match(regex);
  if (!match) return "";

  let value = match[1].trim();

  value = value.replace(/=\?[^?]+\?B\?([^?]+)\?=/gi, (_, b64) => {
    try {
      return atob(b64);
    } catch {
      return b64;
    }
  });

  value = value.replace(/=\?[^?]+\?Q\?([^?]+)\?=/gi, (_, qp) => {
    return qp
      .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/_/g, " ");
  });

  return value;
}

function getBody(text) {
  const parts = text.split(/\r?\n\r?\n/);
  if (parts.length < 2) return text;

  let body = parts.slice(1).join("\n\n").trim();

  if (body.includes("Content-Type: text/plain")) {
    const m = body.match(
      /Content-Type: text\/plain[^\r\n]*\r?\n(?:Content-[^\r\n]*\r?\n)*\r?\n([\s\S]*?)(?:\r?\n--|\s*$)/i
    );
    if (m) body = m[1];
  }

  body = body.replace(/=\r?\n/g, "");
  body = body.replace(/=([0-9A-F]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  if (body.length > 50000) body = body.substring(0, 50000) + "...";
  return body.trim();
}