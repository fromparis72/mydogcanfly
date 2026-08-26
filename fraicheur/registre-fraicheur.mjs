/**
 * LOT B — LE REGISTRE EXACT DES SOURCES VIVANTES. Chaque entrée est (famille, locator,
 * objet `Source` canonique complet) ; le tri est déterministe ; les empreintes (globale et
 * par famille) portent le REGISTRE EXACT, jamais de simples agrégats — remplacer une URL
 * sans déplacer aucun compteur rougit (contre-revue du lot B, P0-1 : la garantie acquise
 * par `mesurer-achevement.mjs` est reprise ici, pas affaiblie).
 *
 * PÉRIMÈTRE : les familles d'`objects.json`, `rules.json`, ET — extension EXPLICITE arbitrée
 * en contre-revue — `breed-restrictions.json` (sa source influe sur les réponses publiques
 * concernant les races). Les entrées `history` contractuelles sont des archives, hors
 * registre vivant : l'exclusion est bornée au champ `history` porté par une Source datée,
 * comme dans l'instrument d'achèvement.
 *
 * IDENTITÉ : le locator est un chemin stable (id, sinon empreinte d'URL, `year` joint pour
 * les évènements datés) — la même sémantique que l'instrument d'achèvement. LIMITE ÉCRITE
 * (P1-2, acceptée pour le socle) : une URL déplacée change d'identité — ancienne source
 * DISPARUE + nouvelle source SANS RÉFÉRENCE, jamais une migration silencieuse.
 *
 * L'IDENTITÉ RÉSEAU est distincte : `hacherUrl` sert à télécharger chaque URL UNE seule
 * fois par run et à la rotation sans état — elle ne remplace jamais l'identité des sources
 * par locator (contre-revue, annotation 1).
 *
 * ÉCHEC BRUYANT : registre illisible, vide, source rejetée par le schéma canonique `Source`,
 * ou identité instable — chacun nommé, jamais un zéro silencieux.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Source } from "../packages/knowledge/src/common.ts";

export const VERSION_CONTROLEUR = "fraicheur-1";

export const sha256De = (x) => createHash("sha256").update(x).digest("hex");
export const hacherUrl = (url) => sha256De(String(url));
export function jsonCanonique(x) {
  if (Array.isArray(x)) return "[" + x.map(jsonCanonique).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + jsonCanonique(x[k])).join(",") + "}";
  return JSON.stringify(x);
}

/* ---- classes d'IMPACT UTILISATEUR, possédées par le code ------------------------------------- */
/* A — verdict ou modalité de transport servie au voyageur (règles du moteur, restrictions de
 * race) ; B — compagnie ; C — pays ; D — documentaire. Une règle échue passe toujours devant
 * une documentaire échue. */
export const CLASSE_IMPACT = {
  rules: "A", breed_restrictions: "A",
  airlines: "B",
  countries: "C",
  airports: "D", breeds: "D", partners: "D",
};
export const ORDRE_IMPACT = { A: 0, B: 1, C: 2, D: 3 };

/* ---- énumération (sémantique de l'instrument d'achèvement) ----------------------------------- */
const empreinteCourte = (s) => "h:" + sha256De(String(s)).slice(0, 12);
const urlDe = (v) => (v && typeof v === "object")
  ? (typeof v.url === "string" ? v.url : (v.source && typeof v.source.url === "string" ? v.source.url : null))
  : null;
const cleDe = (v) => {
  if (v && typeof v === "object" && typeof v.id === "string") return v.id;
  const u = urlDe(v);
  if (u === null) return null;
  return typeof v.year === "number" ? empreinteCourte(`${u}#${v.year}`) : empreinteCourte(u);
};

function sourcesDatees(x, chemin, dansHistory, instables) {
  if (Array.isArray(x)) {
    const resultats = [];
    const vues = new Set();
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      let cle = cleDe(v);
      const instable = cle === null || vues.has(cle);
      if (instable) cle = String(i);
      vues.add(cle);
      const sous = sourcesDatees(v, `${chemin}[${cle}]`, dansHistory, instables);
      if (instable && sous.length) instables.push(`${chemin}[${cle}]`);
      resultats.push(...sous);
    }
    return resultats;
  }
  if (x && typeof x === "object") {
    const resultats = [];
    if (typeof x.verified_date === "string") resultats.push({ chemin, source: x, dansHistory });
    for (const [k, v] of Object.entries(x)) {
      resultats.push(...sourcesDatees(v, `${chemin}.${k}`, dansHistory || k === "history", instables));
    }
    return resultats;
  }
  return [];
}

/** Lit le registre exact depuis les données versionnées. `racine` = racine du dépôt.
 *  Jette une Error nommée au premier défaut structurel — jamais un registre silencieusement
 *  partiel. */
