import { z } from "zod";
import { DogSize, LocalizedText, Placement, Source, TravelType, isForbiddenSource, FACTUAL_SOURCE_TYPES } from "./common";
import { Op } from "./rules";

/**
 * Contrat des restrictions de race — schéma seul, sans données (lot P0-A, 12/08/2026).
 *
 * POURQUOI CE CONTRAT EXISTE
 *
 * La politique brachycéphale est écrite TROIS fois, à trois endroits qui ne se parlent pas :
 * les pastilles de fiche (présentation), `premium.policy[canal].brachy_allowed` (déduit de ces
 * pastilles par expression régulière), et 48 règles de `rules.json` toutes de la forme
 * `deny hold+cargo`. Les trois se contredisent — mesuré sur `main` à `dd18f11` : quatre
 * compagnies dont la fiche ouvre le fret et dont la règle le ferme, 41 règles sur 48 sourcées
 * sur `mydogcanfly.com`, et une règle globale qui déclare une interdiction universelle en citant
 * une page IATA dont le texte vivant dit seulement « in hot season is not recommended ».
 *
 * CE FICHIER NE CHANGE AUCUN VERDICT et ne contient aucune donnée. Il pose la forme que les faits
 * devront prendre, et surtout les invariants qui les rendront vérifiables.
 *
 * PRINCIPE DIRECTEUR, appris à nos dépens : un contrat ne vaut que par ce qu'il REFUSE. La
 * première version de ce fichier acceptait `temperature_c > "hot"`, `fr.mydogcanfly.com` comme
 * source, et ignorait les conflits entre une règle globale et une règle compagnie. Chaque
 * invariant ci-dessous existe parce qu'une contre-épreuve l'a mis en défaut.
 */

// ---------------------------------------------------------------------------------------------
// 1. Registre des faits — nom, TYPE, opérateurs admis
// ---------------------------------------------------------------------------------------------

/**
 * Les faits que `evaluate.ts` injecte réellement, avec leur type.
 *
 * Restreindre le NOM du fait ne suffit pas : `weather.temperature_c > "hot"` porte un nom
 * valide et ne s'évaluera jamais correctement (`evalPredicate` exige deux nombres et renvoie
 * `false` en silence). Le registre porte donc aussi le type de la valeur et les opérateurs qui
 * ont un sens pour lui.
 *
 * `season.month` FAIT PARTIE du registre depuis le 12/08/2026 : il figurait dans l'énumération
 * `Fact` sans jamais être injecté — une condition sur le mois était donc inerte, même famille que
 * `conditional` effacé par Zod. `evaluate.ts` l'injecte désormais, ce qui est neutre pour les
 * verdicts (aucune des 449 règles ne l'utilisait) et rend exprimables les politiques de fenêtre
 * calendaire.
 *
 * `EvalContextShape` ci-dessous fait de ce registre le type du contexte du moteur : la parité est
 * garantie par le compilateur, pas par une lecture du code source à l'expression régulière.
 */
const CMP = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "nin"] as const;
const EQ = ["eq", "neq", "in", "nin"] as const;

export const FACT_TYPES = {
  "dog.brachycephalic": { kind: "boolean", ops: ["eq", "neq"] },
  "dog.breed_id": { kind: "id", prefix: "breed_", ops: EQ },
  "dog.size": { kind: "enum", values: DogSize.options, ops: EQ },
  /** 0 = poids inconnu (le voyageur n'a rien saisi et la race n'en donne pas). Voir SENTINELS. */
  "dog.weight_kg": { kind: "number", ops: CMP, min: 0, max: 120 },
  /** `"unknown"` a disparu : `FinderRequest` le ramène à l'absence, le moteur n'injecte que "" | yes | no. */
  "docs.eu_passport": { kind: "enum", values: ["yes", "no", ""], ops: EQ },
  "placement": { kind: "enum", values: Placement.options, ops: EQ },
  "route.dest_airport_id": { kind: "id", prefix: "airport_", ops: EQ },
  "route.dest_country_id": { kind: "id", prefix: "country_", ops: EQ },
  "route.origin_country_id": { kind: "id", prefix: "country_", ops: EQ },
  /** 1–12 ; **0 = mois inconnu** (le voyageur n'a pas donné de date). Voir MONTH_UNKNOWN. */
  "season.month": { kind: "number", ops: CMP, min: 0, max: 12, integer: true },
  "travel_type": { kind: "enum", values: TravelType.options, ops: EQ },
  "weather.temperature_c": { kind: "number", ops: CMP, min: -60, max: 60 },
} as const satisfies Record<string, { kind: string; ops: readonly string[]; values?: readonly unknown[]; prefix?: string; min?: number; max?: number; integer?: boolean }>;

/**
 * Valeur de `season.month` quand le voyageur n'a pas donné de date.
 *
 * `season.month` figurait dans l'énumération `Fact` sans jamais être injecté : une condition sur
 * le mois était donc inerte. Il est désormais injecté par `evaluate.ts` — changement neutre pour
 * les verdicts, vérifié : **aucune des 449 règles actuelles n'utilise ce fait**.
 *
 * Sans lui, toute politique de fenêtre calendaire (« canal ouvert du mois X au mois Y ») reste
 * inexprimable, et la température ne peut pas s'y substituer : une fenêtre de calendrier n'est
 * pas un seuil thermique. Aucune politique de compagnie n'est affirmée ici — celles-ci viendront
 * de l'audit, avec leur page officielle.
 *
 * Une date non renseignée ne doit jamais fermer ni ouvrir un canal : c'est l'invariant porté par
 * SENTINELS ci-dessous, qui refuse toute condition susceptible de se déclencher avec `0`.
 */
