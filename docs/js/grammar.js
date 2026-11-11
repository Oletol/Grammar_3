// The grammar of the module in students' writing and speaking (the text Whisper wrote from a recording).
// 1. Which structures of the module the student has used (the gerund, the infinitive, Participle I …).
// 2. Typical learners' mistakes with these structures, which the general grammar checkers miss
//    ("enjoy to swim", "suggested me to go", "worth to visit", "look forward to see", "want that he comes").
// Everything is found by patterns, without a dictionary of parts of speech, so the result is approximate:
// it shows the teacher and the student where the structures are, the teacher has the last word.
// The structures of a module: "grammar": [...] in the unit (course.json), or in one exercise.

// ------------------------------------------------------------------ the structures
export const STRUCTURES = [
  // the gerund
  { id: "gerund_prep", label: "Gerund after a preposition", eg: "interested in learning, look forward to seeing" },
  { id: "gerund_verb", label: "Verb + gerund", eg: "enjoy swimming, avoid making, can't help laughing" },
  { id: "gerund_subject", label: "Gerund as the subject", eg: "Swimming is good for you." },
  { id: "need_doing", label: "need / want + -ing, be worth + -ing", eg: "The house needs painting. It's worth visiting." },
  { id: "gerund_perfect", label: "Perfect gerund", eg: "He denied having taken the money." },
  { id: "gerund_passive", label: "Passive gerund", eg: "She hates being interrupted." },
  { id: "gerund_construction", label: "Gerundial construction", eg: "Excuse my interrupting you. I insist on his coming." },
  { id: "gerund_or_inf", label: "Gerund or infinitive: a change of meaning", eg: "I remember locking the door. Remember to lock the door." },
  // the infinitive
  { id: "inf_perfect", label: "Perfect infinitive", eg: "to have done, must have forgotten" },
  { id: "inf_passive", label: "Passive infinitive", eg: "to be done, must be finished" },
  { id: "inf_continuous", label: "Continuous infinitive", eg: "to be reading, must be working" },
  { id: "complex_object", label: "Complex Object", eg: "I want him to come. I saw her cross the street." },
  { id: "complex_subject", label: "Complex Subject", eg: "He is said to be ill. She seems to know it." },
  { id: "for_to", label: "for-to-infinitive construction", eg: "It's time for us to go." },
  // Participle I
  { id: "part1_adverbial", label: "Participle I as an adverbial modifier", eg: "Opening the door, she saw … · while reading" },
  { id: "part1_perfect", label: "Perfect Participle I", eg: "Having finished the work, he went home." },
  { id: "part1_passive", label: "Passive Participle I", eg: "Being asked, he answered. Having been told …" },
  { id: "part1_attribute", label: "Participle I as an attribute", eg: "the man sitting at the window" },
];
export const STRUCT = Object.fromEntries(STRUCTURES.map((s) => [s.id, s]));

// ------------------------------------------------------------------ words
const forms = (base) => {
  const b = base.toLowerCase();
  const out = new Set([b]);
  const cons = /[^aeiou][aeiou][bdgmnprt]$/.test(b) && !/(en|er|it|on)$/.test(b.slice(-2)) ? b + b.slice(-1) : null;
  out.add(/(s|sh|ch|x|z|o)$/.test(b) ? b + "es" : /[^aeiou]y$/.test(b) ? b.slice(0, -1) + "ies" : b + "s");
  out.add(b.endsWith("e") ? b + "d" : /[^aeiou]y$/.test(b) ? b.slice(0, -1) + "ied" : (cons || b) + "ed");
  out.add(/ie$/.test(b) ? b.slice(0, -2) + "ying" : /[^e]e$/.test(b) && !/(ee|ye|oe)$/.test(b) ? b.slice(0, -1) + "ing" : (cons || b) + "ing");
  return [...out];
};
const alt = (list) => list.map((x) => x.replace(/ /g, "\\s+")).join("|");
const IRR = {
  keep: ["kept"], deny: ["denied"], admit: ["admitted", "admitting"], quit: ["quitted", "quitting"], forget: ["forgot", "forgotten", "forgetting"],
  stop: ["stopped", "stopping"], regret: ["regretted", "regretting"], begin: ["began", "begun", "beginning"], mean: ["meant"],
  prefer: ["preferred", "preferring"], see: ["saw", "seen"], hear: ["heard"], feel: ["felt"], make: ["made"], let: ["let"],
  have: ["has", "had"], know: ["knew", "known"], find: ["found"], think: ["thought"], tell: ["told"], get: ["got", "gotten", "getting"],
  give: ["gave", "given"], put: ["put", "putting"], go: ["went", "gone", "goes"], understand: ["understood"], forgive: ["forgave", "forgiven"],
};
const vforms = (...bases) => bases.flatMap((b) => {
  const parts = b.split(" ");
  if (parts.length > 1) { const [v, ...rest] = parts; return [...forms(v), ...(IRR[v] || [])].map((f) => [f, ...rest].join(" ")); }
  return [...forms(b), ...(IRR[b] || [])];
});

