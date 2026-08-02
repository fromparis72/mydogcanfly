#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compare la sortie du rafraîchissement (output/routes_new.json) à la base de
référence (baseline_routes.json) et produit un RAPPORT DES CHANGEMENTS à valider.

Important : la sortie agrégateur est du CANDIDAT, pas de la vérité. Le rapport
liste ce qui a bougé pour que tu ne revérifies à la main (sur le site officiel
de la compagnie) que ces routes-là — pas les 80 compagnies.

Usage :
    python diff_baseline.py
    python diff_baseline.py --baseline baseline_routes.json --new output/routes_new.json
"""
import os, sys, json, argparse, datetime as dt

HERE = os.path.dirname(__file__)


def load(path):
    with open(path) as f:
        return json.load(f)


def sets(entry):
    d = set(entry.get("direct_routes", []))
    s = set(entry.get("seasonal_routes", []))
    return d, s


def diff_carrier(base, new):
    bd, bs = sets(base) if base else (set(), set())
    nd, ns = sets(new) if new else (set(), set())
    b_all, n_all = bd | bs, nd | ns
    return {
        "added_direct":     sorted(nd - b_all),          # nouvelle route directe, inconnue avant
        "removed":          sorted(b_all - n_all),        # route de la base plus vue du tout
        "became_seasonal":  sorted(bd & ns),              # était année-pleine -> devient saisonnier
        "became_yearround": sorted(bs & nd),              # était saisonnier -> devient année-pleine
        "added_seasonal":   sorted(ns - b_all),           # nouvelle route saisonnière
    }


def n_changes(d):
    return sum(len(v) for v in d.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", default=os.path.join(HERE, "baseline_routes.json"))
    ap.add_argument("--new", default=os.path.join(HERE, "output", "routes_new.json"))
    ap.add_argument("--out", default=os.path.join(HERE, "output"))
    args = ap.parse_args()

    base = load(args.baseline)
    new = load(args.new)
    os.makedirs(args.out, exist_ok=True)

    report = {}
    for c in sorted(set(base) | set(new)):
        # Une compagnie présente dans la base mais ABSENTE du balayage n'est pas
        # "toute supprimée" : elle n'a simplement pas été couverte -> voir not_scanned.
        if c in base and c not in new:
            continue
        d = diff_carrier(base.get(c), new.get(c))
        if n_changes(d):
            report[c] = d

    # compagnies de la base non couvertes par ce balayage (à ne pas prendre pour des suppressions)
    not_scanned = sorted(set(base) - set(new))
    new_carriers = sorted(set(new) - set(base))

    # --- JSON ---
    out_json = {
        "generated": dt.datetime.utcnow().isoformat() + "Z",
        "carriers_with_changes": report,
        "carriers_not_in_scan": not_scanned,
        "carriers_new": new_carriers,
    }
    json.dump(out_json, open(os.path.join(args.out, "changes_report.json"), "w"),
              ensure_ascii=False, indent=2)

    # --- Markdown lisible ---
    lines = [f"# Rapport de changements — {dt.date.today().isoformat()}", ""]
    lines.append("> Chaque route listée est un **candidat à valider** contre le site officiel "
                 "de la compagnie avant application. L'agrégateur est plus bruité que la source "
                 "officielle : on ne re-vérifie QUE ce qui a bougé.")
    lines.append("")
    total = sum(n_changes(v) for v in report.values())
    lines.append(f"**{len(report)} compagnies avec changements — {total} routes à examiner.**")
    lines.append("")
    LABELS = {
        "added_direct":     "🟢 Nouvelles routes directes (année-pleine)",
        "added_seasonal":   "🟢 Nouvelles routes saisonnières",
        "removed":          "🔴 Routes disparues (plus vues)",
        "became_seasonal":  "🟠 Passées année-pleine → saisonnier",
        "became_yearround": "🔵 Passées saisonnier → année-pleine",
    }
    for c in sorted(report, key=lambda k: -n_changes(report[k])):
        lines.append(f"## {c}  ({n_changes(report[c])} changements)")
        for k, lab in LABELS.items():
            v = report[c].get(k, [])
            if v:
                lines.append(f"- **{lab}** : {', '.join(v)}")
        lines.append("")
    if not_scanned:
        lines.append("## ⚪ Compagnies non couvertes par ce balayage (PAS des suppressions)")
        lines.append(", ".join(not_scanned))
        lines.append("")
    if new_carriers:
        lines.append("## Compagnies vues mais absentes de la base")
        lines.append(", ".join(new_carriers))
        lines.append("")
    open(os.path.join(args.out, "changes_report.md"), "w").write("\n".join(lines))

    print(f"{len(report)} compagnies avec changements, {total} routes à valider.", file=sys.stderr)
    print(f"Rapport : {os.path.join(args.out, 'changes_report.md')}", file=sys.stderr)
    print(f"         {os.path.join(args.out, 'changes_report.json')}", file=sys.stderr)
    if not_scanned:
        print(f"(Info : {len(not_scanned)} compagnies non balayées ce mois — élargis --airports "
              f"ou les dates si tu veux les couvrir.)", file=sys.stderr)


if __name__ == "__main__":
    main()
