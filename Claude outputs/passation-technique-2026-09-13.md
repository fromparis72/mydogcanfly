# Passation technique — état du dépôt et du bord au 13/09/2026

À lire avant toute intervention SEO. Tout ce qui suit est vérifié en production, pas supposé.

## 1. État des branches

- `main` est à `8c0f0dc` (PR #64 fusionnée, 17 commits), déployée et en ligne.
- Une branche locale `garde-jeton-purge` existe sur le Mac, un commit `86c2e82`, **non poussée**.
  Elle ne touche que `purger-cache.mjs` à la racine. À pousser ou à reporter, au choix.
- Ne pas travailler directement sur `main` : le déploiement suit `main`, un commit direct part en
  production sans passer par la CI.

## 2. Cloudflare — le piège principal

Une règle de zone « HTML — cache everything » garde le HTML **24 h au bord**, avec sept jours de
`stale-while-revalidate`. Conséquence à ne jamais oublier :

> Après chaque déploiement, tant que le cache n'est pas purgé, `curl` sur la production renvoie
> l'ANCIENNE version. Vérifier un correctif sans purger conduit à conclure qu'il n'a pas pris.

La purge est automatisée : `npm run purge:cache` (script `purger-cache.mjs` à la racine), déjà
enchaîné dans `npm run release`. Le jeton est dans `~/.zshrc` sous `CLOUDFLARE_PURGE_TOKEN`.
Purge manuelle : tableau de bord → mydogcanfly.com → Caching → Configuration → Purge Everything.

Les en-têtes viennent de `packages/ui/public/_headers`.
**Défaut connu** : Pages *concatène* les règles au lieu de laisser la plus spécifique l'emporter,
donc les sitemaps sortent avec un double `cache-control` (`s-maxage=86400` puis `s-maxage=3600`).
Sans gravité SEO, à corriger en fusionnant les règles plutôt qu'en les empilant.

## 3. Le patron des portes d'indexation — à respecter impérativement

Trois fichiers dans `packages/ui/src/lib/` : `reliefEtat.ts` (aéroports), `raceEtat.ts` (races),
`guideEtat.ts` (guides). Chacun exporte **une seule fonction de règle**, consommée à la fois par
`sitemapEntries.ts` et par la propriété `noindex` de la page. C'est ce qui garantit que le sitemap
et la balise `robots` ne peuvent pas diverger. Une quatrième porte, pour les compagnies non
vérifiées, manque — elle doit suivre exactement ce patron, pas une condition dupliquée.

**Avant de livrer une nouvelle porte, vérifier la symétrie linguistique** : une clé doit être
annoncée dans TOUTES ses langues ou dans aucune. Une porte asymétrique casse les `hreflang` sur
tout le site. `test-annonce-du-site.mjs` teste cet invariant.

## 4. Pièges de CI, dans l'ordre où ils mordent

1. **`build:preview` marque TOUTES les pages `noindex, nofollow`.** Le job `site-complet` l'utilise.
   Donc tout harnais qui partitionne les pages sur la balise `robots` lit « 0 page indexable » en
   CI et passe à tort ou échoue à tort. Partitionner sur l'appartenance au sitemap.
2. **Contrat de provenance** (`packages/knowledge/scripts/lib/provenance.mjs`) : les trois paquets
   `ui`, `knowledge`, `engine` sont scrutés ; toute variable d'environnement lue à l'intérieur doit
   être déclarée dans `PARAMETRES`, car elle est réputée changer le site produit. C'est pour cette
   raison que `purger-cache.mjs` est à la racine et non dans un paquet.
3. **Registre IATA scellé** : `dette-iata-publiee.json` porte une sentinelle
   `_mesure.dist_pages_html = 3125`. Ajouter ou retirer des pages HTML la fait échouer. Ne la
   déplacer que délibérément, via
   `node --import tsx test-etape3-dom.mjs --dist=… --ecrire-registre`.
   Passer une page en `noindex` ne change pas le compte — la page est toujours construite.
4. **Un seul nœud `WebPage` par page.** Les citations des données structurées sont typées
   `CreativeWork`, pas `WebPage` ; la CI refuse les nœuds `WebPage` multiples.
5. **Portugais** : les gabarits appellent `inlineT(en, fr, es)` ; le portugais vient de
   `translations/pt/inline.json`, indexé par la chaîne anglaise. Une nouvelle chaîne absente du
   catalogue **retombe silencieusement en anglais**. La CI le détecte, mais après coup.

## 5. Fichiers générés

`packages/ui/src/data/countries.generated.json` est produit, pas écrit à la main. Le champ
`reviewer` (« MyDogCanFly Data Team ») doit être corrigé **dans le générateur**, sinon la prochaine
construction le ressuscite.

L'auteur des guides vient du frontmatter `author:` des fiches `packages/ui/src/content/guides/**/*.md`.

## 6. Search Console

Ne PAS relancer les deux validations en échec avant deux à trois semaines : une validation relancée
trop tôt et rejetée repart pour un cycle d'attente plus long. Le sitemap a été resoumis le 13/09.

## 7. Trois corrections identifiées, non faites

1. Porte d'indexation des compagnies sans aucune citation vérifiée (9 concernées :
   Air New Zealand, Air Serbia, Batik Air Malaysia, EL AL, Icelandair, Norwegian, Pegasus, Saudia,
   Wizz Air). Conserver Air New Zealand et Norwegian le temps de les vérifier, elles ont une
   demande mesurable.