export type InjectedFact = keyof typeof FACT_TYPES;
export const INJECTED_FACTS = Object.keys(FACT_TYPES) as InjectedFact[];
export const ExecutableFact = z.enum(INJECTED_FACTS as [InjectedFact, ...InjectedFact[]]);

/**
 * Forme du contexte d'évaluation, dérivée du registre. `evaluate.ts` type son contexte avec elle :
 * ajouter un fait au moteur sans l'ouvrir ici, ou l'ouvrir ici sans l'injecter, ne compile plus.
 */
export type EvalContextShape = {
  [K in InjectedFact]: (typeof FACT_TYPES)[K]["kind"] extends "boolean" ? boolean
    : (typeof FACT_TYPES)[K]["kind"] extends "number" ? number
    : string;
};

export const MONTH_UNKNOWN = 0;

/**
 * Valeurs SENTINELLES : ce que le moteur injecte quand il ne sait pas.
 *
 * Elles ne sont pas des valeurs métier. `season.month = 0` veut dire « pas de date saisie »,
 * `dog.weight_kg = 0` veut dire « poids inconnu » — un chien ne pèse pas zéro kilo.
 *
 * INVARIANT : **une condition qui PEUT se déclencher alors qu'une donnée manque est refusée.**
 *
 * Deux versions ont échoué avant celle-ci. La première n'interdisait que `nin`/`neq` sur le mois :
 * `month eq 0`, `in [0,11]`, `lt 3`, `lte 1`, `gte 0` passaient. La seconde demandait si le
 * prédicat était CERTAINEMENT vrai avec TOUTES les sentinelles à la fois : `all[weight_kg lt 8,
 * placement eq cabin]` passait donc, alors qu'il se déclenche bel et bien quand le poids manque.
 *
 * Le contrôle est mené **fait par fait** : chacun est fixé à sa sentinelle, les autres restent
 * libres, et la condition est refusée si elle PEUT être vraie. Un `unknown` n'est pas une absence
 * de risque, c'est un « peut-être ».
 *
 * Une garde explicite reste acceptée — `all: [weight_kg gt 0, weight_kg lt 8]` est certainement
 * faux quand le poids vaut 0. Le contrat ne dit pas « n'écrivez pas de seuil », il dit « dites
 * aussi ce qui se passe quand on ne sait pas ».
 */
export const SENTINELS: Partial<Record<InjectedFact, number | string>> = {
  "season.month": MONTH_UNKNOWN,   // pas de date saisie
  "dog.weight_kg": 0,              // poids non renseigné et race inconnue
  "dog.breed_id": "",              // race non choisie
  "docs.eu_passport": "",          // question non posée ou sans réponse
};

/**
 * Inventaire complet des replis de `baseCtx`, et pourquoi les autres n'en sont pas.
 *
 * `dog.size = "medium"`, `dog.brachycephalic = false` et `weather.temperature_c` (estimée depuis
 * la région et le mois, 20 °C à défaut) sont des **valeurs modélisées**, pas des marqueurs
 * d'ignorance : le moteur affirme une estimation et l'assume. Une condition qui les utilise
 * décide sur une estimation, ce qui est un choix produit — discutable, mais explicite.
 *
 * Les quatre sentinelles ci-dessus sont différentes : elles ne signifient rien d'autre que
 * « le visiteur n'a pas dit ». Une règle qui se déclenche dessus décide sur du vide.
 */
export const MODELLED_DEFAULTS = ["dog.size", "dog.brachycephalic", "weather.temperature_c"] as const;

/** Logique à trois valeurs. `unknown` = « la valeur n'est pas fixée », donc potentiellement vraie. */
type Tri = true | false | "unknown";

const leafWith = (c: ExecutableCondition, fact: InjectedFact, value: number | string): Tri => {
  if (c.fact !== fact) return "unknown";                 // fait libre : peut valoir n'importe quoi
  const vals = Array.isArray(c.value) ? c.value : [c.value];
  switch (c.op) {
    case "eq":  return vals[0] === value;
    case "neq": return vals[0] !== value;
    case "in":  return vals.includes(value);
    case "nin": return !vals.includes(value);
    case "gt":  return typeof vals[0] === "number" && typeof value === "number" && value > vals[0];
    case "gte": return typeof vals[0] === "number" && typeof value === "number" && value >= vals[0];
    case "lt":  return typeof vals[0] === "number" && typeof value === "number" && value < vals[0];
    case "lte": return typeof vals[0] === "number" && typeof value === "number" && value <= vals[0];
    default:    return "unknown";
  }
};

/**
 * Le prédicat PEUT-IL être vrai quand `fact` vaut sa sentinelle et que tout le reste est libre ?
 *
 * C'est la bonne question, et la v4 posait la mauvaise : elle demandait si le prédicat était
 * CERTAINEMENT vrai avec TOUTES les sentinelles à la fois. `all[weight_kg lt 8, placement eq
 * cabin]` passait donc — pourtant, avec un poids absent et un placement cabine, il se déclenche
 * bel et bien. Un `unknown` n'est pas une absence de risque : c'est un « peut-être ».
 */
