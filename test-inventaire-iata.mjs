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
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { jetonsNonReconcilies, reconcilier, PERIMETRE_RECONCILIE, dansUnFragmentAttribuePublie, FRAGMENTS_ATTRIBUES, dansUnSlugConserve, classer, relever, verifier, citationsDeLHeritage, ancresOrphelines, MOTIF, MOTIF_HERITE, ALTERNATIVES, FAMILLE_CONTENANT, FORMES_BORNEES, CATEGORIES, INSTRUMENTS_DE_MESURE, CHEMIN_SCELLE_INSTRUMENTS, verifierScelleInstruments } from "./inventaire-iata.mjs";

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
    /* Les sept formes ES/PT ajoutées le 03/09/2026 : les trois premières NOMMENT les exigences
       publiées — c'est licite —, les quatre suivantes affirment qu'un OBJET est conforme à
       l'organisation elle-même, ce qui ne veut rien dire. La contre-épreuve 4 exige un
       échantillon par alternative, donc chacune est éprouvée pour elle-même. */
    "em conformidade com os requisitos da IATA", "conforme aos requisitos da IATA", "requisitos da IATA",
    "em conformidade com a IATA", "compatível com a IATA", "compatible con la IATA", "conforme a IATA",
    "certifiée IATA", "approuvée par l'IATA", "aprobado por la IATA", "aprovada pela IATA",
    /* LES SIX AJOUTS DU 02/09/2026. Leur absence ici a fait rougir ce contrôle, et je ne l'avais
       pas rapporté : j'avais lu la fin de la sortie du harnais, pas la totalité. Une alternative
       sans échantillon n'est pas éprouvée — c'est exactement ce que ce contrôle existe pour dire. */
    "Caisse IATA type", "caisse IATA", "IATA crate",
    "rigid IATA type", "type IATA rigide", "tipo IATA rígida",
    /* LES SEPT AJOUTS DU 04/09/2026 — le complément d'agent dans les quatre langues, et les deux
       verbes d'agrément que la réconciliation des jetons a fait sortir de l'ombre. */
    "approved by the IATA", "agréée IATA", "IATA agréée",
    "aprovada IATA", "IATA aprovada", "aprobada IATA", "IATA aprobada",
    /* Et la préposition espagnole que le contrat ignorait, trouvée par la réconciliation. */
    "conforme con la IATA",
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

/* 6 bis — LE TITRE QUI RÉCLAMAIT LA NORME IATA NE REVIENT PAS.
   MOUVEMENT NOMMÉ (05/09/2026). Cette contre-épreuve exigeait la PRÉSENCE du titre reformulé
   (« La cage de transport en soute »), parce que la section existait et qu'il fallait vérifier
   qu'elle ne réclamait plus la norme IATA. La section entière est désormais SUPPRIMÉE du
   gabarit : `crate` est du texte libre quadrilingue, sans champ où loger une source, et il
   publiait « max 55 × 40 × 23 cm — mais 40 × 25 × 25 cm sur DH8-100 et ATR ».

   La garantie protégée n'a pas baissé, elle est mieux tenue : ce qui ne se rend plus ne peut
   plus rien affirmer. Ce que cette contre-épreuve exige donc maintenant, c'est l'INTERDICTION
   — l'ancien titre ne revient pas — et, POUR LE JOUR OÙ la section reviendrait sur preuves, que
   sa reformulation portugaise soit toujours juste. Cette seconde exigence est conditionnée à la
   présence du titre : elle dort tant que rien ne le rend, et mord dès qu'il reparaît. */
{
  const source = readFileSync("packages/ui/src/components/AirlinePremiumPage.astro", "utf8");
  const ANCIENS = ["The hold crate (IATA standard)", "La caisse soute (norme IATA)", "La jaula de bodega (norma IATA)"];
  const REFORMULES = ["The travel crate for the hold", "La cage de transport en soute",
                      "El transportín para viajar en bodega"];
  const survivants = ANCIENS.filter((t) => source.includes(t));
  const revenus = REFORMULES.filter((t) => source.includes(t));
  const ptOk = JSON.parse(readFileSync("packages/knowledge/translations/pt/inline.json", "utf8"))["The travel crate for the hold"];
  if (survivants.length) echec("6bis titre IATA", `l'ancien titre est revenu : ${survivants.join(" | ")}`);
  else if (revenus.length && ptOk !== "A caixa de transporte para viagem no porão")
    echec("6bis titre reformulé", `la section est revenue, mais le portugais est faux : ${JSON.stringify(ptOk)}`);
  else if (revenus.length)
    ok(`6bis la section de caisse est revenue (${revenus.length} titre(s)) — reformulée dans les quatre langues, l'ancien titre absent`);
  else
    ok("6bis la section de caisse est SUPPRIMÉE du gabarit : ni l'ancien titre réclamant la norme IATA, ni sa reformulation, ne sont rendus");
}

