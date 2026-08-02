# MASTER PROMPT — Country Entry Guide (dog travel)

Frozen contract for generating the 200+ country entry guides on MyDogCanFly.
Every guide is **data only**: one bilingual YAML file per country that the renderer turns
into a visual, sourced, dated page. **No page is hand-coded and nothing is hardcoded.**

- Source of truth: `content/countries/<slug>.yml`
- Ingest + validation: `node packages/knowledge/scripts/ingest-countries.mjs`
  (Zod schema in that script is authoritative — if it fails, the guide is not published)
- Generated data: `packages/ui/src/data/countries.generated.json`
- Renderer: `packages/ui/src/components/CountryGuidePage.astro`
- Route: `packages/ui/src/pages/[...loc]/countries/[slug].astro`
  (`countryData[id] ? <CountryGuidePage/> : <EntityDetail/>`)
- Freshness / quarterly re-check: `node packages/knowledge/scripts/countries-freshness.mjs`

Reference implementation to copy: `content/countries/france.yml`.

---

## Purpose

Produce the **definitive reference page** explaining the official entry requirements for a dog
entering **one country**. This is not a blog article. Writing must be **factual, reassuring and
easy to understand** — for real travellers, not lawyers.

## Non-negotiable rules

1. **Bilingual.** Every text field is `{ en, fr }`. English is written first (primary), French is a
   faithful translation. Both must be present and non-empty.
2. **Official sources only.** French ministries (Agriculture / DGAL, Douane, Intérieur,
   Service-Public), the European Commission (food.ec.europa.eu), EU legislation (EUR-Lex),
   Légifrance, and the destination country's own government / official veterinary authority.
   **No blogs, forums, commercial pet-relocation sites, or aggregators.**
3. **Never fabricate.** If a fact is not published in an official source, do not infer it. Write
   `"Unknown"` / `"Non communiqué"` in the field, or leave `travellerExperience: null`. It is always
   better to say *unknown* than to guess.
4. **Every factual claim is traceable.** Each requirement row carries an official `ref`, and the
   `sources` list contains the actual pages used.
5. **Dated & signed.** `verified_date` (YYYY-MM-DD), `reviewer`, `confidence` (1–5).
6. **Prefer tables and short blocks** over long paragraphs. Keep the whole page ~1,200–1,800 words.
7. **Distinguish rules from experience.** Official rules go in requirements/origin/arrival.
   Traveller anecdotes go only in `travellerExperience`, and only if documented.
8. **Requirements depend on three things** — always frame the guide around: (1) destination country,
   (2) country of departure, (3) countries of recent residence. The destination is only the first factor.

## Workflow per country

1. **Research first** (web + official docs). Gather: EU status (member / listed third country /
   non-listed), microchip rule, rabies rule, antibody-test rule, tapeworm rule, certificate/passport,
   border process, quarantine, restricted-breed law, national carriers.
2. **Only then** write `content/countries/<slug>.yml` following the contract below.
3. Run the ingest script; fix any Zod error until it passes.
4. Never edit the generated JSON by hand.

## Data contract (YAML fields)

Top level: `id` (`country_<iso2lower>` e.g. `country_fr`), `iso2` (2 letters), `name {en,fr}`,
`region {en,fr}`.

- **hero**: `h1 {en,fr}` (e.g. "Traveling to X with your dog"), `intro {en,fr}` (100–150 words:
  welcomes dogs; requirements vary by the dog's country of origin).
- **difficulty**: `level` = `easy|moderate|difficult`, `label {en,fr}` (rendered as a coloured gauge).
- **prepTime**: `eu`, `listed`, `nonListed` — each `{en,fr}` (rendered as a bar chart).
- **summary**: rows `{ requirement{en,fr}, status{en,fr}, cls }` where `cls` = `ok|no|warn|neutral`.
  Cover at least: Dogs allowed, Microchip, Rabies vaccination, Antibody test, Veterinary certificate,
  Quarantine (add Tapeworm where relevant). Colour convention: `ok` = allowed/not-required-good,
  `warn` = required action, `no` = prohibited/blocking, `neutral` = conditional.
- **notice**: array of `{en,fr}` bullets for the highlighted box — must state that MyDogCanFly gives
  general info (not veterinary/legal advice), only a vet validates the exact procedure, and that
  requirements depend on origin, travel history, identification, vaccinations, itinerary, date.
  **noticeClose** `{en,fr}`: "Always consult your veterinarian before booking your trip."
- **factors**: `title{en,fr}`, `intro{en,fr}`, `items[]` (`stars` 1–5, `label{en,fr}`, `text{en,fr}`),
  `note{en,fr}`. Exactly the three factors above (destination ★★★★★, departure ★★★★★, prior residence ★★★★).
- **requirements**: detailed table rows `{ item, required, when, exceptions, ref }` (all `{en,fr}`).
  Include at least: ISO microchip, Rabies vaccination, Rabies antibody test, EU pet passport,
  Animal health certificate, Tapeworm treatment, Advance notification/import permit, Border check,
  Quarantine (add Minimum age/puppies where relevant). `ref` cites the official instrument.
- **origin**: three blocks `eu`, `listed`, `nonListed`, each `{ title{en,fr}, body{en,fr}, cls }`
  (`ok`/`warn`/`no`). Explain the simplified EU procedure, the listed-country procedure, and the
  non-listed procedure (antibody test, waiting period, certificate, official endorsement).
- **arrival**: `intro{en,fr}`, `points[]` of `{en,fr}` — where checks occur, customs, border
  veterinary services, and the consequences of missing/invalid documents.
- **travellerExperience**: `{en,fr}` **only if documented from a reliable official/quantified source**,
  otherwise `null` (renderer shows "No reliable documented traveller feedback available.").
- **restrictedDogs**: `intro{en,fr}`, `cat1{en,fr}`, `cat2{en,fr}`, `note{en,fr}` — national
  breed/category legislation and import restrictions. If the country has no breed law, say so plainly.
- **checklist**: array of `{en,fr}` practical items (microchip, rabies, passport/certificate, vet
  visit, airline reservation, crate, printed documents…).
- **sources**: array of `{ label{en,fr}, url }` — official pages only, one per instrument used.
- **seo**: `title{en,fr}`, `metaTitle{en,fr}`, `metaDesc{en,fr}`, `slug` (matches the KB country slug),
  `shortDesc{en,fr}`.
- **verified_date** (YYYY-MM-DD), **reviewer** (string), **confidence** (1–5 integer).

## Rendered automatically (do NOT put in YAML)

- The **flag** (derived from `iso2`).
- **National airlines** — queried from the KB (`airline.country_id === country_id`) and linked to each
  airline fiche. Just make sure the country's carriers exist in the KB.
- The **Finder** call-to-action and the localized routing.

## Data-quality checklist before commit

- [ ] Every field bilingual and non-empty (or `Unknown` / `null` where truly unpublished).
- [ ] Every requirement row has an official `ref`; every `sources` URL is an official domain.
- [ ] Difficulty, prepTime and summary agree with the requirements table.
- [ ] Restricted-breed section reflects current national law (or states there is none).
- [ ] `verified_date` set to today; `confidence` honest.
- [ ] `node packages/knowledge/scripts/ingest-countries.mjs` passes with no errors.
