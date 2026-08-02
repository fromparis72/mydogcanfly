#!/usr/bin/env node
/* Audit multilingue des fiches pays — le contrôle bâti pour le portugais, appliqué
 * rétroactivement aux langues déjà publiées.
 *
 *   node packages/knowledge/scripts/audit-country-langs.mjs [fr|es|pt…]
 *
 * Trois questions, posées à chaque traduction :
 *
 *   1. Un chiffre a-t-il disparu ? « Quarantaine minimale de 10 jours » qui devient
 *      « quarantaine minimale » n'est pas une reformulation, c'est une information perdue.
 *      C'est ainsi qu'a été repéré le « 10 » manquant dans la fiche Nouvelle-Zélande.
 *   2. La phrase est-elle coupée ? Une description qui finit par « fuera… » a été tronquée
 *      à l'écriture, pas raccourcie.
 *   3. Le budget d'affichage est-il tenu ? 65 caractères pour un titre, 165 pour une
 *      description — au-delà, Google coupe.
 *
 * Ce script lit les YAML sources, pas le site construit : il dit où corriger.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const SRC = "content/countries";
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["fr", "es", "pt"];

const canon = (tok) => {
  let t = tok.replace(/[.,](?=\d{3}(?!\d))/g, "");
  t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : tok;
};
/* L'heure : « 5:00 p.m. » en anglais, « 17h » en français comme en portugais. Deux écritures
 * correctes, des chiffres différents. On les ramène à la même horloge de 24 heures avant de
 * compter — sinon on pousse le traducteur à écrire « às 5h00 da tarde » pour faire taire le
 * contrôle, ce qui est exactement l'inverse du but. */
const clock = (s) =>
  String(s)
    .replace(/(\d{1,2}):(\d{2})\s*([ap])\.?\s?m\.?/gi, (_, h, m, ap) => {
      let H = Number(h) % 12;
      if (ap.toLowerCase() === "p") H += 12;
      return m === "00" ? String(H) : `${H}:${m}`;
    })
    .replace(/(\d{1,2})\s?h\s?(\d{2})?\b/g, (_, h, m) => (!m || m === "00" ? String(Number(h)) : `${Number(h)}:${m}`));

const NUMS = (s) =>
  (clock(s).replace(/(\d)[\s ](\d{3})(?!\d)/g, "$1$2").match(/\d+(?:[.,]\d+)*/g) ?? []).map(canon);

/** Une phrase coupée. Premier jet : on testait aussi « finit sur un mot-outil », ce qui
 *  donnait 130 fausses alertes — `\b` en JavaScript est ASCII, donc « europé|en » présente
 *  une frontière de mot et « Passeport européen » passait pour tronqué. On s'en tient à deux
 *  signes qui ne trompent pas : les points de suspension finaux, et une traduction qui perd
 *  la ponctuation finale de l'anglais. */
const looksTruncated = (v, en) => {
  const t = String(v).trim();
  if (/…$/.test(t)) return "finit par des points de suspension";
  if (/[.!?]$/.test(String(en).trim()) && !/[.!?»"”…)]$/.test(t))
    return "l'anglais finit par une ponctuation, pas la traduction";
  return null;
};

const findings = [];
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".yml") && !f.startsWith("_"))) {
  const code = file.replace(/\.yml$/, "");
  const doc = YAML.parse(readFileSync(join(SRC, file), "utf-8"));

  // Budgets d'affichage, sur les seuls champs réellement rendus en <title> / meta.
  for (const lang of LANGS) {
    const t = doc?.seo?.metaTitle?.[lang];
    const d = doc?.seo?.metaDesc?.[lang];
    if (t && t.length > 65) findings.push({ code, lang, kind: "titre trop long", detail: `${t.length} car.`, text: t });
    if (d && d.length > 165) findings.push({ code, lang, kind: "description trop longue", detail: `${d.length} car.`, text: d });
  }

  // Chiffres et troncatures, sur tous les nœuds localisés.
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (typeof o.en === "string") {
      for (const lang of LANGS) {
        const v = o[lang];
        if (typeof v !== "string" || !v.trim()) continue;
        const missing = NUMS(o.en).filter((x) => !NUMS(v).includes(x));
        if (missing.length)
          findings.push({ code, lang, kind: "chiffre perdu", detail: missing.join(", "), text: o.en.slice(0, 100) });
        const trunc = looksTruncated(v, o.en);
        if (trunc) findings.push({ code, lang, kind: "phrase coupée", detail: trunc, text: v.slice(0, 100) });
      }
      return;
    }
    for (const v of Object.values(o)) walk(v);
  })(doc);
}

const byKind = {};
for (const f of findings) (byKind[f.kind] ??= []).push(f);

console.log(`Audit multilingue — ${LANGS.join(", ")} · ${findings.length} signalement(s)\n`);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`── ${kind} : ${list.length}`);
  for (const f of list.slice(0, 40))
    console.log(`   ${f.code} [${f.lang}] ${f.detail}\n      ${f.text.replace(/\s+/g, " ")}`);
  if (list.length > 40) console.log(`   … et ${list.length - 40} autres`);
  console.log();
}
process.exit(findings.length ? 1 : 0);
