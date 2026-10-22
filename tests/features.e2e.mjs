// New features on the mock Firebase: voice recording, "Done" for each exercise, active fields in the
// Teacher's Edition, In-Class / HA labels, live statistics, attendance and the 25% rule.
// Run: python3 -m http.server 5055 -d docs &  node tests/features.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const BASE = "http://127.0.0.1:5055";
const SHOTS = process.env.SHOTS || "/tmp/shots-features";
mkdirSync(SHOTS, { recursive: true });
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const courseText = readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8");
const course = JSON.parse(courseText);
const u1 = course.units.find((u) => u.id === "w7");
const exById = Object.fromEntries(u1.sections.flatMap((s) => s.blocks.filter((b) => b.type === "exercise").map((b) => [b.id, { ...b, sec: s.id }])));
const key = (ex, it) => { const a = exById[ex].items.find((x) => x.id === it).answer; return Array.isArray(a) ? a[0] : a; };

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, permissions: ["microphone"] });
await ctx.route("**/js/fb.js*", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
const errors = [];
const page = async (url) => {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(url + ": " + e.message));
  p.on("dialog", (d) => d.accept(d.type() === "prompt" ? "" : undefined));
  await p.goto(BASE + url);
  return p;
};
const shot = (p, n, full = false) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
const step = (t) => console.log("•", t);
const sel = (ex, it) => `[data-ex="${ex}"][data-item="${it}"]`;

// ---- teacher, course, group
const t = await page("/teacher.html");
await t.evaluate(() => {
  localStorage.setItem("mock:auth", JSON.stringify({ "teacher@uni.ru": { uid: "T1", password: "secret1" } }));
  localStorage.setItem("mock:db", JSON.stringify({ "teachers/T1": { name: "Teacher" } }));
});
await t.reload();
await t.fill("#auth-form [name=email]", "teacher@uni.ru");
await t.fill("#auth-form [name=password]", "secret1");
await t.click("#auth-submit");
await t.waitForSelector("#tool-nav .sb-item");
await t.click('a[href="#tools/content"]');
await t.evaluate((c) => { document.querySelector("#import-text").value = c; }, courseText);
await t.click("[data-act=import]");
await t.waitForSelector("text=Imported");
await t.click('a[href="#tools/groups"]');
await t.fill("#g-name", "PA-21"); await t.fill("#g-code", "PA-21");
await t.click("[data-act=create-group]");
await t.waitForSelector("td:has-text('PA-21')");
await t.click('a[href="#tools/access"]');
await t.click('[data-act="toggle-open"][data-unit="w7"]');
await t.waitForSelector("td .pill.on:text('open')");

async function student(name, email) {
  const s = await page("/index.html");
  await s.evaluate(() => sessionStorage.clear());
  await s.reload();
  await s.click("[data-mode=register]");
  await s.fill("[name=name]", name); await s.fill("[name=email]", email);
  await s.fill("[name=password]", "pass123"); await s.fill("[name=group]", "PA-21");
  await s.click("#auth-submit");
  await s.waitForSelector(".cards .pg");
  return s;
}
const s1 = await student("Anna Ivanova", "anna@uni.ru");
const s2 = await student("Boris Petrov", "boris@uni.ru");

// =================================================================== recording
step("Recording: the first format fails (as in some browsers), the recorder takes the next one");
const sp = t;
await sp.evaluate(() => { location.hash = "#w7/in-class"; });
await sp.evaluate(() => {
  const Orig = window.MediaRecorder;
  window.__tried = [];
  window.MediaRecorder = class extends Orig {
    constructor(stream, opts) {
      window.__tried.push(opts?.mimeType || "(default)");
      if (opts?.mimeType === "audio/webm;codecs=opus") throw new DOMException("refused", "NotSupportedError");
      super(stream, opts);
    }
    static isTypeSupported(t) { return Orig.isTypeSupported(t); }
  };
});
await sp.waitForSelector(".spk [data-spk-act=rec]");
const rec = sp.locator(".spk [data-spk-act=rec]").first();
await rec.click();
await sp.waitForSelector(".spk .btn.rec.on", { timeout: 5000 });
await sp.waitForTimeout(2200);
await rec.click();
await sp.waitForSelector(".spk-take audio", { timeout: 6000 });
const dl = sp.locator(".spk-take a[download]").first();
assert.ok(/\.(webm|ogg|m4a)$/.test(await dl.getAttribute("download")), "a file to download");
const size = await sp.evaluate(async () => (await (await fetch(document.querySelector(".spk-take a[download]").href)).blob()).size);
assert.ok(size > 1000, "the recording is not empty: " + size);
console.log("   formats tried:", (await sp.evaluate(() => window.__tried)).join(", "), "· file", size, "bytes");
await sp.locator(".spk").first().screenshot({ path: `${SHOTS}/01-recording.png` });

