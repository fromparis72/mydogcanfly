#!/usr/bin/env node
/**
 * L'INVENTAIRE DES PREUVES — 102 compagnies × cabine / soute / fret = 306 lignes.
 *
 *   node packages/knowledge/scripts/inventaire-preuves.mjs        (npm run inventaire:preuves)
 *   → écrit mesures/preuves/inventaire-compagnies.json et affiche le résumé.
 *
 * CE QUE C'EST. Un REGISTRE REJOUABLE : pour chaque compagnie et chaque canal, la meilleure piste
 * de preuve que le dépôt possède aujourd'hui, classée, avec les signaux qui disent par où
 * commencer l'enquête. Il se recalcule à l'identique depuis `raw/objects.json` et
 * `raw/rules.json` (aucun horodatage dans le fichier : deux exécutions sur les mêmes données
 * produisent le même octet, et `test-inventaire-preuves.mjs` l'exige). Il répond à la
 * contre-revue du 08/09/2026 : « le résultat doit être un registre rejouable, pas un commentaire ».
 *
 * CE QUE CE N'EST PAS. Jamais une source de vérité pour DÉCIDER. Aucun moteur, aucune page, aucun
 * outil ne doit lire ce fichier pour produire un verdict : la seule frontière de confiance qui
 * décide est `niveauDePreuve` / `projectPlacementPolicy` (packages/knowledge/src/objects.ts). Le
 * registre est un instrument de MESURE et de PRIORISATION du travail de sourçage ; ses signaux
 * de priorité (`availability`, `derived_from_fiche`, `source_derived`, `review_state`, taille de
 * l'historique, règles du canal, hôte de l'URL) servent à choisir QUOI enquêter d'abord, pas à
 * juger de ce qui est vrai.
 *
 * LES CATÉGORIES (définies par la contre-revue) :
 *   A             citation officielle directe exploitable — les CINQ champs : `source.quote`
 *                 (≥ 10 caractères), `quote_language`, `locator`, une URL officielle (jamais
 *                 mydogcanfly.com, jamais fabriquée par l'ingestion) et `verified_date`. Une
 *                 règle de rules.json portant ces cinq champs sur le canal vaut aussi A.
 *   A_incomplete  une citation existe (politique ou règle du canal) mais l'un des cinq manque ;
 *                 la ligne porte `manques` qui dit lesquels.
 *   B             une URL officielle RÉELLE existe, sans citation — soit sur la politique, soit
 *                 sur une règle du canal (`piste` le dit) ; `hotes` permet de voir si cette URL
 *                 est celle de la compagnie ou celle d'un tiers officiel (gov.uk).
 *   C             donnée historique / auto-citation : aucune URL officielle réelle, mais une
 *                 valeur héritée (availability, review_state, derived_from_fiche…) ou une règle
 *                 qui ne cite que nous.
 *   D             aucune piste : ni politique, ni règle sur le canal.
 *
 * LA DÉCISION SUR LES 257 URL FABRIQUÉES. 257 politiques portent `source_derived: true` avec pour
 * URL la page d'accueil de la compagnie, posée par l'ingestion et jamais lue. `niveauDePreuve`
 * les range déjà en « aucune » (« source_derived ⇒ aucune »). Le registre suit cette règle : une
 * URL fabriquée n'est JAMAIS une « URL officielle existante » au sens de B, elle est un signal
 * (`url_fabriquee: true`) et la ligne va en C — sauf si une RÈGLE du canal porte, elle, une URL
 * officielle réelle, auquel cas la ligne va en B par la règle. Mesuré le 08/09/2026 : 82 des 257
 * vont en B par une règle, 175 en C.
 *
 * COHÉRENCE AVEC `niveauDePreuve`. Chaque ligne porte `niveau_de_preuve_politique`, calculé par
 * une REPRODUCTION en Node pur de la fonction TypeScript (mêmes cinq conditions, même ordre) ;
 * le résumé compte les paires (catégorie, niveau) et nomme les écarts. Les seuls écarts
 * attendus : B par règle sur une politique « aucune » (la piste est la règle, pas la politique),
 * et les 4 canaux sans politique.
 *
 * Ce que ce script N'INVENTE PAS : il ne lit aucune page, ne juge aucune citation, n'attribue
 * pas de canal à une règle qui n'en déclare pas (`regles_sans_canal` les liste).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CANAUX = ["cabin", "hold", "cargo"];
export const CATEGORIES = ["A", "A_incomplete", "B", "C", "D"];
/** Repris de `FACTUAL_SOURCE_TYPES` (packages/knowledge/src/common.ts). */
export const TYPES_FACTUELS = ["official_website", "regulation", "government", "airline_contact"];
/** Repris de `FORBIDDEN_SOURCE_DOMAINS` (common.ts) : nous, sous-domaines compris. */
export const DOMAINES_INTERDITS = ["mydogcanfly.com"];
export const LONGUEUR_MIN_CITATION = 10;
export const CHEMIN_REGISTRE = "mesures/preuves/inventaire-compagnies.json";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function hoteDe(url) {
  try { return new URL(String(url)).hostname.toLowerCase().replace(/\.+$/, "").replace(/^www\./, ""); }
  catch { return null; }
}

