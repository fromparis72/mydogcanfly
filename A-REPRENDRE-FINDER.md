# À reprendre — trois défauts du Finder

Relevé le 8 août 2026, sur le cas **MSP Minneapolis → CDG Paris, Golden Retriever 32 kg**.
Diagnostic fait, correction non entreprise.

---

## 1. Le bloc « Before departure » ignore le pays de départ — le plus grave

**Ce qui s'affiche**, pour un vol venant des États-Unis :

> To the EU, a pet needs an ISO microchip, a valid rabies vaccination (first dose from 12 weeks
> of age, then a 21-day wait) and **an EU pet passport**. No rabies titer test or quarantine
> applies **between EU countries**.

**Pourquoi c'est faux.** Le passeport européen n'est délivré qu'à un animal *résidant* dans l'UE.
Depuis les États-Unis, il faut un **certificat sanitaire UE (EU Health Certificate, Annexe IV)**
endossé par un vétérinaire accrédité **USDA-APHIS**, valable **10 jours** à l'entrée. Et
« between EU countries » est hors sujet : ce n'est pas un déplacement intra-UE.
La conclusion « pas de titrage antirabique » est juste, mais **par accident** : les États-Unis
sont un pays tiers listé (Annexe II), pas parce que le trajet serait intra-UE.

**La cause, dans le code.** Quatre règles de `packages/knowledge/raw/rules.json` :

| règle | portée |
|---|---|
| `rule_fr_import` | `country_fr` |
| `rule_de_import` | `country_de` |
| `rule_nl_import` | `country_nl` |
| `rule_es_import` | `country_es` |

Chacune se déclenche sur **une seule condition** :

```json
"applies_when": { "all": [ { "fact": "route.dest_country_id", "op": "eq", "value": "country_fr" } ] }
```

Aucune condition sur l'origine. La règle vaut donc autant pour Lyon → Paris que pour
Minneapolis → Paris, en affirmant dans les deux cas le parcours intra-UE.

**Ce n'est pas une limite technique.** Le moteur expose déjà le fait `route.origin_country_id`
(`packages/engine/src/evaluate.ts:118`), et deux règles s'en servent déjà —
`rule_mx_import_us_ca` et `rule_mx_import_other`, écrites pour le Mexique. Le mécanisme existe,
ces quatre règles ne l'utilisent pas.

**Correction à faire.** Dédoubler chacune des quatre règles :

- *origine dans l'UE* → texte actuel, qui devient enfin exact ;
- *origine hors UE* → certificat sanitaire UE (Annexe IV) endossé par un vétérinaire officiel du
  pays de départ, valable 10 jours à l'entrée ; puce ISO ; vaccin antirabique valide ; titrage
  **seulement** si le pays de départ n'est pas listé à l'Annexe II.

Deux points de vigilance :
- ne pas se contenter des quatre pays repérés : **vérifier les 27 États membres**, la même
  formulation a pu être recopiée ailleurs ;
- la liste Annexe II (pays tiers listés, sans titrage) est une donnée sourcée à part entière —
  elle doit venir d'une source officielle, pas d'une liste écrite de mémoire.

---

## 2. « Cabin travel isn't possible on this route » — motif mal attribué

Ce n'est pas la route qui exclut la cabine, c'est **le poids de 32 kg**. Air France accepte les
animaux en cabine jusqu'à 8 kg sur le transatlantique. Un lecteur avec un petit chien conclut à
tort que la cabine lui est fermée sur cette liaison.

Le motif affiché doit nommer la vraie cause : « ton chien dépasse la limite cabine de cette
compagnie », et non une propriété de la route.

---

## 3. Fuite de localisation sur la date

Le sélecteur affiche **« 7 août 2026 » sur une page en anglais**. La date doit suivre la langue
de la page, comme partout ailleurs sur le site (`dateFormatter(locale)`).

---

## Ce qui n'est PAS concerné

Les **fiches pays** portent déjà la distinction UE / hors-UE, posée le 5 août au matin :
clés `from: eu | non_eu` sur les puces d'arrivée, `origin.scheme`, filtrage dans
`packages/ui/src/pages/[...loc]/tools/fiche.astro`. C'est le **Finder** qui n'a pas encore reçu
ce traitement — d'où l'incohérence entre les deux outils sur le même trajet.
