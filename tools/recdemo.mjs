// Record the live demo UI with scripted clicks → WebM, then slides → PNGs. Used to build the pitch video.
const { chromium } = await import(process.env.PW_MODULE || "playwright");
import fs from "node:fs";
const [url, outDir] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(); await p.goto(url); await p.waitForSelector("#events li");
const w = (ms) => p.waitForTimeout(ms);
const steps = [[2500, null], [0, "#buy"], [4000, "#call"], [3500, "#call"], [3000, "#call"], [4000, "#dbl"], [4000, "#infl"], [4000, "#fake"], [5000, null]];
const t0 = Date.now(); const marks = [];
for (const [pause, sel] of steps) { await w(pause); if (sel) { await p.click(sel); marks.push([sel, (Date.now() - t0) / 1000]); } }
await ctx.close(); await b.close();
fs.writeFileSync(outDir + "/marks.json", JSON.stringify(marks));
console.log(JSON.stringify(marks));
