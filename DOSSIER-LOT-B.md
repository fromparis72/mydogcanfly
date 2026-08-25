# Lot B — Veille de fraîcheur des sources · dossier de conception et de mesure (v3, socle)

**Conçu AVANT le code, contre-revu en trois rondes (v1 → v3), implémenté sur le `main`
d'après-lot-A.** Le système OBSERVE et RAPPORTE ; il ne modifie jamais une donnée, un
verdict, ni une référence — toute correction est une PR humaine.

Reproduction :

```bash
node --import tsx fraicheur/sceller-registre.mjs                        # scellé ≡ registre (câblé en CI de PR, quelques secondes)
node --import tsx fraicheur/controler-fraicheur.mjs --date=AAAA-MM-JJ   # le run (réseau réel)
node --import tsx test-fraicheur-lot-b.mjs                              # 16 cas au faux curl (câblé en CI de PR, ~2 min 30)
```

## 0. Mesure fondatrice — recalculée depuis `main` après fusion du lot A

Mesurée sur `497de3a8a571facf285f5757f43a46a2e1c5eb03` (merge de la PR #23) :

- **1 507 sources canoniques** (familles d'`objects.json` + `rules.json` — les 1 505 du
  dossier d'achèvement + les deux projections du lot A, Fidji et Oman) ;
- **+ 1** : la source datée de `breed-restrictions.json`, intégrée au registre par
  **extension explicite** (arbitrage de contre-revue : elle influe sur les réponses
  publiques concernant les races) — périmètre du lot B : **1 508 sources** ;
- **777 URL uniques**, 731 réutilisations (une URL sert jusqu'à 88 locators) : le contrôle
  réseau porte sur les URL, jamais sur 1 508 occurrences ;
- échéancier des `review_due` : **2026-09 : 122** (première vague — 44 pays · 78 règles) ·
  **2026-10 : 407** (la plus grosse vague de 2026 — 330 compagnies · 77 règles) ·
  2026-11 : 173 · 2026-12 : 44 · 2027-01 : 159 · 2027-02 : 71 · 2027-07 : 532.

## 1. Le registre EXACT (`fraicheur/registre-fraicheur.mjs`)

Chaque entrée = **famille + locator + objet `Source` canonique complet** (validé par le
schéma canonique importé, jamais un second validateur partiel) ; tri déterministe ;
**empreintes du registre exact** (globale et par famille) ; **comparaison symétrique**
nommant toute entrée ajoutée, supprimée ou modifiée au locator — le faux vert historique
(une URL remplacée sans déplacer aucun agrégat) est mort (contre-épreuve 14). Échec bruyant :
registre vide, source rejetée par le schéma, identité instable — chacun nommé.

**Le registre est SCELLÉ dans le système qui tourne** (contre-revue du socle : un registre
exact que le run ne confronte à rien ne protège rien). `fraicheur/registre-scelle.json`
(versionné) porte les triplets triés (famille, locator, empreinte de la Source canonique) et
les empreintes ; toute PR qui change une source **rescelle dans la même PR**
(`sceller-registre.mjs --ecrire` — le diff du scellé rend le changement visible et revu) ;
la **CI de PR** vérifie l'égalité (pas dédié, sans réseau, quelques secondes) et le
**contrôleur hebdomadaire** la vérifie aussi avant tout run — un `main` hors de son scellé
est une panne STRUCTURELLE, sortie 2, rien d'interprétable (contre-épreuves 15-16 : scellé
absent → refus ; URL remplacée sans rescellement → nommée au locator par la CI ET refusée
par le run ; rescellée → vert). À la différence du scellé du lot A (instantané figé d'un
départ), celui-ci est FAIT pour être rescellé à chaque évolution légitime — le motif du
scellé de curation.

L'identité RÉSEAU (`SHA256(url)`) est distincte de l'identité des sources par locator :
elle sert au dédoublonnage (une URL, un téléchargement par run, résultat distribué à tous
ses locators — contre-épreuve 8) et à la rotation, jamais à identifier une source.

**Limite écrite et testée (P1-2, acceptée pour le socle)** : une URL déplacée n'est pas une
migration — l'entrée est nommée « modifiée » par la comparaison symétrique, et la nouvelle
URL est `sans_reference` au run suivant (contre-épreuve 11). Pas d'identifiants explicites
dans ce lot.

## 2. Les deux AXES, jamais fusionnés (P0-2)

```
echeance : a_jour | bientot_a_revoir (≤ 45 jours) | echue      — TOUTES les sources, chaque run
controle : non_controlee | sans_reference | inchangee
         | potentiellement_modifiee | inaccessible             — les seules URL consultées
```

Toute combinaison est représentable ; une source hors tranche reste `non_controlee`, jamais
implicitement accessible ni inchangée (contre-épreuve 2). Une inaccessible n'est JAMAIS
« inchangée ». Une comparaison d'empreintes dit « potentiellement modifié », jamais « règle
devenue fausse » (contre-épreuve 13).

## 3. La référence FIGÉE naît d'une décision humaine (P0-3, P0-4)

`fraicheur/references.json` — versionné, schéma strict (URL exacte, empreinte du corps,
URL finale, statut, Content-Type, taille, date de capture, version du contrôleur), modifié
**uniquement par PR humaine** : l'historique Git de ce fichier EST l'historique durable.
Sans référence, un contrôle abouti est `sans_reference` — la première exécution ne consacre
RIEN (contre-épreuve 3), et le rapport dit explicitement l'absence d'historique. Le
contrôleur n'écrit jamais dans le dépôt (garde de sortie + contre-épreuve 5) ; le rapport
hebdomadaire vit en artefact GitHub Actions et dans le résumé du job.

## 4. La rotation SANS ÉTAT, et un écart argumenté

Sélection d'un run = URL urgentes (une entrée `echue` ou `bientot_a_revoir`) ∪ tranche
tournante `SHA256(url) mod 8`. **Écart argumenté vis-à-vis de la prescription « numéro de
semaine [ISO] modulo 8 »** : au passage d'année ISO (semaine 53 → 1), trois tranches sautent
leur tour et la couverture s'étire jusqu'à ~13 semaines. La **semaine CONTINUE** (depuis le
lundi 05/01/1970) est tout aussi déterministe et sans état, et garantit la borne de
**56 jours toute l'année** — contre-épreuve 10 : sur 8 semaines consécutives, les 8 tranches
passent et aucune des 777 URL ne reste hors sélection. Aucune dépendance à un curseur ni à
un artefact antérieur ; en v1 un échec d'accès est rapporté immédiatement `inaccessible`,
sans promesse d'escalade multi-runs.

## 5. Le coupe-circuit (P1-4)

Module réseau générique (`fraicheur/reseau-fraicheur.mjs`) — PAS le collecteur du lot A,
mais ses sécurités : HTTP(S) épinglé, borne d'octets partagée (25 MiB), rien de persisté
(corps et en-têtes réduits à leurs métadonnées puis détruits — aucun cookie ne peut
atteindre un artefact, contre-épreuve 12), signatures de proxy, sonde environnementale.
Sonde rouge, signature d'egress en cours de run, ou zéro URL joignable → **sortie 2, aucun
rapport, AUCUNE source déclarée inaccessible** (contre-épreuve 9) — une panne de GitHub
Actions ne fabrique jamais 300 inaccessibles. (Démonstration involontaire en conditions
réelles : lancé depuis l'environnement distant derrière son proxy, le contrôleur refuse —
« environnement INAPTE », rien de produit.)

## 6. La file de travail, priorisée par impact utilisateur

Classes possédées par le code : **A** verdict/modalité (règles du moteur, restrictions de
race) · **B** compagnies · **C** pays · **D** documentaire (aéroports, races, partenaires).
La file (JSON exploitable + Markdown lisible) trie par impact puis par échéance — jamais une
documentaire devant une règle échue (contre-épreuve 6). Les échues sont TOUTES en file, et
la sortie reste 0 : **une échéance naturelle ne rougit ni ce workflow, ni la CI principale**
(workflow séparé `.github/workflows/fraicheur.yml`, hebdomadaire, permissions lecture seule,
actions épinglées mesurées au manifeste — `upload-artifact` v6.0.0 mesuré le 25/08/2026 par
la méthode documentée).

## 7. Contre-épreuves — `test-fraicheur-lot-b.mjs` (16 cas au faux curl, câblés en CI de PR ; ~2 min 30 mesurées — le faux réseau lance un sous-processus par URL)

| # | cas | attendu |
|---|---|---|
| 1 | registre VIDE | sortie 2, « AUCUNE source vivante », aucun rapport |
| 2 | échec ciblé sur une échue | la source porte LES DEUX axes (échue + inaccessible) ; hors tranche = non_controlee |
| 3 | premier run, références vides | aucune « inchangee » — tout est sans_reference, le Markdown le dit |
| 4 | échéances passées | TOUTES en file, sortie 0 — une échéance n'est pas une panne |
| 5 | run nominal + sorties interdites | données identiques à l'octet près ; sortie dans le dépôt refusée avant tout |
| 6 | file mixte A/D | tri par impact puis échéance, jamais inversé |
| 7 | rapport + références difformes | schéma du rapport tenu ; references.json illisible → sortie 2 |
| 8 | URL à 88 locators | UN téléchargement, 88 lignes de file |
| 9 | sonde rouge · zéro joignable · egress | sortie 2 × 3, aucun rapport, aucune « inaccessible » fabriquée |
| 10 | 8 semaines consécutives simulées | les 8 tranches passent, aucune URL jamais sélectionnée |
| 11 | URL déplacée | nommée « modifiée » ; nouvelle URL sans_reference ; l'ancienne identité ne subsiste pas |
| 12 | Set-Cookie SECRET dans chaque réponse | absent de TOUS les artefacts |
| 13 | référence figée | corps identique → inchangee ; altéré → potentiellement_modifiee ; aucun verdict |
| 14 | URL remplacée à agrégats constants | empreintes globale ET famille changent ; nommée au locator |
| 15 | scellé du registre ABSENT | sortie 2, aucun rapport — rien ne se surveille sans contrat |
| 16 | source changée SANS rescellement | nommée au locator par la vérification de CI, refusée par le run hebdomadaire, verte une fois rescellée |

## 8. Interdits, et ce qui reste hors du socle

- **Interdit : toute mutation automatique** — donnée, verdict, référence ; une correction
  est une PR humaine, préparée depuis la file de travail.
- **Interdit : analyser le DOM** des administrations — l'empreinte dit « potentiellement
  modifié », l'humain juge.
- **Interdit : rougir la CI principale** sur une échéance naturelle.
- **Hors socle, à arbitrer plus tard** : escalade multi-runs des inaccessibles (exige un
  historique de rapports qui n'existe pas encore) ; identifiants longitudinaux explicites ;
  et la PREMIÈRE promotion de références (une PR humaine dédiée, depuis le rapport JSON du
  premier run réel — les champs nécessaires y figurent).
