# Contrat technique — Fiche « compagnie aérienne » MyDogCanFly

> Référence : **Air France** (`airline_air_france`) — la compagnie la plus contrainte, donc le gabarit le plus complet.
> Objectif : un modèle **universel** qui fonctionne sans modification pour Air France, Lufthansa, KLM, Emirates, United, Thai… et à terme des centaines de compagnies.
> Ce document définit le **contrat d'intégration**. Il ne contient aucun contenu Air France.

---

## 0. Principe directeur (à lire en premier)

Le projet sépare déjà, **structurellement**, trois natures de données. Le modèle de fiche s'appuie dessus — il **ne crée pas** un système parallèle :

| Nature | Où ça vit aujourd'hui | Lu par le moteur ? | Auteur |
|---|---|---|---|
| **Faits structurés** (politique cabine/soute/fret, poids, dimensions, restrictions, tarifs, dessertes, sources) | Knowledge Base : `packages/knowledge/raw/objects.json` (objet `Airline`) + `raw/rules.json` (règles) | **Oui** | Ingéré depuis un fichier `.yml` par compagnie |
| **Contenu éditorial** (prose, récit, FAQ longues, conseils) | `content/hub/drafts/airline_guide/<slug>.<locale>.md` → `raw/guides.json` | **Non** (présentation seule) | Markdown par langue |
| **Calculé / généré** (note /5, `review_due`, `served_airport_ids`, `direct_routes`, hubs) | `objects.json`, écrit par des scripts | Oui | **Jamais à la main** |

**Règle anti-duplication (point 10) :** la prose Markdown **ne répète jamais** un fait chiffré. Elle le **référence** via un marqueur `{{fait: <airline_id> | <clé>}}` résolu à l'ingestion depuis la KB. Un fait n'existe qu'à **un seul endroit** (le `.yml` → KB) ; l'éditorial le cite.

Donc **une fiche = deux artefacts** produits par ChatGPT :

1. `content/airlines/<slug>.yml` — **fichier de données neutre** (une seule langue-neutre, micro-textes en `{en,fr,es}`). Source de vérité structurée → alimente le moteur.
2. `content/hub/drafts/airline_guide/<slug>.<locale>.md` — **guide éditorial** (un par langue : `.en.md`, `.fr.md`, `.es.md`). → Travel Hub.

---

## 1. Emplacement exact des fichiers

```
content/
  airlines/
    air-france.yml                ← NOUVEAU : données structurées (1 par compagnie, neutre)
  hub/drafts/airline_guide/
    air-france.en.md              ← EXISTE : guide éditorial EN
    air-france.fr.md              ← EXISTE : guide éditorial FR
    air-france.es.md              ← à ajouter : guide éditorial ES

packages/knowledge/
  src/objects.ts                  ← schéma Zod Airline / AirlinePremium (source de vérité du type)
  src/rules.ts                    ← schéma Zod Rule (règles moteur)
  src/common.ts                   ← Source, LocalizedText, Locale, enums
  src/guides.ts                   ← schéma Zod Guide (éditorial)
  raw/objects.json                ← KB générée (airlines) — NE PAS éditer à la main
  raw/rules.json                  ← KB générée (rules)
  raw/guides.json                 ← guides ingérés
  scripts/ingest-guides.mjs       ← EXISTE : Markdown → guides.json (résout {{fait:}})
  scripts/ingest-airlines.mjs     ← NOUVEAU (à créer) : content/airlines/*.yml → objects.json + rules.json
```

- **Collection Astro** : il n'y a **pas** de content collection Astro pour les compagnies. Les pages compagnie sont rendues par `packages/ui/src/components/EntityPage.astro` à partir de la **KB** (via `packages/ui/src/lib/pagedata.ts`), pas par `astro:content`. On conserve ce modèle.
- **Schéma Zod** : `packages/knowledge/src/objects.ts` (`Airline`, `AirlinePremium`, `PlacementPolicy`) et `src/rules.ts` (`Rule`). Le `.yml` est validé contre une projection de ces schémas dans `ingest-airlines.mjs`.

---

## 2. Format & conventions de nommage

| Élément | Convention | Exemple |
|---|---|---|
| Identifiant compagnie | `airline_<snake_case>` | `airline_air_france` |
| Slug (URL + fichier) | `kebab-case` du nom | `air-france` |
| Fichier données | `content/airlines/<slug>.yml` | `air-france.yml` |
| Guide éditorial | `content/hub/drafts/airline_guide/<slug>.<locale>.md` | `air-france.fr.md` |
| Code IATA | 2 caractères | `AF` |
| URL de page | `/airlines/<slug>/` (EN) · `/fr/airlines/<slug>/` · `/es/airlines/<slug>/` | `/fr/airlines/air-france/` |

