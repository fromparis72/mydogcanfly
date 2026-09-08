// Breed → air-travel decision profile.
// GOLDEN RULE: everything here is DERIVED from existing data (breed facts + airline
// premium.policy + shared climate/crate models). Nothing is fabricated: where a signal
// is unknown we say so ("unknown"/"confirm") rather than inventing a refusal or an approval.
import { loadKB, slugFor } from "@mydogcanfly/knowledge";

export type Tone = "ok" | "warn" | "no" | "crit" | "neutral";
/* `pt` est OBLIGATOIRE : une clé optionnelle aurait laissé passer un oubli en silence,
 * et c'est précisément ce qui s'était produit — 45 libellés restés en anglais sur les
 * 173 pages de races portugaises, sans qu'aucun contrôle ne le dise. */
export interface Bi { en: string; fr: string; es: string; pt: string }
export interface Level extends Bi { tone: Tone }

export interface DnaRow { icon: string; label: Bi; value: Level }
export interface ChannelView {
  level: Level;            // qualitative 5-step verdict
  detail: Bi;             // one honest line explaining the number behind it
  /** Le verdict repose-t-il sur au moins une politique ÉTABLIE ? (05/09/2026)
   *  Les trois verdicts de canal se calculaient sur un dénominateur qui pouvait valoir zéro, et
   *  aucun ne savait le dire : `pct = tot ? yes/tot : 0` rendait 0, donc « Souvent refusé », sur
   *  ZÉRO politique lue ; la cabine, elle, se rabattait sur une limite SUPPOSÉE de 8 kg et
   *  annonçait « Très souvent possible » juste au-dessus d'un détail disant qu'aucune compagnie
   *  ne publie de limite adaptée. Deux affirmations catégoriques tirées d'un vide, sur 172 races
   *  et quatre langues. Ce drapeau est ce vide, nommé. */
  etabli: boolean;
}
export interface AirlineRank {
  name: string; slug: string; tone: Tone; badge: string; // ✅ ⚠ ❌
  reason: Bi; channel: "cabin" | "hold" | "cargo" | "none";
}
export interface SeasonStars { winter: number; spring: number; summer: number; autumn: number }
export interface ClimateBadge { iso2: string; en: string; fr: string; es: string; pt: string }

export interface BreedTravelProfile {
  id: string; slug: string;
  name: string; nameFr: string; nameEs: string; namePt: string;
  size: string; weightKg: number; brachy: boolean; coat?: string;
  difficulty: Level & { emoji: string; score: number; stars: number; etabli: boolean };
  dna: DnaRow[];
  cabin: ChannelView; hold: ChannelView; cargo: ChannelView;
  airlineHeadline: Level;          // "Cargo only", "Accepted by most", ...
  heat: Level; respiratory: Level; cold: Level;
  season: SeasonStars; bestSeason: Bi;
  climates: { recommended: ClimateBadge[]; avoid: ClimateBadge[]; basis: Bi };
  longHaul: Level; embargo: Level;
  prep: Level; experience: Level;
  bestAirlines: AirlineRank[];
  counts: { cabinWithin: number; cabinStated: number; holdYes: number; holdNo: number; cargoYes: number; airlinesTotal: number; brachyHoldBans: number };
  faq: { q: Bi; a: Bi }[];
  source?: { url: string; date: string; confidence: number };
}

const HEAT_EMBARGO_C = 30;
/* LA SÉRIE DE CAISSES A ÉTÉ RETIRÉE D'ICI (02/09/2026), ET CE N'EST PAS UN DÉPLACEMENT.
 *
 * CE QUE LA FICHE DE RACE PUBLIAIT. Un bloc dont le titre attribuait la caisse à l'IATA, donnant
 * « 500 · XL · 94×64×68 cm », calculé à partir du seul POIDS DE LA RACE par une formule
 * allométrique, puis arrondi sur une table 100/200/…/700 écrite en dur — table dupliquée dans
 * `CrateCalculator.astro`, et que le commentaire de ce fichier présentait à tort comme une série
 * réglementaire. Deux affirmations fausses en une : la série 100–700 est une nomenclature de
 * FABRICANT, que l'IATA ne publie pas ; et les dimensions n'étaient sourcées nulle part.
 *
 * POURQUOI RENOMMER N'AURAIT PAS SUFFI. Retirer le mot « IATA » du titre aurait laissé publier
 * une classification commerciale et des dimensions non établies, présentées comme la taille
 * adaptée à la race. L'arbitrage en vigueur est plus exigeant que le vocabulaire : un profil non
 * publiable ne produit AUCUNE estimation publique. Les trois registres canoniques
 * (`packages/knowledge/tarifs/{modeles,profils,caisses-par-race}-caisses.json`) sont vides —
 * mesuré : 0 modèle, 0 profil, 0 correspondance.
 *
 * CE QUI RESTE À L'UTILISATEUR, et qui vaut mieux : le calculateur, qui part de SES mesures.
 * La fiche de race n'affiche plus qu'un lien vers lui.
 *
 * QUAND CELA REVIENDRA : depuis les registres sourcés une fois `publiable: true`, ou depuis les
 * mesures réelles saisies — jamais depuis une table écrite en dur. */
// Region → coarse summer high (°C) — mirrors engine evaluate.ts CLIMATE
const REGION_SUMMER: Record<string, number> = {
  "Middle East": 42, "Africa": 35, "Asia": 34, "Central America": 33,
  "Caribbean": 32, "South America": 32, "Oceania": 32, "North America": 30, "Europe": 28,
};

const L = (en: string, fr: string, es: string, pt: string, tone: Tone): Level => ({ en, fr, es, pt, tone });

/**
 * `kbOverride` n'existe que pour les contre-épreuves, et ne change RIEN en production : sans lui,
 * la fonction charge la base réelle comme elle l'a toujours fait. Il a été ajouté le 04/09/2026
 * parce que la frontière de confiance a vidé `bestAirlines` sur les données réelles — plus aucune
 * politique n'est `allowed` — et que le contrôle « la réponse NOMME des compagnies compatibles »
 * n'avait donc plus de matière à observer. Un témoin qui ne peut plus se déclencher ne prouve
 * rien ; on lui rend son cas par une base citée, plutôt que d'abaisser le contrôle.
 */
