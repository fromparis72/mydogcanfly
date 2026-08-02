import {
  kindOf, rulesForScope, rulesForBreed, relatedIds, neighbors, labelOf, schemaFor, t, breedName, cityName, airportName, guideFor,
  type NormalizedKB, type Rule,
} from "@mydogcanfly/knowledge";
import { hrefFor } from "./routes";
import popular from "../data/popular.generated.json";

interface Related { href: string; label: string; kind: string; flag?: string }
/** ISO2 -> flag emoji via regional indicator symbols. */
function iso2Flag(iso2?: string): string {
  if (!iso2 || iso2.length !== 2) return "";
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
interface Fact { label: string; value: string }
interface SrcView { host: string; url: string; date: string; confidence: number }
interface PolicyView {
  key: string; label: string; allowed: boolean;
  maxWeight?: string; dims?: string; fee?: string; conditions?: string; src: SrcView;
}
export interface PremiumView {
  summary?: string;
  logo?: { src: string; placeholder: boolean; alt?: string };
  policy: PolicyView[];
  booking?: { text: string; src: SrcView };
  history: { year: number; event: string; src: SrcView }[];
  faq: { q: string; a: string; src: SrcView }[];
  tips: { text: string; src: SrcView }[];
}
export interface GuideView {
  title: string;
  html: string;
  sources: { id: string; url: string; publisher?: string; accessed?: string }[];
  policySource?: string | null;
  lastReviewed?: string | null;
}
export interface PetReliefView {
  available: "yes" | "no";
  postSecurity: boolean;
  locations: string[];
  note?: string;
  src?: SrcView;
}
export interface EntryFactorsView {
  title: string;
  intro: string;
  factors: { stars: number; label: string; text: string }[];
  note: string;
}
export interface AirportInfoView {
  address?: string;
  website?: string;
  access?: string;
  terminalRules?: { items: string[]; src: SrcView };
  borderPost?: { note: string; appliesWhen?: string; phone?: string; address?: string; hours?: string; src: SrcView };
  assistance?: { note: string; src?: SrcView };
  contacts?: { label: string; value: string; src?: SrcView }[];
}
export interface EntityProps {
  kind: string;
  title: string;
  subtitle?: string;
  facts: Fact[];
  rules: Rule[];
  related: Related[];
  relatedTitle?: string;
  schema: Record<string, unknown>;
  finderContext: string;
  premium?: PremiumView;
  guide?: GuideView;
  petRelief?: PetReliefView;
  airportInfo?: AirportInfoView;
  headFlag?: string;
  monogram?: boolean;
  contact?: { phones: { region: string; number: string }[]; src: SrcView };
  breedTravel?: BreedTravelView;
  entryFactors?: EntryFactorsView;
}

/** Airline customer-service phones → render-ready view. */
function contactView(contact: unknown, locale: string): { phones: { region: string; number: string }[]; src: SrcView } | undefined {
  const c = contact as { phones?: { region: LT; number: string }[]; source?: { url: string; verified_date: string; confidence: number } } | undefined;
  if (!c?.phones?.length || !c.source) return undefined;
  return { phones: c.phones.map((p) => ({ region: pick(p.region, locale) ?? "", number: p.number })), src: srcView(c.source) };
}

/** Airport practical-info → render-ready view. Only populated, sourced blocks come through. */
function airportInfoView(info: unknown, locale: string): AirportInfoView | undefined {
  const i = info as {
    address?: string; website?: string; access?: LT;
    terminal_rules?: { items: LT[]; source: { url: string; verified_date: string; confidence: number } };
    border_post?: { note: LT; applies_when?: LT; phone?: string; address?: string; hours?: string; source: { url: string; verified_date: string; confidence: number } };
    assistance?: { note: LT; source?: { url: string; verified_date: string; confidence: number } };
    contacts?: { label: LT; value: string; source?: { url: string; verified_date: string; confidence: number } }[];
  } | undefined;
  if (!i) return undefined;
  const v: AirportInfoView = {
    address: i.address,
    website: i.website,
    access: pick(i.access, locale),
  };
  if (i.terminal_rules)
    v.terminalRules = { items: i.terminal_rules.items.map((x) => pick(x, locale) ?? "").filter(Boolean), src: srcView(i.terminal_rules.source) };
  if (i.border_post)
    v.borderPost = {
      note: pick(i.border_post.note, locale) ?? "", appliesWhen: pick(i.border_post.applies_when, locale),
      phone: i.border_post.phone, address: i.border_post.address, hours: i.border_post.hours, src: srcView(i.border_post.source),
    };
  if (i.assistance)
    v.assistance = { note: pick(i.assistance.note, locale) ?? "", src: i.assistance.source ? srcView(i.assistance.source) : undefined };
  if (i.contacts)
    v.contacts = i.contacts.map((c) => ({ label: pick(c.label, locale) ?? "", value: c.value, src: c.source ? srcView(c.source) : undefined }));
  return v;
}

/** Airport pet / service-animal relief area → render-ready view. Absent or "unknown" → no section (we assert nothing unverified). */
function petReliefView(pr: unknown, locale: string): PetReliefView | undefined {
  const r = pr as {
    available?: string; post_security?: boolean; locations?: LT[]; note?: LT;
    source?: { url: string; verified_date: string; confidence: number };
  } | undefined;
  if (!r || (r.available !== "yes" && r.available !== "no")) return undefined;
  return {
    available: r.available,
    postSecurity: r.post_security === true,
    locations: (r.locations ?? []).map((l) => pick(l, locale) ?? "").filter(Boolean),
    note: pick(r.note, locale),
    src: r.source ? srcView(r.source) : undefined,
  };
}

/** Attach the hand-authored Hub guide for this entity + locale, if one exists. */
function guideView(id: string, locale: string): GuideView | undefined {
  const g = guideFor(id, locale);
  if (!g) return undefined;
  return { title: g.title, html: g.html, sources: g.sources, policySource: g.policy_source ?? null, lastReviewed: g.last_reviewed ?? null };
}

function rel(kb: NormalizedKB, ids: string[], locale: string): Related[] {
  return [...new Set(ids)].map((rid) => ({
    href: hrefFor(rid, locale),
    label: labelOf(kb, rid, locale),
    kind: t(locale, `kind.${kindOf(rid)}`, kindOf(rid)),
    flag: kindOf(rid) === "country" ? iso2Flag(kb.countries.get(rid)?.iso2) : undefined,
  }));
}

/** Entity pages render `rule.rationale`; swap in the localized text so FR pages aren't English. */
function locRules(rules: Rule[], locale: string): Rule[] {
  return rules.map((r) => ({ ...r, rationale: r.rationale_i18n?.[locale] ?? r.rationale }));
}

/** Localize the few well-known pet-scheme labels for display. */
function schemeLabel(scheme: string, locale: string): string {
  if (locale !== "fr" && locale !== "es") return scheme;
  const maps: Record<string, Record<string, string>> = {
    fr: {
      "EU Pet Movement": "Mouvement des animaux dans l’UE",
      "National import rules": "Règles nationales d’importation",
      "GB Pet Travel": "Voyage d’animaux vers la Grande-Bretagne",
      "CDC Dog Import": "Importation de chiens (CDC)",
      "CFIA Import": "Importation (ACIA)",
      "MAFF Import": "Importation (MAFF)",
      "Turkey Import": "Règles d’importation (Turquie)",
      "SENASICA": "Importation (SENASICA)",
    },
    es: {
      "EU Pet Movement": "Movimiento de animales en la UE",
      "National import rules": "Normas nacionales de importación",
      "GB Pet Travel": "Viaje de mascotas a Gran Bretaña",
      "CDC Dog Import": "Importación de perros (CDC)",
      "CFIA Import": "Importación (CFIA)",
      "MAFF Import": "Importación (MAFF)",
      "Turkey Import": "Normas de importación (Turquía)",
      "SENASICA": "Importación (SENASICA)",
    },
  };
  return maps[locale][scheme] ?? scheme;
}

const srcHost = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
type LT = { en: string;[k: string]: string | undefined };
const pick = (lt: LT | undefined, locale: string): string | undefined =>
  lt ? ((lt as Record<string, string | undefined>)[locale] ?? lt.en) : undefined;
const srcView = (s: { url: string; verified_date: string; confidence: number }): SrcView =>
  ({ host: srcHost(s.url), url: s.url, date: s.verified_date, confidence: s.confidence });

/** Localize the premium airline dossier into a flat, render-ready view-model. */
function premiumView(a: { premium?: unknown }, locale: string): PremiumView | undefined {
  const pr = a.premium as {
    summary?: LT;
    logo?: { src: string; placeholder: boolean; alt?: LT };
    policy?: Record<string, { allowed: boolean; max_weight_kg?: number; carrier_dims_cm?: { l: number; w: number; h: number }; fee?: string; conditions?: LT; source: { url: string; verified_date: string; confidence: number } }>;
    booking?: { text: LT; source: { url: string; verified_date: string; confidence: number } };
    history?: { year: number; event: LT; source: { url: string; verified_date: string; confidence: number } }[];
    faq?: { q: LT; a: LT; source: { url: string; verified_date: string; confidence: number } }[];
    tips?: { text: LT; source: { url: string; verified_date: string; confidence: number } }[];
  } | undefined;
  if (!pr) return undefined;

  const pol = (key: string): PolicyView | null => {
    const p = pr.policy?.[key];
    if (!p) return null;
    return {
      key, label: t(locale, `placement.${key}`), allowed: p.allowed,
      maxWeight: p.max_weight_kg ? `${p.max_weight_kg} kg` : undefined,
      dims: p.carrier_dims_cm ? `${p.carrier_dims_cm.l}×${p.carrier_dims_cm.w}×${p.carrier_dims_cm.h} cm` : undefined,
      fee: p.fee, conditions: pick(p.conditions, locale), src: srcView(p.source),
    };
  };

  return {
    summary: pick(pr.summary, locale),
    logo: pr.logo ? { src: pr.logo.src, placeholder: pr.logo.placeholder, alt: pick(pr.logo.alt, locale) } : undefined,
    policy: [pol("cabin"), pol("hold"), pol("cargo")].filter((x): x is PolicyView => x !== null),
    booking: pr.booking ? { text: pick(pr.booking.text, locale) ?? "", src: srcView(pr.booking.source) } : undefined,
    history: (pr.history ?? []).map((h) => ({ year: h.year, event: pick(h.event, locale) ?? "", src: srcView(h.source) })),
    faq: (pr.faq ?? []).map((f) => ({ q: pick(f.q, locale) ?? "", a: pick(f.a, locale) ?? "", src: srcView(f.source) })),
    tips: (pr.tips ?? []).map((tp) => ({ text: pick(tp.text, locale) ?? "", src: srcView(tp.source) })),
  };
}

export interface BreedTravelView {
  score: number;                                   // /100
  stars: number;                                   // /5, 1 decimal
  difficulty: { emoji: string; label: string; explanation: string };
  verdict: string;
  ratings: { label: string; value: number }[];     // each /5
  strengths: string[];
  limitations: string[];
  cabin: string;
  hold: string;
  climate: string;
  tips: string[];
  faq: { q: string; a: string }[];
  similar: { href: string; label: string }[];
  src?: SrcView;
}

/** Breed V2 travel-decision engine — everything computed from the breed's facts (+ sourced behavioural traits). */
function breedTravelView(kb: NormalizedKB, b: {
  id: string; name: string; size: string; weight_kg: number; brachycephalic: boolean; coat?: string;
  travel?: { adaptability: number; sensitivity: number; tolerates_alone: number; cold_tolerance: number; heat_tolerance: number; energy: number; source: { url: string; verified_date: string; confidence: number } };
}, locale: string): BreedTravelView {
  const fr = locale === "fr";
  const L = (en: string, f: string) => (fr ? f : en);
  const w = b.weight_kg, brachy = b.brachycephalic, coat = b.coat, tv = b.travel;

  const cabinFit = w <= 8 ? 5 : w <= 10 ? 3 : w <= 15 ? 2 : 1;
  const holdFit = brachy ? 1 : 5;
  const heatTol = tv?.heat_tolerance ?? (brachy ? 1 : coat === "double" || coat === "thick" ? 2 : 3);
  const coldTol = tv?.cold_tolerance ?? (coat === "double" || coat === "thick" || coat === "long" ? 5 : coat === "short" ? 2 : 3);
  // Travel-favourable conversions of DogTime raw ratings (5 = best for flying)
  const adaptability = tv?.adaptability ?? 3;
  const calm = tv ? 6 - tv.sensitivity : 3;          // low sensitivity → calmer traveller
  const alone = tv?.tolerates_alone ?? 3;            // copes alone → copes crated/in hold
  const lowExercise = tv ? 6 - tv.energy : 3;        // low energy → easier on long journeys

  const structPts = (cabinFit / 5) * 20 + (holdFit / 5) * 20 + (heatTol / 5) * 15 + (coldTol / 5) * 10;
  let score: number;
  if (tv) {
    score = Math.round(structPts + (adaptability / 5) * 15 + (calm / 5) * 10 + (alone / 5) * 5 + (lowExercise / 5) * 5);
  } else {
    score = Math.round((structPts / 65) * 100);
  }
  const stars = Math.round((score / 20) * 10) / 10;

  let level = score >= 80 ? 0 : score >= 60 ? 1 : score >= 40 ? 2 : 3; // easy..very hard
  if (brachy && level < 2) level = 2;
  const DIFF = [
    { emoji: "🟢", label: L("Easy to fly with", "Facile à faire voyager") },
    { emoji: "🟡", label: L("Moderate", "Modéré") },
    { emoji: "🟠", label: L("Difficult", "Difficile") },
    { emoji: "🔴", label: L("Very difficult", "Très difficile") },
  ][level];
  const diffExpl = brachy
    ? L("Snub-nosed breed: airlines restrict or refuse hold/cargo carriage and heat raises real breathing risk, so options and timing must be planned carefully.",
        "Race brachycéphale : les compagnies limitent ou refusent la soute/le fret et la chaleur crée un vrai risque respiratoire — options et dates à planifier soigneusement.")
    : level <= 1
      ? L("Sizes, coat and temperament make this breed a straightforward flyer on most routes.",
          "Taille, pelage et tempérament font de cette race un voyageur simple sur la plupart des lignes.")
      : L("Size or climate sensitivity narrows the options — check cabin limits and seasonal heat before booking.",
          "La taille ou la sensibilité climatique réduit les options — vérifie les limites cabine et la chaleur saisonnière avant de réserver.");

  const bn = breedName(b, locale);
  const verdict = brachy
    ? L(`The ${bn} is a challenging breed to fly: breathing and heat risk dominate every decision.`,
        `Le ${bn} est une race délicate à faire voyager : le risque respiratoire et la chaleur dominent chaque décision.`)
    : cabinFit >= 4
      ? L(`The ${bn} is an easy cabin companion on most airlines.`, `Le ${bn} est un compagnon de cabine facile sur la plupart des compagnies.`)
      : L(`The ${bn} usually travels in the hold — plan the airline and season with care.`, `Le ${bn} voyage généralement en soute — choisis compagnie et saison avec soin.`);

  const ratings = [
    { label: L("Cabin suitability", "Aptitude cabine"), value: cabinFit },
    { label: L("Hold suitability", "Aptitude soute"), value: holdFit },
    { label: L("Heat tolerance", "Tolérance chaleur"), value: heatTol },
    { label: L("Cold tolerance", "Tolérance froid"), value: coldTol },
    ...(tv ? [
      { label: L("Adaptability", "Adaptabilité"), value: adaptability },
      { label: L("Calm temperament", "Tempérament calme"), value: calm },
      { label: L("Copes when alone", "Supporte la solitude"), value: alone },
      { label: L("Low exercise needs", "Faibles besoins d'exercice"), value: lowExercise },
    ] : []),
  ];

  const strengths: string[] = [];
  if (cabinFit >= 4) strengths.push(L("Light enough to fly in the cabin", "Assez léger pour voyager en cabine"));
  if (tv && adaptability >= 4) strengths.push(L("Settles easily into new environments", "S'adapte facilement aux nouveaux environnements"));
  if (tv && lowExercise >= 4) strengths.push(L("Low exercise needs — copes with long journeys", "Faibles besoins d'exercice — supporte les longs trajets"));
  if (tv && alone >= 4) strengths.push(L("Copes well when left alone or crated", "Supporte bien la solitude ou la caisse"));
  if (tv && calm >= 4) strengths.push(L("Even-tempered — low sensitivity to disruption", "Tempérament égal — peu sensible aux perturbations"));
  if (!brachy && holdFit >= 4) strengths.push(L("Can travel safely in the hold when needed", "Peut voyager en soute en toute sécurité si besoin"));
  if (coldTol >= 4) strengths.push(L("Handles cold climates well", "Supporte bien les climats froids"));

  const limitations: string[] = [];
  if (brachy) limitations.push(L("Snub-nosed: breathing & heat risk; hold/cargo often refused", "Museau plat : risque respiratoire et chaleur ; soute/fret souvent refusés"));
  if (heatTol <= 2) limitations.push(L("Very heat-sensitive — avoid summer and hot destinations", "Très sensible à la chaleur — éviter l'été et les destinations chaudes"));
  if (coldTol <= 2) limitations.push(L("Sensitive to cold", "Sensible au froid"));
  if (w > 8 && cabinFit <= 2) limitations.push(L("Usually too heavy for cabin (over ~8 kg with bag)", "Généralement trop lourd pour la cabine (plus de ~8 kg avec le sac)"));
  if (cabinFit <= 2 && holdFit <= 2) limitations.push(L("Hard to place: neither easy cabin nor safe hold", "Difficile à placer : ni cabine facile, ni soute sûre"));
  if (tv && calm <= 2) limitations.push(L("Sensitive temperament — prone to travel stress", "Tempérament sensible — sujet au stress du voyage"));
  if (tv && alone <= 2) limitations.push(L("Dislikes being left alone — separation stress", "Supporte mal la solitude — stress de séparation"));

  const cabin = cabinFit >= 4
    ? L(`Small enough to fly in the cabin on airlines allowing pets up to ~8 kg (dog + bag) under the seat.`,
        `Assez petit pour voyager en cabine sur les compagnies acceptant les animaux jusqu'à ~8 kg (chien + sac) sous le siège.`)
    : L(`Adults usually exceed the ~8 kg cabin limit; only the smallest individuals or puppies may qualify, and only on airlines that allow it.`,
        `Les adultes dépassent généralement la limite cabine de ~8 kg ; seuls les plus petits sujets ou les chiots peuvent y prétendre, et uniquement sur les compagnies qui l'autorisent.`);

  const hold = brachy
    ? L(`As a snub-nosed breed, hold and cargo carriage is restricted or refused by many airlines, and a global heat/breathing risk applies. Where accepted, avoid warm-weather flights and use a roomy, well-ventilated IATA crate.`,
        `Race brachycéphale : le transport en soute et en fret est limité ou refusé par de nombreuses compagnies, avec un risque chaleur/respiration global. Lorsqu'il est accepté, évitez les vols par temps chaud et utilisez une caisse IATA spacieuse et bien ventilée.`)
    : L(`Travels in the pressurised, temperature-controlled hold in an IATA-compliant crate when above cabin limits. Book early and prefer cooler times of day.`,
        `Voyage dans la soute pressurisée et climatisée, dans une caisse conforme IATA au-dessus des limites cabine. Réserve tôt et privilégiez les heures fraîches.`);

  const climate = heatTol <= 2
    ? L(`Best suited to cool and temperate climates. Hot and tropical destinations — and summer departures — are risky and often blocked by seasonal heat embargoes.`,
        `Mieux adapté aux climats frais et tempérés. Les destinations chaudes et tropicales — et les départs d'été — sont risqués et souvent bloqués par les embargos chaleur saisonniers.`)
    : coldTol >= 4
      ? L(`Comfortable in cool to cold climates thanks to its coat; watch heat on warm-weather routes.`,
          `À l'aise dans les climats frais à froids grâce à son pelage ; surveillez la chaleur sur les lignes par temps chaud.`)
      : L(`Handles temperate climates well; take extra care in extreme heat or cold.`,
          `Supporte bien les climats tempérés ; redoublez de prudence en cas de chaleur ou de froid extrêmes.`);

  const tips: string[] = [];
  if (heatTol <= 2) tips.push(L("Prefer early-morning or night departures and cooler seasons", "Privilégiez les départs tôt le matin ou de nuit et les saisons fraîches"));
  if (brachy) tips.push(L("Choose an airline that accepts snub-nosed breeds and confirm in writing", "Choisis une compagnie qui accepte les races brachycéphales et confirme par écrit"));
  tips.push(L("Use a well-ventilated carrier one size up for easier breathing", "Utilisez un sac/caisse bien ventilé, une taille au-dessus, pour faciliter la respiration"));
  tips.push(L("Bring water and offer small sips; avoid feeding just before the flight", "Emporte de l'eau et proposez de petites gorgées ; évitez de nourrir juste avant le vol"));
  if (coldTol <= 2) tips.push(L("Pack a light layer for cold cabins and tarmac waits", "Prévois une petite couverture pour les cabines froides et les attentes sur le tarmac"));

  const faq = [
    { q: L("Can this breed fly in the cabin?", "Cette race peut-elle voyager en cabine ?"), a: cabin },
    { q: L("Is it heat sensitive?", "Est-elle sensible à la chaleur ?"), a: heatTol <= 2 ? L("Yes — strongly. Avoid hot destinations and summer flights.", "Oui — fortement. Évitez les destinations chaudes et les vols d'été.") : L("Moderately; take normal heat precautions.", "Modérément ; prends les précautions habituelles.") },
    { q: L("Does it travel well?", "Voyage-t-elle bien ?"), a: verdict },
  ];

  const similar = [...kb.breeds.values()]
    .filter((o) => o.id !== b.id && o.brachycephalic === brachy && Math.abs(o.weight_kg - w) <= 12)
    .sort((x, y) => Math.abs(x.weight_kg - w) - Math.abs(y.weight_kg - w))
    .slice(0, 6)
    .map((o) => ({ href: hrefFor(o.id, locale), label: breedName(o, locale) }));

  return {
    score, stars,
    difficulty: { emoji: DIFF.emoji, label: DIFF.label, explanation: diffExpl },
    verdict, ratings, strengths: strengths.slice(0, 4), limitations: limitations.slice(0, 4),
    cabin, hold, climate, tips: tips.slice(0, 5), faq, similar,
    src: tv ? srcView(tv.source) : undefined,
  };
}

/** Build the localized EntityPage view-model for any entity (single source of logic). */
export function entityProps(kb: NormalizedKB, id: string, locale: string): EntityProps {
  const kind = kindOf(id);
  const finderContext = t(locale, "cta.default");

  if (kind === "airline") {
    const a = kb.airlines.get(id)!;
    return {
      kind: t(locale, "kind.airline"),
      title: a.name,
      subtitle: [a.alliance !== "none" ? a.alliance.replace(/_/g, " ") : null, labelOf(kb, a.country_id, locale)].filter(Boolean).join(" · "),
      facts: [
        { label: t(locale, "fact.iata"), value: a.iata },
        { label: t(locale, "fact.alliance"), value: a.alliance.replace(/_/g, " ") },
        { label: t(locale, "fact.serves"), value: `${a.serves_country_ids.length} ${t(locale, "fact.destinations")}` },
      ],
      rules: locRules(rulesForScope(kb, "airline", id), locale),
      related: rel(kb, relatedIds(kb, id), locale),
      relatedTitle: t(locale, "section.destinations"),
      schema: schemaFor(kb, id, locale),
      finderContext,
      premium: premiumView(a, locale),
      guide: guideView(id, locale),
      contact: contactView((a as { contact?: unknown }).contact, locale),
      monogram: true,
    };
  }

  if (kind === "country") {
    const c = kb.countries.get(id)!;
    const cname = labelOf(kb, id, locale);
    const LL = (en: string, fr: string) => (locale === "fr" ? fr : en);
    const entryFactors: EntryFactorsView = {
      title: LL("How your dog's entry requirements are decided", "Comment les formalités d'entrée de ton chien sont déterminées"),
      intro: LL("The exact documents depend on three things — this destination is only the first.", "Les documents exigés dépendent de trois éléments — cette destination n'est que le premier."),
      factors: [
        {
          stars: 5,
          label: LL("Destination country", "Pays de destination"),
          text: LL(`${cname} sets the rules for entering ${cname} — that's what this page describes.`, `${cname} fixe les règles d'entrée sur son territoire — c'est ce que décrit cette page.`),
        },
        {
          stars: 5,
          label: LL("Country of departure", "Pays de départ"),
          text: LL("Your dog's country of origin decides which version of those rules applies. Arriving from an EU country isn't the same as from the US, Morocco or Haiti — third countries often need an EU animal health certificate, and higher-risk rabies countries a rabies antibody (titer) test.", "Le pays d'origine de ton chien détermine quelle version de ces règles s'applique. Arriver d'un pays de l'UE n'est pas la même chose que des États-Unis, du Maroc ou d'Haïti — les pays tiers exigent souvent un certificat sanitaire UE, et les pays à haut risque rabique un test sérologique antirabique."),
        },
        {
          stars: 4,
          label: LL("Country of prior residence", "Pays de résidence récente"),
          text: LL("Authorities often look at where the dog actually lived in the months before travel — not just the last airport. A dog flying from Belgium but living in Morocco the week before may be treated as coming from Morocco.", "Les autorités regardent souvent où le chien a réellement résidé les mois précédant le voyage — pas seulement le dernier aéroport. Un chien parti de Belgique mais vivant au Maroc la semaine d'avant peut être considéré comme venant du Maroc."),
        },
      ],
      note: LL("So read the requirements below as this destination's framework — then confirm the exact version for your dog's origin and recent residence.", "Lis donc les formalités ci-dessous comme le cadre de cette destination — puis confirme la version exacte selon l'origine et la résidence récente de ton chien."),
    };
    return {
      kind: t(locale, "kind.country"),
      title: labelOf(kb, id, locale),
      subtitle: c.region,
      entryFactors,
      facts: [
        { label: t(locale, "fact.iso"), value: c.iso2 },
        { label: t(locale, "fact.region"), value: c.region },
        ...(c.pet_scheme ? [{ label: t(locale, "fact.scheme"), value: schemeLabel(c.pet_scheme, locale) }] : []),
      ],
      rules: locRules(rulesForScope(kb, "country", id), locale),
      related: rel(kb, relatedIds(kb, id).filter((rid) => kindOf(rid) === "airline"), locale),
      relatedTitle: t(locale, "section.servedby"),
      schema: schemaFor(kb, id, locale),
      finderContext,
      guide: guideView(id, locale),
      headFlag: iso2Flag(c.iso2),
    };
  }

  if (kind === "airport") {
    const a = kb.airports.get(id)!;
    const relIds = [a.country_id, ...neighbors(kb, a.country_id, "SERVES", "in")];
    return {
      kind: t(locale, "kind.airport"),
      title: `${a.iata} · ${airportName(a, locale)}`,
      subtitle: `${cityName(a, locale)} · ${labelOf(kb, a.country_id, locale)}`,
      facts: [
        { label: t(locale, "fact.iata"), value: a.iata },
        { label: t(locale, "fact.city"), value: cityName(a, locale) },
        { label: t(locale, "fact.country"), value: labelOf(kb, a.country_id, locale) },
        ...(a.info?.terminals ? [{ label: t(locale, "fact.terminals"), value: a.info.terminals }] : []),
      ],
      rules: locRules(rulesForScope(kb, "country", a.country_id), locale),
      related: rel(kb, relIds.filter((rid) => kindOf(rid) === "airline"), locale),
      relatedTitle: t(locale, "section.servedby"),
      schema: schemaFor(kb, id, locale),
      finderContext,
      petRelief: petReliefView(a.pet_relief, locale),
      airportInfo: airportInfoView(a.info, locale),
      headFlag: iso2Flag(kb.countries.get(a.country_id)?.iso2),
    };
  }

  // breed
  const b = kb.breeds.get(id)!;
  const rules = rulesForBreed(kb, id);
  const relIds = [...new Set(rules.filter((r) => r.scope.type === "airline" && r.scope.id).map((r) => r.scope.id as string))];
  return {
    kind: t(locale, "kind.breed"),
    title: breedName(b, locale),
    subtitle: `${t(locale, `size.${b.size}`, b.size)} · ${b.weight_kg} kg${b.brachycephalic ? " · " + t(locale, "fact.brachy").toLowerCase() : ""}`,
    facts: [
      { label: t(locale, "fact.size"), value: t(locale, `size.${b.size}`, b.size) },
      { label: t(locale, "fact.weight"), value: `${b.weight_kg} kg` },
      { label: t(locale, "fact.brachy"), value: b.brachycephalic ? t(locale, "brachy.yes") : t(locale, "brachy.no") },
      ...(b.coat ? [{ label: t(locale, "fact.coat"), value: t(locale, `coat.${b.coat}`, b.coat) }] : []),
    ],
    rules: [],                       // breed decision now lives in the V2 travel sections; generic rules removed
    related: rel(kb, relIds, locale),
    schema: schemaFor(kb, id, locale),
    finderContext,
    guide: guideView(id, locale),
    breedTravel: breedTravelView(kb, b, locale),
  };
}

interface IndexItem { href: string; label: string; sub?: string; flag?: string }
export function indexItems(kb: NormalizedKB, kind: string, locale: string): IndexItem[] {
  const sort = (a: IndexItem, b: IndexItem) => a.label.localeCompare(b.label);
  if (kind === "airline")
    return [...kb.airlines.values()].map((a) => ({ href: hrefFor(a.id, locale), label: a.name, sub: `${a.iata} · ${a.serves_country_ids.length} ${t(locale, "fact.destinations")}` })).sort(sort);
  if (kind === "country")
    return [...kb.countries.values()].map((c) => ({ href: hrefFor(c.id, locale), label: labelOf(kb, c.id, locale), sub: c.pet_scheme ? schemeLabel(c.pet_scheme, locale) : c.region, flag: iso2Flag(c.iso2) })).sort(sort);
  if (kind === "airport")
    return [...kb.airports.values()].map((a) => ({ href: hrefFor(a.id, locale), label: `${a.iata} · ${airportName(a, locale)}`, sub: labelOf(kb, a.country_id, locale) })).sort(sort);
  return [...kb.breeds.values()].map((b) => ({ href: hrefFor(b.id, locale), label: breedName(b, locale), sub: `${t(locale, `size.${b.size}`, b.size)} · ${b.weight_kg} kg${b.brachycephalic ? " · " + t(locale, "fact.brachy").toLowerCase() : ""}` })).sort(sort);
}

export interface MenuItem { href: string; label: string; flag?: string; badge?: string }
/** Flat, sorted list of one entity type → powers a nav dropdown. Data-driven (mirrors the index pages).
    Countries carry a leading flag; brachycephalic breeds carry a trailing snout badge (breathing risk). */
export function menuList(kb: NormalizedKB, kind: string, locale: string): MenuItem[] {
  const sort = (a: MenuItem, b: MenuItem) => a.label.localeCompare(b.label);
  if (kind === "airline")
    return [...kb.airlines.values()].map((a) => ({ href: hrefFor(a.id, locale), label: a.name })).sort(sort);
  if (kind === "country")
    return [...kb.countries.values()].map((c) => ({ href: hrefFor(c.id, locale), label: labelOf(kb, c.id, locale), flag: iso2Flag(c.iso2) })).sort(sort);
  if (kind === "airport")
    return [...kb.airports.values()].map((a) => ({ href: hrefFor(a.id, locale), label: `${a.iata} · ${airportName(a, locale)}` })).sort(sort);
  return [...kb.breeds.values()].map((b) => ({ href: hrefFor(b.id, locale), label: breedName(b, locale), badge: b.brachycephalic ? "🐽" : undefined })).sort(sort);
}

/**
 * Les entrées les plus consultées d'une famille, dans l'ordre de la demande mesurée.
 *
 * Le menu listait les 78 compagnies, 140 pays et 172 races sur CHACUNE des 1 986 pages :
 * 390 liens répétés, deux tiers de l'HTML, et — sous 820 px — un panneau que le CSS masque
 * entièrement. On garde donc les dix premières et on renvoie vers la page d'index, qui est
 * l'annuaire complet et filtrable.
 *
 * L'ordre vient de `popular.generated.json`, produit depuis un export Search Console daté.
 * Une entrée du fichier qui ne correspond à aucune entité de la KB est ignorée en silence :
 * un slug peut disparaître d'un export à l'autre, ce n'est pas une erreur de build.
 */
export function menuTop(kb: NormalizedKB, kind: string, locale: string, cap = 10): MenuItem[] {
  const fam = kind === "airline" ? "airlines" : kind === "country" ? "countries" : kind === "airport" ? "airports" : "breeds";
  const keys: string[] = (popular as unknown as Record<string, { key: string }[]>)[fam]?.map((x) => x.key) ?? [];
  const out: MenuItem[] = [];
  for (const key of keys) {
    if (fam === "countries") {
      const c = [...kb.countries.values()].find((x) => x.iso2.toLowerCase() === key);
      if (c) out.push({ href: hrefFor(c.id, locale), label: labelOf(kb, c.id, locale), flag: iso2Flag(c.iso2) });
    } else if (fam === "airlines") {
      const a = [...kb.airlines.values()].find((x) => x.id.split("_").slice(1).join("-") === key);
      if (a) out.push({ href: hrefFor(a.id, locale), label: a.name });
    } else if (fam === "breeds") {
      const b = [...kb.breeds.values()].find((x) => x.id.split("_").slice(1).join("-") === key);
      if (b) out.push({ href: hrefFor(b.id, locale), label: breedName(b, locale), badge: b.brachycephalic ? "🐽" : undefined });
    } else {
      const ap = [...kb.airports.values()].find((x) => x.iata.toLowerCase() === key);
      if (ap) out.push({ href: hrefFor(ap.id, locale), label: `${ap.iata} · ${cityName(ap, locale)}` });
    }
    if (out.length >= cap) break;
  }
  return out.slice(0, cap);
}

/** Nombre total d'entités d'une famille — affiché sur le lien « tout voir » du menu. */
export function familyTotal(kb: NormalizedKB, kind: string): number {
  return kind === "airline" ? kb.airlines.size : kind === "country" ? kb.countries.size : kind === "airport" ? kb.airports.size : kb.breeds.size;
}

export interface CountryNav { href: string; label: string; flag: string; airports: { href: string; label: string }[] }
/** Countries that have at least one airport → each with its airports. Powers the Countries dropdown (menu drill-down to airports). */
export function countryAirportNav(kb: NormalizedKB, locale: string): CountryNav[] {
  const byCountry = new Map<string, { href: string; label: string }[]>();
  for (const a of [...kb.airports.values()].sort((x, y) => `${cityName(x, locale)}${x.iata}`.localeCompare(`${cityName(y, locale)}${y.iata}`))) {
    const list = byCountry.get(a.country_id) ?? [];
    list.push({ href: hrefFor(a.id, locale), label: `${a.iata} · ${airportName(a, locale)}` });
    byCountry.set(a.country_id, list);
  }
  return [...byCountry.entries()]
    .map(([cid, airports]) => ({
      href: hrefFor(cid, locale),
      label: labelOf(kb, cid, locale),
      flag: iso2Flag(kb.countries.get(cid)?.iso2),
      airports,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Airports that have a confirmed pet / service-animal relief area — powers the dedicated SEO index. Data-driven: only entities marked available === "yes". */
export function petReliefIndexItems(kb: NormalizedKB, locale: string): IndexItem[] {
  return [...kb.airports.values()]
    .filter((a) => (a as { pet_relief?: { available?: string } }).pet_relief?.available === "yes")
    .map((a) => {
      const pr = (a as { pet_relief?: { post_security?: boolean } }).pet_relief;
      const tag = pr?.post_security ? t(locale, "petrelief.airside") : null;
      return {
        href: hrefFor(a.id, locale),
        label: `${a.iata} · ${airportName(a, locale)}`,
        sub: [`${cityName(a, locale)}, ${labelOf(kb, a.country_id, locale)}`, tag].filter(Boolean).join(" · "),
      };
    })
    .sort((x, y) => x.label.localeCompare(y.label));
}