// =================================================================== teacher: active fields, labels, stats
step("Teacher's Edition: fields and menus are active; the teacher's answers stay while students type");
await t.evaluate(() => { location.hash = "#w7/home-assignment"; });
await t.waitForSelector("#ex-fn select");
assert.equal(await t.locator("#ex-fn select").first().isDisabled(), false, "the dropdown is active for the teacher");
const optCount = await t.locator("#ex-fn select").first().locator("option").count();
assert.ok(optCount > 3, "the teacher sees the options");
await t.locator("#ex-fn select").first().selectOption({ index: 2 });
await t.evaluate(() => { location.hash = "#w7/home-assignment"; });
await t.waitForSelector(`#ex-s6 ${sel("s6", "1")}`);
assert.equal(await t.locator(sel("s6", "1")).isDisabled(), false);
await t.fill(sel("s6", "1"), "teacher's try");

step("In-Class label and Done tick; the lesson appears in the attendance list");
await t.click('[data-act="plan-as"][data-ex="s6"][data-as="class"]');
await t.waitForSelector('[data-act="plan-as"][data-ex="s6"][data-as="class"].on');
await t.check('[data-plan-done="w7|s6"]');
await t.waitForSelector('[data-plan-date="w7|s6"]');
await t.click('[data-act="plan-as"][data-ex="n3"][data-as="home"]');
await t.waitForSelector('[data-act="plan-as"][data-ex="n3"][data-as="home"].on');
assert.equal(await t.inputValue(sel("s6", "1")), "teacher's try", "the teacher's answer is kept after the page is drawn again");

step("Students: labels are visible; answers; the teacher sees live statistics");
await s1.evaluate(() => { location.hash = "#w7/home-assignment"; });
await s2.evaluate(() => { location.hash = "#w7/home-assignment"; });
await s1.waitForSelector("#ex-s6 .ex-plan.class.done");
assert.ok((await s1.textContent("#ex-s6 .ex-plan")).includes("In-Class"));
assert.ok((await s1.textContent("#ex-n3 .ex-plan")).includes("HA"));
await s1.fill(sel("s6", "1"), key("s6", "1"));
await s1.fill(sel("s6", "2"), "wrong answer");
await s2.fill(sel("s6", "1"), key("s6", "1"));
await s2.fill(sel("s6", "2"), "wrong answer");
await s1.waitForTimeout(1600);
await t.waitForSelector('[data-is="s6|1"] .ib-ok:text("✓2")', { timeout: 6000 });
await t.waitForSelector('[data-is="s6|2"] .ib-bad:text("✗2")');
assert.equal(await t.inputValue(sel("s6", "1")), "teacher's try", "live statistics do not wipe what the teacher typed");
const sum = await t.textContent('[data-ts="s6"]');
assert.ok(/answered\s*2\/2/.test(sum) && /correct\s*50%/.test(sum), "summary: " + sum);
await t.click('[data-act="mist"][data-ex="s6"]');
await t.waitForSelector('[data-mi="s6"]:not([hidden]) .mw');
assert.ok((await t.textContent('[data-mi="s6"]')).includes("Anna Ivanova"));
await t.locator("#ex-s6").evaluate((el) => { el.previousElementSibling.scrollIntoView(); window.scrollBy(0, -70); });
await shot(t, "02-teacher-exercise-stats");

