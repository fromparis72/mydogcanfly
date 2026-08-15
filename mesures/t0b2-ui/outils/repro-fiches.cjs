/**
 * REPRODUCTION des trois anomalies du contre-test navigateur (15/08/2026).
 *
 *   node mesures/t0b2-ui/outils/repro-fiches.cjs
 *
 * PRÉREQUIS : les pages compagnies doivent être construites — le build de CI ne les produit pas
 * (`BUILD_ONLY=__none__`), et c'est précisément le trou qui a laissé passer ces trois anomalies :
 *   PUBLIC_API_BASE=https://00000000-mydogcanfly-api-preview.fromparis.workers.dev \
 *   PUBLIC_SITE_ENV=preview BUILD_ONLY=airlines npm -w @mydogcanfly/ui run build
 * Mesure seule — ne corrige rien. Deux volets :
 *   A. données  : sur les 102 fiches, l'éditorial affiché contredit-il la décision canonique ?
 *   B. DOM      : la fiche Thai construite produit-elle l'erreur `mdcfQuery`, et montre-t-elle
 *                 le statut canonique et la source auditée ?
 */
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..", "..", "..");
const DIST = path.join(ROOT, "packages/ui/dist");

// ---- A. Contradiction éditorial ↔ décision canonique, sur TOUTES les fiches ----------------
const CIBLE = {
  offered: "disponible",
  not_offered: "indisponible",
  case_by_case: "à confirmer",
  undocumented: "à confirmer",
};
const rows = [];
for (const f of fs.readdirSync(path.join(ROOT, "content/airlines")).filter((x) => x.endsWith(".yml") && !x.startsWith("_")).sort()) {
  const fiche = YAML.parse(fs.readFileSync(path.join(ROOT, "content/airlines", f), "utf8"));
  for (const c of fiche.channels || []) {
    const d = fiche.policies?.[c.placement];
    if (!d) continue;
    const canonique = "review_state" in d ? "à confirmer" : CIBLE[d.availability];
    /* Ce que la fiche AFFICHE aujourd'hui : la pastille `cls` porte le sens visuel.
       ok/warn se lisent « ouvert », no « fermé » — c'est exactement l'ancienne traduction. */
    const affiche = c.cls === "no" ? "indisponible" : c.cls === "neutral" ? "neutre" : "disponible";
    if (affiche !== canonique) {
      rows.push({
        airline: fiche.id, placement: c.placement, cls: c.cls,
        statusLabel_fr: c.statusLabel?.fr ?? c.statusLabel?.en,
        affiche, canonique,
        decision: "review_state" in d ? "review_state:legacy_unreviewed" : `availability:${d.availability}`,
      });
    }
  }
}
const parDecision = {};
for (const r of rows) parDecision[r.decision] = (parDecision[r.decision] || 0) + 1;
const pages = new Set(rows.map((r) => r.airline));

console.log("=== A. Contradictions éditorial ↔ décision canonique ===");
console.log("canaux en contradiction :", rows.length);
console.log("fiches concernées       :", pages.size, "/ 102");
console.log("par décision canonique  :", parDecision);
console.log("\nexemples :");
for (const r of rows.slice(0, 6)) {
  console.log(`  ${r.airline}.${r.placement}  cls=${r.cls} « ${r.statusLabel_fr} »  affiché=${r.affiche}  canonique=${r.canonique}`);
}
fs.writeFileSync(path.join(__dirname, "..", "contradictions-fiches.json"),
  JSON.stringify({ total: rows.length, fiches: [...pages].sort(), par_decision: parDecision, rows }, null, 1) + "\n");

// ---- B. DOM de la fiche Thai réellement construite ------------------------------------------
console.log("\n=== B. DOM de la fiche Thai construite ===");
const AUDIT_URL = "pets-as-checked-baggage-avih";
for (const [langue, rel] of [["fr", "fr/airlines/thai-airways/index.html"], ["en", "airlines/thai-airways/index.html"]]) {
  const html = fs.readFileSync(path.join(DIST, rel), "utf8");
  const erreurs = [];
  const vc = new (require("jsdom").VirtualConsole)();
  vc.on("jsdomError", (e) => erreurs.push(String(e.message || e)));
  vc.on("error", (...a) => erreurs.push(a.map(String).join(" ")));
  const dom = new JSDOM(html, {
    url: `https://mydogcanfly.com/${langue === "fr" ? "fr/" : ""}airlines/thai-airways/`,
    runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true,
  });
  const doc = dom.window.document;
  const texte = doc.body.textContent.replace(/\s+/g, " ");
  /* Le canal fret tel qu'il est rendu : sa pastille de statut. */
  const minis = [...doc.querySelectorAll(".mini")];
  const fret = minis.find((m) => /cargo|fret/i.test(m.querySelector(".t")?.textContent || ""));
  const pastille = fret?.querySelector(".pill");
  console.log(`\n[${langue}]`);
  console.log("  canal fret, pastille  :", pastille ? `« ${pastille.textContent.trim()} » class="${pastille.className}"` : "ABSENT");
  console.log("  « à confirmer » visible sur le fret :", /confirm/i.test(pastille?.textContent || "") ? "OUI" : "NON");
  console.log("  URL auditée présente  :", html.includes(AUDIT_URL) ? "OUI" : "NON");
  console.log("  « 13/08 » ou 2026-08-13 :", /13[\/ ]0?8|2026-08-13|13 août/i.test(texte) ? "OUI" : "NON");
  console.log("  erreurs console       :", erreurs.length);
  for (const e of erreurs.slice(0, 3)) console.log("      ", e.split("\n")[0].slice(0, 120));
  dom.window.close();
}
