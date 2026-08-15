#!/usr/bin/env bash
# T0-B2 — reproduction INTÉGRALE du dossier de mesure v2, depuis un dépôt propre.
#
#   bash mesures/t0b2/outils/reproduire.sh [dossier-de-travail]
#
# Le dépôt n'est JAMAIS modifié : la migration est appliquée dans une copie jetable créée par
# `git archive HEAD`. Les baselines figées ne sont ni lues en écriture ni écrasées.
# Prérequis : Node 22.22.2 (.nvmrc), `npm ci` déjà passé, arbre propre au SHA de la mesure.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TRAVAIL="${1:-$(mktemp -d)}"
SIM="$TRAVAIL/simulation"
OUTILS="$ROOT/mesures/t0b2/outils"

echo "dépôt      : $ROOT"
echo "SHA        : $(git -C "$ROOT" rev-parse HEAD)"
echo "node       : $(node --version)  (.nvmrc : $(cat "$ROOT/.nvmrc"))"
echo "travail    : $TRAVAIL"
echo

# --- 0. Copie jetable au contenu EXACT de HEAD, workspaces rebranchés sur la copie ----------
rm -rf "$SIM"; mkdir -p "$SIM"
git -C "$ROOT" archive HEAD | tar -x -C "$SIM"
mkdir -p "$SIM/node_modules/@mydogcanfly"
for d in "$ROOT"/node_modules/*; do
  n="$(basename "$d")"; [ "$n" = "@mydogcanfly" ] && continue
  ln -sfn "$d" "$SIM/node_modules/$n"
done
ln -sfn "$ROOT/node_modules/.bin" "$SIM/node_modules/.bin"
for p in engine knowledge ui workers; do ln -sfn "$SIM/packages/$p" "$SIM/node_modules/@mydogcanfly/$p"; done

# --- 1. Registre et bijections sur l'état AVANT ---------------------------------------------
echo "=== 1. REGISTRE ET BIJECTIONS (état AVANT) ==="
node "$OUTILS/registre.mjs" "$ROOT" "$TRAVAIL/registre-avant.json"

# --- 2. Témoin : l'instrument reproduit-il la baseline figée ? -------------------------------
echo; echo "=== 2. TÉMOIN — l'instrument est-il valide ? ==="
( cd "$SIM" && npx tsx test-t0a-baseline.mjs --write >/dev/null 2>&1 )
TEMOIN="$(sha256sum "$SIM/test-baselines/t0a-finder-baseline.json" | cut -d" " -f1)"
FIGEE="$(sha256sum "$ROOT/test-baselines/t0b-finder-baseline-avant.json" | cut -d" " -f1)"
echo "témoin : $TEMOIN"
echo "figée  : $FIGEE"
[ "$TEMOIN" = "$FIGEE" ] && echo "OK     l'instrument reproduit la baseline figée bit à bit" \
                         || { echo "ECHEC  instrument invalide"; exit 1; }

# --- 3. Candidat : la migration selon le registre approuvé -----------------------------------
echo; echo "=== 3. CANDIDAT (218 mécaniques + 83 legacy_unreviewed + 1 undocumented) ==="
git -C "$ROOT" show HEAD:packages/knowledge/raw/objects.json > "$SIM/packages/knowledge/raw/objects.json"
node "$OUTILS/candidat.mjs" "$SIM" "$TRAVAIL/registre-migration.json"

# --- 4. Idempotence : deux exécutions complètes doivent coïncider bit à bit ------------------
#
# Sortie non nulle ATTENDUE ici, et elle n'est pas ignorée : sur le candidat, la section
# historique de `test-t0a-baseline.mjs` compare l'état VIVANT à la baseline pré-T0-A et voit
# donc les écarts T0-B2 en plus des 24 cartes approuvées en T0-A. Son compte est mesuré à
# l'étape 4 bis, puis décomposé dans le dossier. C'est le défaut de conception que le patch
# corrigera (preuve T0-A rendue à des baselines FIGÉES + diff T0-B2 approuvé à part) — pas une
# preuve qu'on assouplit. `--write` écrit dans la COPIE jetable, jamais dans le dépôt.
echo; echo "=== 4. IDEMPOTENCE (deux exécutions) ==="
( cd "$SIM" && npx tsx test-t0a-baseline.mjs --write >/dev/null 2>&1 ) || true
cp "$SIM/test-baselines/t0a-finder-baseline.json" "$TRAVAIL/candidat-run1.json"
( cd "$SIM" && npx tsx test-t0a-baseline.mjs --write >/dev/null 2>&1 ) || true
cp "$SIM/test-baselines/t0a-finder-baseline.json" "$TRAVAIL/candidat-run2.json"
cmp "$TRAVAIL/candidat-run1.json" "$TRAVAIL/candidat-run2.json" \
  && echo "OK     idempotent bit à bit" || { echo "ECHEC  non idempotent"; exit 1; }
echo "empreinte candidate : $(sha256sum "$TRAVAIL/candidat-run1.json" | cut -d" " -f1)"

# --- 4 bis. Le compte d'écarts de la section historique T0-A, mesuré et non subi -------------
echo; echo "=== 4 bis. SECTION HISTORIQUE T0-A sur le candidat (échec ATTENDU, à corriger par le patch) ==="
( cd "$SIM" && npx tsx test-t0a-baseline.mjs 2>&1 || true ) | grep -E "écart\(s\)|bijection" || true

# --- 5. Diff exhaustif du contrat public ------------------------------------------------------
echo; echo "=== 5. DIFF DU CONTRAT PUBLIC ==="
node "$OUTILS/diff-baselines.mjs" "$ROOT/test-baselines/t0b-finder-baseline-avant.json" \
     "$TRAVAIL/candidat-run1.json" "$TRAVAIL/diff.json"

# --- 6. Traçabilité : chaque bascule remonte au registre --------------------------------------
echo; echo "=== 6. TRAÇABILITÉ DES BASCULES ==="
node "$OUTILS/verifier-bascules.mjs" "$TRAVAIL/diff.json" "$TRAVAIL/registre-migration.json" \
     "$ROOT/test-baselines/t0b-migration-matrice.json" "$TRAVAIL/bascules.json"

# --- 7. Couverture directe des 302, hors scénarios HTTP ---------------------------------------
echo; echo "=== 7. COUVERTURE DIRECTE (normalisation / projection) ==="
cp "$OUTILS/couverture-projection.mjs" "$SIM/couverture-projection.mjs"
( cd "$SIM" && npx tsx couverture-projection.mjs "$SIM" "$TRAVAIL/registre-migration.json" )

# --- 8. Faisabilité de la structure cible (option C) ------------------------------------------
echo; echo "=== 8. FAISABILITÉ DE L'OPTION C ==="
( cd "$ROOT" && node "$OUTILS/faisabilite-option-c.mjs" "$TRAVAIL/registre-migration.json" "$TRAVAIL/option-c.json" )

echo; echo "=== TERMINÉ — artefacts dans $TRAVAIL ==="
sha256sum "$TRAVAIL"/*.json
echo
echo "dépôt inchangé :"
git -C "$ROOT" status --porcelain || true
