// Teacher: Speaking / Writing progress (table, chart, In-Class vs HA, cards), "Answers shown" on a unit page,
// student switcher in Student work, Analytics with drafts. Students' work is put straight into the mock database.
// Grammar_3: weeks w7–w9; answers reach the database when the student clicks Done.
// Run: python3 -m http.server 5055 -d docs &  node tests/progress.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055";
const SHOTS = process.env.SHOTS || "/tmp/shots-progress";
mkdirSync(SHOTS, { recursive: true });
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const courseText = readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
await ctx.route("**/js/fb.js*", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
await ctx.route("https://api.languagetool.org/**", (r) => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"matches":[]}' }));
const errors = [];
const t = await ctx.newPage();
t.on("pageerror", (e) => errors.push(e.message)); t.on("dialog", (d) => d.accept());
const step = (x) => console.log("•", x);
await t.goto(BASE + "/teacher.html");
await t.evaluate(() => { localStorage.setItem("mock:auth", JSON.stringify({ "teacher@uni.ru": { uid: "T1", password: "secret1" } })); localStorage.setItem("mock:db", JSON.stringify({ "teachers/T1": { name: "Teacher" } })); });
await t.reload();
await t.fill("#auth-form [name=email]", "teacher@uni.ru"); await t.fill("#auth-form [name=password]", "secret1"); await t.click("#auth-submit");
await t.waitForSelector("#tool-nav .sb-item");
assert.ok(await t.isVisible('a[href="#tools/writing"]'), "Writing progress in the sidebar");
await t.click('a[href="#tools/content"]');
await t.evaluate((c) => { document.querySelector("#import-text").value = c; }, courseText);
await t.click("[data-act=import]"); await t.waitForSelector("text=Imported");
await t.click('a[href="#tools/groups"]'); await t.waitForSelector("#g-name");
await t.fill("#g-name", "PA-21"); await t.fill("#g-code", "PA-21"); await t.click("[data-act=create-group]");
await t.waitForSelector("td:has-text('PA-21')");

step("Seeding three students (work sent with Done)");
await t.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("mock:db"));
  const gid = Object.keys(db).find((k) => k.startsWith("groups/")).split("/")[1];
  const g = db["groups/" + gid];
  g.openUnits = ["w7", "w8", "w9"];
  g.plan = { w7: { wr1: { as: "class" }, t4: { as: "home" }, sp1: { as: "class" } }, w8: { t1: { as: "home" }, sp2: { as: "home" } } };
  const day = (d) => ({ __ts: Date.parse(`2026-10-${d}T10:00:00Z`) });
  const studs = [["S1", "Anna Ivanova", 1], ["S2", "Boris Petrov", 0.6], ["S3", "Wang Fang", 0.3]];
  const story = "After finishing school, Tom started looking for a job. He was tired of doing nothing and he hated asking his parents for money. ";
  for (const [uid, name, q] of studs) {
    db["users/" + uid] = { name, email: uid.toLowerCase() + "@uni.ru", groupId: gid };
    db[`submissions/w7__${uid}`] = { uid, groupId: gid, unitId: "w7", status: "draft", updatedAt: day(20),
      answers: {
        g2: { 1: "xx", 2: "wrong", 3: q > 0.5 ? "being" : "yy" },
        wr1: { 1: story.repeat(q > 0.5 ? 3 : 2) },
        t4: { 1: "I remember seeing him.", 2: "She is fond of reading.", 3: "Stop talking, please." },
        sp1: { 1: "My room needs tidying and the window needs washing. My wardrobe needs sorting out because it is a mess." },
        _speech: { sp1: JSON.stringify({ speech: 60 + 20 * q, total: 110, wpm: Math.round(80 + 40 * q), pauses: Math.round(9 - 5 * q), longest: 3, at: Date.parse("2026-10-21T10:00:00Z") }) },
        _done: { g2: "1", wr1: "1", t4: "1", sp1: "1" },
      } };
    db[`submissions/w8__${uid}`] = { uid, groupId: gid, unitId: "w8", status: "draft", updatedAt: day(28),
      answers: {
        t1: { 1: "Do you mind my opening the window?", 2: "I object to being treated like a child." },
        sp2: { 1: "I'll never forget seeing the sea. I must remember to call my grandmother. I stopped eating fast food. ".repeat(1 + Math.round(q * 2)) },
        sp1: { 1: "What's the use of worrying? There's no use worrying. Are you good at remembering names?", 2: uid === "S2" ? "Boris" : "S3" },
        _speech: {
          sp2: JSON.stringify({ speech: 70, total: 100, wpm: Math.round(100 + 50 * q), pauses: Math.round(6 - 4 * q), longest: 2, at: Date.parse("2026-10-28T10:00:00Z") }),
          sp1: JSON.stringify({ speech: 120, total: 170, wpm: 110, pauses: 6, longest: 2, at: Date.parse("2026-10-28T10:00:00Z") }) },
        _done: { t1: "1", sp2: "1", sp1: "1" },
      } };
  }
  db["exerciseResults/w7__S1"] = { uid: "S1", groupId: gid, unitId: "w7", feedback: { t4: {
    1: { text: "I remember seeing him.", issues: [{ type: "grammar", category: "Grammar" }] },
    2: { text: "She is fond of reading.", issues: [] },
    3: { text: "Stop talking, please.", issues: [] } } } };
  localStorage.setItem("mock:db", JSON.stringify(db));
});
await t.reload(); await t.waitForSelector("#tool-nav .sb-item");

