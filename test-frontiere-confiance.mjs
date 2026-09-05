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
  PLACEMENT_STATUS_CAUSES, preuveAuditee, sourceAffichable, loadKB, estAutoCitation } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import { qualifier, refuseLeCanalSansCondition, restreintLeCanalSousCondition,
  estOfficielleUtilisable } from "./mesures/politiques-veracite/qualifier.mjs";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
  /* MOUVEMENT NOMMÉ — 05/09/2026, PREMIÈRE CITATION INTÉGRÉE. British Airways cabine passe de
   * « à confirmer » à `denied`, sur la phrase publiée « We don't carry pets in the cabin on any
   * route. », lue directement le 05/09 et reprise avec sa langue et son emplacement.
   *
   * C'est le premier verdict catégorique que ce site ait le droit d'afficher depuis la frontière,
   * et il vaut démonstration : la machine rend bien une décision ferme dès qu'une preuve existe.
   * Le compte reste figé — 302 politiques, dont exactement une prouvée — et chaque citation à
   * venir devra bouger ce chiffre en se nommant, comme celle-ci. */
  check("UNE seule décision prouvée : 0 `allowed`, 1 `denied`, 301 à confirmer",
    allowed === 0 && denied === 1 && aConfirmer === 301, JSON.stringify({ allowed, denied, aConfirmer }));
  check("chaque « à confirmer » porte une cause — aucune incertitude muette",
    Object.values(causes).reduce((x, y) => x + y, 0) === 301, JSON.stringify(causes));
  check("32 gardent une page officielle à montrer, 267 n'ont rien à montrer",
    causes.official_source_unquoted === 32 && causes.legacy_unreviewed === 267, JSON.stringify(causes));
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
  /* Elles étaient deux, posées sur des blocs qui NE DÉCIDENT PAS — l'ironie du lot. Elles sont
     trois, et la troisième décide : c'est la différence entre un dépôt qui ne peut rien prouver
     et un dépôt qui commence à prouver. */
  check("3 politiques d'auteur portent une phrase citée (Thai fret, Virgin cabine, BA cabine)",
    citees.length === 3, citees.join(", "));
  check("et UNE d'elles est une décision — British Airways cabine, la première prouvée",
    decideesCitees.length === 1 && decideesCitees[0] === "airline_british_airways.cabin",
    decideesCitees.join(", "));
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
  /* LE NOMBRE DE SOURCES ANNONCÉ (arbitrage du 05/09/2026). 95 fiches affichaient « 4 sources
     Aegean » sous un bouclier « Source officielle », sans en montrer aucune — et le compte n'était
     adossé à rien : une source officielle dans le dépôt pour un chiffre annoncé de quatre. Il est
     retiré ; le nom garde son nombre, donc ce qui reste est vrai. */
  let avecCompte = 0, lignes = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yml") && x !== "_template.yml")) {
    const y = readFileSync(join(dir, f), "utf8");
    const bloc = y.match(/\nsources:\n(?:[ \t]+(?:en|fr|es|pt):[^\n]*\n)+/);
    if (!bloc) continue;
    for (const l of bloc[0].split("\n")) {
      const m = l.match(/^\s*(?:en|fr|es|pt):\s*"?(.+)$/);
      if (!m) continue;
      lignes++;
      if (/^\d/.test(m[1])) avecCompte++;
    }
  }
  check("aucune ligne de sources n'annonce plus un nombre invérifiable",
    lignes === 408 && avecCompte === 0, `${avecCompte} sur ${lignes} ligne(s)`);
  /* Et l'accord du participe, que le retrait du compte a mis au jour — 16 fiches au singulier par
     langue. « Source Aircalin · relevée » et non « relevées ». */
  const fautesAccord = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yml") && x !== "_template.yml")) {
    const y = readFileSync(join(dir, f), "utf8");
    if (/^\s*fr:\s*"?(?:Source|Page)\s[^\n]*·\s*relevées\b/m.test(y)) fautesAccord.push(`${f} fr`);
    if (/^\s*es:\s*"?(?:Fuente|Página)\s[^\n]*·\s*recopiladas\b/m.test(y)) fautesAccord.push(`${f} es`);
    if (/^\s*pt:\s*"?(?:Fonte|Página)\s[^\n]*·\s*recolhidas\b/m.test(y)) fautesAccord.push(`${f} pt`);
  }
  check("le participe s'accorde avec le nombre du nom, dans les trois langues qui accordent",
    fautesAccord.length === 0, fautesAccord.slice(0, 5).join(", "));

  /* `verified_date:` est STRUCTUREL — il dérive `review_due` (cadence 90 jours, ADR-0007). Le
     retirer casserait la cadence sans rien corriger d'affiché : il doit rester. */
  let structurel = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yml") && x !== "_template.yml")) {
    if (/^verified_date:/m.test(readFileSync(join(dir, f), "utf8"))) structurel++;
  }
  check("le champ structurel `verified_date:` n'a PAS été touché — il porte la cadence de revue",
    structurel === 102, String(structurel));
}

