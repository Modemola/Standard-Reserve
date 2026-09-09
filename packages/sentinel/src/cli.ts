// pnpm sentinel:run — print the verdict table and write artifacts/sentinel-report.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAll } from "./runAll.js";
import { reportConsole, reportMarkdown, shouldFail } from "./report.js";

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

function main(): void {
  const verdicts = runAll();

  console.log(reportConsole(verdicts));
  console.log("");

  const outDir = join(repoRoot(), "artifacts");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "sentinel-report.md");
  writeFileSync(outFile, reportMarkdown(verdicts) + "\n", "utf8");
  console.log(`report: ${outFile}`);

  if (shouldFail(verdicts)) {
    console.error("\nBROKEN invariants above — failing.");
    process.exit(1);
  }
}

main();
