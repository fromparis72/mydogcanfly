# Défauts trouvés en construisant le portugais — et corrigés

*31 juillet 2026.*

Traduire un site oblige à relire ligne à ligne ce qu'on croyait acquis. Le portugais a servi
de révélateur : les défauts ci-dessous étaient tous **en ligne**, certains depuis des mois,
et aucun n'aurait été trouvé sans ce passage. Ils sont réparés.

## 1. Cent onze meta-descriptions coupées

**Le plus grave, parce que le plus visible.** Sur 61 fiches pays des 140, la description
affichée par Google finissait par des points de suspension, en pleine phrase :

```
fr  Règles officielles pour faire entrer un chien en République du Congo (Brazzaville) : vaccination…
es  …prueba de titulación de rabia con espera… Con fuentes y fecha.
```

Elles n'avaient pas été raccourcies pour tenir : celle du Congo faisait 97 caractères sur un
budget de 165. Elles ont été **coupées à l'écriture et jamais finies**. Réparties ainsi :
31 en anglais, 33 en français, 47 en espagnol. Zéro en portugais — les fiches traduites
récemment ont été écrites en entier, ce qui a rendu le contraste évident.

Les 111 valeurs ont été réécrites : phrase complète, sous 165 caractères, sans perdre une
seule exigence.

## 2. Sept délais disparus en traduction

Plus insidieux, parce que sans aucune marque : la phrase est grammaticalement complète, mais
un chiffre a sauté.

| Fiche | Langue | Ce qui manquait |
|---|---|---|
| Nouvelle-Zélande | fr, es | quarantaine minimale de **10 jours** |
| Jamaïque | fr, es | quarantaine de **14 jours** |
| Népal | fr, es | certificat sanitaire dans les **10 jours** |
| Cuba | fr, es | visite à domicile à **15 jours** |
| Islande | fr, es | quarantaine obligatoire de **14 jours** |
| Japon | es | attente de **180 jours** et préavis de **40 jours** |
| Taïwan | fr, es | quarantaine minimale de **7 jours** |

Sur un site qui dit à quelqu'un comment préparer un vol, un délai perdu n'est pas une
reformulation : c'est une information fausse.

**C'est le contrôle écrit pour le portugais qui les a trouvés.** Il vérifie que tout chiffre
présent dans la version anglaise se retrouve dans la traduction. Il n'avait jamais tourné sur
le français ni l'espagnol. Il le fait désormais :

```bash
node packages/knowledge/scripts/audit-country-langs.mjs fr es pt
```

Le script sait distinguer une perte d'une localisation : `0.5 IU/ml` et `0,5 UI/ml` sont la
même quantité, « 5:00 p.m. » et « 17 h » aussi, et « une seizaine de races » traduit
correctement « around 16 breeds ».

## 3. Le sélecteur de langue de la page 404

Un visiteur qui tombait sur une page inexistante et cliquait « FR » atterrissait sur
`/fr/404/` — qui n'existe pas non plus. Deuxième erreur pour quelqu'un déjà perdu.

La cause est générale : le sélecteur dérive ses liens du chemin courant, ce qui est juste
partout sauf sur les pages qui n'existent que dans une langue. Le composant accepte
maintenant un `switcherPath` ; la page 404 et la maquette `/lab/roundtrip/` renvoient vers
l'accueil. Cinq des six liens morts du site venaient de là.

## 4. Deux titres français tronqués par Google

`Dogue de Majorque (Ca de Bou) en avion : chaleur et soute restreinte` faisait 68 caractères,
`Dogue des Canaries (Presa Canario)…` 73. Le gabarit avait deux niveaux de repli, insuffisants
pour ces noms composés. Un troisième a été ajouté : il lâche l'emplacement plutôt que le mot
« chaleur », qui est ce que les gens tapent.

## 5. Le site se disait bilingue

La page « À propos » annonçait « English, French » alors que l'espagnol existait depuis
longtemps — la version espagnole de la même ligne disait d'ailleurs « Inglés, francés,
español ». Et le balisage Schema.org du site entier déclarait `inLanguage: ["en", "fr"]`.
Les deux sont désormais dérivés de la liste des langues publiées, donc justes par
construction.

## 6. Deux faux positifs permanents des audits

L'audit signalait à chaque passage un lien mort `/fr/countries/${d}/` depuis la maquette
`/lab/roundtrip/`. Ce n'est pas un lien : c'est un gabarit JavaScript interpolé à l'exécution.
Les deux scripts d'audit ignorent maintenant les `href` contenant `${`.

Le premier jet du nouvel audit multilingue avait lui aussi son faux positif, plus instructif :
il testait « la phrase finit-elle sur un mot-outil ? » et signalait 130 cas, dont
« Passeport européen ». En JavaScript, `\b` est ASCII : entre « é » et « en » il voit une
frontière de mot, donc `\ben$` filait. Le test a été retiré.

## 7. L'espagnol absent de la seconde source de données

Le site lit ses noms et ses notes dans **deux endroits** : les fiches
`content/countries/<code>.yml`, relues à la main et complètes en anglais, français et
espagnol — et `packages/knowledge/raw/objects.json`, tenu à part, enrichi au fil de scripts
ponctuels. Le français y a été rempli au fur et à mesure. **L'espagnol ne l'a jamais été.**

