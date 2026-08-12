#!/usr/bin/env node
/**
 * Harnais de `ingest-airlines.mjs --check` — la barrière qui garde la barrière.
 *
 * `ingest:check` est devenu un contrôle bloquant de CI. Ses garanties étaient jusqu'ici
 * démontrées à la main, dans des messages de livraison : chaque révision les redémontrait, et
 * rien n'empêchait la suivante de les perdre. Trois angles morts ont d'ailleurs été trouvés
 * successivement dans ce script — `--chek` qui basculait en écriture, les canaux périmés
 * invisibles, puis leur contenu modifiable sous une clé figée. Aucun n'aurait survécu à ce
 * harnais.
 *
 * TOUT SE PASSE DANS UN BAC À SABLE. Le harnais recopie l'arborescence minimale dans
 * `.ingest-sandbox/` (ignoré par git), y applique ses mutations, et vérifie à la fin que
 * l'arbre de travail réel n'a pas bougé d'un octet. Muter le vrai dépôt puis restaurer serait
 * plus court, mais une interruption au mauvais moment laisserait des données corrompues —
 * exactement le genre de risque qu'on refuse ailleurs.
 *
 *   npx tsx test-ingest-check.mjs      (ou `node test-ingest-check.mjs`)
 */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SANDBOX = join(ROOT, ".ingest-sandbox");
const SCRIPT_REL = join("packages", "knowledge", "scripts", "ingest-airlines.mjs");
const OBJECTS_REL = join("packages", "knowledge", "raw", "objects.json");
const GENERATED_REL = join("packages", "ui", "src", "data", "airlines.generated.json");

let pass = 0;
let fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/** Recopie l'arborescence minimale que le script attend, à la même profondeur. */
function freshSandbox() {
  rmSync(SANDBOX, { recursive: true, force: true });
  mkdirSync(join(SANDBOX, "packages", "knowledge", "scripts"), { recursive: true });
  mkdirSync(join(SANDBOX, "packages", "knowledge", "raw"), { recursive: true });
  mkdirSync(join(SANDBOX, "packages", "ui", "src", "data"), { recursive: true });
  cpSync(join(ROOT, "content", "airlines"), join(SANDBOX, "content", "airlines"), { recursive: true });
  cpSync(join(ROOT, SCRIPT_REL), join(SANDBOX, SCRIPT_REL));
  cpSync(join(ROOT, OBJECTS_REL), join(SANDBOX, OBJECTS_REL));
  cpSync(join(ROOT, GENERATED_REL), join(SANDBOX, GENERATED_REL));
}

