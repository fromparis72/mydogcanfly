#!/usr/bin/env bash
# T0-B2 — reproduction INTÉGRALE et vérifiée du dossier de mesure, depuis un dépôt propre.
#
#   bash mesures/t0b2/outils/reproduire.sh [dossier-de-travail]
#
# Le dépôt n'est JAMAIS modifié : la migration est appliquée dans une copie jetable créée par
# `git archive HEAD`. L'état du dépôt est capturé au début et RE-COMPARÉ à la fin — un runner qui
# se contente d'afficher `git status` ne garantit rien.
#
# Toute étape qui échoue arrête le script. Les valeurs attendues sont EXIGÉES, jamais seulement
# affichées : une sortie qui « annonce » un écart mais rend 0 est un faux vert.
#
# Prérequis : Node 22.22.2 (.nvmrc), `npm ci` déjà passé.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TRAVAIL="${1:-$(mktemp -d)}"
SIM="$TRAVAIL/simulation"
OUTILS="$ROOT/mesures/t0b2/outils"
ANNEXES="$ROOT/mesures/t0b2"
BASELINE_SIM="$SIM/test-baselines/t0a-finder-baseline.json"

# Valeurs EXIGÉES (mesure v2, validée en contre-revue le 15/08/2026).
readonly EMPREINTE_TEMOIN="bc10c594831b662933dcba7835dfe78872ebfb4dd5a884e2faaaf6256045b7bb"
readonly EMPREINTE_CANDIDAT="5dad5396527c94bcb1a0fc2bb2c79b94052c26ca32d92fb47cfecd43a205d2e7"
readonly ECARTS_HISTORIQUES_ATTENDUS=1530

# Synthèses et codes de sortie EXIGÉS du harnais figé `test-t0a-baseline.mjs`, mesurés sur ses
# quatre variantes. `--write` GÉNÈRE (et saute les 3 contrôles de comparaison à la baseline) ;
# sans `--write`, le harnais CONTRÔLE les 10. Les deux phases sont dissociées ci-dessous pour que
# la génération ne serve jamais d'alibi au contrôle, ni l'inverse.
readonly TEMOIN_GENERATION="7 OK, 0 FAIL";   readonly TEMOIN_GENERATION_CODE=0;   readonly TEMOIN_GENERATION_FAILS=0
readonly TEMOIN_CONTROLE="10 OK, 0 FAIL";    readonly TEMOIN_CONTROLE_CODE=0;     readonly TEMOIN_CONTROLE_FAILS=0
readonly CANDIDAT_GENERATION="6 OK, 1 FAIL"; readonly CANDIDAT_GENERATION_CODE=1; readonly CANDIDAT_GENERATION_FAILS=1
readonly CANDIDAT_CONTROLE="9 OK, 1 FAIL";   readonly CANDIDAT_CONTROLE_CODE=1;   readonly CANDIDAT_CONTROLE_FAILS=1
# L'unique échec toléré, et lui seul. Toute autre ligne FAIL arrête le runner.
readonly FAIL_TOLERE="aucune différence métier hors les 24 cartes approuvées, à leurs valeurs EXACTES (bijection)"

sha() { sha256sum "$1" | cut -d" " -f1; }
echec() { echo "ECHEC  $*" >&2; exit 1; }

