#!/usr/bin/env node
/**
 * AUCUNE TAILLE DE CAISSE NON SOURCÉE N'EST PUBLIÉE.
 *
 *   node test-caisses-non-sourcees.mjs --dist=packages/ui/dist
 *
 * CE QUI A ÉTÉ PUBLIÉ, ET QUE CETTE GARDE INTERDIT DE REPUBLIER. Les fiches de race annonçaient
 * « 500 · XL · 94×64×68 cm » sous un titre « Caisse IATA type », et le calculateur affichait
 * « 500 / XL ≈ 94 × 64 × 68 » comme résultat principal. Les deux lisaient la MÊME table
 * 100/200/…/700 écrite en dur, dupliquée entre `breedTravel.ts` et `CrateCalculator.astro`, et
 * qu'un commentaire appelait « IATA crate interior series ». Deux erreurs superposées :
 *   · cette série est une nomenclature de FABRICANT — l'IATA ne la publie pas ;
 *   · ses dimensions n'étaient sourcées nulle part, et sur les fiches de race elles se déduisaient
 *     du seul POIDS DE LA RACE, sans aucune mesure de l'animal.
 *
 * LA RÈGLE N'EST PAS UNE RÈGLE DE VOCABULAIRE. Retirer le mot « IATA » aurait laissé publier une
 * classification commerciale et des dimensions non établies. Ce qui est interdit, c'est
 * l'ESTIMATION PUBLIQUE tant que les registres canoniques ne sont pas publiables.
 *
 * CE QUI RESTE LÉGITIME, ET QUE LE CONTRÔLE 3 EXIGE DE VOIR : le minimum intérieur calculé À PARTIR
 * DES MESURES SAISIES par le maître, et la mention de la méthode de dimensionnement publiée par
 * l'IATA — citer une méthode est exact, en déduire qu'une caisse serait « IATA » ne l'est pas.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
if (!DIST || !existsSync(DIST)) {
  console.error("[caisses] REFUS — `--dist=<chemin>` est obligatoire et doit exister.");
  console.error("          Une garde qui se saute faute d'artefact ne garde rien.");
  process.exit(1);
}

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const CODES = ["100", "200", "300", "400", "500", "700"];

/**
 * LE COUPLE « CODE DE SÉRIE + TAILLE », dans du texte DÉCODÉ. C'est le couple qui fait la
 * classification : un nombre seul ne dit rien, une lettre seule non plus.
 *
 * DEUX FORMES, ET LA SECONDE EST BORNÉE EXPRÈS. « XS », « XL » et « XXL » ne ressemblent à rien
 * d'autre sur ces pages : ils sont refusés quel que soit le séparateur. « S », « M » et « L », en
 * revanche, sont AUSSI les initiales d'axes dans le bloc de dimensions du calculateur — qui écrit
 * « 94 L 64 l 68 H ». Les accepter sans condition ferait rougir la garde sur le résultat légitime
 * dès qu'une mesure vaudrait 100 ou 500. On exige donc pour eux un séparateur de couple — « / »,
 * « · », « — » — que le bloc de dimensions n'emploie jamais. La limite est nommée : « 500 L »
 * écrit sans séparateur ne serait pas vu.
 */
const MOTIF_SERIE = new RegExp(
  `\\b(?:${CODES.join("|")})\\s*(?:[/·—–-]\\s*)?(?:XS|XL|XXL)\\b`
  + `|\\b(?:XS|XL|XXL)\\s*(?:[/·—–-]\\s*)?(?:${CODES.join("|")})\\b`
  + `|\\b(?:${CODES.join("|")})\\s*[/·—–]\\s*[SML]\\b`
  + `|\\b[SML]\\s*[/·—–]\\s*(?:${CODES.join("|")})\\b`,
  "g",
);
/** Les couples trouvés dans un texte décodé. Les contrôles 2 et 4 appellent CETTE fonction. */
function serieDans(texte) {
  MOTIF_SERIE.lastIndex = 0;
  return [...String(texte ?? "").matchAll(MOTIF_SERIE)].map((m) => m[0]);
}
/** Le texte rendu d'une page, décodé — jamais le HTML brut. */
function texteDe(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const n of doc.querySelectorAll("style")) n.remove();
  const scripts = [...doc.querySelectorAll("script")].map((n) => n.textContent ?? "").join("\n");
  for (const n of doc.querySelectorAll("script")) n.remove();
  const corps = doc.body?.textContent ?? "";
  dom.window.close();
  return { corps, scripts };
}

