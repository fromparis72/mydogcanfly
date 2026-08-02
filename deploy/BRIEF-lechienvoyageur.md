# Brief : rediriger lechienvoyageur.com vers MyDogCanFly

Les deux sites sont sur Cloudflare Pages. Il n'y a donc **ni VPS ni nginx** : tout se joue
dans le projet Pages de `lechienvoyageur.com`, avec un fichier `_redirects`.

Le fichier est prêt : **`deploy/_redirects`** dans ce dépôt. 334 règles — 160 adresses
écrites avec et sans barre oblique finale, les pages de navigation de l'ancien site, et deux
motifs pour la pagination. Il a été généré par
`packages/knowledge/scripts/gen-redirects.mjs` — **ne pas l'éditer à la main**, le régénérer.

---

## À copier dans une session Claude ouverte sur le dépôt

> **Contexte.** J'ai deux sites Cloudflare Pages sur le même sujet : `mydogcanfly.com` (le
> site principal) et `lechienvoyageur.com` (un ancien site Hugo en français). Les deux se
> concurrencent sur les mêmes requêtes. J'ai déjà importé les 62 guides de lechienvoyageur
> dans MyDogCanFly ; il ne reste qu'à éteindre l'ancien site et à rediriger ses URL, pour
> transférer le référencement acquis au lieu de le perdre.
>
> **Ce qui est prêt.** `deploy/_redirects` contient les 334 règles, chaque ancienne URL vers
> son équivalent exact sur `mydogcanfly.com`. Ne modifie pas les règles à la main : si elles
> doivent changer, régénère le fichier avec `packages/knowledge/scripts/gen-redirects.mjs`.
>
> **Le point de configuration à trancher, et la réponse.** Le projet Pages de lechienvoyageur
> est connecté à GitHub : il reconstruit le site Hugo à chaque push. Un envoi direct par
> `wrangler` serait donc écrasé à la première modification du dépôt — la migration tomberait
> toute seule, sans que personne s'en aperçoive.
>
> **On garde donc l'intégration Git, et on change ce que le build produit.** C'est plus sûr
> qu'un envoi manuel : versionné, reproductible, et rien à refaire à la main. Concrètement,
> le dépôt lechienvoyageur reçoit un dossier `redirect-site/` contenant les trois fichiers,
> et les réglages du projet Pages passent à : commande de build vide (ou `true`), dossier de
> sortie `redirect-site`. Hugo n'est plus appelé, mais **on ne supprime pas ses sources** —
> elles ne coûtent rien et permettent de revenir en arrière.
>
> **Ce que je te demande.**
>
> 1. Crée `redirect-site/` à la racine du dépôt lechienvoyageur, contenant :
>    - `_redirects`, copié depuis `deploy/_redirects` ;
>    - `404.html`, une page sobre en français qui explique que le site a rejoint
>      MyDogCanFly, avec un lien vers `https://mydogcanfly.com/fr/` ;
>    - `sitemap.xml`, **l'ancien sitemap du site tel quel**, listant les anciennes URL. C'est
>      volontaire et temporaire : Google va le relire, explorer chaque adresse et y trouver
>      une 301. C'est le moyen le plus rapide de faire découvrir la migration. Attends-toi à
>      un avertissement dans la Search Console, c'est normal. À retirer dans deux mois.
>    Rien d'autre. **Surtout pas d'`index.html`** : sur Pages, un fichier réel peut prendre le
>    pas sur une règle de redirection de même chemin. Ne pas en mettre supprime la question au
>    lieu d'avoir à trancher qui gagne.
>    Pour le sitemap : lance Hugo une fois en local et récupère le `sitemap.xml` qu'il génère,
>    plutôt que de le réécrire.
> 2. Commite et pousse `redirect-site/`. **Ne modifie rien d'autre**, et surtout ne supprime
>    pas les sources Hugo.
> 3. Dis-moi ensuite les deux réglages à changer dans le tableau de bord Cloudflare Pages du
>    projet lechienvoyageur — je les ferai moi-même, ils sont dans les paramètres de build :
>    commande de build, et dossier de sortie. Vérifie aussi avec moi que les domaines
>    personnalisés avec et sans `www` sont bien tous les deux rattachés au projet.
> 4. Une fois que j'ai changé les réglages et que le déploiement est passé, vérifie et
>    montre-moi les en-têtes obtenus :
>    - `curl -I https://lechienvoyageur.com/camping-avec-chien/`
>      → `301` vers `https://mydogcanfly.com/fr/travel-hub/camping-avec-chien/`
>    - `curl -I https://lechienvoyageur.com/aegean-airlines-chien`  *(sans barre finale)*
>      → `301` vers `https://mydogcanfly.com/fr/airlines/aegean/`
>    - `curl -I https://www.lechienvoyageur.com/voyager-chien-japon/`
>      → `301` vers `https://mydogcanfly.com/fr/countries/jp/`
>    - `curl -I https://lechienvoyageur.com/`
>      → `301` vers `https://mydogcanfly.com/fr/`
>    - `curl -I https://lechienvoyageur.com/page/3/`
>      → `301` vers `https://mydogcanfly.com/fr/travel-hub/` (motif de pagination)
>    - `curl -I https://lechienvoyageur.com/images/paysage.jpg`
>      → `404`, surtout pas une redirection : une image qui redirige vers une page HTML est
>        lue par Google Images comme une page introuvable
>    - `curl -I https://lechienvoyageur.com/page-inexistante/`
>      → `404` (et non une redirection)
>
> **Contraintes.**
> - Les codes doivent rester des **301**. Une redirection temporaire ne transfère rien :
>   Google garde l'ancienne URL en index et attend un retour qui ne viendra pas.
> - **Aucune règle attrape-tout** vers l'accueil. Renvoyer massivement le reste vers la racine
>   produit un « soft 404 » : Google le traite comme une page introuvable, en moins clair, et
>   sans rien transférer. Une vraie 404 désindexe proprement.
> - Ne touche pas au projet `mydogcanfly` : ce chantier ne concerne que lechienvoyageur.
> - Ne propose pas d'envoi direct par `wrangler` : il serait écrasé au prochain push, et la
>   migration s'effondrerait sans prévenir. Tout doit passer par le build Git.
> - Ne supprime pas le projet Pages ni le domaine. Ils doivent rester en service **au moins
>   douze mois** : une redirection qui disparaît emporte tout ce qu'elle transférait.

---

## Après coup

- Dans la Search Console de `lechienvoyageur.com`, utiliser l'outil de changement d'adresse
  s'il est proposé pour cette propriété.
- Resoumettre `sitemap.xml` sur la propriété `mydogcanfly.com`.
- Ne pas laisser expirer le nom de domaine `lechienvoyageur.com`.
