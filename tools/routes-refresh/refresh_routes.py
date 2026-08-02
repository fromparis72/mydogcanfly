#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pipeline de rafraîchissement des routes MyDogCanFly (source : AeroDataBox).

Principe : on interroge les horaires de DÉPART de chaque aéroport du périmètre,
sur quelques jours d'été et d'hiver, en ne gardant QUE les vols OPÉRÉS (métal propre,
codeshares exclus). On en déduit, par compagnie, les arêtes sans-escale, et on
classe chaque arête année-pleine (direct_routes) vs saisonnière (seasonal_routes).

Sortie : un JSON par compagnie au format EXACT de tes lots + un fichier agrégé.
La clé RapidAPI se lit dans la variable d'environnement RAPIDAPI_KEY.

Usage :
    export RAPIDAPI_KEY="ta_cle_rapidapi"
    python refresh_routes.py --airports hubs        # test peu coûteux d'abord
    python refresh_routes.py --airports all          # balayage complet
    python refresh_routes.py --airports all --resume # reprend sans re-payer (cache)

Options utiles :
    --airports {all,hubs}   périmètre balayé (défaut: hubs)
    --max-calls N           plafond d'appels (garde-fou quota)
    --out DIR               dossier de sortie (défaut: ./output)
    --no-cache              ignore le cache disque (déconseillé)
