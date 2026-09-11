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
/* LE SCELLÉ DE RELECTURE HUMAINE (annexe 56) : le script d'ingestion l'importe depuis `raw/`,
   le bac à sable doit donc l'embarquer — sans quoi le harnais échoue à la RÉSOLUTION du module et
   ses 79 contrôles rougissent pour une raison qui n'a rien à voir avec ce qu'ils mesurent. */
const SCELLE_REL = join("packages", "knowledge", "raw", "attestations-relues.json");
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
  cpSync(join(ROOT, SCELLE_REL), join(SANDBOX, SCELLE_REL));
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
    /* Le bloc cabine ENTIER (08/09/2026, import strict V3) : la fiche porte désormais, sous
       `availability`, la preuve citée et le seuil. Retirer trois lignes fixes laissait ces lignes
       orphelines, et l'ingestion rougissait sur une indentation YAML au lieu du refus attendu. */
    const r = muter((t) => t.replace(/policies:\n  cabin:\n[\s\S]*?(?=\n  hold:)/, "policies:"));
    check("(b) décision absente → REFUS", r.code === 1);
    check("(b) le refus nomme le placement orphelin", /policies|placement/.test(r.out), r.out.slice(-300));
  }

  // (c) décision HYBRIDE : les deux discriminants à la fois
  {
    const r = muter((t) => {
      /* Les tarifs vivent désormais avant `availability` : l'ancre porte sur le bloc cabine
         entier, et son absence fait échouer le témoin au lieu de produire un faux vert. */
      const ancre = /(policies:\n  cabin:\n[\s\S]*?\n    availability: offered)/;
      if (!ancre.test(t)) throw new Error("témoin hybride : bloc policies.cabin offert introuvable");
      return t.replace(ancre, "$1\n    review_state: legacy_unreviewed");
    });
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
    /* MOUVEMENT NOMMÉ (09/09/2026, correctif d'arbitrages) : la source auditée du fret Thai (page passager AVIH,
       « (For cargo… », échéance 2026-11-11) est SUPERSÉDÉE par la page THAI Cargo (échéance 2026-12-08). La
       falsification vise désormais CE bloc-là — même contre-épreuve, même contrat, autre preuve. Attrapé par la
       suite complète : les deux anciens motifs ne trouvaient plus rien à falsifier. */
    writeFileSync(thai(), readFileSync(thai(), "utf8")
      .replace(/      url: "https:\/\/www\.thaicargo\.com[^"]*"/, '      url: "https://mydogcanfly.com/fake-self-citation"')
      .replace('      review_due: "2026-12-08"   # reviewDueFrom(verified_date, "airline") — calculé par l\'importeur', '      review_due: "2030-01-01"')
      .replace(/      quote: "The acceptance of live[^"]*"/, '      quote: "x"')
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
    /* MOUVEMENT NOMMÉ (10/09/2026, complément Air France cabine, Codex) : le bloc `policies.cabin` d'Air France porte
       désormais sa propre source citée (« En cabine (chats et chiens de moins de 8 kg, sac de transport compris) »).
       Ce témoin INSÉRAIT un second bloc `source:` — clé dupliquée, YAML refusé, deux échecs qui ne mesuraient plus
       rien. Il était le SEUL spécimen réel « enrichie à la main, sans citation » (mesuré : les cinq autres politiques
       non citées avec plafond — Eurowings, LOT, Norwegian, Volotea, Vueling — sont dérivées de la fiche). La
       contre-épreuve garde son sens en REMPLAÇANT l'URL et la phrase du bloc cité par celles de la revue : la source
       auditée écrite dans la fiche doit gagner sur la provenance que l'artefact porte encore, et les enrichissements
       écrits à la main (dimensions) doivent survivre. Précondition ajoutée : la phrase à remplacer est bien là. */
    const QUOTE_AF = 'quote: "En cabine (chats et chiens de moins de 8 kg, sac de transport compris)"';
    const URL_AF = 'url: "https://wwws.airfrance.fr/information/passagers/voyager-avec-son-animal-chien-chat"';
    check("(m) préalable : air_france.cabin est enrichie à la main (dimensions), et sa fiche porte la phrase citée du 10/09",
      avant.derived_from_fiche === undefined && avant.max_weight_kg === 8 && avant.carrier_dims_cm?.l === 46
      && readFileSync(af, "utf8").includes(QUOTE_AF) && readFileSync(af, "utf8").includes(URL_AF));
    /* MOUVEMENT NOMMÉ (11/09/2026, annexe 51) : ce témoin réécrivait la PHRASE CITÉE sans toucher à
       l'attestation qui s'y rattache. Depuis que la garde du rattachement est branchée à
       l'ingestion, l'ingestion le refuse — et elle a raison : une phrase réécrite n'établit plus le
       fait qui pendait à l'ancienne. Le témoin garde son sens et gagne une exigence : quand la
       preuve change, le rattachement change AVEC elle. La phrase de remplacement dit donc toujours
       le seuil ET le contenant, et l'extrait est repris d'elle. */
    const BORNE_AF = 'borne: "moins de 8 kg"';
    check("(m) préalable : les fragments rattachés à la phrase de cabine sont bien là",
      readFileSync(af, "utf8").includes(BORNE_AF) && readFileSync(af, "utf8").includes('sujet: "8 kg, sac de transport compris"'));
    /* MOUVEMENT NOMMÉ (11/09/2026, annexe 56) : réécrire la PHRASE CITÉE dé-relit le rattachement
       qui pendait à l'ancienne — c'est exactement ce que le scellé existe pour exiger. Le témoin
       retire donc l'attestation de cabine avec la phrase, plutôt que de prétendre qu'un
       rattachement survit à la disparition de sa preuve. Ce qu'il mesure ne change pas : la source
       auditée écrite dans la fiche doit gagner sur la provenance que l'artefact porte encore. */
    writeFileSync(af, readFileSync(af, "utf8")
      .replace(/    attestations:[\s\S]*?\n(?=    source:)/, "")
      .replace(URL_AF, 'url: "https://wwws.airfrance.fr/information/passagers/animaux-cabine"')
      .replace(QUOTE_AF, 'quote: "Les chiens et chats de moins de 8 kg, sac de transport compris, voyagent en cabine."'));
    const r = run();
    check("(m) l'ingestion réussit", r.code === 0, r.out.slice(-300));
    const apres = sandboxJson(OBJECTS_REL).airlines.find((a) => a.id === "airline_air_france").premium.policy.cabin;
    check("(m) la source auditée GAGNE sur la provenance écrite à la main",
      apres.source.url === "https://wwws.airfrance.fr/information/passagers/animaux-cabine"
      && apres.source.quote?.startsWith("Les chiens et chats"), JSON.stringify(apres.source).slice(0, 200));
    check("(m) les enrichissements survivent (poids, dimensions)",
      apres.max_weight_kg === 8 && apres.carrier_dims_cm?.l === 46, JSON.stringify(apres).slice(0, 200));
  }

  /* (n) et (o) LE RATTACHEMENT fait → preuve (annexe 51) — les deux contre-épreuves exigées par
     Codex le 11/09/2026 : « permuter la preuve entre deux canaux ou ajouter une dimension non
     présente dans la citation doit faire rougir ». Elles portent sur l'INGESTION RÉELLE, pas sur
     une fixture : c'est l'écriture d'`objects.json` qui doit être refusée, faute de quoi la
     synthèse localisée publierait un chiffre que sa propre preuve ne porte pas.

     POURQUOI DEUX, ET PAS UNE. Les deux gardes sont indépendantes et se manquent l'une l'autre :
     (n) éprouve « l'extrait vient-il de CETTE citation », (o) éprouve « l'extrait porte-t-il les
     valeurs du fait ». La première version de la garde n'avait que (n) : un extrait authentique
     — « sac de transport compris » — suffisait alors à faire passer 46 × 28 × 24 cm. */
  {
    const af = () => join(SANDBOX, "content", "airlines", "air_france.yml");
    const SUJET_CABINE = 'sujet: "8 kg, sac de transport compris"';
    const QUOTE_CABINE = 'quote: "En cabine (chats et chiens de moins de 8 kg, sac de transport compris)"';
    const QUOTE_SOUTE = 'quote: "If your cat or dog weighs more than 8 kg/17.64 lb. and up to 75 kg/165.35 lb. with its carrier, it must travel in the hold."';

    // (n) LA PREUVE PERMUTÉE entre la cabine et la soute — chaque extrait reste authentique, mais
    //     plus aucun ne vient de la citation du canal qui le porte.
    {
      freshSandbox();
      const avant = readFileSync(af(), "utf8");
      check("(n) préalable : les deux citations d'Air France sont bien celles attendues",
        avant.includes(QUOTE_CABINE) && avant.includes(QUOTE_SOUTE));
      writeFileSync(af(), avant.replace(QUOTE_CABINE, "__CAB__").replace(QUOTE_SOUTE, QUOTE_CABINE).replace("__CAB__", QUOTE_SOUTE));
      const { code, out } = run();
      check("(n) preuve permutée entre deux canaux → REFUS de l'ingestion", code === 1, out.slice(-400));
      check("(n) le refus nomme l'extrait orphelin, pas une erreur de schéma",
        out.includes("ne se trouve pas dans la citation de ce canal"), out.slice(-600));
      check("(n) les DEUX canaux sont nommés — la permutation casse les deux sens",
        out.includes("moins de 8 kg") && out.includes("more than 8 kg"), out.slice(-600));
    }

    // (o) UNE DIMENSION AJOUTÉE, avec un extrait pourtant authentique. C'est exactement le
    //     46 × 28 × 24 cm que l'arbitrage interdit de publier pour Air France.
    {
      freshSandbox();
      const avant = readFileSync(af(), "utf8");
      check("(o) préalable : le fragment de sujet de la cabine est présent", avant.includes(SUJET_CABINE));
      writeFileSync(af(), avant.replace(SUJET_CABINE,
        SUJET_CABINE + "\n      - claim:\n          kind: carrier_dims_cm\n          l: 46\n          w: 28\n          h: 24\n        dimensions: \"sac de transport compris\""));
      const { code, out } = run();
      check("(o) dimension absente de la citation → REFUS de l'ingestion", code === 1, out.slice(-400));
      check("(o) le refus dit que le fragment NE DIT PAS ces dimensions, et les chiffre",
        out.includes("avec leur unité") && out.includes("46") && out.includes("28") && out.includes("24"), out.slice(-600));
    }

    /* (q) et (r) LA SÉMANTIQUE DU FAIT, SUR LE CHEMIN RÉEL — P0 de Codex sur `80e3ce6`.
       `test-attestations-semantique.mjs` éprouve la FONCTION sur ses quatre faux verts ; ces deux
       témoins-ci éprouvent que le refus survient bien à l'ÉCRITURE, sur une fiche du dépôt. Les
       deux sont nécessaires : la contre-revue du 11/09 a montré qu'un contrat vérifié par appel
       direct peut être contourné par le chemin, et la précédente qu'un chemin sabotté sur deux
       canaux ne couvre que les formes déjà présentes dans les données. */
    {
      // (q) LA BORNE RETOURNÉE. La phrase dit « moins de » ; la fiche annonce un plafond INCLUSIF.
      //     Un chien de 8 kg exactement passerait de refusé à accepté, sur la même citation.
      freshSandbox();
      const avant = readFileSync(af(), "utf8");
      writeFileSync(af(), avant
        .replace("          bound: lt\n          subject: dog_plus_carrier", "          bound: lte\n          subject: dog_plus_carrier")
        .replace("    weight_limit_bound: lt\n", "    weight_limit_bound: lte\n"));
      const { code, out } = run();
      check("(q) borne retournée sur la même phrase → REFUS de l'ingestion", code === 1, out.slice(-400));
      check("(q) le refus nomme la borne, pas le nombre", out.includes("ne dit pas la borne"), out.slice(-500));
    }
    {
      // (r) LE CONTENANT AFFIRMÉ PAR UNE PHRASE QUI N'EN PARLE PAS. C'est le cas 1 de Codex, pris
      //     sur la fiche : l'extrait est raccourci jusqu'à perdre « sac de transport compris »,
      //     tandis que l'attestation continue d'annoncer un seuil contenant compris.
      freshSandbox();
      const avant = readFileSync(af(), "utf8");
      writeFileSync(af(), avant.replace(
        '        sujet: "8 kg, sac de transport compris"',
        '        sujet: "chats et chiens de moins de 8 kg"'));
      const { code, out } = run();
      check("(r) seuil « contenant compris » sur un extrait qui n'en nomme aucun → REFUS", code === 1, out.slice(-400));
      check("(r) le refus renvoie à la relecture humaine", out.includes("NON RELUE par un humain"), out.slice(-500));
    }

    /* (s) à (v) LES QUATRE SABOTAGES DE CODEX DU `59d4788`, SUR LE CHEMIN RÉEL.
       Ils sont déjà éprouvés sur la fonction ; Codex a demandé qu'ils le soient aussi à
       l'ingestion, et il a raison : c'est l'écriture d'`objects.json` qui doit être refusée. Chacun
       modifie la PHRASE CITÉE en même temps que le rattachement, pour que le sabotage reste
       cohérent avec lui-même — un rattachement dont le fragment ne vient pas de la phrase serait
       attrapé par la garde de provenance, et ne prouverait donc rien de ces quatre-là. */
    {
      const QUOTE_CAB = 'quote: "En cabine (chats et chiens de moins de 8 kg, sac de transport compris)"';
      const saboter = (remplacements) => {
        freshSandbox();
        let t = readFileSync(af(), "utf8");
        for (const [a, b] of remplacements) {
          if (!t.includes(a)) throw new Error(`sabotage : « ${a.slice(0, 50)} » introuvable dans la fiche`);
          t = t.replace(a, b);
        }
        writeFileSync(af(), t);
        return run();
      };

      // (s) LE CONTENANT DANS UNE AUTRE PROPOSITION — le cas « The carrier must be labelled ».
      {
        /* Le sujet doit maintenant PORTER le poids : la seconde proposition le porte donc aussi, et
           le sabotage éprouve bien la coupure de proposition, pas la provenance du fragment. */
        const { code, out } = saboter([[QUOTE_CAB,
          'quote: "En cabine, chiens de moins de 8 kg. Un chien de 8 kg, sac de transport compris, doit être annoncé."']]);
        check("(s) sujet pris dans une AUTRE proposition de la phrase → REFUS", code === 1, out.slice(-400));
        check("(s) le refus nomme la proposition", out.includes("même proposition"), out.slice(-500));
      }

      // (t) LA PHRASE DIT L'INVERSE — « carrier not included », déclaré « contenant compris ».
      {
        const { code, out } = saboter([
          [QUOTE_CAB, 'quote: "En cabine (chats et chiens de moins de 8 kg, sac de transport non compris)"'],
          ['sujet: "8 kg, sac de transport compris"', 'sujet: "8 kg, sac de transport non compris"'],
        ]);
        check("(t) phrase qui EXCLUT le contenant, déclarée « contenant compris » → REFUS", code === 1, out.slice(-400));
        check("(t) le refus renvoie à la relecture humaine",
          out.includes("NON RELUE par un humain"), out.slice(-500));
      }

      // (u) UN GÉNÉRIQUE D'EXCLUSION QUI NE PARLE PAS DU CONTENANT — le cas « without the owner ».
      {
        const { code, out } = saboter([
          [QUOTE_CAB, 'quote: "En cabine (chats et chiens de moins de 8 kg, sans son maître)"'],
          ["          subject: dog_plus_carrier", "          subject: dog_alone"],
          ['sujet: "8 kg, sac de transport compris"', 'sujet: "8 kg, sans son maître"'],
          ["    weight_includes_carrier: true", "    weight_includes_carrier: false"],
        ]);
        check("(u) « sans son maître » déclaré comme « chien seul » → REFUS", code === 1, out.slice(-400));
        check("(u) le refus renvoie à la relecture humaine",
          out.includes("NON RELUE par un humain"), out.slice(-500));
      }

      // (v) DES POUCES PUBLIÉS EN CENTIMÈTRES.
      {
        const { code, out } = saboter([
          [QUOTE_CAB, 'quote: "En cabine (chats et chiens de moins de 8 kg, sac de transport compris) 46 x 28 x 24 in"'],
          ['        sujet: "8 kg, sac de transport compris"',
           '        sujet: "8 kg, sac de transport compris"\n      - claim:\n          kind: carrier_dims_cm\n          l: 46\n          w: 28\n          h: 24\n        dimensions: "46 x 28 x 24 in"'],
        ]);
        check("(v) dimensions en POUCES rattachées à une claim en centimètres → REFUS", code === 1, out.slice(-400));
        check("(v) le refus nomme l'unité", out.includes("avec leur unité"), out.slice(-500));
      }
    }

    /* (w) à (y) LES DEUX FAUX VERTS DE `8c8faf4`, ET LE TÉMOIN POSITIF QUI LES ÉQUILIBRE.
       La relation était rattachée au CONTENANT, jamais au POIDS : « with the carrier included in
       the ticket price » prouvait un seuil contenant compris, et « a carrier without a label »
       prouvait un seuil sur le chien seul. Le témoin (y) est indissociable des deux : sans lui, la
       correction serait un durcissement aveugle, et une formulation officielle parfaitement claire
       resterait refusée — c'est exactement ce que Codex a mesuré avant de refuser le feu vert. */
    {
      const Q = 'quote: "En cabine (chats et chiens de moins de 8 kg, sac de transport compris)"';
      const S = 'sujet: "8 kg, sac de transport compris"';
      const B = 'borne: "moins de 8 kg"';
      const saboter2 = (remplacements) => {
        freshSandbox();
        let t = readFileSync(af(), "utf8");
        for (const [a, b] of remplacements) {
          if (!t.includes(a)) throw new Error(`sabotage : « ${a.slice(0, 50)} » introuvable dans la fiche`);
          t = t.replace(a, b);
        }
        writeFileSync(af(), t);
        return run();
      };

      // (w) L'INCLUSION PORTE SUR LE PRIX DU BILLET.
      {
        const { code, out } = saboter2([
          [Q, 'quote: "Dogs under 8 kg may travel in cabin, with the carrier included in the ticket price."'],
          [B, 'borne: "under 8 kg"'],
          [S, 'sujet: "under 8 kg may travel in cabin, with the carrier included in the ticket price"'],
        ]);
        check("(w) contenant « included in the ticket price » → REFUS de l'ingestion", code === 1, out.slice(-400));
        check("(w) le refus renvoie à la relecture humaine",
          out.includes("NON RELUE par un humain"), out.slice(-500));
      }

      // (x) L'EXCLUSION PORTE SUR UNE ÉTIQUETTE.
      {
        const { code, out } = saboter2([
          [Q, 'quote: "Dogs under 8 kg may travel in cabin, but a carrier without a label is refused."'],
          ["          subject: dog_plus_carrier", "          subject: dog_alone"],
          [B, 'borne: "under 8 kg"'],
          [S, 'sujet: "under 8 kg may travel in cabin, but a carrier without a label is refused"'],
          ["    weight_includes_carrier: true", "    weight_includes_carrier: false"],
        ]);
        check("(x) contenant « without a label » déclaré « chien seul » → REFUS de l'ingestion", code === 1, out.slice(-400));
        check("(x) le refus renvoie à la relecture humaine",
          out.includes("NON RELUE par un humain"), out.slice(-500));
      }

      /* (y) LE TÉMOIN S'INVERSE, ET C'EST TOUT L'ARBITRAGE DU 11/09.
         Écrit une heure plus tôt, il exigeait que « The combined weight of the pet and carrier is
         up to 8 kg » TRAVERSE l'ingestion — une formulation officielle limpide, que la quatrième
         liste d'expressions régulières refusait à tort. Codex a refusé d'entrer dans la course aux
         synonymes : cette phrase ne passe plus automatiquement, et c'est voulu. Elle passe la garde
         mécanique — citation, nombre, unité, borne, concordance — et attend un humain. Le refus
         doit donc DONNER l'empreinte à relire, sans quoi la relecture serait un travail de
         recomposition au lieu d'une lecture. */
      {
        const { code, out } = saboter2([
          [Q, 'quote: "The combined weight of the pet and carrier is up to 8 kg."'],
          ["          bound: lt", "          bound: lte"],
          ["    weight_limit_bound: lt", "    weight_limit_bound: lte"],
          [B, 'borne: "up to 8 kg"'],
          [S, 'sujet: "combined weight of the pet and carrier is up to 8 kg"'],
        ]);
        check("(y) une formulation officielle limpide mais NON RELUE n'entre pas", code === 1, out.slice(-400));
        check("(y) le refus donne l'empreinte exacte à porter au scellé",
          out.includes("airline_air_france§cabin§weight_max|8|lte|dog_plus_carrier")
          && out.includes("sujet=combined weight of the pet and carrier is up to 8 kg"), out.slice(-700));
      }
    }

    // (p) LE TÉMOIN POSITIF — sans quoi (n) et (o) passeraient aussi bien si l'ingestion
    //     refusait Air France pour une tout autre raison.
    {
      freshSandbox();
      const r = run();
      check("(p) la fiche Air France INTACTE est acceptée", r.code === 0, r.out.slice(-400));
      const pol = sandboxJson(OBJECTS_REL).airlines.find((a) => a.id === "airline_air_france").premium.policy;
      check("(p) les attestations traversent l'ingestion — 1 en cabine, 2 en soute, 0 en fret",
        pol.cabin.attestations?.length === 1 && pol.hold.attestations?.length === 2 && pol.cargo.attestations === undefined,
        JSON.stringify({ cabin: pol.cabin.attestations?.length ?? 0, hold: pol.hold.attestations?.length ?? 0, cargo: pol.cargo.attestations?.length ?? 0 }));
      check("(p) la borne basse de la soute est structurée, pas seulement racontée",
        pol.hold.min_weight_kg === 8 && pol.hold.weight_min_bound === "gt", JSON.stringify(pol.hold).slice(0, 200));
    }
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
