// Vercel Edge Function — POST /api/ai/generate-env
// Mirrors the Express route at artifacts/api-server/src/routes/ai.ts so the
// same frontend works on Vercel without a separate backend.

export const config = { runtime: "edge" };

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-coder:free",
  "google/gemma-3-27b-it:free",
];

type Directives = {
  autoDetectGroups?: boolean;
  injectVercelPrefix?: boolean;
  generateMissingKeys?: boolean;
};

type Annotation = { key: string; label: string; type: string };

type Parsed = {
  envContent: string;
  annotations: Annotation[];
  summary: string;
  moduleCount: number;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { rawText?: string; directives?: Directives };
  try {
    body = (await req.json()) as { rawText?: string; directives?: Directives };
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { rawText, directives } = body;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "Server is missing OpenRouter API key configuration." },
      500,
    );
  }

  if (!rawText || rawText.trim() === "") {
    return jsonResponse({ error: "rawText is required" }, 400);
  }

  const d = directives ?? {};
  const directiveLines: string[] = [];
  if (d.autoDetectGroups)
    directiveLines.push(
      "- Auto-detect groups: organize variables into sections (Database, Auth, API Keys, App Config, etc.) with `# --- Section Name ---` comments.",
    );
  if (d.injectVercelPrefix)
    directiveLines.push(
      "- Inject Vercel prefix: prepend `NEXT_PUBLIC_` to client-safe variables (URLs, public keys, app config). NEVER add this prefix to secrets, tokens, passwords, or service-role keys.",
    );
  if (d.generateMissingKeys)
    directiveLines.push(
      "- Generate missing keys: suggest commonly forgotten variables based on what's present (e.g. NEXTAUTH_SECRET if NEXTAUTH_URL exists). Add them to the output with placeholder values like `<GENERATE_ME>`.",
    );

  const directivesBlock =
    directiveLines.length > 0
      ? `Active transformation directives:\n${directiveLines.join("\n")}`
      : "No transformation directives active. Just clean and format.";

  const systemPrompt = `You are EnvForge.ai — an expert in environment variables and Vercel deployments. The user pastes raw, messy, or chaotic configuration text. Your job is to parse it intelligently (it may be in any format: KEY=VALUE, KEY: VALUE, JSON, prose, etc.), extract real key/value pairs, and produce a clean, properly-formatted .env file.

${directivesBlock}

Return ONLY a valid JSON object (no markdown, no code fences, no prose before or after) with these fields:
- "envContent": (string) the formatted .env file content. Use UPPER_SNAKE_CASE keys, quote values when they contain spaces or special chars, add # comments for sections. Never modify the actual secret/value content — only formatting.
- "annotations": (array) inline notes tied to specific keys, each: { "key": "EXACT_KEY_NAME", "label": "short label like 'AI Applied: Next.js Prefix' or 'AI Warn: 32-char minimum'", "type": "applied" | "warn" | "info" }
- "summary": (string) a single short sentence like "Found 8 variables. Grouped into 4 modules."
- "moduleCount": (number) how many sections/groups you created

Strict rules:
- Output JSON only. Start with { and end with }.
- Preserve secret values verbatim.
- If the input looks empty or non-config, return envContent: "" with explanatory summary.`;

  let parsed: Parsed | null = null;
  let lastError = "Unknown";

  for (const model of FREE_MODELS) {
    try {
      const upstream = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://envforge.ai",
          "X-Title": "EnvForge.ai",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Raw input:\n\n${rawText}\n\nRespond with JSON only.`,
            },
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });

      if (!upstream.ok) {
        const errorText = await upstream.text();
        if (upstream.status === 401) {
          return jsonResponse(
            { error: "Invalid server API key configuration." },
            500,
          );
        }
        lastError = `${upstream.status}: ${errorText.slice(0, 200)}`;
        continue;
      }

      const data = (await upstream.json()) as {
        choices?: { message?: { content?: string; reasoning?: string } }[];
        error?: { message: string };
      };

      if (data.error) {
        lastError = data.error.message;
        continue;
      }

      const msg = data.choices?.[0]?.message;
      const rawContent = msg?.content?.trim() || msg?.reasoning?.trim() || "";

      if (!rawContent) {
        lastError = "Empty content";
        continue;
      }

      const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      const jsonStr =
        firstBrace !== -1 && lastBrace > firstBrace
          ? cleaned.substring(firstBrace, lastBrace + 1)
          : cleaned;

      try {
        parsed = JSON.parse(jsonStr) as Parsed;
      } catch {
        lastError = "JSON parse failed";
        continue;
      }

      if (parsed && typeof parsed.envContent === "string") {
        parsed.annotations = Array.isArray(parsed.annotations)
          ? parsed.annotations
          : [];
        parsed.summary = parsed.summary ?? "";
        parsed.moduleCount = parsed.moduleCount ?? 0;
        break;
      }

      lastError = "Invalid response shape";
      parsed = null;
    } catch (fetchErr) {
      lastError = String(fetchErr);
    }
  }

  if (!parsed) {
    return jsonResponse(
      { error: `AI service unavailable. ${lastError}` },
      502,
    );
  }

  return jsonResponse(parsed);
}
