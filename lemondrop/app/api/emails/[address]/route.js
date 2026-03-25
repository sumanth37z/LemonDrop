const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
const DATABASE_ID = process.env.CF_DATABASE_ID;

export async function GET(request, { params }) {
  const { address } = await params;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: "SELECT * FROM emails WHERE recipient = ? ORDER BY received_at DESC LIMIT 50",
          params: [address.toLowerCase()],
        }),
      }
    );

    const data = await res.json();

    if (data.success && data.result && data.result[0]) {
      return Response.json(data.result[0].results || []);
    }

    return Response.json([]);
  } catch (err) {
    console.log("D1 Error:", err);
    return Response.json([]);
  }
}