const canBeTrueWith = (p: ExecutablePredicate, fact: InjectedFact, value: number | string): boolean => {
  if ("all" in p) return p.all.every((x) => canBeTrueWith(x, fact, value));
  if ("any" in p) return p.any.some((x) => canBeTrueWith(x, fact, value));
  if ("not" in p) return canBeFalseWith(p.not, fact, value);
  return leafWith(p as ExecutableCondition, fact, value) !== false;
};
const canBeFalseWith = (p: ExecutablePredicate, fact: InjectedFact, value: number | string): boolean => {
  if ("all" in p) return p.all.some((x) => canBeFalseWith(x, fact, value));
  if ("any" in p) return p.any.every((x) => canBeFalseWith(x, fact, value));
  if ("not" in p) return canBeTrueWith(p.not, fact, value);
  return leafWith(p as ExecutableCondition, fact, value) !== true;
};

/**
 * Rend les faits dont la sentinelle peut à elle seule faire déclencher le prédicat.
 * Le contrôle est mené **fait par fait** : chacun est fixé à sa sentinelle, les autres restent
 * libres. Une garde explicite — `all: [weight_kg gt 0, weight_kg lt 8]` — reste acceptée, parce
 * qu'avec `weight_kg = 0` la conjonction est certainement fausse.
 */
export function sentinelRisks(p: ExecutablePredicate | undefined): InjectedFact[] {
  if (!p) return [];
  // Seuls les faits que le prédicat MENTIONNE sont examinés : une condition qui ne parle pas du
  // poids n'est pas « risquée pour un poids inconnu », elle en est indépendante.
  const mentioned = factsIn(p);
  return (Object.keys(SENTINELS) as InjectedFact[])
    .filter((f) => mentioned.has(f))
    .filter((f) => canBeTrueWith(p, f, SENTINELS[f]!));
}

/**
 * FORME NORMALE NÉGATIVE — `not` poussé jusqu'aux feuilles, puis supprimé.
 *
 * La version précédente renvoyait `null` dès qu'elle rencontrait un `not`, et laissait donc passer
 * `not(placement in [cabin, hold, cargo])` — toujours faux. La réponse n'était pas de « traiter le
 * cas `not` » en plus, mais de le faire disparaître : les huit opérateurs vont par paires
 * complémentaires exactes, et la négation d'un `all` est le `any` des négations. La transformation
 * est donc EXACTE, pas une approximation, et tout ce qui suit n'a plus jamais à connaître `not`.
 *
 * Elle est exhaustive par construction : chaque paire reste dans les opérateurs admis par le fait
 * — `eq`/`neq` et `in`/`nin` pour les énumérations et les identifiants, plus `gt`/`lte` et
 * `lt`/`gte` pour les nombres.
 */
const COMPLEMENT = {
  eq: "neq", neq: "eq", in: "nin", nin: "in",
  gt: "lte", lte: "gt", lt: "gte", gte: "lt",
} as const;

export function toNNF(p: ExecutablePredicate, negate = false): ExecutablePredicate {
  if ("not" in p) return toNNF(p.not, !negate);
  if ("all" in p) {
    const parts = p.all.map((x) => toNNF(x, negate));
    return negate ? { any: parts } : { all: parts };
  }
  if ("any" in p) {
    const parts = p.any.map((x) => toNNF(x, negate));
    return negate ? { all: parts } : { any: parts };
  }
  const c = p as ExecutableCondition;
  return negate ? { fact: c.fact, op: COMPLEMENT[c.op], value: c.value } : c;
}

/** Domaine restant d'un fait numérique dans une conjonction. */
type NumDomain = {
  lo: number; loInc: boolean; hi: number; hiInc: boolean;
  /** `eq`/`in` : valeurs explicitement autorisées. `null` = aucune contrainte d'appartenance. */
  allowed: Set<number> | null;
  /** `neq`/`nin` : valeurs explicitement retirées. */
  excluded: Set<number>;
};

/** Nombre d'entiers qu'on accepte d'énumérer pour appliquer les exclusions (mois : 13 ; poids : 121). */
const ENUMERATION_CAP = 10_000;

/**
 * La CONJONCTION de ces feuilles est-elle vide ? Renvoie la raison, ou `null` si une valeur reste
 * possible. C'est ici que se jouent les cinq contournements relevés le 13/08/2026 :
 *
 * 1. `weight_kg gt 30 && lte 30` — l'ancienne version bornait `gt v` par `v + Number.EPSILON`,
 *    qui ne change RIEN à 30 en IEEE-754 (l'epsilon vaut 2⁻⁵², l'ULP de 30 vaut 2⁻⁴⁸). La borne
 *    porte donc maintenant un INDICATEUR d'inclusivité, jamais un décalage flottant.
 * 2. `season.month gt 10 && lt 11` — il n'existe aucun ENTIER strictement entre 10 et 11. Le
 *    caractère entier du fait (`integer: true` dans FACT_TYPES) est désormais lu.
 * 3. `season.month eq 5 && neq 5` — `neq`, `in` et `nin` étaient purement ignorés sur les faits
 *    numériques.
 * 4. `month gt 10 && all[month lt 5, …]` — les `all` imbriqués n'étaient pas aplatis, les deux
 *    bornes n'étaient donc jamais confrontées.
 * 5. `brachycephalic eq true && eq false` — le booléen n'était pas traité comme le domaine fini
 *    `{true, false}` qu'il est.
 */
