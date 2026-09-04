#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DE LA FAQ DES FICHES RACES.
 *
 *   node --import tsx test-faq-races.mjs              le profil calculé
 *   node --import tsx test-faq-races.mjs --dist=<d>   ajoute le HTML construit
 *
 * Arbitrage du 29/08/2026 : la fiche met en avant les compagnies COMPATIBLES, pas celles qui
 * refusent. Ce qui est gardé ici : la réponse nomme des compagnies réellement présentes dans
 * `bestAirlines` avec leur canal exact ; elle se comprend SEULE — ni « ci-dessus », ni
 * « ci-dessous » ; une politique « à confirmer » n'est jamais présentée comme acceptée ni
 * comptée comme un refus ; et le vocabulaire brachycéphale ne paraît que sur une race qui l'est.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { computeBreedTravel, faqCompagnies } from "./packages/ui/src/lib/breedTravel.ts";
import { loadKB, normalize, rawKB } from "./packages/knowledge/src/index.ts";

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/* LE VOCABULAIRE BRACHYCÉPHALE, DANS LES QUATRE LANGUES ET SYMÉTRIQUE. Première rédaction
   fautive, nommée : elle ignorait « flat-faced », le mot exact de la version anglaise, si bien
   qu'elle ne pouvait rougir qu'en portugais — la seule langue dont le mot y figurait par
   hasard. Une garde asymétrique donne l'illusion d'une couverture quadrilingue. */
const BRACHY = /brachyc|braquic|museau (court|plat)|face plate|hocico chato|cara chata|focinho achatado|focinho curto|snub-nosed|flat-faced/i;
const RENVOIS = /ci-dessous|ci-dessus|below|above|más abajo|mais abaixo|arriba|acima/i;
const LANGUES = ["en", "fr", "es", "pt"];

/* LA GARDE DE LA GARDE. Le vocabulaire ci-dessus doit reconnaître le mot RÉEL de chaque langue,
   lu dans les fichiers de traduction et non retapé ici : c'est exactement ce qui manquait — la
   pastille dit « Flat-faced breed » en anglais et « museau plat » en français, deux formes
   qu'aucune version antérieure du motif ne voyait. */
{
  const aveugles = LANGUES.filter((l) => {
    const badge = JSON.parse(readFileSync(`packages/knowledge/translations/${l}/strings.json`, "utf8"))["breed.brachy_badge"];
    return !badge || !BRACHY.test(badge);
  });
  if (aveugles.length) echec("0 vocabulaire brachycéphale", `le motif ne reconnaît pas la pastille réelle en ${aveugles.join(", ")}`);
  else ok("0 le motif brachycéphale reconnaît la pastille réelle dans les quatre langues");
}

const golden = computeBreedTravel("breed_golden_retriever");
if (!golden) { console.error("[faq-races] le golden retriever est introuvable — rien ne peut être prouvé"); process.exit(1); }

/* ── LA BASE CITÉE, POUR QUE LE CONTRÔLE 1 GARDE UNE MATIÈRE ───────────────────────────────────
 *
 * Depuis la frontière de confiance (04/09/2026), aucune des 302 politiques ne porte de phrase
 * citée : plus aucune n'est `allowed`, et `bestAirlines` — qui, par l'arbitrage du 29/08, exclut
 * les politiques « à confirmer » — est VIDE sur les données réelles, pour toutes les races.
 *
 * DEUX CHOSES SONT VÉRIFIÉES SÉPARÉMENT, ET IL FAUT LES DEUX :
 *   · le MÉCANISME, sur une base où des provenances sont citées — la réponse nomme alors de
 *     vraies compagnies avec leur canal, exactement comme avant (contrôle 1) ;
 *   · l'ÉTAT RÉEL, constaté et FIGÉ tel qu'il est — zéro compagnie compatible aujourd'hui
 *     (contrôle 1 bis). Il n'est pas caché derrière la fixture : il est écrit noir sur blanc, et
 *     il rougira le jour où il changera, dans un sens comme dans l'autre.
 *
 * L'état réel n'est PAS un mensonge : le contrôle 7 établit que la branche vide rend, dans les
 * quatre langues, « aucune compagnie compatible n'est actuellement établie dans les données
 * vérifiées ». La page est honnête ; elle est pauvre. Savoir si elle doit citer les compagnies
 * « à confirmer » revient à rouvrir l'arbitrage du 29/08, et cela ne se tranche pas ici. */
