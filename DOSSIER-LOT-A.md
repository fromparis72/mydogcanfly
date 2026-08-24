# Lot A — Audit des 18 pays sans source · dossier de mesure et de conception

**Mesuré sur `main` après fusion du dossier d'achèvement (`1dd62010ea183422f02553877df4706714739080`).
Ce dossier ne corrige rien : aucune date, aucune source, aucune donnée métier n'est écrite.
Il sera soumis à contre-revue AVANT toute exécution.**

Reproduction : `node mesurer-lot-a.mjs` (lecture seule ; sortie 1 si l'état de référence a dérivé).
La liste des 18 est celle que le bloc contractuel du dossier d'achèvement fige
(`pays.identites_sans_source`, annexe A).

---

## 1. La mesure a changé la nature de la dette

Le dossier d'achèvement décrivait la dette ainsi : « 18 pays n'ont AUCUNE source — ni URL, ni
date, ni échéance ». C'est vrai **du référentiel** (`packages/knowledge/raw/objects.json`), et
c'est la couche que le registre des 1 505 mesure. Mais la mesure du lot révèle une **seconde
couche de provenance** que le dossier d'achèvement ne couvrait pas :

| couche | contenu pour les 18 | contrat de forme |
|---|---|---|
| **Référentiel** (`objects.json`) | cinq champs (`id, iso2, name, region, pet_scheme`), `pet_scheme` générique « National import rules », **0 règle du moteur ciblante**, **pas de `source`** | schéma canonique `Source` — absent ici |
| **Guides pays** (`content/countries/<iso2>.yml` → `countries.generated.json`) | un guide **riche et publié** par pays : exigences d'entrée détaillées (~20 000 caractères pour Bahreïn), races restreintes, autorité de sortie nommée, checklist, **3 à 7 liens sources (91 au total)**, `verified_date` (17 × 2026-07-15, 1 × 2026-07-11), `reviewer`, `confidence` 2–4 | zod à l'ingestion : `label+url` par lien — **sans date, sans type, sans confiance par lien** ; `verified_date` validé par **regex seulement** (une date impossible passerait) |

**La dette réelle n'est donc pas « trouver des sources » : les candidates existent déjà, publiées.**
La dette est que rien ne relie les deux couches : le site affirme des formalités détaillées avec
des liens vers des autorités, pendant que le référentiel — la couche que le système de revue
mesurera (lot B) — dit « aucune provenance ». Le lot A doit **auditer les sources déjà publiées
et promouvoir, par pays, UNE `Source` canonique dans le référentiel** — ou constater
véridiquement qu'aucune ne tient, ce qui met alors le guide publié lui-même en cause (§ 6,
escalade — jamais de correction silencieuse).

Deux faits de mesure encadrent l'ambition :

- **Les guides des 18 citent presque exclusivement des hôtes gouvernementaux du pays de
  destination** (`customs.gov.bh`, `agrocalidad.gob.ec`, `fsvps.gov.ru`, `gub.uy`…). À
  l'inverse, le panorama des **122 pays déjà sourcés** au référentiel montre : 44 ×
  `mydogcanfly.com` (la boucle du lot C), 5 × `pettravel.com` (agrégateur commercial), 1 ×
  `anivetvoyage.com`, 1 × `kenya.org.za`. **Les 18 « sans source » ont des candidates souvent
  meilleures que les sources actuelles des 122.** Le lot A fixera la barre de qualité vers le
  haut, pas vers l'existant.
- **La couche guides, globalement : 140 guides sur 140 datés, 800 liens sources** — tous hors du
  registre des 1 505. Ce constat est transmis pour l'exactitude du périmètre du dossier
  d'achèvement (son registre est celui de `raw/`, et il le dit) ; l'unification éventuelle des
  deux couches est une question de conception pour le **lot B**, pas pour le lot A.

## 2. Inventaire exact

