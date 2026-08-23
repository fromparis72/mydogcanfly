#!/usr/bin/env node
/**
 * LES QUATRE INDEX DU TRAVEL HUB DISENT LA MÊME CHOSE, CHACUN DANS SA LANGUE.
 *
 *   node test-index-travel-hub.mjs        (exige un site construit sous packages/ui/dist)
 *
 * POURQUOI CE HARNAIS EXISTE — et il vaut mieux le dire franchement. Le 23/08/2026, l'index
 * français affichait CINQ rubriques pour quatre thèmes : « Voyager » 10 et « Travel » 10, au lieu
 * de « Voyager » 20. Les index espagnol et portugais affichaient « Gear », « Travel », « Health »,
 * « Destinations » — en anglais, sur des pages hispanophones et lusophones. Ce défaut a vécu
 * plusieurs jours dans `main`, il a traversé quatre pull requests, deux jobs de CI, 45
 * contre-épreuves et un contre-test navigateur. Il a été trouvé À L'ŒIL, sur une capture d'écran.
 *
 * La raison est simple : RIEN NE REGARDAIT LE CHROME DU HUB. `test-guides-traduits.mjs` juge les
 * fichiers de guides ; `test-annonce-du-site.mjs` juge les `hreflang` et les sitemaps ;
 * `test-page-guide.mjs` juge une page de guide. Entre les trois, l'index — la page qui donne
 * accès à tout le reste — n'était jugé par personne.
 *
 * CE HARNAIS LIT LE DOM CONSTRUIT, ET NON LES FICHIERS DE TRADUCTION. La distinction est le
 * cœur du contrôle : vérifier qu'une clé existe dans `strings.json` prouve sa PRÉSENCE, jamais sa
 * TRADUCTION. Les quatre fichiers portaient 318 clés chacun — compte parfaitement identique —
 * pendant que `nav.travel_hub` valait littéralement « Travel Hub » en espagnol. Un décompte ne
 * prouve pas une traduction, de même qu'un décompte de mutations ne prouvait pas un catalogue.
 *
 * SIX PROPRIÉTÉS, CHACUNE AVEC SON DIAGNOSTIC PROPRE :
 *
 *   1. QUATRE RUBRIQUES, exactement, dans chacune des quatre langues. Ni trois — une rubrique
 *      aurait disparu — ni cinq, qui est la forme exacte du défaut d'origine.
 *   2. MÊMES CLÉS, dans le même ordre, d'une langue à l'autre. C'est l'identité que le champ
 *      libre rendait invérifiable.
 *   3. LIBELLÉS LOCALISÉS EXACTS — la table ci-dessous est écrite ICI, à la main, et non lue dans
 *      `strings.json`. Un harnais qui relit la source qu'il contrôle ne contrôle rien : il
 *      constaterait qu'un fichier est égal à lui-même. C'est une SECONDE SOURCE, au même titre
 *      que `contre-epreuves-attendues.json` pour le catalogue de mutations.
 *   4. ANCRES CORRECTES — `id` et `href` valent la clé, identiques dans les quatre langues, si
 *      bien qu'un lien `#gear` partagé désigne la même rubrique quelle que soit la page.
 *   5. EFFECTIFS 25 / 20 / 19 / 8 dans les quatre langues. Un total juste ne suffit pas : 10 + 10
 *      totalisait 20 et c'était pourtant le défaut.
 *   6. AUCUN IDENTIFIANT BRUT NI LIBELLÉ ANGLAIS RÉSIDUEL en espagnol et en portugais — ni la
 *      clé nue affichée telle quelle, ni le mot anglais qui trahit la traduction oubliée.
 *
 * JAMAIS VERT FAUTE DE MATIÈRE. Si les quatre index ne sont pas tous présents et peuplés, le
 * harnais ÉCHOUE au lieu de conclure : un contrôle qui passe parce qu'il n'a rien lu est pire
 * qu'un contrôle absent.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "packages/ui/dist";

/** L'index de chaque langue, tel qu'il est publié. L'anglais est à la racine. */
const INDEX = {
  en: join(DIST, "travel-hub", "index.html"),
  fr: join(DIST, "fr", "travel-hub", "index.html"),
  es: join(DIST, "es", "travel-hub", "index.html"),
  pt: join(DIST, "pt", "travel-hub", "index.html"),
};