const kbCitee = (() => {
  const brut = JSON.parse(JSON.stringify(rawKB));
  for (const a of brut.airlines ?? []) {
    for (const d of Object.values(a?.premium?.policy ?? {})) {
      if (!d?.source) continue;
      delete d.source_derived;
      d.source.quote = "Pets are accepted on this route, subject to the conditions below.";
      d.source.quote_language = "en";
      d.source.locator = "section « Travelling with pets », paragraphe 1";
    }
  }
  return normalize(brut);
})();
const goldenCite = computeBreedTravel("breed_golden_retriever", kbCitee);
if (!goldenCite) { console.error("[faq-races] profil cité introuvable"); process.exit(1); }

/* ---- 1. La réponse NOMME des compagnies réellement compatibles, avec leur canal ------------- */
{
  const q = goldenCite.faq.find((f) => /generally accept/i.test(f.q.en));
  if (!q) { echec("1 question", "la question « quelles compagnies acceptent » est absente de la FAQ"); }
  else {
    const noms = goldenCite.bestAirlines.map((a) => a.name);
    if (!noms.length) echec("1 matière", "le golden retriever n'a aucune compagnie compatible — le contrôle ne prouverait rien");
    /* Chaque nom cité doit exister dans bestAirlines : une réponse qui nomme une compagnie
       absente de la liste serait une invention, pas une synthèse. */
    for (const lang of LANGUES) {
      const texte = q.a[lang];
      const cites = noms.filter((n) => texte.includes(n));
      if (cites.length < 2) echec("1 noms", `[${lang}] la réponse ne nomme que ${cites.length} compagnie(s) de bestAirlines`);
    }
    /* Le canal annoncé doit être celui des compagnies citées. */
    const canaux = new Set(goldenCite.bestAirlines.slice(0, 4).map((a) => a.channel));
    if (canaux.size === 1) {
      const attendu = { cabin: "en cabine", hold: "en soute", cargo: "en fret" }[[...canaux][0]];
      if (!q.a.fr.includes(attendu)) echec("1 canal", `[fr] le canal « ${attendu} » n'est pas dit alors que les quatre compagnies le partagent`);
    }
    if (defauts === 0) ok(`1 la réponse nomme des compagnies de bestAirlines avec leur canal (${goldenCite.bestAirlines.length} compatibles, canal « ${[...canaux].join("+")} »)`);
  }
}

/* ---- 1 bis. L'ÉTAT RÉEL, constaté et figé — pas caché derrière la fixture ------------------- */
{
  let avecCompagnies = 0, races = 0;
  for (const id of [...loadKB().breeds.keys()]) {
    const p = computeBreedTravel(id);
    if (!p) continue;
    races++;
    if (p.bestAirlines.length) avecCompagnies++;
  }
  if (avecCompagnies !== 0) {
    echec("1 bis état réel", `${avecCompagnies} race(s) sur ${races} ont désormais des compagnies compatibles — `
      + "l'état figé disait 0. Mouvement à nommer : soit une citation vérifiée est entrée (tant mieux), "
      + "soit l'arbitrage du 29/08 a été rouvert.");
  } else {
    ok(`1 bis état réel FIGÉ : 0 race sur ${races} n'a de compagnie compatible — aucune politique n'est `
      + "prouvée, et la page le dit honnêtement (contrôle 7). ARBITRAGE EN ATTENTE.");
  }
}

/* ---- 2. Aucune réponse ne renvoie à un ailleurs -------------------------------------------- */
{
  const fautives = [];
  for (const f of golden.faq) for (const lang of LANGUES) if (RENVOIS.test(f.a[lang])) fautives.push(`[${lang}] ${f.q[lang]?.slice(0, 50)}`);
  if (fautives.length) echec("2 réponse autonome", `${fautives.length} réponse(s) renvoient ailleurs : ${fautives[0]}`);
  else ok(`2 les ${golden.faq.length} réponses se comprennent seules — aucun « ci-dessus » ni « ci-dessous »`);
}

