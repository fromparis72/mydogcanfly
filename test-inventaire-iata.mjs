#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DE L'INVENTAIRE IATA.
 *
 *   node test-inventaire-iata.mjs
 *
 * L'inventaire est un CONTRAT pour deux lots : il dit combien d'affirmations sont à corriger et
 * qui les corrige. Un contrat dont le classificateur se trompe en silence est pire qu'aucun
 * contrat. On éprouve donc ici les quatre faux-verts trouvés par la contre-revue du 30/08/2026,
 * chacun sur sa propre cause.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { classer, relever, verifier, citationsDeLHeritage, ancresOrphelines, contexteCommentaires, MOTIF, ALTERNATIVES, CATEGORIES } from "./inventaire-iata.mjs";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/** Classe toutes les occurrences d'une ligne, comme le fait le relevé. */
const classerLigne = (chemin, ligne) => {
  MOTIF.lastIndex = 0;
  return [...ligne.matchAll(MOTIF)].map((m) => ({
    trouve: m[0], colonne: m.index + 1,
    categorie: classer(chemin, ligne, m[0], m.index, m.index + m[0].length),
  }));
};

/* 1 — P0-2a : UNE RÉFÉRENCE LÉGITIME ET UNE AFFIRMATION INTERDITE SUR LA MÊME LIGNE.
   Mesuré sur la v1 : les deux recevaient « interdit », parce que la décision portait sur la
   ligne. La référence licite disparaissait donc du compte. */
{
  const vus = classerLigne("packages/ui/src/lib/faq.ts", "IATA LAR ; IATA-approved crate");
  const par = Object.fromEntries(vus.map((v) => [v.trouve, v.categorie]));
  if (vus.length !== 2) echec("1 même ligne, deux natures", `${vus.length} occurrence(s) trouvée(s) au lieu de 2`);
  else if (par["IATA LAR"] !== "reference_reglementaire_legitime")
    echec("1 même ligne, deux natures", `« IATA LAR » classée ${par["IATA LAR"]}`);
  else if (par["IATA-approved"] !== "affirmation_publique_interdite")
    echec("1 même ligne, deux natures", `« IATA-approved » classée ${par["IATA-approved"]}`);
  else ok("1 sur une même ligne, la référence licite et l'affirmation interdite sont séparées");
}

/* 2 — P0-2b : UNE CITATION ET UN CHAMP PUBLIC SUR LA MÊME LIGNE. Mesuré sur la v1 : la présence
   d'un `"quote":` n'importe où absorbait l'occurrence extérieure à la citation. */
{
  const ligne = '{"quote": "IATA-approved crates only", "titre": "Caisse homologuée IATA"}';
  const vus = classerLigne("packages/knowledge/raw/sources.json", ligne);
  const dansCitation = vus.filter((v) => v.categorie === "citation_attribuee");
  const dehors = vus.filter((v) => v.categorie !== "citation_attribuee");
  if (dansCitation.length !== 1 || dansCitation[0].trouve !== "IATA-approved")
    echec("2 citation et champ public", `dans la citation : ${JSON.stringify(dansCitation)}`);
  else if (dehors.length !== 1 || !/homologu/i.test(dehors[0].trouve))
    echec("2 citation et champ public", `hors citation : ${JSON.stringify(dehors)}`);
  else ok("2 sur une même ligne, ce qui est dans la citation et ce qui est dehors sont séparés");
}

/* 3 — P0-3 : LE REFUS EXISTE VRAIMENT. La v1 se terminait par un repli qui bénissait toute forme
   inconnue en « référence légitime » : le contrôle « aucune occurrence non classée » ne pouvait
   pas rougir. On exige ici que `classer` rende `null`, et que `verifier` REFUSE. */
{
  const inconnue = classer("packages/ui/src/lib/faq.ts", "an IATA-blessed crate", "IATA-blessed", 3, 15);
  if (inconnue !== null) echec("3 forme inconnue", `classée « ${inconnue} » au lieu de null`);
  else {
    const v = verifier([{ fichier: "f.ts", ligne: 1, colonne: 4, trouve: "IATA-blessed", categorie: null }]);
    if (v.ok) echec("3 refus", "un relevé portant une occurrence non classée est accepté");
    else if (v.inconnues.length !== 1) echec("3 refus", `${v.inconnues.length} inconnue(s) rapportée(s)`);
    else ok("3 une forme qu'aucune règle ne reconnaît rend null, et fait REFUSER le relevé");
  }
}

