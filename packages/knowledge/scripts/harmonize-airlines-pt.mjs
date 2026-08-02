#!/usr/bin/env node
/* Une seule traduction portugaise par chaîne anglaise, sur les 78 fiches compagnies.
 *
 * Pourquoi. Traduire en parallèle FABRIQUE de l'incohérence : huit lots ont rencontré
 * « Quote », « Free » ou « Service dog » sans savoir ce que les autres en faisaient. Le
 * résultat se lit page à page — « Orçamento » chez Lufthansa, « Cotação » chez Qatar — et
 * donne l'impression de deux sites cousus ensemble. On l'avait déjà payé sur les fiches
 * pays : 507 corrections après coup.
 *
 * Comment. Pour chaque anglais ayant reçu plusieurs portugais, on tranche UNE fois, ici, en
 * clair, et on réécrit partout. Le choix n'est pas « la majorité gagne » : c'est un arbitrage
 * de langue, et il est motivé en commentaire quand il ne va pas de soi.
 *
 *   node packages/knowledge/scripts/harmonize-airlines-pt.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";

const DIR = "content/airlines";
const dry = process.argv.includes("--dry");
const norm = (s) => String(s).split(/\s+/).join(" ").trim();

/** L'arbitrage. Clé = anglais, valeur = le portugais retenu. */
const CHOIX = {
  /* Devis de fret. « Cotação » est le mot du transport au Brésil ; « Orçamento » évoque
   * plutôt le budget d'un chantier. Minoritaire mais juste. */
  "Quote": "Cotação",
  /* « Grátis » est l'usage courant ; « Gratuito » est l'adjectif. Sur une étiquette de
   * tarif, on lit « Grátis ». */
  "Free": "Grátis",
  /* Les trois variantes désignaient le chien de service. Le portugais du Brésil dit
   * « cão de serviço » — c'est un terme réglementaire figé, l'une des rares exceptions à la
   * règle « cachorro » du glossaire, au même titre que « cão-guia ». */
  "Service dog": "Cão de serviço",
  "Temperature limits: not disclosed": "Limites de temperatura: não divulgados",
  "Heat embargo: not disclosed": "Embargo por calor: não divulgado",
  "Via cargo": "Via carga",
  "Via freight": "Via carga",
  "Via agent": "Via agente",
  /* Accord au féminin : la phrase porte sur « raças ». */
  "Not accepted": "Não aceitas",
  "May be refused": "Pode ser recusado",
  "No pets": "Sem animais",
  "No pets to the UK": "Sem animais para o Reino Unido",
  "No pets whatsoever": "Nenhum animal, de forma alguma",
  "Excess-baggage rate": "Tarifa de excesso de bagagem",
  "under-seat": "sob o assento",
  "Cabin — domestic": "Cabine — doméstico",
  "Cargo-only countries": "Países somente carga",
  "Route-based": "Conforme a rota",
  "Route-based fee": "Tarifa conforme a rota",
  "US dogs": "Cachorros para os EUA",
  "≤ 14 kg each": "≤ 14 kg cada",
  /* Devises : le symbole suit le nombre, comme en français et en espagnol sur les mêmes
   * fiches ; le dollar américain garde son « US$ » en tête, comme dans les fiches pays. */
  "€150": "150 €",
  "$150 / way": "US$ 150 / trajeto",
  "$150 each way": "US$ 150 por trajeto",
  "$300": "US$ 300",
  /* Second passage : les divergences restantes après le premier arbitrage. Elles sont
   * moins fréquentes mais du même ordre — deux traducteurs, deux tournures également
   * correctes, et un lecteur qui voit deux sites. */
  "UK / large": "Reino Unido / grande porte",
  "large": "grande porte",
  "Category 2 conditions": "Condições da categoria 2",
  "Cabin — long-haul": "Cabine — longa distância",
  "Hold domestic only": "Porão somente doméstico",
  "Hold — Japan domestic": "Porão — Japão doméstico",
  "No pets in the cabin — only recognised assistance dogs.": "Sem animais na cabine — somente cães de assistência reconhecidos.",
  "Route exclusions": "Rotas excluídas",
  "Carrier size": "Tamanho da bolsa de transporte",
  "No pet cargo service.": "Sem serviço de carga para animais.",
  "$100": "US$ 100",
  "$350": "US$ 350",
  /* Troisième et dernier passage. */
  "Cabin & hold banned": "Cabine e porão proibidos",
  "Air-conditioned hold": "Porão climatizado",
};

let touchees = 0, valeurs = 0;
const parFiche = [];
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".yml") && !f.startsWith("_"))) {
  const path = `${DIR}/${f}`;
  const src = readFileSync(path, "utf-8");
  const doc = yaml.load(src);
  /* On collecte les remplacements à faire sur le TEXTE, pas sur l'arbre : réécrire le YAML
   * effacerait les lignes vides et les commentaires de ces fiches tenues à la main. */
  const aChanger = new Map();
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      if (typeof o.en === "string" && typeof o.pt === "string") {
        const bon = CHOIX[norm(o.en)];
        if (bon && norm(o.pt) !== bon) aChanger.set(o.pt, bon);
        return;
      }
      Object.values(o).forEach(walk);
    }
  })(doc);
  if (!aChanger.size) continue;

  let out = src, n = 0;
  for (const [vieux, neuf] of aChanger) {
    const lit = vieux.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const cible = `pt: "${lit}"`;
    if (!out.includes(cible)) { console.error(`  ⚠ ${f} : « ${vieux} » introuvable sous forme citée`); continue; }
    out = out.split(cible).join(`pt: "${neuf.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
    n += src.split(cible).length - 1;
  }
  if (n && !dry) writeFileSync(path, out);
  if (n) { touchees++; valeurs += n; parFiche.push(`${f.slice(0, -4)} (${n})`); }
}
console.log(`${valeurs} valeurs harmonisées dans ${touchees} fiche(s)${dry ? " — essai à blanc" : ""}`);
console.log(parFiche.join(" · "));
