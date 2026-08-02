# Rapport de cohérence — maillage, liens, ordre de l'information

Audit du 29 juillet 2026, sur le build complet de 1 986 pages (état 10 h 42).
Outillage : `audit-site.mjs` (SEO technique) + `audit-coherence.mjs` (nouveau — graphe de
liens, ancres, langues, ordre des sections), plus des contrôles ciblés sur les données YAML.

---

## Ce qui est propre — vérifié, pas supposé

Avant les défauts, le périmètre sain, car il est large :

| Contrôle | Résultat sur 1 986 pages |
|---|---|
| Liens morts sur pages **indexables** | **0** |
| Liens **construits en JavaScript** | **non vérifié — angle mort, voir §« Correction »** |
| Ancres cassées (`#flight-finder`, etc.), locales et distantes | **0** |
| Query string placée après le fragment (paramètre perdu) | **0** |
| Fuites de langue (page FR pointant vers une page EN) | **0** hors pages lab |
| Pages indexables orphelines (aucun lien entrant) | **0** |
| Titres dupliqués entre pages indexables | **0** |
| Ordre des sections au sein d'une famille (pays, compagnies, races) | **strictement identique** — aucune paire de sections inversée |
| Breadcrumbs localisés, sitemap, audit SEO technique | conformes |

Les 6 liens morts restants sont confinés à `/404/` et `/lab/roundtrip/`, toutes deux
noindex — invisibles de Google, à nettoyer sans urgence.

---

## Correction du 29/07 — une panne que cet audit n'avait pas vue

**Le tableau ci-dessus annonçait « 0 lien mort ». C'était faux.**

Mon analyseur ne lisait que les `<a href>` du HTML servi. Or la Bible (`/tools/fiche/`)
construit son DOM en JavaScript à partir d'un îlot JSON embarqué : aucun de ses liens
n'existe dans le HTML, donc aucun n'était vérifié.

Le lien « Fiche pays » pointait vers `/countries/greece/` alors que les fiches sont routées
sur l'ISO2, `/countries/gr/`. **140 pays × 3 langues, soit 420 liens morts**, sur le
parcours le plus abouti du site — celui où le visiteur arrive après avoir fait une
recherche. Signalé par Philippe, pas par l'audit.

Cause : `slug: g.seo?.slug ?? iso`. Le champ `seo.slug` contient le nom anglais complet
(« greece », « united-arab-emirates ») et n'est utilisé nulle part comme URL ; le repli
`?? iso` ne se déclenchait donc jamais. Corrigé en `slug: iso`.

**L'outil a été corrigé aussi** — `audit-coherence.mjs` résout désormais les URLs que la
page fabriquera : il lit les îlots `<script type="application/json">`, en extrait les champs
`slug`, et les teste contre les préfixes déclarés par la page. Vérifié : il signale les 3
pages en production, et ne signale plus rien une fois le correctif appliqué.

Deux fausses pistes traversées en écrivant ce contrôle, notées parce qu'elles se
reproduiront : un garde-fou « ne rien dire si aucun slug ne résout » qui faisait taire
exactement le pire cas (140 cassés sur 140) ; et un ratissage de toutes les chaînes de
l'îlot qui noyait le signal sous « listed », « window », « compagnies ».

---

## Gravité 1 — le visiteur est directement gêné

### 1.1 Le bouton « Envoyer par email » est probablement cassé en production

Le HTML servi par Cloudflare réécrit tout lien `mailto:` en
`/cdn-cgi/l/email-protection#88b7fb…` (protection anti-spam, activée sur le domaine —
constaté sur la page Mexique en production). Or notre script de `PageActions` ajoute
`&body=<URL de la page>` à ce `href` au chargement. Selon l'ordre d'exécution des deux
scripts, on corrompt le lien chiffré de Cloudflare : le clic n'ouvre rien, ou un
destinataire illisible.

La Bible n'est pas touchée : son bouton email est construit entièrement en JavaScript,
Cloudflare ne voit jamais de `mailto:` dans le HTML.

**Correctif** : faire pareil partout — ne mettre aucun `mailto:` dans le HTML servi, et
construire le `href` complet (sujet + corps) au chargement. Simple, et immunise contre la
réécriture quelle que soit sa configuration.

### 1.2 Français fautif sur les 140 fiches pays

Deux titres insèrent le nom du pays sans article ni préposition déclinée :

- « Trouver un vol pour **Mexique** » (`CountryOnward`) — il faudrait « pour *le* Mexique »,
  « pour *la* France », « pour *les* Pays-Bas »… ingérable tel quel ;
