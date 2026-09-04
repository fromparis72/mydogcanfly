#!/usr/bin/env node
/**
 * LA FRONTIÈRE DE CONFIANCE — contre-épreuves.
 *
 *   npx tsx test-frontiere-confiance.mjs
 *
 * Ce que ce harnais doit établir, et rien d'autre : AUCUNE donnée insuffisamment prouvée ne peut
 * produire à elle seule une réponse catégorique. Il le vérifie dans les DEUX SENS — une
 * acceptation non prouvée ne devient pas un refus, un refus non prouvé ne devient pas une
 * acceptation —, sur le contrat, sur la base réelle, et sur le prédicat d'appariement.
 *
 * TROIS FAUTES DE MA PART SONT FIGÉES ICI SOUS FORME DE CONTRE-ÉPREUVE, parce qu'une faute
 * nommée dans un dossier s'oublie et qu'une faute nommée dans un test rougit :
 *
 *   · § 7 — j'appariais une règle à une politique sur la seule paire (compagnie, canal), sans
 *     regarder l'ACTION ni la PORTÉE. J'en tirais « 60 décisions corroborées », dont 32 étaient
 *     des acceptations adossées à des refus. Le contrôle 8 rend ce cas inconstructible.
 *   · § 7 — une restriction limitée au Royaume-Uni servait de preuve à un refus MONDIAL. Le
 *     contrôle 7 le refuse.
 *   · § 4 — je proposais que `preuveAuditee` retourne une page officielle non citée, pour qu'elle
 *     reste affichable. C'était renommer le fait sans le changer. Le contrôle 4 l'interdit, et le
 *     contrôle 3 montre par où passe désormais le lien affichable.
 */
import { PlacementPolicyAuthored, projectPlacementPolicy, niveauDePreuve,
  PLACEMENT_STATUS_CAUSES, preuveAuditee, sourceAffichable, loadKB } from "./packages/knowledge/src/index.ts";
import { qualifier, refuseLeCanalSansCondition, restreintLeCanalSousCondition,
  estOfficielleUtilisable } from "./mesures/politiques-veracite/qualifier.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/* Une provenance officielle, non fabriquée, non auto-citée — et SANS phrase citée. */
const PAGE = {
  url: "https://exemple-compagnie.example/animaux", source_type: "official_website",
  verified_date: "2026-08-14", review_due: "2026-11-12", confidence: 3,
  reviewer: "harnais frontière", history: [],
};
const CITEE = { ...PAGE, quote: "Dogs are accepted in the cabin up to 8 kg.", quote_language: "en", locator: "section « Pets »" };
const projeter = (p) => projectPlacementPolicy(PlacementPolicyAuthored.parse(p));

console.log("=== 1. Une donnée sans preuve ne décide pas — dans les deux sens ===");
{
  for (const dispo of ["offered", "not_offered"]) {
    const d = projeter({ availability: dispo, source: PAGE });
    check(`\`${dispo}\` sans phrase citée → « à confirmer », jamais un verdict`,
      d.status === "confirmation_required" && d.allowed === false, JSON.stringify(d));
  }
  /* Et la contrepartie, sans laquelle le contrôle ci-dessus serait satisfait par une fonction
     qui rétrograderait TOUT : avec la phrase, la décision passe, exactement comme avant. */
  check("`offered` AVEC phrase citée → `allowed` : la frontière laisse passer ce qui est prouvé",
    projeter({ availability: "offered", source: CITEE }).status === "allowed");
  check("`not_offered` AVEC phrase citée → `denied` : elle laisse aussi passer un refus prouvé",
    projeter({ availability: "not_offered", source: CITEE }).status === "denied");
  /* Une citation sans son emplacement n'est pas une preuve : on ne saurait pas où relire. */
  const { locator, ...sansLocator } = CITEE;
  check("citation SANS locator → ne décide pas (on ne saurait pas où relire la phrase)",
    projeter({ availability: "offered", source: sansLocator }).status === "confirmation_required");
}

