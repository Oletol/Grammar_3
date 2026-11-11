// AI check of students' writing and speaking (optional). Runs in the teacher's browser only, when the teacher clicks
// "Check the writing now" / "Check the speaking now". It uses a free API key of the teacher's own (Groq, Google Gemini,
// OpenRouter, Mistral or any service with an OpenAI-compatible API). The key is kept in this browser only: it is never
// saved in the course database or on GitHub, so students cannot see it.
// The AI is asked for: mistakes (with the exact words, the correction and a short rule), the structures of the module the
// student used (and whether they are correct), a short comment for the student, and an estimate of the level.
// Every quote is checked against the student's text: a mistake the AI cannot point to in the text is dropped.

export const PROVIDERS = {
  groq: { name: "Groq", base: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", delay: 2500, keys: "https://console.groq.com/keys",
    note: "Free, no card. About 1,000 checks a day; fast." },
  gemini: { name: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", delay: 7000, keys: "https://aistudio.google.com/apikey",
    note: "Free tier with a Google account; about 10 checks a minute. Texts on the free tier may be used by Google to improve its products." },
  openrouter: { name: "OpenRouter", base: "https://openrouter.ai/api/v1", model: "openrouter/free", delay: 3500, keys: "https://openrouter.ai/keys",
    note: "Free models: 50 checks a day (1,000 after a one-time $10 top-up)." },
  mistral: { name: "Mistral", base: "https://api.mistral.ai/v1", model: "mistral-small-latest", delay: 2000, keys: "https://console.mistral.ai/api-keys",
    note: "Free “Experiment” plan; needs a phone number." },
  custom: { name: "Other (OpenAI-compatible)", base: "", model: "", delay: 3000, keys: "", note: "Any service with an OpenAI-compatible /chat/completions API." },
};

const LS = "t:aiCheck";
export function aiSettings() {
  try { return { provider: "groq", model: "", base: "", key: "", on: false, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return { provider: "groq", model: "", base: "", key: "", on: false }; }
}
export function saveAiSettings(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch {} }
export const aiReady = (s = aiSettings()) => !!(s.on && s.key && endpoint(s).base && endpoint(s).model);
export function endpoint(s = aiSettings()) {
  const p = PROVIDERS[s.provider] || PROVIDERS.custom;
  return { base: (s.base || p.base || "").replace(/\/+$/, ""), model: s.model || p.model, delay: p.delay, name: p.name };
}

async function call(s, messages, json = true) {
  const { base, model } = endpoint(s);
  const body = { model, messages, temperature: 0 };
  if (json) body.response_format = { type: "json_object" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.key },
      body: JSON.stringify(body),
    });
    if (r.status === 429 && attempt < 2) {           // too many requests: wait as the service asks, then try again
      const wait = Math.min(60, Number(r.headers.get("retry-after")) || 20);
      await new Promise((res) => setTimeout(res, wait * 1000));
      continue;
    }
    const t = await r.text();
    if (r.status === 400 && json && /response_format|json/i.test(t)) return call(s, messages, false);   // the model cannot promise JSON
    if (!r.ok) throw new Error(`${endpoint(s).name} answered ${r.status}: ${t.slice(0, 200)}`);
    const d = JSON.parse(t);
    return d.choices?.[0]?.message?.content || "";
  }
  throw new Error("Too many requests. Please wait a minute and try again.");
}

export async function listModels(s) {
  const { base } = endpoint(s);
  const r = await fetch(base + "/models", { headers: { Authorization: "Bearer " + s.key } });
  if (!r.ok) throw new Error(`${endpoint(s).name} answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return (d.data || d.models || []).map((m) => String(m.id || m.name || "").replace(/^models\//, "")).filter(Boolean).sort();
}

export async function testAi(s) {
  const out = await call(s, [{ role: "user", content: 'Reply with this JSON only: {"ok": true}' }]);
  return /ok/.test(out);
}

// the JSON in the answer (some models wrap it in ```json … ``` or add a sentence)
const parseJSON = (t) => {
  const s = String(t || ""), a = s.indexOf("{"), b = s.lastIndexOf("}");
  return JSON.parse(a >= 0 && b > a ? s.slice(a, b + 1) : s);
};

// find the AI's quote in the student's text (apostrophes, spaces and letter case do not matter)
function locate(text, quote, from = 0) {
  const norm = (x) => String(x).replace(/[’‘`´]/g, "'").toLowerCase();
  const T = norm(text), q = norm(quote).trim().replace(/\s+/g, " ");
  if (!q) return null;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
  let base = from, m = re.exec(T.slice(from));
  if (!m) { base = 0; m = re.exec(T); }
  if (!m) return null;
  return { offset: base + m.index, length: m[0].length };
}