- Le **`.yml`** est **langue-neutre**. Les micro-chaînes affichables (une ligne de « conditions », le résumé) sont des objets `LocalizedText` : `{ en: "...", fr: "...", es: "..." }` (EN obligatoire, autres optionnelles).
- Le **`.md`** est **par langue** ; son `body` est de la prose ; les faits sont des marqueurs `{{fait: airline_air_france | cabin_summary}}`.

---

## 3. Schéma complet du fichier de données `content/airlines/<slug>.yml`

Types : `string`, `int`, `number`, `bool`, `LocalizedText` = `{en, fr?, es?}`, `Source` (§9), `enum` (valeurs listées).
Obligatoire = **●**, facultatif = ○.

```yaml
# ── Identité (→ KB objects.json : Airline) ─────────────────────────────
id: airline_air_france            # ● string, motif airline_<snake>
iata: AF                          # ● string(2)
name: Air France                  # ● string (neutre, non traduit)
country_id: country_fr            # ● string, motif country_<iso/snake>  (doit exister dans la KB)
alliance: skyteam                 # ● enum: star_alliance | oneworld | skyteam | none
website: https://www.airfrance.fr # ○ url

# ── Réseau — NE PAS remplir à la main (généré) ─────────────────────────
# serves_country_ids / hub_airport_ids / served_airport_ids / direct_routes
# sont produits par apply-serves-curated.mjs + fill-hubs.mjs. Ne pas les mettre ici.

# ── Politique de transport (→ Airline.premium.policy : PlacementPolicy) ─
# Chaque placement est OPTIONNEL. S'il est présent, il DOIT porter sa source.
policy:
  cabin:                          # ○ bloc (absent = « Inconnu », voir §6)
    status: allowed               # ● enum: allowed | not_allowed | not_applicable | unknown | to_confirm
    max_weight_kg: 8              # ○ number > 0 (poids incl. sac si la compagnie le dit)
    carrier_dims_cm: { l: 46, w: 28, h: 24 }  # ○ {l,w,h} number
    fee:                          # ○ tarif tel que publié (LocalizedText neutre OK : voir §6.multi-devises)
      en: "€70 to €200"
      fr: "70 € à 200 €"
      es: "70 € a 200 €"
    conditions:                   # ○ LocalizedText — une ligne, affichée telle quelle
      en: "One pet under the seat, soft carrier."
      fr: "Un animal sous le siège, sac souple."
    source: { … Source … }        # ● si le bloc est présent
  hold:   { status: …, source: … }   # ○ même structure
  cargo:  { status: …, source: … }   # ○ même structure

# ── Tarifs simples (→ Airline.fees) — alternative légère à policy.*.fee ─
# Utiliser SOIT policy.<p>.fee (riche) SOIT fees.<p> (court). Ne pas dupliquer.
fees:                             # ○
  cabin: "€70–200"                # ○ string court, tel que publié
  hold:  "€100–600"
  cargo: null                     # null = non publié / non applicable

# ── Restrictions (→ règles moteur, rules.json) ─────────────────────────
restrictions:                     # ○
  brachycephalic:                 # ○ races brachycéphales
    hold: forbidden               # enum: allowed | forbidden | unknown | to_confirm
    cabin: allowed
    note: { en: "…", fr: "…" }    # ○ LocalizedText
    source: { … Source … }        # ● si bloc présent
  banned_breeds:                  # ○ liste de races interdites (au-delà du brachy global)
    - breed_id: breed_pit_bull    # ● string breed_<snake> (doit exister)
      placement: [hold, cargo]    # ● liste enum placement
      source: { … Source … }      # ●
  aircraft:                       # ○ politique PAR TYPE d'appareil (map — clé = code appareil)
    B777: { compatible: true,  note: { en: "…", fr: "…" }, source: { … Source … } }
    A350: { compatible: true,  source: { … Source … } }
    A320: { compatible: false, note: { en: "No hold pets on A320", fr: "Pas d'animaux en soute sur A320" }, source: { … Source … } }
  routes:                         # ○ restrictions d'itinéraire (embargos géographiques)
    - note: { en: "No pets to/from UK", fr: "Pas d'animaux vers/depuis le R.-U." }
      source: { … Source … }

# ── Environnement & température (→ carte dédiée ; heat_embargo → moteur) ─
# L'info n° 1 pour les grands chiens. Bloc affiché seulement si présent.
environment:                      # ○
  pressurised: true               # bool | null(=inconnu)
  temperature_controlled: true    # bool | null
  published_temperature_range:    # ○ fourchette thermique publiée par la compagnie
    min_c: 5                       #   int (°C)
    max_c: 25
  heat_embargo:                   # ○ (→ règle moteur summer_embargo)
    applies: true                 # bool
    threshold_c: 30               # int (°C)
    placement: [hold, cargo]
    source: { … Source … }
  cold_embargo:                   # ○ (embargo froid symétrique)
    applies: false
    threshold_c: -5
    placement: [hold, cargo]
    source: { … Source … }
  ground_time_limit:              # ○ temps max au sol / tarmac avant embarquement
    minutes: 45                    #   int
    note: { en: "…", fr: "…" }
    source: { … Source … }
  climate_notes: { en: "…", fr: "…" }   # ○ LocalizedText
  source: { … Source … }          # ○ source globale du bloc

# ── Expérience voyageur (→ éditorial, JAMAIS lu par le moteur) ──────────
# Indépendant de la politique officielle. Chaque item = evidence.type community|observed.
experience:                       # ○ liste SourcedNote
  - text: { en: "Fast dog recovery at CDG (~20 min).", fr: "Récupération rapide du chien à CDG (~20 min)." }
    source: { … Source … evidence: { type: community } … }

# ── Chien d'assistance (→ badge + section) ─────────────────────────────
assistance_dog:                   # ○
  accepted: true                  # bool | null
  in_cabin_free: true             # bool | null
  note: { en: "…", fr: "…" }
  source: { … Source … }

# ── Contact (→ Airline.contact) ────────────────────────────────────────
contact:                          # ○
  phones:                         # ● si bloc présent (min 1)
    - region: { en: "France", fr: "France" }   # ● LocalizedText
      number: "+33 9 69 39 36 54"               # ● string
  source: { … Source … }          # ●

# ── Réservation / démarches (→ AirlinePremium.booking) ─────────────────
booking:                          # ○ SourcedNote
  text: { en: "Book by phone ≥ 48 h before departure.", fr: "…" }
  source: { … Source … }

# ── Résumé éditorial court (→ AirlinePremium.summary) ──────────────────
summary:                          # ○ LocalizedText — 1–2 phrases, affiché dans le hero
  en: "…"
  fr: "…"
summary_source: { … Source … }    # ○ Source du résumé

# ── Historique / jurisprudence / exemples / conseils / FAQ (éditorial) ─
history:                          # ○ liste TimelineEntry
  - year: 2019
    event: { en: "…", fr: "…" }
    source: { … Source … }
precedents:                       # ○ liste SourcedNote — UNIQUEMENT si cas réel citable
  - text: { en: "…", fr: "…" }
    source: { … Source … }
examples: []                      # ○ liste SourcedNote
tips: []                          # ○ liste SourcedNote
faq:                              # ○ liste FaqEntry
  - q: { en: "…", fr: "…" }
    a: { en: "…", fr: "…" }
    source: { … Source … }

# ── Logo & média (→ AirlinePremium.logo / hero_photo) ──────────────────
logo:                             # ○ MediaRef (voir §8)
  src: "/brand/airlines/air-france/logo.svg"
  placeholder: true               # bool (true tant que pas d'asset libre de droits)
  alt: { en: "Air France logo", fr: "Logo Air France" }
  credit: "© Air France"          # ○
  source_url: https://…           # ○

# ── Version & vérification de la fiche ─────────────────────────────────
last_reviewed: 2026-07-11         # ● date de VÉRIFICATION (YYYY-MM-DD)
policy_version: "2026.1"          # ○ version de politique de la compagnie (indépendante)
effective_date: 2026-04-01        # ○ date d'ENTRÉE EN VIGUEUR de la politique (indépendante)

# ── Historique des changements de politique (→ « Politique modifiée le… ») ─
change_log:                       # ○ (distinct de Source.history qui journalise la vérification)
  - date: 2026-04-01              # ● date du changement
    rule: AF-HOLD-003             # ○ code de règle concerné (§9 / point 9)
    description: { en: "Hold weight limit raised to 75 kg.", fr: "Limite soute portée à 75 kg." }  # ● LocalizedText
    source: { … Source … }        # ●
```