/* ---- 0. LES REGISTRES CANONIQUES SONT-ILS TOUJOURS VIDES ? ---------------------------------- */
/* La règle « aucune estimation publique » vaut TANT QUE rien n'est publiable. Si un registre se
 * remplit un jour, ce contrôle rougit pour dire que la règle doit être rouverte — délibérément —
 * plutôt que de rester en vigueur par inertie ou de sauter en silence. */
{
  const REGISTRES = {
    "modeles-caisses.json": "modeles",
    "profils-caisses.json": "profils",
    "caisses-par-race.json": "correspondances",
  };
  const remplis = [];
  for (const [f, cle] of Object.entries(REGISTRES)) {
    const p = `packages/knowledge/tarifs/${f}`;
    if (!existsSync(p)) { echec("0 registres", `${p} absent`); continue; }
    const n = (JSON.parse(readFileSync(p, "utf8"))[cle] ?? []).length;
    if (n) remplis.push(`${f} → ${n} entrée(s)`);
  }
  if (remplis.length) echec("0 registres", `des registres canoniques ne sont plus vides (${remplis.join(", ")}) — `
    + "l'interdiction d'estimation publique doit être rouverte et rearbitrée, pas maintenue par inertie");
  else ok("0 registres canoniques vides — l'interdiction d'estimation publique reste fondée");
}

/* ---- 1. AUCUNE COPIE LOCALE DE LA SÉRIE COMMERCIALE DANS LES SOURCES ------------------------ */
/* On ne cherche pas une mise en forme, on cherche une TABLE : au moins trois codes de la série
 * dans une même fenêtre. Une table réintroduite autrement mise en page serait vue quand même. */
{
  const RACINES = ["packages/ui/src", "packages/engine/src", "packages/knowledge/scripts"];
  const fautifs = [];
  for (const racine of RACINES) {
    (function marcher(d) {
      for (const e of readdirSync(d).sort()) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) { marcher(p); continue; }
        if (!/\.(ts|tsx|astro|mjs|js)$/.test(p)) continue;
        const src = readFileSync(p, "utf8");
        for (let i = 0; i < src.length; i += 200) {
          const fenetre = src.slice(i, i + 400);
          const vus = CODES.filter((c) => new RegExp(`["'\\s:]${c}["'\\s,]`).test(fenetre));
          if (vus.length >= 3 && /\b(XS|XL|XXL)\b/.test(fenetre)) {
            fautifs.push(`${p} — ${vus.join("/")} et une taille dans la même fenêtre`);
            break;
          }
        }
      }
    })(racine);
  }
  if (fautifs.length) {
    echec("1 sources", `${fautifs.length} copie(s) locale(s) de la série commerciale`);
    for (const f of fautifs.slice(0, 10)) console.error(`      ${f}`);
  } else ok(`1 sources — aucune table 100–700 dans ${RACINES.length} racines applicatives`);
}

/* ---- LES PAGES CONCERNÉES ------------------------------------------------------------------- */
const pages = [];
(function marcher(d) {
  for (const e of [...readdirSync(d)].sort()) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) marcher(p);
    else if (e === "index.html") pages.push(p);
  }
})(DIST);
const rel = (p) => p.slice(DIST.length).replace(/^\/+/, "");
const RACE = /(?:^|\/)(?:([a-z]{2})\/)?breeds\/([^/]+)\/index\.html$/;
const OUTIL = /(?:^|\/)(?:([a-z]{2})\/)?tools\/crate\/index\.html$/;
const fiches = pages.filter((p) => RACE.test(rel(p)));
const outils = pages.filter((p) => OUTIL.test(rel(p)));
if (!fiches.length || !outils.length) {
  echec("départ", `${fiches.length} fiche(s) de race et ${outils.length} page(s) calculateur — le contrôle ne prouverait rien`);
  process.exit(1);
}
ok(`départ : ${fiches.length} fiches de race et ${outils.length} pages du calculateur`);