function conjunctionEmpty(leaves: ExecutableCondition[]): string | null {
  const byFact = new Map<InjectedFact, ExecutableCondition[]>();
  for (const c of leaves) byFact.set(c.fact, [...(byFact.get(c.fact) ?? []), c]);

  for (const [fact, cs] of byFact) {
    const spec = FACT_TYPES[fact] as {
      kind: string; values?: readonly unknown[]; min?: number; max?: number; integer?: boolean;
    };

    /* -- Domaines FINIS : énumérations et booléens. Un booléen est le domaine {true, false} ; ne
          pas le dire laissait passer `eq true && eq false`. -- */
    if (spec.kind === "enum" || spec.kind === "boolean") {
      const domain: unknown[] = spec.kind === "boolean" ? [true, false] : [...(spec.values ?? [])];
      let possible = new Set(domain);
      for (const c of cs) {
        const vals = Array.isArray(c.value) ? c.value : [c.value];
        if (c.op === "eq" || c.op === "in") possible = new Set([...possible].filter((x) => vals.includes(x)));
        if (c.op === "neq" || c.op === "nin") possible = new Set([...possible].filter((x) => !vals.includes(x)));
      }
      if (possible.size === 0) return `${fact} : aucune valeur du domaine ne satisfait ces conditions`;
      continue;
    }

    /* -- Identifiants : domaine ouvert, donc `nin` seul n'épuise jamais rien. Seule une
          contrainte d'appartenance (`eq`/`in`) peut se vider. -- */
    if (spec.kind === "id") {
      // Les contraintes d'appartenance sont collectées puis intersectées à la fin, plutôt
      // qu'accumulées dans une variable : une accumulation initialisée à `null` fait réduire son
      // type à `never` par l'analyse de flux de TypeScript dans la branche non nulle.
      const appartenances: unknown[][] = [];
      const excluded = new Set<unknown>();
      for (const c of cs) {
        const vals: unknown[] = Array.isArray(c.value) ? (c.value as unknown[]) : [c.value];
        if (c.op === "eq" || c.op === "in") appartenances.push(vals);
        if (c.op === "neq" || c.op === "nin") for (const v of vals) excluded.add(v);
      }
      if (appartenances.length > 0) {
        const restantes = appartenances[0]
          .filter((v) => appartenances.every((m) => m.includes(v)) && !excluded.has(v));
        if (restantes.length === 0) return `${fact} : aucune valeur du domaine ne satisfait ces conditions`;
      }
      continue;
    }

    if (spec.kind !== "number") continue;

    /* -- Nombres : intervalle À BORNES INCLUSIVES OU EXCLUSIVES, plus appartenance et exclusion.
          Le domaine atteignable du fait (min/max de FACT_TYPES) est la borne de départ. -- */
    const d: NumDomain = {
      lo: spec.min ?? -Infinity, loInc: true,
      hi: spec.max ?? Infinity, hiInc: true,
      allowed: null, excluded: new Set<number>(),
    };
    const raiseLo = (v: number, inc: boolean) => {
      if (v > d.lo || (v === d.lo && !inc)) { d.lo = v; d.loInc = inc; }
    };
    const lowerHi = (v: number, inc: boolean) => {
      if (v < d.hi || (v === d.hi && !inc)) { d.hi = v; d.hiInc = inc; }
    };
    for (const c of cs) {
      const vals = (Array.isArray(c.value) ? c.value : [c.value]).filter((x): x is number => typeof x === "number");
      const v = vals[0];
      switch (c.op) {
        case "gt":  if (v !== undefined) raiseLo(v, false); break;
        case "gte": if (v !== undefined) raiseLo(v, true); break;
        case "lt":  if (v !== undefined) lowerHi(v, false); break;
        case "lte": if (v !== undefined) lowerHi(v, true); break;
        case "eq":
        case "in":
          d.allowed = d.allowed === null ? new Set(vals) : new Set([...d.allowed].filter((x) => vals.includes(x)));
          break;
        case "neq":
        case "nin":
          for (const x of vals) d.excluded.add(x);
          break;
      }
    }

    // Un fait entier n'a pas de valeur entre deux entiers consécutifs : `gt 10 && lt 11` est vide.
    if (spec.integer) {
      if (Number.isFinite(d.lo)) { d.lo = d.loInc ? Math.ceil(d.lo) : Math.floor(d.lo) + 1; d.loInc = true; }
      if (Number.isFinite(d.hi)) { d.hi = d.hiInc ? Math.floor(d.hi) : Math.ceil(d.hi) - 1; d.hiInc = true; }
    }

    if (d.lo > d.hi) return `${fact} : les bornes s'excluent (aucune valeur possible)`;
    if (d.lo === d.hi && !(d.loInc && d.hiInc)) {
      return `${fact} : les bornes se rejoignent en ${d.lo}, qu'une borne stricte exclut`;
    }

    const dansIntervalle = (x: number) =>
      (d.loInc ? x >= d.lo : x > d.lo) && (d.hiInc ? x <= d.hi : x < d.hi)
      && (!spec.integer || Number.isInteger(x));

    if (d.allowed !== null) {
      const restantes = [...d.allowed].filter((x) => dansIntervalle(x) && !d.excluded.has(x));
      if (restantes.length === 0) {
        return `${fact} : aucune valeur du domaine ne satisfait ces conditions`;
      }
      continue;
    }

    // Sans contrainte d'appartenance, seules les exclusions peuvent encore vider l'intervalle.
    if (d.excluded.size === 0) continue;
    if (spec.integer && Number.isFinite(d.lo) && Number.isFinite(d.hi) && d.hi - d.lo < ENUMERATION_CAP) {
      let reste = false;
      for (let x = d.lo; x <= d.hi && !reste; x++) if (!d.excluded.has(x)) reste = true;
      if (!reste) return `${fact} : toutes les valeurs entières de l'intervalle sont exclues`;
    } else if (d.lo === d.hi && d.loInc && d.hiInc && d.excluded.has(d.lo)) {
      return `${fact} : la seule valeur possible (${d.lo}) est exclue`;
    }
  }
  return null;
}