> **Codes de règle lisibles** (point 9) : chaque bloc `policy.*` et chaque restriction peut porter un `code:` humain stable, ex. `code: AF-CAB-001` (cabine), `AF-HOLD-003` (soute), `AF-BRACHY-002` (brachy). Ce code est conservé sur la règle générée (`rules.json`) en plus de son `id` technique, et sert de référence stable dans les articles et le `change_log`.

> **Ce qui N'est PAS dans le `.yml`** (généré / normalisé ailleurs) : `serves_country_ids`, `hub_airport_ids`, `served_airport_ids`, `direct_routes`, `rating` (note /5), `source.review_due` (dérivé de `verified_date` + cadence 90 j via `reviewDueFrom`).

---

## 4. Séparation des responsabilités

| Champ / bloc | Destination | Rôle |
|---|---|---|
| `policy.*.status`, `max_weight_kg`, `restrictions.*`, `seasonal_heat_embargo` | **rules.json** (règles moteur) + `objects.json` (premium.policy) | **Moteur** : candidature, verdict cabine/soute/fret, embargo |
| `fees`, `policy.*.fee`, `policy.*.conditions`, `contact` | **objects.json** | Moteur (frais affichés) + composants |
| `summary`, `history`, `precedents`, `examples`, `tips`, `faq`, `hold_environment.note` | **objects.json** (premium) | **Éditorial** structuré (cartes, accordéons) |
| Corps Markdown des `.md` | **guides.json** | **Éditorial** long-forme (Travel Hub). Ne contient que de la prose + marqueurs |
| `en/fr/es` dans chaque `LocalizedText` | KB (langue-neutre) | Traductions courtes |
| `.en.md` / `.fr.md` / `.es.md` | guides.json | Traductions longues |
| `rating`, `review_due`, réseau, `direct_routes` | scripts | **Calculé** — jamais à la main |

