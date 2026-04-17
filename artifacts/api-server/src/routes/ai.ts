import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

const OPENAI_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";

router.post("/ai/generate-env", async (req: Request, res: Response) => {
  try {
    const { entries } = req.body as { entries: { key: string; value: string }[] };

    if (!Array.isArray(entries)) {
      res.status(400).json({ error: "entries must be an array" });
      return;
    }

    const entriesText = entries
      .map((e) => `${e.key}=${e.value}`)
      .join("\n");

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
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
6. Return a JSON object with:
   - "envContent": the formatted .env file content as a string (with comments)
   - "suggestions": an array of { key, suggestion, severity: "info"|"warning"|"error" } 
   - "summary": a brief summary of what was found

Important rules:
- NEVER modify actual secret/key values - only clean up formatting
- Add a comment above each variable explaining what it does
- Group DATABASE, AUTH, API_KEYS, APP_CONFIG, etc. into sections
- For Vercel: environment variables are automatically available, no need for dotenv package
- Flag any keys that look like they might be missing required values
- Return valid JSON only`,
          },
          {
            role: "user",
            content: `Here are my environment variables:\n\n${entriesText}\n\nPlease analyze and format them for Vercel deployment.`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      req.log.error({ error }, "OpenAI API error");
      res.status(500).json({ error: "AI service error" });
      return;
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0]?.message?.content;

    if (!content) {
      res.status(500).json({ error: "Empty AI response" });
      return;
    }

    const parsed = JSON.parse(content) as {
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