console.log("\n=== 11 bis. AUCUNE auto-citation ne peut être servie comme source ===");
{
  /* LA FAUTE QUE CE CONTRÔLE FERME (04/09/2026). 44 règles d'entrée PAYS citent
   * `https://mydogcanfly.com/dog-travel-requirements-by-country/` — notre propre page — comme
   * source de leurs exigences, dont 3 en criticité `critical`. Sur CDG → Almaty, le rapport ne
   * servait QU'ELLE : notre page donnée comme fondement des exigences légales du Kazakhstan.
   *
   * `preuve.ts` interdit cela depuis le 15/08/2026, et son en-tête dit que la règle vaut jusque
   * dans « la liste de sources d'un rapport ». Le chemin pays ne l'appliquait pas.
   *
   * POURQUOI LA BASELINE NE L'A PAS VU, ET POURQUOI CE CONTRÔLE EST DIFFÉRENT : la baseline
   * vérifie 72 scénarios figés, dont aucun ne va vers ces 44 pays. Le contrôle était juste, son
   * ÉCHANTILLON ne mordait pas là. Celui-ci ne prend pas d'échantillon : il balaie TOUTES les
   * règles du dépôt et exige que pas une auto-citation ne puisse être présentée. */
  const regles = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8"));
  const auto = regles.filter((r) => estAutoCitation(r?.source?.url));
  const parPortee = {};
  for (const r of auto) parPortee[r.scope?.type ?? "?"] = (parPortee[r.scope?.type ?? "?"] ?? 0) + 1;
  /* Le compte est FIGÉ : il descendra quand les sources seront remplacées, et chaque baisse devra
     être nommée. Il ne doit jamais MONTER. */
  /* 128 AU TOTAL, ET NON 44 : ma première rédaction n'attendait que les règles PAYS, parce que
     c'est là que la faute se voyait. Le balayage en a trouvé 84 de plus, de portée COMPAGNIE —
     exactement la répartition que la contre-revue avait chiffrée (84 deny + 44 require, 52 URL).
     Les 84 ne sont PAS présentées : les sources d'un rapport viennent des exigences pays, des
     politiques de canal (filtrées par `preuveAuditee`) et des preuves de race ; les règles
     compagnie ne vivent que dans `fired`, qui ne quitte pas le moteur.
     Elles alimentent en revanche `confidences`, donc l'indice de confiance affiché — une dette
     réelle, plus petite, consignée pour la contre-revue et non corrigée ici : toucher au calcul
     du score est une décision de produit, et le score est déjà en attente d'arbitrage. */
  check("128 règles portent une auto-citation dans la DONNÉE — 84 compagnie, 44 pays, compte figé",
    auto.length === 128 && parPortee.airline === 84 && parPortee.country === 44, JSON.stringify(parPortee));

  /* Et surtout, la propriété qui protège le visiteur : quelle que soit la destination, aucune
     auto-citation n'atteint le rapport. On l'éprouve sur CHAQUE pays auto-cité qui a un aéroport
     desservi — pas sur un échantillon. */
  const kb = loadKB();
  const paysAuto = new Set(auto.map((r) => r.scope?.id));
  const destinations = [];
  for (const a of kb.airports.values()) if (paysAuto.has(a.country_id)) destinations.push(a.id);
  check("des destinations réelles existent dans ces pays (sans quoi le contrôle ne dirait rien)",
    destinations.length > 0, `${destinations.length} aéroport(s)`);
  const fautives = [];
  for (const d of destinations) {
    const rapport = explain(evaluate(kb, {
      origin: "airport_cdg", destination: d, dog: { weight_kg: 5 },
      travel_type: "pet", placement: "any", locale: "en",
    }), "en");
    for (const s of rapport.sources ?? []) if (estAutoCitation(s.url)) fautives.push(`${d} → ${s.url}`);
    for (const c of rapport.conditions ?? []) if (c.source_url && estAutoCitation(c.source_url)) fautives.push(`${d} (condition) → ${c.source_url}`);
  }
  check(`aucune auto-citation servie sur ${destinations.length} destination(s) concernée(s)`,
    fautives.length === 0, fautives.slice(0, 5).join("\n         "));
  /* L'exigence, elle, ne disparaît PAS avec sa fausse source : on le vérifie, sans quoi le
     correctif aurait effacé le contenu au lieu du mensonge. */
  const temoin = explain(evaluate(kb, {
    origin: "airport_cdg", destination: destinations[0], dog: { weight_kg: 5 },
    travel_type: "pet", placement: "any", locale: "en",
  }), "en");
  check("l'exigence d'entrée reste AFFICHÉE, seulement privée de sa fausse source",
    (temoin.conditions ?? []).length > 0, JSON.stringify((temoin.conditions ?? []).length));
}