**Traductions :** EN obligatoire partout (`LocalizedText.en` requis). FR et ES optionnels mais attendus pour une fiche « complète ». Le rendu retombe sur EN si une langue manque (comportement `t()` / `LocalizedText` existant).

---

## 5. Composants Astro — existants vs à créer

Rendu de la page : `EntityPage.astro` (branche `airline` de `pagedata.ts`) + HTML du guide.

| # | Élément demandé | État | Composant / emplacement |
|---|---|---|---|
| 1 | Hero + logo + identité | **existe** (partiel) | `EntityPage.astro` (`headFlag`, `.ep__logo` monogramme sky-blue, `monogram:true`) — à enrichir avec `MediaRef.logo` réel |
| 2 | Badges Cabine / Soute / Fret / Chien d'assistance | **existe** (partiel) | badges du Finder (`.ab`) ; **à créer** un `<AirlineBadges>` réutilisable + badge assistance |
| 3 | Cartes d'infos essentielles | **existe** | `facts[]` de `pagedata.ts` → cartes `EntityPage` |
| 4 | Tableaux tarifaires | **à créer** | `<FareTable>` (multi-devises/zones, §6) |
| 5 | Température & environnement soute | **à créer** | `<HoldEnvironment>` (depuis `hold_environment`) |
| 6 | Alertes & exceptions | **à créer** | `<AirlineAlerts>` (embargo chaleur, restrictions itinéraire) |
| 7 | Restrictions races / appareils / itinéraires | **à créer** | `<Restrictions>` (depuis `restrictions.*`) |
| 8 | Accordéons de détails | **partiel** | `<details>` FAQ déjà utilisés (home) → factoriser `<Accordion>` |
| 9 | Date de dernière vérification | **existe** | `last_reviewed` (guide + premium) |
| 10 | Niveau de preuve par information | **à créer** | `<EvidenceBadge>` (mappe `Source.confidence` + `source_type`, §9) |
| 11 | Sources officielles | **existe** | `sources[]` du guide + `Source` de chaque bloc → `<SourceList>` |
| 12 | Verdict MyDogCanFly | **existe** | `rating {score, points}` (identity card V3, `upgradeToV3`) |
| 13 | Expérience voyageur | **à créer** | `<ExperienceCard>` (depuis `experience[]`, badge `community`/`observed`) |
| 14 | « Politique modifiée le… » | **à créer** | `<ChangeLog>` (depuis `change_log` + `policy_version`) |

Les composants « à créer » vivent dans `packages/ui/src/components/airline/`.

