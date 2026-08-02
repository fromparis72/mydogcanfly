#!/usr/bin/env node
/* Détecte, pour chaque pays, l'emploi dans le corps du texte d'une forme de son propre nom
   différente du nom canonique de la langue courante — le défaut « Türkiye ».
   Trois heuristiques complémentaires, résultat présenté pour relecture humaine. */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const D = JSON.parse(readFileSync(resolve(ROOT, "packages/ui/src/data/countries.generated.json"), "utf8"));

const LANGS = ["en", "fr", "es"];
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Exonymes / endonymes connus : forme alternative -> langues où elle est inattendue dans le corps.
const VARIANTS = [
  ["Türkiye", ["en", "es", "fr"]], ["Turkiye", ["en", "es", "fr"]],
  ["Czech Republic", ["en"]], ["Czechia", ["en"]],
  ["Holland", ["en"]], ["Hollande", ["fr"]],
  ["Burma", ["en"]], ["Birmanie", ["fr"]],
  ["Ivory Coast", ["en"]],
  ["Cape Verde", ["en"]], ["Cabo Verde", ["en"]],
  ["Swaziland", ["en", "fr", "es"]], ["Eswatini", ["en", "fr", "es"]],
  ["Macedonia", ["en"]], ["Macédoine", ["fr"]],
  ["East Timor", ["en"]], ["Timor-Leste", ["en"]],
  ["Great Britain", ["en"]], ["Britain", ["en"]], ["England", ["en"]],
  ["Viet Nam", ["en", "fr", "es"]],
  ["Byelorussia", ["en"]], ["White Russia", ["en"]],
  ["Ceylon", ["en"]], ["Persia", ["en"]], ["Perse", ["fr"]],
  ["Zaire", ["en", "fr", "es"]], ["Zaïre", ["fr"]],
  ["Formosa", ["en", "fr", "es"]],
];

// Collecte tout le texte d'un pays, par langue.
function textsByLang(node, acc = { en: [], fr: [], es: [] }) {
  if (node == null) return acc;
  if (Array.isArray(node)) { node.forEach((n) => textsByLang(n, acc)); return acc; }
  if (typeof node !== "object") return acc;
  const keys = Object.keys(node);
  const isLT = LANGS.some((l) => typeof node[l] === "string");
  if (isLT) for (const l of LANGS) if (typeof node[l] === "string") acc[l].push(node[l]);
  for (const k of keys) if (!LANGS.includes(k)) textsByLang(node[k], acc);
  return acc;
}

// Tous les noms de pays connus, toutes langues — pour ne pas confondre Austria et Australia.
const ALL_NAMES = new Set();
for (const c of Object.values(D)) for (const l of LANGS) if (c.name?.[l]) ALL_NAMES.add(norm(c.name[l]));

// Suffixes de gentilés (en/fr/es) : Albanian, Belgian, Burkinabè, Bangladeshi, Turco…
const DEMONYM = /^(an|ian|ean|ese|ish|i|is|er|ic|ais|aise|ien|ienne|ois|oise|ain|aine|in|ine|que|es|és|esa|ano|ana|eno|ena|o|a|c|co|ca|ka|sh|be|be$)$/i;

const findings = [];

for (const [id, c] of Object.entries(D)) {
  const names = { en: c.name?.en, fr: c.name?.fr, es: c.name?.es };
  if (!names.en) continue;
  // On exclut le champ name lui-même du corps analysé.
  const body = textsByLang({ ...c, name: undefined });

  for (const lang of LANGS) {
    const canon = names[lang];
    if (!canon) continue;
    const text = body[lang].join("  ");
    if (!text) continue;

    // A) fuite d'une autre langue : le nom d'une AUTRE langue apparaît dans ce texte
    for (const other of LANGS) {
      if (other === lang) continue;
      const on = names[other];
      if (!on || norm(on) === norm(canon)) continue;
      const re = new RegExp("(?<![\\p{L}])" + on.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}])", "u");
      if (re.test(text) && !new RegExp("\\(" + on.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(text)) {
        findings.push({ id, lang, kind: "nom d'une autre langue", found: on, canon, sample: sample(text, on) });
      }
    }

    // B) variante connue
    for (const [v, langs] of VARIANTS) {
      if (!langs.includes(lang)) continue;
      if (norm(v) === norm(canon)) continue;
      if (new RegExp("(?<![\\p{L}])" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}])", "u").test(text)) {
        // toléré si présenté explicitement entre parenthèses (mention officielle)
        if (new RegExp("\\((?:officially|oficialmente|officiellement)\\s+" + v, "i").test(text)) continue;
        findings.push({ id, lang, kind: "variante/exonyme", found: v, canon, sample: sample(text, v) });
      }
    }

    // C) quasi-variante : mot capitalisé proche du nom canonique, hors formes légitimes.
    // Sont écartés : les possessifs, les formes courtes (sous-chaîne du nom), les gentilés,
    // et les noms d'autres pays (« Australia » ressemble à « Austria » par le préfixe).
    const pfx = norm(canon).slice(0, 4);
    if (pfx.length === 4) {
      for (const m of new Set(text.match(/\p{Lu}[\p{L}'’]{3,}/gu) || [])) {
        const nm = norm(m), nc = norm(canon);
        if (nm === nc) continue;
        if (nm.slice(0, 4) !== pfx) continue;
        if (Object.values(names).some((n) => n && norm(n) === nm)) continue;
        if (/['’]s$/.test(m)) continue;                       // possessif anglais
        if (nc.includes(nm) || nm.includes(nc)) continue;      // forme courte ou allongée
        if (ALL_NAMES.has(nm)) continue;                       // nom d'un autre pays
        if (DEMONYM.test(nm.slice(pfx.length))) continue;      // gentilé (suffixe)
        findings.push({ id, lang, kind: "quasi-variante", found: m, canon, sample: sample(text, m) });
      }
    }
  }
}

function sample(text, needle) {
  const i = text.indexOf(needle);
  if (i < 0) return "";
  return "…" + text.slice(Math.max(0, i - 45), i + needle.length + 45).replace(//g, "|") + "…";
}

// Dédoublonnage
const seen = new Set();
const uniq = findings.filter((f) => {
  const k = f.id + f.lang + f.kind + f.found;
  if (seen.has(k)) return false;
  seen.add(k); return true;
});

console.log(`${Object.keys(D).length} pays analysés — ${uniq.length} signalement(s)\n`);
const byKind = {};
uniq.forEach((f) => (byKind[f.kind] ||= []).push(f));
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`### ${kind} (${list.length})`);
  for (const f of list) console.log(`  [${f.lang}] ${f.id.replace("country_", "")} : « ${f.found} » au lieu de « ${f.canon} »\n      ${f.sample}`);
  console.log("");
}
if (!uniq.length) console.log("Aucune incohérence détectée.");
