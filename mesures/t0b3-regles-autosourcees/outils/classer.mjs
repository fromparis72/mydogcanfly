/**
 * T0-B3 · outil 2 — la CLASSIFICATION FERMÉE des 171 règles auto-citées.
 *
 *   node --import tsx mesures/t0b3-regles-autosourcees/outils/classer.mjs
 *   → mesures/t0b3-regles-autosourcees/classification.json
 *
 * ─── CE QUE « SOURCE OFFICIELLE CONFIRMANTE » VEUT DIRE ICI ────────────────────────────────────
 *
 * Ce dossier n'ouvre AUCUNE page web. Il ne peut donc pas dire « la source officielle confirme la
 * règle » au sens où un humain l'entendrait. Il dit exactement ceci, et rien de plus :
 *
 *   « Le référentiel contient, pour la même entité et sur le même FAIT, une politique dont la
 *     source passe `preuveAuditee` — donc non auto-citée, non dérivée de la fiche, non marquée
 *     "non revérifiée" — et cette politique dit la même chose que la règle. »
 *
 * C'est une CONFRONTATION INTERNE. Elle ne remplace pas la revérification en ligne ; elle dit
 * seulement quelles règles pourraient être adossées à autre chose qu'elles-mêmes, et lesquelles
 * ne le peuvent pas. Croire l'inverse reproduirait le défaut que ce lot mesure : présenter une
 * dérivation de soi comme une preuve extérieure.
 *
 * ─── LES CINQ CLASSES, DISJOINTES, DANS L'ORDRE DE PRÉCÉDENCE ─────────────────────────────────
 *
 *   1. non_revue                  la politique qui couvre le fait est explicitement « non
 *                                 revérifiée » (legacy_unreviewed). Aucun jugement n'est possible
 *                                 dans un sens ni dans l'autre — c'est un état, pas un manque.
 *   2. officielle_contradictoire  une preuve auditée couvre le fait et DIT AUTRE CHOSE que la
 *                                 règle. Le cas le plus grave : le site publie deux vérités.
 *   3. officielle_confirmante     une preuve auditée couvre le fait et dit la même chose.
 *   4. auto_citation_seule        l'entité possède au moins une preuve auditée, mais AUCUNE ne
 *                                 couvre ce fait-là. La règle ne repose que sur elle-même.
 *   5. officielle_indisponible    l'entité ne possède AUCUNE preuve auditée, nulle part.
 *
 * Les classes 4 et 5 sont mutuellement exclusives par construction ; l'ordre entre elles est donc
 * sans effet. L'ordre compte pour 1 → 2 → 3 : un fait « non revérifié » ne doit jamais être compté
 * comme confirmé, et une contradiction ne doit jamais être noyée dans une confirmation partielle.
 */
import { loadKB, preuveAuditee } from "../../../packages/knowledge/src/index.ts";
import {
  chargerReferentiel, indexerEntites, estAutoCitee, trierRegles, ecrireJson, estAutoCiteeUrl,
} from "./lib-regles.mjs";

const SORTIE = "mesures/t0b3-regles-autosourcees/classification.json";

const { sceau, regles, objets } = chargerReferentiel();
const entites = indexerEntites(objets);
const kb = loadKB();

/** Les placements qu'une règle concerne réellement. `effect.placement` fait foi quand il existe ;
 *  sinon la catégorie le dit sans ambiguïté (une règle `cabin_weight` parle de la cabine). */
function placementsConcernes(r) {
  if (r.effect.placement?.length) return [...r.effect.placement];
  if (r.category === "cabin_weight") return ["cabin"];
  if (r.category === "hold_weight") return ["hold"];
  return [];
}

/** La politique canonique d'un placement, telle que le moteur la lit. */
function politique(airlineId, placement) {
  const a = kb.airlines?.get?.(airlineId);
  return a?.premium?.policy?.[placement] ?? null;
}

const NON_REVUE = (p) => p?.review_state === "legacy_unreviewed" || p?.status_cause === "legacy_unreviewed";

/**
 * Confronte une règle à UNE politique, sur le fait que la règle affirme.
 * Renvoie "confirme" | "contredit" | "muette" — « muette » quand la politique ne dit rien de ce
 * fait précis, ce qui est le cas le plus fréquent et ne doit surtout pas être lu comme un accord.
 */
