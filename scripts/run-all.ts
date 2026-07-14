import { readdirSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";

const environment = process.argv.slice(2).find((a) => !a.startsWith("--")) || "";
const root = environment ? resolve(`environments/${environment}`) : resolve("environments");
const tests: string[] = [];

function findTestFiles(dir: string, collectTests = false): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (collectTests && entry.isFile() && entry.name.endsWith(".ts")) {
      tests.push(full);
    } else if (entry.isDirectory()) {
      findTestFiles(full, collectTests || entry.name === "tests");
    }
  }
}

findTestFiles(root);

if (tests.length === 0) {
  const scope = environment ? `environments/${environment}/` : "environments/";
  console.log(`No test files found under ${scope}`);
  process.exit(0);
}

const isCloud = process.argv.includes("--cloud");
const results: { file: string; ok: boolean; status: number | string }[] = [];
let exitCode = 0;

console.log(`Found ${tests.length} test(s):\n`);
for (const testFile of tests) {
  const relPath = "." + testFile.slice(resolve(".").length);
  console.log(`▶  ${relPath}`);
  console.log("-".repeat(60));

  const cmd = isCloud ? ["cloud", "run", testFile] : ["run", testFile];
  const { status, error } = spawnSync("k6", cmd, { stdio: "inherit", shell: true });

  const ok = error ? false : status === 0;
  results.push({ file: relPath, ok, status: error ? error.message : status ?? -1 });
  if (!ok) exitCode = 1;

  console.log();
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;

console.log("=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✖"}  ${r.file}`);
}
console.log(`\n${passed} passed, ${failed} failed, ${results.length} total`);
process.exit(exitCode);