# Exécute le harnais et EXIGE son code de sortie, sa synthèse et l'identité de ses échecs.
#
# Le code de sortie ne peut plus être avalé : un harnais qui écrit la bonne baseline puis signale
# une panne SUPPLÉMENTAIRE doit arrêter la reproduction. La synthèse `N OK, M FAIL` est comparée
# telle quelle — un contrôle en plus ou en moins la change — et lorsqu'un échec est attendu, c'est
# son LIBELLÉ qui est vérifié, pas seulement son nombre.
#
#   harnais <libellé> <code attendu> <synthèse attendue> <échecs attendus> <journal> [args…]
harnais() {
  local libelle="$1" code_attendu="$2" synthese_attendue="$3" fails_attendus="$4" journal="$5"
  shift 5
  local code=0
  ( cd "$SIM" && npx tsx test-t0a-baseline.mjs "$@" ) > "$journal" 2>&1 || code=$?

  [ "$code" -eq "$code_attendu" ] \
    || echec "$libelle : code de sortie $code (attendu $code_attendu) — voir $journal"

  local synthese; synthese="$(grep -oE '^[0-9]+ OK, [0-9]+ FAIL$' "$journal" | tail -1 || true)"
  [ -n "$synthese" ] || echec "$libelle : aucune synthèse produite — le harnais n'est pas allé au bout"
  [ "$synthese" = "$synthese_attendue" ] \
    || echec "$libelle : synthèse « $synthese » (attendue « $synthese_attendue »)"

  local fails; fails="$(grep -cE '^[[:space:]]*FAIL ' "$journal" || true)"
  [ "$fails" -eq "$fails_attendus" ] \
    || echec "$libelle : $fails ligne(s) FAIL (attendu $fails_attendus)"

  if [ "$fails_attendus" -eq 1 ]; then
    grep -qF "FAIL $FAIL_TOLERE" "$journal" \
      || echec "$libelle : l'échec observé n'est PAS la bijection historique — panne supplémentaire du harnais"
    local ecarts; ecarts="$(grep -oE '[0-9]+ écart\(s\)' "$journal" | head -1 | grep -oE '^[0-9]+' || true)"
    [ "${ecarts:-0}" -eq "$ECARTS_HISTORIQUES_ATTENDUS" ] \
      || echec "$libelle : ${ecarts:-<aucun>} écart(s) historiques (attendu $ECARTS_HISTORIQUES_ATTENDUS)"
  fi
  echo "OK     $libelle — code $code, « $synthese »$([ "$fails_attendus" -eq 1 ] && echo ", échec unique = bijection historique ($ECARTS_HISTORIQUES_ATTENDUS écarts)" || true)"
}

echo "dépôt      : $ROOT"
echo "SHA        : $(git -C "$ROOT" rev-parse HEAD)"
echo "node       : $(node --version)  (.nvmrc : $(cat "$ROOT/.nvmrc"))"
echo "travail    : $TRAVAIL"
echo

# --- État initial du dépôt, pour la garde finale ---------------------------------------------
ETAT_INITIAL="$TRAVAIL/etat-depot-initial.txt"
mkdir -p "$TRAVAIL"
{ git -C "$ROOT" rev-parse HEAD; git -C "$ROOT" status --porcelain; } > "$ETAT_INITIAL"