---

## 6. Règles d'affichage conditionnel

**Modèle de valeur à 5 états** (nouveau — voir §11) pour lever l'ambiguïté :

| Statut | Sens | Affichage |
|---|---|---|
| `allowed` / valeur publiée | Autorisé / donnée connue | Badge vert / valeur |
| `not_allowed` (`Non`) | Refusé par la compagnie | Badge rouge « Non » |
| `not_applicable` (`Non applicable`) | Le canal n'existe pas pour cette compagnie | Grisé « Non applicable » |
| `unknown` (`Inconnu`) | Donnée importante **non publiée** par la compagnie | « **Non communiqué par la compagnie** » |
| `to_confirm` (`À confirmer`) | Donnée trouvée mais non vérifiée officiellement | Pastille « À confirmer » (jaune) |

Règles :
- **Masquer** entièrement une section quand elle est `not_applicable` **et** sans intérêt (ex. pas de bloc `hold_environment` → pas de carte).
- **Afficher** « Non communiqué par la compagnie » quand une donnée **importante** (cabine, soute, fret, tarif) est `unknown` — jamais de carte vide.
- **Ne jamais** rendre une carte dont toutes les valeurs sont vides → si tous les champs d'une carte sont `unknown/absent`, la carte n'est pas rendue (sauf les 3 placements, toujours affichés avec leur statut).
- **Distinguer visuellement** les 5 états ci-dessus (couleur + libellé), jamais un simple booléen.

**Multi-devises / zones / poids / modes de calcul** (tarifs) : `FareTable` accepte une liste de lignes :
```yaml
fare_table:                       # ○ alternative structurée à fees/policy.fee quand plusieurs zones
  - zone: { en: "Within Europe", fr: "Europe", es: "Europa" }
    placement: cabin
    amount: 70
    currency: EUR                 # ISO 4217 (3 lettres)
    basis: per_segment            # enum: per_segment | per_flight | per_trip | on_request
  - zone: { en: "Intercontinental", fr: "Intercontinental" }
    placement: hold
    amount: 200
    currency: EUR
    basis: per_segment
```
Rendu : regroupé par placement, une colonne devise, badge `basis`. Si `on_request` → « Sur devis ». Les libellés `per_segment/per_flight/…` sont localisés par `strings.json` (clés `fare.basis.*`).

---

## 7. Responsive

- **Mobile (< 640 px)** : cartes en 1 colonne ; badges qui s'enroulent ; `FareTable` en cartes empilées (pas de scroll horizontal) ; accordéons fermés par défaut ; hero compact (logo réduit).
- **Tablette (640–960 px)** : 2 colonnes de cartes ; `FareTable` en tableau.
- **Ordinateur (> 960 px)** : 2–3 colonnes ; hero large avec logo + identité à gauche, verdict à droite.
- Contraintes existantes réutilisées : conteneur `.mdcf-container` (max-width), `--mdcf-*` design tokens, points de rupture 640/720/960 déjà en usage.

---

## 8. Gestion du logo (`MediaRef`)

Schéma existant (`objects.ts`) :
```
logo: { src, placeholder(bool), alt(LocalizedText), credit?, source_url? }
```
- **Fichier local** attendu : `packages/ui/public/brand/airlines/<slug>/logo.svg` → `src: "/brand/airlines/<slug>/logo.svg"`. Pas d'URL distante en production (perf + droits).
- **Formats admis** : SVG (préféré), sinon PNG transparent. Pas de JPEG.
- **Dimensions** : hauteur d'affichage 28–40 px (hero) ; asset SVG sans dimension fixe, ou PNG ≥ 2× (retina).
- **Alt** : `LocalizedText` obligatoire si logo présent (`"Logo <name>"`).
- **Marques** : les logos sont des marques déposées. Tant qu'aucun asset libre de droits n'est en place, `placeholder: true` et le composant affiche le **monogramme sky-blue** actuel (`.ep__logo`) au lieu de l'image — comportement déjà en place. `credit` / `source_url` documentent la provenance. Aucune image de marque n'est committée sans autorisation.

---

## 9. Traçabilité — schéma `Source` (existant, à réutiliser tel quel)

