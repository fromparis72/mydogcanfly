# Déploiement — branche `claude/indexation-socle`

9 commits. Dépôt propre. Tous les harnais passés sur un build de production construit
le 13/09/2026 à partir de cette branche.

---

## Avant de commencer

```bash
cd ~/mydogcanfly
git status              # doit être propre — sinon, mets de côté avant
git log --oneline main..claude/indexation-socle | cat   # doit afficher 9 commits
```

---

## Étape 1 — Pousser la branche

```bash
git push -u origin claude/indexation-socle
```

La CI se déclenche sur la pull request, avec ses deux jobs en parallèle :
`verify` (build réduit, ~36 s) et `site-complet` (build complet, ~12 min).

Ouvre ensuite la pull request depuis GitHub. Attends les deux jobs verts.

**Ce que la CI ne couvre pas, et que j'ai vérifié à la main** — elle ne lit ni le
sitemap ni les balises `robots` du build de production. Les chiffres attendus sont
au bas de ce document.

---

## Étape 2 — Fusionner

Fusionne la pull request. La CI repasse sur `main` (`push: branches: [main]`).

```bash
git checkout main && git pull
```

---

## Étape 3 — Déployer

```bash
npm run release
```

Ce script enchaîne trois choses, dans cet ordre : `build:prod`, puis `verify:index`
— qui refuse le déploiement si une page indexable manque ou si un `noindex` traîne —
puis `wrangler pages deploy`. Compte une vingtaine de minutes.

À exécuter **dans ton terminal macOS**. Ni la VM ni la machine cloud ne peuvent le
faire : la première n'exécute pas tes dépendances natives, la seconde n'a pas tes
identifiants Cloudflare — et ne doit pas les avoir.

---

## Étape 4 — Vérifier en production

```bash
# Le cache de bord répond-il ?
curl -sSI https://mydogcanfly.com/ | grep -iE 'cache-control|cf-cache-status'
```

Attendu : `public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`.
`cf-cache-status` restera `DYNAMIC` tant que la règle Cloudflare n'est pas créée
(voir plus bas) — c'est normal, ce n'est pas un échec du déploiement.

```bash
# Le sitemap
curl -sS https://mydogcanfly.com/sitemap-en.xml | grep -c '<loc>'      # 464
curl -sS https://mydogcanfly.com/sitemap-fr.xml | grep -c '<loc>'      # 464

# llms.txt compte-t-il juste ?
curl -sS https://mydogcanfly.com/llms.txt | head -3

# La page de citation existe dans les quatre langues
for l in "" fr/ es/ pt/; do
  printf "%-6s " "/$l"; curl -sS -o /dev/null -w "%{http_code}\n" "https://mydogcanfly.com/${l}citing/"
done

# Une fiche de race non brachycéphale doit être en noindex
curl -sS https://mydogcanfly.com/breeds/beagle/ | grep -o 'name="robots"[^>]*'

# Une fiche brachycéphale ne doit PAS l'être
curl -sS https://mydogcanfly.com/breeds/boxer/ | grep -o 'name="robots"[^>]*' || echo "indexable — correct"

# Le menu sert-il ses listes ?
curl -sS -o /dev/null -w "%{http_code} %{size_download} octets\n" https://mydogcanfly.com/menu/breed-fr.json

# La redirection ne vise plus un fragment
curl -sS -o /dev/null -w "%{redirect_url}\n" https://mydogcanfly.com/tools/can-my-dog-fly/
```

---

## Étape 5 — La règle de cache Cloudflare

Sans elle, les en-têtes du lot 1 n'agissent que sur les navigateurs : Cloudflare ne
met le HTML en cache que si une règle le lui demande.

Tableau de bord Cloudflare → domaine `mydogcanfly.com` → **Caching** → **Cache Rules**
→ *Create rule*.

- Nom : `HTML — cache everything`
- Si : `Hostname equals mydogcanfly.com`
- Alors : **Eligible for cache**
- Edge TTL : **Use cache-control header if present**, repli 1 jour
- Browser TTL : **Respect origin**

Vérifier ensuite, après deux requêtes sur la même URL :

```bash
curl -sSI https://mydogcanfly.com/countries/de/ | grep -i cf-cache-status   # attendu : HIT
```

**Conséquence à connaître** : une fois cette règle active, une correction publiée ne
sera plus visible immédiatement pour tout le monde. `npm run release` ne purge rien
aujourd'hui. Pour une correction urgente, purge depuis le tableau de bord, ou ajoute
une purge à la fin du script de release.

---

## Étape 6 — Search Console

Dans l'ordre, et pas avant que le déploiement soit en ligne :

1. **Sitemaps** → resoumettre `https://mydogcanfly.com/sitemap.xml`.
2. **Inspection d'URL** → demander l'indexation d'une dizaine de pages phares :
   l'accueil, `/countries/`, `/airlines/`, `/breeds/`, `/citing/`, et quatre ou cinq
   fiches pays qui reçoivent déjà des impressions (`/countries/de/`, `/countries/tr/`,
   `/countries/ua/`, `/countries/kz/`). Cela amorce la file, ça ne la remplace pas.
3. **Ne relance PAS les deux validations** — celles du 14 août ont échoué le 15.
   Laisse passer deux à trois semaines pour que la sortie des 600 fiches de race et
   des 80 guides se lise dans le rapport, puis relance depuis un état stabilisé.
   Une validation relancée trop tôt échoue et refroidit la file.

---

## Chiffres attendus après déploiement

| | avant | après |
|---|---:|---:|
| URL au sitemap | 2 536 | **1 856** |
| liens `<a>` par page | 462 | **48** |
| HTML par page | 153 Ko | **47 Ko** |
| HTML total | 468 Mo | **143 Mo** |
| fiches de race indexables | 688 | **88** |
| guides indexables | 288 | **204** |
| pages portant « Citer cette page » | 0 | **1 492** |

Cohérence `noindex` / sitemap : **0 incohérence** sur les 860 fiches de race et les
360 pages de guides construites. `test:liens` relève 3 116 adresses distinctes qui
résolvent — le même nombre qu'avant le dégraissage du maillage.

---

## Si quelque chose casse

Le déploiement Cloudflare Pages garde ses versions : *Deployments* → la version
précédente → *Rollback*. Côté dépôt, `git revert` sur le commit fautif plutôt qu'un
retour en bloc — les neuf lots sont indépendants, sauf le lot 5 (porte des races) qui
suppose le lot 4 (JSON-LD) pour ses citations.