export function computeBreedTravel(breedId: string, kbOverride?: unknown): BreedTravelProfile | null {
  const kb: any = kbOverride ?? loadKB();
  const b: any = kb.breeds.get(breedId);
  if (!b) return null;
  const w: number = b.weight_kg;
  const brachy: boolean = !!b.brachycephalic;
  const tr = b.travel || {};
  const heatTol: number = tr.heat_tolerance ?? (brachy ? 1 : b.coat === "double" || b.coat === "thick" ? 2 : 3);
  const coldTol: number = tr.cold_tolerance ?? (b.coat === "double" || b.coat === "thick" || b.coat === "long" ? 5 : b.coat === "short" ? 2 : 3);
  const adapt: number = tr.adaptability ?? 3;
  const sensitivity: number = tr.sensitivity ?? 3;

  // ---- Airline cross-reference (route-agnostic) ----
  let cabinWithin = 0, cabinOver = 0, cabinUnkLimit = 0, cabinNo = 0;
  let holdYes = 0, holdNo = 0, holdUnk = 0, brachyHoldBans = 0;
  let cargoYes = 0, cargoNo = 0, cargoUnk = 0;
  /**
   * LES TROIS ÉTATS D'UNE POLITIQUE, ET POURQUOI LES CONFONDRE EST UNE FAUTE.
   *
   * La base normalisée porte `status` : « allowed », « confirmation_required », « denied ».
   * Ce fichier ne lisait que le booléen `allowed` — or une politique à confirmer porte
   * `allowed: false`. Une compagnie dont la politique demande confirmation était donc comptée
   * comme un REFUS, et pouvait apparaître barrée sur la fiche de race.
   *
   * Un doute n'est pas un non. `statutDu` rend les trois états ; seul « allowed » rend une
   * compagnie éligible, et « confirmation_required » ne compte ni dans les oui ni dans les non.
   */
  const statutDu = (p: any): "allowed" | "confirmation_required" | "denied" | "inconnu" => {
    /* Le quatrième état (08/09/2026) vaut « ouvert » pour cette page : accepté sous conditions. */
    if (p?.status === "accepted_with_conditions") return "allowed";
    if (!p) return "inconnu";
    if (p.status === "allowed" || p.status === "confirmation_required" || p.status === "denied") return p.status;
    if (p.allowed === undefined) return "inconnu";
    return p.allowed ? "allowed" : "denied";
  };
  let holdAConfirmer = 0, cargoAConfirmer = 0, cabinAConfirmer = 0;
  const perAirline: { name: string; slug: string; channel: "cabin" | "hold" | "cargo" | "none"; max?: number; incl?: boolean }[] = [];
  for (const a of kb.airlines.values() as Iterable<any>) {
    const p = a.premium?.policy || {};
    const c = p.cabin, h = p.hold, g = p.cargo;
    // cabin
    let cabinEligible = false, cabinReasonMax: number | undefined, cabinIncl: boolean | undefined;
    const stCabin = statutDu(c);
    if (stCabin === "confirmation_required") cabinAConfirmer++;
    else if (stCabin !== "inconnu") {
      if (stCabin === "denied") cabinNo++;
      else if (c.max_weight_kg == null) { cabinUnkLimit++; if (w <= 8) { cabinEligible = true; } }
      else if (w <= c.max_weight_kg) { cabinWithin++; cabinEligible = true; cabinReasonMax = c.max_weight_kg; cabinIncl = typeof c.weight_includes_carrier === "boolean" ? c.weight_includes_carrier : undefined; }
      else cabinOver++;
    }
    // hold
    let holdEligible = false;
    const stHold = statutDu(h);
    if (stHold === "confirmation_required") holdAConfirmer++;
    else if (stHold === "denied") holdNo++;
    else if (stHold === "allowed") {
      if (brachy && h.brachy_allowed === false) { holdNo++; brachyHoldBans++; }
      else { holdYes++; holdEligible = true; }
    } else holdUnk++;
    // cargo
    let cargoEligible = false;
    const stCargo = statutDu(g);
    if (stCargo === "confirmation_required") cargoAConfirmer++;
    else if (stCargo === "denied") cargoNo++;
    else if (stCargo === "allowed") {
      if (brachy && g.brachy_allowed === false) cargoNo++;
      else { cargoYes++; cargoEligible = true; }
    } else cargoUnk++;
    const channel = cabinEligible ? "cabin" : holdEligible ? "hold" : cargoEligible ? "cargo" : "none";
    perAirline.push({ name: a.name, slug: slugFor(a.id), channel, max: cabinReasonMax, incl: cabinIncl });
  }
  const airlinesTotal = perAirline.length;
  const cabinStated = cabinWithin + cabinOver;

  // ---- Channel verdicts ----
  const cabin = cabinVerdict(w, cabinWithin, cabinStated, cabinUnkLimit);
  const hold = holdVerdict(brachy, holdYes, holdNo, brachyHoldBans);
  const cargo = cargoVerdict(cargoYes, cargoNo, brachy);

  // headline (airline restriction summary)
  const airlineHeadline = headline(cabin, hold, cargo);

  // ---- Physiology-derived indicators ----
  const heat = heatVerdict(heatTol, brachy);
  const respiratory = brachy ? L("High risk", "Risque élevé", "Riesgo alto", "Risco alto", "no") : L("Low risk", "Risque faible", "Riesgo bajo", "Risco baixo", "ok");
  const cold = coldVerdict(coldTol);

  // ---- Season stars (temperate-frame guidance) ----
  const summerS = clamp(heatTol, 1, 5);
  const winterS = clamp(coldTol, 1, 5);
  const midS = clamp(Math.round((heatTol + coldTol) / 2) + 1, 1, brachy ? 3 : 5);
  const season: SeasonStars = { summer: summerS, winter: winterS, spring: midS, autumn: midS };
  const bestKey = (Object.entries({ winter: winterS, spring: midS, autumn: midS, summer: summerS })
    .sort((a, z) => z[1] - a[1])[0][0]) as keyof SeasonStars;
  const bestSeason: Bi = {
    en: { winter: "Winter", spring: "Spring / Autumn", autumn: "Spring / Autumn", summer: "Summer" }[bestKey],
    fr: { winter: "Hiver", spring: "Printemps / Automne", autumn: "Printemps / Automne", summer: "Été" }[bestKey],
    es: { winter: "Invierno", spring: "Primavera / Otoño", autumn: "Primavera / Otoño", summer: "Verano" }[bestKey],
    pt: { winter: "Inverno", spring: "Primavera / Outono", autumn: "Primavera / Outono", summer: "Verão" }[bestKey],
  };

  // ---- Climate recommendations (region-based, honest basis) ----
  const heatSensitive = brachy || heatTol <= 2;
  const climates = climateBadges(kb, heatSensitive, coldTol);

  // ---- Long-haul + embargo ----
  const longHaul = brachy || heatTol <= 1
    ? L("Short flights only", "Vols courts uniquement", "Solo vuelos cortos", "Somente voos curtos", "no")
    : heatTol <= 2 || sensitivity >= 4
      ? L("Short to medium-haul", "Court à moyen-courrier", "Corto a medio recorrido", "Curta a média distância", "warn")
      : L("Up to long-haul", "Jusqu'au long-courrier", "Hasta largo recorrido", "Até longa distância", "ok");
  const embargo = brachy || heatTol <= 2
    ? L("High", "Élevé", "Alto", "Alto", "no")
    : heatTol <= 3
      ? L("Moderate", "Modéré", "Moderado", "Moderado", "warn")
      : L("Low", "Faible", "Bajo", "Baixo", "ok");

  // ---- Prep + experience ----
  const prep = brachy ? L("Complex", "Complexe", "Compleja", "Complexa", "no")
    : cabin.level.tone === "ok" ? L("Simple", "Simple", "Sencilla", "Simples", "ok")
      : L("Moderate", "Modéré", "Moderada", "Moderada", "warn");
  const experience = brachy ? L("Experienced traveller", "Voyageur expérimenté", "Viajero experimentado", "Viajante experiente", "no")
    : cabin.level.tone === "ok" ? L("First-time friendly", "Accessible aux débutants", "Apto para principiantes", "Ideal para iniciantes", "ok")
      : L("Occasional traveller", "Voyageur occasionnel", "Viajero ocasional", "Viajante ocasional", "warn");

  // ---- Difficulty class (primary verdict) ----
  const diff = difficulty(cabin, hold, cargo);

  // ---- Travel DNA ----
  const dna: DnaRow[] = [
    { icon: "✈", label: { en: "Cabin", fr: "Cabine", es: "Cabina", pt: "Cabine" }, value: cabin.level },
    { icon: "🛄", label: { en: "Hold", fr: "Soute", es: "Bodega", pt: "Porão" }, value: hold.level },
    { icon: "📦", label: { en: "Cargo", fr: "Cargo", es: "Carga", pt: "Carga" }, value: cargo.level },
    /* ── CHALEUR, FROID ET RESPIRATION QUITTENT LE « TRAVEL DNA » (arbitrage du 06/09/2026) ────
     *
     * Les trois lignes affirmaient un RISQUE. Aucune ne pouvait l'établir :
     *   · `heat` transformait une note DogTime « Tolerates Hot Weather » — une tolérance
     *     déclarée — en appréciation de sécurité sanitaire en avion. Ce n'est pas la même
     *     question, et la note ne répond pas à la seconde.
     *   · `respiratory` valait `brachy ? « Risque élevé » : « Risque faible »`. La branche
     *     « faible » est le vrai défaut : elle affirmait un risque respiratoire FAIBLE sur les
     *     150 races non brachycéphales, sans rien avoir mesuré chez aucune.
     *   · `cold` est la plus proche de sa source, mais devient une déduction non sourcée dès que
     *     la note DogTime manque — le repli se calcule alors sur le PELAGE.
     *
     * Les replis eux-mêmes (`coat → heat/cold`, `brachy → respiratory`) sont des déductions
     * internes : ils peuvent rester en donnée, jamais en affirmation publique.
     *
     * Ce qui répond vraiment à la question de la chaleur reste accessible : le calculateur, qui
     * part du TRAJET, de la DATE et des températures. Une restitution est possible dans un lot
     * distinct — afficher la note DogTime COMME telle, « tolérance déclarée par DogTime », avec
     * sa source visible et sans repli inventé. */
    { icon: "🌍", label: { en: "Adaptability", fr: "Adaptabilité", es: "Adaptabilidad", pt: "Adaptabilidade" }, value: adaptVerdict(adapt) },
  ];

  // ---- Best airlines ranking ----
  const rank = { cabin: 0, hold: 1, cargo: 2, none: 3 } as const;
  /* LA FICHE MET EN AVANT CE QUI EST POSSIBLE, pas ce qui est refusé — arbitrage du 29/08/2026.
     Les compagnies sans canal ouvert (`channel: "none"`) sortent de ce classement : elles y
     entraient avec un ❌, et la liste répondait alors à une autre question que celle qu'on pose.
     Une politique à confirmer n'y entre pas non plus : elle n'est ni un oui ni un non. */
  const bestAirlines: AirlineRank[] = perAirline
    .filter((a) => a.channel !== "none")
    .sort((x, y) => rank[x.channel] - rank[y.channel] || x.name.localeCompare(y.name))
    .slice(0, 10)
    .map((a) => airlineRank(a, brachy));

  // ---- FAQ (concrete, derived) ----
  const faq = buildFaq({ name: b.name, nameFr: b.name_i18n?.fr || b.name, nameEs: b.name_i18n?.es || b.name, namePt: b.name_i18n?.pt || b.name, brachy, cabin, hold, cargo, heat, embargo, longHaul, bestSeason, bestAirlines });

  const src = tr.source ? { url: tr.source.url, date: tr.source.verified_date, confidence: tr.source.confidence } : undefined;

  return {
    id: b.id, slug: slugFor(b.id), name: b.name, nameFr: b.name_i18n?.fr || b.name, nameEs: b.name_i18n?.es || b.name, namePt: b.name_i18n?.pt || b.name,
    size: b.size, weightKg: w, brachy, coat: b.coat,
    difficulty: { ...diff }, dna, cabin, hold, cargo, airlineHeadline,
    heat, respiratory, cold, season, bestSeason, climates, longHaul, embargo, prep, experience,
    bestAirlines,
    counts: { cabinWithin, cabinStated, holdYes, holdNo, cargoYes, airlinesTotal, brachyHoldBans },
    faq, source: src,
  };
}

