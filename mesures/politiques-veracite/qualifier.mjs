/**
 * QUALIFIER UN LIEN OFFICIEL POUR UNE DÉCISION PUBLIÉE — un seul endroit, une seule définition.
 *
 * CE QUE CE FICHIER CORRIGE (contre-revue Codex, P0-1). Ma mesure précédente appariait une règle
 * à une politique sur DEUX critères — même compagnie, canal présent dans `effect.placement` — et
 * en tirait « 60 décisions corroborées ». Elle ne regardait ni l'ACTION de la règle ni sa PORTÉE.
 * Conséquence mesurée : 32 politiques `offered` réputées soutenues par des règles `deny`, et des
 * refus globaux appuyés sur une interdiction limitée au Royaume-Uni. Une restriction
 * conditionnelle ne prouve ni une acceptation générale ni un refus général.
 *
 * LE FAIT QUI TRANCHE : les 208 règles de portée compagnie sont TOUTES des `deny`. Aucune règle
 * de ce jeu de données ne peut donc soutenir une politique `offered` — non pas « rarement », mais
 * jamais, structurellement. La moitié `offered` de mes 60 était impossible par construction.
 *
 * TROIS ENSEMBLES, ET UN SEUL EST UTILISABLE POUR ACCOMPAGNER UN VERDICT :
 *   1. refus global soutenu par un `deny` portant EXCLUSIVEMENT sur le canal ;
 *   2. restriction conditionnelle — poids, destination, saison — utilisable dans sa portée seule ;
 *   3. simple page officielle associée, ne soutenant aucun verdict.
 *
 * ET UNE RÈGLE DE PRUDENCE : en cas d'ambiguïté — deux URL différentes également qualifiées — on
 * n'injecte RIEN. Choisir silencieusement, c'est fabriquer une preuve.
 */

/** Types de source admis pour accompagner un fait métier — repris de `FACTUAL_SOURCE_TYPES`. */
export const TYPES_FACTUELS = ["official_website", "regulation", "government", "airline_contact"];
const AUTO_CITATION = /(^|\.)mydogcanfly\.com$/i;

export function estAutoCitation(url) {
  try { return AUTO_CITATION.test(new URL(String(url)).hostname); } catch { return false; }
}

/** Une source utilisable : officielle, factuelle, http(s), jamais la nôtre. */
export function estOfficielleUtilisable(s) {
  if (!s?.url || !TYPES_FACTUELS.includes(s.source_type)) return false;
  if (estAutoCitation(s.url)) return false;
  try { return /^https?:$/.test(new URL(s.url).protocol); } catch { return false; }
}

/** Les feuilles `placement` de la condition, et la pureté de celle-ci. Copie unique du prédicat. */
function feuillesDePlacement(noeud, out = { feuilles: [], pur: true }) {
  if (Array.isArray(noeud)) { for (const n of noeud) feuillesDePlacement(n, out); return out; }
  if (!noeud || typeof noeud !== "object") return out;
  if ("fact" in noeud) {
    if (noeud.fact !== "placement" || !["eq", "in"].includes(noeud.op)) out.pur = false;
    else out.feuilles.push(...(Array.isArray(noeud.value) ? noeud.value : [noeud.value]));
    return out;
  }
  for (const [k, v] of Object.entries(noeud)) {
    if (["all", "any", "or"].includes(k)) feuillesDePlacement(v, out);
    else out.pur = false;
  }
  return out;
}

/** La règle interdit-elle CE canal sans aucune autre condition ? */
export function refuseLeCanalSansCondition(r, canal) {
  if (r?.effect?.action !== "deny") return false;
  if (!(r.effect?.placement ?? []).includes(canal)) return false;
  const aw = r.applies_when ?? {};
  if (!Object.keys(aw).length) return false;
  const { feuilles, pur } = feuillesDePlacement(aw);
  return pur && feuilles.length > 0 && feuilles.includes(canal);
}

/** La règle parle-t-elle de ce canal, mais sous condition ? */
export function restreintLeCanalSousCondition(r, canal) {
  if (r?.effect?.action !== "deny") return false;
  if (!(r.effect?.placement ?? []).includes(canal)) return false;
  return !refuseLeCanalSansCondition(r, canal);
}

/**
 * Qualifie une décision publiée. Retourne l'ensemble, et la source SEULEMENT pour l'ensemble 1
 * non ambigu — c'est la seule qui a le droit d'être écrite dans une fiche.
 */
export function qualifier(politique, canal, reglesDeLaCompagnie = []) {
  const dispo = politique?.availability;
  if (dispo !== "offered" && dispo !== "not_offered") return { ensemble: 0, source: null, raison: "non décidée" };

  const surLeCanal = reglesDeLaCompagnie.filter((r) => (r.effect?.placement ?? []).includes(canal));

  /* Une acceptation générale ne peut être soutenue par AUCUNE règle de ce jeu : toutes refusent. */
  if (dispo === "offered") {
    return {
      ensemble: 3, source: null,
      raison: surLeCanal.length ? "seules des règles `deny` existent — elles ne soutiennent pas une acceptation" : "aucune règle sur ce canal",
    };
  }

  const inconditionnelles = surLeCanal.filter((r) => refuseLeCanalSansCondition(r, canal) && estOfficielleUtilisable(r.source));
  if (inconditionnelles.length) {
    const urls = [...new Set(inconditionnelles.map((r) => r.source.url))];
    if (urls.length > 1) {
      return { ensemble: 1, source: null, raison: `ambigu : ${urls.length} URL officielles différentes — aucune n'est choisie` };
    }
    return { ensemble: 1, source: inconditionnelles[0].source, raison: "refus global soutenu par un `deny` portant exclusivement sur le canal" };
  }

  if (surLeCanal.some((r) => restreintLeCanalSousCondition(r, canal))) {
    return { ensemble: 2, source: null, raison: "restriction conditionnelle — utilisable dans sa portée seule, pas pour un refus global" };
  }
  return { ensemble: 3, source: null, raison: "aucune règle inconditionnelle sur ce canal" };
}