/* 3 bis — et une catégorie hors liste est refusée elle aussi : sans quoi une faute de frappe
   dans un nom de catégorie passerait pour une catégorie. */
{
  const v = verifier([{ fichier: "f.ts", ligne: 1, colonne: 1, trouve: "homologué", categorie: "categorie_inventee" }]);
  if (v.ok || v.hors.length !== 1) echec("3bis catégorie hors liste", "acceptée");
  else ok("3bis une catégorie absente de la liste fait REFUSER le relevé");
}

/* 4 — AUCUNE ALTERNATIVE DU MOTIF N'ÉCHAPPE AUX SOUS-CLASSIFICATEURS. C'est ce qui rendrait le
   refus théorique : si le motif attrape une forme que personne ne sait juger, elle bloquerait le
   relevé. Chaque alternative porte donc un échantillon représentatif, et en ajouter une sans son
   échantillon rougit ici. */
{
  const ECHANTILLONS = [
    "IATA-approved", "IATA LAR", "Live Animals Regulations",
    "homologué", "homologada", "homologação",
    "conforme IATA", "conforme a la IATA", "conforme à norma IATA",
    "norma IATA", "norme IATA", "exigences IATA",
    "certifiée IATA", "approuvée par l'IATA", "aprobado por la IATA", "aprovada pela IATA",
  ];
  if (ECHANTILLONS.length !== ALTERNATIVES.length) {
    echec("4 couverture du motif", `${ALTERNATIVES.length} alternative(s) au motif pour ${ECHANTILLONS.length} échantillon(s) — l'une d'elles n'est pas éprouvée`);
  } else {
    const muets = ECHANTILLONS.filter((e) => { MOTIF.lastIndex = 0; return !MOTIF.test(e); });
    const orphelins = ECHANTILLONS.filter((e) => classer("packages/ui/src/lib/faq.ts", e, e, 0, e.length) === null);
    if (muets.length) echec("4 couverture du motif", `le motif ne voit pas : ${muets.join(", ")}`);
    else if (orphelins.length) echec("4 couverture du motif", `aucune règle ne juge : ${orphelins.join(", ")}`);
    else ok(`4 les ${ECHANTILLONS.length} formes du motif sont toutes jugées par une règle`);
  }
}

/* 5 — P1 : DÉTERMINISME. Le relevé ne doit dépendre ni de l'ordre du système de fichiers, ni de
   rien d'autre. On rejoue tout avec l'énumération INVERSÉE et on exige l'octet près. */
{
  const a = JSON.stringify(relever());
  const b = JSON.stringify(relever({ inverse: true }));
  const c = JSON.stringify(relever());
  if (a !== c) echec("5 déterminisme", "deux relevés successifs diffèrent");
  else if (a !== b) {
    const x = JSON.parse(a), y = JSON.parse(b);
    const i = x.findIndex((r, k) => JSON.stringify(r) !== JSON.stringify(y[k]));
    echec("5 déterminisme", `l'ordre d'énumération change le relevé — premier écart au rang ${i} : ${JSON.stringify(x[i])} contre ${JSON.stringify(y[i])}`);
  } else ok(`5 le relevé est identique à l'octet près, énumération inversée comprise (${JSON.parse(a).length} occurrences)`);
}

/* 6 — PLUS AUCUNE PRÉTENTION D'INERTIE. La v2 affirmait prouver que l'héritage v1 n'est lu par
   personne, en cherchant `"static/…"` dans les scripts. C'était indémontrable : `join(ROOT,
   "static", f)` y échappait, et ajouter des motifs n'aurait fait que déplacer le trou. La
   catégorie ne protège donc plus rien : elle DIT qu'il y a 18 affirmations à corriger ou à
   supprimer, et elles entrent au micro-lot éditorial. */
{
  const releve = relever();
  const her = releve.filter((r) => r.categorie === "heritage_a_corriger_ou_supprimer");
  if (CATEGORIES.includes("heritage_v1_non_publie")) echec("6 inertie", "la catégorie « non publié » subsiste, avec sa prétention");
  else if (!her.length) echec("6 héritage", "aucune occurrence d'héritage — la catégorie ne peut rien prouver");
  else {
    const constats = citationsDeLHeritage();
    ok(`6 l'héritage v1 ne prétend plus être inerte : ${her.length} occurrence(s) à corriger ou supprimer, ${constats.length} citation(s) rapportée(s) sans conclusion`);
  }
}