/** L'ordre attendu : par volume décroissant, comme la page les trie. */
const CLES = ["gear", "travel", "health", "destinations"];

/** Seconde source des effectifs — recomptés à la main sur le contenu, pas lus dans la page. */
const EFFECTIFS = { gear: 25, travel: 20, health: 19, destinations: 8 };

/** Seconde source des libellés. Écrite ici, JAMAIS lue dans `strings.json`. */
const LIBELLES = {
  en: { gear: "Gear", travel: "Travel", health: "Health", destinations: "Destinations" },
  fr: { gear: "Équipement", travel: "Voyager", health: "Santé", destinations: "Destinations" },
  es: { gear: "Equipo", travel: "Viajar", health: "Salud", destinations: "Destinos" },
  pt: { gear: "Equipamento", travel: "Viajar", health: "Saúde", destinations: "Destinos" },
};

/* Les mots anglais qui, APPARAISSANT COMME LIBELLÉ DE RUBRIQUE en espagnol ou en portugais,
 * signalent une traduction oubliée. La liste est restreinte aux libellés historiques : c'est
 * précisément « Gear », « Health », « Travel » qui s'affichaient sur ces pages. */
const ANGLAIS_INTERDITS = { es: ["Gear", "Health", "Travel"], pt: ["Gear", "Health", "Travel"] };

const defauts = [];
const echec = (n, m) => defauts.push(`${n}. ${m}`);

/* ---- lecture, et refus de conclure sur du vide --------------------------------------------- */
const pages = {};
for (const [langue, chemin] of Object.entries(INDEX)) {
  if (!existsSync(chemin)) {
    process.stderr.write(
      `[index-hub] ÉCHEC — l'index ${langue.toUpperCase()} est absent : ${chemin}\n` +
      `[index-hub] Ce harnais lit un site construit. Construisez-le d'abord :\n` +
      `[index-hub]   npm run build:ci\n`);
    process.exit(1);
  }
  pages[langue] = readFileSync(chemin, "utf-8");
}

/**
 * Les rubriques d'une page, lues sur les titres `h2` que la page marque `data-categorie`.
 * L'attribut est posé POUR CE CONTRÔLE : s'appuyer sur l'`id` seul reviendrait à vérifier
 * l'ancre avec l'ancre.
 */
