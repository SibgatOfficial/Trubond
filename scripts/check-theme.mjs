#!/usr/bin/env node
/**
 * Guards against dark-mode regressions.
 *
 * The pre-auth pages once hardcoded a light gradient (`from-slate-50 via-white
 * to-blue-50`), which rendered near-white text on a white background once the
 * user picked the dark theme. This script fails the build if that class of
 * mistake comes back.
 *
 * A line is allowed when it either:
 *   - also carries a `dark:` variant, or
 *   - is marked with a `theme-allow` comment (for deliberate cases such as the
 *     white backdrop a QR code needs in order to stay scannable).
 *
 * Run with: npm run check:theme
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const FILE_PATTERN = /\.(tsx|ts)$/;

/** Light-only Tailwind classes that have no meaning on a dark surface. */
const FORBIDDEN = [
  [/\bbg-white\b/, "bg-white"],
  [/\btext-black\b/, "text-black"],
  [/\bfrom-white\b/, "from-white"],
  [/\bvia-white\b/, "via-white"],
  [/\bto-white\b/, "to-white"],
  [/\bfrom-slate-\d+\b/, "from-slate-*"],
  [/\bvia-slate-\d+\b/, "via-slate-*"],
  [/\bto-slate-\d+\b/, "to-slate-*"],
  [/\bbg-slate-\d+\b/, "bg-slate-*"],
  [/\btext-slate-\d+\b/, "text-slate-*"],
  [/\bborder-slate-\d+\b/, "border-slate-*"],
  [/\bshadow-slate-\d+\b/, "shadow-slate-*"],
  [/\bbg-gray-\d+\b/, "bg-gray-*"],
  [/\btext-gray-\d+\b/, "text-gray-*"],
  [/\bborder-gray-\d+\b/, "border-gray-*"],
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (FILE_PATTERN.test(entry)) out.push(full);
  }
  return out;
}

const violations = [];

for (const scanDir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, scanDir))) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes("theme-allow")) return;
      if (/\bdark:/.test(line)) return;
      for (const [pattern, label] of FORBIDDEN) {
        if (pattern.test(line)) {
          violations.push({
            file: relative(ROOT, file),
            line: index + 1,
            label,
            text: line.trim(),
          });
        }
      }
    });
  }
}

if (violations.length === 0) {
  console.log("✓ check:theme — no light-only colours found");
  process.exit(0);
}

console.error(
  `✗ check:theme — ${violations.length} light-only colour${violations.length === 1 ? "" : "s"} found:\n`
);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.label}]`);
  console.error(`      ${v.text}`);
}
console.error(
  "\nUse a semantic token (bg-background, bg-card, text-foreground,\n" +
    "text-muted-foreground, border-border) or add a `dark:` variant.\n" +
    "For a deliberate exception, add a `theme-allow` comment on the line."
);
process.exit(1);