/* 6 bis — LA PHRASE PORTEUSE PRIME SUR L'OCCURRENCE. « IATA standard » et « norme IATA » sont
   licites prises seules ; « norma IATA » ne l'est pas ; et les trois appartiennent au MÊME titre,
   remplacé en entier. Sans cette catégorie, deux des trois modifications approuvées manqueraient
   au contrat de l'étape 3 — le relevé annonçait 33 applicatives là où il en faut 35. */
{
  const releve = relever();
  const ref = releve.filter((r) => r.categorie === "reference_reglementaire_a_reformuler");
  const fichiers = new Set(ref.map((r) => r.fichier));
  const lignes = new Set(ref.map((r) => r.ligne));
  const textes = ref.map((r) => r.trouve.toLowerCase()).sort();
  if (ref.length !== 3) echec("6bis à reformuler", `${ref.length} occurrence(s) au lieu de 3`);
  else if (fichiers.size !== 1 || !/AirlinePremiumPage\.astro$/.test([...fichiers][0]))
    echec("6bis à reformuler", `fichier(s) : ${[...fichiers].join(", ")}`);
  else if (lignes.size !== 1) echec("6bis à reformuler", `réparties sur ${lignes.size} lignes`);
  else if (JSON.stringify(textes) !== JSON.stringify(["iata standard", "norma iata", "norme iata"]))
    echec("6bis à reformuler", `textes : ${JSON.stringify(textes)}`);
  else ok(`6bis les trois occurrences du même titre sont à reformuler ensemble (ligne ${[...lignes][0]})`);
}

/* 6 quinquies — LE COMMENTAIRE DE CODE N'EST PAS UNE AFFIRMATION PUBLIQUE, et sa preuve tient à
   trois conditions, chacune vue rougir. Arbitrage du 30/08/2026 : classer `FlightFinder.astro:757`
   parmi les affirmations publiques rendait le nom ET le compte faux — ce commentaire explique
   justement pourquoi la fuite a été retirée, et n'est publié nulle part. */
{
  const releve = relever();
  const com = releve.filter((r) => r.categorie === "commentaire_code_non_publie");
  if (com.length !== 1) echec("6quinquies commentaire", `${com.length} occurrence(s) au lieu de 1`);
  else if (!/FlightFinder\.astro$/.test(com[0].fichier)) echec("6quinquies commentaire", com[0].fichier);
  else ok(`6quinquies le commentaire de code est classé à part (${com[0].fichier.split("/").pop()}:${com[0].ligne})`);

  /* La preuve d'ancrage, vue rougir sur ses TROIS causes : fragment absent, fragment dupliqué,
     fragment hors des bornes d'un bloc. Sans elles, la catégorie serait une porte de sortie. */
  const FICHIER = "packages/ui/src/components/FlightFinder.astro";
  const FRAGMENT = "suggérait de surcroît une homologation IATA que personne ne délivre";
  const cas = [
    ["fragment absent", "/* rien ici */"],
    ["fragment dupliqué", `/* ${FRAGMENT} */\n/* ${FRAGMENT} */`],
    ["fragment hors d'un bloc de commentaire", `const t = "${FRAGMENT}";`],
  ];
  let rouges = 0;
  for (const [nom, contenu] of cas) {
    const { zones, problemes } = contexteCommentaires(FICHIER, contenu);
    if (problemes.length && zones.length === 0) rouges++;
    else echec(`6quinquies ancrage — ${nom}`, `zones=${zones.length} problemes=${problemes.length}`);
  }
  /* Et le cas honnête passe. */
  const bon = contexteCommentaires(FICHIER, `/* ${FRAGMENT} */`);
  if (bon.problemes.length || bon.zones.length !== 1) echec("6quinquies ancrage — cas valide", JSON.stringify(bon.problemes));
  else if (rouges === cas.length) ok(`6quinquies l'ancrage rougit sur ses ${cas.length} causes et accepte le cas valide`);

  /* LE MÊME VOCABULAIRE AILLEURS DANS LE FICHIER reste une affirmation publique : la catégorie ne
     blanchit pas un fichier, elle borne une zone. */
  const dehors = classer(FICHIER, 'const s = "IATA-approved";', "IATA-approved", 12, 25, 999999, [[0, 50]]);
  if (dehors !== "affirmation_publique_interdite")
    echec("6quinquies hors zone", `une occurrence hors des bornes est classée « ${dehors} »`);
  else ok("6quinquies le même vocabulaire hors de la zone reste une affirmation publique");

  /* LE FRAGMENT NE DOIT PARAÎTRE NULLE PART DANS LE DOM CONSTRUIT. Dire « c'est un commentaire,
     il n'est pas publié » est une affirmation tant qu'on ne l'a pas vérifiée sur l'artefact :
     un gabarit peut très bien recracher un commentaire dans la page. Ce contrôle ne se joue que
     si un dist existe — en CI, il en existe toujours un. */
  {
    const dist = "packages/ui/dist";
    if (!existsSync(dist)) console.log("  · 6quinquies DOM non joué (aucun dist) — il l'est en CI sur le site complet");
    else {
      const fautifs = [];
      const parcourir = (d) => {
        for (const e of readdirSync(d)) {
          const chemin = join(d, e);
          if (statSync(chemin).isDirectory()) parcourir(chemin);
          else if (e.endsWith(".html") && readFileSync(chemin, "utf8").includes(FRAGMENT)) fautifs.push(chemin);
        }
      };
      parcourir(dist);
      if (fautifs.length) echec("6quinquies DOM", `le fragment de commentaire paraît dans ${fautifs.length} page(s), dont ${fautifs[0]}`);
      else ok("6quinquies le fragment de commentaire est absent du DOM construit");
    }
  }

  /* Un problème d'ancrage fait REFUSER le relevé. */
  const faux = []; faux.problemesDAncrage = ["ancre absente"];
  const v = verifier(faux);
  if (v.ok || !v.ancrages.length) echec("6quinquies refus", "un relevé au fragment non ancré est accepté");
  else ok("6quinquies un fragment non ancré fait REFUSER le relevé");
}

