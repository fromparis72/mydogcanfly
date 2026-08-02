#!/usr/bin/env node
/* Add French city display names (city_i18n.fr) to airports, using established French exonyms.
   Data-driven and idempotent: only cities with a genuine French exonym are overridden;
   every other city keeps its original spelling (the reader falls back to `city`). */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");

// English city (as stored in `city`) → established French exonym. Only genuine differences are listed.
const FR = {
  "Athens": "Athènes",
  "Beirut": "Beyrouth",
  "Cairo": "Le Caire",
  "London": "Londres",
  "Brussels": "Bruxelles",
  "Vienna": "Vienne",
  "Warsaw": "Varsovie",
  "Kraków": "Cracovie",
  "Copenhagen": "Copenhague",
  "Geneva": "Genève",
  "Basel/Mulhouse": "Bâle/Mulhouse",
  "Lisbon": "Lisbonne",
  "Barcelona": "Barcelone",
  "Seville": "Séville",
  "Valencia": "Valence",
  "Málaga": "Malaga",
  "Palma de Mallorca": "Palma de Majorque",
  "Venice": "Venise",
  "Bologna": "Bologne",
  "Catania": "Catane",
  "Frankfurt": "Francfort",
  "Hamburg": "Hambourg",
  "Gothenburg": "Göteborg",
  "Bucharest": "Bucarest",
  "Edinburgh": "Édimbourg",
  "Thessaloniki": "Thessalonique",
  "Valletta": "La Valette",
  "Kyiv": "Kiev",
  "Moscow": "Moscou",
  "Tbilisi": "Tbilissi",
  "Mexico City": "Mexico",
  "New York City": "New York",
  "Philadelphia": "Philadelphie",
  "Montreal": "Montréal",
  "Havana": "La Havane",
  "Santo Domingo": "Saint-Domingue",
  "Cartagena": "Carthagène",
  "Panama City": "Panama",
  "Bogotá": "Bogota",
  "Brasília": "Brasilia",
  "Tangier": "Tanger",
  "Marrakesh": "Marrakech",
  "Algiers": "Alger",
  "Cape Town": "Le Cap",
  "Johannesburg": "Johannesbourg",
  "Addis Ababa": "Addis-Abeba",
  "Beijing": "Pékin",
  "Seoul": "Séoul",
  "Singapore": "Singapour",
  "Manila": "Manille",
  "Hanoi": "Hanoï",
  "Ho Chi Minh City": "Hô Chi Minh-Ville",
  "Kathmandu": "Katmandou",
  "Kolkata": "Calcutta",
  "Bengaluru": "Bangalore",
  "Kuwait City": "Koweït",
  "Dubai": "Dubaï",
  "Abu Dhabi": "Abou Dabi",
  "Riyadh": "Riyad",
  "Jeddah": "Djeddah",
  "Muscat": "Mascate",
};

const data = JSON.parse(readFileSync(OBJ, "utf8"));
let set = 0;
for (const a of data.airports) {
  const fr = FR[a.city];
  if (!fr) continue;
  const cur = a.city_i18n ?? {};
  if (cur.en === a.city && cur.fr === fr) continue; // already applied
  a.city_i18n = { ...cur, en: a.city, fr };
  set++;
}
writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
console.log(`city_i18n.fr renseigné sur ${set} aéroport(s).`);