- « Aéroports **en Mexique** » (`CountryGuidePage`) — il faudrait « au Mexique ».

C'est exactement le problème que la FAQ avait résolu avec la forme « Pays : question ».
**Correctif** : appliquer la même forme — « Mexique : trouver un vol », « Mexique :
aéroports » (ou « Aéroports — Mexique »). L'espagnol (« a México », « en México ») est
correct et peut rester.

### 1.3 Une section vide affichée sur 420 pages

« 🧳 Retours de voyageurs » affiche « Aucun retour de voyageur documenté et fiable
disponible » sur **140 fiches pays sur 140**, dans les trois langues. Le champ
`travellerExperience` n'est renseigné dans **aucune** fiche YAML : la section n'a donc
jamais rien montré à personne.

**Correctif** : ne rendre la carte que si le champ existe. Le jour où un retour est
documenté, elle réapparaît d'elle-même.

---

## Gravité 2 — maillage : trois pages de valeur sont isolées

### 2.1 Les guides d'achat sont quasi orphelins

`/tools/best-carriers/` (« The best cabin carriers 2026 ») et `/tools/best-crates/`
sont des pages complètes, présentes dans le sitemap dans les trois langues — et pointées
par **3 liens chacune** sur tout le site (la page d'index des outils, essentiellement).
Elles sont absentes de `RelatedTools`/`PageActions`, donc invisibles depuis les 1 900
fiches. Ce sont pourtant les deux pages à vocation commerciale du site.

**Correctif** : les relier là où elles répondent à une question que le visiteur se pose
déjà — le guide des sacs cabine depuis l'outil caisse et les fiches compagnies (celui qui
vérifie les dimensions cabine cherche un sac), le guide des caisses depuis l'outil caisse
et les fiches pays à soute obligatoire.

### 2.2 Un doublon thématique orphelin

`/airports/pet-relief/` (« Airports with dog relief areas ») coexiste avec l'outil
`/tools/pet-relief/` (« Airport pet relief areas: dog bathroom by airport »). Deux pages
indexables sur la même intention de recherche : elles se cannibalisent, et la première
n'est pointée que par 3 liens.

**À trancher** : rediriger en 301 vers l'outil (mon conseil), ou différencier clairement
les deux contenus (l'une = liste éditoriale, l'autre = moteur de recherche).

### 2.3 Le Travel Hub ne vit que par le footer

663 pages y mènent, mais uniquement via le lien « Ressources » du footer. Aucun lien
contextuel. Acceptable pour un hub, mais si des articles y vivent, ils mériteraient des
liens depuis les fiches concernées.

---

## Gravité 3 — politiques éditoriales appliquées à moitié

Deux règles que tu as fixées (« mots clés d'abord, pas de suffixe de marque » et
« PET/dog dans chaque titre ») ont été appliquées aux fiches mais pas au reste :

- **Suffixe « — MyDogCanFly » encore présent** sur ~40 pages : les index (`/breeds/`,
  `/countries/`, `/airlines/`, `/tools/`, `/airports/`), le Travel Hub,
  `/airports/pet-relief/`, et les pages légales. Pour les pages légales, le suffixe est
  défendable ; pour les index et le hub, il consomme des caractères sans mot clé.
- **Ni « pet » ni « dog »** dans : `best-carriers` et `best-crates` (3 langues — « The
  best cabin carriers 2026 » ne dit pas pour qui), la fiche SAS en français (« animaux »
  sans « chien »), et 10 fiches races FR/ES aux noms longs où la place manquait.
- **Onglets incohérents** : depuis la Bible, les outils caisse et chaleur s'ouvrent dans
  un nouvel onglet ; depuis `PageActions` (toutes les autres pages), dans le même. Le
  même geste doit produire le même comportement — même onglet partout, le nouvel onglet
  restant réservé aux sites externes (réservation, sources).

---

## Gravité 4 — données : à arbitrer, pas à automatiser

- **Corée du Sud** : le sommaire dit « libéré le jour même si conforme », le tableau dit
  « Quarantaine : Requise ». Les deux sont défendables (la quarantaine existe mais dure
  zéro jour si conforme) — mais le visiteur lit une contradiction.
- **Salvador** : « pas de quarantaine de routine » (sommaire) vs « Requise » (tableau).
  Même ambiguïté.
- **Géorgie** : certificat « Requis » au sommaire, « Origines hors UE » au tableau —
  cohérent sur le fond, mais le sommaire devrait dire « Conditionnel ».
