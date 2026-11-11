// Grammar checker: the grammar of the module (rules), LanguageTool, the AI check with a key (mocked), the speaking check,
// the feedback the student sees and the Progress measures. Run: python3 -m http.server 5055 -d docs &  node tests/checker.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055";
const SHOTS = process.env.SHOTS || "/tmp/shots-checker";
mkdirSync(SHOTS, { recursive: true });
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const courseText = readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
await ctx.route("**/js/fb.js*", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
let lt = 0, aiCalls = 0, lastPrompt = "";
await ctx.route("https://api.languagetool.org/**", (r) => { lt++; r.fulfill({ contentType: "application/json", headers: cors, body: '{"matches":[]}' }); });
await ctx.route("https://api.groq.com/**", async (r) => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
  const url = r.request().url();
  if (url.endsWith("/models")) return r.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify({ data: [{ id: "openai/gpt-oss-120b" }, { id: "llama-3.3-70b-versatile" }] }) });
  aiCalls++;
  const body = JSON.parse(r.request().postData());
  const user = body.messages.at(-1).content;
  lastPrompt = user;
  if (/\{"ok": true\}/.test(user)) return r.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify({ choices: [{ message: { content: '{"ok": true}' } }] }) });
  const items = JSON.parse(user.match(/STUDENT'S ANSWERS \(JSON, one text per item\):\n(.*)/)[1]);
  const out = { items: {} };
  for (const [id, text] of Object.entries(items)) {
    out.items[id] = {
      errors: [
        ...(/enjoy to swim/i.test(text) ? [{ quote: "enjoy to swim", fix: "enjoy swimming", explain: "After enjoy we use the -ing form.", type: "grammar" }] : []),
        { quote: "words that are not in the text", fix: "x", explain: "invented", type: "grammar" },
      ],
      target: [
        ...(/forget seeing/i.test(text) ? [{ quote: "forget seeing", structure: "gerund_or_inf", ok: true }] : []),
        ...(/enjoy to swim/i.test(text) ? [{ quote: "enjoy to swim", structure: "gerund_verb", ok: false, fix: "enjoy swimming" }] : []),
      ],
      comment: "Good answer! Use the gerund after enjoy.", level: "B1",
    };
  }
  await r.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify({ choices: [{ message: { content: "```json\n" + JSON.stringify(out) + "\n```" } }] }) });
});
const errors = [];
const open = async (url) => { const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(url + ": " + e.message)); p.on("dialog", (d) => d.accept()); await p.goto(BASE + url); return p; };
const step = (x) => console.log("•", x);

const t = await open("/teacher.html");
await t.evaluate(() => {
  localStorage.setItem("mock:auth", JSON.stringify({ "teacher@uni.ru": { uid: "T1", password: "secret1" }, "anna@uni.ru": { uid: "S1", password: "secret1" } }));
  localStorage.setItem("mock:db", JSON.stringify({ "teachers/T1": { name: "Teacher" } }));
});
await t.reload();
await t.fill("#auth-form [name=email]", "teacher@uni.ru"); await t.fill("#auth-form [name=password]", "secret1"); await t.click("#auth-submit");
await t.waitForSelector("#tool-nav .sb-item");
await t.click('a[href="#tools/content"]');
await t.evaluate((c) => { document.querySelector("#import-text").value = c; }, courseText);
await t.click("[data-act=import]"); await t.waitForSelector("#import-status:has-text(\"✓ Imported\")");
await t.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mock:db"));
  d["groups/PA-21"] = { name: "PA-21", openUnits: ["w7", "w8"], releasedUnits: [] };
  d["users/S1"] = { name: "Anna Ivanova", email: "anna@uni.ru", groupId: "PA-21" };
  d["submissions/w8__S1"] = { uid: "S1", groupId: "PA-21", unitId: "w8", status: "draft", updatedAt: { __ts: Date.now() },
    answers: { sp2: { 1: "Er, I will never forget seeing the sea. I enjoy to swim there. Um, it is worth to visit." },
      _speech: { sp2: JSON.stringify({ total: 60, speech: 40, words: 20, wpm: 100, pauses: 2, longest: 1.5, fillers: 2, at: Date.now() }) }, _done: { sp2: "1" } } };
  localStorage.setItem("mock:db", JSON.stringify(d));
});
await t.reload(); await t.waitForSelector("#tool-nav .sb-item");

step("Grammar checker page: the grammar of each week comes from the course file");
await t.click('a[href="#tools/checker"]');
await t.waitForSelector("#try-text");
const ptxt = await t.textContent("#view");
assert.match(ptxt, /Gerund after a preposition/); assert.match(ptxt, /Complex Subject/);

