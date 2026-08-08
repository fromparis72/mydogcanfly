# Finder — défauts constatés le 8 août 2026

**Mise à jour du 8 août, après relecture critique.** Ce document mélangeait des défauts constatés,
des corrections déjà écrites, et quelques conclusions plus catégoriques que les preuves. Il est
ici corrigé pour servir de feuille d'exécution.

> **Consigne permanente.** Ne jamais considérer une correction comme terminée parce qu'elle
> existe dans le code local. Il faut vérifier le comportement **dans le Finder**, **dans la fiche
> détaillée**, **dans les quatre langues**, et **dans la version réellement déployée**. Le site
> (Cloudflare Pages) et le Worker (`packages/workers`) se déploient **séparément** :
> `npm run release` ne publie pas le moteur.

---

## 1. Passeport UE au retour — **codé, non validé, non déployé**

Le défaut était réel : le site imposait un certificat sanitaire USDA à un chien européen rentrant
chez lui, alors qu'un passeport UE valide suffit si la vaccination antirabique — **et le titrage
le cas échéant** — étaient valides avant le départ de l'UE. La dispense vaut pour un **séjour**,
pas pour un déménagement : un propriétaire qui réside désormais hors UE repasse par le certificat.
Source : DG SANTÉ, « Bringing a pet into the EU from a non-EU country » › Exceptions.

**Ce qui existe aujourd'hui dans le worktree, non commité :**

- la question « Ton chien a-t-il un passeport européen… ? » (Oui / Non / Je ne sais pas) dans
  `FlightFinder.astro`, affichée seulement si destination UE **et** origine hors UE ;
- le fait `docs.eu_passport` (moteur) et le champ `eu_passport` (contrat) ;
- 27 règles `rule_<iso>_import_returning_eu` (parcours passeport) et les 27
  `rule_<iso>_import_non_eu` conditionnées au document détenu ;
- la transmission de `eu_passport` au lien vers les modalités détaillées ;
- le traitement des trois états dans `fiche.astro` : oui → passeport · non → certificat ·
  inconnu **ou absent** → les deux parcours.