/**
 * Le prédicat est-il SATISFAISABLE ? Renvoie la raison de son inertie, ou `null`.
 *
 * Ce que le contrat GARANTIT désormais, `not` compris (la mise en forme normale négative le fait
 * disparaître, exactement) :
 *   - intervalles numériques, bornes strictes comprises, domaine entier compris ;
 *   - domaines finis épuisés : énumérations ET booléens ;
 *   - appartenance (`eq`/`in`) confrontée à l'exclusion (`neq`/`nin`) sur tous les types ;
 *   - `all` imbriqués aplatis dans une seule conjonction ;
 *   - `any` dont TOUTES les branches sont inertes.
 *
 * Ce qu'il ne garantit PAS, et le dit : la distribution d'un `any` à l'intérieur d'une conjonction
 * n'est pas explorée (`all[month gt 10, any[month lt 5, month lt 3]]` est vide et passe). Détecter
 * cette forme demanderait une mise en forme normale disjonctive, dont la taille explose. La limite
 * est ici volontaire et écrite ; elle ne l'était pas dans les versions précédentes, qui laissaient
 * passer des formes bien plus simples en promettant l'inverse.
 */
export function unsatisfiable(p: ExecutablePredicate): string | null {
  return unsatisfiableNNF(toNNF(p));
}

function unsatisfiableNNF(p: ExecutablePredicate): string | null {
  if ("any" in p) {
    const raisons = p.any.map((x) => unsatisfiableNNF(x));
    return raisons.every((r) => r !== null)
      ? `toutes les branches de \`any\` sont inertes (${raisons.join(" ; ")})`
      : null;
  }
  // Conjonction — ou feuille seule, qui en est le cas à un terme. Les `all` imbriqués sont aplatis
  // (et eux seuls : traverser un `any` changerait le sens).
  const leaves: ExecutableCondition[] = [];
  const pile: ExecutablePredicate[] = [p];
  while (pile.length) {
    const x = pile.pop()!;
    if ("all" in x) { pile.push(...x.all); continue; }
    if ("any" in x) { const u = unsatisfiableNNF(x); if (u) return u; continue; }
    leaves.push(x as ExecutableCondition);
  }
  return conjunctionEmpty(leaves);
}

/** Faits cités par un prédicat, à n'importe quelle profondeur. */
export function factsIn(p: ExecutablePredicate): Set<InjectedFact> {
  if ("all" in p) return new Set(p.all.flatMap((x) => [...factsIn(x)]));
  if ("any" in p) return new Set(p.any.flatMap((x) => [...factsIn(x)]));
  if ("not" in p) return factsIn(p.not);
  return new Set([(p as ExecutableCondition).fact as InjectedFact]);
}

// ---------------------------------------------------------------------------------------------
// 2. Conditions typées
// ---------------------------------------------------------------------------------------------

const valueMatchesFact = (fact: InjectedFact, op: string, value: unknown): string | null => {
  const spec = FACT_TYPES[fact] as { kind: string; ops: readonly string[]; values?: readonly unknown[]; prefix?: string; min?: number; max?: number; integer?: boolean };
  if (!spec.ops.includes(op)) return `opérateur « ${op} » sans effet sur ${fact} (admis : ${spec.ops.join(", ")})`;

  const many = op === "in" || op === "nin";
  if (many && !Array.isArray(value)) return `« ${op} » attend une liste`;
  if (!many && Array.isArray(value)) return `« ${op} » n'attend pas une liste`;
  const items = many ? (value as unknown[]) : [value];
  if (many && items.length === 0) return "liste vide : la condition ne peut jamais être vraie";

  // Une sentinelle n'est jamais une valeur métier écrivable : `month eq 0` ou `weight_kg eq 0`
  // n'ont pas de sens dans une politique de compagnie.
  // Une sentinelle n'est pas une valeur métier : on ne peut pas l'ÉGALER. En revanche elle reste
  // une borne légitime — `weight_kg gt 0` est précisément la garde que le contrat veut voir écrite.
  const sentinel = SENTINELS[fact];
  if (sentinel !== undefined && ["eq", "neq", "in", "nin"].includes(op) && items.includes(sentinel)) {
    return `${fact} : ${sentinel} est la valeur SENTINELLE (donnée inconnue), pas une valeur métier`;
  }

  for (const v of items) {
    switch (spec.kind) {
      case "boolean":
        if (typeof v !== "boolean") return `${fact} est booléen, reçu ${JSON.stringify(v)}`;
        break;
      case "number": {
        if (typeof v !== "number" || !Number.isFinite(v)) return `${fact} est numérique, reçu ${JSON.stringify(v)}`;
        const { min, max, integer } = spec;
        if (integer && !Number.isInteger(v)) return `${fact} n'admet que des entiers, reçu ${v}`;
        if (min !== undefined && v < min) return `${fact} : ${v} est hors du domaine atteignable (min ${min})`;
        if (max !== undefined && v > max) return `${fact} : ${v} est hors du domaine atteignable (max ${max})`;
        // Comparaison INSATISFIABLE : la valeur est dans le domaine, mais l'opérateur exclut tout
        // le domaine. `month gt 12` n'est jamais vrai, `temperature_c lt -60` non plus : ce sont
        // des conditions inertes, exactement comme un fait non injecté.
        if (typeof min === "number" && typeof max === "number") {
          const impossible =
            (op === "gt" && v >= max) || (op === "gte" && v > max) ||
            (op === "lt" && v <= min) || (op === "lte" && v < min);
          if (impossible) return `${fact} ${op} ${v} n'est jamais satisfaisable sur le domaine [${min}, ${max}]`;
        }
        break;
      }
      case "enum":
        if (!spec.values!.includes(v as never)) return `${fact} n'admet que ${spec.values!.map((x) => JSON.stringify(x)).join(", ")}, reçu ${JSON.stringify(v)}`;
        break;
      case "id": {
        const pre = (spec as { prefix: string }).prefix;
        if (typeof v !== "string" || !new RegExp(`^${pre}[a-z0-9_]+$`).test(v)) {
          return `${fact} attend un identifiant « ${pre}… » non vide, reçu ${JSON.stringify(v)}`;
        }
        break;
      }
    }
  }
  return null;
};