// past participles (V3): regular -ed and the common irregular verbs
const V3_IRR = ("been born borne beaten become begun bent bet bitten bled blown broken brought built burnt bought caught chosen come cost crept cut dealt dug done " +
  "drawn dreamt drunk driven eaten fallen fed felt fought found fled flown forbidden forgotten forgiven frozen got gotten given gone ground grown hung had heard hidden hit " +
  "held hurt kept knelt known laid led learnt left lent let lain lit lost made meant met paid put quit read ridden rung risen run said seen sought sold sent set shaken shone " +
  "shot shown shut sung sunk sat slept slid spoken spent spilt split spread stood stolen stuck stung struck sworn swept swum swung taken taught torn told thought thrown " +
  "understood woken worn wept won wound written").split(" ");
const V3 = `(?:[a-z]+ed|${V3_IRR.join("|")})`;

// -ing words that are not verb forms
const NOT_ING = new Set(("thing things nothing something anything everything morning mornings evening evenings during ceiling king kings ring rings spring string " +
  "bring sing wing wings sting swing cling fling sling pudding sibling darling shilling building buildings wedding weddings meeting meetings ending endings " +
  "beginning painting paintings feeling feelings including according regarding concerning interesting boring amazing exciting surprising").split(" "));
const ING = `([a-z]{2,}ing)`;
const isIng = (w) => !!w && /^[a-z]{2,}ing$/i.test(w) && !NOT_ING.has(w.toLowerCase());

// verbs that are hardly ever nouns: after "to" they must be the infinitive
const BASE = new Set(("go come see read write learn speak say tell swim eat drink buy sell meet leave make take give think know understand do get find forget " +
  "remember explain spend pay wait ask listen live become begin bring build choose close cook cry decide enter feel finish fly grow hear improve invite keep " +
  "laugh lose marry open prepare receive repair send sing sit sleep solve stay steal teach translate visit wear win apologise apologize borrow break catch " +
  "clean collect compare continue describe discuss drive earn fix follow hide hurry imagine lend mention notice obey phone practise protect prove reach " +
  "realise realize recognise recognize refuse repeat ride save shout speak succeed suggest tell thank throw wake wash achieve admit agree allow arrive " +
  "behave believe belong carry climb communicate complain complete convince create deliver depend destroy develop die disappear discover download " +
  "encourage escape exist expect explore forgive gather happen hate hesitate hire hope hunt identify include inform interrupt introduce join jump kiss " +
  "knock lift manage memorise memorize organise organize participate perform persuade pick pray pretend provide publish punish quit recommend reduce " +
  "relax remain remove rely rescue respond retire scream seek shoot spell survive tidy treat upset warn wonder worry wrap argue fall cross " +
  "jump laugh smile be have").split(" "));
const isBase = (w) => BASE.has(String(w || "").toLowerCase());

