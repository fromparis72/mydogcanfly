# Audit de la version internationale — mydogcanfly.com
_Traduction FR→EN, qualité rédactionnelle, cohérence marché US, SEO & GEO — juillet 2026_

## 1. Verdict global

Le site est **en très bon état**. La traduction du français vers l'anglais est propre, fluide et idiomatique (US), le SEO technique est solide, et le site est déjà « GEO-ready » (optimisé pour les moteurs génératifs). Il n'y a **aucun défaut structurel**. Les axes d'amélioration restants sont surtout **éditoriaux** : cohérence pour une audience américaine, quelques calques du français, et généralisation d'exemples franco-centrés.

Périmètre : scan automatisé des **149 articles** + templates + 3 outils ; relecture qualitative approfondie de ~24 pages à forte valeur (home, piliers, destinations clés, compagnies majeures, gear, santé).

---

## 2. Ce qui est déjà excellent (à préserver)

- **Aucun français oublié** dans le corps des 149 pages. Les rares occurrences détectées sont légitimes : noms propres, URLs de sources officielles, valeurs techniques de shortcodes, et mentions volontaires du site frère « Le Chien Voyageur ».
- **Orthographe 100 % US** : 0 occurrence britannique (colour, favourite, organise, centre, travelling…).
- **Unités doubles systématiques** : métrique + impérial (« 8 kg / 18 lb »), températures °C/°F.
- **Aucun slug FR résiduel** dans les liens internes ; **aucun `utm_source` résiduel**.
- **SEO on-page irréprochable** : 149 `seoTitle` ≤ 60 caractères, 149 `description` ≤ 160, **zéro doublon** de titre ou de description.
- **Balisage technique complet** : `canonical`, `hreflang` EN + FR (site frère) + `x-default`, `sitemap.xml`, `robots.txt`.
- **Données structurées riches** : BlogPosting + BreadcrumbList + Organization + WebSite/SearchAction, **et un FAQPage JSON-LD sur les 149 pages** (généré depuis le bloc `faq`). Excellent pour les rich results et les réponses IA.
- **GEO** : le `robots.txt` autorise explicitement les bots génératifs (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot). C'est rare et bien vu.
- Les **shortcodes** rendent des libellés anglais (`alerte type="obligatoire"` → « Required »).

---

## 3. Corrections déjà appliquées dans cette passe

1. Calque « dogs **based in** the EU » (domicilié) → « dogs **living in** the EU » — 3 pages (requirements, flying-with-a-dog, international-travel).
2. Incohérence d'unité sur la home : « 8 kg / **17–20 lb** » → « 8 kg / **18 lb** » (aligné sur le reste du site) — 4 occurrences (FAQ visible + JSON-LD).
3. France-isme « the local **town hall** » → « your local town or city office » (page beaches).
4. Redondance sur British Airways : phrase dupliquée « Assistance dogs only in the cabin. » supprimée.
5. Devise à contre-sens sur **United** (page US-airline) : suppression du glose « ≈€138 » — un lecteur US n'a pas besoin d'euros.
6. Ambiguïté Air France : « dog ≤ 75 kg with the crate » → « **dog + crate combined up to 75 kg (165 lb)** » (le 165 lb pouvait se lire comme un poids de chien).
7. **Page « Traveling to the USA »** rendue origin-aware (3 endroits) : l'exemple « France » comme seul pays low-risk est remplacé par « most of Europe, the UK, Canada, Australia and Japan… » et le cadrage passe à « dogs **entering the US from** a low-risk country », plus adapté à un lecteur américain.

---

## 4. Recommandations priorisées (non encore appliquées)

### P1 — Cohérence marché US _(fort impact)_

