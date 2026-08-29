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
  difficulty: Level & { emoji: string; score: number; stars: number };
  dna: DnaRow[];
  cabin: ChannelView; hold: ChannelView; cargo: ChannelView;
  airlineHeadline: Level;          // "Cargo only", "Accepted by most", ...
  heat: Level; respiratory: Level; cold: Level;
  season: SeasonStars; bestSeason: Bi;
  climates: { recommended: ClimateBadge[]; avoid: ClimateBadge[]; basis: Bi };
  longHaul: Level; embargo: Level;
  crate: { code: string; sizeLabel: string; dims: string };
  prep: Level; experience: Level;
  bestAirlines: AirlineRank[];
  counts: { cabinWithin: number; cabinStated: number; holdYes: number; holdNo: number; cargoYes: number; airlinesTotal: number; brachyHoldBans: number };
  faq: { q: Bi; a: Bi }[];
  source?: { url: string; date: string; confidence: number };
}

const HEAT_EMBARGO_C = 30;
// IATA crate interior series (indicative cm) — mirrors CrateCalculator.astro
const SIZES = [
  { code: "100", label: "XS", l: 48, w: 33, h: 33 },
  { code: "200", label: "S", l: 63, w: 43, h: 45 },
  { code: "300", label: "M", l: 73, w: 48, h: 55 },
  { code: "400", label: "L", l: 84, w: 57, h: 60 },
  { code: "500", label: "XL", l: 94, w: 64, h: 68 },
  { code: "700", label: "XXL", l: 112, w: 76, h: 82 },
];
// Region → coarse summer high (°C) — mirrors engine evaluate.ts CLIMATE
const REGION_SUMMER: Record<string, number> = {
  "Middle East": 42, "Africa": 35, "Asia": 34, "Central America": 33,
  "Caribbean": 32, "South America": 32, "Oceania": 32, "North America": 30, "Europe": 28,
};

const L = (en: string, fr: string, es: string, pt: string, tone: Tone): Level => ({ en, fr, es, pt, tone });