step("Students: Done locks the exercise; Change my answers opens it again; Submit waits for all exercises");
assert.equal(await s1.locator("#submit-unit").isDisabled(), true, "Submit is closed until all exercises are done");
await s1.click('[data-done="s6"]');
await s1.waitForSelector("#ex-s6 .ex-foot.done");
assert.equal(await s1.locator(sel("s6", "1")).isDisabled(), true, "a done exercise is locked");
await shot(s1, "03-student-done");
await s1.click('[data-undone="s6"]');
await s1.waitForSelector('#ex-s6 [data-done="s6"]');
assert.equal(await s1.locator(sel("s6", "1")).isDisabled(), false);
await s1.click('[data-done="s6"]');
await s1.waitForSelector("#ex-s6 .ex-foot.done");
await t.waitForSelector('[data-ts="s6"]:has-text("done 1/2")', { timeout: 6000 });
await s1.locator("#unit-bar").screenshot({ path: `${SHOTS}/04-student-unit-bar.png` });
await s1.locator("#ex-n3").screenshot({ path: `${SHOTS}/04b-student-exercise.png` });
// a link to an exercise in another section
await s1.locator('.ub-left a[data-goto-ex^="w7|in-class|"]').first().click();
await s1.waitForSelector("#ex-f1");

step("Attendance: Boris is absent on the day of the in-class exercise");
await t.click('a[href="#tools/journal"]');
await t.waitForSelector(".jt");
await t.click("tr:has-text('Boris Petrov') [data-act=att]");
await t.waitForSelector("tr:has-text('Boris Petrov') .att.abs");
const jtext = await t.textContent("body");
assert.ok(/7\.3\.\d+/.test(await t.textContent(".jx.class")), "the in-class exercise is listed under the lesson");
await t.fill("#j-date", "2026-10-14");
await t.click("[data-act=lesson-add]");
await t.waitForSelector("th:has-text('14.10')");
await shot(t, "05-attendance", true);

step("The teacher checks the exercise: Boris gets 25% of the points, Anna 100%");
await t.selectOption("#ctx-unit", "w7");
await t.click('a[href="#tools/works"]');
await t.waitForSelector("tr:has-text('Boris Petrov') .pill.warn:has-text('absent')");
await shot(t, "06-works-absent");
await t.evaluate(() => { location.hash = "#w7/home-assignment"; });
await t.click('[data-act="check-ex"][data-ex="s6"]');
await s2.evaluate(() => { location.hash = "#w7/home-assignment"; });
await s2.waitForSelector("#ex-s6 .ex-score.low", { timeout: 8000 });
const s2score = await s2.textContent("#ex-s6 .ex-score");
assert.ok(/1 \/ 10 · 25% = 0\.25/.test(s2score), "Boris: " + s2score);
await s1.evaluate(() => { location.hash = "#w7/home-assignment"; });
await s1.waitForSelector("#ex-s6 .ex-score");
assert.equal((await s1.textContent("#ex-s6 .ex-score")).trim(), "1 / 10");
await s2.locator("#ex-s6 .ex-h").screenshot({ path: `${SHOTS}/07-student-absent-score.png` });
const exr = await t.evaluate(() => JSON.parse(localStorage.getItem("mock:db")));
const bor = Object.entries(exr).find(([k, v]) => k.startsWith("exerciseResults/") && v.factors?.s6 === 0.25);
assert.ok(bor && bor[1].scores.s6.score === 0.25, "the stored score is 25%");

step("Both students finish all exercises and submit; the whole unit is checked with the same rule");
async function finishAll(p) {
  for (let g = 0; g < 120; g++) {
    const b = p.locator("#content [data-done]");
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(50); continue; }
    const l = p.locator(".ub-left a").first();
    if (!(await l.count())) break;
    await l.click(); await p.waitForTimeout(200);
  }
  await p.click("#submit-unit");
  await p.waitForSelector(".ub-sub");
}
await finishAll(s1);
await finishAll(s2);
await t.click('a[href="#tools/access"]');
await t.click('[data-act="release"][data-unit="w7"]');
await s2.waitForSelector(".ub-res", { timeout: 8000 });
const db2 = await t.evaluate(() => JSON.parse(localStorage.getItem("mock:db")));
const rb = Object.values(db2).find((v) => v.unitId === "w7" && v.factors && v.score !== undefined && v.factors.s6 === 0.25);
assert.ok(rb, "the unit result keeps the 25% rule");
console.log("   Boris, whole unit:", rb.score, "/", rb.max);

await browser.close();
if (errors.length) { console.log("Page errors:\n" + errors.join("\n")); process.exit(1); }
console.log("\nALL FEATURE STEPS PASSED");
