import { createServer, type Server } from "node:http";

// Stands in for the Claude API during end-to-end tests, so they never call the
// real service or send anything anywhere. CI starts the app with
// ANTHROPIC_BASE_URL pointing here. The replies are invented.

export const MOCK_CLAUDE_PORT = 54399;

const REPLIES = {
  nurse: {
    date: null,
    time: "10:15",
    nurse: "Nurse Robin",
    intake: 21,
    unit: "oz",
    feeds: "Four bottles, took them well",
    wet: 6,
    dirty: 2,
    vitals: "Temp 98.4, oxygen 97%",
    activity: "Tummy time twice",
    concerns: "A little spit up after the noon bottle",
  },
  visit: {
    kind: "GI",
    provider: "Dr. Invented",
    date: null,
    title: "Reflux follow up",
    summary: "Weight up nicely. Reflux is better.",
    homework: "Keep bottles upright for 20 minutes after each feed.",
    medChanges: "Famotidine stops after this week.",
    next: { date: "2099-01-15", time: "09:30", what: "GI follow up" },
  },
  therapy: { summary: "Worked on rolling.", homework: "Practice rolling to the left.", therapist: "Ms. Invented", next: null },
};

export function startMockClaude(): Promise<Server> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const schema = JSON.stringify(JSON.parse(body || "{}").output_config ?? {});
      const mode = schema.includes("medChanges") ? "visit" : schema.includes("intake") ? "nurse" : "therapy";
      // The nurse writes today; a visit summary comes the day after the visit,
      // which keeps today's week as the other tests expect it.
      const day = (offset: number) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + offset * 86_400_000));
      const reply = { ...REPLIES[mode], ...("date" in REPLIES[mode] ? { date: day(mode === "visit" ? -1 : 0) } : {}) };
      res.writeHead(200, { "content-type": "application/json", "request-id": "req_mock" });
      res.end(
        JSON.stringify({
          id: "msg_mock",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [{ type: "text", text: JSON.stringify(reply) }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      );
    });
  });
  return new Promise((resolve) => server.listen(MOCK_CLAUDE_PORT, "127.0.0.1", () => resolve(server)));
}