/* ---- 2. AUCUN CODE DE SÉRIE RENDU ------------------------------------------------------------ */
/* Le corps visible ET les scripts embarqués : le calculateur construit son résultat côté client,
 * une table qui reviendrait y vivrait sans jamais paraître dans le corps servi. */
{
  const fautives = [];
  for (const p of [...fiches, ...outils]) {
    const { corps, scripts } = texteDe(readFileSync(p, "utf8"));
    const c = serieDans(corps), s = serieDans(scripts);
    if (c.length || s.length) fautives.push(`${rel(p)} : ${[...c.map((x) => `corps « ${x} »`), ...s.map((x) => `script « ${x} »`)].join(", ")}`);
  }
  if (fautives.length) {
    echec("2 rendu", `${fautives.length} page(s) publient un code de série`);
    for (const f of fautives.slice(0, 12)) console.error(`      ${f}`);
  } else ok(`2 rendu — aucun couple code/taille sur ${fiches.length + outils.length} pages, corps et scripts compris`);
}

/* ---- 3. CE QUI EST LÉGITIME EST TOUJOURS LÀ -------------------------------------------------- */
/* Une garde qui ne vérifierait que l'absence serait satisfaite par une page vide. */
{
  const ATTENDU = {
    en: "calculated from your measurements", fr: "calculées à partir des mesures saisies",
    es: "calculadas a partir de las medidas introducidas", pt: "calculadas a partir das medidas informadas",
  };
  const manquantes = [];
  for (const p of outils) {
    const lg = rel(p).match(OUTIL)?.[1] ?? "en";
    const { corps, scripts } = texteDe(readFileSync(p, "utf8"));
    const attendu = ATTENDU[lg];
    if (!attendu) { manquantes.push(`${rel(p)} : langue ${lg} non prévue`); continue; }
    if (!corps.includes(attendu) && !scripts.includes(attendu)) manquantes.push(`${rel(p)} : « ${attendu} » absent`);
  }
  if (manquantes.length) {
    echec("3 minimum calculé", `${manquantes.length} page(s) n'annoncent plus le minimum issu des mesures`);
    for (const m of manquantes.slice(0, 8)) console.error(`      ${m}`);
  } else ok(`3 minimum calculé — les ${outils.length} pages du calculateur l'annoncent, dans leur langue`);
}

/* ---- 4. LES DEUX MUTATIONS, SUR DES PAGES RÉELLES -------------------------------------------- */
/* Chacune remet « 500 / XL » là où il vivait, et exige que LA MÊME fonction le voie. */
{
  const cas = [
    /* LA MUTATION S'INSÈRE DANS LE CORPS, PAS APRÈS UNE ANCRE. Ma première rédaction faisait
       `ancre.after(noeud)` avec un repli sur `document.body` : quand le repli servait, le nœud
       devenait un FRÈRE de `<body>` et ne comptait plus dans `body.textContent`. La contre-épreuve
       rougissait alors sur elle-même, en annonçant zéro couple ajouté. */
    ["4 mutation fiche de race", fiches[0], (doc) => {
      const d = doc.createElement("div"); d.textContent = "500 / XL — 94×64×68 cm";
      doc.body.appendChild(d);
    }],
    ["4bis mutation calculateur", outils[0], (doc) => {
      const d = doc.createElement("div"); d.textContent = "500 / XL ≈ 94 × 64 × 68 cm";
      doc.body.appendChild(d);
    }],
  ];
  for (const [nom, page, muter] of cas) {
    const html = readFileSync(page, "utf8");
    const avant = serieDans(texteDe(html).corps).length;
    if (avant !== 0) { echec(nom, `la page témoin porte déjà ${avant} couple(s) : la contre-épreuve ne prouverait rien`); continue; }
    const dom = new JSDOM(html);
    muter(dom.window.document);
    const apres = serieDans(texteDe(dom.serialize()).corps);
    dom.window.close();
    if (apres.length !== 1 || !apres[0].startsWith("500")) echec(nom, `la mutation produit ${JSON.stringify(apres)} au lieu du seul « 500 / XL »`);
    else ok(`${nom} — « 500 / XL » réintroduit dans ${rel(page)} est vu`);
  }
}

console.log(defauts === 0
  ? "\n[caisses] aucune taille de caisse non sourcée n'est publiée ; le minimum calculé depuis les mesures, lui, l'est."
  : `\n[caisses] ${defauts} défaut(s).`);
process.exit(defauts === 0 ? 0 : 1);
