#!/usr/bin/env node
/**
 * L'AUDIT DIT-IL CE QU'IL A VU ? — le rapport, pas seulement son code de sortie.
 *
 *   node test-audit-observations.mjs        (exige un site construit COMPLET sous packages/ui/dist)
 *
 * POURQUOI CE HARNAIS EXISTE. `npm run audit` sort en 0 quand rien n'est bloquant, et c'est tout ce
 * que la CI regardait. Or deux de ses constatations n'étaient JAMAIS imprimées — la sévérité `INFO`
 * manquait à l'ordre d'affichage. Le code de sortie était juste, le rapport muet : un audit vert et
 * aveugle. Aucun contrôle ne pouvait le voir, puisque tous ne lisaient que le code de sortie.
 *
 * CE QU'IL EXIGE, et c'est délibérément littéral :
 *   · l'audit sort en 0 — sinon ce n'est pas le rapport qu'on juge, c'est une anomalie ;
 *   · le rapport porte la section `INFO` ;
 *   · la section `INFO` porte la LIGNE LITTÉRALE ENTIÈRE du contrôle hors-sitemap — son étiquette
 *     `[hors-sitemap]` comprise — et non une sous-chaîne trouvée n'importe où dans la sortie.
 *
 * POURQUOI LA LIGNE ENTIÈRE, ET DANS SA SECTION. La première version se contentait de chercher
 * « non concluant » quelque part dans le rapport. Deux mots peuvent apparaître dans un autre
 * message, ou hors de la section `INFO` qui les rend visibles : le harnais aurait été vert avec un
 * rapport dont la constatation ne s'affiche plus au bon endroit, ou plus du tout sous cette forme.
 * Relevé par la contre-revue du 20/08/2026.
 *
 * Un contrôle qui ne sait pas conclure et se tait est indiscernable d'un contrôle qui a conclu.
 * C'est cette différence-là que ce harnais protège, et elle ne se lit que dans le texte.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = "packages/ui/dist";
const AUDIT = "packages/knowledge/scripts/audit-site.mjs";
let echecs = 0;
const dire = (m) => process.stdout.write(m + "\n");
const exiger = (label, cond, detail = "") => {
  if (cond) return;
  echecs++;
  process.stdout.write(`  ✗ ${label}${detail ? `\n      ${detail}` : ""}\n`);
};

/* ---- JAMAIS VERT FAUTE DE MATIÈRE ------------------------------------------------------------
 * L'audit s'arrête de lui-même sous 1 500 pages, en code 2. Sans site complet, ce harnais ne
 * jugerait donc pas le rapport mais le message d'interruption. */
const pages = (d) => {
  if (!existsSync(d)) return 0;
  let n = 0;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== "_astro") n += pages(join(d, e.name)); }
    else if (e.name.endsWith(".html")) n++;
  }
  return n;
};
const total = pages(DIST);
if (total < 1500) {
  process.stderr.write(`[audit-obs] ÉCHEC — site absent ou partiel (${total} pages HTML sous ${DIST}). `
    + "Ce harnais juge le RAPPORT de l'audit : sans site complet, il ne lirait qu'un message d'arrêt.\n");
  process.exit(1);
}

const r = spawnSync(process.execPath, [AUDIT, DIST], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const sortie = `${r.stdout ?? ""}${r.stderr ?? ""}`;

exiger("l'audit sort en 0 — sinon c'est une anomalie qu'on lit, pas un rapport",
  r.status === 0, `code ${r.status}\n      ${sortie.trim().split("\n").slice(-3).join("\n      ")}`);
exiger("le rapport porte une section INFO", /^INFO$/m.test(sortie),
  "aucune section INFO : les constatations de ce niveau ne sont pas imprimées");

/* La section `INFO` seule : de sa ligne d'en-tête jusqu'à la première ligne non indentée qui suit
   — c'est-à-dire la barre de séparation finale ou la section suivante. Chercher ailleurs dans la
   sortie reviendrait à accepter la phrase là où le lecteur ne la verrait pas. */
const lignes = sortie.split("\n");
const debut = lignes.findIndex((l) => l === "INFO");
const section = debut === -1 ? []
  : lignes.slice(debut + 1, (() => {
      for (let i = debut + 1; i < lignes.length; i++) if (l0(lignes[i])) return i;
      return lignes.length;
    })());
function l0(l) { return l.trim() !== "" && !/^\s/.test(l); }

const LIGNE_ATTENDUE = "  • [hors-sitemap] non concluant : ce build déclare `noindex` sur la TOTALITÉ "
  + "des pages (build de preview). Ce contrôle exige un build de production pour distinguer "
  + "indexable et non indexable.";
exiger("la section INFO porte la ligne ENTIÈRE du contrôle hors-sitemap, étiquette comprise",
  section.includes(LIGNE_ATTENDUE),
  `attendu, mot pour mot :\n        ${LIGNE_ATTENDUE}\n      section INFO lue (${section.length} ligne(s)) :\n`
  + (section.length ? section.map((l) => `        ${l}`).join("\n") : "        (vide)"));

dire("");
dire(`  audit lu sur ${total} pages · ${lignes.length} lignes de rapport · section INFO : ${section.length} ligne(s)`);
if (echecs) { process.stderr.write(`[audit-obs] ÉCHEC — ${echecs} exigence(s) non tenue(s).\n`); process.exit(1); }
dire("[audit-obs] l'audit imprime ce qu'il a vu, y compris ce qu'il ne peut pas conclure.");
