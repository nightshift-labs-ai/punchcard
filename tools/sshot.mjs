const { chromium } = await import(process.env.PW_MODULE || "playwright");
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("file://" + process.argv[2]); const n = +process.argv[4];
await p.screenshot({ path: process.argv[3], clip: { x: 0, y: 720 * n, width: 1280, height: 720 }, fullPage: true }); await b.close();
