# Réception de la collecte AeroDataBox — 29 juillet 2026

Contrôle indépendant de `livraison_MyDogCanFly.zip`, puis fusion. Tout ce qui suit a été
vérifié contre les données, pas repris de la note de collecte.

---

## 1. Contrôles de format — conformes

| Contrôle | Résultat |
|---|---|
| Arêtes mal formées | **0** |
| Aéroports hors des 249 connus | **0** |
| Paires non triées | **0** |
| Arêtes réflexives | **0** |
| Doublons | **0** |
| Codes compagnie inconnus | **0** |
| Volumes annoncés vs comptés | **6 334 + 1 718, exact** |

---

## 2. Un écart avec la note de collecte

La note signale **3** baisses supérieures à 30 % (I2, VY, W6). J'en compte **6** : VY, W6,
**EW, V7, GA, SV**. L'écart vient de la baseline utilisée — la note a comparé à l'ancienne
version à 73 compagnies, elle le signale elle-même au §7.

Mais l'essentiel de ces baisses n'est pas une perte : c'est une **reclassification en
saisonnier**. En comptant les deux champs :

| Code | Directes avant | Directes + saison. après | Perte réelle |
|---|---|---|---|
| EW Eurowings | 228 | 87 + 123 = **210** | 18 |
| V7 Volotea | 61 | 24 + 50 = **74** | **gain de 13** |
| GA Garuda | 21 | 10 + 10 = **20** | 1 |
| SV Saudia | 111 | 68 + 18 = **86** | 25 |
| W6 Wizz Air | 398 | 137 + 67 = **204** | **194** |
| VY Vueling | 435 | 80 + 19 = **99** | **336** |

Seules VY et W6 posaient une vraie question.

---

## 3. Vueling : l'ancienne donnée n'était pas fiable

Trois signaux concordants, indépendants du scan :

- **321 arêtes sur 435 ne touchaient aucun hub déclaré** — 26 % seulement en touchaient un.
  Exemples relevés : Bruxelles–Catane, Genève–Naples, Genève–Porto.
- **Densité de 35,5 % du maillage complet** entre ses 50 aéroports. Un transporteur en
  étoile autour de Barcelone ne produit pas ça.
- **Distribution des degrés plate** (max 37, médiane 12) là où une donnée réelle est en
  étoile — Barcelone devrait écraser le reste.
- Le scan n'en confirme que **16 %**.

Conclusion : la base Vueling avait été construite par combinaison, pas observée. Le
remplacement est un gain, pas une perte.

## 4. Wizz Air : le cas ambigu, tranché en connaissance de cause

À l'inverse de Vueling, la donnée W6 **a la signature d'une donnée réelle** : distribution
en étoile (max 50, médiane 8), 62 % des arêtes touchant un hub, 49 % confirmées par le scan.
Les 194 arêtes perdues sont donc peut-être réelles — probablement des routes opérées moins
d'une fois par semaine, invisibles d'un échantillon d'une semaine par saison.

**Décision : fusionner comme les autres**, sur la règle posée — AeroDataBox fait autorité
partout, sans exception. Le raisonnement de risque va dans le même sens : une route absente
à tort fait afficher « avec escale », le visiteur voit moins d'options mais rien de faux ;
une route présente à tort promet un vol direct qui n'existe pas, ce que tout le projet
cherche à éviter.

**Réserve** : c'est le seul poste où je ne peux pas affirmer que la nouvelle donnée est
meilleure que l'ancienne. À reprendre si Wizz devient un enjeu.

## 5. Iberia Express : conservée telle quelle

AeroDataBox n'expose que 3 vols I2 sur tout le scan, les 3 482 autres départs de Madrid
étant attribués à IB. Le collecteur a eu raison de l'omettre plutôt que de la rattacher :
la fusion a donc **conservé les 14 routes actuelles**. Pas de rattachement I2 → IB tant que
les deux politiques animaux n'ont pas été comparées.

---

## 6. Résultat de la fusion

```
compagnies mises à jour : 77   ·   conservée : 1 (I2)
couverture finale : 78 / 78
6 345 arêtes directes   ·   1 721 saisonnières
```

**Le défaut central est levé.** Les cinq compagnies qui annonçaient 752 arêtes « toute
l'année » sans preuve ont enfin une saisonnalité mesurée :

| | Directes | Saisonnières |
|---|---|---|
| Air France | 154 → 129 | 0 → **16** |
| KLM | 83 → **111** | 0 → **7** |
| Lufthansa | 193 → 189 | 0 → **23** |
| Brussels | 40 → 47 | 0 → **8** |
| easyJet | 282 → 308 | 0 → **136** |

**KLM confirmé sous-couvert** : le soupçon que j'avais signalé dans le brief se vérifie.
83 routes annoncées, 111 réelles — la donnée précédente manquait 34 % du réseau d'Amsterdam.

**easyJet est le cas le plus parlant** : 136 routes étaient présentées comme permanentes
alors qu'elles sont saisonnières. C'est autant de fois où le site aurait pu annoncer en
février un vol direct qui n'existe qu'en été.

Il reste 6 compagnies sans aucune saisonnière (BR, CI, CM, MK, MS, TG) — long-courriers à
réseau stable, ce qui est plausible.

---

## 7. Méthode de la collecte, pour mémoire

Plan Ultra, 6 972 appels, ~13 950 unités sur 60 000. Échantillonnage **3–9 août 2026**
(été) et **18–24 janvier 2027** (hiver), une semaine pleine chacun — ce qui capte toute
route opérée au moins une fois par semaine. Règle : vue aux deux saisons → `direct_routes` ;
vue à une seule → `seasonal_routes`.

Le collecteur signale avoir corrigé deux bugs de parsing avant livraison : champ de
destination lu au mauvais endroit, et code IATA de JAL absent de la réponse (récupéré depuis
le préfixe du numéro de vol — sans quoi JL ressortait à 0 au lieu de 49 + 4).

## 8. Suite

`baseline_routes.json` a été régénéré depuis la production après fusion — le prochain cycle
mensuel diffèrera contre l'état réel. Sauvegarde de sécurité de l'ancien `objects.json`
conservée hors dépôt pendant la session.