`packages/knowledge/src/common.ts` (existant + ajouts point 1/5/7) :
```
Source = {
  url: string(url),                                   # ● URL officielle
  evidence: { type: official | airline_contact | regulation | observed | community | estimated },  # ● NATURE (§11.5) — défaut official
  source_type: official_website | regulation | government | airline_contact | press | other,  # ● canal (dérivé de evidence.type à l'ingestion)
  verified_date: date (YYYY-MM-DD),                   # ● date de consultation / vérification
  effective_date: date,                               # ○ AJOUT — entrée en vigueur (indépendante)
  review_due: date,                                   # ● DÉRIVÉ (verified_date + 90 j) — ne pas saisir
  confidence: int 1..5,                               # ● niveau de confiance (★)
  reviewer: string,                                   # ● auteur de la vérification
  note: string,                                       # ○ AJOUT — extrait / note interne
  history: [{ date, reviewer, note? }]                # ○ journal de vérification
}
```
Correspondance avec ta demande :

| Ta demande | Champ `Source` |
|---|---|
| URL officielle | `url` |
| Intitulé de la source | via `source_type` + le contexte du bloc (publisher côté guide) |
| Date de consultation | `verified_date` |
| Date d'entrée en vigueur éventuelle | **à ajouter** : `effective_date?` (voir §11) |
| Extrait / note interne | `history[].note` (ou `note?` à ajouter, §11) |
| Niveau de confiance | `confidence` (1–5) |
| Méthode : publication officielle / confirmation écrite / téléphone / autre | `source_type` : `official_website`=publication ; `airline_contact`=écrit **ou** téléphone ; `regulation`/`government`=réglementaire ; `press`/`other` |

**Niveau de preuve affiché** (`<EvidenceBadge>`) — piloté par `evidence.type` (axe principal), nuancé par `confidence` (★) :
- `official` → « Source officielle » · `airline_contact` → « Confirmé par la compagnie » · `regulation` → « Réglementaire » (vert)
- `observed` → « Vérifié par MyDogCanFly » · `community` → « Retour d'expérience » (bleu)
- `estimated` → « À confirmer » (ambre)

---

## 10. Compatibilité DecisionReport / KB / Flight Finder

| Champ de la fiche | Alimente le moteur ? | Devenir dans la KB |
|---|---|---|
| `policy.cabin/hold/cargo.status` | **Oui** | Génère les règles `placement`/`cabin_weight`/`hold_weight` (`rules.json`) + `premium.policy` |
| `policy.*.max_weight_kg` | **Oui** | Règle `cabin_weight`/`hold_weight` (deny si `dog.weight_kg > max`) |
| `restrictions.brachycephalic` | **Oui** | Règle `breed_ban` (le refus soute brachy global existe déjà) |
| `restrictions.banned_breeds` | **Oui** | Règles `breed_ban` par race |
| `seasonal_heat_embargo` | **Oui** | Règle `summer_embargo` (deny hold/cargo si `weather.temperature_c > threshold`) |
| `fees`, `policy.*.fee` | Affiché | `Airline.fees` / `premium.policy.*.fee` |
| `contact` | Affiché | `Airline.contact` |
| `summary`, `history`, `precedents`, `examples`, `tips`, `faq`, `hold_environment` | **Non** (éditorial) | `Airline.premium.*` |
| Corps `.md` | **Non** | `guides.json` |
| `serves_*`, `hub_*`, `direct_routes`, `rating` | Oui (déjà) | **Généré** par scripts — pas dans la fiche |

