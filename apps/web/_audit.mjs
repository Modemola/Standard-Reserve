import { chromium } from "@playwright/test";
const ROUTES = ["/", "/lab", "/bank/c-0042", "/sweep", "/scenarios", "/law"];
const VIEWPORTS = [
  [320, 568, "iPhone SE1"], [375, 667, "iPhone SE2"], [390, 844, "iPhone 14"],
  [414, 896, "iPhone Plus"], [768, 1024, "iPad portrait"], [1024, 768, "iPad landscape"],
  [844, 390, "phone landscape"],
];
const b = await chromium.launch();
const issues = [];
for (const [w, h, name] of VIEWPORTS) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768 });
  for (const r of ROUTES) {
    await p.goto("http://localhost:3300" + r, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    const res = await p.evaluate(() => {
      const de = document.documentElement;
      const vw = de.clientWidth;
      const overflow = de.scrollWidth - vw;
      const culprits = [];
      const tiny = [];
      const smallTargets = [];
      for (const el of document.querySelectorAll("body *")) {
        const bx = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || bx.width === 0) continue;
        // overflow culprits: sticks out and isn't inside a horizontal scroller
        if (bx.right > vw + 1 && bx.width > 24) {
          let node = el.parentElement, scrolls = false;
          while (node) { const ps = getComputedStyle(node);
            if (ps.overflowX === "auto" || ps.overflowX === "scroll") { scrolls = true; break; } node = node.parentElement; }
          if (!scrolls) culprits.push(`${el.tagName}.${String(el.className).slice(0,34)} r=${Math.round(bx.right)}`);
        }
        // touch targets
        const interactive = el.matches("a,button,input,select,textarea,[role=button]");
        if (interactive && bx.width > 0 && (bx.width < 24 || bx.height < 24))
          smallTargets.push(`${el.tagName}"${(el.textContent||"").trim().slice(0,18)}" ${Math.round(bx.width)}x${Math.round(bx.height)}`);
        // tiny text with real content
        const direct = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join("").trim();
        if (direct && parseFloat(s.fontSize) < 11) tiny.push(`${parseFloat(s.fontSize)}px "${direct.slice(0,20)}"`);
      }
      return { overflow, culprits: [...new Set(culprits)].slice(0,3), tiny: [...new Set(tiny)].slice(0,3), smallTargets: [...new Set(smallTargets)].slice(0,3) };
    });
    if (res.overflow > 0 || res.culprits.length || res.smallTargets.length)
      issues.push(`${name} ${w}x${h} ${r}: overflow=${res.overflow} culprits=${JSON.stringify(res.culprits)} targets=${JSON.stringify(res.smallTargets)}`);
  }
  await p.close();
  console.log(`${name} (${w}x${h}) checked`);
}
console.log("\n=== ISSUES ===");
console.log(issues.length ? issues.join("\n") : "  none");
await b.close();