/* ---- 12 et 13. LE DOM CONSTRUIT — ce que le visiteur lit vraiment ------------------------- */
/* Tout ce qui précède parle du contrat et de la base. Un contrat juste rendu par un gabarit qui
 * publie autre chose ne vaut rien : c'est très exactement la faute que le contre-test navigateur
 * du 15/08/2026 avait trouvée — la fiche affichait « Autorisé » là où la politique disait « à
 * confirmer », parce que l'écran lisait un champ éditorial au lieu de la décision. On relit donc
 * les pages CONSTRUITES, dans les quatre langues.
 *
 *   node --import tsx test-frontiere-confiance.mjs --dist=packages/ui/dist
 *
 * Sans `--dist=`, ces deux contrôles ne sont pas joués et le DISENT — ils le sont en CI. */
const DIST = (process.argv.find((a) => a.startsWith("--dist=")) ?? "").split("=")[1];
if (!DIST) {
  console.log("\n=== 12 et 13. DOM construit — NON JOUÉ (aucun --dist=) ===");
  console.log("  ·    à jouer sur le site construit : --dist=packages/ui/dist");
} else if (!existsSync(DIST)) {
  console.log(`\n=== 12 et 13. DOM construit ===`);
  check(`le dist existe : ${DIST}`, false);
} else {
  console.log("\n=== 12. Aucune fiche compagnie ne publie de verdict catégorique sur un canal ===");
  /* Les libellés PUBLIÉS, repris des quatre fichiers de traduction — jamais retapés ici : les
     retaper, c'est chercher une phrase que le site n'écrit peut-être plus. */
  const LANGUES = ["en", "fr", "es", "pt"];
  const libelle = (cle, lang) =>
    JSON.parse(readFileSync(`packages/knowledge/translations/${lang}/strings.json`, "utf8"))[cle];
  const CATEGORIQUES = LANGUES.flatMap((l) => [libelle("premium.allowed", l), libelle("premium.not_allowed", l)]);
  const A_CONFIRMER = LANGUES.map((l) => libelle("air.to_confirm", l));

  const fiches = [];
  (function marcher(d) {
    for (const e of readdirSync(d)) {
      const f = join(d, e);
      if (statSync(f).isDirectory()) marcher(f);
      else if (e === "index.html" && /(^|\/)airlines\/[^/]+\/index\.html$/.test(f.split("\\").join("/"))) fiches.push(f);
    }
  })(DIST);
  check(`${fiches.length} fiches compagnie construites relues`, fiches.length > 0);

  /* La pastille de canal, isolée par sa structure : `<div class="mini" data-status=…>` porte le
     statut EN CLAIR dans l'attribut. On vérifie donc les deux : l'attribut, qui vient de la
     décision, et le texte, qui est ce que l'œil lit. */
  const fautives = [], statutsVus = {};
  for (const f of fiches) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<div class="mini"[^>]*data-status="([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*<div class="k"/g)) {
      const [, statut, bloc] = m;
      statutsVus[statut] = (statutsVus[statut] ?? 0) + 1;
      const texte = bloc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const dit = CATEGORIQUES.find((lib) => lib && texte.includes(lib));
      if (statut !== "allowed" && statut !== "denied" && dit) {
        fautives.push(`${f} : statut ${statut} mais la pastille dit « ${dit} »`);
      }
    }
  }
  /* NON-VACUITÉ D'ABORD. « Aucun canal n'est `allowed` » serait vrai aussi d'un lecteur qui ne
     reconnaît aucun canal — c'est la faute que ce dépôt a commise trois fois, et qui a produit
     autant de faux zéros. On exige donc que le lecteur ait VU des blocs avant de conclure. */
  const vus = Object.values(statutsVus).reduce((x, y) => x + y, 0);
  check("le lecteur a bien VU des blocs de canal (sans quoi le contrôle suivant ne dirait rien)",
    vus === 1184, `${vus} bloc(s) — attendu 1184 : 296 canaux × 4 langues`);
  /* MOUVEMENT NOMMÉ — la première citation atteint l'écran. British Airways cabine est publiée
     `denied` dans les quatre langues : 4 blocs sur 1 184. Le reste est à confirmer. Aucun canal
     n'est `allowed` : aucune ACCEPTATION n'est encore prouvée. */
  check("un seul canal décidé publié : 4 `denied` (BA cabine × 4 langues), 0 `allowed`",
    !statutsVus.allowed && statutsVus.denied === 4 && statutsVus.confirmation_required === 1180,
    JSON.stringify(statutsVus));
  check("aucune pastille n'affiche « Accepté » ou « Non accepté » sur un canal à confirmer",
    fautives.length === 0, fautives.slice(0, 5).join("\n         "));

  console.log("\n=== 12 bis. Le VERDICT de tête, encore éditorial — constat figé, ARBITRAGE EN ATTENTE ===");
  {
    /* CE QUE CE CONTRÔLE SIGNALE SANS LE CORRIGER. Chaque fiche porte, en tête, une pastille
     * « ★ Easy », « ★ Hard », « ★ No pets », écrite À LA MAIN dans le YAML et colorée par un `cls`
     * lui aussi écrit à la main. Elle ne descend PAS du bloc `policies:`.
     *
     * C'est la faute que `decisionCanal.ts` a fermée un niveau plus bas — « une couleur de pastille
     * et une étiquette écrites à la main [qui] CONTREDISENT la décision canonique » — mais elle
     * n'a jamais été fermée à l'étage du verdict de fiche. Depuis la frontière de confiance, aucun
     * canal n'est décidé : une pastille VERTE « ★ Easy » surmonte donc trois canaux « à confirmer »,
     * et une pastille ROUGE « ★ No pets » surmonte trois canaux dont aucun n'est refusé.
     *
     * JE NE LE CORRIGE PAS SEUL. Contrairement à l'auto-citation — qui contredisait un arbitrage
     * déjà rendu et explicitement étendu à « la liste de sources d'un rapport » —, le bloc
     * `verdict:` n'a jamais été arbitré, et c'est l'élément éditorial principal de la fiche.
     * Le trancher est une décision de produit. Il rejoint la liste des arbitrages en attente.
     *
     * Le compte est FIGÉ pour qu'il ne dérive pas en silence, dans un sens comme dans l'autre. */
    let vert = 0, rouge = 0, prudent = 0, avecCanalDecide = 0;
    for (const f of fiches) {
      const html = readFileSync(f, "utf8");
      /* Le lecteur doit suivre le gabarit, pas l'idée que je m'en fais. Ma première rédaction
         exigeait `>★ ` collé : Astro insère un `data-astro-cid-…` puis un retour ligne, et le
         compte tombait à zéro partout — un faux zéro de plus, produit par mon propre lecteur. */
      const m = html.match(/pill (ok|no|warn) big"[^>]*>\s*★\s*([^<]+)</);
      if (!m) continue;
      const statuts = [...html.matchAll(/data-status="([^"]+)"/g)].map((x) => x[1]);
      if (m[1] === "ok") vert++; else if (m[1] === "no") rouge++; else prudent++;
      if (statuts.some((st) => st === "allowed" || st === "denied")) avecCanalDecide++;
    }
    /* AUCUN CHEMIN PUBLIC NE RELIT L'ÉDITORIAL — vérifié sur la SOURCE, pas sur le rendu.
     * Ma première fermeture rendait la main à `d.verdict.cls` dès qu'un canal serait décidé : une
     * citation cabine aurait pu faire réapparaître un « No pets » historique. La contre-revue l'a
     * refusé, et ce contrôle rend le retour inconstructible plutôt qu'improbable. */
    const gabarit = readFileSync("packages/ui/src/components/AirlinePremiumPage.astro", "utf8");
    const codeSeul = gabarit.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
    check("le gabarit ne lit plus `d.verdict.cls` ni `d.verdict.label`",
      !/d\.verdict\.(cls|label)/.test(codeSeul),
      (codeSeul.match(/d\.verdict\.\w+/g) ?? []).join(", "));
    check("le bloc historique `d.sources` n'est plus rendu", !/\bt\(d\.sources\)/.test(codeSeul));
    check("la FAQ ne date plus une vérification", !/last verified|dernière vérification/.test(codeSeul));

    /* ARBITRÉ ET CORRIGÉ LE 05/09/2026. Le constat figé disait 32 verts et 116 rouges surmontant
     * zéro canal décidé. Le verdict descend désormais des décisions : tant qu'aucun canal n'est
     * décidé, la fiche affiche la réserve PUBLIÉE dans la classe prudente. Les deux contrôles
     * disent maintenant l'inverse l'un de l'autre, et c'est voulu — le second garantit que le
     * premier n'est pas vrai par accident. */
    check("AUCUN verdict de tête n'est catégorique : 0 vert, 0 rouge, 408 prudents",
      vert === 0 && rouge === 0 && prudent === 408, JSON.stringify({ vert, rouge, prudent }));
    /* La raison a changé, et c'est ce qui rend le contrôle intéressant. Ce n'est plus « aucun
       canal n'est décidé » — quatre pages en ont un. C'est qu'un canal REFUSÉ ne suffit pas à
       coiffer la fiche d'un verdict catégorique tant que les autres restent à confirmer : British
       Airways a sa cabine prouvée fermée, et sa fiche dit toujours « à confirmer », parce que sa
       soute et son fret, eux, ne sont pas établis. La table de dérivation le garantit. */
    check("4 fiches ont désormais un canal décidé, et leur verdict reste prudent pour autant",
      avecCanalDecide === 4, `${avecCanalDecide} fiche(s) avec un canal décidé`);

    /* LA NOTE SOUS LE VERDICT dit la même chose en prose : « Cabin and hold are both open ». Même
     * famille, même arbitrage. Mesuré sur les fiches SOURCES (une par compagnie, pas quatre) : 19
     * des 102 notes affirment catégoriquement l'ouverture ou la fermeture d'un canal.
     *
     * UNE ACCUSATION QUE JE RETIRE : 18 notes parlent de « clear published fees », « a fully
     * published fare grid ». J'y ai d'abord vu une promesse que le site ne tient plus depuis le
     * micro-lot Tarifs. En les relisant, elles décrivent la COMPAGNIE — « cette compagnie publie
     * une grille claire » —, pas notre page. Ce n'est donc pas un mensonge, mais une incohérence
     * de lecture : on annonce des tarifs clairs et l'écran répond « tarif à confirmer ». Constat,
     * pas faute. Il est consigné sans être compté comme un défaut. */
    const CATEGORIQUE = /\b(are both open|is open|are open|both allowed|are accepted|is allowed|no published|there is no|are closed|is closed|not accepted|are both)\b/i;
    let notes = 0, notesCategoriques = 0, notesTarif = 0;
    for (const f of readdirSync("content/airlines").filter((x) => x.endsWith(".yml") && x !== "_template.yml")) {
      const y = readFileSync(join("content/airlines", f), "utf8");
      const m = y.match(/^verdictNote:\n\s*en: ([^\n]+)/m);
      if (!m) continue;
      notes++;
      if (CATEGORIQUE.test(m[1])) notesCategoriques++;
      if (/\b(fee|fees|fare|price|priced)\b/i.test(m[1])) notesTarif++;
    }
    /* LES 19 NOTES CATÉGORIQUES NE SONT PLUS UNE « PROCHAINE PASSE ». La contre-revue a tranché :
       elles font partie de cette fermeture. Elles restent DANS LA DONNÉE — les retirer serait une
       réécriture éditoriale de 102 fiches — mais elles ne sont plus RENDUES tant qu'aucun canal
       n'est prouvé, au même titre que le score. Le compte dans la donnée reste figé ; ce qui est
       vérifié ici, c'est qu'il n'atteint plus l'écran. */
    check("19 des 102 notes restent dans la DONNÉE — compte figé",
      notes === 102 && notesCategoriques === 19, JSON.stringify({ notes, notesCategoriques }));
    const auteursNotes = fiches.filter((f) => {
      const html = readFileSync(f, "utf8");
      return /class="hv-pts"/.test(html) || /hv-score/.test(html);
    });
    check("ni le score, ni les points, ni la note éditoriale n'atteignent l'écran",
      auteursNotes.length === 0, `${auteursNotes.length} page(s) les affichent encore`);
    console.log(`  ·    ${notesTarif} notes parlent de tarifs — elles décrivent la COMPAGNIE, pas notre page : constat, pas faute`);
  }

  console.log("\n=== 13. …et la réserve est DITE, dans les quatre langues ===");
  /* Une page muette serait conforme au contrôle 12 tout en étant inutilisable : on exige donc
     que la réserve soit écrite, et écrite dans la langue de la page. */
  const parLangue = {};
  for (const f of fiches) {
    const chemin = "/" + relative(DIST, f).split("\\").join("/");
    const lang = LANGUES.find((l) => chemin.startsWith(`/${l}/`)) ?? "en";
    const html = readFileSync(f, "utf8");
    parLangue[lang] ??= { total: 0, avecReserve: 0 };
    parLangue[lang].total++;
    if (html.includes(libelle("air.to_confirm", lang))) parLangue[lang].avecReserve++;
  }
  const manquantes = LANGUES.filter((l) => !parLangue[l] || parLangue[l].avecReserve !== parLangue[l].total);
  check("chaque fiche dit « à confirmer » dans SA langue, dans les quatre langues",
    manquantes.length === 0, JSON.stringify(parLangue));
  /* Et le libellé de la page officielle non citée doit exister dans les quatre langues — sinon
     les 33 canaux qui ont un lien à montrer le montreraient sans phrase pour le qualifier. */
  const sansLibelle = LANGUES.filter((l) => !libelle("premium.official_source_unquoted", l));
  check("le libellé « page officielle, aucune phrase citée » existe dans les quatre langues",
    sansLibelle.length === 0, sansLibelle.join(", "));
}