Sur la fiche Allemagne en espagnol, « Alemania » apparaissait cinquante fois et « Germany »
trois fois : le corps de la page vient du YAML, les liens de contexte passent par `labelOf()`,
qui lit la seconde source. Un lecteur hispanophone tombait donc sur des noms anglais au
milieu d'un texte espagnol, en ligne, depuis le début.

| Champ | français | espagnol | effet visible |
|---|---|---|---|
| `countries.name` | 140 | **0** | « Germany » dans les liens et le méga-menu |
| `airports.city_i18n` | 66 | **0** | « London », « Frankfurt » là où le français dit « Londres » |
| `airports.note` | 119 | 76 | 28 notes de zones de détente en anglais |
| `airlines.alt` | 10 | **0** | textes alternatifs d'images |

La règle appliquée : **là où le français a une traduction, l'espagnol doit en avoir une.**

Les noms de pays n'ont pas été retraduits mais **recopiés des fiches YAML**, qui font
autorité — recopier plutôt que retraduire évite qu'un même pays s'appelle autrement selon
l'endroit du site où on le rencontre. Les villes et les notes ont été traduites, en espagnol
et en portugais, à partir de l'anglais et du français existants.

```
node packages/knowledge/scripts/fill-objects-i18n.mjs
→ noms de pays : 280 · villes : 132 · prose : 190
```

Mesure avant/après, sur le texte réellement affiché :

```
notes de zones de détente rendues en anglais
  espagnol  28 → 0        portugais  81 → 0        français  0 (témoin)
```

## 7 bis. Les noms d'aéroports — un « choix uniforme » qui n'en était pas un

Premier jugement, écrit ici même : les noms d'aéroports sont en anglais dans les quatre
langues, donc c'est un choix cohérent, pas une lacune espagnole. **C'était faux**, et il a
suffi de regarder une page entière plutôt qu'un champ pour le voir :

```
/es/airports/lhr/
  fil d'Ariane   Londres (LHR)
  badge          🇬🇧 Londres · Reino Unido · LHR
  prose          El aeropuerto de Londres cuenta con…
  titre H1       Zonas de alivio para mascotas en London Heathrow (LHR)
```

Trois fois « Londres », une fois « London Heathrow », sur la même page. Le moteur de
recherche interne disait déjà « LHR · Londres · Reino Unido » — c'est le titre qui était
seul à contre-courant. 251 pages par langue étaient concernées.

**La cause tenait en deux lignes.** `labelOf()` écrivait `${a.iata} · ${a.name.en}`, en dur ;
six autres endroits de `pagedata.ts` faisaient pareil. Et surtout, **66 aéroports sur 249
seulement avaient une ville localisée** : les 183 autres affichaient la ville anglaise
partout, dans les quatre langues.

Trois corrections :

1. **Toutes les villes sont localisées** — 244 entrées, en français, espagnol et portugais.
   Le français en manquait autant que les autres : « Cologne », « Milan », « Naples » y
   étaient écrits à l'anglaise.
2. **Les 249 noms d'aéroports sont traduits** selon une règle constante : *la ville suit la
   langue, le nom propre ne bouge jamais, le descriptif se traduit et se postpose*. Ce qui
   donne `London Heathrow` → `Londres-Heathrow`, `Keflavík International Airport` →
   `aeropuerto internacional de Keflavík`, et `Charles de Gaulle` inchangé. Garder le nom
   propre était le point important : c'est ce que les gens tapent dans Google.
3. **Un lecteur unique**, `airportName(a, locale)`, à côté de `cityName` et `breedName`.
   Les sept `a.name.en` en dur passent par lui.

Les tables vivent dans `content/objects-i18n/villes.json` et `aeroports.json` — des données,
plus du code.

**Un piège au passage.** `LocalizedText` exige la clé `en`, qui sert de repli. Créer 183
`city_i18n` sans elle a fait échouer l'ingestion sur un « Required » qui ne disait ni quel
objet ni quel champ. Le script pose désormais `en` d'abord.

Contrôle : **0 page anglaise modifiée sur 668**, aucun titre au-delà de 65 caractères dans
aucune des quatre langues, et plus un seul nom d'aéroport anglais affiché là où une
traduction existe.

## 8. Un composant mort qui faussait le diagnostic

En mesurant le trou espagnol, 335 valeurs sont apparues sans traduction : les `label` des
contacts d'aéroport, et les `summary`, `conditions`, `text`, `event`, `q`, `a` des
compagnies. Avant de lancer une traduction, vérification : **aucune de ces 335 valeurs
n'apparaît dans le site construit, en anglais non plus.** Elles étaient lues par
`packages/ui/src/components/EntityPage.astro`, un composant que plus aucune page n'appelle.

Les traduire aurait été traduire du code mort. Le script les compte et les laisse ; le
composant reste à supprimer, ce qui est un autre chantier.

## Résultat

```
node packages/knowledge/scripts/audit-site.mjs      →  ✅ Aucune anomalie.
node packages/knowledge/scripts/audit-coherence.mjs →  0 lien mort, 0 ancre absente, 0 titre dupliqué
```

C'est la première fois que l'audit SEO sort vierge.

Restent deux constats connus et assumés, qui ne sont pas des défauts : 422 écarts d'ordre des
sections entre fiches pays (le gabarit tolère des variantes éditoriales), et 447 « fuites de
langue » qui sont le sélecteur de langue et les fichiers du dossier de presse, communs aux
quatre langues.