function rubriquesDe(html) {
  const re = /<h2\b[^>]*\bid="([^"]*)"[^>]*\bdata-categorie="([^"]*)"[^>]*>([\s\S]*?)<\/h2>/g;
  const out = [];
  for (const m of html.matchAll(re)) {
    const brut = m[3];
    /* Le `span` porte un attribut de portée ajouté par Astro (`data-astro-cid-…`) : l'ancrer sur
     * `<span class="th-n">` exactement le rendrait MUET au premier changement de compilation. */
    const effectif = (/<span class="th-n"[^>]*>\s*(\d+)\s*<\/span>/.exec(brut) || [])[1];
    const libelle = brut.replace(/<span class="th-n"[^>]*>[\s\S]*?<\/span>/, "").replace(/<[^>]*>/g, "").trim();
    out.push({ id: m[1], cle: m[2], libelle, effectif: effectif === undefined ? null : Number(effectif) });
  }
  return out;
}

/** Les ancres du menu de raccourcis. */
const ancresDe = (html) => {
  const nav = /<nav class="th-jump"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  return nav ? [...nav[1].matchAll(/href="#([^"]*)"/g)].map((m) => m[1]) : null;
};

const lues = {};
for (const langue of Object.keys(INDEX)) {
  const r = rubriquesDe(pages[langue]);
  lues[langue] = r;

  /* 1. quatre rubriques, exactement */
  if (r.length !== 4) {
    echec(1, `${langue.toUpperCase()} : ${r.length} rubrique(s) au lieu de 4` +
      (r.length ? ` — ${r.map((x) => `${x.libelle} ${x.effectif}`).join(" · ")}` : " — la page n'en expose aucune"));
    continue;
  }

  /* 2. mêmes clés, même ordre */
  const cles = r.map((x) => x.cle);
  if (cles.join(",") !== CLES.join(",")) {
    echec(2, `${langue.toUpperCase()} : clés « ${cles.join(", ")} » au lieu de « ${CLES.join(", ")} »`);
  }

  for (const rub of r) {
    /* 3. libellé localisé exact */
    const attendu = LIBELLES[langue]?.[rub.cle];
    if (attendu === undefined) echec(3, `${langue.toUpperCase()} : rubrique « ${rub.cle} » hors de la table de référence`);
    else if (rub.libelle !== attendu) {
      echec(3, `${langue.toUpperCase()}/${rub.cle} : libellé « ${rub.libelle} » au lieu de « ${attendu} »`);
    }

    /* 4. ancre correcte */
    if (rub.id !== rub.cle) echec(4, `${langue.toUpperCase()}/${rub.cle} : id « ${rub.id} » différent de la clé`);

    /* 5. effectif */
    const n = EFFECTIFS[rub.cle];
    if (rub.effectif !== n) {
      echec(5, `${langue.toUpperCase()}/${rub.cle} : ${rub.effectif} guide(s) au lieu de ${n}`);
    }

    /* 6. ni identifiant brut, ni anglais résiduel */
    if (rub.libelle === rub.cle) {
      echec(6, `${langue.toUpperCase()}/${rub.cle} : la clé est affichée telle quelle comme libellé`);
    }
    for (const mot of ANGLAIS_INTERDITS[langue] ?? []) {
      if (rub.libelle === mot) {
        echec(6, `${langue.toUpperCase()}/${rub.cle} : libellé anglais « ${mot} » sur une page ${langue.toUpperCase()}`);
      }
    }
  }

  /* 4 bis. le menu de raccourcis pointe sur les mêmes ancres, dans le même ordre */
  const ancres = ancresDe(pages[langue]);
  if (ancres === null) echec(4, `${langue.toUpperCase()} : aucun menu de raccourcis « th-jump »`);
  else if (ancres.join(",") !== CLES.join(",")) {
    echec(4, `${langue.toUpperCase()} : raccourcis « ${ancres.join(", ")} » au lieu de « ${CLES.join(", ")} »`);
  }
}

/* 6 bis. LE SURTITRE DE LA PAGE, dans la langue de la page.
 *
 * Il valait littéralement « Travel Hub » en espagnol, à côté d'un « Central de viagem »
 * portugais correct — et les quatre fichiers de traduction portaient pourtant le même nombre de
 * clés. C'est le même défaut que les rubriques, sur une chaîne voisine : le contrôler ici évite
 * qu'il ne revienne par la porte que le correctif vient de fermer. */
const SURTITRES = { en: "Travel Hub", fr: "Ressources", es: "Central de viajes", pt: "Central de viagem" };
for (const [langue, html] of Object.entries(pages)) {
  const m = /<p class="mdcf-eyebrow"[^>]*>([\s\S]*?)<\/p>/.exec(html);
  if (!m) { echec(6, `${langue.toUpperCase()} : aucun surtitre « mdcf-eyebrow »`); continue; }
  const lu = m[1].replace(/<[^>]*>/g, "").trim();
  if (lu !== SURTITRES[langue]) {
    echec(6, `${langue.toUpperCase()} : surtitre « ${lu} » au lieu de « ${SURTITRES[langue]} »`);
  }
}

/* 2 bis. l'identité entre langues, énoncée une fois pour toutes ------------------------------- */
const signatures = Object.fromEntries(
  Object.entries(lues).map(([l, r]) => [l, r.map((x) => `${x.cle}:${x.effectif}`).join(" ")]));
const distinctes = [...new Set(Object.values(signatures))];
if (distinctes.length > 1) {
  echec(2, "les quatre langues n'exposent pas la même signature :\n" +
    Object.entries(signatures).map(([l, s]) => `        ${l} → ${s}`).join("\n"));
}

/* ---- verdict -------------------------------------------------------------------------------- */
const log = (m) => process.stdout.write(`${m}\n`);
if (defauts.length === 0) {
  log(`4 index lus · signature commune ${distinctes[0]}`);
  for (const langue of Object.keys(INDEX)) {
    log(`  ${langue}  ${lues[langue].map((x) => `${x.libelle} ${x.effectif}`).join("  ·  ")}`);
  }
  log("");
  log("[index-hub] les quatre index exposent les mêmes rubriques, chacun dans sa langue.");
  process.exit(0);
}
process.stderr.write(`\n[index-hub] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
