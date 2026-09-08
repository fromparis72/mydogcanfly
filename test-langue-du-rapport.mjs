/**
 * LA LANGUE DU RAPPORT — contre-épreuve du contre-test navigateur du 08/09/2026.
 *
 * Paris → New York, Golden Retriever, 30 kg, 15 octobre, page portugaise : le Finder affichait
 * « Dogs need a readable microchip, must be at least 6 months old… » — la règle d'entrée des
 * États-Unis, en anglais, au milieu d'une page portugaise. Le moteur retombait sur `rationale`
 * (anglais) quand `rationale_i18n[locale]` manquait, sans le dire : 189 règles pays sur 189 n'ont
 * pas de portugais, 149 pas d'espagnol.
 *
 * CE QUE LE RAPPORT DOIT FAIRE DÉSORMAIS. Le texte servi (`text`) est TOUJOURS dans la langue
 * demandée : la traduction quand elle existe, sinon une formulation de renvoi dans cette langue.
 * L'original non traduit voyage À PART (`text_original`, `text_original_locale`), pour être montré
 * étiqueté. En anglais et en français (401/401 traduites), rien ne change — c'est le témoin.
 *
 * Le moteur est appelé par le Worker réel, sans réseau, comme le fait le harnais local.
 *
 *   node --import tsx test-langue-du-rapport.mjs
 */
import { readFileSync } from "node:fs";
import worker from "./packages/workers/src/index.ts";

const rulesJson = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8"));
const rules = Array.isArray(rulesJson) ? rulesJson : (rulesJson.rules ?? Object.values(rulesJson).flat());
const anglais = new Set(rules.map((r) => r.rationale).filter((s) => typeof s === "string"));
const tables = Object.fromEntries(["en", "fr", "es", "pt"].map((l) => [l, JSON.parse(readFileSync(`packages/knowledge/translations/${l}/strings.json`, "utf8"))]));

let defauts = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const echec = (m, d) => { defauts++; console.log(`  ✗ ${m}${d ? ` — ${d}` : ""}`); };

async function rapport(locale, corps = {}) {
  const res = await worker.fetch(new Request("https://x/v1/finder", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin: "CDG", destination: "JFK", dog: { weight_kg: 30, breed: "golden-retriever" },
      date: "2026-10-15", travel_type: "pet", placement: "any", locale, ...corps }),
  }), {}, {});
  if (!res.ok) throw new Error(`Worker HTTP ${res.status} pour ${locale}`);
  return res.json();
}

console.log("=== La langue du rapport — CDG → JFK, Golden Retriever 30 kg, 2026-10-15 ===");

/* 1. Le cas exact de la contre-revue, et l'espagnol qui a le même trou. */
for (const locale of ["pt", "es"]) {
  const r = await rapport(locale);
  const conds = r.conditions ?? [];
  if (!conds.length) { echec(`${locale} : le rapport n'a aucune condition — la contre-épreuve ne mord sur rien`); continue; }
  const enClair = conds.filter((c) => anglais.has(c.text));
  if (enClair.length) echec(`${locale} : ${enClair.length} condition(s) servie(s) avec le texte ANGLAIS de la règle`, JSON.stringify(enClair[0].text).slice(0, 100));
  else ok(`${locale} : aucune condition ne sert le texte anglais d'une règle comme texte de la page (${conds.length} condition(s))`);
  const renvoi = tables[locale]["cond.rule_untranslated"];
  const renvoyees = conds.filter((c) => c.text === renvoi);
  if (!renvoi) echec(`${locale} : la clé cond.rule_untranslated manque dans strings.json`);
  else if (!renvoyees.length) echec(`${locale} : aucune condition ne porte la formulation de renvoi — la règle US n'a pourtant pas de ${locale}`);
  else ok(`${locale} : ${renvoyees.length} condition(s) renvoyée(s) dans la langue de la page`);
  const sansOriginal = renvoyees.filter((c) => !c.text_original || c.text_original_locale !== "en");
  if (sansOriginal.length) echec(`${locale} : ${sansOriginal.length} renvoi(s) sans original étiqueté « en »`);
  else if (renvoyees.length) ok(`${locale} : chaque renvoi transporte l'original, étiqueté « en »`);
  const originalFaux = renvoyees.filter((c) => !anglais.has(c.text_original));
  if (originalFaux.length) echec(`${locale} : ${originalFaux.length} original(aux) ne correspond(ent) à aucune règle`);
  const traduitesAvecOriginal = conds.filter((c) => c.text !== renvoi && c.text_original);
  if (traduitesAvecOriginal.length) echec(`${locale} : ${traduitesAvecOriginal.length} condition(s) traduite(s) transporte(nt) quand même un original`);
}

/* 2. LES TÉMOINS : en anglais le texte est l'anglais, sans original ; en français, la traduction. */
{
  const en = await rapport("en");
  const c = en.conditions ?? [];
  if (!c.length) echec("en : aucune condition");
  else if (!c.every((x) => anglais.has(x.text) || x.text === tables.en["cond.potential_restriction"])) echec("en : une condition ne sert pas le texte de la règle", JSON.stringify(c.find((x) => !anglais.has(x.text))?.text).slice(0, 100));
  else if (c.some((x) => x.text_original)) echec("en : un original est transporté alors que la page est en anglais");
  else ok(`en : les ${c.length} condition(s) servent le texte anglais des règles, sans original — rien n'a changé`);
  const fr = await rapport("fr");
  const cf = fr.conditions ?? [];
  const frTraduites = new Set(rules.map((r) => r.rationale_i18n?.fr).filter(Boolean));
  if (!cf.length) echec("fr : aucune condition");
  else if (cf.some((x) => x.text_original)) echec("fr : un original est transporté alors que toutes les règles ont un français");
  else if (!cf.every((x) => frTraduites.has(x.text) || x.text === tables.fr["cond.potential_restriction"])) echec("fr : une condition ne sert pas la traduction française", JSON.stringify(cf.find((x) => !frTraduites.has(x.text))?.text).slice(0, 100));
  else ok(`fr : les ${cf.length} condition(s) servent la traduction française, sans original — rien n'a changé`);
}

/* 3. NON-VACUITÉ DU RENVOI : la formulation existe dans les quatre tables et n'est pas l'anglais
      recopié — sinon un renvoi « traduit » par l'anglais passerait les contrôles ci-dessus. */
for (const l of ["fr", "es", "pt"]) {
  const s = tables[l]["cond.rule_untranslated"], o = tables[l]["cond.original_text"];
  if (!s || !o) echec(`${l} : cond.rule_untranslated ou cond.original_text manque`);
  else if (s === tables.en["cond.rule_untranslated"] || o === tables.en["cond.original_text"]) echec(`${l} : la formulation de renvoi est l'anglais recopié`);
  else ok(`${l} : formulation de renvoi et étiquette d'original présentes, distinctes de l'anglais`);
}

console.log(defauts ? `\n[langue-du-rapport] ÉCHEC — ${defauts} contre-épreuve(s) en défaut` : "\n[langue-du-rapport] le rapport ne sert jamais une règle dans une langue que la page n'a pas choisie ; l'original voyage à part, étiqueté.");
process.exit(defauts ? 1 : 0);
