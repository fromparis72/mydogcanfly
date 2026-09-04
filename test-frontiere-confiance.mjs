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
  check("aucun canal ne porte le statut `allowed` ou `denied` dans les pages construites",
    !statutsVus.allowed && !statutsVus.denied, JSON.stringify(statutsVus));
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
      const m = html.match(/pill (ok|no|warn) big"[^>]*>★ ([^<]+)</);
      if (!m) continue;
      const statuts = [...html.matchAll(/data-status="([^"]+)"/g)].map((x) => x[1]);
      if (m[1] === "ok") vert++; else if (m[1] === "no") rouge++; else prudent++;
      if (statuts.some((st) => st === "allowed" || st === "denied")) avecCanalDecide++;
    }
    check("les verdicts de tête sont comptés : 32 verts, 116 rouges, 260 prudents (4 langues)",
      vert === 32 && rouge === 116 && prudent === 260, JSON.stringify({ vert, rouge, prudent }));
    check("AUCUNE fiche n'a de canal décidé sous son verdict — la contradiction est totale et figée",
      avecCanalDecide === 0, `${avecCanalDecide} fiche(s) avec un canal décidé`);
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

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
