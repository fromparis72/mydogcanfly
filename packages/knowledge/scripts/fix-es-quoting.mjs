// One-off: quote unquoted YAML scalar values that contain ": " (colon-space),
// which break block mappings. Targets a given list of files. Safe: only touches
// unquoted values; leaves already-quoted/block/flow values alone.
import fs from "node:fs";

const files = process.argv.slice(2);
const reKV = /^(\s*(?:-\s+)?[A-Za-z_]+:)\s+(.*)$/;
let fixed = 0;

for (const fp of files) {
  const lines = fs.readFileSync(fp, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = reKV.exec(lines[i]);
    if (!m) continue;
    const val = m[2];
    if (val === "") continue;
    const c = val[0];
    if ('"\'>|{[&*#'.includes(c)) continue; // already quoted / block / flow / special
    if (val.includes(": ")) {
      const q = '"' + val.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
      lines[i] = m[1] + " " + q;
      fixed++;
    }
  }
  fs.writeFileSync(fp, lines.join("\n"));
}
console.log("quoted values:", fixed);