"""
import os, sys, json, time, argparse, datetime as dt
from collections import defaultdict

try:
    import requests
except ImportError:
    sys.exit("Installe d'abord la dépendance :  pip install requests")

import config as C

CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")


# ------------------------------------------------------------------ utils
def edge(a, b):
    """Arête non ordonnée, triée, au format 'airport_x|airport_y'."""
    x, y = sorted([a.lower(), b.lower()])
    return f"airport_{x}|airport_{y}"


def windows_for(date_str):
    """Deux fenêtres de 12 h (limite AeroDataBox) pour couvrir une journée."""
    return [(f"{date_str}T00:00", f"{date_str}T11:59"),
            (f"{date_str}T12:00", f"{date_str}T23:59")]


def dest_iata(dep):
    """Aéroport de destination d'un départ. withLeg=true -> bloc 'arrival' ;
    variante sans leg -> bloc 'movement'. On essaie les deux."""
    for block in ("arrival", "movement"):
        apt = (dep.get(block) or {}).get("airport") or {}
        code = (apt.get("iata") or "").strip().upper()
        if code:
            return code
    return ""


def cache_path(iata, frm):
    safe = frm.replace(":", "").replace("-", "")
    return os.path.join(CACHE_DIR, f"{iata}_{safe}.json")


# ------------------------------------------------------------------ fetch
class Fetcher:
    def __init__(self, key, use_cache=True, max_calls=C.MAX_CALLS):
        self.key = key
        self.use_cache = use_cache
        self.max_calls = max_calls
        self.calls = 0
        os.makedirs(CACHE_DIR, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update({
            "X-RapidAPI-Key": key,
            "X-RapidAPI-Host": C.API_HOST,
        })

    def departures(self, iata, frm, to):
        """Renvoie la liste des départs OPÉRÉS (codeshares exclus). Caché sur disque."""
        cp = cache_path(iata, frm)
        if self.use_cache and os.path.exists(cp):
            with open(cp) as f:
                return json.load(f).get("departures", [])

        if self.calls >= self.max_calls:
            raise RuntimeError(f"Plafond d'appels atteint ({self.max_calls}). "
                               f"Relance avec --resume pour continuer (le cache évite de re-payer).")

        url = f"{C.API_BASE}/flights/airports/iata/{iata}/{frm}/{to}"
        params = {
            "direction": "Departure",
            "withCodeshared": "false",   # <-- clé du métal propre : seulement les vols opérés
            "withCancelled": "false",
            "withCargo": "false",
            "withPrivate": "false",
            "withLeg": "true",
            "withLocation": "false",
        }
        time.sleep(C.RATE_LIMIT_SLEEP)
        self.calls += 1
        r = self.session.get(url, params=params, timeout=C.REQUEST_TIMEOUT)
        if r.status_code == 204:
            data = {"departures": []}
        elif r.status_code == 200:
            data = r.json()
            if isinstance(data, list):        # certaines variantes renvoient une liste
                data = {"departures": data}
        else:
            # 400/404 fréquents pour un aéroport sans départs sur la fenêtre : on n'échoue pas.
            sys.stderr.write(f"  ! {iata} {frm} -> HTTP {r.status_code} ({r.text[:80]})\n")
            data = {"departures": []}
        if self.use_cache:
            with open(cp, "w") as f:
                json.dump(data, f)
        return data.get("departures", [])


# ------------------------------------------------------------------ build
def collect_season(fetcher, airports, dates, label):
    """Balaye (aéroport x dates x fenêtres) et renvoie edges[carrier]=set, cand[carrier]=set."""
    edges = defaultdict(set)      # arêtes intra-périmètre par compagnie
    cand = defaultdict(set)       # destinations hors périmètre (candidats) par compagnie
    airports = sorted(airports)
    total = len(airports) * len(dates) * 2
    step = 0
    for iata in airports:
        for d in dates:
            for frm, to in windows_for(d):
                step += 1
                sys.stderr.write(f"[{label}] {step}/{total}  {iata} {d}   (appels API: {fetcher.calls})\r")
                for dep in fetcher.departures(iata, frm, to):
                    if dep.get("isCargo"):
                        continue
                    air = (dep.get("airline") or {})
                    op = C.norm_carrier(air.get("iata"))
                    if op not in C.CARRIERS:
                        continue  # opérant hors de nos compagnies -> pas d'attribution (métal propre)
                    dest = dest_iata(dep)
                    if not dest or dest == iata:
                        continue
                    if dest in C.AIRPORTS:
                        edges[op].add(edge(iata, dest))
                    else:
                        cand[op].add(f"{dest} — desservi depuis {iata}")
    sys.stderr.write("\n")
    return edges, cand


def build(fetcher, airports):
    summer_e, summer_c = collect_season(fetcher, airports, C.SUMMER_DATES, "ÉTÉ")
    winter_e, winter_c = collect_season(fetcher, airports, C.WINTER_DATES, "HIVER")

    carriers = sorted(set(summer_e) | set(winter_e))
    out = {}
    for c in carriers:
        s = summer_e.get(c, set())
        w = winter_e.get(c, set())
        direct = sorted(s & w)                     # présent été ET hiver = année-pleine
        seasonal = sorted((s | w) - (s & w))       # une seule saison = saisonnier
        cand = sorted(summer_c.get(c, set()) | winter_c.get(c, set()))
        uncertain = []
        if len(direct) + len(seasonal) < 3:
            uncertain.append("Faible volume : compagnie possiblement sous-échantillonnée "
                             "(peu de départs captés depuis les aéroports balayés).")
        out[c] = {
            "direct_routes": direct,
            "seasonal_routes": seasonal,
            "candidate_airports": cand[:60],
            "uncertain": uncertain,
            "source_url": C.SOURCE_URL,
            "verified_date": dt.date.today().isoformat(),
            "route_count": len(direct),
        }
    return out


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description="Rafraîchit les routes MyDogCanFly via AeroDataBox.")
    ap.add_argument("--airports", choices=["all", "hubs"], default="hubs")
    ap.add_argument("--max-calls", type=int, default=C.MAX_CALLS)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "output"))
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--resume", action="store_true", help="(équivalent au cache activé)")
    args = ap.parse_args()

    key = os.environ.get("RAPIDAPI_KEY")
    if not key:
        sys.exit("Définis ta clé :  export RAPIDAPI_KEY=\"...\"  (obtenue sur RapidAPI / AeroDataBox).")

    airports = C.AIRPORTS if args.airports == "all" else C.HUBS
    print(f"Périmètre balayé : {args.airports} ({len(airports)} aéroports)  |  "
          f"été {C.SUMMER_DATES} / hiver {C.WINTER_DATES}", file=sys.stderr)

    fetcher = Fetcher(key, use_cache=not args.no_cache, max_calls=args.max_calls)
    result = build(fetcher, airports)

    os.makedirs(args.out, exist_ok=True)
    # 1) fichier agrégé
    agg = os.path.join(args.out, "routes_new.json")
    json.dump(result, open(agg, "w"), ensure_ascii=False, indent=2)
    # 2) un fichier par compagnie
    per = os.path.join(args.out, "per_carrier")
    os.makedirs(per, exist_ok=True)
    for c, o in result.items():
        json.dump({c: o}, open(os.path.join(per, f"{c}.json"), "w"), ensure_ascii=False, indent=2)

    tot = sum(o["route_count"] for o in result.values())
    print(f"\nOK. {len(result)} compagnies, {tot} arêtes directes. "
          f"Appels API consommés : {fetcher.calls}.", file=sys.stderr)
    print(f"Sortie : {agg}\n        {per}/<CODE>.json", file=sys.stderr)
    print("Étape suivante :  python diff_baseline.py", file=sys.stderr)


if __name__ == "__main__":
    main()
