/**
 * T0-B2 — écriture UNIQUE de la structure décisionnelle dans les fiches (option C).
 *
 *   node mesures/t0b2/outils/ecrire-policies-yaml.mjs <racine> <registre-migration.json> [--verifier]
 *
 * Deux ajouts, et rien d'autre :
 *
 *   1. un bloc `policies:` — UNIQUE, non éditorial — portant les 302 décisions, une par
 *      placement. La clé `cabin`/`hold`/`cargo` EST le placement : il n'est plus relu d'un nom
 *      anglais ;
 *   2. un champ `placement:` en tête de chacun des 296 canaux visibles, qui RELIE le contenu
 *      affiché à sa politique — et ne décide jamais.
 *
 * L'insertion est TEXTUELLE et chirurgicale. Le round-trip `parseDocument` → `String()` du
 * paquet `yaml` ne restitue aucune des 103 fiches à l'identique (guillemets, largeur de ligne,
 * commentaires) : régénérer les fichiers produirait un diff illisible où la migration serait
 * indiscernable du reformatage. On n'insère donc que des lignes, sans toucher à une seule ligne
 * existante — `--verifier` le prouve, fichier par fichier.
 *
 * `_template.yml` est exclu, comme par l'ingestion (préfixe `_`) : squelette vide, `id: null`,
 * aucun canal. Les fiches réelles sont 102.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const ROOT = process.argv[2];
const REGISTRE = process.argv[3];
const VERIFIER = process.argv.includes("--verifier");
if (!ROOT || !REGISTRE) {
  console.error("usage : ecrire-policies-yaml.mjs <racine> <registre-migration.json> [--verifier]");
  process.exit(2);
}
const SRC = join(ROOT, "content", "airlines");

/** Les 4 canaux dont le libellé n'était pas reconnu — rattachement scellé (cf. faisabilite-option-c). */
const RATTACHEMENT_EXPLICITE = {
  "airline_french_bee|channels[2]": "cargo",
  "airline_korean_air|channels[2]": "cargo",
  "airline_malaysia_airlines|channels[2]": "cargo",
  "airline_qantas|channels[1]": "cargo",
};
/** Les 6 politiques sans canal visible — dette ÉDITORIALE scellée, décision désormais explicite. */
const SANS_CANAL_VISIBLE = [
  "airline_asiana.cargo", "airline_condor.cargo", "airline_eva_air.cargo",
  "airline_norwegian.cargo", "airline_qantas.hold", "airline_virgin_australia.hold",
];

const catOf = (name) => {
  const n = (name || "").toLowerCase();
  if (/cargo|fret/.test(n)) return "cargo";
  if (/hold|soute|checked/.test(n)) return "hold";
  if (/cabin|cabine/.test(n)) return "cabin";
  return null;
};

const registre = JSON.parse(readFileSync(REGISTRE, "utf8"));
/** clé « airline.placement » → cible (`availability:offered`, `review_state:legacy_unreviewed`, …) */
const cible = new Map(registre.registre.map((r) => [r.key, r]));

const files = readdirSync(SRC).filter((f) => f.endsWith(".yml") && !f.startsWith("_") && !f.startsWith(".")).sort();
let canaux = 0, politiques = 0, sansCanal = 0;
const anomalies = [];
const rattachementsConsommes = new Map(Object.keys(RATTACHEMENT_EXPLICITE).map((k) => [k, 0]));