export const ExecutableCondition = z
  .strictObject({ fact: ExecutableFact, op: Op, value: z.unknown() })
  .superRefine((c, ctx) => {
    const err = valueMatchesFact(c.fact, c.op, c.value);
    if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err, path: ["value"] });
  });
export type ExecutableCondition = { fact: InjectedFact; op: z.infer<typeof Op>; value: unknown };

export type ExecutablePredicate =
  | { all: ExecutablePredicate[] }
  | { any: ExecutablePredicate[] }
  | { not: ExecutablePredicate }
  | ExecutableCondition;

export const ExecutablePredicate: z.ZodType<ExecutablePredicate> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(ExecutablePredicate).min(1) }),
    z.strictObject({ any: z.array(ExecutablePredicate).min(1) }),
    z.strictObject({ not: ExecutablePredicate }),
    ExecutableCondition,
  ]),
) as z.ZodType<ExecutablePredicate>;

// ---------------------------------------------------------------------------------------------
// 3. Provenance — le contrat `Source` existant, étendu
// ---------------------------------------------------------------------------------------------

/* Domaines interdits, hostname normalisé et auto-citation vivent désormais dans `common.ts` :
   la projection d'une politique de canal en a besoin elle aussi, et une seconde copie aurait
   divergé. Ils restent exportés d'ici — les appelants existants ne changent pas d'import. */
export { FORBIDDEN_SOURCE_DOMAINS, normalizeHost, isForbiddenSource, FACTUAL_SOURCE_TYPES } from "./common";

/**
 * `Source` (common.ts) plus la citation. On COMPOSE plutôt que de redéfinir : la première version
 * de ce fichier avait recréé un modèle de provenance appauvri — sans `source_type`, `review_due`,
 * `confidence`, `reviewer` ni `history`, et avec une validation de date par expression régulière
 * qui acceptait `2026-99-99`. Deux modèles de provenance dans le même dépôt, c'est la garantie
 * qu'ils divergeront.
 */
/**
 * Types de source admis pour fonder un FAIT MÉTIER. Un article de presse ou un « other » peuvent
 * documenter un contexte ; ils ne peuvent pas fermer un canal à un chien.
 */


export const SourcedQuote = Source.extend({
  /** La phrase officielle qui fonde le fait, reprise telle quelle. */
  quote: z.string().min(10),
  /** Langue de la citation : elle est reprise dans la langue du site, la traduire l'interpréterait. */
  /**
   * Étiquette de langue BCP-47 (RFC 5646), pas une liste fermée : une énumération oubliait le
   * grec, et en oubliera d'autres sur 102 compagnies. La forme est validée, le contenu ne l'est
   * pas — c'est le bon compromis pour un champ documentaire.
   */
  quote_language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "étiquette de langue BCP-47 attendue (ex. « el », « pt-BR »)"),
  /** Où trouver la phrase : ancre, titre de section, numéro d'accordéon. */
  locator: z.string().min(1).optional(),
})
  .strict()
  .refine((s) => /^https?:$/.test((() => { try { return new URL(s.url).protocol; } catch { return ""; } })()), {
    message: "seules les URL http(s) sont acceptées", path: ["url"],
  })
  .refine((s) => !isForbiddenSource(s.url), {
    message: "auto-citation : un domaine MyDogCanFly ne peut pas fonder un fait métier",
    path: ["url"],
  })
  .refine((s) => (FACTUAL_SOURCE_TYPES as readonly string[]).includes(s.source_type), {
    message: `un fait métier exige une source ${FACTUAL_SOURCE_TYPES.join(", ")}`, path: ["source_type"],
  })
  .refine((s) => s.review_due >= s.verified_date, {
    message: "`review_due` ne peut pas précéder `verified_date`", path: ["review_due"],
  });
export type SourcedQuote = z.infer<typeof SourcedQuote>;

// ---------------------------------------------------------------------------------------------
// 4. La restriction
// ---------------------------------------------------------------------------------------------

const uniqueArray = <T extends z.ZodTypeAny>(inner: T, label: string) =>
  z.array(inner).min(1).refine((a) => new Set(a.map((x) => JSON.stringify(x))).size === a.length, {
    message: `${label} : doublon`,
  });

