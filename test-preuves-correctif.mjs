#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU CORRECTIF D'ARBITRAGES — six questions tranchées par Codex le 09/09/2026, relayées et
 * tranchées par Philippe (mesures/preuves/correctif-arbitrages-2026-09-09).
 *
 *   npx tsx test-preuves-correctif.mjs
 *
 * Ce correctif n'est PAS un lot : il remplace six preuves de lots déjà importés (4, 6, 8) et, pour trois lignes,
 * change une DISPONIBILITÉ sur ordre — ce que l'importeur ne fait jamais seul. Ce qui est éprouvé ici :
 *   · les cinq preuves passées par l'importeur (`--lot=correctif`, clé `replace_facts`) sont dans la donnée à
 *     l'octet près ; l'ancienne preuve a disparu de la politique (elle reste dans les commentaires et l'annexe) ;
 *   · Thai fret et Air China cabine restent `offered` SUR ORDRE ; Aer Lingus soute conserve cet
 *     arbitrage dans son historique, puis le ré-arbitrage du 16/09 la ferme sur preuve ;
 *   · Bangkok Airways fret : `case_by_case` par arbitrage (le modèle ne restreint pas par route — précédent Virgin
 *     A-bis), preuve écrite à la main avec les champs du correctif, conditions quadrilingues nommant Krabi ;
 *   · règle des seuils fixée par Codex : chiffre, unité, borne ET base pesée — un plafond élimine, jamais ne
 *     confirme. DETTE NOMMÉE : le modèle n'a pas de champ pour la borne (« up to » inclut, « less than » exclut) ;
 *     Air Austral cabine (« inférieur à 8 kg », exclusif) est stockée comme un plafond inclusif : un chien de
 *     exactement 8,0 kg n'y est pas refusé alors qu'il devrait l'être. Nommé, pas corrigé (règle métier nouvelle).
 */
import { readFileSync } from "node:fs";
import { loadKB, reviewDueFrom } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const d = JSON.parse(readFileSync("mesures/preuves/correctif-arbitrages-2026-09-09/CORRECTIF_ARBITRAGES_POLITIQUES_COMPAGNIES_2026-09-09.json", "utf8"));
const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const kb = loadKB();
const politique = (id, pl) => objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl];
const projetee = (id, pl) => kb.airlines.get(id)?.premium?.policy?.[pl];
const fiche = (slug) => readFileSync(`content/airlines/${slug}.yml`, "utf8");
const JUILLET = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 6, 15) ? y : y + 1}-07-15`; })();
const decide = (o, dst, dog) => evaluate(kb, FinderRequest.parse({ origin: o, destination: dst, dog, date: JUILLET }));
const canal = (dec, id, pl) => dec.airlines.find((a) => a.airline_id === id)?.placements.find((p) => p.placement === pl);
const GOLDEN_32 = { breed_id: "breed_golden_retriever", weight_kg: 32 };

console.log("=== Six remplacements, à l'octet près ===");
{
  check("six remplacements, trois lots visés (4, 6, 8), une règle des seuils", d.replace_facts.length === 6 && new Set(d.replace_facts.map((f) => f.replaces_lot)).size === 3 && !!d.threshold_rule);
  for (const f of d.replace_facts) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = politique(f.airline_id, f.placement); const s = pol?.source ?? {}; const proj = projetee(f.airline_id, f.placement);
    if (cle === "airline_aer_lingus.hold") {
      /* MOUVEMENT NOMMÉ (16/09/2026) : la preuve du correctif disait où voyage l'animal, sans
         établir une soute accompagnée. La page officielle plus précise refuse tout animal au
         comptoir passagers ; elle remplace la preuve active et conserve celle-ci dans history. */
      check(`${cle} (remplace le lot ${f.replaces_lot}, puis ré-arbitré le 16/09) : refus passager actif, preuve du correctif conservée`,
        !!pol && pol.availability === "not_offered"
          && s.quote === "Animals presented for travel at passenger check-in won't be accepted under any circumstances."
          && s.url === "https://www.aerlingus.com/prepare/bags/travelling-with-pets/"
          && s.locator === "Travelling with Pets → How to book your pet for travel?"
          && s.verified_date === "2026-09-16" && s.review_due === reviewDueFrom("2026-09-16", "airline")
          && s.history?.some((h) => h.date === "2026-09-09" && h.note?.includes(f.url) && h.note?.includes(f.quote)),
        JSON.stringify({ attendu: f.quote, lu: s.quote, url: s.url, historique: s.history }));
    } else if (cle === "airline_china_southern.hold") {
      /* MOUVEMENTS NOMMÉS : la réponse anglophone du correctif a d'abord été
         remplacée par la règle chinoise générale le 12/09, puis cette règle par
         l'alinéa de la même page qui établit réellement le plafond de 32 kg.
         L'étape intermédiaire reste opposable dans l'historique. */
      const phrasePrecedente = "（1）作为行李运输的小动物是指家庭驯养的狗、猫、鸟或者其他玩赏宠物。南航有权决定小动物是否属于可运输的范围及其运输方式，并且有权限制每个航班的收运数量。";
      const phraseActive = "（4）旅客托运的活体动物笼体包装最大不能超过 90x60x66 厘米，最小不能小于5x15x20厘米，重量最大不得超过32公斤，应单独装笼；";
      const historique = s.history?.[0];
      check(`${cle} (remplace le lot ${f.replaces_lot}, puis relu le 12/09) : preuve nationale chiffrée active, preuve générale conservée`,
        !!pol && s.quote === phraseActive && s.url === "https://www.csair.com/mcms/mcmsNewSite/zh/cn/#/tourguide/luggageservice/pets"
          && s.locator === "section « 二、收运要求 », alinea (4)" && s.quote_language === "zh" && s.verified_date === "2026-09-12"
          && s.review_due === reviewDueFrom("2026-09-12", "airline")
          && historique?.date === "2026-09-15"
          && historique?.note?.includes(phrasePrecedente)
          && historique?.note?.includes("section 一、一般规定, alinéa (1)"),
        JSON.stringify({ attendu: phraseActive, lu: s.quote, url: s.url, historique }));
    } else {
      check(`${cle} (remplace le lot ${f.replaces_lot}) : phrase, URL, localisateur, langue, date, échéance calculée`,
        !!pol && s.quote === f.quote && s.url === f.url && s.locator === f.locator && s.quote_language === f.quote_language && s.verified_date === "2026-09-09" && s.review_due === reviewDueFrom("2026-09-09", "airline"),
        JSON.stringify({ attendu: f.quote, lu: s.quote, url: s.url }));
    }
    /* MOUVEMENT NOMMÉ (10/09/2026, annexe 37) : Bangkok fret, `case_by_case` le 09/09 → `offered` le 10/09 avec R1/R2/R3 citées ; projeté
       « sous conditions » comme les autres `offered`, l'international étant refusé par règle. */
    const attendu = cle === "airline_aer_lingus.hold" || f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
    check(`  …projeté ${attendu}${cle === "airline_bangkok_airways.cargo" ? " (offered depuis le 10/09, refus international par R1 citée)" : ""}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
  }
  check("les anciennes preuves ont disparu des politiques : « contactez Cargo » (Thai), « you can check it » seul (China Southern), fragment IndiGo, prod.bangkokair.com",
    !/contact directly to Cargo/.test(politique("airline_thai_airways", "cargo")?.source?.quote ?? "") && politique("airline_china_southern", "hold")?.source?.quote !== "you can check it"
      && politique("airline_indigo", "cargo")?.source?.quote !== "pets or animals on its aircraft" && !/prod\.bangkokair\.com/.test(politique("airline_bangkok_airways", "cargo")?.source?.url ?? ""));
}