console.log("\n=== 2. `official_source_unquoted` ne décide jamais ===");
{
  const d = projeter({ availability: "offered", source: PAGE });
  check("la cause est bien `official_source_unquoted`", d.status_cause === "official_source_unquoted", JSON.stringify(d));
  check("le statut reste `confirmation_required` et `allowed` reste false",
    d.status === "confirmation_required" && d.allowed === false);
  check("la cause appartient au registre FERMÉ des causes de politique",
    PLACEMENT_STATUS_CAUSES.includes("official_source_unquoted"), PLACEMENT_STATUS_CAUSES.join(", "));
  check("une provenance FABRIQUÉE depuis notre fiche ne donne même pas de page à montrer",
    projeter({ availability: "offered", source: PAGE, source_derived: true }).status_cause === "legacy_unreviewed");
}

console.log("\n=== 3. Sa source reste AFFICHABLE — par un résolveur distinct ===");
{
  const d = projeter({ availability: "offered", source: PAGE });
  check("`sourceAffichable` rend le lien officiel", sourceAffichable(d)?.url === PAGE.url, JSON.stringify(sourceAffichable(d)));
  check("une politique sans page à montrer n'en rend aucune",
    sourceAffichable(projeter({ availability: "offered", source: PAGE, source_derived: true })) === null);
  check("une preuve citée reste rendue par `sourceAffichable` aussi (elle est plus forte, pas exclue)",
    sourceAffichable(projeter({ availability: "offered", source: CITEE }))?.url === CITEE.url);
}

console.log("\n=== 4. `preuveAuditee` REFUSE la page non citée ===");
{
  const d = projeter({ availability: "offered", source: PAGE });
  check("`preuveAuditee` retourne null sur `official_source_unquoted`", preuveAuditee(d) === null, JSON.stringify(preuveAuditee(d)));
  check("…et continue de retourner la preuve quand la phrase est là",
    preuveAuditee(projeter({ availability: "offered", source: CITEE }))?.url === CITEE.url);
  /* La faute de dix politiques ne se rouvre pas : une politique non revérifiée reste sans preuve,
     même quand elle porte une source officielle non dérivée. */
  check("une politique `legacy_unreviewed` porteuse d'une source officielle reste SANS preuve",
    preuveAuditee(projeter({ review_state: "legacy_unreviewed", source: PAGE })) === null);
}

console.log("\n=== 5 et 6. Ce qu'une page ne peut pas être ===");
{
  const auto = { ...PAGE, url: "https://www.mydogcanfly.com/airlines/x" };
  check("auto-citation REFUSÉE : elle ne qualifie rien", !estOfficielleUtilisable(auto));
  check("…et ne produit ni verdict ni page à montrer",
    projeter({ availability: "offered", source: auto }).status_cause === "legacy_unreviewed"
      && sourceAffichable(projeter({ availability: "offered", source: auto })) === null);
  const presse = { ...PAGE, source_type: "press" };
  check("source non factuelle (`press`) REFUSÉE", !estOfficielleUtilisable(presse));
  check("…et ne produit ni verdict ni page à montrer",
    projeter({ availability: "offered", source: presse }).status_cause === "legacy_unreviewed"
      && sourceAffichable(projeter({ availability: "offered", source: presse })) === null);
  check("le niveau de preuve nomme les trois cas, sans troisième voie",
    niveauDePreuve({ source: CITEE }) === "citee"
      && niveauDePreuve({ source: PAGE }) === "officielle_non_citee"
      && niveauDePreuve({ source: auto }) === "aucune");
}

