#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SONDAGE DE FAISABILITÉ (coût quasi nul — quelques unités, tient dans le tier gratuit 600).

But : répondre à UNE question avant de payer quoi que ce soit —
  « Jusqu'à combien de jours dans le futur AeroDataBox renvoie-t-il des horaires ? »

De la réponse dépend la stratégie du balayage définitif :
  - si l'hiver (~160-180 j) revient  -> UNE seule salve suffit (été + hiver d'un coup).
  - si les données s'arrêtent avant   -> DEUX salves (été maintenant, hiver plus tard),
                                          chacune un mois d'abonnement, puis résiliation.

Le script interroge UN gros hub (CDG par défaut) à plusieurs horizons croissants,
sur une seule fenêtre de 12 h par horizon, et compte les vols renvoyés + les vols
OPÉRÉS (métal propre) attribuables à tes compagnies. Il termine par un verdict.

Usage :
    export RAPIDAPI_KEY="ta_cle_rapidapi_tier_gratuit"
    python test_feasibility.py               # sonde CDG
    python test_feasibility.py --iata LHR     # autre hub si tu veux recouper
"""
import os, sys, time, json, argparse, datetime as dt

try:
    import requests
except ImportError:
    sys.exit("Installe d'abord :  pip install requests")

import config as C

# Horizons sondés (jours à partir d'aujourd'hui) : court terme -> plein hiver.
OFFSETS = [3, 10, 21, 45, 75, 110, 150, 180]


def dest_iata(dep):
    """Aéroport de destination. withLeg=true -> bloc 'arrival' ; sinon -> bloc 'movement'."""
    for block in ("arrival", "movement"):
        apt = (dep.get(block) or {}).get("airport") or {}
        code = (apt.get("iata") or "").strip().upper()
        if code:
            return code
    return ""


def probe(session, iata, date_str):
    """Une fenêtre matin (00:00-11:59) pour un jour donné. Renvoie (n_total, n_operes_perimetre)."""
    frm, to = f"{date_str}T00:00", f"{date_str}T11:59"
    url = f"{C.API_BASE}/flights/airports/iata/{iata}/{frm}/{to}"
    params = {
        "direction": "Departure",
        "withCodeshared": "false",   # métal propre : uniquement les vols opérés
        "withCancelled": "false",
        "withCargo": "false",
        "withPrivate": "false",
        "withLeg": "true",
        "withLocation": "false",
    }
    time.sleep(C.RATE_LIMIT_SLEEP)
    r = session.get(url, params=params, timeout=C.REQUEST_TIMEOUT)
    if r.status_code not in (200, 204):
        return None, None, f"HTTP {r.status_code} ({r.text[:80]})"
    if r.status_code == 204:
        return 0, 0, "vide (204)"
    data = r.json()
    deps = data.get("departures", data if isinstance(data, list) else [])
    n_total = len(deps)
    n_op = 0
    for d in deps:
        op = C.norm_carrier((d.get("airline") or {}).get("iata"))
        if op not in C.CARRIERS:
            continue
        dest = dest_iata(d)
        if dest and dest != iata and dest in C.AIRPORTS:
            n_op += 1
    return n_total, n_op, "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iata", default="CDG", help="hub à sonder (défaut CDG)")
    args = ap.parse_args()

    key = os.environ.get("RAPIDAPI_KEY")
    if not key:
        sys.exit('Définis ta clé (tier gratuit suffit) :  export RAPIDAPI_KEY="..."')

    session = requests.Session()
    session.headers.update({"X-RapidAPI-Key": key, "X-RapidAPI-Host": C.API_HOST})

    today = dt.date.today()
    print(f"Sondage de {args.iata} — aujourd'hui {today.isoformat()}\n")
    print(f"{'horizon':>8} | {'date':>12} | {'vols':>5} | {'opérés∈périmètre':>16} | statut")
    print("-" * 68)

    last_ok = 0
    for off in OFFSETS:
        d = (today + dt.timedelta(days=off)).isoformat()
        n_total, n_op, status = probe(session, args.iata, d)
        shown = "-" if n_total is None else n_total
        shown_op = "-" if n_op is None else n_op
        print(f"{off:>6}j | {d:>12} | {str(shown):>5} | {str(shown_op):>16} | {status}")
        if n_total:
            last_ok = off

    print("\n" + "=" * 68)
    if last_ok >= 150:
        print("VERDICT : les horaires reviennent jusqu'à l'hiver.")
        print("-> UNE SEULE SALVE possible : été + hiver capturés en un mois d'abonnement.")
        print("   Prends le tier Ultra (~30$) un mois, lance le balayage complet, résilie.")
    elif last_ok >= 30:
        print(f"VERDICT : horaires fiables jusqu'à ~{last_ok} jours, mais PAS jusqu'à l'hiver.")
        print("-> DEUX SALVES : une salve 'été' maintenant, une salve 'hiver' cet automne/hiver.")
        print("   Chaque salve = un mois d'abonnement (~30$) puis résiliation. ~60$ au total.")
    elif last_ok > 0:
        print(f"VERDICT : horaires seulement à très court terme (~{last_ok} j).")
        print("-> Balaye chaque saison DANS la saison (dates proches), en deux salves rapprochées des pics.")
    else:
        print("VERDICT : aucun vol renvoyé — vérifie la clé, l'abonnement AeroDataBox actif, et le code IATA.")
    print("=" * 68)
    print("\n(Ce sondage ne consomme qu'une poignée d'unités : tu peux le relancer "
          "sur d'autres hubs avec --iata pour recouper.)")


if __name__ == "__main__":
    main()
