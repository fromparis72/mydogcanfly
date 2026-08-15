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
/* Le script d'ingestion importe LE contrat de provenance auditée (`T0bAuditSource`, TypeScript)
   au lieu d'en recopier un second : le bac à sable doit donc embarquer les sources du paquet
   `knowledge`, l'ensemble d'identités approuvé, et exécuter le script sous `tsx`. */
const SRC_REL = join("packages", "knowledge", "src");
const IDENTITES_REL = join("test-baselines", "t0b2-policy-identities.json");

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
  cpSync(join(ROOT, SRC_REL), join(SANDBOX, SRC_REL), { recursive: true });
  mkdirSync(join(SANDBOX, "test-baselines"), { recursive: true });
  cpSync(join(ROOT, IDENTITES_REL), join(SANDBOX, IDENTITES_REL));
}

/** Exécute le script DANS le bac à sable et renvoie code + sorties. */
const run = (...args) => {
  const r = spawnSync(process.execPath, ["--import", "tsx", join(SANDBOX, SCRIPT_REL), ...args], { encoding: "utf8" });
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
  check("les 10 PROVENANCE_CURATED sont listés", (out.match(/^ {2}PROVENANCE_CURATED /gm) || []).length === 10,
    `trouvés : ${(out.match(/^ {2}PROVENANCE_CURATED /gm) || []).length}`);
  /* T0-B2 : la dette POLICY_STALE n'existe plus, et son mécanisme non plus. Sa réapparition
     signalerait un retour de la dérivation par libellé. */
  check("aucun POLICY_STALE résiduel (mécanisme supprimé en T0-B2)", !out.includes("POLICY_STALE"));
}

console.log("\n=== 2. La provenance stockée est PRÉSERVÉE, jamais écrasée par la dérivée ===");
// Les dix anciens POLICY_STALE portent une provenance plus précise que la dérivation (URL de
// fret dédiée, confiance 4). Redevenus dérivables par T0-B2, ils seraient écrasés sans garde-fou.
{
  freshSandbox();
  const avant = sandboxJson(OBJECTS_REL).airlines.find((a) => a.id === "airline_asiana").premium.policy.cargo.source;
  check("préalable : asiana.cargo cite une URL de fret dédiée", avant.url.includes("asianacargo.com"), avant.url);
  const ingest = run();
  check("l'ingestion normale réussit", ingest.code === 0, ingest.out.slice(-200));
  const apres = sandboxJson(OBJECTS_REL).airlines.find((a) => a.id === "airline_asiana").premium.policy.cargo.source;
  check("l'URL de fret a SURVÉCU à la régénération", apres.url === avant.url, `${avant.url} → ${apres.url}`);
  check("la confiance n'a pas été abaissée", apres.confidence === avant.confidence, `${avant.confidence} → ${apres.confidence}`);
  check("l'écart est NOMMÉ, pas silencieux", run("--check").out.includes("PROVENANCE_CURATED airline_asiana.cargo"));
}