1. **Politique de devise sur les pages compagnies nord-américaines.** Retirer le glose « (~€…) » qui n'apporte rien à un lecteur US. Reste à traiter : **JetBlue** (×3), **WestJet** (×4), **Air Canada** (×4). À l'inverse, garder un repère USD sur les pages compagnies européennes (déjà fait sur KLM, Iberia, ITA, TAP).
2. **Généraliser l'exemple « France » comme pays low-risk par défaut** — 5 pages restantes : `traveling-to-brazil`, `traveling-to-new-zealand`, `traveling-by-car`, `dog-car-harness`, `dog-friendly-beaches`. Remplacer par « most of Europe, the UK, Canada… ».
3. **Ajouter des sources qui font autorité aux US.** Beaucoup de pages ne citent que des sources françaises (`.gouv.fr`, service-public, ANSES). Ajouter, selon le sujet : **CDC** (entrée aux US), **USDA APHIS** (export/certificat), **ASPCA / AVMA** (santé, coup de chaleur), **Amtrak** (train), **AAA / ASPCA** (voiture). Double bénéfice : crédibilité auprès du lecteur US **et** citabilité par les moteurs IA.

### P2 — Qualité rédactionnelle _(calques & faits bruts)_

4. **Faits « stranded » par la traduction** (à reformuler en phrases lisibles) : United « 22 breeds banned » ; American « embargo at PHX/TUS/LAS/PSP » (donner Phoenix, Tucson, Las Vegas, Palm Springs) ; Japon « AQS » (expliciter « Animal Quarantine Service »).
5. **Exemple juridique franco-centré** : `article R412-6` (page voiture) → généraliser (« aux US, les lois anti-distraction et de contention varient selon l'État »).
6. **Calques mineurs** : « priced by quote » (8 pages) → « priced by custom quote » ; « the Lufthansa quirk » → « why Lufthansa is different » ; « thermomolded » → « molded ». _(Note : « favor the cabin » est correct en anglais US — non prioritaire malgré 30 occurrences.)_
7. **« h » pour « hours »** (2 occ, page UK) → écrire « hours ».
8. **Uniformiser la terminologie brachycéphale** (dispersion actuelle : « brachycephalic » 69 pages, « flat-faced » 51, « snub-nosed » 20). Convention suggérée : « brachycephalic (flat-faced) » à la 1re mention, puis « flat-faced » ou « snub-nosed ». Chantier progressif, non bloquant.

### P3 — GEO & éditorial _(visibilité IA & conversion)_

9. **Définitions citables inline** : définir « brachycephalic » et « rabies titer test » en une phrase là où ils apparaissent sans définition — les moteurs IA citent volontiers ces micro-définitions.
10. **Exemples chiffrés concrets** (page calculateur de cage IATA : « un chien de 60 cm / 24 in a besoin d'une caisse ~… »).
11. **Origin-awareness généralisée** : la page « traveling-to-the-EU » est le **modèle** (« if you're entering the EU from the US, UK, Canada… »). Appliquer ce patron aux autres pages destinations pour clarifier « selon votre pays de départ ».
12. **Ciblage mots-clés US** : renforcement « dog / flying / flight » sur la home déjà fait ; envisager des variantes US dans titres et FAQ (« TSA », « pet fee », « CDC Dog Import Form »).

---

## 5. SEO / GEO — notes stratégiques

- **Réciprocité hreflang** : le site EN pointe vers le FR (`frUrl`). Vérifier que le site FR (lechienvoyageur.com) déclare **en retour** `hreflang="en"` vers mydogcanfly. Sans réciprocité, Google ignore l'appariement de langue.
- **`x-default` = EN** : correct pour une cible internationale.
- **Données structurées** : déjà complètes (BlogPosting, Breadcrumb, FAQPage). Rien à ajouter côté schéma.
- **GEO** : la combinaison FAQPage sur toutes les pages + robots.txt ouvert aux bots IA + réponses concises est un excellent socle. Le levier restant est la **citabilité** (définitions nettes, sources US reconnues, chiffres datés « Verified 2026 » — déjà présents).

---

## 6. Prochaine étape proposée

Je peux exécuter le **lot P1** dans la foulée (devise sur JetBlue/WestJet/Air Canada, généralisation « France » sur les 5 pages, et ajout d'une source US par grande catégorie), puis le **lot P2** (faits bruts + calques). Dis-moi si je lance P1, ou si tu veux d'abord relire ce rapport et arbitrer.