/* 6 ter — LE CONTRAT CHIFFRÉ DE L'ÉTAPE 3. Un contrat sans chiffre exigé n'engage à rien.
 *
 * MOUVEMENT NOMMÉ, du 30/08/2026 : le compte passe de 32 à 25 après la fusion de la PR #29 et la
 * resynchronisation de cette branche. La garde a rougi d'elle-même, ce pour quoi elle existe.
 * Deux causes, et une seule est une correction :
 *
 * SECOND MOUVEMENT, du même jour, sur arbitrage : 25 → 24. `FlightFinder.astro:757` est un
 * COMMENTAIRE de code ; le compter parmi les affirmations publiques rendait le nom et le compte
 * faux. Il a sa catégorie, bornée par chemin et fragment exact, et prouvée : le fragment existe
 * une seule fois et tombe entre les bornes d'un bloc.
 *
 *   −8  les huit `partner.equipment.reason` et `reason_cargo` des quatre traductions, réécrits
 *       par la PR #29 sur l'acceptation par la compagnie qui opère le vol. Elles sont FAITES.
 *   +1  `FlightFinder.astro:757` : un COMMENTAIRE de code — le mien —, qui explique justement
 *       pourquoi la fuite a été retirée (« suggérait de surcroît une homologation IATA que
 *       personne ne délivre »). Il n'est publié nulle part.
 *
 * Le classificateur ne sait pas encore distinguer un commentaire de code d'une affirmation
 * publique : `test_commentaire_historique` ne couvre que des CHEMINS de harnais, pas des
 * commentaires vivant dans un fichier de production. Ce point est SIGNALÉ pour arbitrage plutôt
 * que corrigé unilatéralement — ajouter une catégorie rouvrirait le classificateur, que la
 * contre-revue vient de clore. En attendant, le chiffre exigé est celui que l'instrument mesure
 * réellement, commentaire compris : 25. Sur ces 25, 24 sont de vraies affirmations publiques.
 */
{
  const releve = relever();
  const interdites = releve.filter((r) => r.categorie === "affirmation_publique_interdite").length;
  const aRef = releve.filter((r) => r.categorie === "reference_reglementaire_a_reformuler").length;
  const commentaires = releve.filter((r) => r.categorie === "commentaire_code_non_publie").length;
  if (interdites !== 24 || aRef !== 3 || commentaires !== 1)
    echec("6ter contrat de l'étape 3", `${interdites} interdites, ${aRef} à reformuler, ${commentaires} commentaire(s) — attendu 24, 3 et 1`);
  else ok(`6ter contrat de l'étape 3 : ${interdites} + ${aRef} = ${interdites + aRef} modifications PUBLIQUES, plus ${commentaires} commentaire non publié`);
}