// ---------- verdict helpers ----------
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

const NON_ETABLI = L("Not established", "Pas encore établi", "Aún no establecido", "Ainda não estabelecido", "warn");
const detailNonEtabli = (canal: "cabin" | "hold" | "cargo"): Bi => {
  const nom = {
    cabin: { en: "in the cabin", fr: "en cabine", es: "en cabina", pt: "em cabine" },
    hold: { en: "in the hold", fr: "en soute", es: "en bodega", pt: "no porão" },
    cargo: { en: "as cargo", fr: "en fret", es: "como carga", pt: "como carga" },
  }[canal];
  /* LA MISE EN GARDE BRACHYCÉPHALE SURVIT À LA SUPPRESSION DU CHIFFRE FAUX.
     Première rédaction fautive, nommée : le détail « 0 compagnies interdisent explicitement les
     chiens au museau court en soute » disait deux choses — un COMPTE tiré du vide, et une
     PRÉCAUTION de catégorie qui, elle, reste vraie et ne prétend rien sur une compagnie
     particulière. J'ai retiré les deux d'un coup, et la fiche du carlin a cessé de mentionner
     son museau court en soute et en fret. Le contrôle 4 de test-faq-races.mjs l'a vu. On ne
     garde que la précaution, sans son faux chiffre. */
  /* SUPPRIMÉ LE 07/09/2026, ET C'EST LA MÊME PHRASE QUE J'AVAIS SAUVÉE DEUX FOIS.
     Elle disait « Les races au museau court sont EN OUTRE EXPOSÉES aux embargos chaleur
     saisonniers et à des restrictions respiratoires propres à chaque compagnie ». Le commentaire
     ci-dessus la défendait comme « une PRÉCAUTION de catégorie qui, elle, reste vraie » — mais
     une précaution qui affirme qu'un risque EXISTE est une affirmation, et celle-ci n'a aucune
     citation derrière elle. Pire, elle paraissait sous un paragraphe qui vient de dire « aucune
     politique n'est confirmée, ce n'est pas un refus » : la page niait sa propre prudence dans
     la phrase suivante, en soute ET en fret, soit deux fois sur la fiche du carlin.
     Ce que le site dit désormais des races brachycéphales tient dans UNE phrase, prudente et
     unique — `race.brachy_prudence`, rendue une fois sur la fiche : certaines compagnies
     appliquent des restrictions particulières, à confirmer auprès du transporteur effectif.
     Le paramètre `brachy` de cette fonction n'a donc plus d'emploi et disparaît avec elle. */
  return {
    en: `No airline policy for travel ${nom.en} has been confirmed by a quoted official source yet — this is not a refusal, it is an absence of proof.`,
    fr: `Aucune politique de compagnie pour le voyage ${nom.fr} n'est encore confirmée par une source officielle citée — ce n'est pas un refus, c'est une absence de preuve.`,
    es: `Todavía no hay ninguna política de aerolínea para viajar ${nom.es} confirmada por una fuente oficial citada — no es un rechazo, es una ausencia de prueba.`,
    pt: `Nenhuma política de companhia para viajar ${nom.pt} está ainda confirmada por uma fonte oficial citada — não é uma recusa, é uma ausência de prova.`,
  };
};