/** Reproduction de `isForbiddenSource` : une URL illisible n'est pas une auto-citation. */
export function estAutoCitation(url) {
  if (!url) return false;
  let host;
  try { host = new URL(String(url)).hostname.toLowerCase().replace(/\.+$/, ""); } catch { return false; }
  return DOMAINES_INTERDITS.some((d) => host === d || host.endsWith("." + d));
}

/** Une URL officielle utilisable : http(s), type factuel, jamais la nôtre. */
export function estOfficielleUtilisable(s) {
  if (!s?.url || !TYPES_FACTUELS.includes(s.source_type)) return false;
  if (estAutoCitation(s.url)) return false;
  try { return /^https?:$/.test(new URL(s.url).protocol); } catch { return false; }
}

/**
 * REPRODUCTION de `niveauDePreuve` (objects.ts) en Node pur — mêmes conditions, même ordre.
 * `test-inventaire-preuves.mjs` vérifie que le texte TypeScript porte toujours ces conditions.
 */
export function niveauDePreuveReproduit(p) {
  const s = p?.source;
  if (!s) return "aucune";
  if (p?.source_derived) return "aucune";
  if (estAutoCitation(s.url)) return "aucune";
  if (!TYPES_FACTUELS.includes(s.source_type)) return "aucune";
  try { if (!/^https?:$/.test(new URL(s.url).protocol)) return "aucune"; } catch { return "aucune"; }
  const citee = typeof s.quote === "string" && s.quote.length >= LONGUEUR_MIN_CITATION
    && typeof s.quote_language === "string" && s.quote_language.length > 0
    && typeof s.locator === "string" && s.locator.length > 0;
  return citee ? "citee" : "officielle_non_citee";
}

/** Une citation est PRÉSENTE dès qu'un `quote` non vide existe — même trop court : c'est un signal. */
export const citationPresente = (s) => typeof s?.quote === "string" && s.quote.trim().length > 0;

/**
 * Les CINQ champs de A, et ce qui manque. `source_derived` disqualifie l'URL : une page d'accueil
 * posée par l'ingestion n'est pas « l'URL officielle » de la citation.
 */
export function manquesDeCitation(s, { source_derived = false } = {}) {
  const manques = [];
  if (!(typeof s?.quote === "string" && s.quote.length >= LONGUEUR_MIN_CITATION)) manques.push("quote<10");
  if (!(typeof s?.quote_language === "string" && s.quote_language.length > 0)) manques.push("quote_language");
  if (!(typeof s?.locator === "string" && s.locator.length > 0)) manques.push("locator");
  if (!estOfficielleUtilisable(s)) manques.push("url_officielle");
  else if (source_derived) manques.push("url_fabriquee");
  if (!(typeof s?.verified_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.verified_date))) manques.push("verified_date");
  return manques;
}

