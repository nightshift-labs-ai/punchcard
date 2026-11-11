const { chromium } = await import(process.env.PW_MODULE || "playwright");
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("file://" + process.argv[2]); await p.waitForTimeout(300);
await p.pdf({ path: process.argv[3], width: "1280px", height: "720px", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
await b.close();
