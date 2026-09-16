import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--root")) {
  console.error("usage : node audit-raccordement-finder.mjs [--root <répertoire>]");
  process.exit(2);
}
const ROOT = args.length === 2 ? resolve(args[1]) : resolve(import.meta.dirname, "../../..");
const CONTENT = resolve(ROOT, "content/airlines");
const GENERATED = resolve(ROOT, "packages/ui/src/data/airlines.generated.json");
const OBJECTS = resolve(ROOT, "packages/knowledge/raw/objects.json");
const RULES = resolve(ROOT, "packages/knowledge/raw/rules.json");
const BREED_RESTRICTIONS = resolve(ROOT, "packages/knowledge/raw/breed-restrictions.json");
const PLACEMENTS = ["cabin", "hold", "cargo"];
const SYNC_FIELDS = [
  "availability", "review_state", "max_weight_kg", "min_weight_kg",
  "weight_includes_carrier", "weight_limit_bound", "weight_min_bound", "min_weight_includes_carrier",
  "carrier_dims_cm", "conditions", "source", "attestations", "fares", "fare_conflicts",
];

const generated = JSON.parse(readFileSync(GENERATED, "utf8"));
const objects = JSON.parse(readFileSync(OBJECTS, "utf8"));
const rules = JSON.parse(readFileSync(RULES, "utf8"));
const breedRestrictions = JSON.parse(readFileSync(BREED_RESTRICTIONS, "utf8"));
const canonical = new Map(objects.airlines.map((airline) => [airline.id, airline.premium?.policy ?? {}]));
const issues = [];

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
/* Le contrat de source matérialise `history: []` par défaut. Son absence dans le YAML et le
   tableau vide produit par Zod sont la même valeur métier, pas une divergence de raccordement. */
const comparableField = (field, value) => field === "source" && value && value.history === undefined
  ? { ...value, history: [] }
  : value;
const add = (code, id, placement, detail) => issues.push({ code, id, placement, detail });
const localized = (value) => typeof value === "string" ? value : value?.en ?? "";
const sourceComplete = (source) => Boolean(
  source?.url && source?.quote && source?.quote_language && source?.locator,
);
const predicateFacts = (predicate) => {
  if (!predicate || typeof predicate !== "object") return [];
  if (typeof predicate.fact === "string") return [predicate.fact];
  return [...(predicate.all ?? []), ...(predicate.any ?? []), ...(predicate.not ? [predicate.not] : [])].flatMap(predicateFacts);
};
const predicateLeaves = (predicate) => {
  if (!predicate || typeof predicate !== "object") return [];
  if (typeof predicate.fact === "string") return [predicate];
  return [...(predicate.all ?? []), ...(predicate.any ?? [])].flatMap(predicateLeaves)
    .concat(predicate.not ? predicateLeaves(predicate.not) : []);
};

/** Nombres immédiatement exprimés en kilogrammes dans les langues réellement présentes dans
 *  les sources nationales (alphabet latin, cyrillique, chinois, hébreu et arabe). Une graphie
 *  parenthétique telle que « eight (8) kilos » ou « 9 (nine) kilograms » reste une valeur citée.
 *  Les années, dimensions, livres et tarifs sont exclus. */
