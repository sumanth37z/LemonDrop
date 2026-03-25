const WORKER_URL = process.env.WORKER_URL;

export async function GET(request, { params }) {
  const { address } = await params;

  const url = `${WORKER_URL}/api/emails/${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "Accept": "application/json",
        "User-Agent": "LemonDrop/1.0",
      },
    });

    const text = await res.text();

    // If Cloudflare blocks us, text starts with <!DOCTYPE
    if (text.startsWith("<!")) {
      console.log("BLOCKED BY CLOUDFLARE");
      return Response.json([]);
    }

    const data = JSON.parse(text);
    return Response.json(data);
  } catch (err) {
    console.log("Error:", err);
    return Response.json([]);
  }
}