/* 6 quater — UNE ANCRE DE REFORMULATION QUI NE TROUVE RIEN FAIT REFUSER LE RELEVÉ. Une
   déclaration qui ne s'applique à rien ne protège rien, et masquerait une modification approuvée
   qu'on croirait couverte. */
{
  const bidon = [{ fichier: "packages/ui/src/components/AirlinePremiumPage.astro", ligne: 1, colonne: 1,
                   trouve: "norma IATA", categorie: "affirmation_publique_interdite" }];
  const v = verifier(bidon);
  if (v.ok || !v.orphelines.length) echec("6quater ancre orpheline", "un relevé où l'ancre ne mord pas est accepté");
  else if (ancresOrphelines(relever()).length) echec("6quater ancre orpheline", "l'ancre réelle ne mord pas non plus");
  else ok("6quater une ancre de reformulation qui ne trouve rien fait REFUSER le relevé");
}

/* 7 — LE RELEVÉ RÉEL PASSE SA PROPRE VÉRIFICATION, et tout est classé. */
{
  const releve = relever();
  const v = verifier(releve);
  /* FAUTE NOMMÉE : ce diagnostic lisait `v.violations`, un champ que `verifier()` ne rend plus
     depuis que la prétention d'inertie a été retirée. Le jour où le relevé réel serait invalide,
     le harnais aurait levé un TypeError au lieu de dire ce qui cloche — reproduit :
     « Cannot read properties of undefined (reading 'length') ». Il lit désormais les trois
     collections que `verifier()` rend réellement. */
  if (!v.ok) echec("7 relevé réel", `${v.inconnues.length} inconnue(s), ${v.hors.length} hors liste, ${v.orphelines.length} ancre(s) orpheline(s)`);
  else {
    const somme = CATEGORIES.reduce((n, c) => n + releve.filter((r) => r.categorie === c).length, 0);
    if (somme !== releve.length) echec("7 relevé réel", `${somme} classées pour ${releve.length} occurrences`);
    else ok(`7 le relevé réel — ${releve.length} occurrences, ${new Set(releve.map((r) => r.fichier)).size} fichiers — est intégralement classé`);
  }
}

/* 8 — LE DIAGNOSTIC LUI-MÊME, SUR UN RELEVÉ INVALIDE. Une branche d'échec qu'on n'a jamais vue
   s'exécuter n'est pas un diagnostic : c'est une intention. On fabrique donc les trois formes
   d'invalidité et on exige un message LISIBLE, sans exception JavaScript. */
{
  const cas = [
    ["une occurrence non classée", [{ fichier: "f.ts", ligne: 1, colonne: 1, trouve: "IATA-blessed", categorie: null }]],
    ["une catégorie hors liste", [{ fichier: "f.ts", ligne: 2, colonne: 3, trouve: "homologué", categorie: "categorie_inventee" }]],
    ["une ancre de reformulation orpheline", [{ fichier: "f.ts", ligne: 3, colonne: 5, trouve: "homologué", categorie: "source_editoriale" }]],
  ];
  let bons = 0;
  for (const [nom, releve] of cas) {
    try {
      const v = verifier(releve);
      if (v.ok) { echec(`8 diagnostic — ${nom}`, "le relevé invalide est accepté"); continue; }
      /* Exactement la ligne que produit le cas 7 : si un champ manquait, elle lèverait ici. */
      const message = `${v.inconnues.length} inconnue(s), ${v.hors.length} hors liste, ${v.orphelines.length} ancre(s) orpheline(s)`;
      if (!/^\d+ inconnue\(s\), \d+ hors liste, \d+ ancre\(s\) orpheline\(s\)$/.test(message)) {
        echec(`8 diagnostic — ${nom}`, `message inattendu : ${message}`); continue;
      }
      bons++;
    } catch (e) {
      echec(`8 diagnostic — ${nom}`, `exception au lieu d'un diagnostic : ${e.constructor.name} — ${e.message}`);
    }
  }
  if (bons === cas.length) ok(`8 les ${cas.length} formes d'invalidité sont diagnostiquées lisiblement, sans exception`);
}

if (defauts) { console.error(`\n[inventaire] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[inventaire] la décision porte sur l'occurrence, le refus existe, rien ne se cache derrière une inertie invérifiable, l'ordre ne compte pas.");
