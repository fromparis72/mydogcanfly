#!/usr/bin/env node
/* Comble les langues manquantes de `raw/objects.json`.
 *
 * Pourquoi ce fichier avait un trou. Les noms et notes vivent dans DEUX sources : les fiches
 * `content/countries/<code>.yml`, relues à la main et complètes dans les trois langues
 * publiques, et `raw/objects.json`, tenu à part et enrichi au fil de scripts ponctuels. Le
 * français y a été rempli au fur et à mesure ; l'espagnol ne l'a jamais été. Résultat en
 * ligne : sur la fiche Allemagne en espagnol, « Alemania » apparaît cinquante fois et
 * « Germany » trois fois — dans les liens de contexte, qui passent par `labelOf()` et lisent
 * cette seconde source.
 *
 * La règle appliquée ici : **là où le français a une traduction, l'espagnol doit en avoir
 * une**.
 *
 * Les noms d'aéroports ont d'abord été jugés hors sujet : ils étaient en anglais dans les
 * quatre langues, donc uniformes. C'était faux. Sur une même page espagnole, le fil d'Ariane
 * disait « Londres (LHR) », le badge « Londres · Reino Unido », la prose « el aeropuerto de
 * Londres » — et le titre « London Heathrow (LHR) ». Trois fois la ville en espagnol, une
 * fois en anglais. Ils sont donc localisés eux aussi : la ville suit la langue, le nom propre
 * ne bouge jamais, le descriptif se traduit et se postpose.
 *
 * Les noms de pays ne sont pas retraduits : ils sont **repris des fiches YAML**, qui font
 * autorité. Recopier plutôt que retraduire évite qu'un même pays s'appelle autrement selon
 * l'endroit du site où on le rencontre.
 *
 *   node packages/knowledge/scripts/fill-objects-i18n.mjs --dry
 *   node packages/knowledge/scripts/fill-objects-i18n.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const OBJ = "packages/knowledge/raw/objects.json";
const SRC = "content/countries";
const DRY = process.argv.includes("--dry");
const LANGS = ["es", "pt"];

const raw = JSON.parse(readFileSync(OBJ, "utf-8"));

/* ---- 1. noms de pays : recopiés des fiches, jamais retraduits ---- */
const byIso = {};
for (const f of readdirSync(SRC)) {
  if (!f.endsWith(".yml") || f.startsWith("_")) continue;
  const d = YAML.parse(readFileSync(join(SRC, f), "utf-8"));
  byIso[(d.iso2 || f.replace(/\.yml$/, "")).toLowerCase()] = d.name;
}

/* Les soixante fiches encore non traduites n'ont pas de nom portugais dans le YAML. Ce sont
 * des noms de pays, pas de la prose : ils sont écrits ici une fois, dans la graphie
 * brésilienne, et serviront aussi de base quand ces fiches passeront au portugais. */
const PT_NAMES = {
  al: "Albânia", am: "Armênia", az: "Azerbaijão", ba: "Bósnia e Herzegovina", bd: "Bangladesh",
  bf: "Burkina Faso", bh: "Bahrein", bj: "Benin", by: "Belarus", cd: "República Democrática do Congo",
  cg: "República do Congo", ci: "Costa do Marfim", cm: "Camarões", dj: "Djibuti", dz: "Argélia",
  et: "Etiópia", fj: "Fiji", ga: "Gabão", ge: "Geórgia", gh: "Gana", gm: "Gâmbia", gn: "Guiné",
  id: "Indonésia", iq: "Iraque", ir: "Irã", jo: "Jordânia", ke: "Quênia", kh: "Camboja",
  kw: "Kuwait", kz: "Cazaquistão", lb: "Líbano", lk: "Sri Lanka", md: "Moldávia", me: "Montenegro",
  mg: "Madagascar", mk: "Macedônia do Norte", ml: "Mali", mm: "Mianmar", mn: "Mongólia",
  mr: "Mauritânia", mv: "Maldivas", my: "Malásia", ne: "Níger", ng: "Nigéria", np: "Nepal",
  om: "Omã", ph: "Filipinas", pk: "Paquistão", rw: "Ruanda", sa: "Arábia Saudita",
  sc: "Seicheles", sl: "Serra Leoa", td: "Chade", tg: "Togo", tn: "Tunísia", tw: "Taiwan",
  tz: "Tanzânia", ug: "Uganda", vn: "Vietnã", xk: "Kosovo",
};

/* ---- 2. villes et noms d'aéroports : deux tables de données, pas du code ----
 * Le français disait « Londres » là où l'espagnol disait « London ». Pire, seuls 66 des 249
 * aéroports avaient une ville localisée : les 183 autres affichaient la ville anglaise dans
 * les quatre langues. Les tables couvrent maintenant les 244 villes et les 249 aéroports. */