/** Exécute le script DANS le bac à sable et renvoie code + sorties. */
const run = (...args) => {
  const r = spawnSync(process.execPath, [join(SANDBOX, SCRIPT_REL), ...args], { encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};

const sandboxJson = (rel) => JSON.parse(readFileSync(join(SANDBOX, rel), "utf8"));
const writeSandboxJson = (rel, data) => writeFileSync(join(SANDBOX, rel), JSON.stringify(data, null, 2) + "\n");
const mtimes = () => [OBJECTS_REL, GENERATED_REL].map((f) => statSync(join(SANDBOX, f)).mtimeMs).join("|");

// Empreinte de l'arbre RÉEL, relevée avant toute chose et revérifiée à la fin.
const realBefore = [OBJECTS_REL, GENERATED_REL].map((f) => readFileSync(join(ROOT, f), "utf8"));

console.log("=== 1. Dépôt intact : sortie 0, aucune écriture ===");
{
  freshSandbox();
  const avant = mtimes();
  const { code, out } = run("--check");
  check("code de sortie 0", code === 0, out.slice(-300));
  check("aucun artefact réécrit (mtime inchangée)", mtimes() === avant);
  check("les 10 POLICY_GAP sont listés", (out.match(/^ {2}POLICY_GAP /gm) || []).length === 10,
    `trouvés : ${(out.match(/^ {2}POLICY_GAP /gm) || []).length}`);
  check("les 10 POLICY_STALE sont listés", (out.match(/^ {2}POLICY_STALE /gm) || []).length === 10,
    `trouvés : ${(out.match(/^ {2}POLICY_STALE /gm) || []).length}`);
}

console.log("\n=== 2. Le contenu d'un POLICY_STALE change sous une clé figée ===");
// Le cas exact relevé par Codex le 12/08/2026 : la clé reste, l'ensemble est identique,
// et pourtant un verdict bascule. Seule l'empreinte du contenu l'attrape.
{
  freshSandbox();
  const objects = sandboxJson(OBJECTS_REL);
  const fb = objects.airlines.find((a) => a.id === "airline_french_bee");
  check("préalable : french_bee.cargo.allowed vaut false", fb.premium.policy.cargo.allowed === false);
  fb.premium.policy.cargo.allowed = true;
  writeSandboxJson(OBJECTS_REL, objects);
  const { code, out } = run("--check");
  check("code de sortie 1", code === 1);
  check("POLICY_STALE_DRIFT nommant la compagnie et le canal",
    out.includes("POLICY_STALE_DRIFT airline_french_bee.cargo"), out.slice(-400));
  check("l'ensemble des clés, lui, n'a PAS changé", !out.includes("l'ensemble des POLICY_STALE a changé"));
}

console.log("\n=== 3. Un canal cesse d'être produit par sa fiche : nouveau POLICY_STALE ===");
// Contre-épreuve de Codex : « Aegean Cargo » renommé en libellé que catOf() ne reconnaît pas.
// L'ingestion normale tourne d'abord, comme le ferait un rédacteur de bonne foi.
{
  freshSandbox();
  const fiche = join(SANDBOX, "content", "airlines", "aegean.yml");
  writeFileSync(fiche, readFileSync(fiche, "utf8").replace("en: Aegean Cargo", "en: Aegean Airfreight XYZ"));
  const ingest = run();
  check("l'ingestion normale réussit", ingest.code === 0, ingest.out.slice(-200));
  const { code, out } = run("--check");
  check("code de sortie 1", code === 1);
  check("airline_aegean.cargo signalé comme NOUVEAU", out.includes("+ airline_aegean.cargo"), out.slice(-400));
}

console.log("\n=== 4. Identifiants fiches / objects.json désalignés ===");
{
  freshSandbox();
  const objects = sandboxJson(OBJECTS_REL);
  objects.airlines = objects.airlines.filter((a) => a.id !== "airline_aegean");
  writeSandboxJson(OBJECTS_REL, objects);
  const { code, out } = run("--check");
  check("code de sortie 1", code === 1);
  check("le désalignement est nommé",
    out.includes("ne coïncident plus") && out.includes("airline_aegean"), out.slice(-400));
}

console.log("\n=== 5. Argument invalide : refus AVANT toute écriture ===");
{
  freshSandbox();
  const avant = mtimes();
  for (const arg of ["--chek", "-c", "check", "--check --force"]) {
    const { code } = run(...arg.split(" "));
    check(`« ${arg} » → code 2`, code === 2);
  }
  check("aucun artefact réécrit par les arguments refusés", mtimes() === avant,
    "un argument mal orthographié ne doit jamais basculer en mode écriture");
  const ok = run("--check");
  check("« --check » exact reste accepté (code 0)", ok.code === 0);
}

console.log("\n=== 6. L'arbre de travail réel n'a pas été touché ===");
{
  const realAfter = [OBJECTS_REL, GENERATED_REL].map((f) => readFileSync(join(ROOT, f), "utf8"));
  check("objects.json inchangé", realAfter[0] === realBefore[0]);
  check("airlines.generated.json inchangé", realAfter[1] === realBefore[1]);
}

rmSync(SANDBOX, { recursive: true, force: true });

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
