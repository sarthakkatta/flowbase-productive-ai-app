import { auth } from "@clerk/nextjs/server";

const TOKEN_URL = "https://agents.assemblyai.com/v1/token";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "AssemblyAI is not configured." }, { status: 500 });
  }

  const url = new URL(TOKEN_URL);
  url.searchParams.set("expires_in_seconds", "120");
  url.searchParams.set("max_session_duration_seconds", "300");

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | { token?: string; error?: string; message?: string }
      | null;

    if (!response.ok || !data?.token) {
      const detail = data?.error || data?.message || "Unable to create a voice token.";
      return Response.json({ error: detail }, { status: response.status || 502 });
    }

    return Response.json({ token: data.token });
  } catch {
    return Response.json({ error: "Unable to reach AssemblyAI." }, { status: 502 });
  }
}