Colonne « candidates » : les hôtes des liens **déjà publiés par le guide du pays** — aucune URL
inventée. Classification proposée (à confirmer par l'audit, § 3) : **D** = autorité du pays de
destination · **T** = source officielle tierce (USDA APHIS, trade.gov…) · **A** = autre.

| pays | régime (guide) | conf. | candidates (hôtes distincts) | classe |
|---|---|---|---|---|
| `country_bh` Bahreïn | listed | 3 | customs.gov.bh · services.bahrain.bh · mun.gov.bh | D |
| `country_bs` Bahamas | non_listed | 3 | bahamas.gov.bs · cdn.bahamas.gov.bs · bahfsabahamas.com | D |
| `country_ci` Côte d'Ivoire | non_listed | 3 | ressourcesanimales.gouv.ci · gucecotedivoire.ci · aphis.usda.gov | D+T |
| `country_ec` Équateur | non_listed | 4 | agrocalidad.gob.ec · cancilleria.gob.ec · bioseguridadgalapagos.gob.ec · abgalapagos.gob.ec | D |
| `country_et` Éthiopie | non_listed | 2 | eaa.gov.et · esw.et · moa.gov.et · aphis.usda.gov · trade.gov | D+T |
| `country_fj` Fidji | listed | 4 | baf.com.fj (Biosecurity Authority of Fiji) | D |
| `country_gh` Ghana | non_listed | 3 | vsd.gov.gh · mofa.gov.gh · brussels.mfa.gov.gh · gra.gov.gh · aphis.usda.gov | D+T |
| `country_jm` Jamaïque | listed | 4 | moa.gov.jm | D |
| `country_kw` Koweït | non_listed | 2 | paaf.gov.kw · e.gov.kw · washington.mofa.gov.kw · aphis.usda.gov | D+T |
| `country_lb` Liban | non_listed | 2 | agriculture.gov.lb · regulations.agriculture.gov.lb · nylebcons.org · leap.unep.org · aphis.usda.gov | D+T+A |
| `country_mg` Madagascar | non_listed | 2 | douanes.gov.mg · minae.gov.mg · aphis.usda.gov | D+T |
| `country_mv` Maldives | non_listed | 4 | customs.gov.mv · gov.mv | D |
| `country_ng` Nigeria | non_listed | 3 | naqs.gov.ng · customs.gov.ng · aphis.usda.gov | D+T |
| `country_np` Népal | non_listed | 3 | dls.gov.np · lawcommission.gov.np · vcn.gov.np · tia.immigration.gov.np · uk.nepalembassy.gov.np | D |
| `country_om` Oman | non_listed | 4 | customs.gov.om · gov.om · omanportal.gov.om | D |
| `country_ru` Russie | non_listed | 3 | fsvps.gov.ru · customs.gov.ru · static.government.ru | D |
| `country_sc` Seychelles | non_listed | 3 | mofbe.gov.sc · environment.gov.sc · saa.gov.sc | D |
| `country_uy` Uruguay | non_listed | 4 | gub.uy · normas.mercosur.int | D |

Points d'attention relevés par la mesure, à traiter pendant l'audit :

- **Fidji** : tous les liens sont sur `baf.com.fj` — la Biosecurity Authority of Fiji est bien
  l'autorité compétente mais son domaine n'est pas `.gov.fj` ; l'audit devra établir
  l'officialité du domaine (par exemple depuis le portail gouvernemental fidjien), pas la
  supposer au TLD.
- **Bahamas** : même cas pour `bahfsabahamas.com` (BAHFSA) — l'autorité nommée par le guide.
- **Liban** : deux liens ne sont ni l'autorité ni une source officielle tierce
  (`nylebcons.org` — consulat à New York ; `leap.unep.org` — base juridique du PNUE). S'ils
  restent les seuls à tenir, le cas passe en arbitrage (§ 6).
- **Éthiopie et Koweït** (confiance guide : 2) : candidates les plus fragiles ; les liens
  `aphis.usda.gov` (exigences vues par les USA) ne décrivent pas l'importation VERS le pays
  avec autorité — utiles en corroboration, **inéligibles comme source promue** (§ 3).

## 3. Conception — la matrice d'audit, et ce qui peut être promu

**Livrable d'exécution : `audit-pays.json`**, versionné à la racine (même philosophie que
`couvertures-guides.json` : l'état d'un travail humain, sous contrôle de forme mécanique).
Une entrée par pays — exactement les 18, ni plus ni moins :

```json
{
  "country_bh": {
    "candidates": [
      { "url": "https://www.customs.gov.bh/…", "consultee_le": "AAAA-MM-JJ",
        "accessible": true, "verdict": "officielle",
        "notes": "Douanes de Bahreïn, page d'importation des animaux personnels" }
    ],
    "decision": {
      "statut": "promue",
      "source": { "url": "…", "source_type": "government", "verified_date": "AAAA-MM-JJ",
                  "review_due": "(dérivée)", "confidence": 3,
                  "reviewer": "…", "history": [] }
    },
    "audite_par": "…", "audite_le": "AAAA-MM-JJ"
  }
}
```

Règles de conception :

