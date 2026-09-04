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
   commerciale d'un transporteur.
   ET LE DÉPÔT SAIT DÉJÀ TOUT CELA — c'est la vraie découverte de cette phase, et elle corrige une
   erreur que j'ai écrite. `packages/knowledge/src/breed-restrictions.ts` définit `SourcedQuote` :
   citation verbatim d'au moins dix caractères, langue en BCP-47, locator, refus explicite de
   l'auto-citation (« un domaine MyDogCanFly ne peut pas fonder un fait métier ») et exigence d'un
   type de source factuel. J'avais rapporté que le modèle de preuve « ne peut pas porter ce qu'on
   lui demandera » : c'était faux. Il le porte, et plus strictement que demandé.
   LE DÉFAUT EST AILLEURS, ET C'EST LE MÊME QUE DANS TOUT CE DÉPÔT : il y a DEUX modèles de
   provenance pour la même chose. Le strict, `SourcedQuote`, sert aux restrictions de race. Le
   lâche — un objet `source` sans citation ni locator, qui accepte `source_type: other` et les URL
   mydogcanfly.com — est celui qui adosse les fiches publiées. Ce n'est pas un modèle à créer,
   c'est un modèle à faire descendre là où il manque. */
const PREUVE_RECEVABLE = new Set(["official_website"]);
const AUTO_CITATION = /(^|\/\/)([a-z0-9-]+\.)?mydogcanfly\.com/i;
const AGREGATEURS = /pettravel\.com|petrelocation\.com|klm-pet|dogfriendly|tripadvisor/i;

/** Une règle dont la condition compare un poids ou une taille à un seuil : elle prouve un refus
 *  CONDITIONNEL, jamais le refus général qu'une fiche publie. */
