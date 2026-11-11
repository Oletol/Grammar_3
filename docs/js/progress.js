// Measures of students' speaking (Whisper transcripts) and writing, for the Progress page of the Teacher's Edition
// and for the CSV export used in research. Everything is computed in the teacher's browser.
import { tokens, lemma, vocabProfile, expandToken } from "./writing.js?v=20261111c";
import { analyse } from "./grammar.js?v=20261111c";
import { FILLERS } from "./transcribe.js?v=20261111c";

// Writing that is followed over time: every written open exercise the teacher checks ("check": "teacher") –
// letters and essays, own sentences, translations; "track": "writing" adds an exercise, "track": false leaves it out.
// Exercises with several items are measured as one text: all the student's answers together.
export function isWritingTask(ex) {
  if (ex.kind !== "open" || ex.transcript || ex.graded === false || ex.track === false) return false;
  return ex.track === "writing" || ex.check === "teacher";
}

// Subordinating words: a simple, transparent index of syntactic complexity
const SUBORD = new Set(("because although though whereas while whilst unless since if when whenever where wherever whether which who whom whose that " +
  "so once until till before after as provided").split(" "));

// Moving-average type-token ratio (Covington & McFall, 2010): does not depend on text length as plain TTR does
export function mattr(lemmas, w = 50) {
  if (!lemmas.length) return 0;
  if (lemmas.length <= w) return new Set(lemmas).size / lemmas.length;
  const cnt = new Map();
  let uniq = 0, sum = 0;
  const add = (x, d) => { const n = (cnt.get(x) || 0) + d; cnt.set(x, n); if (d > 0 && n === 1) uniq++; if (d < 0 && n === 0) uniq--; };
  for (let i = 0; i < w; i++) add(lemmas[i], 1);
  sum += uniq / w;
  for (let i = w; i < lemmas.length; i++) { add(lemmas[i], 1); add(lemmas[i - w], -1); sum += uniq / w; }
  return sum / (lemmas.length - w + 1);
}

const r1 = (x) => Math.round(x * 10) / 10;
const r3 = (x) => Math.round(x * 1000) / 1000;

// text – the answer; phrases – the task (or unit) phrases; fb – the LanguageTool check saved by the teacher, if any;
// sp – what the recorder measured {speech, total, wpm, pauses, longest, at}
// gids – the structures of the module (grammar.js): how often and how many of them the student used
export function measure(text, V, phrases, fb, sp, gids = []) {
  text = String(text || "");
  const fillers = (text.match(FILLERS) || []).length;
  const clean = text.replace(FILLERS, " ");
  const prof = vocabProfile(clean, V, phrases);
  const toks = tokens(clean).flatMap(expandToken).filter((t) => t && t.length > 0);
  const lemmas = toks.map((t) => lemma(t, V.levels));
  const words = prof.words;
  const leveled = Object.values(prof.counts).reduce((a, b) => a + b, 0) || 1;
  // sentences end with . ! ? or a line break (the answers of a several-item exercise are joined by line breaks)
  const sentences = Math.max(1, clean.split(/[.!?]+|\n+/).filter((x) => /[A-Za-z]/.test(x)).length);
  const sub = toks.filter((t) => SUBORD.has(t)).length;
  // the check counts only if it was made on this very text
  const fresh = !!fb && !fb.grammarError && String(fb.text || "").trim() === text.trim();
  const issues = fresh ? fb.issues || [] : null;
  const gram = issues ? issues.filter((i) => i.type === "grammar" || /grammar/i.test(i.category || "")).length : null;
  const accuracy = issues ? issues.filter((i) => !["typographical", "whitespace", "style"].includes(i.type)).length : null;
  const total = Number(sp?.total) || 0;
  // the grammar of the module: the check saved with the feedback (AI or rules) if it was made on this text, otherwise the rules now
  const tg = gids.length ? (fresh && Array.isArray(fb.target) ? fb.target.filter((t) => gids.includes(t.id)) : analyse(clean, gids).found) : [];
  return {
    words,
    speech: Number(sp?.speech) || 0,
    total,
    wpm: Number(sp?.wpm) || null,
    pauses: sp ? Number(sp.pauses) || 0 : null,
    pausesPerMin: sp && total ? r1(((Number(sp.pauses) || 0) * 60) / total) : null,
    longest: sp ? Number(sp.longest) || 0 : null,
    ttr: words ? r3(new Set(lemmas).size / lemmas.length) : 0,
    mattr: r3(mattr(lemmas)),
    b2plus: r1((100 * (prof.counts.B2 + prof.counts.C1 + prof.counts.C2)) / leveled),
    c1plus: r1((100 * (prof.counts.C1 + prof.counts.C2)) / leveled),
    phrases: prof.unitUsed.length,
    phraseList: prof.unitUsed,
    sentLen: r1(words / sentences),
    subPer100: words ? r1((100 * sub) / words) : 0,
    targetUses: gids.length ? tg.length : null,
    targetKinds: gids.length ? new Set(tg.map((t) => t.id)).size : null,
    targetWrong: gids.length ? tg.filter((t) => t.ok === false).length : null,
    targetList: [...new Set(tg.map((t) => t.id))],
    fillers,
    fillersPerMin: sp && total ? r1((fillers * 60) / total) : null,
    level: fresh ? fb.level || "" : "",
    ltChecked: fresh,
    ltStale: !!fb && !fb.grammarError && !fresh,
    ltAll: issues ? issues.length : null,
    ltGrammar: gram,
    errPer100: issues && words ? r1((100 * accuracy) / words) : null,
    checkedText: fb?.text || "",
  };
}

// measures shown on the page (dir: +1 = higher is better, -1 = lower is better)
export const METRICS = [
  { id: "words", label: "Words", dir: 1 },
  { id: "wpm", label: "Words per minute", dir: 1, skill: "speaking" },
  { id: "pausesPerMin", label: "Pauses longer than 1 s, per minute", dir: -1, skill: "speaking" },
  { id: "errPer100", label: "Errors per 100 words (after the check)", dir: -1 },
  { id: "targetUses", label: "Grammar of the module: uses", dir: 1 },
  { id: "targetKinds", label: "Grammar of the module: different structures", dir: 1 },
  { id: "fillersPerMin", label: "Hesitations (um, er) per minute", dir: -1, skill: "speaking" },
  { id: "mattr", label: "Lexical diversity (MATTR-50)", dir: 1 },
  { id: "b2plus", label: "B2+ words, % of listed words", dir: 1 },
  { id: "phrases", label: "Task / unit phrases used", dir: 1 },
  { id: "subPer100", label: "Subordinating words per 100 words", dir: 1 },
  { id: "sentLen", label: "Words per sentence", dir: 1, skill: "writing" },
];

export const CSV_COLS = ["code", "student", "group", "skill", "unit", "task_no", "exercise", "task_title", "setting", "pair", "partner", "recorded_by", "date", "submitted",
  "words", "speech_s", "recording_s", "wpm", "pauses", "pauses_per_min", "longest_pause_s", "ttr", "mattr50", "b2plus_pct", "c1plus_pct",
  "phrases", "phrase_list", "words_per_sentence", "subordinators_per100", "module_grammar_uses", "module_grammar_kinds", "module_grammar_wrong", "module_grammar_list",
  "hesitations", "hesitations_per_min", "ai_level", "lt_checked", "lt_issues_all", "lt_grammar", "errors_per100", "text", "text_at_check"];

export function toCSV(rows) {
  const q = (v) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => q(r[c])).join(","))].join("\r\n");
}