- **`verdict` par candidate** : `officielle` (l'autorité du pays, ou son portail gouvernemental),
  `officielle_tierce` (USDA APHIS, trade.gov — corroboration seulement), `non_officielle`,
  `inaccessible`. Une candidate `inaccessible` est un constat, jamais un verdict d'officialité.
- **`decision.statut`** : `promue` (une `Source` canonique complète, prête à écrire dans
  `objects.json`) ou `aucune_source_officielle` (avec `motif` obligatoire). Pas de troisième
  état : « en cours » n'existe pas dans un livrable fusionnable.
- **Éligibilité à la promotion** : verdict `officielle` uniquement — l'autorité du pays de
  destination. Ni `officielle_tierce`, ni un lien du guide qui n'aurait pas été consulté.
- **`verified_date` = la date de consultation pendant l'audit** — pas la date du guide
  (2026-07-15), qui appartient à une autre couche et à un autre contrat.
- **`review_due` dérivée, jamais saisie** : `reviewDueFrom(verified_date, "country")` —
  ADR-0007, cadence 180 jours. C'est plus fort que l'ordre des dates : l'égalité exacte à la
  dérivation canonique est exigée.
- **Le schéma du référentiel n'est PAS étendu.** Pour un pays en `aucune_source_officielle`,
  `objects.json` reste sans `source` ; la déclaration véridique vit dans `audit-pays.json`
  (motif, date, auditeur). *Alternative écartée mais soumise à contre-revue : un champ
  `source_audit` dans `objects.json` — écartée parce qu'elle change le schéma canonique pour
  porter une absence, et que le lot A doit toucher le moins de contrats possible.*
- **Qui audite** : je consulte et documente chaque candidate ; Codex contre-vérifie sur pièces ;
  les cas ambigus (§ 2) sont arbitrés par Philippe. Aucun verdict `officielle` sans que l'URL
  ait été consultée le jour dit.

## 4. Critères d'acceptation

1. `audit-pays.json` couvre **exactement** les 18 identités contractuelles — aucune retirée,
   aucune ajoutée.
2. Chaque pays a un `decision.statut` parmi les deux états, et chaque `promue` porte une
   `Source` **validée par le schéma canonique** (`Source.safeParse`), avec `review_due`
   **égale** à `reviewDueFrom(verified_date, "country")`.
3. Aucune source promue sur un hôte `mydogcanfly.com` (jugé au nom d'hôte parsé) ni sur un
   verdict autre que `officielle`.
4. Chaque candidate promue a `accessible: true` et une `consultee_le` qui existe au calendrier.
5. Tout `aucune_source_officielle` porte un `motif` non vide.
6. `objects.json` ne change **que** par l'ajout de blocs `source` aux pays promus — l'écart se
   vérifie d'un `git diff` : aucun autre champ, aucun autre objet.

## 5. Contre-épreuves (le harnais d'exécution devra les faire rougir)

| # | mutation | attendu |
|---|---|---|
| 1 | une `verified_date` posée sans `url` | échec — schéma canonique |
| 2 | `review_due` ≠ `reviewDueFrom(verified_date, "country")` (même postérieure et valide) | échec — dérivation ADR-0007, le schéma seul ne la voit pas (vérifié : il accepte `review_due` antérieure) |
| 3 | un pays retiré de `audit-pays.json` | échec — la matrice doit compter 18/18 |
| 4 | un 19ᵉ pays ajouté à la matrice | échec — symétrique |
| 5 | source promue avec hôte `mydogcanfly.com` | échec — auto-citation, au nom d'hôte |
| 6 | source promue depuis une candidate `officielle_tierce` ou `non_officielle` | échec — éligibilité |
| 7 | source promue dont l'URL n'apparaît dans aucune candidate consultée | échec — pas d'audit, pas de promotion |
| 8 | `consultee_le` ou `audite_le` = « 2026-02-31 » | échec — l'existence du jour, pas la regex (la leçon des guides) |
| 9 | `aucune_source_officielle` sans motif | échec |
| 10 | un bloc `source` écrit dans `objects.json` pour un pays dont la matrice dit `aucune_source_officielle` | échec — la matrice fait foi |

## 6. Interdits, et effets de bord assumés

- **Interdit : poser une date sans audit.** Fabriquer une provenance est pire que n'en avoir
  aucune — c'est le principe fondateur du lot, hérité du dossier d'achèvement.
- **Interdit : modifier les guides YAML dans ce lot.** Si l'audit révèle qu'un guide publié
  n'est pas soutenu par ses propres sources (liens morts, autorité mal nommée, affirmation sans
  appui), le constat est documenté dans la matrice et **escaladé à Philippe et Codex** — la
  correction du guide serait un autre lot, avec son propre périmètre.
- **Interdit : promouvoir `aphis.usda.gov` ou tout tiers comme source d'un pays de
  destination** — la corroboration n'est pas la provenance.
- **Effet de bord assumé : le bloc contractuel du dossier d'achèvement rougira.** L'exécution du
  lot A changera `pays.sans_source` (18 → moins), les totaux et les empreintes du registre :
  `--verifier-dossier` sortira en 1 sur le nouveau `main` — **c'est le comportement voulu**
  (« donnée source modifiée sous un bloc figé »). Le dossier d'achèvement est un instantané
  daté du 23/08/2026 : sa vérification se reproduit sur son SHA de référence, pas sur la tête
  de `main`. Ce point est posé ici pour que personne ne « répare » ce rouge en régénérant le
  bloc en silence.

## 7. Ce que ce dossier attend de la contre-revue

1. Validation de la **requalification** (§ 1) : auditer et promouvoir l'existant publié, plutôt
   que chercher ex nihilo.
2. Validation du choix **matrice sans extension de schéma** (§ 3) — ou demande de l'alternative
   `source_audit`.
3. Validation de la **barre d'éligibilité** (verdict `officielle` du pays de destination
   uniquement) et du traitement des cas nommés : Fidji, Bahamas, Liban, Éthiopie, Koweït.
4. Complément éventuel de la table des contre-épreuves (§ 5).

Aucune exécution avant ce feu vert.