2. Remplacer « Camille Roussel » par Phil Albert-Benoist sur tous les guides, texte et JSON-LD.
3. Supprimer `reviewedBy: MyDogCanFly Data Team` (typé `Person`, entité inexistante).

Tant que (1) n'est pas fait, `llms.txt` affirme une chose fausse : « Pages that do not yet carry a
verified answer are served noindex ». Poser la porte plutôt qu'adoucir la phrase — c'est cette
promesse qui rend le corpus citable.

## 8. Périmètre arrêté pour le lot suivant (13/09, 21 h 41)

- Créer la quatrième porte (compagnies), sur le patron du §3.
- Faire coïncider strictement sitemap, balise `robots` et promesse de `llms.txt`, sans exception.
- Air New Zealand et Norwegian : vérifier au moins un canal dans ce lot ; si la vérification
  n'aboutit pas, les passer en `noindex` comme les sept autres. Pas de dérogation silencieuse.
- Camille Roussel → Phil Albert-Benoist dans le rendu visible ET le JSON-LD, avec lien vers la
  page À propos ; **nettoyer aussi les frontmatters** pour éviter une résurrection.
- `MyDogCanFly Data Team` : supprimer depuis le générateur. **Ne pas le remplacer par Phil** —
  mieux vaut aucun `reviewedBy` que simuler une relecture indépendante.
- Corriger le double `s-maxage`.
- Ne toucher ni aux aéroports, ni au portugais, ni à aucune autre famille.

Contrôles d'acceptation après déploiement (purger le cache avant de mesurer, cf. §2) :
Batik Air Malaysia en `noindex` et absente des quatre sitemaps ; les guides nomment Phil ;
plus aucun `reviewedBy` sur les pages pays ; la phrase de `llms.txt` vraie sans exception.

## 9. Rectification d'un chiffre que j'ai avancé

J'ai écrit « nous venons de retirer 1 256 pages de l'index en une fois ». C'est faux : il y a
1 256 pages en `noindex` aujourd'hui, mais les 564 pages d'aéroport l'étaient déjà. Le mouvement
récent est de 600 races + 84 guides retirés, 4 pages `/citing/` ajoutées, soit **−680 URL nettes**
au sitemap. La consigne d'attente de quatre à huit semaines avant de toucher une autre famille
reste inchangée.