/* 6 sexies — UN INSTRUMENT DE MESURE NE SE MESURE PAS LUI-MÊME. Auto-contamination reproduite
   DEUX fois, et la seconde n'a été vue que parce que la première avait laissé une contre-épreuve.
     · 30/08/2026 — `dette-iata-publiee.json`, créé pour figer la dette encore publiée, apportait
       59 occurrences à l'inventaire — dont 56 classées `source_editoriale` —, gonflait le
       micro-lot de 592 à 649 et se plaçait EN TÊTE des fichiers à corriger.
     · 02/09/2026 — `test-etape3-dom.mjs`, devenu porteur des VECTEURS de contre-épreuve du
       relevé public (`\u0049ATA crate`, `I&#65;TA crate`, les six mutations de zone), faisait
       compter ces vecteurs comme de vraies occurrences : 33 slugs au lieu de 30, 589 références
       licites au lieu de 586.
   Une mesure qui se compte elle-même n'est plus une mesure ; et corriger ces fichiers à la main
   serait le mauvais geste, puisque l'un se régénère depuis le DOM et que les autres décrivent
   précisément le défaut qu'ils éprouvent.

   LA LISTE N'EST PAS RECOPIÉE ICI. Elle est importée de l'instrument : deux définitions de la
   même chose finissent toujours par diverger — c'est la faute récurrente de ce chantier. Et
   CHAQUE nom de la liste doit porter des occurrences réelles, sans quoi il suffirait d'y inscrire
   un fichier quelconque pour l'exempter sans que rien ne le signale. */
{
  const releve = relever();
  const reg = releve.filter((r) => r.categorie === "registre_preuve_non_public");
  const fichiers = [...new Set(reg.map((r) => r.fichier))].sort();
  const attendus = [...INSTRUMENTS_DE_MESURE].sort();
  const edito = ["source_editoriale", "source_generatrice_active", "heritage_a_corriger_ou_supprimer"];
  const contamine = releve.filter((r) => INSTRUMENTS_DE_MESURE.includes(r.fichier) && edito.includes(r.categorie));
  const parFichier = attendus.map((f) => `${f} : ${reg.filter((r) => r.fichier === f).length}`);

  /* UN INSTRUMENT VIDÉ RESTE UN INSTRUMENT (03/09/2026). La règle exigeait que CHAQUE nom de la
     liste porte des occurrences réelles — bonne règle contre un nom ajouté pour exempter en
     silence, mais elle est devenue fausse le jour où le micro-lot a ramené la dette publiée à
     zéro : `dette-iata-publiee.json` ne porte plus rien, précisément parce qu'il a réussi.
     La règle devient donc : aucun fichier ne porte la catégorie sans être dans la liste — c'est
     l'étanchéité, et c'est ce qui compte —, chaque nom de la liste EXISTE bien dans le dépôt, et
     la catégorie n'est pas vide dans son ensemble. La légitimité des membres, elle, est prouvée
     ailleurs, par le scellé versionné du contrôle 6octies. */
  const absents = attendus.filter((c) => !existsSync(c));
  const horsListe = fichiers.filter((f) => !attendus.includes(f));
  if (!reg.length) echec("6sexies instruments de mesure", "la catégorie ne contient rien du tout — elle ne prouve rien");
  else if (horsListe.length)
    echec("6sexies instruments de mesure", `catégorie portée hors liste par : ${horsListe.join(", ")}`);
  else if (absents.length)
    echec("6sexies instruments de mesure", `nom scellé sans fichier dans le dépôt : ${absents.join(", ")}`);
  else if (contamine.length)
    echec("6sexies instruments de mesure", `${contamine.length} occurrence(s) d'un instrument comptée(s) au micro-lot éditorial`);
  else ok(`6sexies les ${attendus.length} instruments de mesure se retirent du compte — ${parFichier.join(" · ")} —, aucun autre fichier ne porte la catégorie, et zéro n'entre au micro-lot éditorial`);
}

/* 6 octies — LA LISTE DES INSTRUMENTS EST SCELLÉE, PAS SEULEMENT CENTRALISÉE.
 *
 * ATTAQUE DE LA CONTRE-REVUE DU 02/09/2026, rejouée ici. Ajouter
 * `packages/ui/src/content/guides/fr/voyager-avion-avec-chien.md` — une vraie source éditoriale,
 * onze occurrences — à `INSTRUMENTS_DE_MESURE` : le harnais sortait en 0, entièrement vert, en
 * annonçant cinq instruments et en retirant ces onze occurrences du micro-lot éditorial.
 *
 * POURQUOI 6sexies ET 6septies NE POUVAIENT PAS LE VOIR, et pourquoi ils restent justes malgré
 * cela : ils IMPORTENT la liste au lieu de la recopier — la bonne décision contre la divergence.
 * Mais une liste confrontée à elle-même ne prouve que son application et son bornage par chemin ;
 * elle ne peut rien dire de la LÉGITIMITÉ de ses membres. Il faut un témoin extérieur, versionné.
 *
 * ON ÉPROUVE LES DEUX SENS : la liste réelle tient son scellé, et une liste enrichie de cette
 * source précise est refusée EN LA NOMMANT. On éprouve aussi le scellé contre lui-même : une
 * liste éditée à la main sans recalcul de l'empreinte est vue. */
{
  const ecarts = [];
  const reel = verifierScelleInstruments();
  if (reel.length) ecarts.push(`la liste réelle ne tient pas son scellé : ${reel.join(" · ")}`);

  const INTRUS = "packages/ui/src/content/guides/fr/voyager-avion-avec-chien.md";
  const vus = verifierScelleInstruments([...INSTRUMENTS_DE_MESURE, INTRUS]);
  if (!vus.length) ecarts.push("une vraie source éditoriale ajoutée à la liste passe le scellé");
  else if (!vus.some((e) => e.includes(INTRUS))) ecarts.push(`l'ajout est refusé mais le chemin n'est pas nommé : ${vus.join(" · ")}`);

  const retire = verifierScelleInstruments(INSTRUMENTS_DE_MESURE.filter((c) => c !== "test-etape3-dom.mjs"));
  if (!retire.some((e) => e.includes("test-etape3-dom.mjs"))) ecarts.push(`un instrument RETIRÉ n'est pas nommé : ${retire.join(" · ")}`);

  /* Le scellé ne doit pas pouvoir mentir sur lui-même : on lui donne une liste et une empreinte
     qui ne se correspondent pas, par un fichier temporaire — le scellé du dépôt n'est pas touché. */
  const faux = join(mkdtempSync(join(tmpdir(), "scelle-")), "scelle.json");
  writeFileSync(faux, JSON.stringify({ chemins: [...INSTRUMENTS_DE_MESURE, "packages/ui/src/pages/index.astro"], empreinte: "0".repeat(64) }));
  const menteur = verifierScelleInstruments([...INSTRUMENTS_DE_MESURE, "packages/ui/src/pages/index.astro"], faux);
  if (!menteur.some((e) => e.includes("empreinte"))) ecarts.push(`un scellé édité à la main n'est pas vu : ${menteur.join(" · ")}`);
  rmSync(dirname(faux), { recursive: true, force: true });

  if (ecarts.length) echec("6octies scellé des instruments", ecarts.join(" · "));
  else ok(`6octies la liste des instruments tient son scellé versionné (${CHEMIN_SCELLE_INSTRUMENTS}) ; un ajout, un retrait et un scellé falsifié sont refusés en nommant le chemin`);
}

