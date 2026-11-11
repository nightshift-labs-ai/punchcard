// Record the live chain view (/live/) with scripted scrolling + a nullifier check → WebM (for the pitch video).
const { chromium } = await import(process.env.PW_MODULE || "playwright");
import fs from "node:fs";
const [url, outDir] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(); await p.goto(url); await p.waitForSelector("#status[data-ok], #status[data-record]", { timeout: 30000 });
const w = (ms) => p.waitForTimeout(ms);
const scroll = (y) => p.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
await w(4000); await scroll(300); await w(4500); await scroll(2000); await w(5000);
await ctx.close(); await b.close();
