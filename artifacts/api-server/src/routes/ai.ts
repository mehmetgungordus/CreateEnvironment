import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const FREE_MODEL = "qwen/qwen3-235b-a22b:free";

router.post("/ai/generate-env", async (req: Request, res: Response) => {
  try {
    const { entries, apiKey } = req.body as {
      entries: { key: string; value: string }[];
      apiKey?: string;
    };

    if (!Array.isArray(entries)) {
      res.status(400).json({ error: "entries must be an array" });
      return;
    }

    if (!apiKey || apiKey.trim() === "") {
      res.status(400).json({ error: "OpenRouter API key is required" });
      return;
    }

    const entriesText = entries
      .map((e) => `${e.key}=${e.value}`)
      .join("\n");

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
        "HTTP-Referer": "https://envcraft.app",
        "X-Title": "EnvCraft",
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages: [
          {
            role: "system",
            content: `You are an expert in environment variables and Vercel deployments.
The user will provide raw .env key-value pairs. Your job is to:
1. Analyze each variable and detect its type/purpose (API key, URL, secret, flag, etc.)
2. Suggest a better variable name if the current one is not Vercel-compatible or not following best practices (UPPERCASE, underscores, no spaces)
3. Validate values - flag any obviously wrong formats
4. Add helpful comments in the .env file explaining what each variable is for
5. Group related variables together with section comments
6. Return a JSON object with ONLY these fields:
   - "envContent": the formatted .env file content as a string (with comments)
   - "suggestions": an array of { key, suggestion, severity: "info"|"warning"|"error" }
   - "summary": a brief 1-2 sentence summary of what was found

Important rules:
- NEVER modify actual secret/key values - only clean up formatting
- Add a comment above each variable explaining what it does
- Group DATABASE, AUTH, API_KEYS, APP_CONFIG, etc. into sections
- For Vercel: environment variables are automatically available, no need for dotenv package
- Flag any keys that look like they might be missing required values
- Return valid JSON only, no markdown code blocks, no extra text`,
          },
          {
            role: "user",
            content: `Here are my environment variables:\n\n${entriesText}\n\nReturn JSON only.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      req.log.error({ status: response.status, errorText }, "OpenRouter API error");

      if (response.status === 401) {
        res.status(401).json({ error: "Invalid OpenRouter API key. Please check your key and try again." });
        return;
      }
      if (response.status === 429) {
        res.status(429).json({ error: "Rate limit reached on this free model. Please try again in a moment." });
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
      suggestions: { key: string; suggestion: string; severity: string }[];
      summary: string;
    };

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Error generating env");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
