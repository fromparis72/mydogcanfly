#!/usr/bin/env node
/* Ramène les meta descriptions des fiches pays et compagnies sous 165 caractères.
 *
 * Google tronque au-delà : la fin de la phrase n'est jamais lue. Ces descriptions suivent
 * presque toutes le même moule — « <contexte> : <énumération>. <phrase de clôture> » — donc
 * plutôt que de couper au caractère près (ce qui produit des « … » disgracieux et casse le
 * sens), on RETIRE des éléments de l'énumération jusqu'à tenir dans le budget, en gardant
 * intacts le contexte de tête et la phrase de clôture, qui portent la promesse éditoriale.
 *
 * Si le moule ne s'applique pas, on coupe à la dernière frontière de phrase utile.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MAX = 165;

/** Raccourcit une description en préservant tête et clôture. */
export function shorten(s, max = MAX) {
  if (s.length <= max) return s;

  // Sépare une éventuelle phrase de clôture courte (« Sourcé et daté. », « Fuentes oficiales. »)
  const mTail = s.match(/(.*?[.!?])\s+([^.!?]{5,60}[.!?])\s*$/s);
  const head = mTail ? mTail[1] : s;
  const tail = mTail ? " " + mTail[2] : "";

  // Cherche le séparateur d'énumération : « : » ou « — », puis découpe sur les virgules.
  const mList = head.match(/^(.*?[:—])\s*(.+?)([.!?])\s*$/s);
  if (mList) {
    const [, lead, list, dot] = mList;
    const items = list.split(/,\s+/);
    for (let n = items.length - 1; n >= 1; n--) {
      const candidate = `${lead} ${items.slice(0, n).join(", ")}${dot}${tail}`;
      if (candidate.length > max) continue;
      // Rattrapage : si retirer l'élément suivant laisse beaucoup de place inutilisée,
      // on le réintègre tronqué à un mot entier plutôt que de gaspiller le budget.
      if (candidate.length < max - 28 && items[n]) {
        const room = max - candidate.length - 2;                  // ", " + suite
        const extra = items[n].slice(0, room);
        const clean = extra.slice(0, extra.lastIndexOf(" "));
        if (clean.length > 12) {
          const grown = `${lead} ${items.slice(0, n).join(", ")}, ${clean}…${tail}`;
          if (grown.length <= max) return grown;
        }
      }
      return candidate;
    }
  }

  // Repli : dernière frontière de phrase qui tient, sinon dernière virgule, sinon coupe nette.
  const room = max - tail.length;
  const cut = s.slice(0, room);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" ; "));
  if (stop > room * 0.5) return s.slice(0, stop + 1) + tail;
  const comma = cut.lastIndexOf(", ");
  if (comma > room * 0.5) return s.slice(0, comma) + "." + tail;
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targets = [
    { glob: "content/countries/*.yml", key: "metaDesc" },
    { glob: "content/airlines/*.yml", key: "metaDesc" },
  ];
  let total = 0, files = 0;
  for (const { glob, key } of targets) {
    for (const f of globSync(resolve(ROOT, glob)).sort()) {
      let s = readFileSync(f, "utf8");
      const before = s;
      // Valeurs sur une ligne : metaDesc: { en: "…", fr: "…", es: "…" }  ou  en: "…" indenté
      s = s.replace(
        new RegExp(`(\\b${key}:\\s*\\{)([^}]*)(\\})`, "g"),
        (m, open, body, close) => {
          const nb = body.replace(/\b(en|fr|es):\s*"((?:[^"\\]|\\.)*)"/g, (mm, lang, val) => {
            const v = shorten(val);
            if (v !== val) total++;
            return `${lang}: "${v}"`;
          });
          return open + nb + close;
        },
      );
      // Valeurs multi-lignes : bloc metaDesc: suivi de en:/fr:/es: indentés
      s = s.replace(
        new RegExp(`(\\b${key}:\\n)((?:\\s+(?:en|fr|es):\\s*"[^"]*"\\n?)+)`, "g"),
        (m, open, body) => {
          const nb = body.replace(/(\s+)(en|fr|es):\s*"((?:[^"\\]|\\.)*)"/g, (mm, sp, lang, val) => {
            const v = shorten(val);
            if (v !== val) total++;
            return `${sp}${lang}: "${v}"`;
          });
          return open + nb;
        },
      );
      if (s !== before) { writeFileSync(f, s); files++; }
    }
  }
  console.log(`descriptions raccourcies : ${total} dans ${files} fichier(s)`);
}