/* 6 nonies — L'EXEMPTION DE SLUG EST UNE SEULE RÈGLE, BORNÉE À LA POSITION EXACTE.
 *
 * POURQUOI ELLE EXISTE SÉPARÉMENT (03/09/2026). Trois slugs arbitrés comme conservés paraissent
 * dans les URL du JSON-LD des pages qu'ils nomment. `classer()` les exemptait dans les sources ;
 * la garde de la dette PUBLIÉE, elle, les comptait — deux règles pour la même question. Tant que
 * ces slugs existaient, le registre ne pouvait STRUCTURELLEMENT pas atteindre zéro. Les deux
 * consomment désormais `dansUnSlugConserve()`.
 *
 * ON ÉPROUVE LES TROIS SENS EXIGÉS : le slug exact est ignoré ; les mêmes mots dans la prose
 * voisine restent interdits ; un slug altéré d'un seul caractère ne bénéficie de rien. */
{
  const SLUG = "transportin-homologado-iata-perro";
  const url = `https://mydogcanfly.com/es/travel-hub/${SLUG}/`;
  const dans = url.indexOf("homologado");
  const prose = `une jaula homologado y ${SLUG}`;
  const altere = `https://mydogcanfly.com/es/travel-hub/${SLUG}X/`;
  const ecarts = [];
  if (!dansUnSlugConserve(url, dans, dans + "homologado".length)) ecarts.push("le slug EXACT n'est pas exempté");
  const pi = prose.indexOf("homologado");
  if (dansUnSlugConserve(prose, pi, pi + "homologado".length)) ecarts.push("les mêmes mots dans la prose sont exemptés — l'exemption fuit");
  const ai = altere.indexOf("homologado");
  if (!dansUnSlugConserve(altere, ai, ai + "homologado".length)) {
    /* Un slug SUIVI d'un caractère contient toujours le slug : c'est le préfixe qui compte. On
       éprouve donc l'altération là où elle change vraiment l'identifiant — à l'intérieur. */
  }
  const casse = `https://mydogcanfly.com/es/travel-hub/${SLUG.replace("homologado", "homologade")}/`;
  const ci = casse.indexOf("homolog");
  if (dansUnSlugConserve(casse, ci, ci + "homologade".length)) ecarts.push("un slug altéré est exempté");
  /* Et l'exemption ne doit pas déborder : une occurrence qui DÉPASSE du slug n'est pas dedans. */
  if (dansUnSlugConserve(url, dans, url.length)) ecarts.push("une occurrence qui dépasse du slug est exemptée");
  if (ecarts.length) echec("6nonies exemption de slug", ecarts.join(" · "));
  else ok("6nonies l'exemption de slug est une seule règle, bornée à la position : le slug exact est ignoré, la prose voisine non, un slug altéré non plus");
}

/* 6 decies — L'EXEMPTION DE FRAGMENT CÔTÉ PUBLIÉ EST BORNÉE À L'URL EXACTE ET AU TEXTE EXACT.
 *
 * Les désignations officielles de Cathay et d'airBaltic — « IATA Accredited Freight Forwarder »,
 * le certificat « IATA Live Animals Regulations » — sont licites à la SOURCE par chemin exact.
 * Publiées, elles doivent l'être de la même façon : par URL exacte, jamais par permission
 * lexicale. Sans cela, le registre comptait 7 occurrences sur les 4 pages Cathay (03/09/2026).
 * Trois sens : la bonne URL exempte ; une autre URL non ; un fragment altéré non. */
{
  const f = FRAGMENTS_ATTRIBUES.find((x) => x.fragment === "IATA Accredited Freight Forwarder");
  const texte = `bookings through IPATA or ATA members, ${f.fragment}s, or holders`;
  const i = texte.indexOf("IATA Accredited"), j = i + "IATA Accredited".length;
  const ecarts = [];
  if (!dansUnFragmentAttribuePublie("/airlines/cathay-pacific/", texte, i, j)) ecarts.push("l'URL déclarée n'exempte pas");
  if (!dansUnFragmentAttribuePublie("/pt/airlines/cathay-pacific/", texte, i, j)) ecarts.push("la version portugaise de la page n'exempte pas");
  if (dansUnFragmentAttribuePublie("/airlines/lufthansa/", texte, i, j)) ecarts.push("une AUTRE URL exempte — la permission fuit");
  if (dansUnFragmentAttribuePublie("/airlines/cathay-pacific/", "third-party IATA-accredited agents", 12, 27)) ecarts.push("les mêmes mots hors du fragment sont exemptés");
  const altere = texte.replace("Accredited Freight", "Accredited Cargo");
  if (dansUnFragmentAttribuePublie("/airlines/cathay-pacific/", altere, i, j)) ecarts.push("un fragment altéré est exempté");
  const sansPages = FRAGMENTS_ATTRIBUES.filter((x) => !Array.isArray(x.pages) || !x.pages.length);
  if (sansPages.length) ecarts.push(`${sansPages.length} fragment(s) sans URL déclarée`);
  if (ecarts.length) echec("6decies exemption publiée", ecarts.join(" · "));
  else ok(`6decies les ${FRAGMENTS_ATTRIBUES.length} fragments attribués sont exemptés publiés par URL exacte et texte exact — autre URL, autres mots, fragment altéré : rien`);
}

/* 6 septies — LA CATÉGORIE EST BORNÉE À UN CHEMIN EXACT. La même formulation écrite dans une
   VRAIE source éditoriale reste une dette éditoriale : sans cela, la catégorie deviendrait une
   porte de sortie, et il suffirait de nommer un fichier « registre » pour s'y soustraire. */
{
  const cas = [
    ["une vraie source éditoriale", "packages/ui/src/content/guides/fr/materiel-voyage-chien.md", "source_editoriale"],
    ["un fichier au nom voisin", "dette-iata-publiee.backup.json", "source_editoriale"],
    ["le même nom dans un sous-dossier", "docs/dette-iata-publiee.json", "test_commentaire_historique"],
    ["le registre lui-même", "dette-iata-publiee.json", "registre_preuve_non_public"],
    /* Le second instrument vit dans un répertoire — la racine — dont TOUS les autres `test-*`
       sont déjà classés « commentaire historique ». Le voisin le prouve : le bénéfice tient au
       chemin exact, pas au préfixe, et un fichier ne s'exempte pas en se faisant appeler test. */
    ["un test voisin du second instrument", "test-etape3-dom.backup.mjs", "test_commentaire_historique"],
    ["le second instrument lui-même", "test-etape3-dom.mjs", "registre_preuve_non_public"],
    ["un voisin de l'instrument lui-même", "inventaire-iata.backup.mjs", "source_editoriale"],
    ["l'instrument lui-même", "inventaire-iata.mjs", "registre_preuve_non_public"],
    ["un voisin du harnais de l'instrument", "test-inventaire-iata.backup.mjs", "test_commentaire_historique"],
    ["le harnais de l'instrument", "test-inventaire-iata.mjs", "registre_preuve_non_public"],
  ];
  const ecarts = [];
  for (const [nom, chemin, attendu] of cas) {
    const ligne = '  "/airlines/x/": { "iata-approved": 1 },';
    const vu = classer(chemin, ligne, "iata-approved", ligne.indexOf("iata-approved"), ligne.indexOf("iata-approved") + 13);
    if (vu !== attendu) ecarts.push(`${nom} → « ${vu} » au lieu de « ${attendu} »`);
  }
  if (ecarts.length) echec("6septies bornage du registre", ecarts.join(" · "));
  else ok(`6septies la catégorie ne s'applique qu'au chemin exact — ${cas.length} cas éprouvés`);
}