**Éviter la duplication :**
- Un fait chiffré vit **uniquement** dans le `.yml` → KB. Le `.md` le cite via `{{fait: airline_air_france | cabin_summary}}` (résolu à l'ingestion).
- `ingest-airlines.mjs` est **idempotent** : il régénère l'entrée `airline_*` de `objects.json` et ses règles `rule_af_*` à chaque exécution, sans écraser les champs générés (réseau, rating) — il **merge** en préservant `served_airport_ids`, `direct_routes`, `hub_airport_ids`, `rating`.
- Le Finder / DecisionReport ne lisent **que** la KB (objects+rules) — jamais le Markdown ni le `.yml` directement.

---

## 11. Modifications à apporter à la structure actuelle

Pour supporter le modèle demandé, 4 ajouts **rétro-compatibles** :

1. **Statut à 5 états** (§6). Aujourd'hui `PlacementPolicy.allowed` est un `bool`. Ajouter :
   ```ts
   status: z.enum(["allowed","not_allowed","not_applicable","unknown","to_confirm"]).optional()
   ```
   Le moteur consomme `allowed = (status === "allowed")` (les 4 autres → non autorisé, par sécurité). L'UI utilise `status` pour l'affichage nuancé. `allowed` reste calculé pour compat.

2. **`Source` enrichi** (§9) — deux champs optionnels :
   ```ts
   effective_date: z.string().date().optional(),   // date d'entrée en vigueur d'une règle tarifaire
   note: z.string().optional(),                     // extrait / note interne
   ```

3. **`fare_table`** structuré (§6) sur `AirlinePremium` (optionnel) pour multi-zones/devises, en plus de `fees`/`policy.*.fee`.

4. **`ingest-airlines.mjs`** (nouveau script) : `content/airlines/*.yml` → validation Zod → écrit l'`Airline` dans `objects.json` (merge non destructif) + génère/actualise les règles `rule_<iata>_*` dans `rules.json`. À ajouter à la chaîne de déploiement **avant** `apply-serves-curated.mjs` et `ingest-guides.mjs`.

5. **`evidence.type` — la nature de chaque information** (le champ le plus important). Chaque fait porte, en plus de sa `source` (*d'où* vient l'info), une **classe de preuve** (*quelle est la nature* de la valeur) :
   ```yaml
   evidence:
     type: official | airline_contact | regulation | observed | community | estimated
   ```
   | Valeur | Sens | Badge affiché (FR / EN) | Couleur |
   |---|---|---|---|
   | `official` | Publié officiellement (site compagnie) | « Source officielle » / « Official source » | vert |
   | `airline_contact` | Obtenu auprès du service client (écrit/téléphone) | « Confirmé par la compagnie » / « Confirmed by the airline » | vert |
   | `regulation` | Issu d'une réglementation (IATA, UE, pays) | « Réglementaire » / « Regulatory » | vert |
   | `observed` | Observé par MyDogCanFly | « Vérifié par MyDogCanFly » / « Verified by MyDogCanFly » | bleu |
   | `community` | Retour d'expérience voyageur | « Retour d'expérience » / « Traveller report » | bleu |
   | `estimated` | Estimation / hypothèse (ex. modèle température) | « À confirmer » / « To confirm » | ambre |

   - Placé sur l'objet `Source` (`Source.evidence.type`), donc disponible partout où un fait est sourcé — un seul axe, pas de champ parallèle. Le `source_type` existant en est dérivé à l'ingestion (`official`→`official_website`, `airline_contact`→`airline_contact`, `regulation`→`regulation`, `observed`/`community`/`estimated`→`other`), donc aucune donnée existante n'est perdue.
   - Le concept existe déjà en germe : `climate.estimated` → `evidence.type: estimated`.
   - Alimente directement `<EvidenceBadge>` (§9). Défaut : `official`.

6. **Bloc `experience`** (nouveau, indépendant de la politique officielle) : données pratiques utiles aux voyageurs, jamais lues par le moteur. Ex. facilité d'enregistrement, rapidité de récupération du chien, qualité de la prise en charge, commentaires récurrents. Chaque item est un `SourcedNote` avec `evidence.type: community | observed`. Voir §3.

7. **Politique par appareil** — `aircraft` devient une **map par type d'appareil** (`{ compatible: bool, note?, source }`) au lieu d'une simple liste, car certaines compagnies varient selon l'avion (B777/A350 oui, A320 non). Voir §3.

8. **Bloc `environment` étendu** — l'environnement thermique est l'info n° 1 pour les grands chiens. Ajouts : `published_temperature_range`, `heat_embargo`, `cold_embargo`, `ground_time_limit`, `climate_notes` (en plus de `pressurised`/`temperature_controlled`). Voir §3.

9. **Identifiant lisible de règle** — chaque règle importante porte un `code` humain stable (`AF-CAB-001`, `AF-HOLD-003`, `AF-BRACHY-002`) en plus de son `id` technique `rule_af_*`. Permet le suivi dans le temps, la citation dans les articles, l'historique.

10. **`change_log`** (nouveau) — trace des évolutions de politique : `[{ date, rule (code), description(LocalizedText), source }]`. Permet d'afficher « Politique modifiée le… ». Distinct de `Source.history` (qui journalise la *vérification*, pas le *changement de politique*).

11. **`policy_version` + `effective_date`** — au niveau fiche : version de politique et date d'entrée en vigueur, **indépendantes** de `verified_date` (date de vérification). `effective_date` existe aussi au niveau `Source` pour une règle tarifaire précise.

Aucune de ces modifications ne casse l'existant : tous les champs ajoutés sont optionnels (défauts sûrs), les 76 fiches actuelles restent valides. Voir §13 pour les objets réutilisables et la montée en charge mondiale.

---

## 12. Livrables ChatGPT par compagnie (récap)

Pour chaque compagnie, ChatGPT produit :
1. `content/airlines/<slug>.yml` — conforme au §3 (EN obligatoire, FR/ES si dispo), **toutes** les valeurs sourcées, statuts explicites, aucune donnée inventée (`unknown`/`to_confirm` sinon).
2. `content/airlines/<slug>.<locale>.md` × {en, fr, es} — prose + marqueurs `{{fait:}}`, frontmatter minimal (`type: airline_guide`, `entity_id`, `slug`, `locale`, `title`, `description`, `last_reviewed`, `sources`).

Le reste (réseau, note /5, dates de revue, rendu, i18n des libellés d'UI) est géré automatiquement par le projet.

---

## 13. Objets réutilisables & base de données mondiale

### 13.1 Objets communs (point 8)

Ces structures deviennent des **schémas Zod nommés et partagés** dans `packages/knowledge/src/` — réutilisables par les compagnies, les pays, les aéroports, et par les futures API / comparateurs :

| Objet | Schéma | État | Réutilisé par |
|---|---|---|---|
| **Source** (+ `evidence`) | `common.ts` → `Source` | existe (à enrichir) | tout fait sourcé, partout |
| **Règle** | `rules.ts` → `Rule` (+ `code`) | existe | compagnies, pays, routes, races, global |
| **Restriction** | nouveau `Restriction` | à créer | `restrictions.*` (compagnie), embargos pays |
| **Tarif** | nouveau `Fare` (`{ zone, placement, amount, currency, basis }`) | à créer (`fare_table`) | compagnies, comparateur de prix |
| **Température / Environnement** | nouveau `Environment` | à créer (§3 `environment`) | compagnies, aéroports (soute, tarmac) |
| **Expérience** | nouveau `Experience` = `SourcedNote` + `evidence.type` | à créer | compagnies, aéroports |
| **LocalizedText** | `common.ts` | existe | tous les micro-textes |

Principe : un objet = **un schéma, une forme, une source**. Les composants Astro et une future API `/v1/airline/<slug>` consomment la même forme → pas de retraitement.

### 13.2 Montée en charge mondiale (point 9)

Le modèle est **déjà conçu pour l'échelle** — vérification :

| Dimension | Aujourd'hui | Cible | Le modèle tient-il ? |
|---|---|---|---|
| Compagnies | 76 | plusieurs centaines | **Oui** — 1 fichier `.yml` + `.md`/langue par compagnie, ingérés indépendamment ; aucun fichier monolithique à éditer à la main |
| Pays | 140 | plusieurs centaines | Oui — même patron (objet + règles + guide) |
| Aéroports | 249 | plusieurs milliers | Oui — objets normalisés, indexés par `id` |
| Routes | graphe | plusieurs milliers | Oui — `served_airport_ids` / `direct_routes` générés, jamais à la main |
| Langues | en/fr/es (+ de/it/nl/pt/ja prévus) | plusieurs | Oui — `Locale` couvre 8 langues ; `LocalizedText` (EN requis, reste optionnel) + guides par langue |

Garde-fous pour ne **jamais** avoir à restructurer :
1. **Séparation stricte** données (KB) / éditorial (Markdown) / calculé (scripts) — déjà en place.
2. **Références par `id`** partout (jamais par nom) → renommer un affichage ne casse rien.
3. **`ingest-*` idempotents et non destructifs** → régénération sûre à grande échelle.
4. **Champs optionnels + défauts sûrs** → une nouvelle donnée = un champ optionnel, jamais une migration.
5. **`evidence.type` + `provenance`** → on pourra mêler officiel, communautaire et estimé sans ambiguïté quand la base s'ouvrira aux contributions.
6. **1 fichier par entité par langue** → parallélisable (des centaines de fiches produites/vérifiées indépendamment).

### 13.3 Principes fondamentaux — VALIDÉS et figés (point 10)

Conservés tels quels : séparation KB / éditorial ; **YAML source de vérité** ; Finder alimenté **exclusivement** par la KB ; zéro doublon ; **système à 5 états** ; composants Astro réutilisables.

---

### Annexe — squelette `.yml` vide mais complet

Voir `content/airlines/_template.yml` (à générer avec ce contrat) : tous les champs du §3 présents, valeurs vides ou `unknown`, prêt à remplir.
```