function cabinVerdict(w: number, within: number, stated: number, unk: number): ChannelView {
  /* AUCUNE LIMITE PUBLIÉE ⇒ AUCUN VERDICT. Le repli qui suivait déduisait le niveau du seul POIDS
     du chien, comparé à une limite « usuelle » de 8 kg que personne n'a lue nulle part : un
     chihuahua recevait « Très souvent possible » sur zéro politique établie. Un ordre de grandeur
     du marché n'est pas une politique de compagnie. */
  if (stated === 0 && unk === 0) return { level: NON_ETABLI, detail: detailNonEtabli("cabin"), etabli: false };
  /* « SOUS CONDITIONS », JAMAIS « TRÈS SOUVENT POSSIBLE » (08/09/2026, import strict V3). Les
     limites publiées sont désormais CITÉES, et elles plafonnent chien + contenant : un poids de
     race sous le plafond n'est pas un oui, c'est un canal possible sous les conditions de la
     compagnie. Le mot revient dans chaque niveau ; seul le refus au-dessus de toutes les limites
     citées est catégorique, parce qu'il est prouvé. */
  let level: Level;
  if (stated > 0) {
    const pct = within / stated;
    level = pct === 0 ? L("Refused by every cited airline (cabin)", "Refusé par toutes les compagnies citées (cabine)", "Rechazado por todas las aerolíneas citadas (cabina)", "Recusado por todas as companhias citadas (cabine)", "no")
      : pct < 0.25 ? L("Rarely possible, under conditions", "Rarement possible, sous conditions", "Rara vez posible, con condiciones", "Raramente possível, com condições", "no")
        : pct < 0.5 ? L("Possible for some, under conditions", "Possible pour certaines, sous conditions", "Posible en algunas, con condiciones", "Possível em algumas, com condições", "warn")
          : L("Possible for most, under the airlines' conditions", "Possible pour la plupart, sous conditions des compagnies", "Posible en la mayoría, con las condiciones de las aerolíneas", "Possível na maioria, nas condições das companhias", "ok");
  } else {
    /* Aucune limite publiée mais des cabines ouvertes : le poids seul ne décide rien. */
    level = L("Possible under conditions — no published limit", "Possible sous conditions — limite non publiée", "Posible con condiciones — sin límite publicado", "Possível com condições — sem limite publicado", "warn");
  }
  const detail: Bi = stated > 0
    ? { en: `${within} of ${stated} airlines with a published cabin weight limit accept ~${w} kg.`,
        fr: `${within} compagnie(s) sur ${stated} publiant une limite de poids cabine acceptent ~${w} kg.`,
        es: `${within} de ${stated} aerolíneas con un límite de peso en cabina publicado aceptan ~${w} kg.`,
        pt: `${within} de ${stated} companhias aéreas com limite de peso em cabine publicado aceitam ~${w} kg.` }
    : { en: `No airline publishes a cabin weight limit that clearly fits ${w} kg — based on typical ~8 kg limits.`,
        fr: `Aucune compagnie ne publie de limite cabine adaptée à ${w} kg — d'après les limites usuelles (~8 kg).`,
        es: `Ninguna aerolínea publica un límite de peso en cabina que se ajuste claramente a ${w} kg — según los límites habituales (~8 kg).`,
        pt: `Nenhuma companhia aérea publica um limite de peso em cabine que caiba claramente em ${w} kg — com base nos limites habituais (~8 kg).` };
  return { level, detail, etabli: true };
}