console.log("\n=== Disponibilités changées SUR ORDRE, puis ré-arbitrage Aer Lingus ===");
{
  for (const [slug, id, pl, etait] of [["thai_airways", "airline_thai_airways", "cargo", "undocumented"], ["air_china", "airline_air_china", "cabin", "not_offered"]]) {
    check(`${id}.${pl} : \`offered\` sur arbitrage, la fiche nomme l'arbitrage et l'ancienne valeur (${etait})`,
      politique(id, pl)?.availability === "offered" && /ARBITRAGE \(Codex, 09\/09\/2026, relayé et tranché par Philippe/.test(fiche(slug)) && new RegExp(`availability: offered\\s+# ARBITRÉ.*était ${etait}`).test(fiche(slug)));
  }
  check("airline_aer_lingus.hold : le ré-arbitrage du 16/09 ferme la soute accompagnée et nomme l'ancien arbitrage",
    politique("airline_aer_lingus", "hold")?.availability === "not_offered"
      && /RÉ-ARBITRÉ \(16\/09\/2026/.test(fiche("aer_lingus"))
      && /L'arbitrage du 09\/09/.test(fiche("aer_lingus")));
  check("Thai fret : l'ancienne citation auditée du 13/08 est consignée en commentaire de la fiche, pas effacée",
    /contact directly to Cargo/.test(fiche("thai_airways")) && /13\/08\/2026/.test(fiche("thai_airways")));
  /* MOUVEMENT NOMMÉ (10/09/2026, annexe 37) : `case_by_case` → `offered`, R1/R2/R3 citées dans le même lot ; les conditions Krabi restent. */
  check("Bangkok fret : `offered` depuis le 10/09 (règles géographiques citées), conditions en quatre langues nommant les exclusions Krabi et le refus international",
    politique("airline_bangkok_airways", "cargo")?.availability === "offered" && ["en", "fr", "es", "pt"].every((l) => /Krabi/.test(politique("airline_bangkok_airways", "cargo")?.conditions?.[l] ?? "")));
}

console.log("\n=== Effets dans le Finder ===");
{
  const bkk = decide("airport_cdg", "airport_bkk", GOLDEN_32);
  check("Thai Airways fret (Paris → Bangkok), Golden 32 kg : sous conditions — le canal existe, aucune place promise", canal(bkk, "airline_thai_airways", "cargo")?.status === "accepted_with_conditions");
  const can = decide("airport_cdg", "airport_can", GOLDEN_32);
  check("China Southern soute (Paris → Canton), Golden 32 kg : sous conditions, sur la réponse officielle complète", canal(can, "airline_china_southern", "hold")?.status === "accepted_with_conditions");
  const bom = decide("airport_del", "airport_bom", GOLDEN_32);
  check("IndiGo (Delhi → Bombay) : fret refusé sur la page CarGo, cabine et soute refusées sur la politique passager — refus total prouvé maintenu", ["cabin", "hold", "cargo"].every((c) => canal(bom, "airline_indigo", c)?.status === "denied"));
  /* ERREUR NOMMÉE (réconciliation) : ce témoin lançait Air China cabine avec un Golden de 32 kg — « à confirmer » par la
     règle globale de poids, pas par la règle retirée. Le témoin vise la règle retirée : un Cavalier de 6 kg. */
  const dub = decide("airport_cdg", "airport_dub", GOLDEN_32), pek = decide("airport_cdg", "airport_pek", { breed_id: "breed_cavalier_king_charles", weight_kg: 6 });
  const al = canal(dub, "airline_aer_lingus", "hold"), ac = canal(pek, "airline_air_china", "cabin");
  /* HISTOIRE : la réconciliation du 09/09 a bien retiré les deux règles héritées. Air China reste
     sous conditions. Aer Lingus est ensuite refermée par une NOUVELLE preuve officielle le 16/09. */
  check("Air China cabine reste sous conditions ; Aer Lingus soute est refusée par la preuve plus récente du 16/09",
    al?.status === "denied" && ac?.status === "accepted_with_conditions", JSON.stringify({ al, ac }));
}

console.log("\n=== Règle des seuils de Codex, confrontée au modèle ===");
{
  check("la règle exige chiffre, unité, borne et base pesée ; un seuil élimine, jamais ne confirme",
    JSON.stringify(d.threshold_rule.required_source_fields) === JSON.stringify(["numeric_value", "unit", "comparison_operator", "weight_basis"]) && d.threshold_rule.combined_limit_logic.dog_alone_at_or_below_limit === "does_not_prove_acceptance");
  let allowed = 0; for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("le modèle respecte « jamais ne confirme » : aucune politique réelle n'est `allowed`, un chien sous le plafond reste « sous conditions »", allowed === 0, String(allowed));
  check("le modèle respecte « élimine » : Air Austral cabine, Golden 32 kg (« inférieur à 8 kg » chien + contenant) → refus sûr",
    canal(decide("airport_cdg", "airport_run", GOLDEN_32), "airline_air_austral", "cabin")?.status === "denied");
  /* HISTOIRE : la borne n'était pas modélisée (dette nommée au correctif). RÉCONCILIATION : `weight_limit_bound: lt`
     écrit depuis la phrase (« inférieur à 8 kg ») ; le moteur refuse à 8,0. Contre-épreuves complètes dans
     `test-preuves-reconciliation.mjs` (7,9 / 8 / 8,1, et la borne inclusive en miroir). */
  const huit = canal(decide("airport_cdg", "airport_run", { breed_id: "breed_pug", weight_kg: 8 }), "airline_air_austral", "cabin");
  check("borne stricte modélisée : Air Austral, chien de 8,0 kg exactement, est REFUSÉ (« inférieur à 8 kg »)", huit?.status === "denied", JSON.stringify(huit));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
