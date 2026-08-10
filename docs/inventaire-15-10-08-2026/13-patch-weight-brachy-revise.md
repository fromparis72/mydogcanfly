# §15 — Découpage révisé du patch `weight-brachy-conditions-10-08.patch` (suite à la contre-revue Codex du 10/08/2026)

**Recommandation : ne pas appliquer ce patch tel quel, malgré l'approbation initiale du 10/08 avant le pivot stratégique. Le scinder en 3 lots indépendants, chacun avec ses propres tests avant/après. Aucun des 3 sous-lots n'est encore livré sous forme de patch — ce document propose le découpage, à valider avant que je les prépare.**

## Pourquoi ne pas l'appliquer tel quel

Codex a testé le patch dans un worktree temporaire : il s'applique proprement et passe `npm run check`. Le défaut n'est pas dans la mécanique du patch, il est dans la conception de son troisième volet (l'exception Qantas) — voir sous-lot 3 ci-dessous. Les deux premiers volets (poids cabine, règles route-scopées) n'ont, eux, reçu aucune critique de fond de la contre-revue.

## Sous-lot 1 — Limites de poids en cabine (18 compagnies)

Contenu inchangé par rapport au patch original : `rule_aerolineas_argentinas_cabin_weight`, `rule_air_astana_cabin_weight`, … jusqu'à `rule_virgin_australia_cabin_weight` (liste complète dans le dossier de refonte déjà livré). Chaque règle suit le patron déjà établi (`rule_aa_cabin_weight`), sourcée individuellement.
**Aucune objection de la contre-revue sur ce volet.** Peut être re-livré tel quel dès validation par Philippe.

## Sous-lot 2 — Règles route-scopées Pegasus et South African Airways

`rule_south_african_airways_hold_domestic_only`, `rule_pegasus_hold_domestic_only` — contenu inchangé, y compris la correction déjà documentée dans l'historique de la règle Pegasus (l'hypothèse initiale « domestique + Chypre du Nord » corrigée en « Turquie domestique seule » après vérification directe de la source officielle).
**Aucune objection de la contre-revue sur ce volet.**

## Sous-lot 3 — Exception Qantas, à réécrire (ne pas reprendre telle quelle)

### Défaut identifié par Codex, vérifié dans le raisonnement
Le patch original exclut Qantas de `rule_global_brachy_hold` via un `not` dans `applies_when`, avec un `rationale`/`rationale_i18n` mis à jour sur cette même règle pour expliquer l'exception (contrôle BOAS, réservation spécialiste). **Problème** : une fois l'exclusion appliquée, `rule_global_brachy_hold` ne se déclenche plus du tout pour ce cas précis (Qantas + race brachycéphale matchée + cargo) — donc son `rationale`, aussi bien rédigé soit-il, ne remonte jamais dans le rapport envoyé au visiteur. Le résultat net testé par Codex pour un Carlin sur Qantas : `cargo:true`, sans aucune mention de la condition BOAS, de l'obligation de réservation via un spécialiste, ni de la source Qantas Freight — l'exception devient un `allow` silencieux, pas mieux informé que le bug qu'elle corrige.

### Conception cible proposée
Remplacer l'exclusion silencieuse par une règle positive dédiée, qui **se déclenche** pour ce cas précis et porte elle-même l'explication :
- Scope : `airline` (`airline_qantas`), catégorie `placement` ou une nouvelle catégorie dédiée aux conditions de transport spécialisé.
- `applies_when` : `placement == "cargo"` ET `airline.id == "airline_qantas"` ET `dog.breed_id` dans la liste des 16 races effectivement présentes au catalogue (déjà identifiées et vérifiées dans le travail du 10/08).
- `effect` : `require` (pas `allow` ni `deny`) — le placement reste autorisé mais une condition explicite est attachée et doit apparaître dans le rapport, au même titre que les autres `require` du site (ex. certificat sanitaire, microchip).
- `rationale`/`rationale_i18n` : contrôle BOAS obligatoire, réservation via un spécialiste agréé, fret uniquement (pas d'accompagnement passager sur le même vol garanti) — sourcé sur `https://freight.qantas.com/au-en/pets/brachycephalic-breeds.html` et `.../pet-travel-faqs.html`, déjà vérifiées le 10/08.
- La modification de `rule_global_brachy_hold` (l'exclusion `not`) reste nécessaire pour que l'interdiction générale ne bloque pas ce cas — mais elle doit désormais coexister avec cette nouvelle règle `require`, qui porte seule l'explication.

### Ce qu'il reste à faire avant de livrer ce sous-lot
1. Valider ce choix de conception (`require` dédié plutôt que rationale sur une règle exclue) avec Philippe — c'est un choix d'architecture de règles, pas une simple correction de texte.
2. Vérifier que le schéma `RuleEffect`/`Rule` (`packages/knowledge/src/rules.ts`) accepte bien un `require` scoping ainsi sans changement de schéma (a priori oui, `action: "require"` existe déjà dans l'enum).
3. Écrire un test avant/après spécifique (Carlin, Qantas, cargo) qui vérifie que le rapport contient bien la mention BOAS/spécialiste après le correctif — pas seulement que `cargo` reste `true`.

## Recommandation d'ordre

Sous-lots 1 et 2 peuvent être re-proposés en patch dès validation par Philippe, indépendamment du sous-lot 3 qui nécessite une réécriture. Aucun des trois n'est appliqué tant que Philippe n'a pas confirmé — reprise de la méthode habituelle : mesurer, montrer, décider ensemble avant de corriger.