/* ---- 3. Zéro vocabulaire brachycéphale sur une race qui ne l'est pas ------------------------ */
{
  if (golden.brachy) { echec("3 témoin", "le golden retriever est marqué brachycéphale — le contrôle porterait à faux"); }
  else {
    const fuites = [];
    (function marcher(x, chemin = "") {
      if (typeof x === "string") { if (BRACHY.test(x)) fuites.push(`${chemin} : ${x.slice(0, 70)}`); return; }
      if (Array.isArray(x)) return x.forEach((v, i) => marcher(v, `${chemin}[${i}]`));
      if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) marcher(v, chemin ? `${chemin}.${k}` : k);
    })(golden);
    if (fuites.length) for (const f of fuites.slice(0, 4)) echec("3 brachycéphale", f);
    else ok("3 aucune mention brachycéphale dans le profil d'une race qui ne l'est pas");
  }
}

/* ---- 4. Une race brachycéphale garde ses restrictions -------------------------------------- */
{
  const carlin = computeBreedTravel("breed_pug");
  if (!carlin) echec("4 carlin", "le carlin est introuvable");
  else if (!carlin.brachy) echec("4 carlin", "le carlin n'est pas marqué brachycéphale");
  else {
    const texte = JSON.stringify(carlin);
    if (!BRACHY.test(texte)) echec("4 carlin", "aucune mention brachycéphale sur une race qui l'est — la restriction a disparu avec le mot");
    else ok("4 le carlin garde ses restrictions brachycéphales");
  }
}

/* ---- 5. Une politique « à confirmer » n'est ni acceptée, ni refusée ------------------------- */
{
  const kb = loadKB();
  const aConfirmer = [];
  for (const a of kb.airlines.values()) {
    for (const [canal, p] of Object.entries(a.premium?.policy ?? {})) {
      const st = p.status ?? (p.allowed ? "allowed" : "denied");
      if (st === "confirmation_required") aConfirmer.push({ nom: a.name, canal });
    }
  }
  if (!aConfirmer.length) echec("5 matière", "aucune politique « à confirmer » dans la base — le contrôle ne prouverait rien");
  else {
    /* Une compagnie dont TOUS les canaux sont « à confirmer » ne doit pas figurer parmi les
       compatibles : elle n'est ni un oui, ni un non. */
    const toutAConfirmer = [...kb.airlines.values()].filter((a) => {
      const st = Object.values(a.premium?.policy ?? {}).map((p) => p.status ?? (p.allowed ? "allowed" : "denied"));
      return st.length > 0 && st.every((s) => s === "confirmation_required");
    });
    const noms = new Set(golden.bestAirlines.map((a) => a.name));
    const fautives = toutAConfirmer.filter((a) => noms.has(a.name));
    if (fautives.length) echec("5 à confirmer", `${fautives.map((a) => a.name).join(", ")} figure(nt) parmi les compagnies compatibles alors que tout y est « à confirmer »`);
    else ok(`5 aucune compagnie entièrement « à confirmer » n'est présentée comme acceptée (${aConfirmer.length} politiques à confirmer dans la base)`);
  }
}

/* ---- 6. bestAirlines ne contient AUCUN refus ----------------------------------------------- */
{
  let refus = 0, races = 0;
  for (const id of ["breed_golden_retriever", "breed_pug", "breed_labrador_retriever", "breed_chihuahua"]) {
    const p = computeBreedTravel(id);
    if (!p) continue;
    races++;
    refus += p.bestAirlines.filter((a) => a.channel === "none").length;
  }
  if (!races) echec("6 matière", "aucune race calculée");
  else if (refus) echec("6 refus", `${refus} compagnie(s) refusée(s) figurent encore dans bestAirlines`);
  else ok(`6 sur ${races} races, aucune compagnie refusée ne figure parmi les compatibles`);
}