const PREPS = ["of", "in", "on", "at", "about", "for", "without", "after", "before", "by", "from", "against", "upon", "instead of", "besides", "despite", "apart from", "through", "on the point of", "in spite of", "with a view to"];
const TO_PREP = ["look forward to", "looking forward to", "looked forward to", "looks forward to", "object to", "objects to", "objected to", "objecting to",
  "(?:be|am|is|are|was|were|been|being|get|gets|got|getting|become|became)\\s+used\\s+to", "accustomed to", "in addition to", "when it comes to", "devoted to", "committed to", "confess to", "confessed to", "admit to", "admitted to",
  "contribute to", "contributed to", "key to", "prefer \\w+ to"].map((x) => x.replace(/ /g, "\\s+"));
// "used to" is a preposition only after be / get: "I am used to getting up early" (not "I used to get up")
const GERUND_VERBS = vforms("enjoy", "avoid", "mind", "suggest", "finish", "keep", "deny", "admit", "consider", "imagine", "risk", "miss", "postpone",
  "practise", "practice", "recommend", "mention", "appreciate", "delay", "dislike", "detest", "resent", "resist", "tolerate", "quit", "fancy",
  "give up", "put off", "keep on", "carry on").concat(["can't help", "cannot help", "couldn't help", "can not help", "could not help", "can't stand", "cannot stand", "couldn't stand"]);
const GI_VERBS = vforms("remember", "forget", "regret", "stop", "try", "go on", "mean");
const OBJ = `(?:me|you|him|her|it|us|them|(?:the|my|your|his|her|our|their|this|that|these|those)\\s+[a-z]+)`;
const POSS = `(?:my|your|his|her|its|our|their|me|him|them|us|[A-Z][a-z]+'s|[a-z]+'s|the\\s+[a-z]+'s)`;
const MODAL = `(?:to|must|should|could|might|may|would|will|can|can't|cannot|couldn't|needn't|shouldn't|wouldn't|mustn't|ought\\s+to)`;
const NOT_PASSIVE = new Set("tired interested bored excited worried surprised pleased scared married used supposed allowed going".split(" "));