console.log("\n=== 3. La décision vient des fiches — les contre-épreuves du cadrage T0-B2 ===");
// `catOf(name.en)` a disparu : renommer un canal ne peut plus le détacher de sa décision, et une
// décision absente, doublée ou hybride doit être REFUSÉE, jamais réparée en silence.
{
  const fichePath = () => join(SANDBOX, "content", "airlines", "aegean.yml");
  const muter = (remplace) => {
    freshSandbox();
    writeFileSync(fichePath(), remplace(readFileSync(fichePath(), "utf8")));
    return run();
  };

  // (a) éditorial modifié → AUCUN effet sur la décision
  {
    const avant = sandboxJson(OBJECTS_REL);
    const r = muter((t) => t.replace("en: Aegean Cargo", "en: Aegean Airfreight XYZ").replace(/^    cls: warn$/m, "    cls: ok"));
    check("(a) renommer un canal et changer son `cls` : l'ingestion réussit", r.code === 0, r.out.slice(-300));
    const apres = sandboxJson(OBJECTS_REL);
    const pol = (o) => JSON.stringify(o.airlines.find((a) => a.id === "airline_aegean").premium.policy);
    check("(a) la décision d'Aegean est INCHANGÉE — le texte ne décide plus", pol(apres) === pol(avant),
      `${pol(avant)}\n         → ${pol(apres)}`);
  }

  // (b) décision ABSENTE pour un placement qu'un canal revendique
  {
    const r = muter((t) => t.replace("policies:\n  cabin:\n    availability: offered\n", "policies:\n"));
    check("(b) décision absente → REFUS", r.code === 1);
    check("(b) le refus nomme le placement orphelin", /policies|placement/.test(r.out), r.out.slice(-300));
  }

  // (c) décision HYBRIDE : les deux discriminants à la fois
  {
    const r = muter((t) => t.replace("  cabin:\n    availability: offered",
      "  cabin:\n    availability: offered\n    review_state: legacy_unreviewed"));
    check("(c) décision hybride (availability + review_state) → REFUS", r.code === 1, r.out.slice(-300));
  }

  // (d) valeur de disponibilité INVENTÉE
  {
    const r = muter((t) => t.replace("    availability: offered", "    availability: probably_fine"));
    check("(d) disponibilité inventée → REFUS", r.code === 1, r.out.slice(-300));
  }

  // (e) placement DUPLIQUÉ dans une fiche
  {
    const r = muter((t) => t.replace("  - placement: hold", "  - placement: cabin"));
    check("(e) deux canaux sur le même placement → REFUS", r.code === 1, r.out.slice(-300));
  }

  // (f) placement INCONNU
  {
    const r = muter((t) => t.replace("  - placement: hold", "  - placement: soute"));
    check("(f) placement inconnu → REFUS", r.code === 1, r.out.slice(-300));
  }

  // (g) réintroduction de la forme d'auteur héritée dans l'artefact
  {
    freshSandbox();
    const objects = sandboxJson(OBJECTS_REL);
    const ae = objects.airlines.find((a) => a.id === "airline_aegean");
    delete ae.premium.policy.cargo.review_state;
    ae.premium.policy.cargo.allowed = true;
    ae.premium.policy.cargo.conditional = true;
    writeSandboxJson(OBJECTS_REL, objects);
    const { code, out } = run("--check");
    check("(g) `allowed`/`conditional` réintroduits dans objects.json → REFUS", code === 1, out.slice(-300));
  }

  /* (i) SUPPRESSION — la fiche est autoritaire, y compris par le retrait.
   *
   * Contre-épreuve de la contre-revue du 15/08/2026 : retirer `policies.cargo` et le canal cargo
   * d'Air France laissait la politique cargo SURVIVRE dans objects.json, ingestion et `--check`
   * en code 0. Le fantôme est la classe de défaut que T0-B2 devait fermer — et la cause même des
   * dix anciens POLICY_STALE. */
  {
    const retireCargo = (t) => {
      const sansPolitique = t.replace("  cargo:\n    review_state: legacy_unreviewed\n", "");
      const lignes = sansPolitique.split("\n");
      const sortie = []; let saute = false;
      for (const l of lignes) {
        if (/^ {2}- placement: cargo$/.test(l)) { saute = true; continue; }
        if (saute && (/^ {2}- placement: /.test(l) || /^[A-Za-z_]/.test(l))) saute = false;
        if (!saute) sortie.push(l);
      }
      return sortie.join("\n");
    };
    const r = muter(retireCargo);
    check("(i) retirer un placement de la fiche : l'ingestion réussit", r.code === 0, r.out.slice(-300));
    const pol = sandboxJson(OBJECTS_REL).airlines.find((a) => a.id === "airline_aegean").premium.policy;
    check("(i) la politique cargo est SUPPRIMÉE d'objects.json — aucun fantôme",
      pol.cargo === undefined, JSON.stringify(pol.cargo ?? null).slice(0, 120));
    check("(i) et les deux autres placements survivent intacts",
      pol.cabin !== undefined && pol.hold !== undefined);
    /* Le cas qui compte VRAIMENT — la séquence exacte de la contre-revue : modification YAML,
       puis ingestion normale, puis `--check` DANS LE MÊME bac à sable. La première version ne
       voyait la suppression que tant que l'ancien objects.json portait encore la politique ;
       après régénération la preuve disparaissait avec l'artefact. La référence est désormais
       l'ensemble d'identités VERSIONNÉ, extérieur aux artefacts. */
    const apres = run("--check");
    check("(i) `--check` APRÈS régénération voit encore la disparition", apres.code === 1, apres.out.slice(-400));
    check("(i) elle est nommée comme un changement d'IDENTITÉS",
      apres.out.includes("l'ensemble des IDENTITÉS de politiques a changé")
      && apres.out.includes("- airline_aegean.cargo"), apres.out.slice(-400));
  }

  /* (k) APPARITION d'une politique, et SUBSTITUTION à cardinal constant. Un contrôle qui ne
     compterait que le total laisserait passer la seconde. */
  {
    const r = muter((t) => t.replace("policies:\n", "policies:\n  cabin:\n    availability: offered\n")
      .replace("  cabin:\n    availability: offered\n  cabin:\n", "  cabin:\n"));
    check("(k) préalable : la fiche reste bien formée", r.code === 0 || r.code === 1);
    // substitution : on retire cargo et on ajoute une politique là où il n'y en avait pas
    freshSandbox();
    const fiche = readFileSync(join(SANDBOX, "content", "airlines", "sky_express.yml"), "utf8");
    if (/^  cabin:$/m.test(fiche)) {
      const mute = fiche.replace(/  cargo:\n    review_state: legacy_unreviewed\n/, "");
      writeFileSync(join(SANDBOX, "content", "airlines", "sky_express.yml"), mute);
      const rr = run("--check");
      check("(k) substitution / disparition à effectif non constant → REFUS", rr.code === 1, rr.out.slice(-300));
    }
  }

  /* (l) SOURCE AUDITÉE — le contrat approuvé, pas un schéma parallèle.
     Contre-épreuve exacte de la contre-revue : la falsification passait de bout en bout tant que
     l'ingestion validait avec son propre modèle. */
  {
    const thai = () => join(SANDBOX, "content", "airlines", "thai_airways.yml");
    freshSandbox();
    writeFileSync(thai(), readFileSync(thai(), "utf8")
      .replace(/      url: "https:\/\/www\.thaiairways\.com[^"]*"/, '      url: "https://mydogcanfly.com/fake-self-citation"')
      .replace('      review_due: "2026-11-11"', '      review_due: "2030-01-01"')
      .replace(/      quote: "\(For cargo[^"]*"/, '      quote: "x"')
      .replace("      quote_language: en", '      quote_language: "not a language"'));
    const { code, out } = run();
    check("(l) source auditée falsifiée → REFUS de l'ingestion", code === 1);
    for (const [quoi, motif] of [
      ["auto-citation refusée", "auto-citation"],
      ["citation trop courte refusée", "at least 10 character"],
      ["langue non BCP-47 refusée", "BCP-47"],
      ["cadence de 90 jours imposée", "cadence airline"],
    ]) check(`(l) ${quoi}`, out.includes(motif), out.slice(-500));
  }

  /* (m) une source auditée VALIDE doit gagner, même sur une politique enrichie écrite à la main —
     elle était acceptée par le schéma puis silencieusement ignorée. */
  {
    freshSandbox();
    const af = join(SANDBOX, "content", "airlines", "air_france.yml");
    const avant = sandboxJson(OBJECTS_REL).airlines.find((a) => a.id === "airline_air_france").premium.policy.cabin;
    check("(m) préalable : air_france.cabin est enrichie et écrite à la main",
      avant.derived_from_fiche === undefined && avant.max_weight_kg === 8);
    writeFileSync(af, readFileSync(af, "utf8").replace("  cabin:\n    availability: offered\n",
      '  cabin:\n    availability: offered\n    source:\n'
      + '      url: "https://wwws.airfrance.fr/information/passagers/animaux-cabine"\n'
      + "      source_type: official_website\n"
      + '      verified_date: "2026-08-14"\n      review_due: "2026-11-12"\n      confidence: 4\n'
      + '      reviewer: "contre-épreuve de revue"\n'
      + '      quote: "Les chiens et chats de moins de 8 kg voyagent en cabine."\n'
      + "      quote_language: fr\n      locator: \"section Animaux en cabine\"\n"));
    const r = run();
    check("(m) l'ingestion réussit", r.code === 0, r.out.slice(-300));
    const apres = sandboxJson(OBJECTS_REL).airlines.find((a) => a.id === "airline_air_france").premium.policy.cabin;
    check("(m) la source auditée GAGNE sur la provenance écrite à la main",
      apres.source.url === "https://wwws.airfrance.fr/information/passagers/animaux-cabine"
      && apres.source.quote?.startsWith("Les chiens et chats"), JSON.stringify(apres.source).slice(0, 200));
    check("(m) les enrichissements survivent (poids, dimensions)",
      apres.max_weight_kg === 8 && apres.carrier_dims_cm?.l === 46, JSON.stringify(apres).slice(0, 200));
  }

  /* (j) la dette des politiques sans canal visible est scellée DANS LES DEUX SENS. */
  {
    const r = muter((t) => t.replace("  - placement: hold\n", "  - placement: hold\n    __retire: true\n"));
    check("(j) préalable : une clé inconnue sur un canal est refusée", r.code === 1);
    freshSandbox();
    // retirer le CANAL hold sans retirer sa politique → dette éditoriale NOUVELLE
    const lignes = readFileSync(fichePath(), "utf8").split("\n");
    const sortie = []; let saute = false;
    for (const l of lignes) {
      if (/^ {2}- placement: hold$/.test(l)) { saute = true; continue; }
      if (saute && (/^ {2}- placement: /.test(l) || /^[A-Za-z_]/.test(l))) saute = false;
      if (!saute) sortie.push(l);
    }
    writeFileSync(fichePath(), sortie.join("\n"));
    const r2 = run();
    check("(j) politique sans canal visible hors dette scellée → REFUS", r2.code === 1, r2.out.slice(-300));
    check("(j) le refus nomme la dette non scellée",
      /dette scellée|sans canal visible/.test(r2.out), r2.out.slice(-300));
  }

  // (h) la fiche modifiée SANS régénération → dérive nommée
  {
    const r0 = muter((t) => t.replace("  cargo:\n    review_state: legacy_unreviewed", "  cargo:\n    availability: offered"));
    check("(h) préalable : l'ingestion écrit la nouvelle décision", r0.code === 0);
    freshSandbox();
    writeFileSync(fichePath(), readFileSync(fichePath(), "utf8")
      .replace("  cargo:\n    review_state: legacy_unreviewed", "  cargo:\n    availability: offered"));
    const { code, out } = run("--check");
    check("(h) fiche modifiée sans régénération → dérive NOMMÉE", code === 1 && out.includes("aegean"), out.slice(-400));
  }
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