/* ---- 7. Une race sans compagnie compatible répond honnêtement ------------------------------- */
/* PREMIÈRE RÉDACTION FAUTIVE, NOMMÉE : elle construisait `vide` puis ne s'en servait pas — un
   `void vide;` en fin de bloc —, et jugeait la SOURCE au lieu de l'exécution. Elle serait restée
   verte si la branche vide rendait une phrase fausse. La fonction est désormais exportée et
   RÉELLEMENT APPELÉE, et le bloc suivant la voit rougir si on la mute. */
{
  const vide = faqCompagnies({ ...golden, bestAirlines: [] });
  const ATTENDU = {
    en: "No compatible airline is currently established in our verified data for this breed.",
    fr: "Aucune compagnie compatible n'est actuellement établie dans les données vérifiées.",
    es: "Ninguna aerolínea compatible está actualmente establecida en los datos verificados.",
    pt: "Nenhuma companhia compatível está atualmente estabelecida nos dados verificados.",
  };
  if (vide.length !== 1) echec("7 aucune compagnie", `la FAQ compagnies rend ${vide.length} entrée(s)`);
  else {
    const ecarts = LANGUES.filter((l) => vide[0].a[l] !== ATTENDU[l]);
    if (ecarts.length) echec("7 aucune compagnie", `réponse inattendue en ${ecarts.join(", ")} : ${JSON.stringify(vide[0].a[ecarts[0]])}`);
    else if (LANGUES.some((l) => RENVOIS.test(vide[0].a[l]))) echec("7 aucune compagnie", "la réponse renvoie ailleurs dans la page");
    else ok("7 exécutée sur une liste vide : les quatre réponses exactes, sans renvoi");
  }
}

/* ---- 7 bis. LES CANAUX MIXTES sont dits, pas tus ------------------------------------------- */
/* La première rédaction ne nommait le canal que si les quatre compagnies le partageaient : dès
   qu'elles étaient mixtes, `canal()` rendait "" et la page perdait l'information. */
{
  const mixte = faqCompagnies({
    ...golden,
    bestAirlines: [
      { name: "Alpha", channel: "cabin" }, { name: "Bravo", channel: "cabin" },
      { name: "Charlie", channel: "hold" }, { name: "Delta", channel: "cargo" },
    ],
  });
  const ATTENDU = {
    en: "According to published policies, Alpha and Bravo in the cabin ; Charlie in the hold ; Delta as cargo.",
    fr: "Selon les politiques publiées, Alpha et Bravo en cabine ; Charlie en soute ; Delta en fret.",
    es: "Según las políticas publicadas, Alpha y Bravo en cabina ; Charlie en bodega ; Delta como carga.",
    pt: "Segundo as políticas publicadas, Alpha e Bravo na cabine ; Charlie no porão ; Delta como carga.",
  };
  const ecarts = LANGUES.filter((l) => !mixte[0].a[l].startsWith(ATTENDU[l]));
  if (ecarts.length) echec("7bis canaux mixtes", `en ${ecarts.join(", ")} : ${JSON.stringify(mixte[0].a[ecarts[0]])}`);
  else ok("7bis quatre compagnies sur trois canaux : chaque groupe nomme le sien");
}

/* ---- 7 ter. LA MÊME FONCTION, VUE RENDRE AUTRE CHOSE ---------------------------------------- */
/* Une contre-épreuve qu'on n'a jamais vue distinguer deux cas ne distingue rien : la réponse
   « aucune compagnie » et la réponse nominative doivent être différentes, et ne pas se
   confondre. */
{
  const vide = faqCompagnies({ ...golden, bestAirlines: [] })[0].a;
  const plein = faqCompagnies({ ...golden, bestAirlines: [{ name: "Alpha", channel: "cabin" }] })[0].a;
  const memes = LANGUES.filter((l) => vide[l] === plein[l]);
  const nomme = LANGUES.every((l) => plein[l].includes("Alpha"));
  if (memes.length) echec("7ter", `la réponse est la même avec et sans compagnie en ${memes.join(", ")}`);
  else if (!nomme) echec("7ter", "la réponse nominative ne nomme pas la compagnie citée");
  else ok("7ter la branche vide et la branche nominative rendent bien deux réponses distinctes");
}

