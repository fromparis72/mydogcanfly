# Fiches compagnies — audit du 8 août 2026

Comparaison de quatre fiches publiques aux politiques officielles. Poids, dimensions et tarifs
sont globalement fiables. Les erreurs portent sur les **listes de races** et les **restrictions
géographiques**.

---

## DEUX CONSTATS DE PORTÉE GÉNÉRALE, à traiter avant les fiches

### A. Une taxonomie maison est affichée comme si elle était celle de la compagnie

Air France et Aegean affichent les **31 races brachycéphales de la classification générique
MyDogCanFly**, présentées comme la liste de la compagnie. Ce n'est pas la même chose.

- Air France publie une liste différente : Cane Corso, Dogue allemand, Staffordshire Bull Terrier,
  certains spaniels nommément. Le **Saint-Bernard n'y figure pas** — il apparaît pourtant sur la
  fiche.
  Source : https://img.static-af.com/m/777112177fb1990/original/CA-Reglementation-Tarifs-FR.pdf
- Aegean publie sa propre liste : Pinscher, Staffordshire Bull Terrier, épagneul tibétain,
  American Staffordshire Terrier, **et tous les croisements** des races énumérées. Là encore le
  Saint-Bernard est affiché sans être nommé par la compagnie.
  Source : https://fr.aegeanair.com/-/media/Files/Pets/Not-Accepted-Breeds_updated-25/Not-accepted-breeds---FR.pdf

**Conséquence dans les deux sens** : des races refusées à tort, et des restrictions réelles de la
compagnie passées sous silence.

**Correction structurelle** : chaque compagnie doit porter **sa propre liste sourcée**
(`airline_<slug>_brachy`), jamais une liste déduite de la taxonomie générale. La classification
maison peut servir à expliquer *ce qu'est* un brachycéphale ; elle ne peut pas se substituer à ce
que la compagnie a écrit.

**À vérifier sur les 92 fiches, pas seulement sur ces deux-là.** Si le gabarit affiche une liste
générique dès qu'une restriction brachycéphale existe, l'erreur est systémique.

### B. La page d'une compagnie fait foi sur sa politique, pas sur le droit d'un État

La page Air Transat affirme qu'un passeport européen ne peut pas remplacer le certificat sanitaire
au retour du Canada. **C'est plus absolu que la règle européenne**, qui admet le passeport pour un
animal parti de l'UE avec une vaccination valide (voir le chantier « passeport UE », traité le
8 août).

Règle éditoriale à poser : **une compagnie est la source de sa propre politique ; elle n'est pas
source du droit d'entrée d'un pays.** Ne jamais recopier dans les modalités détaillées ce qu'un
transporteur affirme sur une réglementation étatique.

---

## 1. Aegean — **gravité élevée**

**Erreur factuelle sur le vaccin, à corriger en premier.** La fiche dit « vaccin antirabique
administré ≥ 21 jours après la puce ». Faux. La puce doit précéder la vaccination, mais aucun
délai de 21 jours ne les sépare. **Les 21 jours se comptent après la primo-vaccination et avant le
voyage.** Cette erreur peut faire décaler ou rater un départ.

Texte proposé : « La vaccination antirabique doit avoir été administrée après l'identification par
puce. En cas de primo-vaccination, attendre au moins 21 jours avant le voyage. »

**Liste de races** : voir constat A. De plus, l'American Staffordshire et le Presa Canario sont
classés « ni cabine ni soute » alors qu'ils figurent dans la liste des brachycéphales interdits
**en soute et en fret**, pas nécessairement en cabine. Pour un adulte, la limite de 8 kg ferme la
cabine de fait — mais le motif affiché doit rester exact.

**Manque** : l'**Arabie saoudite** impose aussi le fret, au même titre que Dubaï, Abou Dabi et le
Royaume-Uni déjà cités.

**À ajouter** : cotes cabine générales 55 × 40 × 23 cm ; **40 × 25 × 25 cm sur DH8-100 et ATR** ;
cotes maximales des caisses soute moyennes et grandes ; présentation au comptoir 1 h avant ;
réservation possible jusqu'à 2 h avant sous réserve de place ; frais de centre d'appel de 8 €.

---

## 2. Air Transat — **gravité élevée**