export const BreedTarget = z.union([
  z.strictObject({ trait: z.enum(["brachycephalic"]) }),
  z.strictObject({ breed_ids: uniqueArray(z.string().regex(/^breed_[a-z0-9_]+$/), "breed_ids") }),
]);
export type BreedTarget = z.infer<typeof BreedTarget>;

/**
 * UNE entrée = UN fait = UNE action.
 *
 * Pas de matrice `{cabin, hold, cargo}` : elle oblige à remplir des cases sur lesquelles la source
 * ne dit rien. Une compagnie qui ne parle que de la soute produit une entrée, pas trois — et le
 * fret reste alors non documenté, ce qui n'est pas la même chose qu'ouvert ou fermé.
 *
 * `warn` existe pour un cas fondateur : la recommandation IATA déconseille sans interdire. En
 * faire un `deny` est précisément ce qui a produit `rule_global_brachy_hold`.
 */
export const BreedRestriction = z.strictObject({
  id: z.string().regex(/^brest_[a-z0-9_]+$/),
  /** Absent = portée globale. Présent = une compagnie. */
  airline_id: z.string().regex(/^airline_[a-z0-9_]+$/).optional(),
  applies_to: BreedTarget,
  /**
   * `allow` est indispensable, et son absence était un défaut de conception : sans action
   * positive, la contradiction fondatrice — « le fret est ouvert » (fiche) contre « le fret est
   * refusé » (règle) — reste inexprimable. Utiliser `warn` à sa place serait sémantiquement faux :
   * un avertissement informe, il n'autorise pas.
   */
  action: z.enum(["allow", "deny", "warn", "require"]),
  placements: uniqueArray(Placement, "placements"),
  /** Absente = inconditionnel — à n'écrire que si la source l'est aussi. */
  when: ExecutablePredicate.optional(),
  /** Ce que `require` exige ou ce dont `warn` avertit. Affiché au visiteur, donc localisé. */
  detail: LocalizedText.optional(),
  source: SourcedQuote,
}).superRefine((r, ctx) => {
  const inert = r.when ? unsatisfiable(r.when) : null;
  if (inert) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["when"],
      message: `condition inerte — elle ne peut jamais être vraie : ${inert}` });
  }
  for (const f of sentinelRisks(r.when)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ["when"],
      message: `cette condition peut se déclencher alors que \`${f}\` est inconnu (valeur sentinelle `
        + `${SENTINELS[f]}). Encadrez-la — par exemple \`all: [${f} gt 0, …]\``,
    });
  }
}).refine((r) => r.action === "deny" || r.action === "allow" || !!r.detail, {
  message: "`warn` et `require` doivent dire de quoi il s'agit (`detail`)",
  path: ["detail"],
});
export type BreedRestriction = z.infer<typeof BreedRestriction>;

// ---------------------------------------------------------------------------------------------
// 5. Invariants d'ensemble
// ---------------------------------------------------------------------------------------------

export type BreedRestrictionIssue = { code: string; message: string; ids: string[] };

/**
 * Référentiels connus. **Obligatoires** : la version précédente les rendait optionnels, et
 * `airline_fake` passait donc en silence dès que l'appelant les omettait. Un contrôle qu'on peut
 * désactiver par oubli n'est pas un contrôle.
 */
export type KnownIds = {
  airlineIds: ReadonlySet<string>;
  breedIds: ReadonlySet<string>;
  countryIds: ReadonlySet<string>;
  airportIds: ReadonlySet<string>;
};

const SET_FOR: Partial<Record<InjectedFact, keyof KnownIds>> = {
  "dog.breed_id": "breedIds",
  "route.dest_country_id": "countryIds",
  "route.origin_country_id": "countryIds",
  "route.dest_airport_id": "airportIds",
};

/** Parcourt récursivement un prédicat et rend les identifiants absents des référentiels. */
export function unknownIdsInPredicate(p: ExecutablePredicate | undefined, known: KnownIds): string[] {
  if (!p) return [];
  if ("all" in p) return p.all.flatMap((x) => unknownIdsInPredicate(x, known));
  if ("any" in p) return p.any.flatMap((x) => unknownIdsInPredicate(x, known));
  if ("not" in p) return unknownIdsInPredicate(p.not, known);
  const setName = SET_FOR[p.fact as InjectedFact];
  if (!setName) return [];
  const values = Array.isArray(p.value) ? p.value : [p.value];
  return values.filter((v): v is string => typeof v === "string" && !known[setName].has(v));
}

const targetsOverlap = (a: BreedTarget, b: BreedTarget): boolean => {
  const at = "trait" in a, bt = "trait" in b;
  if (at && bt) return a.trait === b.trait;
  // Un trait recouvre potentiellement n'importe quelle liste nominative. Prudence volontaire :
  // un faux positif se lève en ajoutant une condition, un faux négatif se découvre en production.
  if (at !== bt) return true;
  const A = new Set((a as { breed_ids: string[] }).breed_ids);
  return (b as { breed_ids: string[] }).breed_ids.some((x) => A.has(x));
};

