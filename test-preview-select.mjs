#!/usr/bin/env node
/**
 * Harnais de test pour la sélection de version Worker et le prédicat de double concordance
 * (packages/knowledge/scripts/lib/preview-select.mjs).
 *
 * Ces fonctions décident quelle version Cloudflare sera épinglée par une preview. Une erreur
 * ici produit une URL parfaitement valide pointant sur du mauvais code — le genre de panne
 * qui se voit tard et se diagnostique mal. Elles sont donc isolées et testées hors ligne.
 *
 * Les objets de version ci-dessous reproduisent le format RÉEL de
 * `wrangler versions list --config packages/workers/wrangler.toml --env preview --json`
 * (wrangler 3.114.17), relevé le 11/08/2026 — y compris le tri ASCENDANT par `number`, qui est
 * précisément le piège auquel ces tests doivent nous rendre insensibles.
 *
 *   node test-preview-select.mjs
 */
import { selectVersionByTag, versionPreviewUrl, healthMatches } from "./packages/knowledge/scripts/lib/preview-select.mjs";

let pass = 0;
let fail = 0;
const check = (label, cond) => {
  console.log((cond ? "  OK   " : "  FAIL ") + label);
  cond ? pass++ : fail++;
};

const SHA = "c53fbe009df10d6bb8e5de802188271396622253";
const TAG = `git-${SHA}`;

const v = (id, number, { tag, has_preview = true } = {}) => ({
  id,
  number,
  metadata: {
    created_on: `2026-07-09T16:26:39.5${number}Z`,
    source: "wrangler",
    author_id: "18e28505861ab6cef1f654c224b755f7",
    author_email: "fromparis@gmail.com",
    has_preview,
  },
  annotations: tag ? { "workers/triggered_by": "version_upload", "workers/tag": tag } : { "workers/triggered_by": "version_upload" },
});

console.log("\n— Sélection par tag —");

// Tri ascendant reproduit : la version taguée est la DERNIÈRE. Un code qui prendrait [0]
// renverrait ici la version 31, de juillet, sans rien signaler.
const nominal = [
  v("23aba493-a792-4c0b-ad96-8e9b53c80025", 31),
  v("27c26750-680a-4d3d-a409-c821c09cbe93", 32),
  v("8f0bca6a-ff1e-4d89-922a-7d4a886a07e9", 33),
  v("f515de54-89f5-42bc-a183-3bd693deb1c8", 130, { tag: TAG }),
];
const r1 = selectVersionByTag(nominal, TAG);
check("trouve la version taguée même si elle est la dernière (tri ascendant)", r1.ok && r1.version.id === "f515de54-89f5-42bc-a183-3bd693deb1c8");

const reversed = [...nominal].reverse();
const r2 = selectVersionByTag(reversed, TAG);
check("indépendant de l'ordre de la liste", r2.ok && r2.version.id === "f515de54-89f5-42bc-a183-3bd693deb1c8");

const r3 = selectVersionByTag(nominal, "git-0000000000000000000000000000000000000000");
check("refuse quand aucune version ne porte le tag", !r3.ok && r3.code === "no_match");

const dupes = [...nominal, v("aaaaaaaa-1111-2222-3333-444444444444", 131, { tag: TAG })];
const r4 = selectVersionByTag(dupes, TAG);
check("refuse quand deux versions portent le même tag (pas de choix arbitraire)", !r4.ok && r4.code === "ambiguous");

const noPrev = [v("bbbbbbbb-1111-2222-3333-444444444444", 132, { tag: TAG, has_preview: false })];
const r5 = selectVersionByTag(noPrev, TAG);
check("refuse une version sans URL de preview (has_preview ≠ true)", !r5.ok && r5.code === "no_preview");

const untagged = [v("cccccccc-1111-2222-3333-444444444444", 133)];
const r6 = selectVersionByTag(untagged, TAG);
check("ne confond pas une version sans tag avec une correspondance", !r6.ok && r6.code === "no_match");

// Un tag qui ne diffère que par le SHA court ne doit PAS matcher le SHA complet.
const shortTag = [v("dddddddd-1111-2222-3333-444444444444", 134, { tag: "git-c53fbe0" })];
const r7 = selectVersionByTag(shortTag, TAG);
check("exige une égalité exacte, pas un préfixe (git-c53fbe0 ≠ git-c53fbe00…)", !r7.ok && r7.code === "no_match");

check("refuse une entrée qui n'est pas un tableau", !selectVersionByTag(null, TAG).ok);

console.log("\n— URL versionnée —");
check(
  "construit l'URL à partir des 8 premiers caractères de l'id",
  versionPreviewUrl("f515de54-89f5-42bc-a183-3bd693deb1c8", "mydogcanfly-api-preview", "fromparis.workers.dev") ===
    "https://f515de54-mydogcanfly-api-preview.fromparis.workers.dev",
);

console.log("\n— Double concordance de santé —");
const VID = "f515de54-89f5-42bc-a183-3bd693deb1c8";
check("accepte quand SHA ET id de version concordent", healthMatches({ sha: SHA, worker_version_id: VID }, SHA, VID).ok);
check("refuse quand le SHA diffère (bon Worker, mauvais commit)", !healthMatches({ sha: "autre", worker_version_id: VID }, SHA, VID).ok);
check("refuse quand l'id de version diffère (bon commit annoncé, autre code servi)", !healthMatches({ sha: SHA, worker_version_id: "autre" }, SHA, VID).ok);
check("refuse un corps sans worker_version_id (ancien Worker encore en ligne)", !healthMatches({ sha: SHA }, SHA, VID).ok);
check("refuse un corps vide", !healthMatches({}, SHA, VID).ok);
check("refuse null", !healthMatches(null, SHA, VID).ok);
// Le cas exact observé le 11/08/2026 : ancien Worker répondant transitoirement, sans champ sha.
check("refuse la forme antérieure du corps (ni sha ni worker_version_id)", !healthMatches({ ok: true, service: "mydogcanfly-api", version: "v1" }, SHA, VID).ok);

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