function confronter(r, p) {
  if (!p) return { verdict: "muette", detail: "aucune politique pour ce placement" };

  if (r.category === "breed_ban") {
    if (p.brachy_allowed === undefined) return { verdict: "muette", detail: "brachy_allowed absent" };
    /* La règle interdit ; la politique confirme si elle interdit aussi. */
    const regleInterdit = r.effect.action === "deny";
    const politiqueInterdit = p.brachy_allowed === false;
    return regleInterdit === politiqueInterdit
      ? { verdict: "confirme", detail: `brachy_allowed=${p.brachy_allowed}` }
      : { verdict: "contredit", detail: `règle ${r.effect.action} vs brachy_allowed=${p.brachy_allowed}` };
  }

  if (r.category === "cabin_weight" || r.category === "hold_weight") {
    const seuilRegle = r.params?.max_weight_kg;
    if (seuilRegle === undefined) return { verdict: "muette", detail: "la règle ne publie pas de seuil" };
    if (p.max_weight_kg === undefined) return { verdict: "muette", detail: "max_weight_kg absent de la politique" };
    return p.max_weight_kg === seuilRegle
      ? { verdict: "confirme", detail: `seuil ${seuilRegle} kg des deux côtés` }
      : { verdict: "contredit", detail: `règle ${seuilRegle} kg vs politique ${p.max_weight_kg} kg` };
  }

  if (r.category === "placement") {
    if (p.status === undefined) return { verdict: "muette", detail: "statut canonique absent" };
    const regleInterdit = r.effect.action === "deny";
    if (p.status === "denied") {
      return regleInterdit
        ? { verdict: "confirme", detail: "status=denied" }
        : { verdict: "contredit", detail: `règle ${r.effect.action} vs status=denied` };
    }
    if (p.status === "allowed") {
      return regleInterdit
        ? { verdict: "contredit", detail: "règle deny vs status=allowed" }
        : { verdict: "confirme", detail: "status=allowed" };
    }
    /* confirmation_required : la politique ne tranche pas — elle ne peut donc rien confirmer. */
    return { verdict: "muette", detail: `status=${p.status}` };
  }

  /* import_rules : porté par un pays, traité hors de cette fonction (pas de politique de placement). */
  return { verdict: "muette", detail: `catégorie ${r.category} sans politique de placement` };
}

/** L'entité possède-t-elle AU MOINS une preuve auditée, où que ce soit ? */
function entitePossedePreuve(r) {
  if (r.scope.type === "country") {
    const c = entites.get(r.scope.id)?.obj;
    const s = c?.source;
    return !!(s && !estAutoCiteeUrl(s.url) && s.source_type !== "other");
  }
  const a = kb.airlines?.get?.(r.scope.id);
  const pol = a?.premium?.policy ?? {};
  return ["cabin", "hold", "cargo"].some((p) => preuveAuditee(pol[p]) !== null);
}

const classes = {
  non_revue: [], officielle_contradictoire: [], officielle_confirmante: [],
  auto_citation_seule: [], officielle_indisponible: [],
};

const detail = [];
for (const r of regles.filter(estAutoCitee).sort(trierRegles)) {
  const placements = placementsConcernes(r);
  const examens = [];
  let classe = null;

  if (r.scope.type === "airline") {
    for (const pl of placements) {
      const p = politique(r.scope.id, pl);
      const auditee = p ? preuveAuditee(p) : null;
      examens.push({
        placement: pl,
        politique_presente: !!p,
        non_revue: NON_REVUE(p),
        preuve_auditee: auditee ? auditee.url : null,
        confrontation: auditee ? confronter(r, p) : { verdict: "sans_preuve", detail: p ? "source non auditée" : "politique absente" },
      });
    }
    /* Précédence : « non revérifié » d'abord, contradiction ensuite, confirmation en dernier. */
    if (examens.some((e) => e.non_revue)) classe = "non_revue";
    else if (examens.some((e) => e.confrontation.verdict === "contredit")) classe = "officielle_contradictoire";
    else if (examens.some((e) => e.confrontation.verdict === "confirme")) classe = "officielle_confirmante";
  }

  if (!classe) classe = entitePossedePreuve(r) ? "auto_citation_seule" : "officielle_indisponible";

  classes[classe].push(r.id);
  detail.push({
    id: r.id, categorie: r.category, criticite: r.criticality,
    portee: { type: r.scope.type, id: r.scope.id ?? null, nom: entites.get(r.scope.id ?? "")?.nom ?? null },
    classe, placements_concernes: placements, examens,
  });
}

/* ---- Contrôles : une classification fermée doit partitionner, pas recouvrir ------------------- */
const anomalies = [];
const totalClasses = Object.values(classes).reduce((s, l) => s + l.length, 0);
if (totalClasses !== detail.length) anomalies.push(`somme des classes ${totalClasses} ≠ ${detail.length} règles`);
const vus = new Set();
for (const [nom, liste] of Object.entries(classes)) {
  for (const id of liste) {
    if (vus.has(id)) anomalies.push(`${id} classé deux fois (dernier : ${nom})`);
    vus.add(id);
  }
}
if (vus.size !== detail.length) anomalies.push(`${detail.length - vus.size} règle(s) non classée(s)`);

const doc = {
  lot: "T0-B3 — mesure des règles auto-sourcées",
  nature: "MESURE — aucune correction, aucune suppression, aucun retrait appliqué",
  sceau,
  definition:
    "Confrontation INTERNE au référentiel. « officielle_confirmante » signifie : une politique de " +
    "la même entité, sur le même fait, dont la source passe preuveAuditee (non auto-citée, non " +
    "dérivée de la fiche, non marquée non revérifiée), dit la même chose. Aucune page web n'a été " +
    "consultée : ce dossier ne remplace pas la revérification en ligne, il dit où elle manque.",
  totaux: Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, v.length])),
  anomalies,
  classes,
  regles: detail,
};
ecrireJson(SORTIE, doc);

console.log(`classification écrite : ${SORTIE}`);
for (const [k, v] of Object.entries(doc.totaux)) console.log(`  ${k.padEnd(28)} ${v}`);
console.log(`  anomalies : ${anomalies.length}`);
for (const a of anomalies.slice(0, 5)) console.log(`    · ${a}`);