const TYPE = { grammar: "grammar", vocabulary: "vocabulary", "word choice": "vocabulary", spelling: "misspelling", punctuation: "typographical", "word order": "grammar" };

// texts: {itemId: text}; grammar: [{id, label, eg}] (the module's structures); speaking: the texts are transcripts of recordings
// returns {itemId: {issues, target, comment, level}}
export async function aiCheck(texts, { task = "", grammar = [], speaking = false, settings = aiSettings() } = {}) {
  const items = Object.fromEntries(Object.entries(texts).filter(([, t]) => String(t || "").trim()));
  if (!Object.keys(items).length) return {};
  const system = "You are an experienced teacher of English grammar at a university in Russia. You check short answers written or spoken by "
    + "students (level B1–B2; their first language is Russian or Chinese). You are exact and fair: you report only real mistakes, never style "
    + "preferences, and every quote you give is copied exactly from the student's text. You answer with JSON only.";
  const user = [
    `TASK GIVEN TO THE STUDENT: ${String(task).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "(not given)"}`,
    speaking
      ? "THE ANSWERS ARE SPOKEN: each text is an automatic transcript of the student's recording. Ignore punctuation, capital letters, spelling, hesitations (um, er, uh), repeated words and false starts: never report them. Report grammar and word use only."
      : "THE ANSWERS ARE WRITTEN.",
    grammar.length
      ? "GRAMMAR OF THE MODULE (the structures the students are practising):\n" + grammar.map((g) => `- ${g.id}: ${g.label} (e.g. ${g.eg})`).join("\n")
      : "GRAMMAR OF THE MODULE: not given; leave \"target\" empty.",
    "STUDENT'S ANSWERS (JSON, one text per item):\n" + JSON.stringify(items),
    `For every item return:
- "errors": the real mistakes in grammar and word use${speaking ? "" : ", and spelling"}. For each: "quote" – the exact words from the text (as few words as possible, at most 8), "fix" – the corrected words, "explain" – one short sentence in simple English (level B1) that names the rule, "type" – "grammar", "vocabulary"${speaking ? "" : ", \"spelling\" or \"punctuation\""}. No mistakes: [].
- "target": every place where the student used one of the structures of the module: "quote" – the exact words, "structure" – its id from the list, "ok" – true if it is used correctly, false if not, "fix" – the correct form (only when ok is false).
- "comment": one or two sentences for the student, kind and concrete: what is good, what to work on (mention the grammar of the module).
- "level": the CEFR level (A1, A2, B1, B2, C1, C2) this text shows in grammar and vocabulary – an estimate.
Answer with JSON only, exactly in this form: {"items": {"<item id>": {"errors": [], "target": [], "comment": "", "level": ""}}}`,
  ].join("\n\n");
  const raw = await call(settings, [{ role: "system", content: system }, { role: "user", content: user }]);
  let d;
  try { d = parseJSON(raw); } catch { throw new Error("The AI did not answer in the expected form. Please try again."); }
  const out = {};
  const known = new Set(grammar.map((g) => g.id));
  for (const [id, text] of Object.entries(items)) {
    const r = d?.items?.[id] || {};
    const issues = [], target = [];
    let pos = 0;
    for (const e of Array.isArray(r.errors) ? r.errors : []) {
      const type = TYPE[String(e.type || "").toLowerCase()] || "grammar";
      if (speaking && ["misspelling", "typographical"].includes(type)) continue;
      const at = locate(text, e.quote, pos);
      if (!at || String(e.fix || "").trim().toLowerCase() === String(e.quote || "").trim().toLowerCase()) continue;
      pos = at.offset;
      issues.push({ ...at, message: String(e.explain || "").slice(0, 300), short: "", fix: e.fix ? [String(e.fix).slice(0, 120)] : [],
        type, category: type === "grammar" ? "Grammar" : type === "vocabulary" ? "Word use" : type === "misspelling" ? "Spelling" : "Punctuation", source: "ai" });
    }
    for (const t of Array.isArray(r.target) ? r.target : []) {
      if (!known.has(t.structure)) continue;
      const at = locate(text, t.quote);
      if (!at) continue;
      target.push({ id: t.structure, quote: text.substr(at.offset, at.length), ...at, ok: t.ok !== false, fix: t.ok === false ? String(t.fix || "").slice(0, 120) : "", source: "ai" });
    }
    out[id] = { issues: issues.sort((a, b) => a.offset - b.offset), target: target.sort((a, b) => a.offset - b.offset),
      comment: String(r.comment || "").slice(0, 600), level: /^[ABC][12]$/.test(r.level) ? r.level : "" };
  }
  return out;
}