console.log("\n=== 7. Une restriction CONDITIONNELLE ne soutient pas un verdict global ===");
{
  const regleUK = {
    scope: { type: "airline", id: "airline_x" }, category: "destination",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" },
      { fact: "route.dest_country_id", op: "eq", value: "country_gb" }] },
    effect: { action: "deny", placement: ["hold"] }, source: PAGE,
  };
  check("elle est reconnue comme CONDITIONNELLE, pas comme un refus du canal",
    !refuseLeCanalSansCondition(regleUK, "hold") && restreintLeCanalSousCondition(regleUK, "hold"));
  const q = qualifier({ availability: "not_offered" }, "hold", [regleUK]);
  check("un refus MONDIAL adossé à elle seule tombe en ensemble 2 — aucune source injectée",
    q.ensemble === 2 && q.source === null, JSON.stringify(q));
  /* Le même refus, adossé à une règle qui ne parle QUE du placement, est bien qualifié. */
  const regleCanal = { ...regleUK, applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] } };
  check("le même refus adossé à un `deny` portant EXCLUSIVEMENT sur le canal est, lui, qualifié",
    qualifier({ availability: "not_offered" }, "hold", [regleCanal]).source?.url === PAGE.url);
}

console.log("\n=== 8. Un `deny` ne corrobore JAMAIS une politique `offered` ===");
{
  const regleCanal = {
    scope: { type: "airline", id: "airline_x" }, category: "placement",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "cabin" }] },
    effect: { action: "deny", placement: ["cabin"] }, source: PAGE,
  };
  const q = qualifier({ availability: "offered" }, "cabin", [regleCanal]);
  check("une acceptation adossée à un refus tombe en ensemble 3, sans source",
    q.ensemble === 3 && q.source === null, JSON.stringify(q));
  /* LE FAIT QUI REND MA FAUTE INCONSTRUCTIBLE : toutes les règles de portée compagnie sont des
     `deny`. Si une règle `allow` apparaissait un jour, ce contrôle rougirait — et il faudrait
     alors décider ce qu'elle a le droit de soutenir, au lieu de le supposer. */
  const regles = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8"));
  const compagnie = regles.filter((r) => r?.scope?.type === "airline");
  const actions = [...new Set(compagnie.map((r) => r.effect?.action))];
  check(`les ${compagnie.length} règles de portée compagnie sont TOUTES des \`deny\``,
    actions.length === 1 && actions[0] === "deny", actions.join(", "));
}

console.log("\n=== 9. L'ambiguïté ne se tranche pas en silence ===");
{
  const base = {
    scope: { type: "airline", id: "airline_x" }, category: "placement",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] },
    effect: { action: "deny", placement: ["hold"] },
  };
  const deux = [
    { ...base, source: { ...PAGE, url: "https://exemple-compagnie.example/animaux" } },
    { ...base, source: { ...PAGE, url: "https://exemple-compagnie.example/conditions" } },
  ];
  const q = qualifier({ availability: "not_offered" }, "hold", deux);
  check("deux URL officielles différentes → AUCUNE n'est choisie",
    q.source === null && /ambigu/i.test(q.raison), JSON.stringify(q));
  /* Deux règles citant la MÊME page ne sont pas ambiguës : il n'y a rien à choisir. */
  const memeUrl = [{ ...base, source: PAGE }, { ...base, source: PAGE }];
  check("deux règles citant la MÊME page ne sont pas ambiguës",
    qualifier({ availability: "not_offered" }, "hold", memeUrl).source?.url === PAGE.url);
}