export function computeBreedTravel(breedId: string): BreedTravelProfile | null {
  const kb: any = loadKB();
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
    if (!p) return "inconnu";
    if (p.status === "allowed" || p.status === "confirmation_required" || p.status === "denied") return p.status;
    if (p.allowed === undefined) return "inconnu";
    return p.allowed ? "allowed" : "denied";
  };
  let holdAConfirmer = 0, cargoAConfirmer = 0, cabinAConfirmer = 0;
  const perAirline: { name: string; slug: string; channel: "cabin" | "hold" | "cargo" | "none"; max?: number }[] = [];
  for (const a of kb.airlines.values() as Iterable<any>) {
    const p = a.premium?.policy || {};
    const c = p.cabin, h = p.hold, g = p.cargo;
    // cabin
    let cabinEligible = false, cabinReasonMax: number | undefined;
    const stCabin = statutDu(c);
    if (stCabin === "confirmation_required") cabinAConfirmer++;
    else if (stCabin !== "inconnu") {
      if (stCabin === "denied") cabinNo++;
      else if (c.max_weight_kg == null) { cabinUnkLimit++; if (w <= 8) { cabinEligible = true; } }
      else if (w <= c.max_weight_kg) { cabinWithin++; cabinEligible = true; cabinReasonMax = c.max_weight_kg; }
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
    perAirline.push({ name: a.name, slug: slugFor(a.id), channel, max: cabinReasonMax });
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

  // ---- IATA crate ----
  const A = Math.round(22 * Math.pow(w, 0.34));
  const D = Math.round(23 * Math.pow(w, 0.31));
  const k = brachy ? 1.1 : 1;
  const Lc = (A + (0.4 * D) / 2) * k, Wc = 6.5 * Math.pow(w, 0.33) * 2 * k, Hc = D * k;
  const sz = SIZES.find((s) => s.l >= Lc && s.w >= Wc && s.h >= Hc);
  const crate = sz
    ? { code: sz.code, sizeLabel: sz.label, dims: `${sz.l}×${sz.w}×${sz.h} cm` }
    : { code: "700+", sizeLabel: "> XXL", dims: "> 112×76×82 cm" };

  // ---- Prep + experience ----
  const prep = brachy ? L("Complex", "Complexe", "Compleja", "Complexa", "no")
    : cabin.level.tone === "ok" ? L("Simple", "Simple", "Sencilla", "Simples", "ok")
      : L("Moderate", "Modéré", "Moderada", "Moderada", "warn");
  const experience = brachy ? L("Experienced traveller", "Voyageur expérimenté", "Viajero experimentado", "Viajante experiente", "no")
    : cabin.level.tone === "ok" ? L("First-time friendly", "Accessible aux débutants", "Apto para principiantes", "Ideal para iniciantes", "ok")
      : L("Occasional traveller", "Voyageur occasionnel", "Viajero ocasional", "Viajante ocasional", "warn");

  // ---- Difficulty class (primary verdict) ----
  const diff = difficulty(cabin, hold, cargo, heat, brachy);

  // ---- Travel DNA ----
  const dna: DnaRow[] = [
    { icon: "✈", label: { en: "Cabin", fr: "Cabine", es: "Cabina", pt: "Cabine" }, value: cabin.level },
    { icon: "🛄", label: { en: "Hold", fr: "Soute", es: "Bodega", pt: "Porão" }, value: hold.level },
    { icon: "📦", label: { en: "Cargo", fr: "Cargo", es: "Carga", pt: "Carga" }, value: cargo.level },
    { icon: "🌡", label: { en: "Heat", fr: "Chaleur", es: "Calor", pt: "Calor" }, value: heat },
    { icon: "❄", label: { en: "Cold", fr: "Froid", es: "Frío", pt: "Frio" }, value: cold },
    { icon: "🫁", label: { en: "Breathing", fr: "Respiration", es: "Respiración", pt: "Respiração" }, value: respiratory },
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
    heat, respiratory, cold, season, bestSeason, climates, longHaul, embargo, crate, prep, experience,
    bestAirlines,
    counts: { cabinWithin, cabinStated, holdYes, holdNo, cargoYes, airlinesTotal, brachyHoldBans },
    faq, source: src,
  };
}

// ---------- verdict helpers ----------
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function cabinVerdict(w: number, within: number, stated: number, unk: number): ChannelView {
  let level: Level;
  if (stated > 0) {
    const pct = within / stated;
    level = pct === 0 ? L("Impossible", "Impossible", "Imposible", "Impossível", "no")
      : pct < 0.25 ? L("Rarely possible", "Rarement possible", "Rara vez posible", "Raramente possível", "no")
        : pct < 0.5 ? L("Possible for some", "Possible pour certains", "Posible para algunos", "Possível em algumas", "warn")
          : pct < 0.8 ? L("Often possible", "Souvent possible", "A menudo posible", "Frequentemente possível", "ok")
            : L("Very often possible", "Très souvent possible", "Muy a menudo posible", "Quase sempre possível", "ok");
  } else {
    level = w <= 8 ? L("Very often possible", "Très souvent possible", "Muy a menudo posible", "Quase sempre possível", "ok")
      : w <= 10 ? L("Possible for some", "Possible pour certains", "Posible para algunos", "Possível em algumas", "warn")
        : L("Rarely possible", "Rarement possible", "Rara vez posible", "Raramente possível", "no");
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
  return { level, detail };
}

function holdVerdict(brachy: boolean, yes: number, no: number, bans: number): ChannelView {
  const tot = yes + no;
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
    level = pct >= 0.7 ? L("Widely accepted", "Largement accepté", "Ampliamente aceptado", "Amplamente aceito", "ok")
      : pct >= 0.4 ? L("Restricted", "Soumis à restrictions", "Restringido", "Sujeito a restrições", "warn")
        : L("Frequently refused", "Souvent refusé", "Rechazado con frecuencia", "Frequentemente recusado", "no");
  }
  const detail: Bi = brachy
    ? { en: `${bans} airlines explicitly ban snub-nosed dogs from the hold; others may still apply seasonal heat embargoes — confirm with each carrier.`,
        fr: `${bans} compagnies interdisent explicitement les chiens au museau court en soute ; d'autres peuvent appliquer un embargo chaleur saisonnier — à confirmer avec chaque compagnie.`,
        es: `${bans} aerolíneas prohíben expresamente a los perros de hocico chato en la bodega; otras pueden aplicar embargos por calor estacionales — confírmalo con cada aerolínea.`,
        pt: `${bans} companhias aéreas proíbem expressamente cachorros de focinho achatado no porão; outras podem aplicar embargos sazonais por calor — confirme com cada companhia.` }
    : { en: `${yes} airlines accept this profile in the hold, ${no} do not.`,
        fr: `${yes} compagnies acceptent ce profil en soute, ${no} non.`,
        es: `${yes} aerolíneas aceptan este perfil en la bodega, ${no} no.`,
        pt: `${yes} companhias aéreas aceitam este perfil no porão, ${no} não.` };
  return { level, detail };
}

function cargoVerdict(yes: number, no: number, brachy: boolean): ChannelView {
  const tot = yes + no;
  const pct = tot ? yes / tot : 0;
  let level = pct >= 0.7 ? L("Widely accepted", "Largement accepté", "Ampliamente aceptado", "Amplamente aceito", "ok")
    : pct >= 0.4 ? L("Accepted with conditions", "Accepté sous conditions", "Aceptado con condiciones", "Aceito com condições", "warn")
      : L("Limited", "Limité", "Limitado", "Limitado", "no");
  // Snub-nosed dogs are commonly subject to seasonal cargo heat embargoes → cap at "with conditions".
  if (brachy && level.tone === "ok") level = L("Accepted with conditions", "Accepté sous conditions", "Aceptado con condiciones", "Aceito com condições", "warn");
  const detail: Bi = brachy
    ? { en: `${yes} airlines run a pet-cargo option; for snub-nosed breeds expect seasonal heat embargoes and vet clearance.`,
        fr: `${yes} compagnies proposent une option cargo ; pour les races au museau court, prévoir embargos chaleur saisonniers et validation vétérinaire.`,
        es: `${yes} aerolíneas ofrecen una opción de carga para mascotas; para las razas de hocico chato, cuenta con embargos por calor estacionales y validación veterinaria.`,
        pt: `${yes} companhias aéreas oferecem uma opção de carga para animais; para raças de focinho achatado, conte com embargos sazonais por calor e liberação veterinária.` }
    : { en: `${yes} airlines run a pet-cargo option compatible with this breed.`,
        fr: `${yes} compagnies proposent une option cargo compatible avec cette race.`,
        es: `${yes} aerolíneas ofrecen una opción de carga para mascotas compatible con esta raza.`,
        pt: `${yes} companhias aéreas oferecem uma opção de carga para animais compatível com esta raça.` };
  return { level, detail };
}

function headline(cabin: ChannelView, hold: ChannelView, cargo: ChannelView): Level {
  if (cabin.level.tone === "ok") return L("Accepted by most airlines (cabin)", "Accepté par la plupart (cabine)", "Aceptado por la mayoría de aerolíneas (cabina)", "Aceito pela maioria das companhias (cabine)", "ok");
  if (hold.level.tone === "ok") return L("Accepted in hold by many airlines", "Accepté en soute par beaucoup", "Aceptado en bodega por muchas aerolíneas", "Aceito no porão por muitas companhias", "ok");
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

function difficulty(cabin: ChannelView, hold: ChannelView, cargo: ChannelView, heat: Level, brachy: boolean): Level & { emoji: string; score: number; stars: number } {
  // Best REALISTIC channel for an owner, by priority cabin > hold > cargo.
  // Cargo-only is inherently difficult (costly, complex, heat-exposed), so it scores low even when "widely accepted".
  const ok = (v: ChannelView) => v.level.tone === "ok";
  const warn = (v: ChannelView) => v.level.tone === "warn";
  let base: number;
  if (ok(cabin)) base = 100;
  else if (ok(hold)) base = 78;
  else if (warn(cabin) || warn(hold)) base = 55;
  else if (ok(cargo)) base = 50;            // cargo-only → Difficult territory before penalties
  else if (warn(cargo)) base = 38;
  else base = 18;
  const heatPen = heat.tone === "crit" ? 26 : heat.tone === "no" ? 16 : heat.tone === "warn" ? 6 : 0;
  const score = clamp(Math.round(base - heatPen - (brachy ? 8 : 0)), 5, 100);
  const stars = Math.round((score / 20) * 10) / 10;
  const cls = score >= 82 ? 0 : score >= 64 ? 1 : score >= 46 ? 2 : score >= 28 ? 3 : 4;
  const table = [
    { ...L("Excellent Traveller", "Excellent voyageur", "Viajero excelente", "Excelente viajante", "ok"), emoji: "🟢" },
    { ...L("Good Traveller", "Bon voyageur", "Buen viajero", "Bom viajante", "ok"), emoji: "🟢" },
    { ...L("Moderate Traveller", "Voyageur modéré", "Viajero moderado", "Viajante moderado", "warn"), emoji: "🟡" },
    { ...L("Difficult Traveller", "Voyageur difficile", "Viajero difícil", "Viajante difícil", "no"), emoji: "🟠" },
    { ...L("Very Difficult Traveller", "Voyageur très difficile", "Viajero muy difícil", "Viajante muito difícil", "crit"), emoji: "🔴" },
  ];
  return { ...table[cls], score, stars };
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

function airlineRank(a: { name: string; slug: string; channel: "cabin" | "hold" | "cargo" | "none"; max?: number }, brachy: boolean): AirlineRank {
  if (a.channel === "cabin")
    return { name: a.name, slug: a.slug, tone: "ok", badge: "✅", channel: "cabin",
      reason: { en: `Cabin${a.max ? ` (≤${a.max} kg)` : ""}`, fr: `Cabine${a.max ? ` (≤${a.max} kg)` : ""}`, es: `Cabina${a.max ? ` (≤${a.max} kg)` : ""}`, pt: `Cabine${a.max ? ` (≤${a.max} kg)` : ""}` } };
  if (a.channel === "hold")
    return brachy
      ? { name: a.name, slug: a.slug, tone: "warn", badge: "⚠", channel: "hold", reason: { en: "Hold — confirm snub-nosed policy", fr: "Soute — confirmer la politique brachycéphale", es: "Bodega — confirmar la política para hocico chato", pt: "Porão — confirmar a política para focinho achatado" } }
      : { name: a.name, slug: a.slug, tone: "ok", badge: "✅", channel: "hold", reason: { en: "Accepted in hold", fr: "Accepté en soute", es: "Aceptado en bodega", pt: "Aceito no porão" } };
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
function faqCompagnies(x: any): { q: Bi; a: Bi }[] {
  const cites: AirlineRank[] = (x.bestAirlines ?? []).slice(0, 4);
  const enumerer = (et: string) => {
    const noms = cites.map((a) => a.name);
    return noms.length <= 1 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} ${et} ${noms[noms.length - 1]}`;
  };
  /* Le canal RÉEL des compagnies citées. S'il diffère de l'une à l'autre, on ne prétend pas
     qu'elles partagent le même — la phrase se tait plutôt que d'uniformiser. */
  const CANAUX: Record<string, Record<string, string>> = {
    cabin: { en: " in the cabin", fr: " en cabine", es: " en cabina", pt: " na cabine" },
    hold: { en: " in the hold", fr: " en soute", es: " en bodega", pt: " no porão" },
    cargo: { en: " as cargo", fr: " en fret", es: " como carga", pt: " como carga" },
  };
  const canal = (lang: string) => {
    const distincts = new Set(cites.map((a) => a.channel));
    return distincts.size === 1 ? (CANAUX[[...distincts][0]]?.[lang] ?? "") : "";
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
    cites.length === 0 ? AUCUNE[lang] : `${debut}${enumerer(et)}${canal(lang)}.${RESERVE[lang]}`;
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
    { q: { en: `Can a ${x.name} fly in summer?`, fr: `Un ${x.nameFr} peut-il voyager en été ?`, es: `¿Puede un ${x.nameEs} viajar en verano?`, pt: `Um ${x.namePt} pode viajar no verão?` },
      a: { en: `Heat risk is ${x.heat.en.toLowerCase()} and climate-embargo risk is ${x.embargo.en.toLowerCase()}. Best season: ${x.bestSeason.en}.`,
           fr: `Le risque chaleur est ${x.heat.fr.toLowerCase()} et le risque d'embargo climatique ${x.embargo.fr.toLowerCase()}. Meilleure saison : ${x.bestSeason.fr}.`,
           es: `El riesgo de calor es ${x.heat.es.toLowerCase()} y el riesgo de embargo climático es ${x.embargo.es.toLowerCase()}. Mejor temporada: ${x.bestSeason.es}.`,
           pt: `O risco de calor é ${x.heat.pt.toLowerCase()} e o risco de embargo climático é ${x.embargo.pt.toLowerCase()}. Melhor estação: ${x.bestSeason.pt}.` } },
    { q: { en: `Is a direct flight recommended?`, fr: `Un vol direct est-il recommandé ?`, es: `¿Se recomienda un vuelo directo?`, pt: `Um voo direto é recomendado?` },
      a: { en: `Yes — ${x.longHaul.en.toLowerCase()}. Direct routing limits temperature exposure and handling stress.`,
           fr: `Oui — ${x.longHaul.fr.toLowerCase()}. Un vol direct limite l'exposition à la chaleur et le stress de manipulation.`,
           es: `Sí — ${x.longHaul.es.toLowerCase()}. Un vuelo directo limita la exposición a la temperatura y el estrés por manipulación.`,
           pt: `Sim — ${x.longHaul.pt.toLowerCase()}. Um voo direto limita a exposição à temperatura e o estresse do manuseio.` } },
  ];
}
