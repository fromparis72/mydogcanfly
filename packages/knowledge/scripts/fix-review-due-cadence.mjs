#!/usr/bin/env node
/* Bug corrigé (audit du 09/08/2026, tâche 25) : `review_due` doit toujours être dérivé de
 * `verified_date + REVIEW_CADENCE_DAYS[domain]` (ADR-0007, common.ts) — jamais tapé à la main. 52
 * règles avaient une valeur qui ne correspond PAS à cette formule pour leur propre domaine :
 *   - 44 règles pays (`scope.type === "country"`, catégorie `import_rules`) avaient une échéance
 *     calculée à 90 jours (cadence "airline"/"route") au lieu des 180 jours de la cadence "country".
 *   - 6 règles d'interdiction de race au niveau pays (`country` + `breed_ban`) avaient une échéance
 *     à 365 jours (cadence "breed") au lieu des 180 jours de la cadence "country" — la race de la
 *     règle n'est pas la raison de relecture, le PAYS l'est.
 *   - 2 règles globales (`global` + `breed_ban`, `global` + `cabin_weight`) avaient une échéance
 *     hors cadence "global" (180 jours).
 * Conséquence pratique : ces 52 règles se seraient présentées comme "à revérifier" trop tôt (44
 * règles pays sur cadence 90j au lieu de 180j) ou trop tard (6+2 règles sur cadence 365j au lieu
 * de 180j) — un biais dans la file de relecture, jamais un contenu faux affiché au visiteur.
 *
 * Ce script ne touche NI `verified_date` NI `history` : il ne s'agit pas d'une nouvelle relecture
 * (on ne peut pas affirmer qu'une relecture a eu lieu ce jour — "aucune affirmation sans source"),
 * seulement de la correction d'un champ dérivé mal calculé à partir d'une date déjà en place.
 *
 * Idempotent : relancer sans rien avoir changé ne modifie rien (0 mismatch restant).
 *   node packages/knowledge/scripts/fix-review-due-cadence.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(HERE, "../raw/rules.json");
const dry = process.argv.includes("--dry");

// Recopié de packages/knowledge/src/common.ts (ADR-0007) — ce script ne peut pas importer le
// module TS directement (exécution en .mjs pur), donc la constante est dupliquée ici plutôt que
// réinventée : toute dérive entre les deux devra être corrigée aux deux endroits.
const REVIEW_CADENCE_DAYS = { airline: 90, country: 180, equipment: 365, breed: 365, route: 90, global: 180 };
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

const rules = JSON.parse(readFileSync(RULES, "utf8"));
let changed = 0;
const touched = [];
for (const r of rules) {
  const domain = r.scope?.type; // "country" | "airline" | "global" — les trois seuls scopes présents dans rules.json
  if (!domain || !(domain in REVIEW_CADENCE_DAYS)) continue;
  const expected = plus(r.source.verified_date, REVIEW_CADENCE_DAYS[domain]);
  if (r.source.review_due !== expected) {
    touched.push({ id: r.id, category: r.category, domain, before: r.source.review_due, after: expected });
    r.source.review_due = expected;
    changed++;
  }
}

for (const t of touched) console.log(`${t.id} (${t.domain}/${t.category}) : ${t.before} → ${t.after}`);
console.log(`${dry ? "[--dry] " : ""}${changed} règle(s) corrigée(s) sur ${rules.length}.`);
if (!dry && changed) writeFileSync(RULES, JSON.stringify(rules, null, 2) + "\n");
