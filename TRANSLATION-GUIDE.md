# Translation & adaptation guide — mydogcanfly.com (EN) from lechienvoyageur.com (FR)

Working rules for translating FR articles in `/Users/philippe/Documents/GitHub/lechienvoyageur/content/posts/`
into EN articles in `/Users/philippe/Documents/GitHub/mydogcanfly/content/posts/`.

## Golden rules

1. **Native US English**, not word-for-word translation. US spelling (traveling, organize, color).
2. **International, origin-agnostic audience.** The FR site assumes the reader departs from
   France / returns to the EU. Rewrite that framing: the reader may fly from the US, UK,
   Canada, Australia or the EU. Where a rule depends on origin (e.g., rabies titer required
   for EU re-entry, US CDC dog-import rules, UK post-Brexit rules), say so explicitly with an
   origin-aware phrasing ("if you're returning to the EU…", "dogs entering the US must…").
3. **Never invent facts.** Keep all figures, limits, prices and rules from the FR source.
   Do not add new claims. If a paragraph is France-only trivia with no international value,
   generalize it or drop it.
4. **"titer test" must always be written as "rabies titer test"** (FR: titrage antirabique).
5. **Units:** always metric + imperial: "8 kg (18 lb)", "46 × 28 × 24 cm (18 × 11 × 9.5 in)",
   "30 °C (86 °F)". Round imperial sensibly. Prices: keep the original currency ("€200
   (~$230)" for EUR amounts; US carriers already in USD keep $).
6. **France-specific content** (SNCF, French highways, French beaches…): keep the useful
   substance but reframe for an international reader (e.g., SNCF becomes one example among
   European rail operators; mention Amtrak/UK/EU equivalents ONLY if you are certain of the
   facts — otherwise keep it generic).

## File naming & front matter

- File name = EN slug from `SLUG-MAP.md` (e.g. `air-france-dog-policy.md`).
- `title`: rich EN H1. `seoTitle`: ≤ 60 chars, keyword-first. `description`: ≤ 160 chars.
- `slug` + `url`: EN slug from SLUG-MAP.md (url = "/<slug>/").
- `categories` mapping: Voyager→Travel, Compagnies aériennes→Airlines,
  Destinations→Destinations, Santé→Health, Équipement→Gear.
- `tags`: translate to EN, lowercase where FR was lowercase.
- `author`, `date`, `lastmod`, `draft`: keep as-is.
- `images` + `cover.image`: keep the same URLs, but replace `utm_source=lechienvoyageur`
  with `utm_source=mydogcanfly`. `cover.alt` and `cover.caption`: translate to EN
  (keep photographer credit + links).
- `summary`: translate (used as excerpt).
- `faq`: translate every q/a (this feeds visible FAQ + FAQPage JSON-LD).
- **Add** `frUrl: "/<fr-slug>/"` (the original FR URL) — used for hreflang.

## Body

- Keep ALL shortcodes: `{{< enbref >}}`, `{{< meta >}}` (translate the `niveau=` value and
  you may rename the param to `level=`), `{{< alerte type="..." >}}` (keep type values
  `obligatoire|verifier|attention` or use aliases `required|check|warning`),
  `{{< faq >}}`, `{{< outils >}}`, `{{< etapes >}}`, `{{< comparatif-compagnies >}}`,
  `{{< formalites-pays >}}`, `{{< produit id="..." >}}`. Translate the inner markdown.
- Keep the emoji at the start of each `enbref` bullet (they map to icons).
- Keep inline HTML blocks (e.g. `lcv-fiche-logo`) and translate only their visible text.
- **Internal links:** every internal link MUST be rewritten with the EN slug from
  `SLUG-MAP.md`. No FR slug may survive. `/outils/...` links → `/tools/...` equivalents.
- External links: keep official sources. If the official site has an obvious English
  version you are certain about (e.g. same domain /en/), you may link it; otherwise keep
  the original URL.
- H2/H3 heading "Sources" stays "Sources".
- Do not change image URLs other than the utm swap.

## Tone

Warm, expert, practical — a knowledgeable friend who has done this trip before.
Short sentences. No fluff. Keep the FR site's structure (H2/H3 order) unless a section is
France-only and must be generalized.