function conditionnelleSurUnSeuil(r) {
  const txt = JSON.stringify(r.applies_when ?? {});
  return /"op"\s*:\s*"(gt|gte|lt|lte)"/.test(txt) || /weight_kg|length_cm|height_cm/.test(txt);
}

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
    refusPublies: 0, refusSansAucuneRegle: 0, refusProuves: 0, refusNonProuves: 0,
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
      /* ASSOCIÉES, ET NON PROUVANTES. Le mot compte : cette association est une BORNE HAUTE. Elle
         exige seulement une règle de catégorie voisine portant une source officielle — elle ne
         vérifie ni que la règle parle du même fait, ni qu'elle couvre la même portée. Le vrai taux
         de preuve ne peut qu'être INFÉRIEUR. */
      const associees = pertinentes.filter((r) => PREUVE_RECEVABLE.has(r.source?.source_type));
      const prouvantes = associees;
      if (categorique) m.categoriques++;
      if (chiffree) m.chiffrees++;
      if (prouvantes.length) m.couvertes++;
      if (categorique && !prouvantes.length) { m.categoriquesSansPreuve++; categoriquesSansPreuve++; }
      if (chiffree && !prouvantes.length) m.chiffreesSansPreuve++;
      if (ch.cls === "no") {
        m.refusPublies++; refus++;
        /* ---- CE QUI PROUVE UN REFUS, ET RIEN DE MOINS ----------------------------------------
         * Une règle de POIDS conditionnelle ne prouve pas un refus GÉNÉRAL : « au-delà de 8 kg,
         * refusé en cabine » ne prouve pas « aucun chien en cabine ». Quatre conditions donc :
         * même compagnie (déjà, par construction), `action: deny`, le canal NOMMÉ dans
         * `effect.placement`, et une source officielle. Une règle dont la condition porte sur un
         * seuil est écartée : elle prouve un refus conditionnel, pas celui qui est publié. */
        const prouvantRefus = regs.filter((r) => r.effect?.action === "deny"
          && (r.effect?.placement ?? []).includes(ch.placement)
          && PREUVE_RECEVABLE.has(r.source?.source_type)
          && !conditionnelleSurUnSeuil(r));
        if (prouvantRefus.length) m.refusProuves++;
        else m.refusNonProuves++;
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
  /* L'AUTO-CITATION, COMPTÉE EN ENTIER PUIS PAR EFFET. Un premier relevé n'avait donné que le
     sous-ensemble « deny » en le présentant comme le total : 84 règles au lieu de 128. Les deux
     chiffres existent et ne disent pas la même chose — l'un mesure ce qu'on s'autorise à citer,
     l'autre ce qu'on refuse au visiteur sur cette base. */
  const autoTout = regles.filter((r) => AUTO_CITATION.test(r.source?.url ?? ""));
  const auto = deny.filter((r) => AUTO_CITATION.test(r.source?.url ?? ""));
  const autoParEffet = new Map();
  for (const r of autoTout) {
    const a = r.effect?.action ?? "—";
    autoParEffet.set(a, (autoParEffet.get(a) ?? 0) + 1);
  }
  const agreg = deny.filter((r) => AGREGATEURS.test(r.source?.url ?? ""));
  const urlsAuto = [...new Set(auto.map((r) => r.source.url))];
  const urlsAutoTout = [...new Set(autoTout.map((r) => r.source.url))];

  /* LE MODÈLE DE PREUVE LUI-MÊME : ce que le champ `source` porte, et ce qu'il ne porte pas. */
  const champs = new Set();
  for (const r of regles) for (const k of Object.keys(r.source ?? {})) champs.add(k);

  return { m, parAirline, refusNus, deny, auto, autoTout, autoParEffet, agreg, urlsAuto, urlsAutoTout, champs, regles };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { m, parAirline, refusNus, deny, auto, autoTout, autoParEffet, agreg, urlsAuto, urlsAutoTout, champs } = mesurer();
  const pct = (a, b) => `${((100 * a) / b).toFixed(1)} %`;
  console.log(`AFFIRMATIONS PUBLIÉES — ${m.compagnies} compagnies\n`);
  console.log(`  ${String(m.affirmations).padStart(4)}  BLOCS DE CANAL publiés (cabine, soute, fret)`);
  console.log(`  ${String(m.couvertes).padStart(4)}  blocs ayant AU MOINS UNE ASSOCIATION à une règle officielle`);
  console.log(`        de catégorie voisine — BORNE HAUTE, pas un taux de preuve   ${pct(m.couvertes, m.affirmations)}`);
  console.log(`  ${String(m.categoriques).padStart(4)}  verdicts CATÉGORIQUES (autorisé / refusé)`);
  console.log(`  ${String(m.categoriquesSansPreuve).padStart(4)}  …dont SANS preuve officielle                            ${pct(m.categoriquesSansPreuve, m.categoriques)}`);
  console.log(`  ${String(m.chiffrees).padStart(4)}  affirmations CHIFFRÉES (poids, dimensions)`);
  console.log(`  ${String(m.chiffreesSansPreuve).padStart(4)}  …dont SANS preuve officielle                            ${pct(m.chiffreesSansPreuve, m.chiffrees)}`);
  console.log(`\n  ${String(m.refusPublies).padStart(4)}  REFUS catégoriques publiés`);
  console.log(`  ${String(m.refusProuves).padStart(4)}  …prouvés au sens strict : même compagnie, deny, canal nommé dans`);
  console.log(`        effect.placement, source officielle, condition NON conditionnelle à un seuil`);
  console.log(`  ${String(m.refusNonProuves).padStart(4)}  …NON prouvés à ce sens                                  ${pct(m.refusNonProuves, m.refusPublies)}`);
  console.log(`  ${String(m.refusSansAucuneRegle).padStart(4)}  …dont sans AUCUNE règle derrière eux`);
  for (const r of refusNus) console.log(`          · ${r}`);
  console.log(`\n  ${String(m.compagniesSansRegle).padStart(4)}  compagnies sans aucune règle`);

  console.log(`\nLES RÈGLES DE REFUS ET LEUR PREUVE — ${deny.length} règles « deny »\n`);
  const parType = new Map();
  for (const r of deny) parType.set(r.source?.source_type ?? "—", (parType.get(r.source?.source_type ?? "—") ?? 0) + 1);
  for (const [k, n] of [...parType].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
  console.log(`\n  ${String(autoTout.length).padStart(4)}  règles au TOTAL sourcées sur NOTRE PROPRE SITE, vers ${urlsAutoTout.length} URL distinctes`);
  for (const [a, n] of [...autoParEffet].sort((x, y) => y[1] - x[1])) console.log(`        dont ${String(n).padStart(3)} « ${a} »`);
  console.log(`  ${String(auto.length).padStart(4)}  REFUS ainsi sourcés, vers ${urlsAuto.length} URL distinctes`);
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