for (const f of files) {
  const chemin = join(SRC, f);
  const source = readFileSync(chemin, "utf8");
  const fiche = YAML.parse(source);
  const lignes = source.split("\n");

  /* --- 1. Placement de chaque canal, par sa POSITION (le locator, pas le nom) --- */
  const placementParIndex = new Map();
  (fiche.channels || []).forEach((c, i) => {
    const explicite = RATTACHEMENT_EXPLICITE[`${fiche.id}|channels[${i}]`];
    if (explicite) rattachementsConsommes.set(`${fiche.id}|channels[${i}]`, rattachementsConsommes.get(`${fiche.id}|channels[${i}]`) + 1);
    const pl = explicite ?? catOf(c.name?.en);
    if (!pl) { anomalies.push(`${f} channels[${i}] : aucun placement`); return; }
    if ([...placementParIndex.values()].includes(pl)) anomalies.push(`${f} : placement ${pl} dupliqué`);
    placementParIndex.set(i, pl);
  });

  /* --- 2. Les politiques de cette compagnie, dans l'ordre canonique --- */
  const modes = ["cabin", "hold", "cargo"].filter((m) => cible.has(`${fiche.id}.${m}`));
  for (const m of modes) {
    if (![...placementParIndex.values()].includes(m) && !SANS_CANAL_VISIBLE.includes(`${fiche.id}.${m}`)) {
      anomalies.push(`${f} : politique ${m} sans canal visible et HORS dette scellée`);
    }
  }

  /* --- 3. Insertion : `placement:` en tête de canal, sans toucher aux lignes existantes --- */
  let idx = -1;
  let dansChannels = false;
  const sorties = [];
  /** Index des lignes AJOUTÉES et des lignes seulement RÉINDENTÉES — la preuve du §5 s'appuie
   *  dessus pour reconstituer la source et exiger l'égalité octet à octet. */
  const inserees = new Set(), reindentees = new Set();
  for (const ligne of lignes) {
    if (/^channels:\s*$/.test(ligne)) { dansChannels = true; sorties.push(ligne); continue; }
    if (dansChannels && /^[A-Za-z_]/.test(ligne)) dansChannels = false;
    if (dansChannels && /^ {2}- icon:/.test(ligne)) {
      idx++;
      const pl = placementParIndex.get(idx);
      if (pl) {
        /* `- placement:` d'abord, puis l'`icon:` d'origine réindenté : la ligne existante est
           déplacée telle quelle, jamais réécrite. */
        inserees.add(sorties.length);
        sorties.push(`  - placement: ${pl}`);
        reindentees.add(sorties.length);
        sorties.push(ligne.replace(/^ {2}- /, "    "));
        continue;
      }
    }
    sorties.push(ligne);
  }
  if (idx + 1 !== (fiche.channels || []).length) anomalies.push(`${f} : ${idx + 1} canaux vus, ${(fiche.channels || []).length} attendus`);

  /* --- 4. Insertion du bloc `policies:` juste avant `channels:` --- */
  const bloc = ["policies:"];
  for (const m of modes) {
    const [discriminant, valeur] = cible.get(`${fiche.id}.${m}`).cible.split(":");
    bloc.push(`  ${m}:`);
    bloc.push(`    ${discriminant}: ${valeur}`);
    politiques++;
    if (SANS_CANAL_VISIBLE.includes(`${fiche.id}.${m}`)) {
      bloc.push(`    # dette éditoriale scellée (T0-B2) : aucun canal visible ne décrit ce placement`);
      sansCanal++;
    }
  }
  const posChannels = sorties.findIndex((l) => /^channels:\s*$/.test(l));
  if (posChannels < 0) { anomalies.push(`${f} : bloc channels: introuvable`); continue; }
  canaux += placementParIndex.size;

  /* --- 5. Preuve d'innocuité, AVANT d'insérer le bloc : on retire les lignes ajoutées, on
     défait la réindentation, et on exige l'égalité OCTET À OCTET avec la source. Une comparaison
     « au contenu près » laisserait passer un guillemet perdu ou un espace insécable réécrit. */
  const reconstituee = sorties
    .map((l, i) => (inserees.has(i) ? null : reindentees.has(i) ? l.replace(/^ {4}/, "  - ") : l))
    .filter((l) => l !== null)
    .join("\n");
  if (reconstituee !== source) { anomalies.push(`${f} : une ligne existante a été altérée`); continue; }

  const finales = [...sorties.slice(0, posChannels), ...bloc, ...sorties.slice(posChannels)];
  const resultat = finales.join("\n");

  if (!VERIFIER) writeFileSync(chemin, resultat);
}

const nonConsommes = [...rattachementsConsommes].filter(([, n]) => n !== 1);
if (nonConsommes.length) anomalies.push(`rattachements non consommés une fois : ${JSON.stringify(nonConsommes)}`);

console.log("fiches réelles          :", files.length, "(attendu 102 ; _template.yml exclu)");
console.log("canaux porteurs         :", canaux, "(attendu 296)");
console.log("politiques déclarées    :", politiques, "(attendu 302)");
console.log("dont sans canal visible :", sansCanal, "(attendu 6)");
console.log("anomalies               :", anomalies.length);
anomalies.slice(0, 10).forEach((a) => console.log("   ", a));

if (anomalies.length) process.exit(1);
if (files.length !== 102) { console.error("ECHEC fiches ≠ 102"); process.exit(1); }
if (canaux !== 296) { console.error("ECHEC canaux ≠ 296"); process.exit(1); }
if (politiques !== 302) { console.error("ECHEC politiques ≠ 302"); process.exit(1); }
if (sansCanal !== 6) { console.error("ECHEC dette ≠ 6"); process.exit(1); }
console.log(VERIFIER ? "\nVÉRIFICATION SEULE — rien écrit." : "\nFiches écrites.");