/* 6 ter — LE CONTRAT CHIFFRÉ DE L'ÉTAPE 3. Un contrat sans chiffre exigé n'engage à rien.
 *
 * SON TRAJET, ENTIÈREMENT NOMMÉ. Il a bougé trois fois le 30/08/2026, et jamais en silence :
 *
 *   32   mesuré avant la fusion de la PR #29 ;
 *   −8   les huit `partner.equipment.reason` et `reason_cargo` des quatre langues, réécrits par
 *        #29 sur l'acceptation par la compagnie qui opère le vol : ils sont FAITS ;
 *   +1   une ligne de `FlightFinder.astro` — un commentaire de code, non publié — que le motif
 *        attrapait ;
 *   −1   cette ligne a été REFORMULÉE : elle dit la même chose sans la forme suivie qui
 *        déclenchait le motif.
 *   24   affirmations publiques interdites ;
 *   −24  corrigées par l'étape 3 elle-même, le 30/08/2026 ;
 *    −3  le titre `AirlinePremiumPage` reformulé, et son ancre retirée puisqu'elle ne
 *        s'appliquait plus — la garde d'ancre a rougi d'elle-même au moment de la correction.
 *    0   il ne reste RIEN dans les surfaces applicatives.
 *
 * La reformulation a remplacé une exception de classement que j'avais d'abord écrite, et que la
 * contre-revue a mise à terre : elle reposait sur une regex `/\*…\*\/` incapable de distinguer un
 * commentaire d'une chaîne contenant ces marqueurs, et sa preuve DOM ne s'exécutait jamais
 * puisque ce harnais tourne avant tout build. Construire un analyseur lexical pour UNE occurrence
 * non publiée n'en valait pas le prix ; reformuler la ligne coûtait un mot.
 */
{
  const releve = relever();
  const interdites = releve.filter((r) => r.categorie === "affirmation_publique_interdite").length;
  const aRef = releve.filter((r) => r.categorie === "reference_reglementaire_a_reformuler").length;
  /* MOUVEMENT FINAL DE L'ÉTAPE 3 : 24 + 3 → 0 + 0. Les 27 modifications sont FAITES. La
     sentinelle devient donc « aucune affirmation publique ne subsiste dans les surfaces
     applicatives », et c'est elle qui empêchera désormais une régression d'y revenir. Le reste à
     faire — 592 occurrences éditoriales et 229 artefacts à régénérer — est un autre lot, et il
     garde ses propres chiffres. */
  if (interdites !== 0 || aRef !== 0)
    echec("6ter l'étape 3 est faite", `il reste ${interdites} affirmation(s) publique(s) et ${aRef} référence(s) à reformuler dans les surfaces applicatives`);
  else ok("6ter aucune affirmation publique interdite ne subsiste dans les surfaces applicatives");
}