function holdVerdict(brachy: boolean, yes: number, no: number, bans: number): ChannelView {
  const tot = yes + no;
  /* `pct = tot ? yes/tot : 0` : sur zéro politique établie, le pourcentage valait 0 et la fiche
     annonçait « Souvent refusé » — un refus déduit de l'absence de données. */
  if (tot === 0) return { level: NON_ETABLI, detail: detailNonEtabli("hold"), etabli: false };
  const pct = tot ? yes / tot : 0;
  let level: Level;
  if (brachy) {
    // Snub-nosed dogs face widespread heat/respiratory hold restrictions that vary by carrier
    // and season. We never rate the hold "widely accepted" for a brachycephalic breed — this is
    // category-level caution, not a fabricated per-airline refusal (the detail gives the hard count).
    level = bans >= 8 || pct < 0.35
      ? L("Frequently refused", "Souvent refusé", "Rechazado con frecuencia", "Frequentemente recusado", "no")
      : L("Restricted — confirm per airline", "Restrictions — à confirmer", "Restringido — confirmar según la aerolínea", "Restrito — confirmar com cada companhia", "warn");
  } else {
    level = pct >= 0.7 ? L("Possible for most, under the airlines' conditions", "Possible pour la plupart, sous conditions des compagnies", "Posible en la mayoría, con las condiciones de las aerolíneas", "Possível na maioria, nas condições das companhias", "ok")
      : pct >= 0.4 ? L("Restricted", "Soumis à restrictions", "Restringido", "Sujeito a restrições", "warn")
        : L("Frequently refused", "Souvent refusé", "Rechazado con frecuencia", "Frequentemente recusado", "no");
  }
  /* CE QUI EST COMPTÉ RESTE, CE QUI ÉTAIT SUPPOSÉ PART (07/09/2026). Cette phrase mêlait un
     COMPTE mesuré sur la base — `bans` compagnies dont l'interdiction est enregistrée — et une
     supposition sur toutes les autres : « d'autres PEUVENT appliquer un embargo chaleur
     saisonnier ». La seconde n'a aucune citation ; collée derrière un chiffre exact, elle
     empruntait son autorité. Le compte reste, la supposition disparaît, et la mise en garde
     brachycéphale est dite UNE fois sur la fiche par `race.brachy_prudence`.
     Ces phrases ne sont pas publiées aujourd'hui (aucun canal n'étant établi, c'est
     `detailNonEtabli` qui sort), mais elles reviendraient à l'écran dès la première citation qui
     établit un canal : les corriger maintenant, c'est refuser le défaut différé — le même que
     celui du score, nommé au lot précédent. */
  const detail: Bi = brachy
    ? { en: `${bans} airlines have a recorded ban on snub-nosed dogs in the hold — confirm the rule that applies to your flight with the carrier operating it.`,
        fr: `${bans} compagnies ont une interdiction enregistrée pour les chiens au museau court en soute — confirme la règle applicable au vol auprès du transporteur effectif.`,
        es: `${bans} aerolíneas tienen registrada una prohibición para los perros de hocico chato en bodega — confirma la norma aplicable a tu vuelo con el transportista que lo opera.`,
        pt: `${bans} companhias têm uma proibição registada para cachorros de focinho achatado no porão — confirma a regra aplicável ao teu voo junto da transportadora que o opera.` }
    : { en: `${yes} airlines accept this profile in the hold, ${no} do not.`,
        fr: `${yes} compagnies acceptent ce profil en soute, ${no} non.`,
        es: `${yes} aerolíneas aceptan este perfil en la bodega, ${no} no.`,
        pt: `${yes} companhias aéreas aceitam este perfil no porão, ${no} não.` };
  return { level, detail, etabli: true };
}

function cargoVerdict(yes: number, no: number, brachy: boolean): ChannelView {
  const tot = yes + no;
  if (tot === 0) return { level: NON_ETABLI, detail: detailNonEtabli("cargo"), etabli: false };
  const pct = tot ? yes / tot : 0;
  let level = pct >= 0.7 ? L("Possible for most, under the airlines' conditions", "Possible pour la plupart, sous conditions des compagnies", "Posible en la mayoría, con las condiciones de las aerolíneas", "Possível na maioria, nas condições das companhias", "ok")
    : pct >= 0.4 ? L("Accepted with conditions", "Accepté sous conditions", "Aceptado con condiciones", "Aceito com condições", "warn")
      : L("Limited", "Limité", "Limitado", "Limitado", "no");
  // Snub-nosed dogs are commonly subject to seasonal cargo heat embargoes → cap at "with conditions".
  if (brachy && level.tone === "ok") level = L("Accepted with conditions", "Accepté sous conditions", "Aceptado con condiciones", "Aceito com condições", "warn");
  /* MÊME GESTE QU'EN SOUTE : le compte d'options cargo est mesuré, « prévoir embargos chaleur
     saisonniers et validation vétérinaire » ne l'est pas. La branche brachycéphale ne se
     distingue donc plus par une prédiction, mais par le renvoi au transporteur effectif. */
  const detail: Bi = brachy
    ? { en: `${yes} airlines run a pet-cargo option — confirm the conditions that apply to snub-nosed breeds with the carrier operating your flight.`,
        fr: `${yes} compagnies proposent une option cargo — confirme les conditions applicables aux races brachycéphales auprès du transporteur effectif.`,
        es: `${yes} aerolíneas ofrecen una opción de carga para mascotas — confirma las condiciones aplicables a las razas braquicéfalas con el transportista que opera tu vuelo.`,
        pt: `${yes} companhias oferecem uma opção de carga para animais — confirma as condições aplicáveis às raças braquicefálicas junto da transportadora que opera o teu voo.` }
    : { en: `${yes} airlines run a pet-cargo option compatible with this breed.`,
        fr: `${yes} compagnies proposent une option cargo compatible avec cette race.`,
        es: `${yes} aerolíneas ofrecen una opción de carga para mascotas compatible con esta raza.`,
        pt: `${yes} companhias aéreas oferecem uma opção de carga para animais compatível com esta raça.` };
  return { level, detail, etabli: true };
}

function headline(cabin: ChannelView, hold: ChannelView, cargo: ChannelView): Level {
  /* Le repli final de cette cascade était « Souvent refusé » : quand AUCUN canal n'est établi,
     aucun n'a le ton « ok », et la synthèse concluait donc au refus — la conclusion la plus dure
     de la page, atteinte par défaut. Elle dit maintenant ce qu'elle sait. */
  if (!cabin.etabli && !hold.etabli && !cargo.etabli) {
    return L("Not established yet", "Pas encore établi", "Aún no establecido", "Ainda não estabelecido", "warn");
  }
  /* La synthèse aussi (08/09/2026) : « accepté par la plupart » devient « possible sous
     conditions » — les politiques citées publient un mode, jamais l'admission de ce chien. */
  if (cabin.level.tone === "ok") return L("Possible in the cabin, under the airlines' conditions", "Possible en cabine, sous conditions des compagnies", "Posible en cabina, con las condiciones de las aerolíneas", "Possível na cabine, nas condições das companhias", "ok");
  if (hold.level.tone === "ok") return L("Possible in the hold, under the airlines' conditions", "Possible en soute, sous conditions des compagnies", "Posible en bodega, con las condiciones de las aerolíneas", "Possível no porão, nas condições das companhias", "ok");
  if (cargo.level.tone === "ok") return L("Cargo only for most airlines", "Cargo uniquement chez la plupart", "Solo carga en la mayoría de aerolíneas", "Somente carga na maioria das companhias", "warn");
  return L("Frequently refused", "Souvent refusé", "Rechazado con frecuencia", "Frequentemente recusado", "no");
}

function heatVerdict(heatTol: number, brachy: boolean): Level {
  let lvl = heatTol >= 4 ? 0 : heatTol === 3 ? 1 : heatTol === 2 ? 2 : 3; // 0 Low..3 Critical
  if (brachy) lvl = Math.max(lvl, 2);
  const map: Level[] = [L("Low", "Faible", "Bajo", "Baixo", "ok"), L("Moderate", "Modéré", "Moderado", "Moderado", "warn"), L("High", "Élevé", "Alto", "Alto", "no"), L("Critical", "Critique", "Crítico", "Crítico", "crit")];
  return map[lvl];
}