console.log("\n=== 10. Sur la base RÉELLE : plus aucun verdict catégorique ===");
{
  const kb = loadKB();
  let allowed = 0, denied = 0, aConfirmer = 0;
  const causes = {};
  for (const a of kb.airlines.values()) {
    for (const p of Object.values(a.premium?.policy ?? {})) {
      if (p.status === "allowed") allowed++;
      else if (p.status === "denied") denied++;
      else { aConfirmer++; causes[p.status_cause] = (causes[p.status_cause] ?? 0) + 1; }
    }
  }
  check("ZÉRO canal `allowed` et ZÉRO canal `denied` sur les 302 politiques",
    allowed === 0 && denied === 0 && aConfirmer === 302, JSON.stringify({ allowed, denied, aConfirmer }));
  check("chaque « à confirmer » porte une cause — aucune incertitude muette",
    Object.values(causes).reduce((x, y) => x + y, 0) === 302, JSON.stringify(causes));
  check("33 gardent une page officielle à montrer, 267 n'ont rien à montrer",
    causes.official_source_unquoted === 33 && causes.legacy_unreviewed === 267, JSON.stringify(causes));
  /* Et la preuve que ce n'est pas un effet de bord de l'affichage : la même règle vaut à la
     source, sur l'artefact d'auteur, avant tout moteur. */
  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  const citees = [];
  const decideesCitees = [];
  for (const a of objets.airlines) {
    for (const [canal, d] of Object.entries(a.premium?.policy ?? {})) {
      if (niveauDePreuve(d) !== "citee") continue;
      citees.push(`${a.id}.${canal}`);
      if (d.availability === "offered" || d.availability === "not_offered") decideesCitees.push(`${a.id}.${canal}`);
    }
  }
  /* DEUX politiques d'auteur portent une phrase citée — et ma première rédaction de ce contrôle
     en attendait ZÉRO, ce qui contredisait ma propre mesure. Ce sont le fret de Thai Airways et
     la cabine de Virgin Australia, et l'ironie est le cœur du sujet : les deux seules preuves
     citées du dépôt sont posées sur des blocs qui NE DÉCIDENT PAS (`undocumented`,
     `case_by_case`). Aucune des 216 décisions catégoriques n'en porte. */
  check("exactement 2 politiques d'auteur portent une phrase citée (Thai fret, Virgin cabine)",
    citees.length === 2, citees.join(", "));
  check("et AUCUNE d'elles n'est une décision — c'est bien la DONNÉE qui manque là où elle déciderait",
    decideesCitees.length === 0, decideesCitees.join(", "));
}

console.log("\n=== 11. Aucune fiche n'affirme plus « Vérifié le … » ===");
{
  /* La pastille verte « ✓ Vérifié le 11 juil. 2026 » était l'affirmation la PLUS VISIBLE du site,
     et rien ne la fondait : zéro politique citée, et un historique qui dit lui-même « Initial
     import — pending live re-verification ». Elle est devenue « 🗓 Mise à jour le … » — la date
     est vraie, le verbe ne l'était pas. Ce contrôle interdit son retour, dans les quatre langues
     et sous les huit formes rencontrées, y compris celle que je n'avais pas su dénombrer. */
  const dir = "content/airlines";
  const CLAIM = /Verified \d|Vérifié le \d|Verificado (?:el |em )?\d|last verified|dernière vérification|última verifica|· verified |· vérifiée |· verificada /i;
  const fautives = [];
  let lues = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yml") && x !== "_template.yml")) {
    lues++;
    if (CLAIM.test(readFileSync(join(dir, f), "utf8"))) fautives.push(f);
  }
  check(`aucune des ${lues} fiches n'affiche de mention de vérification`, fautives.length === 0, fautives.join(", "));
  /* Et la contrepartie : ce qui est VRAI n'a pas été retiré avec ce qui était faux. */
  let avecDate = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yml") && x !== "_template.yml")) {
    if (/Mise à jour le \d/.test(readFileSync(join(dir, f), "utf8"))) avecDate++;
  }
  check("…et les 102 gardent leur date, sous un verbe honnête (« Mise à jour le … »)",
    avecDate === 102, String(avecDate));
  /* `verified_date:` est STRUCTUREL — il dérive `review_due` (cadence 90 jours, ADR-0007). Le
     retirer casserait la cadence sans rien corriger d'affiché : il doit rester. */
  let structurel = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yml") && x !== "_template.yml")) {
    if (/^verified_date:/m.test(readFileSync(join(dir, f), "utf8"))) structurel++;
  }
  check("le champ structurel `verified_date:` n'a PAS été touché — il porte la cadence de revue",
    structurel === 102, String(structurel));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
