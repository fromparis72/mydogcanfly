#!/usr/bin/env node
/* Génère packages/ui/public/llms.txt selon la spec llms.txt :
   un H1, un résumé en blockquote, puis des sections de liens Markdown.
   Les compteurs sont lus dans les données pour ne jamais se désynchroniser. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const O = JSON.parse(readFileSync(resolve(ROOT, "packages/knowledge/raw/objects.json"), "utf8"));
const S = "https://mydogcanfly.com";

const nAir = O.airlines.length, nCty = O.countries.length, nBrd = O.breeds.length, nApt = O.airports.length;

// Sélection éditoriale : les mieux notées, pas la liste entière (le sitemap la porte déjà).
const topAirlines = [...O.airlines]
  .filter((a) => a.rating?.score)
  .sort((a, b) => b.rating.score - a.rating.score || a.name.localeCompare(b.name))
  .slice(0, 12);
const keyCountries = ["us", "gb", "fr", "es", "de", "it", "ca", "au", "jp", "ae", "br", "za"]
  .map((iso) => O.countries.find((c) => c.id === "country_" + iso))
  .filter(Boolean);

const link = (label, path, note) => `- [${label}](${S}${path})${note ? ": " + note : ""}`;

const out = `# MyDogCanFly

> The world's reference for flying with a dog. MyDogCanFly compares ${nAir} airlines, ${nCty} country entry regimes, ${nBrd} dog breeds and ${nApt} airports, and answers one question: can this dog fly on this route, in the cabin, the hold or as cargo? Every rule carries its official source, a verification date and a confidence level.

The site is trilingual. English lives at the root, French under /fr/ and Spanish under /es/; every URL below exists in all three languages by prefixing the locale.

Editorial rules worth knowing when citing this site: airline policies are re-verified every 90 days and country rules every 180; a distinction is always drawn between what the law requires and what an airline imposes commercially; and where an official source could not be confirmed, the page says so rather than guessing.

## Start here

${link("Flight Finder", "/#flight-finder", "the decision engine — enter route, breed and weight, get a sourced verdict per airline")}
${link("About and editorial standards", "/about/", "who publishes this, how rules are sourced and reviewed")}

## Airlines

${link("All airlines", "/airlines/", `${nAir} carriers, each scored on cabin, hold, cargo, breed rules and network`)}
${topAirlines.map((a) => link(a.name, `/airlines/${a.id.replace(/^airline_/, "").replace(/_/g, "-")}/`, `rated ${a.rating.score}/5`)).join("\n")}

## Countries

${link("All destinations", "/countries/", `${nCty} countries: entry requirements, exit formalities, domestic-flight rules and breed bans`)}
${keyCountries.map((c) => link(c.name.en, `/countries/${c.id.replace(/^country_/, "")}/`)).join("\n")}

## Dog breeds

${link("All breeds", "/breeds/", `${nBrd} breeds, including brachycephalic and restricted-breed status per airline and country`)}

## Tools

${link("Tools index", "/tools/")}
${link("Crate size calculator", "/tools/crate/", "the crate size an airline will accept for a given dog")}
${link("Heat risk calculator", "/tools/heat/", "whether it is too hot to fly a dog on a given route and date")}
${link("Pet relief areas", "/tools/pet-relief/", "where a dog can relieve itself in an airport, landside and airside")}
${link("Destination finder", "/tools/destinations/", "where a dog can realistically travel from a given airport")}

## Legal

${link("Legal notice", "/legal-notice/")}
${link("Privacy", "/privacy/")}
${link("Terms", "/terms/")}

## Optional

${link("Full sitemap", "/sitemap.xml", "every page in all three languages")}
${link("Travel hub", "/travel-hub/", "long-form guidance")}
${link("Report an error", "/report-error/", "corrections are welcome and reviewed")}
`;

writeFileSync(resolve(ROOT, "packages/ui/public/llms.txt"), out);
const links = (out.match(/^- \[/gm) || []).length;
console.log(`llms.txt — ${out.split("\n").length} lignes, ${links} liens, H1: ${/^# /m.test(out)}, blockquote: ${/^> /m.test(out)}`);
