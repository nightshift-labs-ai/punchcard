// Headless browser smoke test of the demo UI: buy, pay, cheat x3, screenshot.
const { chromium } = await import(process.env.PW_MODULE || "playwright");
const url = process.argv[2] ?? "http://127.0.0.1:8765/";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto(url); await p.waitForSelector("#events li", { timeout: 20000 });
await p.click("#buy"); await p.waitForFunction(() => document.getElementById("bi").textContent === "1");
for (let i = 0; i < 3; i++) { await p.click("#call"); await p.waitForFunction((n) => document.getElementById("served").textContent === String(n), i + 1); }
for (const id of ["#dbl", "#infl", "#fake"]) { await p.click(id); await p.waitForTimeout(400); }
await p.click("#buy2"); await p.waitForFunction(() => document.getElementById("bi").textContent === "2");
const res = await p.evaluate(() => ({ served: +served.textContent, left: +left.textContent, cr: +cr.textContent,
  rejected: [...document.querySelectorAll("#events li.ok")].length }));
await p.screenshot({ path: process.argv[3] ?? "/tmp/punchcard-ui.png", fullPage: true });
console.log(JSON.stringify({ ...res, errs }));
await b.close();
const ok = res.served === 3 && res.left === 7 && res.cr === 3 && res.rejected === 3 && errs.length === 0;
console.log(ok ? "UI TEST PASSED" : "UI TEST FAILED"); process.exit(ok ? 0 : 1);
