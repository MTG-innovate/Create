import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { SCHEMAS, capturePrompt, type CaptureMode, type Extracted } from "./capture";
import type { JourneyConfig } from "./journeys";

// The only place the app talks to Claude. It runs on the server, reads the key
// from the server's environment, and sends just the pasted words or photo.
// The photo is passed straight through and never stored.

export const claudeReady = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type Photo = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string };

export class CaptureError extends Error {
  constructor(public readonly why: "busy" | "photo" | "unreadable") {
    super(why);
  }
}

export async function extract<M extends CaptureMode>(
  mode: M,
  input: { text: string; photo: Photo | null; kind: string; today: string; person: JourneyConfig["aiPerson"] },
): Promise<Extracted<M>> {
  const client = new Anthropic({ maxRetries: 1, timeout: 60_000 });
  const prompt = capturePrompt(mode, { today: input.today, kind: input.kind, photo: Boolean(input.photo), hasText: Boolean(input.text), person: input.person });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.photo) content.push({ type: "image", source: { type: "base64", media_type: input.photo.mediaType, data: input.photo.base64 } });
  content.push({ type: "text", text: input.text ? `${prompt}\n\n<update>\n${input.text}\n</update>` : prompt });

  try {
    const message = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(SCHEMAS[mode]) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
    if (message.stop_reason === "refusal" || !message.parsed_output) throw new CaptureError("unreadable");
    return message.parsed_output as Extracted<M>;
  } catch (e) {
    if (e instanceof CaptureError) throw e;
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError)
      throw new CaptureError("busy");
    if (e instanceof Anthropic.BadRequestError && input.photo) throw new CaptureError("photo");
    console.error("Claude capture failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    throw new CaptureError("unreadable");
  }
}