console.log("\n=== 13 bis. Le verdict dérivé, et ce qui ne revient JAMAIS avec lui ===");
{
  /* LA CONTRE-ÉPREUVE EXACTE DEMANDÉE PAR LA CONTRE-REVUE : un canal `allowed` cité, deux canaux à
   * confirmer, verdict dérivé positif — et AUCUN ancien score ni note éditoriale nulle part.
   * Elle éprouve la fonction, pas le gabarit, parce que c'est la fonction qui décide ; et elle
   * éprouve le DOM pour ce que la fonction ne peut pas garantir : l'absence du score. */
  const { verdictDeFiche } = await import("./packages/ui/src/lib/decisionCanal.ts");
  const P = (status, cause) => ({ status, ...(cause ? { status_cause: cause } : {}) });
  check("un canal `allowed` + deux à confirmer → verdict POSITIF",
    verdictDeFiche({ cabin: P("allowed"), hold: P("confirmation_required", "legacy_unreviewed"),
      cargo: P("confirmation_required", "official_source_unquoted") }).cle === "premium.verdict_open");
  check("aucun `allowed`, un à confirmer → verdict PRUDENT",
    verdictDeFiche({ cabin: P("denied"), hold: P("confirmation_required", "legacy_unreviewed") }).cle === "air.to_confirm");
  check("trois refus prouvés → aucun canal accepté",
    verdictDeFiche({ cabin: P("denied"), hold: P("denied"), cargo: P("denied") }).cle === "premium.verdict_none");
  check("…et la classe suit le sens, jamais l'éditorial",
    verdictDeFiche({ cabin: P("allowed") }).cls === "ok"
      && verdictDeFiche({ cabin: P("confirmation_required", "legacy_unreviewed") }).cls === "warn"
      && verdictDeFiche({ cabin: P("denied") }).cls === "no");

  /* LE POINT QUI A ÉTÉ REFUSÉ DEUX FOIS : le score ne doit pas revenir quand un canal devient
     vérifié. Le dépôt porte MAINTENANT un canal prouvé — British Airways cabine, `denied` sur
     citation. Si une condition d'affichage subsistait, une fiche l'exposerait. */
  const gabarit = readFileSync("packages/ui/src/components/AirlinePremiumPage.astro", "utf8");
  const codeSeul = gabarit.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  check("le score n'est plus conditionné à un canal vérifié — il est masqué, point",
    /const scoreEtNoteAffichables = false/.test(codeSeul),
    (codeSeul.match(/scoreEtNoteAffichables = [^;]+/) ?? []).join(""));
  /* Le contrôle vise la NOTE DE FAQ, pas n'importe quelle phrase contenant « conditions
     publiées ». Ma première rédaction rougissait sur la phrase des races à museau court —
     « Les conditions publiées par {0} évoquent les races à museau court sans énoncer de refus
     général » —, qui est exacte et utile. Un contrôle trop large accuse le juste. */
  check("la note de FAQ ne revendique plus une provenance ni une date de vérification",
    !/Answers drawn from|Réponses tirées des conditions/.test(codeSeul)
      && /summarises the information currently on record/.test(codeSeul),
    (codeSeul.match(/Answers drawn from[^"]{0,60}/) ?? []).join(""));
}

console.log("\n=== 14. Le côté PAYS — verrouiller un bon état plutôt que le découvrir deux fois ===");
{
  /* CE QUE CETTE SECTION CORRIGE. Mesurer les 189 RÈGLES pays donne une image sombre : 0 citation,
   * 0 locator, 44 auto-citations. Mesurer les 140 FICHES pays — celles que les pages rendent —
   * donne l'inverse : 800 sources libellées, 5,7 par fiche, pointant la page de service de
   * l'autorité et non sa page d'accueil. Ce sont deux objets différents, et confondre les deux
   * ferait condamner un référentiel qui est le meilleur du dépôt.
   *
   * Le contenu s'y refuse même explicitement des sources faibles : « Restricted-breed lists
   * circulate on commercial pet-relocation sites, but MyDogCanFly does not treat those as official
   * sources… this point must be verified directly with PAAF. » C'est la norme que le côté
   * compagnie n'avait pas.
   *
   * On FIGE donc cet état — un bon état non verrouillé se dégrade sans que personne le voie. */
  const YAML = (await import("yaml")).default;
  const dossier = "content/countries";
  const fiches = readdirSync(dossier).filter((x) => x.endsWith(".yml"));
  let sansSource = [], totalSources = 0;
  const confiance = {};
  const parIso = new Map();
  for (const f of fiches) {
    const d = YAML.parse(readFileSync(join(dossier, f), "utf8"));
    const src = Array.isArray(d.sources) ? d.sources : [];
    totalSources += src.length;
    if (!src.length) sansSource.push(f);
    confiance[d.confidence ?? "?"] = (confiance[d.confidence ?? "?"] ?? 0) + 1;
    if (d.iso2) parIso.set(String(d.iso2).toUpperCase(), { c: d.confidence ?? 0, n: src.length });
  }
  check("140 fiches pays, TOUTES pourvues de sources", fiches.length === 140 && sansSource.length === 0,
    sansSource.join(", "));
  check("800 sources libellées au total — compte figé, toute baisse doit être nommée",
    totalSources === 800, String(totalSources));
  check("répartition de confiance figée : 70 en ★4, 38 en ★3, 25 en ★2, 7 en ★1",
    confiance[4] === 70 && confiance[3] === 38 && confiance[2] === 25 && confiance[1] === 7,
    JSON.stringify(confiance));

  /* LES DESTINATIONS QUI COMPTENT. La confiance basse se concentre sur des pays peu consultés
     (Tchad, Djibouti, Gabon…) ; les vingt destinations réellement fréquentées sont toutes à ★3 ou
     ★4. C'est ce qui rend le côté pays lançable, et c'est donc ce qu'il faut garder. */
  const PRIORITAIRES = ["US", "GB", "CA", "AU", "JP", "DE", "ES", "IT", "PT", "NL",
    "CH", "MA", "TN", "DZ", "TH", "AE", "SN", "CI", "BR", "MX"];
  const faibles = PRIORITAIRES.filter((iso) => (parIso.get(iso)?.c ?? 0) < 3);
  const absentes = PRIORITAIRES.filter((iso) => !parIso.has(iso));
  check("les 20 destinations prioritaires existent toutes", absentes.length === 0, absentes.join(", "));
  check("…et sont TOUTES en confiance ★3 ou ★4", faibles.length === 0,
    faibles.map((i) => `${i}=★${parIso.get(i)?.c}`).join(", "));
  check("…et portent chacune au moins 4 sources",
    PRIORITAIRES.every((i) => (parIso.get(i)?.n ?? 0) >= 4),
    PRIORITAIRES.filter((i) => (parIso.get(i)?.n ?? 0) < 4).join(", "));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
