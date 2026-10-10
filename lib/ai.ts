import "server-only";
import OpenAI from "openai";
import { z } from "zod";

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export class AiError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "BAD_OUTPUT" | "UPSTREAM",
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

const GROUND_RULES = [
  "You write for Byline, a prediction-market app built on Panta (Solana).",
  "Use ONLY the facts in the user message. Never invent statistics, injuries, quotes, news, or results.",
  "If the data is thin, say so plainly instead of filling gaps.",
  "Prices are probabilities: 0.62 means the market gives 62%.",
  "Be concise and concrete. No hype, no emojis, no financial advice, no instructions to buy.",
].join(" ");

/** Ask the model for JSON matching `schema` (described by `jsonSchema` for strict mode). */
export async function structured<S extends z.ZodTypeAny>(opts: {
  name: string;
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  schema: S;
}): Promise<z.output<S>> {
  if (!isAiConfigured()) throw new AiError("NOT_CONFIGURED", "AI is not configured on this server.");
  let content: string | null | undefined;
  try {
    const res = await getClient().chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: `${GROUND_RULES} ${opts.system}` },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.name, strict: true, schema: opts.jsonSchema },
      },
    });
    content = res.choices[0]?.message?.content;
  } catch (err) {
    throw new AiError("UPSTREAM", err instanceof Error ? err.message : "AI request failed");
  }
  if (!content) throw new AiError("BAD_OUTPUT", "AI returned no content.");
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new AiError("BAD_OUTPUT", "AI returned malformed JSON.");
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new AiError("BAD_OUTPUT", "AI output did not match the expected shape.");
  return parsed.data;
}