/* ---- 8. LE HTML CONSTRUIT ------------------------------------------------------------------- */
if (DIST) {
  const pages = LANGUES.map((l) => `${l === "en" ? "" : "/" + l}/breeds/golden-retriever/index.html`);
  let vues = 0;
  for (const p of pages) {
    const f = join(DIST, p);
    if (!existsSync(f)) continue;
    vues++;
    const html = readFileSync(f, "utf8");
    /* LE CONTENU DE LA PAGE, PAS SA NAVIGATION. Deuxième faute nommée de ce même contrôle : il
       lisait tout le fichier, donc aussi le sélecteur de races de l'en-tête, où l'Affenpinscher
       et le Boston Terrier portent LÉGITIMEMENT leur pastille museau court. Il rougissait sur
       une navigation correcte, ce qui est un faux positif — et aurait masqué la vraie question,
       qui est ce que la page DIT du golden retriever. */
    const corps = /<main\b[^>]*>[\s\S]*?<\/main>/i.exec(html)?.[0];
    if (!corps) { echec("8 DOM", `${p} : aucun <main> — le contrôle ne saurait pas ce qu'il lit`); continue; }
    if (BRACHY.test(corps)) echec("8 DOM brachycéphale", `${p} porte du vocabulaire brachycéphale sur une race qui ne l'est pas`);
    if (!html.includes('id="compagnies-compatibles"')) echec("8 DOM ancre", `${p} : l'ancre #compagnies-compatibles est absente`);
    /* La réponse de la FAQ, dans le JSON-LD comme dans le texte, ne renvoie nulle part. */
    for (const m of html.matchAll(/"acceptedAnswer":\{"@type":"Answer","text":"([^"]+)"/g)) {
      if (RENVOIS.test(m[1])) echec("8 DOM renvoi", `${p} : une réponse FAQ du JSON-LD renvoie ailleurs — « ${m[1].slice(0, 60)} »`);
    }
  }
  if (!vues) echec("8 DOM", "aucune fiche golden retriever dans le dist");
  else if (defauts === 0) ok(`8 les ${vues} fiches construites : aucune mention brachycéphale, ancre présente, aucune réponse qui renvoie`);

  /* 8 BIS — LA PAGE PORTUGAISE, mot pour mot. Les deux phrases ajoutées au lot manquaient de
     `translations/pt/inline.json` : `inlineT("pt")` repliait sur l'anglais, et la page portugaise
     publiait deux phrases anglaises sans que rien ne le dise. On exige ici le portugais, ET
     l'absence de la version anglaise — sans quoi un repli passerait inaperçu. */
  {
    const f = join(DIST, "/pt/breeds/golden-retriever/index.html");
    if (!existsSync(f)) echec("8bis DOM portugais", "la fiche portugaise est absente du dist");
    else {
      const html = readFileSync(f, "utf8");
      const PAIRES = [
        ["Classificação obtida das políticas publicadas (limites de peso em cabine, disponibilidade de porão e carga).",
         "Ranking derived from published policies (cabin weight limits, hold and cargo availability)"],
        ["Com base na dificuldade global, no peso, nos canais disponíveis e nas políticas publicadas.",
         "Based on overall difficulty, weight, available channels and published policies."],
      ];
      let bon = 0;
      for (const [pt, en] of PAIRES) {
        if (!html.includes(pt)) echec("8bis DOM portugais", `la phrase portugaise est absente : « ${pt.slice(0, 50)}… »`);
        else if (html.includes(en)) echec("8bis DOM portugais", `la version ANGLAISE subsiste sur la page portugaise : « ${en.slice(0, 50)}… »`);
        else bon++;
      }
      if (bon === PAIRES.length) ok("8bis la fiche portugaise porte les deux phrases en portugais, sans repli anglais");
    }
  }
} else {
  console.log("  · 8 contrôle du DOM non joué (aucun --dist=) — il l'est en CI sur le site complet");
}

if (defauts) { console.error(`\n[faq-races] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[faq-races] la fiche met en avant ce qui est possible, la réponse se comprend seule, et le doute n'est ni un oui ni un non.");
