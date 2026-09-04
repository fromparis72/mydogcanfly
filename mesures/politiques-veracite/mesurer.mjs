#!/usr/bin/env node
/**
 * L'ÉTAT DES LIEUX DE LA VÉRACITÉ DES POLITIQUES — PHASE D'INVENTAIRE, EN LECTURE SEULE.
 *
 * CE QUE CET INSTRUMENT MESURE, ET CE QU'IL NE PEUT PAS MESURER. Il confronte ce que le site
 * AFFIRME — les canaux publiés de chaque fiche compagnie — à ce que le dépôt PROUVE — les règles
 * de `packages/knowledge/raw/rules.json` et leur champ `source`. Il ne va pas sur le web : le
 * conteneur qui l'exécute n'a pas d'accès sortant vers les sites des compagnies (403 du mandataire,
 * vérifié). Il ne peut donc établir ni statut HTTP, ni URL finale après redirection, ni citation
 * exacte relevée en direct. Ce qu'il établit, c'est l'écart entre l'affirmation et la preuve
 * DÉCLARÉE — et c'est déjà l'essentiel du travail à commander.
 *
 * UN PIÈGE MESURÉ DÈS LA PREMIÈRE HEURE, ET QUI FAUSSERA TOUT OUTIL ÉCRIT EN PYTHON SUR CE DÉPÔT.
 * Les fiches écrivent `cls: no` SANS GUILLEMETS. En YAML 1.1 — ce que lit `yaml.safe_load` de
 * Python — `no` est le BOOLÉEN FAUX ; en YAML 1.2 — ce que lit le paquet `yaml` de Node, celui
 * qu'utilise le site — c'est la CHAÎNE « no ». Un premier comptage en Python a donc trouvé 19
 * refus publiés là où le site en publie 74 : 55 refus catégoriques devenaient invisibles, dont
 * « Gulf Air · cabine · Not accepted », vérifié sur la page construite. Cet instrument lit donc
 * avec le MÊME analyseur que le site. C'est la règle de ce dépôt : la mesure se fait avec l'outil
 * qui publie, jamais avec un outil qui lui ressemble.
 *
 * POURQUOI UNE MESURE ET PAS UNE NOTE. Le lot précédent a produit trois faux zéros parce que des
 * chiffres avaient été avancés sans instrument rejouable. Celui-ci se rejoue :
 *   node mesures/politiques-veracite/mesurer.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const FICHES = "content/airlines";
const REGLES = "packages/knowledge/raw/rules.json";

/* LES CATÉGORIES DE RÈGLE QUI PARLENT D'UN CANAL. Une règle de poids cabine prouve quelque chose
   de la cabine ; elle ne prouve rien du fret. Confondre les deux gonflerait la couverture. */
const CATEGORIES_PAR_CANAL = {
  cabin: new Set(["cabin_weight", "placement"]),
  hold: new Set(["hold_weight", "placement", "summer_embargo"]),
  cargo: new Set(["placement"]),
};

/* CE QUI COMPTE COMME PREUVE, ET CE QUI N'EN EST PAS UNE. L'arbitrage est explicite : ni
   auto-citation, ni agrégateur, ni déduction. `official_website` est la seule preuve recevable
   pour une politique de compagnie ; `government` prouve une règle d'IMPORTATION, pas la politique
   commerciale d'un transporteur. */
const PREUVE_RECEVABLE = new Set(["official_website"]);
const AUTO_CITATION = /(^|\/\/)([a-z0-9-]+\.)?mydogcanfly\.com/i;
const AGREGATEURS = /pettravel\.com|petrelocation\.com|klm-pet|dogfriendly|tripadvisor/i;