// ------------------------------------------------------------------ the patterns
// each pattern: [structure id, regular expression] — the match is the part of the text that is shown
const R = (src) => new RegExp(src, "gi");
const PREP_RE = `(?:${alt(PREPS)}|${TO_PREP.join("|")})`;
const PATTERNS = [
  ["part1_passive", R(`(?:^|(?<=[.!?;]\\s*))\\s*(?:not\\s+)?(?:having\\s+been|being)\\s+${V3}\\b`)],
  ["part1_perfect", R(`(?:^|(?<=[.!?;]\\s*))\\s*(?:not\\s+)?having\\s+${V3}\\b`)],
  ["gerund_construction", R(`\\b(?:${PREP_RE}|${alt(GERUND_VERBS)}|${alt(vforms("excuse", "forgive", "understand", "remember"))})\\s+${POSS}\\s+(?:not\\s+)?(?:being\\s+|having\\s+(?:been\\s+)?)?(?:[a-z]{2,}ing|${V3})\\b`)],
  ["gerund_passive", R(`\\b(?:${PREP_RE}|${alt(GERUND_VERBS)}|${alt(vforms("hate", "like", "love", "remember", "fear"))})\\s+(?:not\\s+)?(?:being|having\\s+been)\\s+${V3}\\b`)],
  ["gerund_perfect", R(`\\b(?:${PREP_RE}|${alt(GERUND_VERBS)}|${alt(vforms("remember", "regret"))})\\s+(?:not\\s+)?having\\s+${V3}\\b`)],
  ["need_doing", R(`\\b(?:${alt(vforms("need", "want", "require", "deserve"))})\\s+${ING}\\b|\\bworth\\s+(?:while\\s+)?${ING}\\b`)],
  ["gerund_or_inf", R(`\\b(?:${alt(GI_VERBS)})\\s+(?:not\\s+)?(?:to\\s+[a-z]+|${ING})\\b`)],
  ["gerund_verb", R(`\\b(?:${alt(GERUND_VERBS)})\\s+(?:not\\s+)?${ING}\\b`)],
  ["gerund_prep", R(`\\b(?:${alt(PREPS)}|${TO_PREP.join("|")}|(?:it's|it\\s+is|there's|there\\s+is)\\s+no\\s+(?:use|good|point\\s+in))\\s+(?:not\\s+)?${ING}\\b`)],
  ["inf_perfect", R(`\\b${MODAL}\\s+(?:not\\s+)?have\\s+(?:been\\s+)?${V3}\\b`)],
  ["inf_continuous", R(`\\b${MODAL}\\s+(?:not\\s+)?(?:have\\s+been|be)\\s+${ING}\\b`)],
  ["inf_passive", R(`\\b${MODAL}\\s+(?:not\\s+)?be\\s+(${V3})\\b`)],
  ["complex_subject", R(`\\b(?:is|are|was|were|be|been|isn't|aren't|wasn't|weren't)\\s+(?:said|reported|believed|known|thought|supposed|expected|considered|understood|announced|alleged|claimed|seen|heard|made|allowed|asked|told|ordered|likely|unlikely|sure|certain|bound)\\s+(?:not\\s+)?to\\s+[a-z]+\\b|\\b(?:${alt(vforms("seem", "appear", "happen", "prove", "turn out", "chance"))})\\s+(?:not\\s+)?to\\s+[a-z]+\\b`)],
  ["complex_object", R(`\\b(?:${alt(vforms("want", "expect", "wish", "ask", "tell", "allow", "order", "advise", "force", "encourage", "invite", "believe", "suppose", "like", "hate", "prefer", "cause", "get", "need", "consider", "know", "find"))}|would\\s+like|'d\\s+like)\\s+${OBJ}\\s+(?:not\\s+)?to\\s+[a-z]+\\b|\\b(?:${alt(vforms("see", "watch", "hear", "feel", "notice", "observe"))})\\s+${OBJ}\\s+(?:[a-z]{2,}ing|[a-z]+)\\b|\\b(?:${alt(vforms("make", "let", "have"))})\\s+${OBJ}\\s+[a-z]+\\b`)],
  ["for_to", R(`\\bfor\\s+${OBJ}\\s+(?:not\\s+)?to\\s+[a-z]+\\b`)],
  ["gerund_subject", R(`(?:^|(?<=[.!?,]\\s*))\\s*${ING}\\b(?:\\s+[a-z']+){0,6}?\\s+(?:is|was|isn't|wasn't|has|can|could|will|would|may|might|makes|made|helps|helped|takes|took|seems|seemed|requires|gives|gave|becomes|became)\\b`)],
  ["part1_adverbial", R(`(?:^|(?<=[.!?;]\\s*))\\s*(?:not\\s+)?${ING}\\b[^.!?,]{0,60},|\\b(?:when|while|whilst)\\s+${ING}\\b|,\\s+(?:not\\s+)?${ING}\\b`)],
  ["part1_attribute", R(`\\b(?:the|a|an|this|that|these|those|some|many|all|two|three)\\s+(?:[a-z]+\\s+){0,2}?([a-z]+)\\s+${ING}\\b`)],
];