function coldVerdict(coldTol: number): Level {
  const map: Level[] = [
    L("Poor", "Faible", "Escasa", "Fraca", "no"), L("Limited", "Limitée", "Limitada", "Limitada", "warn"), L("Moderate", "Modérée", "Moderada", "Moderada", "warn"),
    L("Good", "Bonne", "Buena", "Boa", "ok"), L("Excellent", "Excellente", "Excelente", "Excelente", "ok"),
  ];
  return map[clamp(coldTol, 1, 5) - 1];
}

function adaptVerdict(a: number): Level {
  return a >= 4 ? L("High", "Élevée", "Alta", "Alta", "ok") : a === 3 ? L("Moderate", "Modérée", "Moderada", "Moderada", "warn") : L("Low", "Faible", "Baja", "Baixa", "no");
}

function difficulty(cabin: ChannelView, hold: ChannelView, cargo: ChannelView): Level & { emoji: string; score: number; stars: number; etabli: boolean } {
  // Best REALISTIC channel for an owner, by priority cabin > hold > cargo.
  // Cargo-only is inherently difficult (costly, complex, heat-exposed), so it scores low even when "widely accepted".
  const ok = (v: ChannelView) => v.level.tone === "ok";
  const warn = (v: ChannelView) => v.level.tone === "warn";
  /* LA NOTE GLOBALE NE SE CALCULE PLUS SUR RIEN. Sans canal établi, cette cascade tombait dans
     `base = 18` — « Voyage très difficile », 1,5/5 — puis affichait ce score en chiffres, en
     gros, dans l'en-tête de la fiche. Une note précise sur un dossier vide est exactement la
     réponse catégorique trompeuse que le critère de lancement interdit. Elle se déclare non
     établie, et la page n'affiche alors ni étoiles ni /100 (voir BreedTravelPage.astro). */
  if (!cabin.etabli && !hold.etabli && !cargo.etabli) {
    return { ...L("Not established yet", "Pas encore établi", "Aún no establecido", "Ainda não estabelecido", "warn"),
      emoji: "•", score: 0, stars: 0, etabli: false };
  }
  /* LA NOTE /100 NE SE RALLUME PAS PAR EFFET DE BORD DE LA DONNÉE (08/09/2026, import strict V3).
     Même arbitrage que la jauge du Finder (`SCORE_AFFICHABLE`) : dès la première citation, la
     note serait revenue à « 100/100 · Excellent voyageur » sur des canaux acceptés SOUS CONDITIONS
     — un chiffre précis pour dire « la compagnie publie un mode ». Elle reste calculée, non
     publiée (`etabli: false` masque étoiles et /100), jusqu'à une décision écrite ; la fiche dit
     « sous conditions » à la place. */
  const NOTE_AFFICHABLE = false;
  if (!NOTE_AFFICHABLE) {
    return { ...L("Under the airlines' conditions", "Sous conditions des compagnies", "Con las condiciones de las aerolíneas", "Nas condições das companhias", "warn"),
      emoji: "•", score: 0, stars: 0, etabli: false };
  }
  let base: number;
  if (ok(cabin)) base = 100;
  else if (ok(hold)) base = 78;
  else if (warn(cabin) || warn(hold)) base = 55;
  else if (ok(cargo)) base = 50;            // cargo-only → Difficult territory before penalties
  else if (warn(cargo)) base = 38;
  else base = 18;
  /* ── LA NOTE NE DÉPEND PLUS DE LA PHYSIOLOGIE (contre-vérification du 06/09/2026) ──────────
   *
   * Elle appliquait `heatPen` — 26, 16 ou 6 points selon le ton de `heat` — et une pénalité de
   * 8 points pour une race brachycéphale. Les deux sont des DÉDUCTIONS retirées de l'affichage
   * quelques heures plus tôt : `heat` vient d'une note DogTime de tolérance, et la brachycéphalie
   * ne mesure aucun risque en vol par elle-même.
   *
   * Le défaut est DIFFÉRÉ, et c'est ce qui le rend dangereux : aujourd'hui la note est masquée
   * faute de canal établi, donc rien ne paraît. Mais le jour où une citation rendra un canal
   * établi, la note redeviendrait publique — et elle porterait à nouveau, sans que personne le
   * revoie, deux déductions que l'arbitrage vient d'écarter de l'écran. Une donnée retirée de
   * l'affichage ne doit pas continuer à peser dans un chiffre qui, lui, reviendra.
   *
   * La note ne se calcule donc plus QUE sur les canaux — c'est-à-dire sur les politiques, seules
   * choses que ce dépôt sait établir par citation. `heat` et `brachy` n'entrent plus — et depuis
   * le P2 relevé par Codex le 06/09/2026, la fonction ne les reçoit même plus en paramètres. */
  const score = clamp(base, 5, 100);
  const stars = Math.round((score / 20) * 10) / 10;
  const cls = score >= 82 ? 0 : score >= 64 ? 1 : score >= 46 ? 2 : score >= 28 ? 3 : 4;
  const table = [
    { ...L("Excellent Traveller", "Excellent voyageur", "Viajero excelente", "Excelente viajante", "ok"), emoji: "🟢" },
    { ...L("Good Traveller", "Bon voyageur", "Buen viajero", "Bom viajante", "ok"), emoji: "🟢" },
    { ...L("Moderate Traveller", "Voyageur modéré", "Viajero moderado", "Viajante moderado", "warn"), emoji: "🟡" },
    { ...L("Difficult Traveller", "Voyageur difficile", "Viajero difícil", "Viajante difícil", "no"), emoji: "🟠" },
    { ...L("Very Difficult Traveller", "Voyageur très difficile", "Viajero muy difícil", "Viajante muito difícil", "crit"), emoji: "🔴" },
  ];
  return { ...table[cls], score, stars, etabli: true };
}

