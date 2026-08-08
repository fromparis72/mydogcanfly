# Point de reprise — 8 août 2026, fin de journée

**Lis ce fichier en premier.** Les documents `A-REPRENDRE-FINDER.md`,
`A-REPRENDRE-FINDER-2.md` et `A-CORRIGER-FICHES-COMPAGNIES.md` décrivent des défauts dont **une
grande partie est désormais corrigée**. Ils restent utiles pour le raisonnement et les sources,
mais ils ne disent plus l'état du code. Ce fichier-ci fait foi.

---

## FAIT, COMMITÉ ET DÉPLOYÉ le 8 août

- **14 nouvelles compagnies** (Aerolíneas Argentinas, Royal Jordanian, Luxair, TAROM, Asiana,
  Air Astana, La Compagnie, Air Austral, Bangkok Airways, South African, Kenya Airways, Gulf Air,
  Aircalin, TUI Airways). Hawaiian et Batik Air écartées, motifs dans `ETUDE-16-COMPAGNIES.md`.
- **Incident d'indexation résolu** : le site servait `Disallow: /` et `noindex` partout, faute de
  `PUBLIC_SITE_ENV=production`. Trois garde-fous posés : `npm run release`, le script
  `verifier-indexation.mjs`, et une tâche planifiée qui contrôle le site en ligne chaque matin à 8 h.
- **27 règles d'entrée UE dédoublées selon l'origine** + 27 règles « retour avec passeport UE ».
  Question dans le Finder : « Ton chien vit-il habituellement dans l'Union européenne ? »
  (2 options ; sans réponse → les deux parcours). La fiche de voyage la reçoit par le lecteur de
  paramètres en dièse.
- **Motif de refus** : lu sur la règle qui a refusé (`deny_reasons`), plus jamais déduit.
  « Race non acceptée » ne s'affiche que si la race est réellement en cause.
- **Correspondances** : champ `itinerary_confidence`. Une correspondance étayée par `direct_routes`
  est préférée ; les autres sont dégradées avec « Itinéraire à confirmer ». Aer Lingus Paris → JFK
  passe par Dublin (attesté) au lieu de Cork (déduit).
- **4 fiches compagnies corrigées** (Aegean, Air Transat, Volotea, Air France) + un défaut de
  gabarit qui faisait afficher notre taxonomie brachycéphale comme celle de la compagnie sur
  **37 fiches**.
- **Cap-Vert** : 4 aéroports ajoutés (SID, RAI, BVC, VXE), sourcés sur l'AIP officiel. Une porte
  qualité signale désormais les pays déclarés desservis sans aucun aéroport.
- **Images de marque en WebP** : 461 Ko → 105 Ko.

---

## LE PROCHAIN CHANTIER — l'intégration de la collecte élargie

Le fichier est **déjà dans le dépôt** : `packages/knowledge/raw/collecte-2026-07/`
(`routes_FULL_strict.json` + `NOTE_COLLECTE_ELARGIE.md`).

**Ce qu'il contient** : 101 compagnies, 14 141 arêtes directes, 7 116 saisonnières, au format
`airport_xxx|airport_yyy` déjà utilisé par le dépôt, clés par code IATA.

**Mesuré le 8 août** : 91 des 101 compagnies sont reconnues par leur code IATA ;
**6 563 arêtes sont utilisables immédiatement** (leurs deux aéroports existent au référentiel),
contre 6 349 arêtes aujourd'hui — soit un doublement du graphe **sans ajouter un seul aéroport**.
6 864 arêtes attendent que le référentiel s'élargisse. Dix codes n'ont pas de fiche :
BT GQ ID JU NO OD OU PC WK XQ.

**Trois précautions, non négociables :**
1. **C'est un agrégateur, pas une source officielle.** Ces arêtes sont des candidats. Le champ
   `itinerary_confidence` existe précisément pour les distinguer d'une donnée vérifiée.
2. **Isoler Alaska (AS).** Depuis le rachat, la source fond Hawaiian dans Alaska : les routes AS
   incluent des liaisons qui étaient hawaïennes. Ingérer AS tel quel ferait dire à Alaska qu'elle
   opère des routes qu'elle n'opérait pas sous ce nom.
3. **Ne pas écraser l'existant sans comparer.** Les 6 349 arêtes actuelles ont leur histoire ;
   fusionner, pas remplacer.

**Bénéfice attendu** : les correspondances aujourd'hui « à confirmer » deviennent étayées, et
plusieurs des 14 pays sans aéroport trouvent leur réponse (Almaty, Cambodge, bases TUI…).

---

## APRÈS, PAR ORDRE D'INTÉRÊT

1. **Les 14 pays sans aéroport.** La porte qualité les nomme ; lance-la pour la liste à jour.
   Pour chacun, la première question n'est pas « quel aéroport ajouter » mais **lequel des deux
   côtés est faux** — l'aéroport manque, ou `serves_country_ids` est trop généreux.
2. **Le score de compatibilité** (`A-REPRENDRE-FINDER-2.md` §6) : le 85 % semble être un score
   global du voyage affiché trop près du bloc compagnie. Vérifier ce que le moteur calcule avant
   de trancher entre renommer et recalculer.
3. **Le compteur britannique** (§7) : « vols directs probables » compte des liaisons passagers,
   alors qu'un animal n'entre au Royaume-Uni qu'en fret sur routes approuvées.
4. **`npm run check` échoue** sur « coverage: airlines have at least one rule » — les 14 nouvelles
   compagnies n'ont pas de règle dans `rules.json`, par choix (leur politique est dérivée des
   fiches). À arbitrer : sourcer 14 règles, ou ajuster le contrôle.
5. **Suisse, Norvège, Liechtenstein** portent le même défaut d'origine que les 27 pays de l'UE.
   Corriger demande de sourcer l'OSAV et le Mattilsynet, pas la Commission.

---

## RÈGLES DE TRAVAIL À NE PAS REDÉCOUVRIR

- **Aucune affirmation sans source officielle.** Un champ non sourçable reste vide ou dit
  « non publié ». Jamais de comblement.
- **Une compagnie fait foi sur sa politique, jamais sur le droit d'un État.**
- **Le site et le Worker se déploient séparément.** `npm run release` à la racine publie le site ;
  `npx wrangler deploy --env production` depuis `packages/workers` publie le moteur. Le Finder est
  calculé par le Worker : sans lui, aucune correction de règle n'est visible.
- **Une correction n'est pas terminée parce qu'elle est dans le code local.** Vérifier dans le
  Finder, dans la fiche détaillée, dans les quatre langues, et en ligne.
- **Astro vide son dossier de sortie à chaque passe.** Jamais deux shards dans le même OUTDIR,
  jamais un build partiel dans `packages/ui/dist`.
- Quatre langues à chaque texte visible (en, fr, es, pt-BR). Français au tutoiement.
- Les scripts vont dans `packages/knowledge/scripts/`, idempotents, avec `--dry`, et un en-tête
  qui explique le POURQUOI et les pièges — pas la syntaxe.

---

## POUR DÉMARRER LA PROCHAINE FENÊTRE

> Lis `REPRISE.md` à la racine du dépôt. On attaque l'intégration de la collecte élargie :
> les 6 563 arêtes utilisables de `packages/knowledge/raw/collecte-2026-07/routes_FULL_strict.json`.