- **Séquence « Dans quel ordre, et quand »** : certains items n'y ont pas leur place
  (« Chiots / âge minimum » au Mexique n'est pas une démarche), et la phrase d'intro
  « l'ordre est imposé » surpromet sur les pays simples. Affinage éditorial à prévoir.

---

## Correctifs déjà dans le code, en attente de déploiement

Faits ce matin, absents du build audité — pour mémoire :

1. FAQ : 91 fiches annonçaient comme exigées des pièces facultatives (regex qui validait
   « Not required »). Corrigé.
2. Étiquettes d'origine : 228 étiquettes fausses (« Depuis l'UE » sur du contenu
   non-UE) retirées ; titre de bloc adaptatif ; champ `tag` par colonne au schéma.

---

## État d'exécution — 29 juillet 2026, après-midi

| # | Correctif | État |
|---|---|---|
| 1.1 | Bouton email : plus aucun `mailto:` dans le HTML servi, `href` construit au chargement (`data-subject`) — immunisé contre l'email-protection Cloudflare | **fait** |
| 1.2 | Grammaire FR : « Mexique : trouver un vol », « Aéroports — Mexique » (forme sans préposition, comme la FAQ) | **fait** |
| 1.3 | Carte « Retours de voyageurs » rendue seulement si un retour documenté existe (0/140 aujourd'hui → carte absente partout, réapparaît d'elle-même) | **fait** |
| 2.1 | Maillage des guides d'achat | **suspendu sur ta décision** — pas de pollution commerciale du maillage pour l'instant |
| 2.2 | `/airports/pet-relief/` | **tranché autrement** : pas un doublon. La liste statique (62 aéroports équipés) est le seul contenu crawlable — le sélecteur de l'outil est construit en JS, invisible des moteurs. Les deux pages sont désormais reliées dans les deux sens : l'outil renvoie à la liste complète, la liste renvoie au sélecteur. La 301 envisagée aurait détruit le seul maillage indexable du sujet. |
| 2.3 | Travel Hub | **fait** — vraie page « en construction » : bandeau honnête, renvois vers les 4 référentiels + 5 outils, titre mots-clés |
| 3 | Passe de titres : 7 pages d'index + outils + pet-relief, suffixe de marque retiré, mot clé chien/perro/dog partout, ≤ 61 caractères | **fait** — réserve : les pages légales (privacy, terms…) gardent volontairement le suffixe, la marque y est le mot clé |
| 3 | Onglets : la Bible ouvre désormais caisse et chaleur dans le même onglet, comme partout | **fait** |
| 4 | Données KR / SV / GE | **précisées, pas corrigées** — voir réserves ci-dessous |
| 4 | Intro de la séquence « Dans quel ordre, et quand » | **nuancée** : « Certaines étapes ne comptent que si la précédente est faite — vérifie chaque délai avec la référence officielle » |

### Réserves sur la gravité 4 — ce que l'examen des données a montré

Mes trois « contradictions » se sont largement dissoutes à la lecture attentive : le
détecteur automatique comparait des polarités de mots, pas des faits.

- **Corée du Sud** — il n'y avait pas contradiction : le « Requise » du tableau porte sur
  l'*inspection de quarantaine* (APQA au point d'entrée), pas sur une détention. Le
  sommaire dit désormais : « Inspection obligatoire — libération le jour même si
  conforme, détention sinon ». *Réserve : la durée d'une éventuelle détention n'est pas
  publiée ; ne pas la chiffrer.*
- **Salvador** — même cas : le *permis* de quarantaine est obligatoire, le *confinement*
  n'est pas prévu en routine. Sommaire précisé : « Pas de confinement de routine — mais
  le permis de quarantaine à l'entrée est obligatoire ». *Réserve : la fiche s'appuie sur
  l'USDA APHIS (source américaine décrivant les règles salvadoriennes), pas sur un texte
  salvadorien primaire.*
- **Géorgie** — le « Requis » du sommaire était défendable (passeport OU certificat,
  selon l'origine) mais laissait croire au certificat systématique. Précisé : « Requis —
  passeport UE ou certificat sanitaire selon l'origine ».
- **Séquence** — certains items du tableau ne sont pas des démarches (« Chiots / âge
  minimum » au Mexique) ; l'intro ne prétend donc plus que « l'ordre est imposé »,
  elle renvoie chaque délai à sa référence officielle. *Un tri éditorial fiche par fiche
  reste possible mais n'est pas automatisable sans risque.*
