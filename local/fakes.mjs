// Local stand-ins for the two paid cloud APIs the backend calls:
//   POST /v1/messages  Anthropic Messages API (chat, estimator, price research)
//   POST /emails       Resend send API
//   GET  /emails       every email received, newest last (for e2e assertions)
//   DELETE /emails     clear the inbox
// Replies are fixed, so tests are deterministic and cost nothing.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 4010);
const emails = [];

const ESTIMATE = {
  title: "Excavator bucket ear repair",
  summary:
    "Gouge out the crack, preheat, multi-pass weld and grind flush. Local fake reply.",
  line_items: [
    { task: "Inspect and gouge out the crack", crew: 1, hours: 2 },
    { task: "Preheat, weld and grind", crew: 1, hours: 4 },
  ],
  hours_low: 5,
  hours_high: 8,
  dollars_low: 750,
  dollars_high: 1250,
  confidence: "medium",
  questions: [],
};

const PRICES =
  "Local fake price snapshot: A36 plate 1/4in $1.10/lb; 2x2x0.120 tube $3.40/ft; " +
  "sch 40 pipe 2in $6/ft, 4in $14/ft; stainless 3.5x mild; aluminum 2.5x mild; " +
  "consumables $18 per arc hour; scrap prices flat.";

const CHAT =
  "We cover Granbury, Stephenville, Fort Worth and the rest of the DFW area. [CONTACT]";

function anthropicReply(body) {
  const system = JSON.stringify(body.system ?? "");
  let text = CHAT;
  if (system.includes("steel and welding-material prices")) text = PRICES;
  else if (String(body.model).includes("sonnet"))
    text = JSON.stringify(ESTIMATE);
  return {
    id: `msg_fake_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: body.model,
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const path = new URL(req.url ?? "/", "http://fakes").pathname;
  console.log(`${req.method} ${path}`);

  if (req.method === "POST" && path === "/v1/messages") {
    return send(res, 200, anthropicReply(body));
  }
  if (req.method === "POST" && path === "/emails") {
    const id = `email_fake_${emails.length + 1}`;
    emails.push({ id, ...body });
    return send(res, 200, { id });
  }
  if (req.method === "GET" && path === "/emails") return send(res, 200, emails);
  if (req.method === "DELETE" && path === "/emails") {
    emails.length = 0;
    return send(res, 200, {});
  }
  if (path === "/health") return send(res, 200, { ok: true });
  send(res, 404, { error: `no fake for ${req.method} ${path}` });
}).listen(PORT, () => console.log(`fakes listening on ${PORT}`));