step("Try it with LanguageTool: the course's rules find the mistakes with the gerund");
await t.waitForSelector(`#try-unit option[value="w7"]`, { state: "attached", timeout: 5000 }).catch(async () => { console.log("SELECT", await t.evaluate(() => document.querySelector("#try-unit").outerHTML + " units:" + document.querySelector("#ctx-unit").innerHTML + " hash:" + location.hash)); process.exit(1); });
await t.selectOption("#try-unit", "w7");
await t.fill("#try-text", "I enjoy to swim and it is worth to visit the museum. Swimming is good for you. The house needs painting.");
await t.click("[data-act=try-check]");
await t.waitForSelector("#try-out .wfb");
let out = await t.textContent("#try-out");
assert.match(out, /After “enjoy” use the -ing form/); assert.match(out, /worth visiting/);
assert.match(out, /Gerund as the subject/); assert.match(out, /need \/ want \+ -ing/);
assert.match(out, /Not used yet/);
assert.ok(lt >= 1, "LanguageTool was asked");

step("AI check: the key is kept in this browser, the test and the list of models work");
await t.check('input[name="ai-on"][value="1"]');
await t.waitForSelector("#ai-key");
await t.selectOption("#ai-provider", "groq");
await t.fill("#ai-key", "gsk_test_key"); await t.locator("#ai-key").blur();
await t.waitForTimeout(200);
await t.click("[data-act=ai-test]");
await t.waitForSelector("text=The key works");
await t.click("[data-act=ai-models]");
await t.waitForSelector("text=2 models");
const saved = await t.evaluate(() => JSON.parse(localStorage.getItem("t:aiCheck")));
assert.equal(saved.key, "gsk_test_key"); assert.equal(saved.on, true);
const dbText = await t.evaluate(() => localStorage.getItem("mock:db"));
assert.ok(!dbText.includes("gsk_test_key"), "the key is never in the database");

step("Try it with the AI: comment, level for the teacher, invented quotes are dropped");
await t.fill("#try-text", "I enjoy to swim. I will never forget seeing the sea.");
await t.selectOption("#try-unit", "w8");
await t.fill("#try-text", "I enjoy to swim. I will never forget seeing the sea.");
await t.click("[data-act=try-check]");
await t.waitForSelector("#try-out .wfb-comment");
out = await t.textContent("#try-out");
assert.match(out, /Good answer!/); assert.match(out, /Estimated level \(AI, for the teacher\): B1/);
assert.match(out, /better: “enjoy swimming”/); assert.ok(!out.includes("invented"), "a quote that is not in the text is dropped");
assert.match(lastPrompt, /gerund_or_inf/, "the grammar of the module is sent to the AI");
await t.screenshot({ path: SHOTS + "/1-checker.png", fullPage: true });

step("Check the speaking: the AI and the rules, the feedback is saved for the student");
await t.evaluate(() => { location.hash = "#w8/in-class"; });
await t.waitForSelector('[data-act="check-writing"][data-ex="sp2"]');
await t.click('[data-act="check-writing"][data-ex="sp2"]');
await t.waitForSelector("text=texts checked", { timeout: 20000 });
const fb = await t.evaluate(() => JSON.parse(localStorage.getItem("mock:db"))["exerciseResults/w8__S1"].feedback.sp2["1"]);
assert.equal(fb.engine, "ai"); assert.equal(fb.level, "B1");
assert.ok(fb.target.some((x) => x.id === "gerund_or_inf"));
assert.ok(fb.issues.some((x) => x.rule === "WORTH_TO"), "the course's rule adds what the AI missed");
assert.ok(fb.speech?.total === 60, "the speech measures go with the feedback");

step("The student sees the feedback (without the level)");
const s = await open("/index.html");
await s.fill("#auth-form [name=email]", "anna@uni.ru"); await s.fill("#auth-form [name=password]", "secret1"); await s.click("#auth-submit");
await s.waitForSelector('a[href="#results"]');
await s.evaluate(() => { location.hash = "#w8/in-class"; });
await s.waitForSelector("#ex-sp2 .wfb");
const stxt = await s.textContent("#ex-sp2 .wfb");
assert.match(stxt, /Grammar of the module in your answer/); assert.match(stxt, /Good answer!/);
assert.ok(!/Estimated level/.test(stxt), "the level is for the teacher only");
assert.match(stxt, /with the help of AI/);
await s.locator("#ex-sp2 .wfb").screenshot({ path: SHOTS + "/2-student.png" });

step("Speaking progress: the grammar of the module and hesitations");
await t.click('a[href="#tools/speaking"]');
await t.waitForSelector("#prog-metric");
const opts = await t.$$eval("#prog-metric option", (o) => o.map((x) => x.textContent));
assert.ok(opts.includes("Grammar of the module: uses")); assert.ok(opts.includes("Hesitations (um, er) per minute"));
await t.selectOption("#prog-metric", { label: "Grammar of the module: uses" });
await t.waitForTimeout(300);
await t.click(".t.prog tbody a[data-act=prog-open]");
await t.waitForSelector("#prog-detail");
const det = await t.textContent("#prog-detail");
assert.match(det, /Grammar of the module/); assert.match(det, /Hesitations/); assert.match(det, /Estimated level \(AI\)B1/);

assert.deepEqual(errors, [], "no errors on the pages");
console.log("ALL OK");
await browser.close();