function climateBadges(kb: any, heatSensitive: boolean, coldTol: number) {
  const byRegion: Record<string, string[]> = {};
  for (const c of kb.countries.values() as Iterable<any>) {
    (byRegion[c.region] = byRegion[c.region] || []).push(c.iso2);
  }
  const NAMES: Record<string, Bi> = {
    CA: { en: "Canada", fr: "Canada", es: "Canadá", pt: "Canadá" }, GB: { en: "United Kingdom", fr: "Royaume-Uni", es: "Reino Unido", pt: "Reino Unido" }, DE: { en: "Germany", fr: "Allemagne", es: "Alemania", pt: "Alemanha" },
    NL: { en: "Netherlands", fr: "Pays-Bas", es: "Países Bajos", pt: "Países Baixos" }, FR: { en: "France", fr: "France", es: "Francia", pt: "França" }, NZ: { en: "New Zealand", fr: "Nouvelle-Zélande", es: "Nueva Zelanda", pt: "Nova Zelândia" },
    AE: { en: "UAE", fr: "Émirats", es: "EAU", pt: "Emirados" }, TH: { en: "Thailand", fr: "Thaïlande", es: "Tailandia", pt: "Tailândia" }, EG: { en: "Egypt", fr: "Égypte", es: "Egipto", pt: "Egito" },
    QA: { en: "Qatar", fr: "Qatar", es: "Catar", pt: "Catar" }, SG: { en: "Singapore", fr: "Singapour", es: "Singapur", pt: "Singapura" }, IN: { en: "India", fr: "Inde", es: "India", pt: "Índia" },
    US: { en: "United States", fr: "États-Unis", es: "Estados Unidos", pt: "Estados Unidos" }, AU: { en: "Australia", fr: "Australie", es: "Australia", pt: "Austrália" },
  };
  const badge = (iso: string): ClimateBadge => ({ iso2: iso, en: NAMES[iso]?.en || iso, fr: NAMES[iso]?.fr || iso, es: NAMES[iso]?.es || iso, pt: NAMES[iso]?.pt || iso });
  let rec: string[], avoid: string[], basis: Bi;
  if (heatSensitive) {
    rec = ["CA", "GB", "DE"]; avoid = ["AE", "TH", "EG"];
    basis = { en: "Heat-sensitive breed — cooler-summer regions preferred, hot regions avoided (based on regional summer climate).",
              fr: "Race sensible à la chaleur — régions à été frais privilégiées, régions chaudes à éviter (d'après le climat estival régional).",
              es: "Raza sensible al calor — se prefieren regiones de verano más fresco y se evitan las regiones calurosas (según el clima estival regional).",
              pt: "Raça sensível ao calor — regiões de verão mais ameno são preferíveis e as regiões quentes devem ser evitadas (com base no clima de verão da região)." };
  } else if (coldTol <= 2) {
    rec = ["AE", "SG", "TH"]; avoid = ["CA"];
    basis = { en: "Cold-sensitive breed — mild/warm regions preferred (based on regional winter climate).",
              fr: "Race sensible au froid — régions douces/chaudes privilégiées (d'après le climat hivernal régional).",
              es: "Raza sensible al frío — se prefieren regiones templadas/cálidas (según el clima invernal regional).",
              pt: "Raça sensível ao frio — regiões amenas ou quentes são preferíveis (com base no clima de inverno da região)." };
  } else {
    rec = ["FR", "US", "GB"]; avoid = ["AE"];
    basis = { en: "Balanced tolerance — temperate regions are the easiest; only extreme heat needs care.",
              fr: "Tolérance équilibrée — les régions tempérées sont les plus simples ; seule la chaleur extrême demande de la prudence.",
              es: "Tolerancia equilibrada — las regiones templadas son las más fáciles; solo el calor extremo requiere cuidado.",
              pt: "Tolerância equilibrada — as regiões temperadas são as mais simples; só o calor extremo exige cuidado." };
  }
  return { recommended: rec.map(badge), avoid: avoid.map(badge), basis };
}

/* « SOUS CONDITIONS », JAMAIS « ACCEPTÉ » (08/09/2026, import strict V3). Un canal ouvert l'est par
   une politique `accepted_with_conditions` — « la compagnie publie ce mode sous les conditions
   citées », jamais « ce chien est admis ». « Accepté en soute » et la coche pleine le disaient ;
   le plafond cabine s'écrit avec ce qu'il couvre (chien + contenant quand la page le dit), et un
   poids de race sous ce plafond n'est pas un oui : le contenant manque. */
function airlineRank(a: { name: string; slug: string; channel: "cabin" | "hold" | "cargo" | "none"; max?: number; incl?: boolean }, brachy: boolean): AirlineRank {
  if (a.channel === "cabin") {
    const seuil = a.max ? (a.incl === true
      ? { en: ` (≤${a.max} kg incl. carrier)`, fr: ` (≤${a.max} kg chien + contenant)`, es: ` (≤${a.max} kg con transportín)`, pt: ` (≤${a.max} kg com a bolsa)` }
      : a.incl === false
        ? { en: ` (dog alone ≤${a.max} kg, carrier on top)`, fr: ` (chien seul ≤${a.max} kg, contenant en plus)`, es: ` (perro solo ≤${a.max} kg, transportín aparte)`, pt: ` (cachorro sozinho ≤${a.max} kg, bolsa à parte)` }
        : { en: ` (≤${a.max} kg)`, fr: ` (≤${a.max} kg)`, es: ` (≤${a.max} kg)`, pt: ` (≤${a.max} kg)` })
      : { en: "", fr: "", es: "", pt: "" };
    return { name: a.name, slug: a.slug, tone: "ok", badge: "✓", channel: "cabin",
      reason: { en: `Cabin — under the airline's conditions${seuil.en}`, fr: `Cabine — sous conditions de la compagnie${seuil.fr}`, es: `Cabina — con las condiciones de la aerolínea${seuil.es}`, pt: `Cabine — nas condições da companhia${seuil.pt}` } };
  }
  if (a.channel === "hold")
    return brachy
      ? { name: a.name, slug: a.slug, tone: "warn", badge: "⚠", channel: "hold", reason: { en: "Hold — confirm snub-nosed policy", fr: "Soute — confirmer la politique brachycéphale", es: "Bodega — confirmar la política para hocico chato", pt: "Porão — confirmar a política para focinho achatado" } }
      : { name: a.name, slug: a.slug, tone: "ok", badge: "✓", channel: "hold", reason: { en: "Hold — under the airline's conditions", fr: "Soute — sous conditions de la compagnie", es: "Bodega — con las condiciones de la aerolínea", pt: "Porão — nas condições da companhia" } };
  if (a.channel === "cargo")
    return { name: a.name, slug: a.slug, tone: "warn", badge: "⚠", channel: "cargo", reason: { en: "Cargo only", fr: "Cargo uniquement", es: "Solo carga", pt: "Somente carga" } };
  return { name: a.name, slug: a.slug, tone: "no", badge: "❌", channel: "none", reason: { en: "Not accepted for this breed", fr: "Non accepté pour cette race", es: "No aceptado para esta raza", pt: "Não aceito para esta raça" } };
}

/**
 * « QUELLES COMPAGNIES ACCEPTENT CETTE RACE » — la réponse NOMME, elle ne renvoie pas.
 *
 * Arbitrage du 29/08/2026. La question demandait naguère quelles compagnies REFUSENT la race, et
 * répondait « voir le classement ci-dessous » — or la section visée ne montre que les compagnies
 * qui ACCEPTENT : la réponse renvoyait donc à autre chose qu'elle-même, et la fiche mettait en
 * avant le refus là où elle doit montrer le possible.
 *
 * « Ci-dessus » et « ci-dessous » disparaissent de toute réponse : hors de la page — dans un
 * extrait de recherche, dans les données structurées FAQ, pour un lecteur d'écran — ils ne
 * désignent rien, et une mise en page qui bouge les rendrait faux sans que personne ne le voie.
 *
 * Sans compagnie compatible, on le DIT. Une liste inventée serait pire que l'absence.
 */
