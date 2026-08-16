import { Airline, Airport, Breed, Country, Partner } from "./objects";
import { Rule } from "./rules";
import { BreedRestriction, validateBreedRestrictions } from "./breed-restrictions";
import { buildGraph, type Edge } from "./graph";
import type { Airline as TAirline, Airport as TAirport, Breed as TBreed, Country as TCountry, Partner as TPartner } from "./objects";
import type { Rule as TRule } from "./rules";
import type { BreedRestriction as TBreedRestriction } from "./breed-restrictions";

export interface RawKB {
  countries?: unknown[];
  airports?: unknown[];
  airlines?: unknown[];
  breeds?: unknown[];
  partners?: unknown[];
  equipment?: unknown[];
  rules?: unknown[];
  /** OBLIGATOIRE — et non `?`. « Registre vide » et « registre oublié » sont deux états
   *  différents : le premier dit « aucun fait de race audité », le second dit qu'un appelant a
   *  construit une KB sans le registre, et les confondre republierait en silence des décisions de
   *  race sans leur référentiel. Le type l'impose, `normalize` le refuse à l'exécution. */
  breed_restrictions: unknown[];
}

/** Engine-ready shape (ADR-0012). The Decision Engine only ever reads this. */
export interface NormalizedKB {
  countries: Map<string, TCountry>;
  airports: Map<string, TAirport>;
  airlines: Map<string, TAirline>;
  breeds: Map<string, TBreed>;
  partners: Map<string, TPartner>;
  rules: TRule[];
  /** Le registre CANONIQUE des faits de race — vide tant qu'aucun fait n'est audité, jamais absent :
   *  un champ facultatif se lit « pas de restrictions » aussi bien que « registre oublié ». */
  breedRestrictions: TBreedRestriction[];
  graph: Edge[];
}

function index<T extends { id: string }>(arr: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of arr) {
    if (m.has(x.id)) throw new Error(`normalize: duplicate id "${x.id}"`);
    m.set(x.id, x);
  }
  return m;
}

/**
 * Single choke point between authored data and the engine:
 * validate → index by id → build the graph. `raw/` is editable; the output is never hand-edited.
 */
export function normalize(raw: RawKB): NormalizedKB {
  const countries = (raw.countries ?? []).map((x) => Country.parse(x));
  const airports = (raw.airports ?? []).map((x) => Airport.parse(x));
  const airlines = (raw.airlines ?? []).map((x) => Airline.parse(x));
  const breeds = (raw.breeds ?? []).map((x) => Breed.parse(x));
  const partners = (raw.partners ?? []).map((x) => Partner.parse(x));
  const rules = (raw.rules ?? []).map((x) => Rule.parse(x));

  /* Le registre de race passe DEUX contrôles, et l'ordre compte : le schéma d'abord (une entrée à
     la fois), puis les invariants d'ENSEMBLE, que nul schéma ne peut exprimer — `allow` + `deny`
     sur le même canal est une contradiction, `deny` + `require` une exigence inatteignable. On les
     REFUSE au chargement plutôt que de les arbitrer à l'exécution : une priorité inventée règle en
     silence ce que le contrat déclare irrésolu. */
  if (!Array.isArray(raw.breed_restrictions)) {
    throw new Error("normalize: `breed_restrictions` ABSENT — un registre vide s'écrit `[]`. "
      + "Confondre « aucun fait de race audité » et « registre oublié » republierait des décisions "
      + "de race sans leur référentiel.");
  }
  const breedRestrictions = raw.breed_restrictions.map((x) => BreedRestriction.parse(x));
  const anomalies = validateBreedRestrictions(breedRestrictions, {
    airlineIds: new Set(airlines.map((a) => a.id)),
    breedIds: new Set(breeds.map((b) => b.id)),
    countryIds: new Set(countries.map((c) => c.id)),
    airportIds: new Set(airports.map((a) => a.id)),
  });
  if (anomalies.length) {
    throw new Error("normalize: registre des restrictions de race invalide —\n"
      + anomalies.map((i) => `  ${i.code} · ${i.message} [${i.ids.join(", ")}]`).join("\n"));
  }

  return {
    countries: index(countries),
    airports: index(airports),
    airlines: index(airlines),
    breeds: index(breeds),
    partners: index(partners),
    rules,
    breedRestrictions,
    graph: buildGraph({ airlines, airports, rules }),
  };
}
