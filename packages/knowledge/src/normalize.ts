import { Airline, Airport, Breed, Country, Partner } from "./objects";
import { Rule } from "./rules";
import { buildGraph, type Edge } from "./graph";
import type { Airline as TAirline, Airport as TAirport, Breed as TBreed, Country as TCountry, Partner as TPartner } from "./objects";
import type { Rule as TRule } from "./rules";

export interface RawKB {
  countries?: unknown[];
  airports?: unknown[];
  airlines?: unknown[];
  breeds?: unknown[];
  partners?: unknown[];
  equipment?: unknown[];
  rules?: unknown[];
}

/** Engine-ready shape (ADR-0012). The Decision Engine only ever reads this. */
export interface NormalizedKB {
  countries: Map<string, TCountry>;
  airports: Map<string, TAirport>;
  airlines: Map<string, TAirline>;
  breeds: Map<string, TBreed>;
  partners: Map<string, TPartner>;
  rules: TRule[];
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

  return {
    countries: index(countries),
    airports: index(airports),
    airlines: index(airlines),
    breeds: index(breeds),
    partners: index(partners),
    rules,
    graph: buildGraph({ airlines, airports, rules }),
  };
}