export function faqCompagnies(x: any): { q: Bi; a: Bi }[] {
  const cites: AirlineRank[] = (x.bestAirlines ?? []).slice(0, 4);
  /* LE CANAL RÉEL DE CHAQUE COMPAGNIE. La première rédaction ne nommait le canal que si les
     quatre compagnies le partageaient — dès qu'elles étaient mixtes, la phrase perdait
     l'information la plus utile de la page. Les noms sont désormais GROUPÉS PAR CANAL : « A et B
     en cabine ; C en soute ; D en fret ». Aucun canal n'est uniformisé, aucun n'est tu. */
  const CANAUX: Record<string, Record<string, string>> = {
    cabin: { en: " in the cabin", fr: " en cabine", es: " en cabina", pt: " na cabine" },
    hold: { en: " in the hold", fr: " en soute", es: " en bodega", pt: " no porão" },
    cargo: { en: " as cargo", fr: " en fret", es: " como carga", pt: " como carga" },
  };
  /* Ordre STABLE : cabine, soute, fret — jamais l'ordre d'arrivée, qui rendrait la phrase
     dépendante du classement et donc instable d'une race à l'autre. */
  const ORDRE = ["cabin", "hold", "cargo"];
  const enumerer = (noms: string[], et: string) =>
    noms.length <= 1 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} ${et} ${noms[noms.length - 1]}`;
  const groupes = (lang: string, et: string) => {
    const vus = ORDRE.filter((c) => cites.some((a) => a.channel === c));
    /* Un canal inconnu du tableau ne se traduit pas : on le nomme sans suffixe plutôt que
       d'inventer un mot. */
    const inconnus = [...new Set(cites.map((a) => a.channel))].filter((c) => !ORDRE.includes(c));
    return [...vus, ...inconnus]
      .map((c) => `${enumerer(cites.filter((a) => a.channel === c).map((a) => a.name), et)}${CANAUX[c]?.[lang] ?? ""}`)
      .join(" ; ");
  };
  const RESERVE: Record<string, string> = {
    en: " Final acceptance depends on the route, the aircraft, the season and the crate.",
    fr: " L'acceptation finale dépend du trajet, de l'appareil, de la saison et des caractéristiques de la caisse.",
    es: " La aceptación final depende de la ruta, el avión, la temporada y las características del transportín.",
    pt: " A aceitação final depende do trajeto, da aeronave, da estação e das características da caixa.",
  };
  const AUCUNE: Record<string, string> = {
    en: "No compatible airline is currently established in our verified data for this breed.",
    fr: "Aucune compagnie compatible n'est actuellement établie dans les données vérifiées.",
    es: "Ninguna aerolínea compatible está actualmente establecida en los datos verificados.",
    pt: "Nenhuma companhia compatível está atualmente estabelecida nos dados verificados.",
  };
  const rep = (lang: string, debut: string, et: string) =>
    cites.length === 0 ? AUCUNE[lang] : `${debut}${groupes(lang, et)}.${RESERVE[lang]}`;
  return [{
    q: { en: "Which airlines generally accept this breed?", fr: "Quelles compagnies acceptent généralement cette race ?",
         es: "¿Qué aerolíneas suelen aceptar esta raza?", pt: "Quais companhias aéreas costumam aceitar esta raça?" },
    a: { en: rep("en", "According to published policies, ", "and"),
         fr: rep("fr", "Selon les politiques publiées, ", "et"),
         es: rep("es", "Según las políticas publicadas, ", "y"),
         pt: rep("pt", "Segundo as políticas publicadas, ", "e") },
  }];
}

function buildFaq(x: any): { q: Bi; a: Bi }[] {
  const yn = (t: Tone) => t === "ok";
  return [
    { q: { en: `Can a ${x.name} fly in the cabin?`, fr: `Un ${x.nameFr} peut-il voyager en cabine ?`, es: `¿Puede un ${x.nameEs} viajar en cabina?`, pt: `Um ${x.namePt} pode viajar na cabine?` },
      a: { en: `${x.cabin.level.en}. ${x.cabin.detail.en}`, fr: `${x.cabin.level.fr}. ${x.cabin.detail.fr}`, es: `${x.cabin.level.es}. ${x.cabin.detail.es}`, pt: `${x.cabin.level.pt}. ${x.cabin.detail.pt}` } },
    { q: { en: `Can a ${x.name} fly in the hold or cargo?`, fr: `Un ${x.nameFr} peut-il voyager en soute ou en cargo ?`, es: `¿Puede un ${x.nameEs} viajar en bodega o en carga?`, pt: `Um ${x.namePt} pode viajar no porão ou como carga?` },
      a: { en: `Hold: ${x.hold.level.en.toLowerCase()}. Cargo: ${x.cargo.level.en.toLowerCase()}. ${x.hold.detail.en}`,
           fr: `Soute : ${x.hold.level.fr.toLowerCase()}. Cargo : ${x.cargo.level.fr.toLowerCase()}. ${x.hold.detail.fr}`,
           es: `Bodega: ${x.hold.level.es.toLowerCase()}. Carga: ${x.cargo.level.es.toLowerCase()}. ${x.hold.detail.es}`,
           pt: `Porão: ${x.hold.level.pt.toLowerCase()}. Carga: ${x.cargo.level.pt.toLowerCase()}. ${x.hold.detail.pt}` } },
    ...faqCompagnies(x),
    /* ── DEUX QUESTIONS RETIRÉES (contre-test navigateur du 06/09/2026) ─────────────────────
     *
     * « Un {race} peut-il voyager en été ? » répondait par le risque d'embargo climatique et une
     * MEILLEURE SAISON ; « Un vol direct est-il recommandé ? » répondait « Oui — court/moyen-
     * courrier ». Les deux se calculent à partir des canaux des compagnies, dont AUCUN n'est
     * aujourd'hui établi comme accepté — et une réponse de FAQ est catégorique par construction,
     * en plus d'être donnée à lire à une machine par le balisage `FAQPage`.
     *
     * Ces deux réponses avaient survécu au retrait des mêmes affirmations dans le corps de la
     * fiche : je les avais retirées de la page et laissées dans sa FAQ. C'est exactement la
     * faute déjà commise sur les fiches compagnies — masquer une surface et en oublier une autre.
     *
     * Le risque chaleur reste accessible, mais par l'OUTIL, qui part de la date et du trajet
     * réels du visiteur au lieu de recommander une saison dans l'abstrait. */
  ];
}
