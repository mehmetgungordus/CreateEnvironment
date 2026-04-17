import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-coder:free",
  "google/gemma-3-27b-it:free",
];

router.post("/ai/generate-env", async (req: Request, res: Response) => {
  try {
    const { rawText, directives } = req.body as {
      rawText?: string;
      directives?: {
        autoDetectGroups?: boolean;
        injectVercelPrefix?: boolean;
        generateMissingKeys?: boolean;
      };
    };

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Server is missing OpenRouter API key configuration." });
      return;
    }

    if (!rawText || rawText.trim() === "") {
      res.status(400).json({ error: "rawText is required" });
      return;
    }

    const d = directives ?? {};
    const directiveLines: string[] = [];
    if (d.autoDetectGroups) directiveLines.push("- Auto-detect groups: organize variables into sections (Database, Auth, API Keys, App Config, etc.) with `# --- Section Name ---` comments.");
    if (d.injectVercelPrefix) directiveLines.push("- Inject Vercel prefix: prepend `NEXT_PUBLIC_` to client-safe variables (URLs, public keys, app config). NEVER add this prefix to secrets, tokens, passwords, or service-role keys.");
    if (d.generateMissingKeys) directiveLines.push("- Generate missing keys: suggest commonly forgotten variables based on what's present (e.g. NEXTAUTH_SECRET if NEXTAUTH_URL exists). Add them to the output with placeholder values like `<GENERATE_ME>`.");

    const directivesBlock = directiveLines.length > 0
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

    let parsed: {
      envContent: string;
      annotations: { key: string; label: string; type: string }[];
      summary: string;
      moduleCount: number;
    } | null = null;
    let lastError = "Unknown";

    for (const model of FREE_MODELS) {
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
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
              { role: "user", content: `Raw input:\n\n${rawText}\n\nRespond with JSON only.` },
            ],
            temperature: 0.2,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          req.log.warn({ model, status: response.status, errorText }, "Model failed, trying next");
          if (response.status === 401) {
            res.status(500).json({ error: "Invalid server API key configuration." });
            return;
          }
          lastError = `${response.status}: ${errorText.slice(0, 200)}`;
          continue;
        }

        const data = (await response.json()) as {
          choices?: { message?: { content?: string; reasoning?: string } }[];
          error?: { message: string };
        };

        if (data.error) {
          req.log.warn({ model, error: data.error }, "OpenRouter error, trying next");
          lastError = data.error.message;
          continue;
        }

        const msg = data.choices?.[0]?.message;
        const rawContent = msg?.content?.trim() || msg?.reasoning?.trim() || "";

        if (!rawContent) {
          req.log.warn({ model, data }, "Empty content from model, trying next");
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
          parsed = JSON.parse(jsonStr);
        } catch (parseErr) {
          req.log.warn(
            { model, rawContent: rawContent.slice(0, 500), err: parseErr },
            "JSON parse failed, trying next",
          );
          lastError = "JSON parse failed";
          continue;
        }

        if (parsed && typeof parsed.envContent === "string") {
          parsed.annotations = Array.isArray(parsed.annotations) ? parsed.annotations : [];
          parsed.summary = parsed.summary ?? "";
          parsed.moduleCount = parsed.moduleCount ?? 0;
          req.log.info({ model }, "AI generation succeeded");
          break;
        }

        lastError = "Invalid response shape";
        parsed = null;
      } catch (fetchErr) {
        req.log.warn({ model, err: fetchErr }, "Fetch error, trying next");
        lastError = String(fetchErr);
      }
    }

    if (!parsed) {
      res.status(502).json({ error: `AI service unavailable. ${lastError}` });
      return;
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Error generating env");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