export function mesurer(racine = ".") {
  const regles = JSON.parse(readFileSync(join(racine, REGLES), "utf8"));
  const parCompagnie = new Map();
  for (const r of regles) {
    if (r?.scope?.type !== "airline") continue;
    if (!parCompagnie.has(r.scope.id)) parCompagnie.set(r.scope.id, []);
    parCompagnie.get(r.scope.id).push(r);
  }

  const m = {
    affirmations: 0, categoriques: 0, chiffrees: 0, couvertes: 0,
    categoriquesSansPreuve: 0, chiffreesSansPreuve: 0,
    refusPublies: 0, refusSansAucuneRegle: 0,
    compagnies: 0, compagniesSansRegle: 0,
  };
  const refusNus = [], parAirline = [];

  for (const f of readdirSync(join(racine, FICHES)).filter((x) => x.endsWith(".yml")).sort()) {
    const d = YAML.parse(readFileSync(join(racine, FICHES, f), "utf8"));
    const regs = parCompagnie.get(d.id) ?? [];
    m.compagnies++;
    if (!regs.length) m.compagniesSansRegle++;
    let categoriquesSansPreuve = 0, refus = 0;
    for (const ch of d.channels ?? []) {
      m.affirmations++;
      const categorique = ch.cls === "ok" || ch.cls === "no";
      const chiffree = /\d/.test(ch.detail?.en ?? "");
      const pertinentes = regs.filter((r) => CATEGORIES_PAR_CANAL[ch.placement]?.has(r.category));
      const prouvantes = pertinentes.filter((r) => PREUVE_RECEVABLE.has(r.source?.source_type));
      if (categorique) m.categoriques++;
      if (chiffree) m.chiffrees++;
      if (prouvantes.length) m.couvertes++;
      if (categorique && !prouvantes.length) { m.categoriquesSansPreuve++; categoriquesSansPreuve++; }
      if (chiffree && !prouvantes.length) m.chiffreesSansPreuve++;
      if (ch.cls === "no") {
        m.refusPublies++; refus++;
        if (!pertinentes.length) {
          m.refusSansAucuneRegle++;
          refusNus.push(`${d.name} · ${ch.placement} · « ${ch.statusLabel?.en ?? ""} »`);
        }
      }
    }
    const refusMalSources = regs.filter((r) => r.effect?.action === "deny"
      && !PREUVE_RECEVABLE.has(r.source?.source_type)).length;
    parAirline.push({ nom: d.name ?? f, refus, refusMalSources, categoriquesSansPreuve, regles: regs.length,
      risque: refus * 3 + refusMalSources * 2 + categoriquesSansPreuve });
  }

  /* LES RÈGLES DE REFUS, PAR LA NATURE DE LEUR PREUVE. Un refus est ce qu'un visiteur subit sans
     recours : c'est l'affirmation dont la preuve doit être la plus solide. */
  const deny = regles.filter((r) => r.effect?.action === "deny");
  const auto = deny.filter((r) => AUTO_CITATION.test(r.source?.url ?? ""));
  const agreg = deny.filter((r) => AGREGATEURS.test(r.source?.url ?? ""));
  const urlsAuto = [...new Set(auto.map((r) => r.source.url))];

  /* LE MODÈLE DE PREUVE LUI-MÊME : ce que le champ `source` porte, et ce qu'il ne porte pas. */
  const champs = new Set();
  for (const r of regles) for (const k of Object.keys(r.source ?? {})) champs.add(k);

  return { m, parAirline, refusNus, deny, auto, agreg, urlsAuto, champs, regles };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { m, parAirline, refusNus, deny, auto, agreg, urlsAuto, champs } = mesurer();
  const pct = (a, b) => `${((100 * a) / b).toFixed(1)} %`;
  console.log(`AFFIRMATIONS PUBLIÉES — ${m.compagnies} compagnies\n`);
  console.log(`  ${String(m.affirmations).padStart(4)}  affirmations de canal publiées`);
  console.log(`  ${String(m.couvertes).padStart(4)}  couvertes par une source officielle de portée adaptée   ${pct(m.couvertes, m.affirmations)}`);
  console.log(`  ${String(m.categoriques).padStart(4)}  verdicts CATÉGORIQUES (autorisé / refusé)`);
  console.log(`  ${String(m.categoriquesSansPreuve).padStart(4)}  …dont SANS preuve officielle                            ${pct(m.categoriquesSansPreuve, m.categoriques)}`);
  console.log(`  ${String(m.chiffrees).padStart(4)}  affirmations CHIFFRÉES (poids, dimensions)`);
  console.log(`  ${String(m.chiffreesSansPreuve).padStart(4)}  …dont SANS preuve officielle                            ${pct(m.chiffreesSansPreuve, m.chiffrees)}`);
  console.log(`\n  ${String(m.refusPublies).padStart(4)}  REFUS catégoriques publiés`);
  console.log(`  ${String(m.refusSansAucuneRegle).padStart(4)}  …dont sans AUCUNE règle derrière eux`);
  for (const r of refusNus) console.log(`          · ${r}`);
  console.log(`\n  ${String(m.compagniesSansRegle).padStart(4)}  compagnies sans aucune règle`);

  console.log(`\nLES RÈGLES DE REFUS ET LEUR PREUVE — ${deny.length} règles « deny »\n`);
  const parType = new Map();
  for (const r of deny) parType.set(r.source?.source_type ?? "—", (parType.get(r.source?.source_type ?? "—") ?? 0) + 1);
  for (const [k, n] of [...parType].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
  console.log(`\n  ${String(auto.length).padStart(4)}  refus sourcés sur NOTRE PROPRE SITE (auto-citation)`);
  console.log(`  ${String(urlsAuto.length).padStart(4)}  URL distinctes ainsi citées`);
  console.log(`  ${String(agreg.length).padStart(4)}  refus sourcés sur un agrégateur`);

  console.log(`\nLE MODÈLE DE PREUVE — champs présents dans « source »\n  ${[...champs].sort().join(", ")}`);
  for (const manquant of ["quote", "locator", "http_status", "final_url"]) {
    if (!champs.has(manquant)) console.log(`  MANQUANT : ${manquant}`);
  }

  console.log(`\nCOMPAGNIES PRIORITAIRES — par risque décroissant\n`);
  console.log(`  ${"compagnie".padEnd(26)}${"refus".padStart(6)}${"refus mal sourcés".padStart(19)}${"catég. sans preuve".padStart(20)}${"règles".padStart(8)}`);
  for (const a of parAirline.sort((x, y) => y.risque - x.risque || x.nom.localeCompare(y.nom)).slice(0, 15)) {
    console.log(`  ${String(a.nom).slice(0, 25).padEnd(26)}${String(a.refus).padStart(6)}${String(a.refusMalSources).padStart(19)}${String(a.categoriquesSansPreuve).padStart(20)}${String(a.regles).padStart(8)}`);
  }
}
