#!/usr/bin/env node
/**
 * Harnais de l'arbitrage VIRGIN AUSTRALIA (option A-bis, 28/08/2026) — la cabine n'est
 * ni interdite, ni promise.
 *
 *   npx tsx test-virgin-australia-cabine.mjs
 *
 * Le fait : « Pets in Cabin » existe (petits chiens/chats, animal + sac ≤ 8 kg) mais
 * UNIQUEMENT sur certains vols domestiques, routes et dates éligibles — un service encadré
 * comme une expérimentation. Deux mensonges symétriques étaient possibles, et chacun a son
 * contre-témoin ici :
 *   - le refus absolu (l'ancienne `rule_virgin_australia_no_cabin`) — faux depuis fin 2025 ;
 *   - l'accord universel (`availability: offered`) — faux tant que l'éligibilité dépend de
 *     la route et de la date, que le modèle ne sait pas représenter.
 * Le compromis honnête que le moteur sait déjà dire : `case_by_case` → `confirmation_required`
 * (cause `airline_approval`) — jamais « allowed », jamais « denied ».
 */
import { loadKB } from "./packages/knowledge/src/index.ts";
import { readFileSync } from "node:fs";

let defauts = 0;
const echec = (cas, detail) => { defauts++; console.error(`  ✗ ${cas} — ${detail}`); };
const ok = (cas) => console.log(`  ✓ ${cas}`);

const kb = loadKB();
const va = kb.airlines.get("airline_virgin_australia");
if (!va) { console.error("airline_virgin_australia introuvable"); process.exit(1); }

/* ---- 1. plus aucun refus cabine ABSOLU ------------------------------------------------------- */
{
  const morte = kb.rules.find((r) => r.id === "rule_virgin_australia_no_cabin");
  if (morte) echec("1 refus absolu supprimé", "rule_virgin_australia_no_cabin existe encore");
  const denyCabineVA = kb.rules.filter((r) =>
    r.scope?.type === "airline" && r.scope?.id === "airline_virgin_australia"
    && r.effect?.action === "deny" && (r.effect?.placement ?? []).includes("cabin")
    && !(r.applies_when?.all ?? []).some((c) => c.fact === "dog.weight_kg" || c.fact === "dog.brachycephalic"));
  if (denyCabineVA.length) echec("1 refus absolu supprimé",
    `une règle VA refuse encore la cabine sans condition de poids ni de race : ${denyCabineVA.map((r) => r.id).join(", ")}`);
  if (!defauts) ok("1 aucun refus cabine absolu pour Virgin Australia");
}

/* ---- 2. et pas d'accord UNIVERSEL à la place ------------------------------------------------- */
const avant2 = defauts;
{
  const cabine = va.premium?.policy?.cabin;
  if (!cabine) echec("2 pas d'accord universel", "politique cabine absente");
  else {
    if (cabine.status === "allowed" || cabine.allowed === true) echec("2 pas d'accord universel",
      "la cabine VA sort « allowed » — l'éligibilité par route/date a disparu");
    if (cabine.availability === "offered") echec("2 pas d'accord universel",
      "availability « offered » : le oui universel que l'arbitrage refuse");
  }
  if (defauts === avant2) ok("2 l'absence de modélisation des routes ne produit pas un accord cabine universel");
}

/* ---- 3. le résultat DEMANDE CONFIRMATION, avec ses conditions dans les langues rendues ------- */
const avant3 = defauts;
{
  const cabine = va.premium?.policy?.cabin ?? {};
  if (cabine.status !== "confirmation_required") echec("3 confirmation demandée",
    `status « ${cabine.status} » au lieu de « confirmation_required »`);
  if (cabine.status_cause !== "airline_approval") echec("3 confirmation demandée",
    `cause « ${cabine.status_cause} » au lieu de « airline_approval » — la confirmation vient de la compagnie, pas de nous`);
  if (cabine.max_weight_kg !== 8) echec("3 confirmation demandée", `max_weight_kg ${cabine.max_weight_kg} ≠ 8`);
  for (const lang of ["en", "fr", "es", "pt"]) {
    const c = cabine.conditions?.[lang];
    if (!c) { echec("3 confirmation demandée", `conditions manquantes en « ${lang} »`); continue; }
    if (!/8\s?kg/.test(c)) echec("3 confirmation demandée", `conditions ${lang} : le poids combiné de 8 kg n'y est pas`);
  }
  const en = cabine.conditions?.en ?? "";
  if (!/eligible/.test(en) || !/domestic/.test(en)) echec("3 confirmation demandée",
    "conditions en : l'éligibilité domestique route/date n'est pas dite");
  if (/hold otherwise|otherwise.*hold|soute sinon/i.test(en)) echec("3 confirmation demandée",
    "conditions : « soute sinon » est écrit alors que cette conséquence n'est pas établie par la politique cabine");
  if (defauts === avant3) ok("3 la cabine VA sort « confirmation_required » (airline_approval), 8 kg et conditions quadrilingues");
}

/* ---- 4. plus AUCUNE affirmation « cabine interdite » dans les contenus rendus ---------------- */
const avant4 = defauts;
{
  const INTERDITS = [
    "does not allow pets to travel in the passenger cabin",
    "Only accredited assistance dogs may travel inside the passenger cabin",
    "ne sont pas autorisés à voyager en cabine",
    "Seuls les chiens d'assistance reconnus peuvent voyager dans la cabine",
    /* les affirmations UNIVERSELLES sur des canaux legacy_unreviewed (contre-revue 28/08) :
       « voyagent via Cargo » recréait le « soute sinon » refusé, et « non accepté en soute »
       affirmait ce qu'aucune source revérifiée n'établit — tout doit rester conditionnel */
    "not accepted in the hold",
    "non accepté en soute",
    "plus nationwide cargo",
    "plus le cargo national",
    "travel in the cargo hold (pet + container",
    "voyagent en soute (animal + contenant",
  ];
  const RENDUS = [
    "packages/knowledge/raw/guides.json",
    "packages/ui/src/data/airlines.generated.json",
    "content/airlines/virgin_australia.yml",
  ];
  for (const chemin of RENDUS) {
    const texte = readFileSync(chemin, "utf-8");
    /* on ne juge que les contenus Virgin Australia : le fichier des guides porte 152 entrées */
    const portees = chemin.endsWith("guides.json")
      ? JSON.parse(texte).filter((x) => x.entity_id === "airline_virgin_australia").map((x) => x.html).join("\n")
      : chemin.endsWith("airlines.generated.json")
        ? JSON.stringify(JSON.parse(texte)["airline_virgin_australia"] ?? "")
        : texte;
    for (const motif of INTERDITS) {
      if (portees.includes(motif)) echec("4 contenus rendus", `« ${motif.slice(0, 60)}… » subsiste dans ${chemin}`);
    }
  }
  if (defauts === avant4) ok("4 aucune affirmation « cabine interdite » ne subsiste dans les contenus rendus VA");
}

if (defauts) { console.error(`\n[va-cabine] ÉCHEC — ${defauts} défaut(s)`); process.exit(1); }
console.log("\n[va-cabine] 4 contre-épreuves tenues : ni refus absolu, ni oui universel — une confirmation, avec ses conditions.");
