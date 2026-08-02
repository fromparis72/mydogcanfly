// Split a ChatGPT "content pack" (many guides in one file) into individual draft files.
//   node packages/knowledge/scripts/split-pack.mjs <pack.md>
// Each entry looks like:  ## FILE: air-france.en.md  \n ```md ... ```
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const packPath = process.argv[2];
if (!packPath) { console.error("usage: split-pack.mjs <pack.md>"); process.exit(1); }

const pack = readFileSync(packPath, "utf8");
const parts = pack.split(/^##\s+FILE:\s*/m).slice(1);
let n = 0;
for (const part of parts) {
  const nl = part.indexOf("\n");
  const filename = basename(part.slice(0, nl).trim());
  const m = part.match(/```(?:md|markdown)?\s*\n([\s\S]*?)\n```/);
  if (!m) { console.log("no code block for", filename); continue; }
  const content = m[1].replace(/\s*$/, "") + "\n";
  const typeMatch = content.match(/^type:\s*([a-z_]+)/m);
  const type = typeMatch ? typeMatch[1] : "airline_guide";
  const dir = join(ROOT, "content", "hub", "drafts", type);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
  n++;
}
console.log(`Extracted ${n} files from ${packPath}`);
