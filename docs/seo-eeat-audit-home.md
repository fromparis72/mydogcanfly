# Audit E-E-A-T — Page d'accueil MyDogCanFly

> Périmètre : page d'accueil (`packages/ui/src/pages/[...loc]/index.astro` → `HomeSections.astro`, `Base.astro`).
> Objectif : renforcer Experience, Expertise, Authoritativeness, Trustworthiness pour un site YMYL (conseils qui engagent la sécurité de l'animal).
> Méthode : audit d'abord, implémentation après validation. Chaque point indique **Existant / Manque / Reco** et une **priorité** (P1 = fort impact/faible effort, P3 = fond).

---

## Synthèse

La home est déjà solide sur le contenu (FAQ riche, section confiance, stats, parcours) et sur le SEO de base (title, description, canonical, hreflang, FAQPage schema). Les lacunes E-E-A-T se concentrent sur **4 points** : (1) pas de données structurées d'entité (Organization/WebSite), (2) pas d'OpenGraph/Twitter, (3) aucun auteur/relecteur **nommé et qualifié**, (4) pas de page **méthodologie/politique éditoriale** vers laquelle pointer les signaux de confiance. Ce sont précisément les 4 leviers que tu as priorisés.

**Note E-E-A-T actuelle (subjective) : 6/10.** Le contenu inspire confiance mais Google/IA ne peuvent pas *vérifier* qui est derrière ni relier le site à une entité identifiable.

---

## 1. Données structurées & meta

**Existant**
- `Base.astro` : `<title>`, `<meta description>`, canonical auto par locale, `hreflang` en/fr/x-default, favicon, theme-color, `noindex` hors production (bon garde-fou).
- `HomeSections.astro` : **FAQPage** JSON-LD (l. 197-199, 324) — très bon pour SEO + réponses IA.

**Manque**
- Aucun **Organization** JSON-LD (nom, logo, URL, `sameAs` réseaux, `contactPoint`, `foundingDate`). C'est LE signal d'entité qui fonde l'*Authoritativeness*.
- Aucun **WebSite** JSON-LD avec `potentialAction` (SearchAction) → pas de sitelinks searchbox possible.
- Aucun **OpenGraph** ni **Twitter Card** → partages sociaux sans titre/image/description contrôlés (impacte CTR et signaux de marque).
- Pas de `<meta name="author">` / publisher, pas d'image OG (`/brand/og-*.png`).
- Pas de `dateModified` structurée sur la home (signal de fraîcheur).

**Reco**
- **P1** — Ajouter dans `Base.astro` : OpenGraph (`og:title/description/type/url/image/locale` + `og:locale:alternate`) et Twitter (`summary_large_image`). Créer une image OG de marque (1200×630).
- **P1** — Ajouter un JSON-LD **Organization** + **WebSite** (idéalement injecté globalement dans `Base.astro`, avec `sameAs` vers les comptes sociaux réels quand ils existent).
- **P2** — `WebSite.potentialAction` = SearchAction pointant vers le Finder / la recherche d'index.
- **P2** — Exposer une `dateModified` (date de build) en JSON-LD sur la home.

---

## 2. Signaux auteur / relecteur

**Existant**
- Section « Pourquoi faire confiance » (`home.trust.*`) : sources officielles, réglementations vétérinaires, mise à jour, Decision Engine, vérification IA, **relecture humaine**.
- Les fiches pays portent déjà `reviewer: "MyDogCanFly Data Team"` + `verified_date` + `confidence` (données), mais **rien de cela n'est nommé ni qualifié sur la home**.

**Manque**
- Aucune **entité auteur/éditeur nommée** avec expertise affichée (qui compose la « Data Team » ? vétérinaire relecteur ? années d'expérience ?). « Relecture humaine » sans nom ni qualification a peu de poids E-E-A-T.
- Pas de lien depuis la home vers une page **équipe / à propos** crédible (la page `about.astro` actuelle est un simple stub : tagline + 1 paragraphe).
- Pas de byline « Contenu établi par … · Relu par … · Mis à jour le … » visible.

**Reco**
- **P1** — Étoffer `about.astro` en vraie page **À propos / Équipe** : mission, méthode, membres (rôles, qualifications — ex. relecture vétérinaire si applicable), engagement de mise à jour. La relier depuis la section confiance de la home et le footer.
- **P2** — Sur la home, transformer « Relecture humaine » en signal nommé/lié (ex. « Relu par notre équipe éditoriale — voir la méthode ») pointant vers la page méthodologie.
- **P2** — Si un·e vétérinaire ou expert·e relit réellement le contenu, l'afficher nommément (Person schema avec `jobTitle`, `knowsAbout`). ⚠️ **Ne rien inventer** : n'afficher que des rôles/qualifications réels (règle « nothing fabricated »).

---

## 3. Sources & fiabilité

**Existant**
- Discours de confiance clair : « Chaque règle est sourcée, datée et revue » ; « Compagnies revérifiées tous les 90 jours, pays tous les 180 ».
- Sourcing réel dans les données (chaque exigence pays porte un `ref` officiel + liste `sources`).

**Manque**
- La home **affirme** le sourcing mais ne le **démontre pas** : pas d'exemple de source officielle cliquable, pas de lien vers une page **Méthodologie / Politique éditoriale** expliquant *comment* les données sont collectées, vérifiées et datées.
- Incohérence de fraîcheur à corriger : `home.trust.p3` dit « Mis à jour tous les 7 jours » alors que `home.trust.body` dit « 90 / 180 jours ». Google et les utilisateurs relèvent ce genre d'écart (nuit à la *Trustworthiness*).

**Reco**
- **P1** — Créer une page **Méthodologie / Politique éditoriale** (comment on source, qui vérifie, cadence de revue, échelle de confiance, correction d'erreurs) et la lier depuis la section confiance + footer. C'est le point d'ancrage de tous les signaux.
- **P1** — Harmoniser les affirmations de fraîcheur (choisir la cadence réelle et l'écrire partout de la même façon).
- **P2** — Sur la home, montrer 2-3 **logos/liens de sources officielles** (DGAL, Commission européenne, autorités vétérinaires) en « as-sourced-from », véridiques.

---

## 4. Expérience vécue (le premier « E »)

**Existant**
- Les fiches pays ont un champ `travellerExperience` (retours documentés, sinon `null` — honnête).
- Ton concret et pédagogique dans la FAQ.

**Manque**
- La home ne montre **aucun signal d'expérience de première main** (cas réels, retours voyageurs, exemples concrets vécus). L'« Experience » est le levier le plus faible aujourd'hui.

**Reco**
- **P2** — Ajouter sur la home un bloc **« Retours de voyageurs »** ou **« Cas concrets »** alimenté *uniquement* par des expériences réellement documentées (réutiliser `travellerExperience` des fiches, avec attribution). Ne rien fabriquer : s'il n'y a pas de données, préférer un encart « méthode » plutôt qu'un faux témoignage.
- **P3** — À terme, collecter de vrais retours (formulaire modéré) pour nourrir ce bloc et les fiches — vraie source d'« Experience » durable.

---

## Plan d'implémentation proposé (par vagues)

**Vague 1 — quick wins techniques (P1, faible risque)**
1. OpenGraph + Twitter Card dans `Base.astro` (+ image OG de marque).
2. JSON-LD **Organization** + **WebSite** global.
3. Harmoniser les mentions de fraîcheur (7 j vs 90/180 j).

**Vague 2 — signaux humains & méthode (P1-P2, à contenu réel)**
4. Vraie page **À propos / Équipe** (remplace le stub) + lien depuis home & footer.
5. Page **Méthodologie / Politique éditoriale** + liens depuis la section confiance.
6. Byline « établi / relu / mis à jour le » sur la home (données réelles only).

**Vague 3 — expérience & preuve (P2-P3)**
7. Bloc « Retours de voyageurs » alimenté par `travellerExperience` réels.
8. Sources officielles mises en avant (logos/liens véridiques).

---

## Garde-fous (règles du projet)

- **Nothing fabricated** : aucun nom d'auteur, qualification, témoignage ou source qui ne soit réel. En l'absence de donnée, on affiche la méthode, pas une invention.
- **Data-driven** : les signaux (dates, sources, confiance) doivent venir des données existantes (`verified_date`, `sources`, `reviewer`) plutôt que d'être codés en dur.
- **Bilingue EN/FR** : chaque ajout textuel doit exister dans les deux langues (via `strings.json` ou `T(en, fr)`).