const trier = (xs) => [...xs].sort();

/**
 * CLASSE UNE LIGNE. `politique` est le bloc d'auteur `premium.policy[canal]` (ou undefined),
 * `regles` les règles `scope.type === "airline"` de la compagnie dont `effect.placement`
 * contient le canal. Ordre des tests : A (politique, puis règle) → A_incomplete → B (politique,
 * puis règle) → C → D. Retourne la catégorie, la piste et les signaux de priorité.
 */
export function classerLigne(politique, regles) {
  const s = politique?.source;
  const sd = !!politique?.source_derived;
  const reglesTriees = [...regles].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  /* Parmi les règles officielles, la PISTE préfère la page de la compagnie elle-même
     (official_website, airline_contact) à celle d'un tiers officiel (gov.uk : regulation,
     government) — sans cela l'hôte de B masquait la page compagnie quand les deux existaient.
     Les deux restent listées dans `regles_officielles`. */
  const rangTiers = (r) => (["official_website", "airline_contact"].includes(r.source?.source_type) ? 0 : 1);
  const reglesOfficielles = reglesTriees.filter((r) => estOfficielleUtilisable(r.source))
    .sort((x, y) => rangTiers(x) - rangTiers(y) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const reglesCitees = reglesTriees.filter((r) => citationPresente(r.source));
  const regleA = reglesCitees.find((r) => manquesDeCitation(r.source).length === 0);
  const niveau = politique ? niveauDePreuveReproduit(politique) : null;

  let categorie, piste, manques = [];
  if (politique && citationPresente(s) && manquesDeCitation(s, { source_derived: sd }).length === 0) {
    categorie = "A"; piste = "politique";
  } else if (regleA) {
    categorie = "A"; piste = `regle:${regleA.id}`;
  } else if (politique && citationPresente(s)) {
    categorie = "A_incomplete"; piste = "politique"; manques = manquesDeCitation(s, { source_derived: sd });
  } else if (reglesCitees.length) {
    categorie = "A_incomplete"; piste = `regle:${reglesCitees[0].id}`; manques = manquesDeCitation(reglesCitees[0].source);
  } else if (politique && !sd && estOfficielleUtilisable(s)) {
    categorie = "B"; piste = "politique";
  } else if (reglesOfficielles.length) {
    categorie = "B"; piste = `regle:${reglesOfficielles[0].id}`;
  } else if (politique || reglesTriees.length) {
    categorie = "C"; piste = politique ? "valeur_heritee" : "regle_auto_citee";
  } else {
    categorie = "D"; piste = null;
  }

  const urlPiste = piste === "politique" ? s.url
    : piste?.startsWith("regle:") ? reglesTriees.find((r) => r.id === piste.slice(6)).source.url
    : null;
  return {
    categorie, piste, manques,
    url: urlPiste, hote: urlPiste ? hoteDe(urlPiste) : null,
    verified_date: piste === "politique" ? (s.verified_date ?? null)
      : urlPiste ? (reglesTriees.find((r) => r.id === piste.slice(6)).source.verified_date ?? null) : null,
    niveau_de_preuve_politique: niveau,
    priorite: {
      availability: politique?.availability ?? null,
      derived_from_fiche: !!politique?.derived_from_fiche,
      source_derived: sd,
      review_state: politique?.review_state ?? null,
      history: s?.history?.length ?? 0,
      url_politique: s?.url ?? null,
      hote_politique: s?.url ? hoteDe(s.url) : null,
      url_fabriquee: sd,
      regles: reglesTriees.map((r) => r.id),
      regles_officielles: reglesOfficielles.map((r) => r.id),
      hotes_regles: trier(new Set(reglesTriees.map((r) => hoteDe(r.source?.url)).filter(Boolean))),
    },
  };
}

export function chargerDonnees(racine = RACINE) {
  const objetsTexte = readFileSync(join(racine, "packages/knowledge/raw/objects.json"), "utf8");
  const reglesTexte = readFileSync(join(racine, "packages/knowledge/raw/rules.json"), "utf8");
  const raw = JSON.parse(objetsTexte);
  const objets = Array.isArray(raw) ? raw : Object.values(raw).flat();
  const rj = JSON.parse(reglesTexte);
  const regles = Array.isArray(rj) ? rj : (rj.rules ?? Object.values(rj).flat());
  const empreinte = createHash("sha256").update(objetsTexte).update("\n").update(reglesTexte).digest("hex");
  return { objets, regles, empreinte };
}

/** Construit les lignes, triées par `airline_id` puis canal (cabin, hold, cargo). Déterministe. */
export function construireLignes({ objets, regles }) {
  const compagnies = objets
    .filter((x) => typeof x?.id === "string" && x.id.startsWith("airline_"))
    .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const reglesCompagnie = regles.filter((r) => r?.scope?.type === "airline");
  const lignes = [];
  for (const a of compagnies) {
    for (const canal of CANAUX) {
      const politique = a.premium?.policy?.[canal];
      const regs = reglesCompagnie.filter((r) => r.scope.id === a.id && (r.effect?.placement ?? []).includes(canal));
      const nom = typeof a.name === "string" ? a.name : (a.name?.en ?? a.name?.fr ?? null);
      lignes.push({ airline_id: a.id, name: nom, canal, ...classerLigne(politique, regs) });
    }
  }
  return lignes;
}

const compter = (xs, f) => {
  const m = {};
  for (const x of xs) { const k = f(x); if (k === undefined) continue; m[k] = (m[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
};
const parCategorie = (xs) => Object.fromEntries(CATEGORIES.map((c) => [c, xs.filter((l) => l.categorie === c).length]));

export function resumer(lignes, { objets, regles, empreinte } = {}) {
  const B = lignes.filter((l) => l.categorie === "B");
  const reglesCompagnie = (regles ?? []).filter((r) => r?.scope?.type === "airline");
  const paires = compter(lignes, (l) => `${l.categorie} ↔ ${l.niveau_de_preuve_politique ?? "politique_absente"}`);
  /* Les écarts NOMMÉS entre le registre et `niveauDePreuve` : tout ce qui n'est pas
     A↔citee, B(politique)↔officielle_non_citee, C↔aucune. */
  const ecarts = {
    B_par_regle_sur_politique_aucune: B.filter((l) => l.piste?.startsWith("regle:") && l.niveau_de_preuve_politique === "aucune").length,
    B_par_regle_sans_politique: B.filter((l) => l.piste?.startsWith("regle:") && l.niveau_de_preuve_politique === null).length,
    A_par_regle: lignes.filter((l) => l.categorie === "A" && l.piste?.startsWith("regle:")).length,
    A_incomplete: lignes.filter((l) => l.categorie === "A_incomplete").length,
    D_sans_politique: lignes.filter((l) => l.categorie === "D").length,
    inattendus: lignes.filter((l) => {
      const n = l.niveau_de_preuve_politique;
      if (l.categorie === "A") return l.piste === "politique" ? n !== "citee" : false;
      if (l.categorie === "B") return l.piste === "politique" ? n !== "officielle_non_citee" : (n !== "aucune" && n !== null);
      if (l.categorie === "C") return n !== "aucune";
      if (l.categorie === "D") return n !== null;
      return false;
    }).map((l) => `${l.airline_id}#${l.canal}`),
  };
  return {
    empreinte_donnees_sha256: empreinte ?? null,
    compagnies: new Set(lignes.map((l) => l.airline_id)).size,
    lignes: lignes.length,
    politiques: lignes.filter((l) => l.niveau_de_preuve_politique !== null).length,
    par_categorie: parCategorie(lignes),
    par_canal: Object.fromEntries(CANAUX.map((c) => [c, parCategorie(lignes.filter((l) => l.canal === c))])),
    A: lignes.filter((l) => l.categorie === "A").map((l) => `${l.airline_id}#${l.canal} (${l.piste})`),
    A_incomplete: lignes.filter((l) => l.categorie === "A_incomplete").map((l) => `${l.airline_id}#${l.canal} (${l.piste} ; manque ${l.manques.join(", ")})`),
    D: lignes.filter((l) => l.categorie === "D").map((l) => `${l.airline_id}#${l.canal}`),
    B_par_piste: compter(B, (l) => (l.piste === "politique" ? "politique" : "regle")),
    B_par_regle_gov_uk_seul: B.filter((l) => l.piste?.startsWith("regle:") && l.priorite.regles_officielles.length
      && l.priorite.regles_officielles.every((id) => /(^|\.)gov\.uk$/.test(hoteDe(reglesCompagnie.find((r) => r.id === id)?.source?.url) ?? ""))).length,
    priorite_B: {
      availability: compter(B, (l) => String(l.priorite.availability)),
      derived_from_fiche: compter(B, (l) => String(l.priorite.derived_from_fiche)),
      source_derived: compter(B, (l) => String(l.priorite.source_derived)),
      review_state: compter(B, (l) => String(l.priorite.review_state)),
      history: compter(B, (l) => String(l.priorite.history)),
      hotes: compter(B, (l) => l.hote),
    },
    priorite_C: {
      availability: compter(lignes.filter((l) => l.categorie === "C"), (l) => String(l.priorite.availability)),
      review_state: compter(lignes.filter((l) => l.categorie === "C"), (l) => String(l.priorite.review_state)),
      avec_regles_auto_citees: lignes.filter((l) => l.categorie === "C" && l.priorite.regles.length).length,
    },
    coherence_niveau_de_preuve: { paires, ecarts },
    regles_sans_canal: reglesCompagnie.filter((r) => !Array.isArray(r.effect?.placement) || !r.effect.placement.length).map((r) => r.id).sort(),
  };
}

/** Le registre complet, tel qu'il est écrit. Aucun champ variable : rejouable à l'octet près. */
export function construireRegistre(donnees) {
  const lignes = construireLignes(donnees);
  return { resume: resumer(lignes, donnees), lignes };
}

export const serialiser = (registre) => JSON.stringify(registre, null, 2) + "\n";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const donnees = chargerDonnees(RACINE);
  const registre = construireRegistre(donnees);
  const sortie = join(RACINE, CHEMIN_REGISTRE);
  mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, serialiser(registre));
  const { resume } = registre;
  console.log(`Inventaire des preuves — ${new Date().toISOString().slice(0, 10)} — écrit dans ${CHEMIN_REGISTRE}`);
  console.log(`${resume.compagnies} compagnies × ${CANAUX.length} canaux = ${resume.lignes} lignes ; ${resume.politiques} politiques`);
  console.log("par catégorie :", JSON.stringify(resume.par_categorie));
  for (const c of CANAUX) console.log(`  ${c.padEnd(5)} :`, JSON.stringify(resume.par_canal[c]));
  console.log("A :", resume.A.join(" ; ") || "—");
  console.log("A_incomplete :", resume.A_incomplete.join(" ; ") || "—");
  console.log("D :", resume.D.join(" ; ") || "—");
  console.log("B par piste :", JSON.stringify(resume.B_par_piste), "— dont gov.uk seul :", resume.B_par_regle_gov_uk_seul);
  console.log("priorité parmi B :", JSON.stringify(resume.priorite_B));
  console.log("priorité parmi C :", JSON.stringify(resume.priorite_C));
  console.log("cohérence avec niveauDePreuve :", JSON.stringify(resume.coherence_niveau_de_preuve));
  console.log("règles sans canal :", resume.regles_sans_canal.join(", ") || "—");
}