const kilograms = (text) => [...String(text).matchAll(/(?:^|[^\d])([0-9]+(?:[.,][0-9]+)?)(?:\s*\([^)]{1,24}\))?\s*\)?\s*(?:kg|kilograms?|kilos?|кг|公斤|千克|ק["״']?ג|كجم)(?![a-z])/giu)]
  .map((match) => Number(match[1].replace(",", ".")));

for (const filename of readdirSync(CONTENT).filter((name) => name.endsWith(".yml") && !name.startsWith("_"))) {
  const fiche = parse(readFileSync(resolve(CONTENT, filename), "utf8"));
  const id = fiche.id;
  const fichePolicies = fiche.policies ?? {};
  const publicPolicies = generated[id]?.policies ?? {};
  const enginePolicies = canonical.get(id) ?? {};
  const channels = fiche.channels ?? [];
  const placements = channels.map((channel) => channel.placement);

  if (!equal(fiche.restrictions, generated[id]?.restrictions)) {
    add("FICHE_GENERATED_DRIFT", id, "restrictions", "les restrictions visibles diffèrent de la fiche source");
  }

  /* RÉSUMÉ VISUEL CONTRE POLITIQUE CANONIQUE (16/09/2026). Air China portait
     `policies.cabin.availability: offered` — arbitré, sourcé, servi par le Finder — pendant que
     le haut de sa fiche annonçait « transport en soute uniquement », et que sa frise réduisait la
     cabine à un éclat gris de 8 % sans libellé. Aucun de ces champs n'était rendu ce jour-là, de
     sorte que rien ne se voyait en production ; c'est ce qui rend le défaut dangereux, puisqu'un
     gabarit qui les réafficherait publierait une contradiction que personne n'a décidée. La garde
     s'exécute donc sur la FICHE SOURCE et non sur le HTML construit : un contrôle du rendu aurait
     été vert ce jour-là, et aveugle à la classe entière.

     ELLE NE LIT PAS LA PROSE, ET C'EST DÉLIBÉRÉ. Une première version cherchait des formules de
     refus (« hold-only », « soute uniquement ») dans `metaDesc` et `verdictNote`. Mesurée sur les
     102 fiches, elle a levé 36 alertes sur 13 compagnies dont la quasi-totalité étaient fausses :
     la langue porte une portée que la sous-chaîne ignore. « Snub-nosed breeds cabin-only » chez
     SWISS et Brussels qualifie une RACE, « flat-faced breeds allowed in the cabin only » chez
     TAROM aussi, « hold (AVIH) is restricted to domestic flights » chez Pegasus qualifie une
     ROUTE. Aucune de ces phrases ne refuse le canal. Une garde qui crie à tort finit désactivée,
     et une garde désactivée ne protège rien : le lexique a donc été retiré au profit des deux
     signaux STRUCTURÉS que portait réellement le cas Air China, où la portée n'existe pas.

     Restent, hors machine et pour relecture humaine : China Southern, dont le résumé affirme un
     refus catégorique en cabine dans les quatre langues alors que la politique dit
     `case_by_case` — c'est le conflit officiel déjà documenté, pas une négligence. */
  const GRIS_INDISPONIBLE = "#8a94a3";
  const LIBELLE_MUET = new Set(["", "-", "—"]);
  /* Dette nommée plutôt que silencieuse : Aer Lingus déclare `hold: offered` alors que sa frise
     et son résumé disent que tout passe par IAG Cargo via un agent. Savoir si c'est la politique
     ou la frise qui a tort demande un arbitrage — pas une retouche. La garde la compte sans la
     masquer ; l'exception disparaît le jour où l'arbitrage est rendu. */
  const ARBITRAGES_EN_ATTENTE = new Set(["airline_aer_lingus\thold"]);
  for (const segment of fiche.ladder ?? []) {
    const canal = segment.label?.en?.toLowerCase();
    const placement = canal === "cabin" ? "cabin" : canal === "hold" ? "hold" : null;
    if (!placement || fichePolicies[placement]?.availability !== "offered") continue;
    if (ARBITRAGES_EN_ATTENTE.has(`${id}\t${placement}`)) continue;
    if (segment.color === GRIS_INDISPONIBLE) {
      add("LADDER_GREY_ON_OFFERED", id, placement,
        "la frise peint le canal en gris d'indisponibilité alors que la politique l'offre");
    }
    const sousTitre = typeof segment.sub === "string" ? segment.sub : segment.sub?.en;
    if (LIBELLE_MUET.has((sousTitre ?? "").trim())) {
      add("LADDER_MUTE_ON_OFFERED", id, placement,
        "la frise laisse le canal sans libellé alors que la politique l'offre");
    }
  }

  if (new Set(placements).size !== placements.length) add("CHANNEL_DUPLICATE", id, "-", placements.join(", "));
  for (const placement of PLACEMENTS) {
    const channelCount = placements.filter((candidate) => candidate === placement).length;
    const hasPolicy = fichePolicies[placement] !== undefined;
    /* Les trois canaux sont désormais toujours matérialisés, y compris quand la seule réponse
       honnête est « à confirmer ». Une absence ne doit plus dépendre d'un repli implicite du
       Finder ni laisser la fiche détaillée raconter moins que l'outil. */
    if (channelCount > 1) add("CHANNEL_DUPLICATE", id, placement, `${channelCount} canaux visibles`);
    if (channelCount === 0) add("CHANNEL_MISSING", id, placement, "aucune carte visible pour ce canal");
    if (!hasPolicy) add("POLICY_MISSING", id, placement, "aucune décision explicite dans la fiche");
    if (channelCount > 0 && !hasPolicy) add("VISIBLE_CHANNEL_WITHOUT_POLICY", id, placement, "carte visible sans décision dans la fiche");
    if (!hasPolicy) {
      if (publicPolicies[placement] !== undefined) add("ORPHAN_PUBLIC_POLICY", id, placement, "politique publique absente de la fiche source");
      if (enginePolicies[placement] !== undefined) add("ORPHAN_FINDER_POLICY", id, placement, "politique Finder absente de la fiche source");
      continue;
    }

    const authored = fichePolicies[placement];
    const channel = channels.find((candidate) => candidate.placement === placement);
    const categoricallyDenied = authored.availability === "not_offered";
    /* Une couleur rouge est elle-même une affirmation de refus. Elle ne peut pas coexister avec
       `offered`, `case_by_case` ou `legacy_unreviewed`; inversement, un refus canonique ne peut
       être adouci visuellement. Le texte libre reste informatif, mais la décision est unique. */
    if (channel && categoricallyDenied && channel.cls !== "no") {
      add("CHANNEL_POLICY_STATUS_DRIFT", id, placement, `refus canonique affiché avec cls=${channel.cls}`);
    }
    if (channel && !categoricallyDenied && channel.cls === "no") {
      add("CHANNEL_POLICY_STATUS_DRIFT", id, placement, `${authored.availability ?? authored.review_state} affiché comme refus`);
    }
    /* Toute disponibilité catégorique — oui, non ou au cas par cas — doit porter sa propre
       phrase officielle. Sans elle, la seule valeur admissible est `legacy_unreviewed`. */
    if (authored.availability !== undefined && !sourceComplete(authored.source)) {
      add("CATEGORICAL_POLICY_SOURCE_INCOMPLETE", id, placement, `${authored.availability} sans URL, citation, langue et locator propres`);
    }
    const published = publicPolicies[placement] ?? {};
    const canonicalPolicy = enginePolicies[placement] ?? {};
    for (const field of SYNC_FIELDS) {
      const expected = authored[field];
      /* `conditions` est encore un enrichissement curatorial conservé lorsque la fiche n'en
         porte pas. Dès qu'elle l'écrit, il redevient opposable et doit être identique partout. */
      if (field === "conditions" && expected === undefined) continue;
      /* Une source absente de la fiche est dérivée de sa provenance générale ou conservée par
         l'allowlist curatoriale. Une source explicitement écrite, elle, doit traverser intacte. */
      if (field === "source" && expected === undefined) continue;
      if (!equal(comparableField(field, expected), comparableField(field, published[field]))) {
        add("FICHE_GENERATED_DRIFT", id, placement, `${field}: fiche=${JSON.stringify(expected)} généré=${JSON.stringify(published[field])}`);
      }
      if (!equal(comparableField(field, expected), comparableField(field, canonicalPolicy[field]))) {
        add("FICHE_FINDER_DRIFT", id, placement, `${field}: fiche=${JSON.stringify(expected)} Finder=${JSON.stringify(canonicalPolicy[field])}`);
      }
    }

    const hasWeight = authored.max_weight_kg != null || authored.min_weight_kg != null;
    if (authored.max_weight_kg != null && typeof authored.weight_includes_carrier !== "boolean") {
      add("WEIGHT_SUBJECT_MISSING", id, placement, "un plafond sans sujet pesé explicite");
    }
    if (authored.min_weight_kg != null
      && typeof (authored.min_weight_includes_carrier ?? authored.weight_includes_carrier) !== "boolean") {
      add("WEIGHT_SUBJECT_MISSING", id, placement, "un plancher sans sujet pesé explicite");
    }
    if (hasWeight) {
      const source = authored.source;
      if (!source?.quote || !source?.locator || !source?.quote_language) {
        add("WEIGHT_SOURCE_INCOMPLETE", id, placement, "le seuil n'a pas de citation, langue et locator propres");
      } else {
        const citedWeights = new Set(kilograms(source.quote));
        for (const value of [authored.min_weight_kg, authored.max_weight_kg].filter((candidate) => candidate != null)) {
          if (!citedWeights.has(value)) {
            add("WEIGHT_VALUE_ABSENT_FROM_QUOTE", id, placement, `${value} kg absent de la citation propre au canal`);
          }
        }
      }
    }
  }

  /* `brachy_allowed` ne porte aucun rattachement fait → preuve. Une ancienne dérivation depuis
     les pastilles éditoriales généraliserait des exceptions de race, route, pays ou saison.
     Tant qu'un contrat dédié n'existe pas, ce booléen ne doit donc plus atteindre le runtime. */
  for (const placement of PLACEMENTS) {
    if (enginePolicies[placement]?.brachy_allowed !== undefined) {
      add("BRACHY_FLAG_WITHOUT_ATTESTATION", id, placement, "booléen brachycéphale sans preuve et portée structurées");
    }
  }

  /* La frise est la promesse chiffrée la plus visible de la fiche. Chaque valeur de poids qui y
     décrit un canal doit être portée par la politique canonique de ce canal. Les paliers de prix,
     âges et poids « par animal » n'ont rien à faire dans cette frise de décision. */
  for (const segment of fiche.ladder ?? []) {
    const label = localized(segment.label).toLowerCase();
    const placement = /cabin/.test(label) ? "cabin"
      : /hold|baggage/.test(label) ? "hold"
      : /cargo|freight/.test(label) ? "cargo" : undefined;
    if (!placement) continue;
    const values = kilograms(localized(segment.sub));
    if (!values.length) continue;
    const policy = fichePolicies[placement] ?? {};
    const represented = new Set([policy.min_weight_kg, policy.max_weight_kg].filter((value) => value != null));
    for (const value of values) {
      if (!represented.has(value)) add("LADDER_WEIGHT_UNLINKED", id, placement, `${value} kg dans « ${localized(segment.sub)} »`);
    }
  }
}

/* Une race ou un trait n'est jamais interdit uniformément par simple défaut. Le registre dédié
   accepte une portée globale pour un AVIS général (cas IATA), mais une décision `deny`, `allow`
   ou `require` doit nommer une compagnie ou borner son application à un trajet, un pays, une
   saison ou une température. Sinon une politique particulière deviendrait celle des 102
   compagnies — exactement la généralisation que l'utilisateur vient d'interdire. */
for (const restriction of breedRestrictions) {
  if (restriction.airline_id !== undefined || restriction.action === "warn") continue;
  const facts = predicateFacts(restriction.when);
  const hasScope = facts.some((fact) => fact.startsWith("route.") || fact === "season.month" || fact === "weather.temperature_c");
  if (!hasScope) {
    add("UNIVERSAL_BREED_RESTRICTION", "global", restriction.placements?.join(",") ?? "-", restriction.id);
  }
}

/* Une limite globale de poids ne doit plus vivre dans `rules.json`. Elle y constituait une
   seconde source de vérité, souvent ancienne, capable de remettre un canal « à confirmer »
   après la correction de sa fiche. Les règles de poids restent légitimes pour une exception de
   trajet, de marché ou de saison ; sans fait de portée, la limite appartient à `policies`. */
for (const rule of rules) {
  const facts = predicateFacts(rule.applies_when);
  if (facts.includes("dog.brachycephalic")) {
    const source = rule.source;
    if (!sourceComplete(source)) {
      add("BRACHY_RULE_SOURCE_INCOMPLETE", rule.scope?.id ?? rule.scope?.type ?? "-", rule.effect?.placement?.join(",") ?? "-", rule.id);
    }
    const scopedPlacements = new Set(predicateLeaves(rule.applies_when)
      .filter((leaf) => leaf.fact === "placement" && ["eq", "in"].includes(leaf.op))
      .flatMap((leaf) => Array.isArray(leaf.value) ? leaf.value : [leaf.value]));
    for (const placement of rule.effect?.placement ?? []) {
      if (!scopedPlacements.has(placement)) {
        add("BRACHY_RULE_PLACEMENT_UNSCOPED", rule.scope?.id ?? rule.scope?.type ?? "-", placement, rule.id);
      }
    }
    const hasScope = facts.some((fact) => fact.startsWith("route.") || fact === "season.month" || fact === "weather.temperature_c");
    if (rule.scope?.type === "global" && rule.effect?.action !== "warn" && !hasScope) {
      add("UNIVERSAL_BRACHY_RULE", "global", rule.effect?.placement?.join(",") ?? "-", rule.id);
    }
  }
  if (!facts.includes("dog.weight_kg")) continue;
  const placement = rule.effect?.placement?.join(",") ?? "-";
  if (rule.scope?.type === "global") {
    add("UNIVERSAL_WEIGHT_RULE", "global", placement, `${rule.id} — une limite compagnie ne peut pas être universelle`);
  }
  if (rule.scope?.type === "airline" && !facts.some((fact) => fact.startsWith("route.") || fact === "season.month")) {
    add("GLOBAL_WEIGHT_RULE_OUTSIDE_POLICY", rule.scope.id, placement, rule.id);
  }
  const source = rule.source;
  if (!source?.quote || !source?.locator || !source?.quote_language) {
    add("WEIGHT_RULE_SOURCE_INCOMPLETE", rule.scope.id, placement, rule.id);
  }
}

issues.sort((a, b) => `${a.code}\t${a.id}\t${a.placement}`.localeCompare(`${b.code}\t${b.id}\t${b.placement}`));
if (issues.length) {
  console.error(`✗ audit raccordement Finder : ${issues.length} divergence(s)`);
  for (const issue of issues) console.error(`${issue.code}\t${issue.id}\t${issue.placement}\t${issue.detail}`);
  process.exitCode = 1;
} else {
  console.log(`✓ audit raccordement Finder : ${Object.keys(generated).length} compagnies × 3 canaux matérialisés, aucune divergence`);
}