export function lireRegistre(racine = ".") {
  const lire = (p) => JSON.parse(readFileSync(`${racine}/${p}`, "utf-8"));
  const objets = lire("packages/knowledge/raw/objects.json");
  const familles = [
    ...Object.entries(objets),
    ["rules", lire("packages/knowledge/raw/rules.json")],
    /* extension EXPLICITE (contre-revue) : les restrictions de race influent sur les
     * réponses publiques — leur source entre au registre, nommément. */
    ["breed_restrictions", lire("packages/knowledge/raw/breed-restrictions.json")],
  ];
  const entrees = [];
  const instables = [];
  for (const [famille, contenu] of familles) {
    for (const e of sourcesDatees(contenu, famille, false, instables)) {
      if (e.dansHistory) continue;   // archives contractuelles, hors registre vivant
      const r = Source.safeParse(e.source);
      if (!r.success) {
        throw new Error(`registre — ${e.chemin} : source rejetée par le schéma canonique Source (${r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} : ${i.message}`).join(" · ")})`);
      }
      entrees.push({ famille, locator: e.chemin, source: r.data });
    }
  }
  if (instables.length) {
    throw new Error(`registre — ${instables.length} identité(s) INSTABLE(S) (élément sans id ni URL, ou clé en collision) : ${instables.slice(0, 5).join(" · ")} — une identité qui change au réordonnancement ne se surveille pas`);
  }
  if (entrees.length === 0) throw new Error("registre — AUCUNE source vivante : un registre vide est une panne, pas un état du monde");
  entrees.sort((a, b) => (a.famille < b.famille ? -1 : a.famille > b.famille ? 1 : a.locator < b.locator ? -1 : a.locator > b.locator ? 1 : 0));
  const cles = new Set();
  for (const e of entrees) {
    const cle = `${e.famille}#${e.locator}`;
    if (cles.has(cle)) throw new Error(`registre — locator en DOUBLE : ${cle}`);
    cles.add(cle);
  }
  const parFamille = {};
  for (const e of entrees) (parFamille[e.famille] ??= []).push(e);
  const empreintes = {
    globale: sha256De(jsonCanonique(entrees)),
    par_famille: Object.fromEntries(Object.entries(parFamille).map(([f, l]) => [f, sha256De(jsonCanonique(l))])),
  };
  /* le regroupement RÉSEAU : une URL, tous ses locators — une URL n'est téléchargée qu'une
   * fois par run, son résultat est distribué (P1-1). */
  const parUrl = new Map();
  for (const e of entrees) {
    if (!parUrl.has(e.source.url)) parUrl.set(e.source.url, []);
    parUrl.get(e.source.url).push(e);
  }
  return { entrees, empreintes, parFamille, parUrl };
}

/** Comparaison SYMÉTRIQUE de deux registres : toute entrée ajoutée, supprimée ou modifiée
 *  est nommée (famille + locator) — aucun agrégat ne masque un remplacement. */
export function comparerRegistres(avant, apres) {
  const par = (r) => new Map(r.entrees.map((e) => [`${e.famille}#${e.locator}`, e]));
  const a = par(avant), b = par(apres);
  const ecarts = [];
  for (const [cle, e] of a) {
    if (!b.has(cle)) ecarts.push({ type: "supprimee", famille: e.famille, locator: e.locator });
    else if (jsonCanonique(e.source) !== jsonCanonique(b.get(cle).source)) {
      ecarts.push({ type: "modifiee", famille: e.famille, locator: e.locator });
    }
  }
  for (const [cle, e] of b) {
    if (!a.has(cle)) ecarts.push({ type: "ajoutee", famille: e.famille, locator: e.locator });
  }
  return ecarts;
}

/* ---- rotation SANS ÉTAT (P0-2 de la contre-revue v3) ----------------------------------------- */
/* SHA256(url) mod 8, confronté au numéro de semaine ISO modulo 8 : couverture maximale de
 * 56 jours, AUCUNE dépendance à un curseur ou à un artefact antérieur. */
export const N_TRANCHES = 8;
export function semaineISO(dateISO) {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));   // le jeudi de la semaine ISO
  const an1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - an1) / 86400000 + 1) / 7);
}
/* ÉCART ARGUMENTÉ vis-à-vis de la prescription « semaine ISO mod 8 » : au passage d'année
 * (semaine 53 → semaine 1), trois tranches sautent leur tour et la couverture s'étire
 * au-delà des 56 jours promis. Le numéro de SEMAINE CONTINUE (depuis le lundi 1970-01-05)
 * est tout aussi sans état et déterministe, et garantit la borne de 56 jours toute l'année. */
export function semaineContinue(dateISO) {
  return Math.floor((new Date(dateISO + "T00:00:00Z") - Date.UTC(1970, 0, 5)) / (7 * 86400000));
}
export const trancheDe = (url) => parseInt(hacherUrl(url).slice(0, 8), 16) % N_TRANCHES;
export const dansLaTranche = (url, dateISO) => trancheDe(url) === (semaineContinue(dateISO) % N_TRANCHES);

/* ---- échéance (axe TEMPOREL, indépendant de l'axe de contrôle réseau) ------------------------ */
export const SEUIL_BIENTOT_JOURS = 45;
export function etatEcheance(reviewDue, dateISO) {
  const ecart = Math.floor((new Date(reviewDue + "T00:00:00Z") - new Date(dateISO + "T00:00:00Z")) / 86400000);
  if (ecart < 0) return "echue";
  if (ecart <= SEUIL_BIENTOT_JOURS) return "bientot_a_revoir";
  return "a_jour";
}