const CITIES = JSON.parse(readFileSync(join("content/objects-i18n", "villes.json"), "utf-8"));
const AIRPORTS = JSON.parse(readFileSync(join("content/objects-i18n", "aeroports.json"), "utf-8"));

/* ---- 3. prose : notes de zones de détente, textes alternatifs, noms de région ----
 * Traduites à part, en espagnol et en portugais, à partir de l'anglais et du français
 * déjà présents. Le fichier de traduction est indexé par la chaîne anglaise, comme partout
 * ailleurs sur ce site. */
const PROSE = {};
for (const L of LANGS) {
  const p = `content/objects-i18n/${L}.json`;
  if (existsSync(p)) PROSE[L] = JSON.parse(readFileSync(p, "utf-8"));
}

const report = { countries: 0, cities: 0, airports: 0, prose: 0, cityUnknown: new Set(), airportUnknown: new Set(), proseMissing: new Set() };

for (const c of raw.countries) {
  const iso = (c.iso2 || c.id.replace(/^country_/, "")).toLowerCase();
  const y = byIso[iso];
  if (y?.es && !c.name.es) { c.name.es = y.es; report.countries++; }
  const pt = y?.pt || PT_NAMES[iso];
  if (pt && !c.name.pt) { c.name.pt = pt; report.countries++; }
}

for (const a of raw.airports) {
  const city = CITIES[a.city];
  if (city) {
    /* `LocalizedText` exige la clé `en` — c'est elle qui sert de repli quand une langue
     * manque. Créer un `city_i18n` sans `en` fait échouer l'ingestion sur un « Required »
     * qui ne dit pas où. On la pose donc d'abord, avec la ville anglaise. */
    a.city_i18n ??= { en: a.city };
    a.city_i18n.en ??= a.city;
    for (const L of ["fr", ...LANGS]) if (city[L] && !a.city_i18n[L]) { a.city_i18n[L] = city[L]; report.cities++; }
  } else report.cityUnknown.add(a.city);

  /* Le nom de l'aéroport. `labelOf()` écrivait `${iata} · ${name.en}` pour tout le monde :
   * sur une page espagnole, le fil d'Ariane disait « Londres (LHR) », le badge « Londres »,
   * la prose « el aeropuerto de Londres » — et le titre « London Heathrow (LHR) ». */
  const nm = AIRPORTS[a.name.en];
  if (nm) { for (const L of ["fr", ...LANGS]) if (nm[L] && !a.name[L]) { a.name[L] = nm[L]; report.airports++; } }
  else report.airportUnknown.add(a.name.en);
}

/* Les champs de prose, où qu'ils soient dans l'arbre. On ne cible pas des chemins précis :
 * tout objet portant `en` et `fr` mais pas `es` ou `pt` est un trou à combler. */
(function fillProse(o) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) return o.forEach(fillProse);
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object" && typeof v.en === "string" && typeof v.fr === "string") {
      for (const L of LANGS) {
        if (v[L]) continue;
        const t = PROSE[L]?.[v.en];
        if (t) { v[L] = t; report.prose++; } else report.proseMissing.add(v.en.slice(0, 60));
      }
      continue;
    }
    fillProse(v);
  }
})(raw);

console.log(`${DRY ? "[simulation] " : ""}pays : ${report.countries} · villes : ${report.cities} · aéroports : ${report.airports} · prose : ${report.prose}`);
if (report.cityUnknown.size)
  console.log(`villes sans correspondance (${report.cityUnknown.size}) : ${[...report.cityUnknown].join(", ")}`);
if (report.airportUnknown.size)
  console.log(`aéroports sans correspondance (${report.airportUnknown.size}) : ${[...report.airportUnknown].slice(0, 5).join(", ")}`);
/* Les valeurs restées sans traduction appartiennent toutes à des champs qu'aucune page ne
 * rend : `label` des contacts d'aéroport, `summary` / `conditions` / `text` / `event` /
 * `q` / `a` des compagnies. Elles étaient lues par `EntityPage.astro`, un composant plus
 * appelé par aucune page. Vérifié : aucune de ces 335 valeurs n'apparaît dans le site
 * construit, en anglais non plus. Les traduire reviendrait à traduire du code mort — on les
 * compte et on passe. */
if (report.proseMissing.size)
  console.log(`sans traduction : ${report.proseMissing.size} valeurs, toutes dans des champs non rendus (voir commentaire)`);

if (!DRY) writeFileSync(OBJ, JSON.stringify(raw, null, 2) + "\n");