const AUX = new Set("is am are was were be been being have has had do does did will would can could shall should may might must not to and or but of in on at for with by from about".split(" "));
function accept(id, m, text) {
  const s = m[0];
  // ", swimming is good": the -ing word after a comma is the subject of what follows, not a participle
  // a list of -ing forms ("feeding, walking and playing"): not a participle
  if (id === "part1_adverbial" && /^,/.test(s) && /ing\s*$/i.test(text.slice(0, m.index))) return false;
  if (id === "part1_adverbial" && /^,/.test(s) && /^[^.!?,;]{0,50}?\b(?:is|was|are|were|isn't|wasn't|has|makes|helps|takes|seems|can|will)\b/i.test(text.slice(m.index + s.length))) return false;
  const words = s.toLowerCase().match(/[a-z']+/g) || [];
  const ings = words.filter((w) => /ing$/.test(w));
  // an -ing word that is not a verb form ("in the morning", "for nothing")
  if (["gerund_prep", "gerund_verb", "need_doing", "part1_adverbial", "gerund_subject", "part1_attribute", "gerund_or_inf"].includes(id) && ings.length && !ings.some(isIng)) return false;
  if (id === "part1_adverbial" && /^(?:\s*)(?:having|being)\b/i.test(s)) return false;
  if (id === "part1_adverbial" && /,\s+(?:including|according|regarding|concerning)\b/i.test(s)) return false;
  if (id === "gerund_subject" && /,/.test(s)) return false;
  if (id === "part1_attribute") {
    const before = (m[1] || "").toLowerCase();
    if (AUX.has(before) || PREPS.includes(before) || /ing$/.test(before)) return false;
    // "the electric wiring needs …": an -ing noun followed by the verb of the sentence is not a participle
    if (/^\s+(?:is|was|are|were|needs|need|has|have|had|will|would|can|could|must|should|may|might|seems|looks)\b/i.test(text.slice(m.index + s.length))) return false;
  }
  if (id === "inf_passive") { const w = (m[1] || "").toLowerCase(); if (NOT_PASSIVE.has(w)) return false; }
  if (id === "complex_object") {
    const last = words[words.length - 1];
    // perception and causative verbs: the word after the object must be a verb (see him go, make her laugh)
    if (!/\bto\s+[a-z]+$/i.test(s) && !isBase(last) && !isIng(last)) return false;
    if (/\b(?:to)\s+(?:the|a|an|my|your|his|her|our|their)$/i.test(s)) return false;
  }
  if (id === "for_to" && /\bto\s+(?:the|a|an|my|your|his|her|our|their|me|him|us|them)$/i.test(s)) return false;
  if (id === "gerund_or_inf" && /\bto\s+(?:the|a|an|my|your|his|her|our|their|me|him|us|them)$/i.test(s)) return false;
  if (id === "complex_subject" && /\bto\s+(?:the|a|an|my|your|his|her|our|their|me|him|us|them)$/i.test(s)) return false;
  return true;
}

// ------------------------------------------------------------------ typical mistakes with the module's grammar
const ERR = [
  { rule: "GER_AFTER_VERB", re: R(`\\b(${alt(GERUND_VERBS)})\\s+(?:not\\s+)?to\\s+([a-z]+)\\b`), ok: (m) => isBase(m[2]),
    msg: (m) => `After “${m[1].replace(/\s+/g, " ")}” use the -ing form, not the infinitive.`, fix: (m) => `${m[1].replace(/\s+/g, " ")} ${ingOf(m[2])}` },
  { rule: "SUGGEST_SB_TO", re: R(`\\b(${alt(vforms("suggest", "recommend", "propose", "insist"))})\\s+(me|you|him|her|us|them)\\s+to\\s+([a-z]+)\\b`), ok: (m) => isBase(m[3]),
    msg: (m) => `“${m[1]} somebody to do” is not used. Say “${m[1]} that ${subj(m[2])} (should) ${m[3]}”${/insist/i.test(m[1]) ? ` or “${m[1]} on ${poss(m[2])} ${ingOf(m[3])}”` : ` or “${m[1]} ${ingOf(m[3])}”`}.`,
    fix: (m) => /insist/i.test(m[1]) ? `${m[1]} on ${poss(m[2])} ${ingOf(m[3])}` : `${m[1]} that ${subj(m[2])} should ${m[3]}` },
  { rule: "PREP_BASE", re: R(`\\b(${alt(PREPS.filter((p) => !["through", "against", "upon", "with a view to"].includes(p)))}|${TO_PREP.join("|")}|(?:be|am|is|are|was|were|get|got)\\s+used\\s+to)\\s+([a-z]+)\\b`),
    ok: (m) => isBase(m[2]) && !["be", "have"].includes(m[2].toLowerCase()) || (/^(?:be|have)$/i.test(m[2]) && /\bto$/i.test(m[1])),
    msg: (m) => `After the preposition “${m[1].replace(/\s+/g, " ").replace(/^.*\s/, "")}” use the gerund (-ing form).`, fix: (m) => `${m[1].replace(/\s+/g, " ")} ${ingOf(m[2])}` },
  { rule: "SB_TO_AFTER_GERUND_VERB", re: R(`\\b(${alt(vforms("remember", "imagine", "mind", "excuse", "forgive", "appreciate", "risk", "understand"))})\\s+(me|you|him|her|us|them)\\s+to\\s+([a-z]+)\\b`), ok: (m) => isBase(m[3]),
    msg: (m) => `After “${m[1]}” use a gerundial construction: ${m[1]} ${m[2]} (or ${poss(m[2])}) ${ingOf(m[3])}.`, fix: (m) => `${m[1]} ${m[2]} ${ingOf(m[3])}` },
  { rule: "ADJ_PREP_GERUND", re: R(`\\b(fond|tired|capable|interested|keen|good|bad|proud|responsible|famous|guilty|sick|aware|ashamed|excited|worried|nervous|successful)\\s+(?:of\\s+|in\\s+|on\\s+|at\\s+|for\\s+|about\\s+)?to\\s+([a-z]+)\\b`),
    ok: (m) => isBase(m[2]) && !/^(good|bad|proud|ashamed|excited|worried|nervous)$/i.test(m[1]),
    msg: (m) => `Say “${m[1]} ${ADJ_PREP[m[1].toLowerCase()]} ${ingOf(m[2])}”: after this adjective comes a preposition and the gerund.`, fix: (m) => `${m[1]} ${ADJ_PREP[m[1].toLowerCase()]} ${ingOf(m[2])}` },
  { rule: "NEED_TO_DO_PASSIVE", re: R(`\\b(${alt(vforms("need", "want", "require"))})\\s+to\\s+(repair|paint|clean|wash|fix|tidy|cut|redecorate|mend|check|iron|water|change|replace|polish|dust|sweep|decorate|empty|feed)(?=\\s*(?:[.,;!?]|$|\\s(?:and|but|or|because|so|now|soon|again|today|immediately|badly|urgently|first|too)\\b))`), ok: () => true,
    msg: (m) => `If the thing itself is to be ${m[2]}ed, say “${m[1]} ${ingOf(m[2])}” or “${m[1]} to be ${pp(m[2])}”.`, fix: (m) => `${m[1]} ${ingOf(m[2])}` },
  { rule: "WORTH_TO", re: R(`\\b(worth|busy)\\s+(?:to\\s+)?([a-z]+)\\b`), ok: (m) => isBase(m[2]),
    msg: (m) => `After “${m[1]}” use the -ing form: ${m[1]} ${ingOf(m[2])}.`, fix: (m) => `${m[1]} ${ingOf(m[2])}` },
  { rule: "NO_USE_TO", re: R(`\\b((?:it's|it\\s+is|it\\s+was)\\s+no\\s+(?:use|good)|(?:there's|there\\s+is|there\\s+was)\\s+no\\s+point)\\s+(?:in\\s+)?to\\s+([a-z]+)\\b`), ok: (m) => isBase(m[2]),
    msg: (m) => `Say “${m[1].replace(/\s+/g, " ")}${/point/i.test(m[1]) ? " in" : ""} ${ingOf(m[2])}”.`, fix: (m) => `${m[1].replace(/\s+/g, " ")}${/point/i.test(m[1]) ? " in" : ""} ${ingOf(m[2])}` },
  { rule: "WANT_THAT", re: R(`\\b(${alt(vforms("want"))}|would\\s+like|'d\\s+like)\\s+(?:that\\s+)(I|you|he|she|it|we|they)\\s+([a-z]+)\\b`), ok: () => true,
    msg: (m) => `Use the Complex Object: “${m[1].replace(/\s+/g, " ")} ${obj(m[2])} to …”, not “${m[1].replace(/\s+/g, " ")} that ${m[2]} …”.`, fix: (m) => `${m[1].replace(/\s+/g, " ")} ${obj(m[2])} to ${baseOf(m[3])}` },
  { rule: "MAKE_SB_TO", re: R(`\\b(${alt(vforms("make", "let", "see", "watch", "hear", "notice"))})\\s+(me|you|him|her|it|us|them)\\s+to\\s+([a-z]+)\\b`), ok: (m) => isBase(m[3]),
    msg: (m) => `After “${m[1]} ${m[2]}” use the infinitive without “to”: ${m[1]} ${m[2]} ${m[3]}.`, fix: (m) => `${m[1]} ${m[2]} ${m[3]}` },
];
const ingOf = (v) => {
  const b = String(v).toLowerCase();
  if (b === "be") return "being"; if (b === "have") return "having";
  if (/ie$/.test(b)) return b.slice(0, -2) + "ying";
  if (/[^e]e$/.test(b) && !/(ee|ye|oe)$/.test(b)) return b.slice(0, -1) + "ing";
  if (/^[^aeiou]*[aeiou][bdgmnprt]$/.test(b) && b.length <= 4) return b + b.slice(-1) + "ing";
  return b + "ing";
};
const subj = (o) => ({ me: "I", you: "you", him: "he", her: "she", us: "we", them: "they" }[o.toLowerCase()] || o);
const obj = (s) => ({ i: "me", you: "you", he: "him", she: "her", it: "it", we: "us", they: "them" }[s.toLowerCase()] || s);
const poss = (o) => ({ me: "my", you: "your", him: "his", her: "her", us: "our", them: "their" }[o.toLowerCase()] || o);
const baseOf = (v) => { const w = String(v); return /(?:ss|sh|ch|x|z|o)es$/i.test(w) ? w.slice(0, -2) : /[^aeiou]ies$/i.test(w) ? w.slice(0, -3) + "y" : /[^s]s$/i.test(w) ? w.slice(0, -1) : w; };
const ADJ_PREP = { fond: "of", tired: "of", capable: "of", interested: "in", keen: "on", good: "at", bad: "at", proud: "of", responsible: "for", famous: "for",
  guilty: "of", sick: "of", aware: "of", ashamed: "of", excited: "about", worried: "about", nervous: "about", successful: "in" };
const pp = (v) => ({ cut: "cut", feed: "fed" }[v.toLowerCase()] || (/e$/.test(v) ? v + "d" : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + "ied" : v + "ed"));

// ------------------------------------------------------------------ the analysis
// want: the ids of the module's structures (empty: all of them). Returns
// { found: [{id, label, quote, offset, length}], counts: {id: n}, used: [id], missing: [id], errors: [issue …] }
export function analyse(text, want = []) {
  text = String(text || "");
  const found = [];
  const taken = [];          // parts of the text already given to a structure (the first, more specific pattern wins)
  for (const [id, re] of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      let start = m.index, quote = m[0];
      const lead = quote.length - quote.trimStart().length;
      start += lead; quote = quote.trim().replace(/,$/, "");
      if (!quote || !accept(id, m, text)) continue;
      const end = start + quote.length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      taken.push([start, end]);
      found.push({ id, label: STRUCT[id].label, quote, offset: start, length: quote.length });
    }
  }
  found.sort((a, b) => a.offset - b.offset);
  const ids = want?.length ? want : STRUCTURES.map((s) => s.id);
  const mine = found.filter((f) => ids.includes(f.id));
  const counts = {};
  for (const f of mine) counts[f.id] = (counts[f.id] || 0) + 1;
  const errors = [];
  for (const e of ERR) {
    e.re.lastIndex = 0;
    for (const m of text.matchAll(e.re)) {
      if (!e.ok(m)) continue;
      errors.push({ offset: m.index, length: m[0].length, message: e.msg(m), short: "Grammar of the module", fix: [e.fix(m)],
        type: "grammar", category: "Grammar of the module", rule: e.rule, source: "rules" });
    }
  }
  errors.sort((a, b) => a.offset - b.offset);
  return { found: mine, counts, used: Object.keys(counts), missing: want?.length ? want.filter((id) => !counts[id]) : [], errors };
}

// The module's structures for an exercise: the exercise's own list, otherwise the unit's.
export function grammarOf(ex, unitMeta) {
  const list = Array.isArray(ex?.grammar) ? ex.grammar : Array.isArray(unitMeta?.grammar) ? unitMeta.grammar : [];
  return list.filter((id) => STRUCT[id]);
}
