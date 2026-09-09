# Relecture de la production — 2026-09-09

- **Date-heure UTC de la mesure** : 2026-09-09T06:26:57Z (test réseau), compte rendu écrit à 2026-09-09T06:27:52Z
- **SHA de `main` lu par `git rev-parse HEAD`** : `8d24c447ad7f3dc8935c1a92207cadc811cf9a9a` (branche `main`)
- **Résultat du test réseau** : **FERMÉ**. Le proxy de sortie de la session refuse le tunnel CONNECT vers `mydogcanfly.com:443` (403, politique d'organisation). Conformément à la consigne, la relecture s'arrête là : **aucun des sept contrôles n'a pu être exécuté**.

## 0. Test réseau (commande imposée)

Commande :

```
curl -sS -o /dev/null -w "%{http_code}\n" --max-time 20 https://mydogcanfly.com/robots.txt
```

Sortie brute :

```
curl: (56) CONNECT tunnel failed, response 403
000

[agent-proxy] While this command ran, 1 connection through the agent proxy failed:
- mydogcanfly.com:443 — connect_rejected (the egress proxy denied the CONNECT (organization policy) or could not reach the destination)
```

État du proxy (`curl -sS "$HTTPS_PROXY/__agentproxy/status"`, extrait) :

```
"recentRelayFailures": [
  {
    "ts": "2026-09-09T06:26:57.314Z",
    "kind": "connect_rejected",
    "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
    "host": "mydogcanfly.com:443"
  }
]
```

Caractérisation du blocage (hors consigne, uniquement pour aider la session principale à décider) :

```
https://www.lufthansa.com/ -> 000
https://www.airfrance.fr/  -> 000
https://api.github.com/    -> 200
```

Lecture : ce n'est pas un incident du site `mydogcanfly.com` mais la politique réseau de l'environnement de cette session. Seuls les hôtes explicitement autorisés (GitHub, registres de paquets) passent. Ni la production, ni les pages officielles des compagnies ne sont joignables d'ici. Le code 000 renvoyé par curl signifie « aucune réponse HTTP », il ne dit **rien** sur l'état réel de la production.

## 1. `GET /v1/health` (attendu : `sha` commençant par `8d24c447`, `worker_version_id`)

Non exécuté (réseau fermé). **Non vérifiable.**

## 2. Codes HTTP des pages et redirections

Non exécuté (réseau fermé). **Non vérifiable** pour les dix adresses (`/`, `/fr/`, `/es/`, `/pt/`, `/airlines/air-france/`, `/fr/countries/fr/`, `/tools/destinations/`, `/fr/tools/crate/`, le 301 de `/tools/iata-dog-crate-calculator/`, le 404 voulu de `/tools/is-it-too-hot-for-my-dog/`).

## 3. `robots.txt`, `sitemap.xml`, absence de `noindex`

Non exécuté (réseau fermé). **Non vérifiable.**

## 4. Finder réel via `POST /v1/finder` (CDG → ATH, Golden Retriever 32 kg, 2027-01-15, fr/en/es/pt)

Non exécuté (réseau fermé). **Non vérifiable.** Ni les verdicts Aegean / Air France / easyJet, ni l'absence de canal `allowed`, ni le changement de langue des libellés n'ont été observés.

## 5. Addis-Abeba dans l'outil Destinations

Non exécuté (réseau fermé). **Non vérifiable.**

## 6. Échantillon des citations face aux pages officielles (8 compagnies)

Non exécuté. Les pages officielles (`lufthansa.com`, `airfrance.fr`, etc.) renvoient elles aussi 000 depuis cette session. **Non vérifiable d'ici** : aucune conclusion, ni positive ni négative, sur l'exactitude des citations.

Seule observation locale, sans accès réseau : `grep -l "PREUVE IMPORTÉE" content/airlines/*.yml | wc -l` donne **27** fichiers portant au moins un bloc `# PREUVE IMPORTÉE` sur le commit `8d24c447`. Ceci ne vérifie rien face aux pages officielles.

## 7. Comparaison fiche en ligne / fichier `content/airlines/<slug>.yml`

Non exécuté (réseau fermé). **Non vérifiable.**

## Tableau final

| # | Contrôle | Résultat |
|---|----------|----------|
| 0 | Test réseau `robots.txt` | **Non conforme à l'attente** (000, CONNECT 403 du proxy) — cause : politique réseau de la session, pas le site |
| 1 | `/v1/health` sha `8d24c447` + `worker_version_id` | Non vérifiable |
| 2 | Codes HTTP (8 × 200, 1 × 301, 1 × 404) | Non vérifiable |
| 3 | `robots.txt` / `sitemap.xml` / `noindex` | Non vérifiable |
| 4 | Finder CDG→ATH 32 kg, 4 locales, aucun `allowed` | Non vérifiable |
| 5 | Addis-Abeba dans Destinations | Non vérifiable |
| 6 | Citations vs pages officielles (8 compagnies) | Non vérifiable d'ici |
| 7 | Fiche en ligne vs `.yml` (8 compagnies) | Non vérifiable |

## Ce que je n'ai PAS pu vérifier, et pourquoi

- **Tout ce qui touche la production** (contrôles 1 à 5 et 7) : le proxy de sortie de cette session refuse le CONNECT vers `mydogcanfly.com:443` avec un 403 « organization policy ». Aucune requête HTTP n'a atteint le site ; on ne sait donc pas d'ici si la production sert bien `8d24c447`, si les redirections sont en place, ni ce que renvoie le Finder.
- **Les pages officielles des compagnies** (contrôle 6) : même blocage (000 sur `lufthansa.com` et `airfrance.fr`). Aucune citation n'a pu être confrontée à sa source. Il serait faux d'en déduire quoi que ce soit sur leur exactitude.
- **Ce qui a été fait localement** : lecture du SHA de `main`, comptage des fichiers portant `# PREUVE IMPORTÉE`. Aucune modification de code ou de données, aucune fusion, aucun déploiement, aucune soumission.

Pour refaire cette relecture, il faut une session dont l'environnement autorise la sortie vers `mydogcanfly.com` et vers les domaines des compagnies (voir la politique réseau de l'environnement dans https://code.claude.com/docs/en/claude-code-on-the-web), ou l'exécuter depuis un poste avec accès Internet direct.
