const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
const DATABASE_ID = process.env.CF_DATABASE_ID;

export async function DELETE(request, { params }) {
  const { id } = await params;

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
          sql: "DELETE FROM emails WHERE id = ?",
          params: [id],
        }),
      }
    );

    const data = await res.json();
    return Response.json({ success: data.success });
  } catch (err) {
    console.log("Delete error:", err);
    return Response.json({ success: false });
  }
}