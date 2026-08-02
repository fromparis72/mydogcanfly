#!/usr/bin/env node
/* Contrôle d'une fiche pays traduite : ce qui existait ne doit pas avoir bougé, et ce qui
 * a été ajouté ne doit ni perdre ni inventer de chiffre.
 *
 *   node packages/knowledge/scripts/check-country-pt.mjs br [autre-code…]
 *
 * Trois vérifications, dans cet ordre d'importance :
 *   1. `en`, `fr`, `es` strictement inchangés par rapport à la sauvegarde /tmp/<code>.yml.avant
 *      (si elle existe) — le seul ajout autorisé est `pt`.
 *   2. Couverture : tout nœud localisé porte un `pt`.
 *   3. Chiffres : les nombres, durées et références réglementaires de la version anglaise se
 *      retrouvent dans la version portugaise. Une exigence sanitaire qui perd son délai en
 *      route est une erreur d'une autre nature qu'une maladresse de style.
 */
import { readFileSync, existsSync } from "node:fs";
import YAML from "yaml";

/* Les nombres qui comptent : « 21 days », « 90 dias », « nº 741/2024 », « ISO 11784/11785 ».
 *
 * Comparer les chaînes brutes ne marche pas : le portugais écrit 0,5 UI/ml et 50 000 €
 * là où l'anglais écrit 0.5 IU/ml et £50,000. Ce sont les mêmes quantités, correctement
 * localisées. On ramène donc chaque nombre à une valeur canonique avant de comparer —
 * sinon le contrôle crie au loup à chaque fois que la traduction fait bien son travail.
 */
const canon = (tok) => {
  let t = tok.replace(/[.,](?=\d{3}(?!\d))/g, ""); // séparateur de milliers : 50,000 / 50.000
  t = t.replace(",", ".");                          // ce qui reste est une virgule décimale
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : tok;
};
// « 50 000 » : l'espace (insécable ou non) est un séparateur de milliers, on le recolle
// d'abord. Ensuite un nombre ne contient plus d'espace, donc « art. 5, 15 » reste bien
// deux nombres et non « 5,15 ».
/* L'heure est le seul cas où deux écritures correctes donnent des chiffres différents.
 * L'anglais dit « 5:00 p.m. », le portugais dit « 17h ». Sans cette normalisation, le
 * contrôle réclamait un 5 et un 4 qui n'ont pas à figurer, et un agent a fini par écrire
 * « das 8h30 às 5h00 da tarde » — du mauvais portugais produit uniquement pour satisfaire
 * une vérification. On ramène donc les deux écritures à la même horloge de 24 heures avant
 * de compter : une phrase lisible ne doit jamais être sacrifiée à un test. */
const clock = (s) =>
  String(s)
    .replace(/(\d{1,2}):(\d{2})\s*([ap])\.?\s?m\.?/gi, (_, h, m, ap) => {
      let H = Number(h) % 12;
      if (ap.toLowerCase() === "p") H += 12;
      return m === "00" ? String(H) : `${H}:${m}`;
    })
    .replace(/(\d{1,2})\s?h\s?(\d{2})?\b/g, (_, h, m) => (!m || m === "00" ? String(Number(h)) : `${Number(h)}:${m}`));

const NUMS = (s) =>
  (clock(s).replace(/(\d)[\s\u00a0](\d{3})(?!\d)/g, "$1$2").match(/\d+(?:[.,]\d+)*/g) ?? []).map(canon);

let failures = 0;
for (const code of process.argv.slice(2)) {
  const file = `content/countries/${code}.yml`;
  const doc = YAML.parse(readFileSync(file, "utf-8"));

  const nodes = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (typeof o.en === "string" && typeof o.fr === "string") { nodes.push(o); return; }
    for (const v of Object.values(o)) walk(v);
  })(doc);

  const problems = [];

  // 1 — les langues existantes n'ont pas bougé
  const backup = `/tmp/${code}.yml.avant`;
  if (existsSync(backup)) {
    const before = YAML.parse(readFileSync(backup, "utf-8"));
    const strip = (o) => {
      if (!o || typeof o !== "object") return o;
      if (Array.isArray(o)) return o.map(strip);
      const r = {};
      for (const [k, v] of Object.entries(o)) if (k !== "pt") r[k] = strip(v);
      return r;
    };
    if (JSON.stringify(strip(doc)) !== JSON.stringify(before))
      problems.push("en/fr/es ont changé — l'ajout aurait dû être purement additif");
  } else {
    problems.push(`pas de sauvegarde ${backup} : la non-régression en/fr/es n'a pas pu être vérifiée`);
  }

  // 2 — couverture
  const uncovered = nodes.filter((n) => typeof n.pt !== "string" || !n.pt.trim());
  if (uncovered.length) problems.push(`${uncovered.length} nœud(s) sans pt`);

  // 3 — chiffres conservés
  for (const n of nodes) {
    if (typeof n.pt !== "string") continue;
    const en = NUMS(n.en), pt = NUMS(n.pt);
    const missing = en.filter((x) => !pt.includes(x));
    const invented = pt.filter((x) => !en.includes(x));
    if (missing.length || invented.length)
      problems.push(
        `chiffres : ${missing.length ? "perdus " + missing.join(", ") : ""}` +
        `${missing.length && invented.length ? " · " : ""}` +
        `${invented.length ? "ajoutés " + invented.join(", ") : ""}\n      en : ${n.en.slice(0, 110)}\n      pt : ${n.pt.slice(0, 110)}`,
      );
  }

  if (problems.length) {
    failures++;
    console.log(`✗ ${code} — ${nodes.length} nœuds`);
    for (const p of problems) console.log(`   · ${p}`);
  } else {
    console.log(`✓ ${code} — ${nodes.length} nœuds traduits, en/fr/es intacts, chiffres conservés`);
  }
}
process.exit(failures ? 1 : 0);
