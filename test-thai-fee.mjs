#!/usr/bin/env node
/**
 * Micro-lot tarif Thai, v2 (14/08/2026) — le faux « $115–170 » ne doit jamais revenir.
 *
 * Contexte : `airline_thai_airways.fees.hold` portait `$115–170` (source mydogcanfly.com),
 * alors que la grille officielle de la page AVIH publie, au 02/03/2026 : 1 500 THB en
 * domestique, USD 320 (total ≤ 32 kg) et USD 540 (32–70 kg) à l'international. Une chaîne
 * globale ne sait représenter ni la route, ni la monnaie, ni la tranche de poids total, ni la
 * date d'effet : le montant faux est SUPPRIMÉ, sans remplacement, jusqu'au contrat
 * `fee_schedule` (lot T4). Un montant absent est préférable à un montant faux.
 *
 * v2 (contre-revue du 14/08) : l'assertion HTTP est STRICTE (`fee === undefined`, plus de
 * disjonction avec `fee_quote_only` qui laissait passer un montant) ; le contrôle brut vise le
 * champ réellement arbitré (`fees.hold`) au lieu d'interdire pour toujours tout futur tarif
 * correctement modélisé. Les scans textuels restent en ceinture, pas en preuve.
 *
 * NOTE (hors périmètre, consigné) : le même montant subsiste dans l'ancien pipeline Hugo
 * (`content/posts/thai-airways-dog-policy.md`, ×3 ; `data/compagnies.json`, plage [100, 150]).
 * Ce lot corrige le Finder V2 ; l'héritage Hugo est un lot séparé.
 *
 *   tsx test-thai-fee.mjs   (inclus dans `npm run test:unit`)
 */
import { readFileSync } from "node:fs";
import worker from "./packages/workers/src/index.ts";

let pass = 0;
let fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         reçu : ${detail}`));
  cond ? pass++ : fail++;
};

/* ── 1. Donnée brute — le champ arbitré, pas tout l'avenir tarifaire ─────────────────────── */

const raw = readFileSync("packages/knowledge/raw/objects.json", "utf8");
const objects = JSON.parse(raw);
const thai = objects.airlines.find((a) => a.id === "airline_thai_airways");

check("airline_thai_airways existe dans objects.json", Boolean(thai));
check(
  "le tarif global de soute arbitré a disparu (fees.hold === undefined)",
  thai?.fees?.hold === undefined,
  JSON.stringify(thai?.fees),
);
/* Ceintures textuelles — complément, jamais preuve principale. */
check("« $115–170 » a disparu de TOUT objects.json", !raw.includes("$115–170"));
check("aucune variante « 115-170 » (tiret simple) non plus", !/115[-–—]170/.test(raw));

/* ── 2. Contrat HTTP réel — Finder CDG → BKK ─────────────────────────────────────────────── */

const res = await worker.fetch(
  new Request(
    "https://x/v1/finder?origin=airport_cdg&destination=airport_bkk&weight_kg=8&breed=breed_golden_retriever&placement=any&locale=en",
  ),
  {},
);
check("le Finder répond 200 sur CDG → BKK", res.status === 200, String(res.status));
const body = await res.json();
const airlines = body?.airlines ?? [];
const thaiCard = airlines.find((a) => a.airline_id === "airline_thai_airways");

check("Thai figure dans le résultat CDG → BKK", thaiCard != null, JSON.stringify(airlines.map((a) => a.airline_id)));
check(
  "la carte Thai ne porte aucun montant global (fee === undefined, strict)",
  thaiCard != null && thaiCard.fee === undefined,
  JSON.stringify({ fee: thaiCard?.fee, fee_quote_only: thaiCard?.fee_quote_only }),
);
check("« $115–170 » n'apparaît nulle part dans la carte Thai sérialisée", !JSON.stringify(thaiCard ?? {}).includes("$115–170"));
check("« $115–170 » n'apparaît nulle part dans la réponse entière", !JSON.stringify(body).includes("$115–170"));

/* ── Bilan ───────────────────────────────────────────────────────────────────────────────── */

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
