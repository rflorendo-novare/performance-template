import { readdirSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";
import enquirer from "enquirer";
const { Select } = enquirer;

const environment = process.argv.slice(2).find((a) => !a.startsWith("--")) || "stg";
const root = resolve(`environments/${environment}`);
const tests: { label: string; path: string }[] = [];

function findTestFiles(dir: string, prefix = "", collectTests = false): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (collectTests && entry.isFile() && entry.name.endsWith(".ts")) {
      const label = prefix ? `${prefix}/${entry.name.replace(/\.ts$/, "")}` : entry.name.replace(/\.ts$/, "");
      tests.push({ label, path: full });
    } else if (entry.isDirectory()) {
      const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      findTestFiles(full, newPrefix, collectTests || entry.name === "tests");
    }
  }
}

findTestFiles(root);

if (tests.length === 0) {
  console.log(`No test files found under environments/${environment}/.`);
  process.exit(0);
}

const prompt = new Select({
  name: "service",
  message: "Select a service to test:",
  choices: [
    { name: "__all__", message: "▶  Run all tests" },
    ...tests.map((t) => ({ name: t.path, message: t.label })),
  ],
});

const selected = await prompt.run();

const isCloud = process.argv.includes("--cloud");
let exitCode = 0;

function runTest(testPath: string, label: string): void {
  console.log(`\n▶  ${label}`);
  console.log("-".repeat(60));
  const cmd = isCloud ? ["cloud", "run", testPath] : ["run", testPath];
  const { status, error } = spawnSync("k6", cmd, { stdio: "inherit", shell: true });
  if (error || status !== 0) {
    console.error(`✖  ${label} failed`);
    exitCode = 1;
  } else {
    console.log(`✓  ${label} passed`);
  }
}

if (selected === "__all__") {
  for (const t of tests) {
    runTest(t.path, t.label);
  }
} else {
  const test = tests.find((t) => t.path === selected);
  if (test) {
    runTest(test.path, test.label);
  }
}

process.exit(exitCode);
