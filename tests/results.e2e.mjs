// Results reach the students: answers are saved without Done, the check of one exercise shows the marks,
// "My results", no model answers for paraphrases, answers that missed a check come back, Analytics for all weeks.
// Run: python3 -m http.server 5055 -d docs &  node tests/results.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055";
const SHOTS = process.env.SHOTS || "/tmp/shots-results";
mkdirSync(SHOTS, { recursive: true });
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const courseText = readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8");
const course = JSON.parse(courseText);
const exOf = (u, id) => course.units.find((x) => x.id === u).sections.flatMap((s) => s.blocks).find((b) => b.id === id);
const key = (u, ex, it) => { const a = exOf(u, ex).items.find((x) => String(x.id) === String(it)).answer; return Array.isArray(a) ? a[0] : a; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
await ctx.route("**/js/fb.js*", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
const errors = [];
const open = async (url) => { const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(url + ": " + e.message)); p.on("dialog", (d) => d.accept()); await p.goto(BASE + url); return p; };
const step = (x) => console.log("•", x);
const sel = (ex, it) => `[data-ex="${ex}"][data-item="${it}"]`;
const db = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("mock:db")));

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
await t.click('a[href="#tools/groups"]'); await t.waitForSelector("#g-name");
await t.fill("#g-name", "PA-21"); await t.fill("#g-code", "PA-21"); await t.click("[data-act=create-group]");
await t.waitForSelector("td:has-text('PA-21')");
await t.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mock:db"));
  d["groups/PA-21"].openUnits = ["w7", "w8"];
  d["users/S1"] = { name: "Anna Ivanova", email: "anna@uni.ru", groupId: "PA-21" };
  d["users/S2"] = { name: "Boris Petrov", email: "boris@uni.ru", groupId: "PA-21" };
  localStorage.setItem("mock:db", JSON.stringify(d));
});
await t.reload(); await t.waitForSelector("#tool-nav .sb-item");

step("The student answers without clicking Done: the answers are saved in the database");
const s = await open("/index.html");
await s.fill("#auth-form [name=email]", "anna@uni.ru"); await s.fill("#auth-form [name=password]", "secret1"); await s.click("#auth-submit");
await s.waitForSelector('a[href="#results"]');
await s.evaluate(() => { location.hash = "#w7/home-assignment"; });
await s.waitForSelector(sel("s6", "1"));
await s.fill(sel("s6", "1"), key("w7", "s6", "1"));
await s.fill(sel("s6", "2"), "wrong answer");
await s.locator("#save-state", { hasText: /Saved/ }).waitFor({ timeout: 8000 });
assert.equal((await db(s))["submissions/w7__S1"]?.answers?.s6?.["2"], "wrong answer", "saved before Done");

step("The teacher checks the exercise: the student sees the marks at once");
await t.evaluate(() => { location.hash = "#w7/home-assignment"; });
await t.waitForSelector('[data-act="check-ex"][data-ex="s6"]');
await t.click('[data-act="check-ex"][data-ex="s6"]');
await s.waitForSelector("#ex-s6 .ex-score", { timeout: 8000 });
assert.match(await s.textContent("#ex-s6 .ex-score"), /^1 \/ 10/);
assert.ok(await s.locator("#ex-s6 .corr").count(), "a gap fill shows the correct answer");
assert.equal(await s.inputValue(sel("s6", "2")), "wrong answer", "the answers are still there");

step("My results");
await s.click('a[href="#results"]');
await s.waitForSelector(".res-week");
const rtxt = await s.textContent("#content");
assert.match(rtxt, /My results/); assert.match(rtxt, /1 \/ 10/); assert.match(rtxt, /checked/);
await s.screenshot({ path: SHOTS + "/1-my-results.png", fullPage: true });
await s.click('.res-t a[data-goto-ex$="|s6"]');
await s.waitForSelector("#ex-s6");

step("No model answer in a paraphrase; the correct answer in a choice exercise");
await s.evaluate(() => { location.hash = "#w7/supplementary"; });
await s.waitForSelector(sel("p5", "1"));
await s.fill(sel("p5", "1"), "something wrong");
await s.click('[data-done="p5"]');
await s.waitForSelector("#ex-p5 .ex-foot.done");
assert.ok(await s.locator("#ex-p5 .gap.bad").count(), "the paraphrase is marked wrong");
assert.equal(await s.locator("#ex-p5 .corr").count(), 0, "but no model answer");
const opt = await s.$eval(`select${sel("sfn", "1")}`, (el, k) => [...el.options].map((o) => o.value).find((v) => v && v !== k), key("w7", "sfn", "1"));
await s.selectOption(`select${sel("sfn", "1")}`, opt);
await s.click('[data-done="sfn"]');
await s.waitForSelector("#ex-sfn .ex-foot.done");
assert.ok(await s.locator("#ex-sfn .corr").count(), "a choice exercise shows the correct answer");

step("Whole-week check: translations and paraphrases get no model answer in the results");
const { studentItems, keyForStudents } = await import("../docs/js/common.js");
assert.equal(keyForStudents(exOf("w7", "p5")), false);
assert.equal(keyForStudents(exOf("w8", "s9")), false, "complete the second sentence so that it means the same");
assert.equal(keyForStudents(exOf("w7", "s6")), true);
assert.equal(keyForStudents(exOf("w8", "ic4")), true, "matching");
assert.deepEqual(studentItems(exOf("w7", "p5"), { 1: { given: "x", ok: false, correct: "y" } }), { 1: { given: "x", ok: false } });

step("Answers that had not reached the database before a check are kept and come back");
await s.close();
await t.click('[data-act="check-ex"][data-ex="n3"]');
await t.waitForTimeout(400);
await t.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mock:db"));
  const sub = d["submissions/w7__S1"];
  localStorage.setItem("draft:S1:w7", JSON.stringify({ ts: Date.now() + 5000, answers: { ...sub.answers, n3: { 1: "needs repairing" } } }));
});
const s2 = await open("/index.html#w7/home-assignment");
await s2.fill("#auth-form [name=email]", "anna@uni.ru").catch(() => {});
if (await s2.isVisible("#auth-form")) { await s2.fill("#auth-form [name=password]", "secret1"); await s2.click("#auth-submit"); }
await s2.waitForSelector("#ex-n3");
await s2.waitForSelector("text=had not been saved when your teacher checked it");
assert.equal((await db(s2))["submissions/w7__S1"]?.answers?.n3?.["1"], undefined, "a checked exercise is not changed");
await t.click('[data-act="uncheck-ex"][data-ex="n3"]');
await s2.waitForFunction(() => JSON.parse(localStorage.getItem("mock:db"))["submissions/w7__S1"]?.answers?.n3?.["1"] === "needs repairing", null, { timeout: 10000 });
assert.equal(await s2.inputValue(sel("n3", "1")), "needs repairing");

step("Analytics: this week lists every student; all weeks");
await t.click('a[href="#tools/stats"]');
await t.waitForSelector(".stats-t");
assert.match(await t.textContent(".stats-t"), /Boris Petrov/, "a student without answers is listed too");
await t.click('[data-act="stats-mode"][data-mode="all"]');
await t.waitForSelector("text=All weeks");
await t.waitForSelector(".stats-t th:has-text('Week')");
const at = await t.textContent(".stats-t");
assert.match(at, /Anna Ivanova/); assert.match(at, /Boris Petrov/); assert.match(at, /%/);
await t.screenshot({ path: SHOTS + "/2-analytics-all.png", fullPage: true });

assert.deepEqual(errors, [], "no errors on the pages");
console.log("ALL OK");
await browser.close();
