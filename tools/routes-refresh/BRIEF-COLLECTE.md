# Brief de collecte AeroDataBox — à transmettre au Claude qui exécute

*Émis le 29 juillet 2026 par le Claude du dépôt MyDogCanFly. Tout ce qui suit est vérifié
contre l'état réel du dépôt, pas supposé.*

---

## 1. Ce qu'il me manque, en une phrase

Un fichier **`routes_new.json`** couvrant les **78 compagnies**, avec la **saisonnalité
distinguée**, au format décrit au §3. Rien d'autre.

Je n'exécute pas la collecte moi-même : elle demande une clé RapidAPI et je ne manipule pas
d'identifiants.

---

## 2. Priorité absolue : 5 compagnies

Ces cinq-là sont aujourd'hui renseignées par un autre chemin (API KLM/Transavia) et n'ont
**jamais été testées pour la saisonnalité** — 0 route saisonnière déclarée sur les 5, contre
8 à 47 pour toutes les autres. **752 arêtes sont donc annoncées « toute l'année » sans
preuve.** C'est le défaut le plus concret de la base.

| Code | Compagnie | Hubs | Directes aujourd'hui | Saisonnières |
|---|---|---|---|---|
| **AF** | Air France | CDG, ORY | 154 | **0** |
| **KL** | KLM | AMS | 83 | **0** |
| **LH** | Lufthansa | FRA, MUC | 193 | **0** |
| **SN** | Brussels Airlines | BRU | 40 | **0** |
| **U2** | easyJet | LGW, STN, MAN, EDI, CDG, ORY, GVA, BSL, MXP, LIN, BCN, LIS, BER, AMS, PMI, NAP | 282 | **0** |

**Point de vigilance sur KLM** : 83 routes seulement, 20ᵉ rang sur 78, derrière SAS (126) et
Saudia (111) — pour un hub de la taille d'Amsterdam. Si la collecte confirme ~83, dis-le
explicitement ; si elle remonte 140–160, c'est que la donnée actuelle était incomplète.
Dans les deux cas je veux le savoir, pas le deviner.

Les 73 autres compagnies sont à collecter aussi (le rafraîchissement est global), mais si le
quota impose un arbitrage, **ces 5 passent avant**.

---

## 3. Format attendu — strict

Un objet JSON **indexé par code IATA de compagnie**, exactement comme
`baseline_routes.json` :

```json
{
  "AF": {
    "direct_routes":   ["airport_ams|airport_cdg", "airport_bcn|airport_ory"],
    "seasonal_routes": ["airport_cdg|airport_ivl"]
  },
  "KL": { "direct_routes": [...], "seasonal_routes": [...] }
}
```

Règles que mon script de fusion applique — les respecter évite tout rejet :

- **Identifiant d'aéroport** : `airport_` + code IATA **en minuscules**. Vérifié : les 249
  aéroports de la base suivent tous ce motif, sans exception.
- **Arête non orientée**, les deux ids **triés alphabétiquement** et joints par `|`.
  `airport_ams|airport_cdg`, jamais `airport_cdg|airport_ams`.
- **Pas d'arête réflexive** (`airport_cdg|airport_cdg`) — rejetée.
- **`seasonal_routes` obligatoire**, même vide (`[]`). Une route qui n'existe qu'en été ne
  doit **pas** figurer dans `direct_routes` : c'est tout l'enjeu.
- Les deux tableaux doivent être **dédoublonnés**.

Une compagnie dont les deux tableaux sont vides est **ignorée** par la fusion (sa donnée
actuelle est conservée). Donc : ne livre pas d'entrée vide pour une compagnie non collectée
— omets-la, c'est équivalent et plus lisible.

---

## 4. Vocabulaire — aucun risque, vérifié

- **249 aéroports** dans `config.py`, **249** dans notre base, **intersection parfaite**.
  Aucune arête ne sera rejetée pour aéroport inconnu.
- **78 codes compagnie** dans `config.py`, tous présents dans notre catalogue.
- Fusions d'AOC déjà prévues : `HV → TO` (Transavia), `EC` et `DS → U2` (easyJet Europe et
  Suisse). Si tu en croises d'autres (filiales régionales), **signale-les plutôt que de les
  fusionner de ton propre chef** — la politique animaux peut différer.

---

## 5. Les trois filtres à ne pas relâcher

Ce sont eux qui font la valeur de la base, pas le volume :

1. **Métal propre** — seul le transporteur *opérant* compte. Un vol Delta opéré par
   Endeavor (9E) n'est pas une route Delta. Les codeshares sont exclus.
2. **Sans escale** — on lit des vols réels, pas des itinéraires construits.
3. **Saisonnier marqué** — échantillonner un pic d'été *et* un creux d'hiver. Une route vue
   seulement dans l'échantillon d'été va dans `seasonal_routes`.

---

## 6. Ce que je contrôlerai à la réception

Pour que tu saches d'avance ce qui sera regardé. `EXPECTED.json` (joint, 78 entrées) donne
pour chaque compagnie son nom, ses hubs, et ses compteurs actuels.

- Format et normalisation des arêtes, aéroports inconnus → doivent être à zéro.
- **Variation par compagnie** : toute compagnie qui perdrait plus de 30 % de ses routes sera
  signalée avant fusion, jamais appliquée en silence.
- **Saisonnalité non nulle** sur les 5 prioritaires — si elle ressort à 0, c'est soit un vrai
  résultat, soit un échantillonnage qui n'a pas fonctionné : dis lequel.
- Cohérence hub : une compagnie dont plus de 95 % des arêtes ne touchent aucun hub déclaré
  est suspecte.
- Fusion en `--dry` d'abord, toujours.

---

## 7. À livrer

1. **`routes_new.json`** au format du §3.
2. Le **rapport de changements** produit par `diff_baseline.py` (`changes_report.md`).
3. Une note courte sur : le plan RapidAPI utilisé, les unités consommées, les **dates
   d'échantillonnage été et hiver retenues**, et tout aéroport ou compagnie où la collecte a
   échoué ou paru douteuse.

Le point 3 compte autant que le reste : sans les dates d'échantillonnage, la saisonnalité
n'est pas interprétable.

> **Note** : `baseline_routes.json` du dépôt a été régénéré depuis la production le 29/07 —
> il contient désormais les **78** compagnies (6 504 arêtes), plus 73. Utilise cette version
> pour le diff, sinon les 5 prioritaires ressortiront comme entièrement nouvelles.
