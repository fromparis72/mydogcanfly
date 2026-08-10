# §15.5 — Données sous-qualifiées ou autorisées par défaut

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main) — donc APRÈS le correctif « fiche = socle systématique » du 10/08/2026, mais AVANT le patch « weight-brachy-conditions » du même jour, qui n'a pas encore été appliqué/poussé par Philippe au moment de cet inventaire (voir document 09, point sur ce patch).**

Mesuré par script (Node, chargement direct de `objects.json`/`rules.json` depuis ce SHA exact, reproductible). Rappel du filet de sécurité en place à ce SHA (`evaluate.ts` l.260) : `allowed !== true` → refus, donc `false` et absent sont traités identiquement.

## Chiffre 1 — Couverture de la fiche

**102 compagnies au total, 102 avec `premium.policy` présent (100 %).** Aucune compagnie sans fiche à ce SHA.

## Chiffre 2 — `conditional: true`, jamais lu par le moteur

**74 occurrences au total : cabin 2 · hold 6 · cargo 66.**

Confirmé par grep (`packages/engine/src/*.ts`) : zéro lecture du champ `.conditional` de la fiche (les seules occurrences du mot dans `contracts.ts`/`explain.ts` sont un statut de verdict `"conditional"`, sans rapport). Ces 74 cas où la compagnie documente elle-même une condition (ex. taille de cage, race, saison) n'ont aujourd'hui aucun effet sur la décision — ils sont silencieusement traités comme un `allowed` plein.

## Chiffre 3 — Absence de filet de sécurité poids pour hold/cargo

**73 compagnies ont `hold.allowed === true` ; 31 d'entre elles n'ont aucune règle `hold_weight` spécifique dans `rules.json`.**

Il existe un filet global pour la cabine (`rule_global_cabin_weight_cap`, 10 kg) mais **aucun équivalent pour le hold ou le cargo**. Pour ces 31 compagnies, un chien peut être déclaré éligible en soute sans qu'aucune limite de poids ne soit appliquée par le moteur, même quand la fiche documente un `max_weight_kg` (ce champ n'est pas lu automatiquement, cf. chiffre 4).

Liste : `air_aerolineas_argentinas`, `air_astana`, `air_austral`, `air_canada`, `air_mauritius`, `airbaltic`, `asiana`, `austrian`, `bangkok_airways`, `condor`, `croatia_airlines`, `edelweiss`, `emirates`, `iberia_express`, `lot`, `lufthansa`, `luxair`, `malaysia_airlines`, `neos`, `pegasus`, `royal_jordanian`, `saudia`, `sky_express`, `smartwings`, `south_african_airways`, `sunexpress`, `swiss`, `tarom`, `transavia`, `tunisair`, `turkish` (préfixe `airline_` omis pour lisibilité).

## Chiffre 4 — Champs jamais lus par le moteur

**`brachy_allowed` : renseigné pour 34 compagnies (toutes sur le placement hold) — `carrier_dims_cm` : renseigné pour 8 compagnies.**

Grep confirmé : zéro occurrence de `brachy_allowed` ou `carrier_dims_cm` dans `packages/engine/src/*.ts` ni `packages/workers/src/*.ts`. Les règles qui interdisent le hold aux races brachycéphales existent bien (`rule_global_brachy_hold` et variantes par compagnie) mais s'appuient sur le fait `dog.brachycephalic` fourni par l'utilisateur, **jamais** sur ce champ de fiche — qui reste une donnée orpheline, saisie mais jamais consultée par la décision.

## Chiffre 5 — Cases entièrement non qualifiées

**4 cases sur 306 possibles (102 compagnies × 3 placements) n'ont aucune valeur `allowed` (ni true ni false, clé absente)** : `airline_air_tahiti_nui:hold`, `airline_la_compagnie:cargo`, `airline_smartwings:cargo`, `airline_transavia:cargo`. Ces 4 cases dépendent entièrement de la règle générique `rule_fallback_policy_*`, avec un motif générique (« No documented X option ») plutôt qu'une donnée vérifiée.

## Lecture d'ensemble

Le correctif du 10/08/2026 (« fiche = socle systématique ») a fermé la faille la plus grave (l'absence totale de filet par défaut). Il reste cependant un écart structurel entre ce que la fiche *peut* documenter (conditions, poids, brachycéphalie, dimensions) et ce que le moteur *sait* lire (aujourd'hui : uniquement le booléen `allowed`). Ce n'est pas un manque de données — 34 à 74 compagnies selon le champ ont déjà l'information dans leur fiche — mais un manque de **réconciliation entre le schéma de données et le code qui l'interprète**. C'est le même diagnostic architectural que celui du dossier `DOSSIER-REFONTE-MOTEUR-10-08-2026.md` déjà transmis, maintenant chiffré précisément sur le SHA de référence.