/** Deux conditions sont « identiques » si leur forme canonique l'est (clés triées). */
const canon = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]));
  return v;
};
const sameCondition = (a?: unknown, b?: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/**
 * Contrôles qui portent sur l'ENSEMBLE, qu'aucun schéma ne peut exprimer.
 *
 * `known` est fourni par l'appelant et **obligatoire** : ce module ne doit importer aucune donnée,
 * sinon le contrat dépendrait de ce qu'il est censé contraindre — mais un référentiel qu'on peut
 * omettre par distraction n'est pas un contrôle. Le type l'impose.
 */
export function validateBreedRestrictions(
  list: BreedRestriction[],
  known: KnownIds,
): BreedRestrictionIssue[] {
  const issues: BreedRestrictionIssue[] = [];

  const seen = new Set<string>();
  for (const r of list) {
    if (seen.has(r.id)) issues.push({ code: "DUPLICATE_ID", message: `identifiant en double : ${r.id}`, ids: [r.id] });
    seen.add(r.id);

    if (r.airline_id && !known.airlineIds.has(r.airline_id)) {
      issues.push({ code: "UNKNOWN_AIRLINE", message: `compagnie inconnue : ${r.airline_id}`, ids: [r.id] });
    }
    if ("breed_ids" in r.applies_to) {
      for (const b of r.applies_to.breed_ids) {
        if (!known.breedIds.has(b)) issues.push({ code: "UNKNOWN_BREED", message: `race inconnue : ${b}`, ids: [r.id] });
      }
    }
    // Les identifiants cachés DANS les conditions comptent autant : `route.dest_country_id eq
    // "country_fake"` produirait une règle qui ne se déclenche jamais — un refus inerte.
    for (const bad of unknownIdsInPredicate(r.when, known)) {
      issues.push({ code: "UNKNOWN_ID_IN_CONDITION", message: `identifiant inconnu dans une condition : ${bad}`, ids: [r.id] });
    }
  }

  /**
   * Matrice de compatibilité des actions.
   *
   * La version précédente traitait TOUTE différence d'action comme une contradiction — un
   * avertissement IATA global à côté d'un refus compagnie était signalé, alors que les deux
   * disent la même chose. `warn` est informatif : il compose avec tout. Seule l'opposition
   * `allow` / `deny` est une vraie contradiction, et `deny` rend `require` inatteignable.
   */
  const INCOMPATIBLE: Record<string, "CONTRADICTION" | "UNREACHABLE" | undefined> = {
    "allow|deny": "CONTRADICTION",
    "deny|allow": "CONTRADICTION",
    "deny|require": "UNREACHABLE",
    "require|deny": "UNREACHABLE",
  };

  /** Deux conditions numériques sur le même fait sont-elles DÉMONTRABLEMENT disjointes ? */
  const provablyDisjoint = (a?: ExecutablePredicate, b?: ExecutablePredicate): boolean => {
    const leaf = (p?: ExecutablePredicate) =>
      p && typeof p === "object" && "fact" in p ? (p as ExecutableCondition) : undefined;
    const ca = leaf(a), cb = leaf(b);
    if (!ca || !cb || ca.fact !== cb.fact) return false;
    const spec = FACT_TYPES[ca.fact] as { kind: string };
    if (spec.kind !== "number" || typeof ca.value !== "number" || typeof cb.value !== "number") return false;
    const lo = (c: ExecutableCondition) => c.op === "gt" ? (c.value as number) + 1e-9 : c.op === "gte" ? c.value as number : -Infinity;
    const hi = (c: ExecutableCondition) => c.op === "lt" ? (c.value as number) - 1e-9 : c.op === "lte" ? c.value as number : Infinity;
    return Math.max(lo(ca), lo(cb)) > Math.min(hi(ca), hi(cb));
  };

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];

      // Une règle GLOBALE s'applique par-dessus chaque compagnie : elle peut entrer en conflit
      // avec n'importe quelle règle compagnie. La v1 sautait ces paires, et laissait donc passer
      // exactement le conflit IATA / Thai / Qatar / WestJet / Etihad.
      const aGlobal = a.airline_id === undefined, bGlobal = b.airline_id === undefined;
      const sameScope = a.airline_id === b.airline_id;
      const crossScope = aGlobal !== bGlobal;
      if (!sameScope && !crossScope) continue;

      const shared = a.placements.filter((p) => b.placements.includes(p));
      if (!shared.length) continue;
      if (!targetsOverlap(a.applies_to, b.applies_to)) continue;

      const kind = INCOMPATIBLE[`${a.action}|${b.action}`];
      if (!kind) continue;                                   // warn compose avec tout

      const label = (r: BreedRestriction) => `${r.id}${r.airline_id === undefined ? " (globale)" : ""}`;
      const scoped = (code: string) => crossScope ? `GLOBAL_VS_AIRLINE_${code}` : code;
      const uncond = (r: BreedRestriction) => r.when === undefined;

      if (uncond(a) || uncond(b)) {
        // L'une au moins s'applique toujours : le conflit est certain.
        issues.push({ code: scoped(kind), message: `${label(a)} (${a.action}) et ${label(b)} (${b.action}) sur ${shared.join("+")} — l'une est inconditionnelle`, ids: [a.id, b.id] });
      } else if (sameCondition(a.when, b.when)) {
        issues.push({ code: scoped(kind), message: `${label(a)} (${a.action}) et ${label(b)} (${b.action}) partagent la même condition sur ${shared.join("+")}`, ids: [a.id, b.id] });
      } else if (!provablyDisjoint(a.when, b.when)) {
        // On ne sait pas prouver que les deux ne se déclenchent jamais ensemble. Prudence :
        // on signale, à charge de l'humain de lever l'ambiguïté ou de disjoindre les conditions.
        issues.push({ code: scoped("POSSIBLE_CONFLICT"), message: `${label(a)} (${a.action}) et ${label(b)} (${b.action}) peuvent se déclencher ensemble sur ${shared.join("+")} — disjonction non démontrable`, ids: [a.id, b.id] });
      }
    }
  }

  return issues;
}