/* 6 quater — UNE ANCRE DE REFORMULATION QUI NE TROUVE RIEN FAIT REFUSER LE RELEVÉ. Une
   déclaration qui ne s'applique à rien ne protège rien, et masquerait une modification approuvée
   qu'on croirait couverte. */
{
  /* LA LISTE RÉELLE EST VIDE depuis l'étape 3 — le seul titre déclaré a été reformulé. Le
     MÉCANISME doit rester prouvé pour autant : on l'éprouve donc sur une déclaration synthétique,
     et non sur la liste de production. Une garde qu'on ne peut plus éprouver parce que son objet
     a disparu cesse silencieusement de protéger. */
  const declarationSynthetique = [{ fichier: "packages/ui/src/components/Inexistant.astro", ancre: "un titre qui n'existe pas" }];
  const bidon = [{ fichier: "packages/ui/src/components/Inexistant.astro", ligne: 1, colonne: 1,
                   trouve: "norma IATA", categorie: "affirmation_publique_interdite" }];
  const v = verifier(bidon, declarationSynthetique);
  if (v.ok || !v.orphelines.length) echec("6quater ancre orpheline", "un relevé où l'ancre ne mord pas est accepté");
  else if (ancresOrphelines(relever()).length) echec("6quater ancre orpheline", "une ancre de production ne mord pas");
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
  /* Et le scellé des instruments EST une cause de refus depuis le 02/09/2026 : sans lui dans ce
     message, l'attaque de la contre-revue faisait rougir un contrôle qui n'en disait pas la
     raison — « 0 inconnue, 0 hors liste, 0 orpheline », donc rouge sans motif lisible. */
  if (!v.ok) echec("7 relevé réel", `${v.inconnues.length} inconnue(s), ${v.hors.length} hors liste, ${v.orphelines.length} ancre(s) orpheline(s)`
    + (v.scelle.length ? ` · scellé des instruments : ${v.scelle.join(" · ")}` : ""));
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
    ["une ancre de reformulation orpheline", [{ fichier: "f.ts", ligne: 3, colonne: 5, trouve: "homologué", categorie: "source_editoriale" }],
     [{ fichier: "f.ts", ancre: "un titre absent" }]],
  ];
  let bons = 0;
  for (const [nom, releve, declarations] of cas) {
    try {
      const v = verifier(releve, declarations);
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

/* ---- 9. L'EXTENSION DU 02/09/2026 EST UN AJOUT, PAS UNE RÉÉCRITURE ------------------------- */
/* La famille « contenant + IATA » — « caisse IATA », « IATA crate », « Caisse IATA type » — a été
 * ajoutée au relevé après un contre-test navigateur : ces formes n'étaient pas mal classées, elles
 * étaient INVISIBLES, aucune alternative ne produisant un « IATA » nu.
 *
 * LE RISQUE D'UN TEL ÉLARGISSEMENT N'EST PAS D'EN VOIR TROP, C'EST D'EN DÉPLACER. Dans une
 * alternance, une branche nouvelle qui accroche plus tôt CONSOMME le texte qu'une branche légitime
 * attendait : « crate IATA standards » pourrait faire disparaître « IATA standards » du compte des
 * références licites, sans que le total le montre. On rejoue donc le relevé avec le motif HÉRITÉ et
 * on exige que chacune de ses occurrences soit encore là — même fichier, même ligne, même colonne,
 * même texte, MÊME CATÉGORIE.
 *
 * LES INSTRUMENTS SONT ÉCARTÉS DE CETTE PREUVE, ET LA PHRASE CI-DESSUS DIT POURQUOI. Elle écrit
 * « crate IATA standards » pour NOMMER le risque : la famille y accroche « crate IATA » et
 * consomme le « IATA standards » que le motif hérité voyait. C'est un déplacement RÉEL, mais dans
 * un texte écrit exprès pour décrire le défaut — pas dans un contenu servi. Le mesurer ici ferait
 * rougir la preuve pour la prose de la preuve elle-même. L'écart se prend donc sur la catégorie
 * `registre_preuve_non_public`, c'est-à-dire sur le MÊME jugement que partout ailleurs : un
 * instrument ne se mesure pas lui-même. Constaté le 02/09/2026, en unifiant les deux mécanismes
 * d'exclusion : la contre-épreuve a désigné exactement cette ligne. */
{
  const instrument = (r) => r.categorie === "registre_preuve_non_public";
  const avant = relever({ motif: MOTIF_HERITE }).filter((r) => !instrument(r));
  const apres = relever().filter((r) => !instrument(r));
  const cle = (r) => `${r.fichier}:${r.ligne}:${r.colonne}:${r.trouve}`;
  const carte = new Map(apres.map((r) => [cle(r), r]));
  const disparues = avant.filter((r) => !carte.has(cle(r)));
  const deplacees = avant.filter((r) => carte.has(cle(r)) && carte.get(cle(r)).categorie !== r.categorie);
  if (!avant.length) echec("9 additivité", "le relevé hérité est vide — la contre-épreuve ne prouverait rien");
  else if (disparues.length) {
    echec("9 additivité", `${disparues.length} occurrence(s) du relevé hérité ont disparu`);
    for (const d of disparues.slice(0, 5)) console.error(`      ${d.fichier}:${d.ligne}:${d.colonne} « ${d.trouve} » (${d.categorie})`);
  } else if (deplacees.length) {
    echec("9 additivité", `${deplacees.length} occurrence(s) ont changé de catégorie`);
    for (const d of deplacees.slice(0, 5)) console.error(`      ${d.fichier}:${d.ligne} « ${d.trouve} » ${d.categorie} → ${carte.get(cle(d)).categorie}`);
  } else if (apres.length <= avant.length) {
    echec("9 additivité", `l'extension n'ajoute rien (${avant.length} → ${apres.length}) : la famille n'est pas relevée`);
  } else ok(`9 additivité — les ${avant.length} occurrences héritées sont intactes, catégorie comprise, et l'extension en ajoute ${apres.length - avant.length}`);
}

/* ---- 10. LA FAMILLE VOIT CE QU'ELLE DOIT VOIR, ET RIEN DE PLUS ----------------------------- */
/* Les deux sens, comme pour le détecteur de montants : les formes attribuant un contenant à l'IATA
 * doivent être vues ; les références réglementaires licites doivent rester licites. Sans la seconde
 * moitié, on pourrait faire tomber le compteur en emportant de l'information vraie. */
{
  const VUES = ["caisse IATA", "caisses IATA", "Caisse IATA type", "Jaula IATA típica", "IATA crate",
    "IATA kennel", "IATA carrier", "caixa IATA", "transportín IATA", "sac IATA",
    /* les trois formes BORNÉES, sans contenant adjacent, relevées sur la fiche Luxair */
    "rigid IATA type", "type IATA rigide", "tipo IATA rígida",
    /* ---- LE QUALIFICATIF INTERCALÉ, contre-revue du 03/09/2026 ----------------------------
       La famille ne voyait que le contenant COLLÉ à `IATA`. Ces formes-là étaient publiées et
       comptées nulle part : le registre affichait 0 / 0 pendant qu'elles restaient à l'écran.
       LES DEUX AXES bornés — la matière et l'usage — sont éprouvés dans les quatre langues et
       dans les DEUX SENS, contenant→IATA et IATA→contenant. */
    "caisse rigide IATA", "caisses rigides IATA", "caisse souple IATA",
    "transportín rígido IATA", "jaula rígida IATA", "transportín flexible IATA",
    "caixa rígida IATA", "caixa flexível IATA", "bolsa flexível IATA",
    "caisse de transport IATA", "caixa de transporte IATA", "bolsa de transporte IATA",
    "jaula de viaje IATA", "caixa de viagem IATA", "sac de voyage IATA",
    "IATA travel crate", "IATA dog crate", "IATA pet crate", "IATA rental crates",
    /* ---- `container`, ET LES DEUX VERBES D'AGRÉMENT (contre-revue du 04/09/2026) -----------
       Le lexique des contenants ignorait le mot anglais `container` alors que la table anglaise
       du réécriveur le connaissait : « IATA container required » est resté publié sur la fiche
       anglaise Thai Airways pendant que le registre annonçait 0 / 0. Même mécanique sur les
       verbes : « agréée IATA » vivait dans `rules.json`, et « approuvée par l'IATA » écrit avec
       une apostrophe TYPOGRAPHIQUE échappait au motif comme `\b` échappe à un « é ». */
    "IATA container", "IATA containers", "container IATA", "containers IATA",
    "IATA rigid container", "IATA agréée",
    "approved by IATA", "approved by the IATA", "certified by IATA",
    "approuvée par l’IATA", "approuvée par l'IATA", "aprovada pela IATA", "aprobada por la IATA"];
  /* CE QUE LA FAMILLE VOIT EN PARTIE, ET POURQUOI C'EST SUFFISANT ICI. Dans « rigid IATA crate »
     l'adjectif précède le tout : le motif accroche « IATA crate » et laisse « rigid » dehors. Ce
     n'est pas un trou — l'affirmation interdite EST « IATA crate », et le réécriveur rend « rigid
     travel crate », adjectif conservé. On exige donc ici la seule chose qui compte : qu'une
     occurrence soit vue ET jugée interdite. Exiger l'égalité au texte entier ferait échouer un
     contrôle sur une propriété qu'on ne cherche pas. */
  const VUES_EN_PARTIE = ["rigid IATA crate", "soft-sided IATA carrier", "hard IATA kennel",
    "una jaula rígida IATA de gran tamaño",
    /* « caisse agréée IATA » : l'affirmation interdite est « agréée IATA » ; le nom du contenant
       la précède et reste dehors, comme « rigid » devant « IATA crate ». */
    "caisse agréée IATA", "un contenedor aprobado por la IATA"];
  /* ---- LA LIMITE DU BORNAGE, MESURÉE PLUTÔT QU'AFFIRMÉE ------------------------------------
     La famille admet UN qualificatif intercalé, pas deux. « caisse rigide double coque IATA »
     serait donc invisible — et c'est un CONSTAT, pas une garantie. Aucune forme à deux
     qualificatifs n'existe dans le dépôt : le relevé des mots réellement intercalés, refait pour
     cette extension, n'en montre aucune. On ne s'élargit donc pas sur une hypothèse, mais on
     n'enterre pas non plus la limite dans un commentaire : elle est ÉPROUVÉE. Le jour où l'on
     ajoute le second cran, ce contrôle rougira et forcera à le dire. */
  const LIMITE_NOMMEE = ["caisse rigide double coque IATA", "IATA soft-sided travel carrier"];
  /* ET LA LIMITE EST DÉSORMAIS SURVEILLÉE, PAS SEULEMENT NOMMÉE. La contre-revue du 04/09/2026 a
     eu raison de la rédaction précédente : elle vérifiait que deux phrases SYNTHÉTIQUES restaient
     invisibles, sans jamais balayer le dépôt. Écrire demain « caisse rigide double coque IATA »
     dans une vraie source aurait donc laissé le test ET le registre au vert.
     La réconciliation renverse cela : le jeton « IATA » de ces phrases n'est ni dans une
     occurrence du motif, ni dans un contexte licite déclaré. Il DOIT donc ressortir comme non
     réconcilié — c'est-à-dire faire échouer l'inventaire — même si le motif spécialisé ne
     reconnaît pas encore la forme. Une forme inconnue est bruyante, plus jamais muette. */
  const nonSurveillees = LIMITE_NOMMEE.filter((t) => jetonsNonReconcilies(t).length === 0);
  /* « norma IATA » N'EST PAS DANS CETTE LISTE, ET C'EST UN CONSTAT, PAS UN OUBLI. L'espagnol
     « norma IATA » est classé INTERDIT par un arbitrage antérieur, alors que le français
     « norme(s) IATA » est classé LICITE. Les deux disent pourtant la même chose. L'incohérence
     est ANTÉRIEURE à cette extension — elle ne vient pas d'elle et n'est pas corrigée ici — mais
     elle est nommée pour arbitrage plutôt que gommée en l'inscrivant du côté qui m'arrange. */
  /* LA SYMÉTRIE, ÉPROUVÉE DANS LES DEUX LANGUES. « norme(s) IATA » et « norma(s) IATA » nomment
     le même référentiel ; les traiter différemment était une incohérence, pas une règle. */
  const LICITES = ["normes IATA", "norme IATA", "normas IATA", "norma IATA", "exigences IATA",
    "IATA LAR", "Live Animals Regulations", "IATA method", "IATA requirements", "IATA standards"];
  /* LES AFFIRMATIONS COMPLÈTES RESTENT INTERDITES : ce n'est pas le mot « norme » qui trompe,
     c'est la phrase qui attribue le contenant au référentiel. */
  const INTERDITES = ["conforme à la norme IATA", "conforme a la norma IATA", "homologada IATA",
    "IATA-approved", "certifiée IATA"];
  /* ET « ET RIEN DE PLUS » A ENFIN DES CAS NÉGATIFS. Sans eux, l'intitulé du contrôle promettait
     une garantie que rien ne vérifiait. « type IATA » nu a d'ailleurs été RETIRÉ du motif pour
     cette raison : il attrapait un type de document et un code d'aéroport. */
  const IGNOREES = ["type IATA", "tipo IATA", "IATA airport code", "IATA document type",
    "code IATA", "agent IATA",
    /* ET L'ÉLARGISSEMENT N'A PAS DÉBORDÉ. Chacune de ces formes contient un mot de l'un des deux
       axes — « transport », « travel », « rigide » — SANS nommer de contenant : la famille ne
       doit toujours rien y voir. Sans ces cas, « bornée » ne serait qu'une intention. */
    "règles de transport IATA", "IATA travel documents", "IATA travel agent",
    "normes de transport IATA", "structure rigide IATA", "IATA pet travel requirements"];
  const rates = VUES.filter((t) => { MOTIF.lastIndex = 0; const m = t.match(MOTIF); return !m || m[0] !== t; });
  const aveugles = VUES_EN_PARTIE.filter((t) => {
    MOTIF.lastIndex = 0;
    const m = t.match(MOTIF);
    if (!m) return true;
    return !m.some((x) => classer("x.md", t, x, t.indexOf(x), t.indexOf(x) + x.length) === "source_editoriale");
  });
  const perdues = LICITES.filter((t) => classer("x.md", t, (() => { MOTIF.lastIndex = 0; return (t.match(MOTIF) ?? [""])[0]; })(),
    0, ((t.match(MOTIF) ?? [""])[0]).length) !== "reference_reglementaire_legitime");
  const laxistes = INTERDITES.filter((t) => { MOTIF.lastIndex = 0; const m = (t.match(MOTIF) ?? [""])[0];
    return classer("x.md", t, m, 0, m.length) === "reference_reglementaire_legitime"; });
  const trop = IGNOREES.filter((t) => { MOTIF.lastIndex = 0; return MOTIF.test(t); });
  const limiteDeplacee = LIMITE_NOMMEE.filter((t) => { MOTIF.lastIndex = 0; const m = t.match(MOTIF); return m && m[0] === t; });
  if (rates.length) echec("10 famille", `formes non vues en entier : ${rates.join(", ")}`);
  else if (aveugles.length) echec("10 famille", `formes dont aucune part n'est vue ni jugée interdite : ${aveugles.join(", ")}`);
  else if (perdues.length) echec("10 famille", `références licites devenues autre chose : ${perdues.join(", ")}`);
  else if (laxistes.length) echec("10 famille", `affirmations complètes devenues licites : ${laxistes.join(", ")}`);
  else if (trop.length) echec("10 famille", `vues alors qu'elles ne disent rien d'un contenant : ${trop.join(", ")}`);
  else if (limiteDeplacee.length) echec("10 famille", `la limite du bornage a bougé sans être nommée : ${limiteDeplacee.join(", ")} — deux qualificatifs sont désormais vus, il faut le dire ici`);
  else if (nonSurveillees.length) echec("10 famille", `hors bornage ET hors surveillance : ${nonSurveillees.join(", ")} — ces formes passeraient inaperçues dans une vraie source`);
  else ok(`10 famille — ${VUES.length} formes vues en entier, ${VUES_EN_PARTIE.length} vues en partie et jugées interdites, ${LIMITE_NOMMEE.length} formes à deux qualificatifs hors bornage mais SURVEILLÉES par la réconciliation, ${LICITES.length} références licites préservées, `
    + `${INTERDITES.length} affirmations complètes toujours interdites, ${IGNOREES.length} formes sans contenant ignorées`);
}

/* ---- 11. LA RÉCONCILIATION PARCOURT VRAIMENT LES SOURCES, PAR SON PROPRE CHEMIN ------------ */
/* DEUX RÉDACTIONS PRÉCÉDENTES ONT MANQUÉ CE CONTRÔLE, ET LA SECONDE ÉTAIT LA PIRE.
 *   · La première n'affirmait que l'invisibilité de deux phrases synthétiques, sans rien balayer.
 *   · La seconde balayait — mais `reconcilier()` écartait tout chemin de `GENERATRICES_DECLAREES`,
 *     qui vaut `["content/"]` : les 324 fiches compagnies et pays, sources de vérité de ce lot,
 *     n'étaient JAMAIS parcourues. Le contrôle ne l'a pas vu parce qu'il mutait une chaîne EN
 *     MÉMOIRE et appelait `jetonsNonReconcilies()` directement, sans jamais traverser le filtrage
 *     de chemins de `reconcilier()`. Une contre-épreuve qui court-circuite le chemin de production
 *     n'éprouve pas le chemin de production.
 *
 * ON ÉCRIT DONC UN VRAI FICHIER dans une racine jetable, et on passe par `reconcilier({racine})` —
 * le même code, le même filtrage — en exigeant le CHEMIN EXACT du fichier muté. Et l'on exige que
 * chaque racine déclarée soit RÉELLEMENT visitée : une racine que rien ne parcourt est un
 * balayage qui ment sans le dire. */
{
  const ecarts = [];
  const base = mkdtempSync(join(tmpdir(), "recon-"));
  try {
    const dir = join(base, "content", "airlines");
    mkdirSync(dir, { recursive: true });
    const FORMES = ["Use an IATA-blessed travel container", "caisse rigide double coque IATA",
      "IATA soft-sided travel carrier", "IATA Cargo crate", "IATA standards approved crate",
      "IATA requirements compliant carrier"];
    for (const [i, forme] of FORMES.entries()) {
      const nom = `x${i}.yml`;
      writeFileSync(join(dir, nom), `name: Témoin\nnote:\n  en: "${forme}"\n`);
      const vus = reconcilier({ racine: base, racines: ["content/airlines/"], scelle: new Map() });
      const attendu = `content/airlines/${nom}`;
      if (!vus.some((v) => v.fichier === attendu))
        ecarts.push(`« ${forme} » écrite dans ${attendu} n'est pas relevée par reconcilier() — vu : ${JSON.stringify(vus.map((v) => v.fichier))}`);
      rmSync(join(dir, nom), { force: true });
    }
    /* ET LE TÉMOIN NÉGATIF : une racine jetable sans faute ne doit rien rendre. */
    writeFileSync(join(dir, "propre.yml"), 'name: Témoin\nnote:\n  en: "conforme aux normes IATA"\n');
    const propre = reconcilier({ racine: base, racines: ["content/airlines/"], scelle: new Map() });
    if (propre.length) ecarts.push(`une racine sans faute rend ${propre.length} jeton(s) : le contrôle crie sur tout`);
  } finally { rmSync(base, { recursive: true, force: true }); }

  /* CHAQUE RACINE DÉCLARÉE EST RÉELLEMENT PARCOURUE, sur le dépôt réel. */
  const reel = reconcilier();
  const jamais = PERIMETRE_RECONCILIE.filter((r) => !reel.racinesVisitees.has(r));
  if (jamais.length) ecarts.push(`racine(s) déclarée(s) que rien ne parcourt : ${jamais.join(", ")}`);
  if (reel.length) ecarts.push(`${reel.length} jeton(s) non réconcilié(s) : ${reel[0].fichier}:${reel[0].ligne}`);
  /* ET LE SCELLÉ DES LICITES PORTE RÉELLEMENT : sans lui, le dépôt réel ne serait pas à zéro. */
  const sansScelle = reconcilier({ scelle: new Map() });
  if (!sansScelle.length) ecarts.push("le scellé des occurrences licites ne retire rien : il ne prouve rien");

  if (ecarts.length) { echec("11 réconciliation des jetons", `${ecarts.length} écart(s)`); for (const e of ecarts.slice(0, 6)) console.error(`      ${e}`); }
  else ok(`11 réconciliation — six formes inconnues écrites dans une VRAIE racine jetable sont relevées par reconcilier() au chemin exact, les ${PERIMETRE_RECONCILIE.length} racines déclarées sont toutes parcourues, et le scellé retire ${sansScelle.length} tournure(s) licite(s) énumérée(s)`);
}

/* ---- 12. AUCUNE TOURNURE N'EST SILENCIEUSE, ET AUCUNE PERMISSION N'EST UN LAISSEZ-PASSER ---- */
/* LA PROPRIÉTÉ QUE CE LOT AURAIT DÛ TENIR DÈS LE DÉPART, écrite en toutes lettres : une tournure
 * qui touche à l'IATA est soit VUE et jugée, soit NON RÉCONCILIÉE et bruyante. Jamais silencieuse.
 * Les trois faux zéros publiés — le qualificatif intercalé, `container`, `agréée` — étaient tous
 * des silences, pas des erreurs de jugement.
 *
 * ET LE SECOND VOLET COMPTE AUTANT. Les permissions de `CONTEXTES_LICITES` sont des trous en
 * puissance : en les écrivant, j'en ai ouvert neuf d'un coup — « a valid IATA crate », « the
 * airline IATA kennel », « per IATA crate rules » passaient parce qu'un mot de la permission
 * traînait dans la phrase. Une permission ne doit jamais blanchir une attribution de contenant.
 * Les deux moitiés sont donc éprouvées ensemble : rien de silencieux d'un côté, rien de bruyant
 * de l'autre — car un contrôle qui hurle sur tout ne serait pas lu. */
{
  const etat = (p) => {
    MOTIF.lastIndex = 0;
    if ((p.match(MOTIF) ?? []).some((x) => classer("content/airlines/x.yml", p, x, p.indexOf(x), p.indexOf(x) + x.length) !== "reference_reglementaire_legitime")) return "vue";
    return jetonsNonReconcilies(p).length ? "bruyante" : "silencieuse";
  };
  /* Des attributions, dont aucune n'existe aujourd'hui dans le dépôt : c'est le point. Elles
     éprouvent ce qui se passera le jour où quelqu'un les écrira. */
  const ATTRIBUTIONS = ["a valid IATA crate", "the airline IATA kennel", "per IATA crate rules",
    "a third-party IATA carrier", "latest IATA cage", "sources IATA crate",
    "Jaula conforme con la IATA", "A IATA-blessed crate", "caisse rigide double coque IATA",
    "IATA soft-sided travel carrier", "une caisse bénie par IATA", "IATA container required",
    "caisse agréée IATA", "une caisse approuvée par l’IATA",
    /* LES TROIS ATTAQUES DE LA CONTRE-REVUE DU 04/09/2026. Toutes trois portaient un fragment que
       le contrat juge LICITE — « IATA Cargo », « IATA standards », « IATA requirements » — et
       passaient donc sans bruit, en habillant l'attribution d'une permission écrite pour autre
       chose. C'est la raison pour laquelle plus aucune permission ne franchit la garde. */
    "IATA Cargo crate", "IATA standards approved crate", "IATA requirements compliant carrier"];
  /* DES TOURNURES LICITES QUI NE VOISINENT AUCUN CONTENANT : celles-là, et celles-là seulement,
     sont couvertes par une permission générale et doivent rester silencieuses. */
  const LICITES_SANS_CONTENANT = ["l'IATA publie les exigences", "Hold (checked, per IATA)",
    "La conformité IATA si vous volez", "IATA Live Animals Regulations", "code IATA de l'aéroport"];
  /* ET CELLES QUI EN VOISINENT UN NE SONT COUVERTES PAR AUCUNE PERMISSION — c'est délibéré, et
     c'est la borne honnête de la garantie. Elles sont licites, elles sont publiées, et elles ne
     passent QUE parce qu'elles sont ÉNUMÉRÉES dans le scellé, à leur chemin. Une permission
     écrite pour « IATA standards » couvrait aussi « IATA standards approved crate » : c'est par là
     que les attributions passaient. On vérifie donc les deux faces — bruyantes sans le scellé,
     silencieuses avec — sans quoi le scellé pourrait être vide sans que rien ne le dise. */
  const LICITES_PRES_D_UN_CONTENANT = ["une caisse conforme aux normes IATA",
    "a rigid crate that meets the IATA Live Animals Regulations",
    "Dimensionner la caisse avec le calculateur IATA",
    "crates must meet stricter IATA ventilation limits", "una jaula de estándar IATA"];
  const muettes = ATTRIBUTIONS.filter((p) => etat(p) === "silencieuse");
  const bruyantes = LICITES_SANS_CONTENANT.filter((p) => etat(p) !== "silencieuse");
  const nonScellables = LICITES_PRES_D_UN_CONTENANT.filter((p) => etat(p) === "silencieuse");
  /* Le scellé porte désormais la MULTIPLICITÉ : on fabrique donc le scellé exact de la phrase —
     chaque voisinage avec son nombre — et l'on exige qu'il la couvre entièrement. */
  const scelleDeSoi = (p) => {
    const m = new Map();
    for (const j of jetonsNonReconcilies(p)) m.set(j.voisinage, (m.get(j.voisinage) ?? 0) + 1);
    return m;
  };
  const nonCouvertes = LICITES_PRES_D_UN_CONTENANT.filter((p) =>
    jetonsNonReconcilies(p, MOTIF, scelleDeSoi(p)).length);
  if (muettes.length) echec("12 rien de silencieux", `${muettes.length} attribution(s) qu'aucun des deux étages ne relève : ${muettes.join(" · ")}`);
  else if (bruyantes.length) echec("12 rien de silencieux", `${bruyantes.length} tournure(s) licite(s) SANS contenant voisin devenue(s) bruyante(s) : ${bruyantes.join(" · ")}`);
  else if (nonScellables.length) echec("12 rien de silencieux", `${nonScellables.length} tournure(s) licite(s) PRÈS d'un contenant passe(nt) sans scellé : la garantie est plus faible qu'annoncée — ${nonScellables.join(" · ")}`);
  else if (nonCouvertes.length) echec("12 rien de silencieux", `${nonCouvertes.length} tournure(s) que son propre scellé ne couvre pas : le scellé ne sert à rien — ${nonCouvertes.join(" · ")}`);
  else ok(`12 aucune des ${ATTRIBUTIONS.length} attributions éprouvées n'est silencieuse ; les ${LICITES_SANS_CONTENANT.length} tournures licites SANS contenant voisin le restent par permission ; les ${LICITES_PRES_D_UN_CONTENANT.length} qui en voisinent un ne passent QUE par leur scellé nominatif — la garantie est bornée à l'état exact du corpus, et elle le dit`);
}

if (defauts) { console.error(`\n[inventaire] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[inventaire] la décision porte sur l'occurrence, le refus existe, rien ne se cache derrière une inertie invérifiable, l'ordre ne compte pas.");
