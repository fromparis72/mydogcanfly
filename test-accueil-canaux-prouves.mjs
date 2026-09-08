/**
 * LA PHRASE D'ACCUEIL SUR LES CANAUX PROUVÉS — contre-épreuve du contre-test navigateur du 08/09/2026.
 *
 * L'accueil disait, dans les quatre langues : « Aucun canal de compagnie n'est encore confirmé par
 * une source officielle citée. » Deux clics plus loin, la fiche British Airways montrait un refus
 * cabine cité et daté du 05/09/2026. La phrase confondait « confirmé » et « confirmé OUVERT » :
 * vraie pour les ouvertures, fausse pour les refus.
 *
 * Elle est maintenant CALCULÉE à chaque build depuis la projection des politiques de canal — seuls
 * `allowed` et `denied` sortent de `projectPlacementPolicy` sur citation — et cette contre-épreuve
 * recompte de son côté, puis relit l'accueil construit dans ses zones publiques.
 *
 *   node --import tsx test-accueil-canaux-prouves.mjs --dist=packages/ui/dist
 *
 * `--dist=` EST OBLIGATOIRE, et son absence est un REFUS — pas un vert. Première rédaction
 * fautive, nommée : ce test lisait un dist par défaut et vivait dans `test:unit`, qui tourne en CI
 * AVANT le build ; il a rougi sur « index.html absent du dist » (run 34213137943). Localement je
 * l'avais joué après un build, et j'ai pris mon ordre d'exécution pour celui de la CI. Il suit
 * désormais la convention de `test-etape3-dom` : joué en CI après le build, sur le site complet.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadKB } from "@mydogcanfly/knowledge";
import { zonesDe } from "./test-lib/zones-publiques.mjs";

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
if (!DIST || !existsSync(DIST)) {
  console.error("[accueil-canaux] REFUS — `--dist=<chemin>` est obligatoire et doit exister.");
  console.error("                 Une garde qui se saute faute d'artefact ne garde rien.");
  process.exit(1);
}
let defauts = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const echec = (m, d) => { defauts++; console.log(`  ✗ ${m}${d ? ` — ${d}` : ""}`); };

console.log("=== L'accueil et les canaux prouvés ===");

/* 1. LE COMPTE, refait ici depuis la même projection que le site. */
const kb = loadKB();
const compte = { ouverts: 0, refus: 0, aConfirmer: 0, total: 0 };
for (const a of kb.airlines.values()) {
  for (const v of Object.values(a.premium?.policy ?? {})) {
    if (!v) continue;
    compte.total++;
    if (v.status === "allowed" || v.status === "accepted_with_conditions") compte.ouverts++;
    else if (v.status === "denied") compte.refus++;
    else compte.aConfirmer++;
  }
}
console.log(`  base : ${compte.total} politiques de canal — ${compte.ouverts} ouverte(s) prouvée(s), ${compte.refus} refus prouvé(s), ${compte.aConfirmer} à confirmer`);
if (compte.total === 0) echec("aucune politique de canal chargée — la contre-épreuve ne mord sur rien");

/* 2. LA PHRASE ATTENDUE, dans chaque langue, depuis les mêmes tables que le site. */
const tables = Object.fromEntries(["en", "fr", "es", "pt"].map((l) => [l, JSON.parse(readFileSync(`packages/knowledge/translations/${l}/strings.json`, "utf8"))]));
const cle = compte.ouverts === 0 ? "home.rated.sub.none_open" : "home.rated.sub.some_open";
const ANCIENNES = [
  /No airline channel is confirmed by a quoted official source yet/,
  /Aucun canal de compagnie n'est encore confirmé par une source officielle citée/,
  /ningún canal de aerolínea confirmado por una fuente oficial citada/i,
  /nenhum canal de companhia confirmado por uma fonte oficial citada/i,
];
const pages = { en: "index.html", fr: "fr/index.html", es: "es/index.html", pt: "pt/index.html" };
for (const [l, rel] of Object.entries(pages)) {
  const f = join(DIST, rel);
  if (!existsSync(f)) { echec(`${l} : ${rel} absent du dist`); continue; }
  const z = zonesDe(readFileSync(f, "utf8"));
  const tout = [z.titre, z.corps, z.metas, z.jsonLd, z.attributs].join("\n");
  const attendue = tables[l][cle].replace("{open}", String(compte.ouverts)).replace("{refusals}", String(compte.refus));
  if (!attendue || attendue === cle) echec(`${l} : la clé ${cle} manque dans strings.json`);
  else if (!z.corps.includes(attendue)) echec(`${l} : la phrase calculée n'est pas dans le corps de l'accueil`, attendue.slice(0, 80));
  else ok(`${l} : l'accueil dit « ${attendue.slice(0, 70)}… »`);
  const ancienne = ANCIENNES.find((re) => re.test(tout));
  if (ancienne) echec(`${l} : l'ancienne phrase « aucun canal confirmé » est encore publiée (une zone)`, String(ancienne));
  if (/\{(open|refusals)\}/.test(tout)) echec(`${l} : un gabarit {open}/{refusals} est publié tel quel`);
  if (compte.refus > 0 && z.corps.includes(attendue) && !attendue.includes(String(compte.refus))) echec(`${l} : la phrase ne porte pas le nombre de refus`);
}

/* 3. NON-VACUITÉ : la phrase calculée pour un autre compte serait différente — sinon le contrôle
      accepterait une phrase sans nombre. */
{
  const a = tables.fr[cle].replace("{open}", "0").replace("{refusals}", "1");
  const b = tables.fr[cle].replace("{open}", "0").replace("{refusals}", "7");
  if (a === b) echec("la phrase ne dépend pas du nombre de refus");
  else ok("la phrase change avec le compte — le contrôle mord");
}

console.log(defauts ? `\n[accueil-canaux] ÉCHEC — ${defauts} contre-épreuve(s) en défaut` : "\n[accueil-canaux] l'accueil dit exactement ce que la base prouve : ouvertures et refus, comptés au build.");
process.exit(defauts ? 1 : 0);
