import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const FREE_MODEL = "openai/gpt-oss-120b:free";

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

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://envforge.ai",
        "X-Title": "EnvForge.ai",
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages: [
          {
            role: "system",
            content: `You are EnvForge.ai — an expert in environment variables and Vercel deployments. The user pastes raw, messy, or chaotic configuration text. Your job is to parse it intelligently (it may be in any format: KEY=VALUE, KEY: VALUE, JSON, prose, etc.), extract real key/value pairs, and produce a clean, properly-formatted .env file.

${directivesBlock}

Return ONLY a valid JSON object (no markdown, no code fences) with these fields:
- "envContent": (string) the formatted .env file content. Use UPPER_SNAKE_CASE keys, quote values when they contain spaces or special chars, add # comments for sections and brief explanations. Never modify the actual secret/value content — only formatting.
- "annotations": (array) inline notes tied to specific keys, each: { "key": "EXACT_KEY_NAME", "label": "short label like 'AI Applied: Next.js Prefix' or 'AI Warn: 32-char minimum'", "type": "applied" | "warn" | "info" }
- "summary": (string) a single short sentence like "Found 8 variables. Grouped into 4 modules."
- "moduleCount": (number) how many sections/groups you created

Strict rules:
- Output JSON only. No prose. No code fences.
- Preserve secret values verbatim.
- If the input looks empty or non-config, return envContent: "" and an explanatory summary.`,
          },
          {
            role: "user",
            content: `Raw input:\n\n${rawText}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      req.log.error({ status: response.status, errorText }, "OpenRouter API error");

      if (response.status === 401) {
        res.status(500).json({ error: "Invalid server API key configuration." });
        return;
      }
      if (response.status === 429) {
        res.status(429).json({ error: "Rate limit reached. Please try again in a moment." });
        return;
      }

      res.status(500).json({ error: "AI service error. Please try again." });
      return;
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      error?: { message: string };
    };

    if (data.error) {
      req.log.error({ error: data.error }, "OpenRouter returned error");
      res.status(500).json({ error: data.error.message });
      return;
    }

    const rawContent = data.choices[0]?.message?.content;
    if (!rawContent) {
      res.status(500).json({ error: "Empty AI response" });
      return;
    }

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawContent;

    const parsed = JSON.parse(jsonStr) as {
      envContent: string;
      annotations: { key: string; label: string; type: string }[];
      summary: string;
      moduleCount: number;
    };

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Error generating env");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