**Liste de races interdites incomplète.** Manquent : Akita, berger du Caucase, Kangal / berger
d'Anatolie, Rottweiler, hybrides chien-loup, Dobermann, Cane Corso, mâtin napolitain, Presa
Canario, Tosa Inu, Staffordshire Bull Terrier — **et les croisements comprenant une race
interdite**. Bouledogue français bien en cabine seulement ; Bullmastiff et Dogue de Bordeaux
correctement exemptés.
Source : https://www.airtransat.com/en-CA/travel-information/special-services/pets-and-service-dogs

**Âges minimaux incomplets** : règle générale 12 semaines et sevré ; **États-Unis 6 mois** ;
**Guyana 4 mois**.

**Restrictions commerciales absentes**, à placer près des blocs cabine et soute car elles
décident de la faisabilité : pas d'animal sur les vols en **partage de code**, ni sur les vols
**opérés par une autre compagnie**, ni dans les **forfaits vacances** ; pas de soute en
**Train + Air** ; pas de soute **en correspondance**.

**Royaume-Uni, trop simplifié.** La fiche dit « R.-U. uniquement en fret ». En réalité : vers le
R.-U. → fret ; **depuis Londres** → animaux ordinaires refusés ; **depuis Manchester et Glasgow**
→ cabine et soute possibles ; chiens d'assistance → exceptions avec réservation 7 jours avant.

**Irlande omise** : chats et chiens en fret uniquement, dans les deux sens.

**Autres restrictions de route manquantes** : aucun animal vers la **Jamaïque** ; pas d'aller
simple au départ de Cuba, Maroc, Colombie, Pérou, Brésil, Turquie, Haïti — aller-retour parfois
possible via le centre d'appel ; aucun chien ayant séjourné dans un pays à haut risque rabique
dans les 6 derniers mois vers les **États-Unis**.

**Brachycéphales** : il manque l'exigence d'une **caisse d'une taille au-dessus de la normale**.

---

## 3. Air France — **gravité moyenne**

**Liste de races** : voir constat A.

**Âge minimal absent** : le tarif officiel indique **15 semaines**.

**Restriction Business intercontinentale absente** : Air France n'accepte pas les animaux
ordinaires en cabine Business sur les vols intercontinentaux. En l'état, la fiche laisse croire
qu'un chien de moins de 8 kg voyage en cabine quelle que soit la classe.

Tout le reste est confirmé : < 8 kg en cabine, 75 kg en soute, sac 46 × 28 × 24 cm, réservation
soute 24 h avant, tarifs, catégories 1 et 2 interdites, diagnose vétérinaire en cas de
ressemblance, brachycéphales interdits en soute, marge de 5 cm, chien d'assistance trop grand
transporté gratuitement en soute.

---

## 4. Volotea — **gravité faible à moyenne**, la plus fiable des quatre

**Contradiction interne** : la fiche dit correctement que les animaux sont refusés de et vers le
Royaume-Uni, l'Irlande et Malte, mais la section « Destinations — formalités d'entrée » affiche
encore Malte et le Royaume-Uni. Les retirer, ou les afficher barrés avec « animaux non transportés
sur cette route ».

**Formulation trop large** : « Volotea ne transporte pas de fret » n'est pas établi. La source dit
que Volotea ne transporte pas d'animaux en soute. Écrire : « Volotea ne propose pas de transport
d'animaux en soute ni par fret. »

---

## Ordre d'exécution

1. **Aegean, les 21 jours** — erreur factuelle qui modifie la préparation du voyage.
2. **Constat A** — mesurer d'abord l'ampleur sur les 92 fiches, puis remplacer les listes
   génériques par les listes propres à chaque compagnie, en commençant par Air France et Aegean.
3. **Air Transat** — races interdites, puis restrictions par route, réservation et âge.
4. **Volotea** — retirer Malte et le R.-U. des destinations, corriger la phrase sur le fret.
5. **Air France** — âge minimal 15 semaines et restriction Business intercontinentale.
6. **Constat B** — poser la règle éditoriale et vérifier qu'aucune fiche ne fait dire à une
   compagnie le droit d'un État.

*Rappel : le site et le Worker se déploient séparément. Et une correction n'est pas terminée
parce qu'elle est dans le code local.*