step("Writing progress");
await t.click('a[href="#tools/writing"]');
await t.waitForSelector(".t.prog");
const wtxt = await t.textContent("#view");
assert.match(wtxt, /Writing progress/); assert.match(wtxt, /Anna Ivanova/); assert.match(wtxt, /In class and at home/);
assert.ok(await t.locator(".prog-chart svg").count(), "chart");
assert.equal(await t.locator(".spk-card").count(), 3, "a card for each student");
assert.match(wtxt, /Translate into English/);
await t.selectOption("#prog-kind", "translation");
await t.waitForTimeout(200);
assert.ok(!(await t.textContent(".prog-tasks")).includes("Continue the story"), "only translations");
await t.screenshot({ path: SHOTS + "/1b-translations.png", fullPage: true });
await t.selectOption("#prog-kind", "");
await t.waitForTimeout(200);
await t.screenshot({ path: SHOTS + "/1-writing.png", fullPage: true });
await t.selectOption("#prog-student", { label: "Boris Petrov" });
await t.waitForSelector(".prog-chart .st.one");
assert.equal(await t.locator(".spk-card").count(), 1);
await t.click('[data-act=prog-set][data-set=home]');
await t.waitForTimeout(200);
assert.equal(await t.locator(".t.prog").first().locator("thead th").count(), 5, "2 HA writing tasks: student + T1 + T2 + change + trend");

step("Speaking progress");
await t.click('[data-act=prog-set][data-set=""]');
await t.click('a[href="#tools/speaking"]');
await t.waitForSelector(".t.prog");
await t.selectOption("#prog-student", "");
await t.waitForTimeout(200);
assert.match(await t.textContent("#view"), /Pair discussions: who was the partner\?/);
await t.click(".t.prog tbody a[data-act=prog-open]");
await t.waitForSelector("#prog-detail");
await t.screenshot({ path: SHOTS + "/3-speaking.png", fullPage: true });

step("The speaking check sends the partner a copy");
await t.evaluate(() => { location.hash = "#w8/in-class"; });
await t.waitForSelector('[data-act="check-writing"][data-ex="sp1"]');
assert.match(await t.textContent('[data-act="check-writing"][data-ex="sp1"]'), /Check the speaking now/);
await t.click('[data-act="check-writing"][data-ex="sp1"]');
await t.waitForSelector("text=sent to partners", { timeout: 30000 });
const fbS3 = await t.evaluate(() => JSON.parse(localStorage.getItem("mock:db"))["exerciseResults/w8__S3"]);
assert.ok(fbS3?.feedback?.sp1?._pair?.text, "Wang Fang got the copy of Anna's recording");

step("Analytics with work sent with Done");
await t.evaluate(() => { location.hash = "#w7/in-class"; });
await t.waitForTimeout(300);
await t.click('a[href="#tools/stats"]');
await t.waitForSelector(".stats-t");
assert.match(await t.textContent("#view"), /students with answers to check/);
await t.screenshot({ path: SHOTS + "/4-analytics.png", fullPage: true });

step("Answers shown on the unit page");
await t.click('.stats-t [data-act=view-unit-as]');
await t.waitForSelector(".viewas-bar.on");
await t.evaluate(() => { location.hash = "#w7/in-class"; });
await t.waitForTimeout(400);
assert.ok(await t.locator("#ex-g2 .gap.bad").count() >= 2, "the student's wrong answers are marked red");
assert.ok(await t.locator("#ex-g2 .gap[disabled]").count() > 0, "read-only");
await t.screenshot({ path: SHOTS + "/5-unit-as.png" });
const before = await t.inputValue("#view-as");
await t.click(".viewas-bar [data-act=view-as]:has-text('Next')");
await t.waitForTimeout(200);
assert.notEqual(await t.inputValue("#view-as"), before, "Next switches the student");
const who = await t.inputValue("#view-as");
// another week: the chosen student stays
await t.selectOption("#ctx-unit", "w8");
await t.waitForTimeout(600);
assert.equal(await t.inputValue("#view-as"), who, "the student is kept after a change of week");
await t.click(".viewas-bar [data-act=view-as]:has-text('Back to my practice')");
await t.waitForTimeout(200);
assert.equal(await t.inputValue("#view-as"), "");

step("Student work switcher");
await t.click('a[href="#tools/works"]');
await t.click("[data-act=select-student] >> nth=0");
await t.waitForSelector("#works-student");
await t.click("#detail [data-act=select-student]:has-text('Next')");
await t.waitForTimeout(300);
assert.match(await t.textContent("#detail h2"), /Boris|Wang/);
await t.screenshot({ path: SHOTS + "/6-works.png" });

const html = await t.content();
for (const ch of ["→", "←", "«", "»", "‹", "›"]) assert.ok(!html.includes(ch), "arrow " + ch);
assert.deepEqual(errors, []);
console.log("ALL OK");
await browser.close();