# --- 0. Copie jetable au contenu EXACT de HEAD, workspaces rebranchés sur la copie ------------
rm -rf "$SIM"; mkdir -p "$SIM"
git -C "$ROOT" archive HEAD | tar -x -C "$SIM"
mkdir -p "$SIM/node_modules/@mydogcanfly"
for d in "$ROOT"/node_modules/*; do
  n="$(basename "$d")"; [ "$n" = "@mydogcanfly" ] && continue
  ln -sfn "$d" "$SIM/node_modules/$n"
done
ln -sfn "$ROOT/node_modules/.bin" "$SIM/node_modules/.bin"
for p in engine knowledge ui workers; do ln -sfn "$SIM/packages/$p" "$SIM/node_modules/@mydogcanfly/$p"; done

# GÉNÉRATION : `--write` régénère TOUJOURS depuis zéro — la sortie est supprimée d'abord, et son
# absence après coup est une erreur. Sans cela, un plantage laisserait en place le fichier livré
# par l'archive — or il est identique bit à bit à la baseline figée, donc le témoin comme
# l'idempotence « réussiraient » sans qu'une seule mesure ait été faite.
regenerer_baseline() {
  local libelle="$1" code="$2" synthese="$3" fails="$4" journal="$5"
  rm -f "$BASELINE_SIM"
  harnais "$libelle" "$code" "$synthese" "$fails" "$journal" --write
  [ -f "$BASELINE_SIM" ] || echec "$libelle : la baseline n'a pas été écrite"
}

# --- 1. Registre et bijections sur l'état AVANT (sortie non nulle si anomalie) -----------------
echo "=== 1. REGISTRE ET BIJECTIONS (état AVANT) ==="
node "$OUTILS/registre.mjs" "$ROOT" "$TRAVAIL/registre-avant-bijections.json"

# --- 2. Témoin : l'instrument reproduit-il la baseline figée ? ---------------------------------
echo; echo "=== 2. TÉMOIN — l'instrument est-il valide ? ==="
regenerer_baseline "témoin · génération" "$TEMOIN_GENERATION_CODE" "$TEMOIN_GENERATION" \
  "$TEMOIN_GENERATION_FAILS" "$TRAVAIL/harnais-temoin-generation.txt"
harnais "témoin · contrôle complet" "$TEMOIN_CONTROLE_CODE" "$TEMOIN_CONTROLE" \
  "$TEMOIN_CONTROLE_FAILS" "$TRAVAIL/harnais-temoin-controle.txt"
TEMOIN="$(sha "$BASELINE_SIM")"
echo "témoin attendu : $EMPREINTE_TEMOIN"
echo "témoin obtenu  : $TEMOIN"
[ "$TEMOIN" = "$EMPREINTE_TEMOIN" ] || echec "instrument invalide — la baseline figée n'est pas reproduite"
[ "$TEMOIN" = "$(sha "$ROOT/test-baselines/t0b-finder-baseline-avant.json")" ] \
  || echec "la baseline figée du dépôt a changé"
echo "OK     l'instrument reproduit la baseline figée bit à bit"

# --- 3. Candidat : la migration selon le registre approuvé -------------------------------------
echo; echo "=== 3. CANDIDAT (218 mécaniques + 83 legacy_unreviewed + 1 undocumented) ==="
git -C "$ROOT" show HEAD:packages/knowledge/raw/objects.json > "$SIM/packages/knowledge/raw/objects.json"
node "$OUTILS/candidat.mjs" "$SIM" "$TRAVAIL/registre-migration-302.json"

# --- 4. Idempotence : deux régénérations COMPLÈTES, chacune repartie de zéro --------------------
echo; echo "=== 4. IDEMPOTENCE (deux régénérations effectives) ==="
regenerer_baseline "candidat · génération 1" "$CANDIDAT_GENERATION_CODE" "$CANDIDAT_GENERATION" \
  "$CANDIDAT_GENERATION_FAILS" "$TRAVAIL/harnais-candidat-generation-1.txt"
cp "$BASELINE_SIM" "$TRAVAIL/baseline-candidate-prevision.json"
regenerer_baseline "candidat · génération 2" "$CANDIDAT_GENERATION_CODE" "$CANDIDAT_GENERATION" \
  "$CANDIDAT_GENERATION_FAILS" "$TRAVAIL/harnais-candidat-generation-2.txt"
cp "$BASELINE_SIM" "$TRAVAIL/candidat-run2.json"
cmp "$TRAVAIL/baseline-candidate-prevision.json" "$TRAVAIL/candidat-run2.json" \
  || echec "non idempotent — deux exécutions divergent"
CANDIDAT="$(sha "$TRAVAIL/baseline-candidate-prevision.json")"
echo "candidat attendu : $EMPREINTE_CANDIDAT"
echo "candidat obtenu  : $CANDIDAT"
[ "$CANDIDAT" = "$EMPREINTE_CANDIDAT" ] || echec "empreinte candidate inattendue"
echo "OK     idempotent bit à bit, à l'empreinte attendue"

# --- 4 bis. Contrôle complet sur le candidat : un seul échec, et c'est celui-là -----------------
# Échec ATTENDU : sur le candidat, la section historique compare l'état VIVANT à la baseline
# pré-T0-A. C'est le défaut de conception que le patch corrigera (preuve rendue à des baselines
# FIGÉES + diff T0-B2 approuvé à part) — pas une preuve qu'on assouplit. Il est donc encadré au
# plus près : code de sortie, synthèse exacte, échec UNIQUE, libellé de cet échec, et total exact.
# Une panne supplémentaire du harnais ne peut plus se cacher derrière l'échec attendu.
echo; echo "=== 4 bis. CONTRÔLE COMPLET SUR LE CANDIDAT (échec unique attendu) ==="
harnais "candidat · contrôle complet" "$CANDIDAT_CONTROLE_CODE" "$CANDIDAT_CONTROLE" \
  "$CANDIDAT_CONTROLE_FAILS" "$TRAVAIL/harnais-candidat-controle.txt"

# --- 5. Diff exhaustif du contrat public --------------------------------------------------------
echo; echo "=== 5. DIFF DU CONTRAT PUBLIC ==="
node "$OUTILS/diff-baselines.mjs" "$ROOT/test-baselines/t0b-finder-baseline-avant.json" \
     "$TRAVAIL/baseline-candidate-prevision.json" "$TRAVAIL/diff-avant-apres.json"

# --- 6. Traçabilité : chaque bascule remonte au registre ------------------------------------------
echo; echo "=== 6. TRAÇABILITÉ DES BASCULES ==="
node "$OUTILS/verifier-bascules.mjs" "$TRAVAIL/diff-avant-apres.json" "$TRAVAIL/registre-migration-302.json" \
     "$ROOT/test-baselines/t0b-migration-matrice.json" "$TRAVAIL/verification-bascules.json"

# --- 7. Couverture directe des 302, hors scénarios HTTP -------------------------------------------
echo; echo "=== 7. COUVERTURE DIRECTE (normalisation / projection) ==="
cp "$OUTILS/couverture-projection.mjs" "$SIM/couverture-projection.mjs"
( cd "$SIM" && npx tsx couverture-projection.mjs "$SIM" "$TRAVAIL/registre-migration-302.json" )

# --- 8. Faisabilité de la structure cible (option C) ----------------------------------------------
echo; echo "=== 8. FAISABILITÉ DE L'OPTION C ==="
node "$OUTILS/faisabilite-option-c.mjs" "$ROOT" "$TRAVAIL/registre-migration-302.json" "$TRAVAIL/faisabilite-option-c.json"

# --- 9. Les artefacts régénérés doivent être IDENTIQUES aux annexes publiées ------------------------
echo; echo "=== 9. IDENTITÉ AVEC LES ANNEXES PUBLIÉES ==="
ECART_ANNEXE=0
for f in registre-avant-bijections.json registre-migration-302.json diff-avant-apres.json \
         verification-bascules.json faisabilite-option-c.json baseline-candidate-prevision.json; do
  if [ ! -f "$ANNEXES/$f" ]; then echo "ABSENTE  $f (annexe non publiée)"; ECART_ANNEXE=1; continue; fi
  a="$(sha "$TRAVAIL/$f")"; b="$(sha "$ANNEXES/$f")"
  if [ "$a" = "$b" ]; then echo "OK       $f  $a"
  else echo "DIFFÈRE  $f"; echo "         régénérée : $a"; echo "         publiée   : $b"; ECART_ANNEXE=1; fi
done
[ "$ECART_ANNEXE" -eq 0 ] || echec "les artefacts régénérés ne coïncident pas avec les annexes publiées"

# --- 10. Le dépôt doit être dans son état INITIAL ---------------------------------------------------
echo; echo "=== 10. INTÉGRITÉ DU DÉPÔT ==="
ETAT_FINAL="$TRAVAIL/etat-depot-final.txt"
{ git -C "$ROOT" rev-parse HEAD; git -C "$ROOT" status --porcelain; } > "$ETAT_FINAL"
if diff -u "$ETAT_INITIAL" "$ETAT_FINAL"; then
  echo "OK     le dépôt est strictement dans son état initial"
else
  echec "le dépôt a été modifié pendant la reproduction"
fi

echo; echo "=== REPRODUCTION RÉUSSIE — artefacts dans $TRAVAIL ==="