**Reste à faire : tester, valider, déployer.** À contrôler — les trois parcours, les quatre
langues, les liens partageables (le paramètre survit-il au copier-coller de l'URL ?), et le
comportement une fois le **Worker déployé**.

**Un arbitrage ouvert :** la question n'est posée que sur un vol **entrant** dans l'UE. Sur un
Paris → New York saisi à l'aller, le paramètre reste absent et la fiche affiche les deux parcours
au retour. C'est prudent, mais il faut décider si la question doit aussi être posée dans ce sens.

---

## 2. Correspondances non démontrées — **chantier ouvert, prioritaire**

**Constat.** PGF Perpignan → JFK New York renvoie Aer Lingus « via ORK ».

**Formulation rigoureuse.** Le moteur vérifie qu'une compagnie dessert un aéroport d'origine et un
aéroport de destination, mais **n'apporte aucune preuve qu'un itinéraire continu existe entre les
deux**. Il peut donc fabriquer une correspondance théorique par un hub. Je n'affirme pas que
PGF → ORK n'existe pas : j'affirme que rien dans les données ne l'établit.

S'y ajoute une contrainte documentée : Aer Lingus réserve les animaux via **IAG Cargo**, et les
vols opérés par **Aer Lingus Regional n'acceptent aucun animal**.
https://www.aerlingus.com/localized/fr/modals/baggage-information.html

**Correction durable** : n'afficher une correspondance que si chaque segment est identifié, opéré
et compatible avec l'animal — ce qui suppose des segments vérifiés en données.
**En attendant** : masquer les correspondances non documentées, ou les dégrader en
« Compagnie potentiellement pertinente — itinéraire et acceptation à confirmer ».

---

## 3. « Race non acceptée » — **chantier ouvert, en deux temps**

**Constat.** Paris → JFK, Golden Retriever 30 kg : Delta, JetBlue et Brussels Airlines classés
« Breed not accepted ». Le libellé est **factuellement trompeur** : il fait croire à une
interdiction de race alors que le refus peut venir du poids, de la soute fermée ou du fret
indisponible.

Origine probable, à confirmer : `packages/engine/src/contracts.ts` documente `carries_pets` par
« *true but no mode = breed not accepted* » — une déduction, pas un fait.

**Temps 1, immédiat** : remplacer le libellé par un texte neutre, du type
« Non compatible avec ce chien ou cet itinéraire ».
**Temps 2, structurel** : faire produire au moteur des motifs explicites — `breed_restricted`,
`weight_limit`, `hold_unavailable`, `cargo_unavailable`, `route_unavailable` — puis afficher le
motif réel. Distinguer cinq motifs suppose que le moteur les retourne ; ce n'est pas le cas
aujourd'hui.

---

## 4. Tarif affiché sur un scénario fret — anomalie confirmée, provenance à auditer

`40–160 €` s'affiche pour un acheminement PGF → JFK annoncé en fret, alors qu'un envoi via IAG
Cargo se fait **sur devis**.

Je ne peux pas affirmer d'où vient ce montant — je ne l'ai pas tracé dans les données. À auditer.

**Règle à poser** : en mode fret, n'afficher qu'un tarif explicitement documenté **pour le fret**,
sinon « sur devis auprès de <transitaire> ».

---

## 5. « Fret uniquement » contredit par « voyage en soute » — confirmé

PGF → JFK : verdict « cargo only », puis recommandation « Hold travel requires an IATA-compliant
crate ». Ni le même produit, ni la même procédure, ni le même interlocuteur.

Les recommandations doivent suivre le mode réellement retenu : en fret, parler réservation auprès
du transitaire, terminal fret, devis, horaires de dépôt et de retrait.

---

## 6. Le score de compatibilité — diagnostic reformulé

`85 %` apparaît identique d'une compagnie à l'autre. L'explication la plus probable n'est pas un
score par compagnie mal calculé, mais **un score global du voyage affiché à proximité du bloc
compagnie**, ce qui laisse croire qu'il mesure la compatibilité avec cette compagnie.

Deux issues possibles : le renommer « Compatibilité réglementaire du voyage » et l'éloigner du
bloc compagnie ; ou calculer un véritable score **compagnie + itinéraire + chien**.
À trancher après vérification de ce que le moteur calcule réellement.

---

## 7. Royaume-Uni : « vols directs probables » — confirmé

Paris → Londres, Bouledogue français : verdict négatif correct, mais « 5 likely direct flights »
compte des liaisons **passagers**. Or un animal arrivant par avion en Grande-Bretagne doit voyager
en fret, sur une compagnie et une route approuvées.
https://www.gov.uk/bring-pet-to-great-britain/travel-routes-pets
https://www.gov.uk/government/publications/pet-travel-approved-air-sea-and-rail-carriers-and-routes

Le compteur doit ne retenir que les options réellement praticables avec un chien.

---

## 8. Formulations à revoir sur la fiche Air France

- « The basics … both ways » impose vaccin antirabique et délai de 21 jours dans les deux sens :
  c'est une exigence **de retour vers l'UE**, pas d'entrée aux États-Unis depuis un pays à faible
  risque.
- Le fret est annoncé disponible, mais seules des instructions de **soute accompagnée** sont
  données.
- `100–600 €` : on ignore ce qui relève de la soute, du fret, de l'aller ou du retour.

---

## Ordre d'exécution

1. **Valider et déployer** le parcours passeport UE déjà codé (§1) — puis commiter, rien n'est
   encore sauvegardé.
2. **Libellé neutre** à la place de « race non acceptée » (§3, temps 1) — rapide, met fin à une
   affirmation trompeuse sur trois compagnies.
3. **Masquer ou dégrader** les correspondances non démontrées (§2).
4. **Cargo / soute** et tarifs fret (§5 et §4).
5. **Clarifier la nature du score** (§6).
6. **Compteur britannique** (§7).
7. **Nettoyer** les formulations de la fiche Air France (§8).
