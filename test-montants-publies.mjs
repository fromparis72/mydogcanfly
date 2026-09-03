/**
 * LA GARDE PERMANENTE : AUCUN MONTANT NUMÉRIQUE SUR LES FICHES COMPAGNIES PUBLIÉES.
 *
 *   node test-montants-publies.mjs --dist=packages/ui/dist
 *
 * POURQUOI ELLE LIT LE HTML SERVI, ET PAS LES SOURCES. Le micro-lot Tarifs a déjà été « corrigé »
 * trois fois en relisant les fiches YAML, et trois fois il restait des prix à l'écran : le champ
 * `fee`, retiré du gabarit, laissait intacts les prix RÉÉCRITS ailleurs — dans la description de
 * la page, dans une note « bon à savoir », dans le détail d'un canal. Une relecture cherche là où
 * elle pense à regarder ; un contrôle qui lit le HTML rendu cherche partout.
 *
 * POURQUOI PLUSIEURS ZONES, SÉPARÉMENT. Une même phrase source — `metaDesc` — est recopiée par le
 * gabarit en QUATRE exemplaires publics par page : `<meta name="description">`, `og:description`,
 * `twitter:description` et la description du JSON-LD. Un contrôle qui ne regarderait que le corps
 * visible les manquerait tous les quatre, et ce sont précisément ceux que lisent les moteurs et
 * les aperçus de partage. Le `<title>` est une cinquième surface, ajoutée à la contre-revue du
 * 01/09/2026 : elle n'était contrôlée nulle part.
 *
 * ET POURQUOI LE TEXTE EST LU DÉCODÉ. `zonesDe` parse le document au lieu de le découper à
 * l'expression régulière : « 199 &euro; » s'affiche « 199 € » chez le lecteur, et un montant écrit
 * « \u20ac199 » dans le JSON-LD est lu « €199 » par le moteur. Les contre-épreuves 6, 7 et 8
 * exercent exactement ces trois formes.
 *
 * CE QUE LA GARDE N'INTERDIT PAS. Elle ne demande pas le silence sur les tarifs : elle interdit le
 * CHIFFRE. Une phrase qualitative — « d'autres animaux peuvent voyager via Virgin Australia Cargo,
 * sous réserve de route, d'appareil, de partenaire et d'acceptation préalable » — reste publiée
 * telle quelle, et la contre-épreuve 4 vérifie qu'elle l'est vraiment. De même, poids, dimensions,
 * durées, dates et pourcentages traversent la garde sans la faire rougir : le détecteur partagé ne
 * voit un montant que si un marqueur de devise le borde.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { compter, trouver, zonesDe } from "./test-lib/montants.mjs";

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
if (!DIST || !existsSync(DIST)) {
  console.error("[montants] REFUS — `--dist=<chemin>` est obligatoire et doit exister.");
  console.error("           Une garde qui se saute faute d'artefact ne garde rien.");
  process.exit(1);
}

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/* ---- LES PAGES CONCERNÉES ------------------------------------------------------------------ */
/* Les fiches d'une compagnie, dans les quatre langues : `/airlines/<slug>/` en anglais et
 * `/<langue>/airlines/<slug>/` ailleurs. L'index `/airlines/` n'est pas une fiche. */
const pages = [];
(function marcher(d) {
  for (const e of [...readdirSync(d)].sort()) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) marcher(p);
    else if (e === "index.html") pages.push(p);
  }
})(DIST);

const FICHE = /(?:^|\/)(?:([a-z]{2})\/)?airlines\/([^/]+)\/index\.html$/;
const fiches = [];
for (const p of pages) {
  const m = p.slice(DIST.length).replace(/^\/+/, "").match(FICHE);
  if (m) fiches.push({ chemin: p, langue: m[1] ?? "en", slug: m[2] });
}

const langues = new Set(fiches.map((f) => f.langue));
const slugs = new Set(fiches.map((f) => f.slug));
if (fiches.length === 0) { echec("départ", "aucune fiche compagnie trouvée sous le dist"); process.exit(1); }
if (langues.size !== 4) { echec("départ", `${langues.size} langue(s) au lieu de 4 : ${[...langues].join(", ")}`); }
else ok(`départ : ${fiches.length} fiches, ${slugs.size} compagnies × ${langues.size} langues (${[...langues].sort().join(", ")})`);

/* ---- 1. AUCUN MONTANT, DANS AUCUNE DES QUATRE ZONES ---------------------------------------- */
/** Les montants d'une page, par zone. Le contrôle 1 et les contre-épreuves 2 et 3 appellent CETTE
 *  fonction, pas une copie : une mutation qui rougirait ici sans rougir là ne prouverait rien. */
function montantsDe(html) {
  const z = zonesDe(html);
  return {
    titre: trouver(z.titre), corps: trouver(z.corps), metas: trouver(z.metas),
    jsonLd: trouver(z.jsonLd), attributs: trouver(z.attributs), jsonLdInvalide: z.jsonLdInvalide,
  };
}

{
  const fautives = [];
  let total = 0, illisibles = 0;
  for (const f of fiches) {
    const m = montantsDe(readFileSync(f.chemin, "utf8"));
    illisibles += m.jsonLdInvalide;
    const n = m.titre.length + m.corps.length + m.metas.length + m.jsonLd.length + m.attributs.length;
    if (!n) continue;
    total += n;
    fautives.push(`${f.langue}/${f.slug} : `
      + [["titre", m.titre], ["corps", m.corps], ["meta", m.metas], ["json-ld", m.jsonLd], ["attributs-accessibles", m.attributs]]
        .filter(([, v]) => v.length).map(([z, v]) => `${z} [${v.map((x) => x.texte).join(", ")}]`).join(" ; "));
  }
  /* UN JSON-LD ILLISIBLE N'EST PAS UN JSON-LD VIDE. S'il ne se parse pas, on ne sait rien de son
   * contenu : le taire reviendrait à compter zéro montant dans une zone jamais regardée. */
  if (illisibles) echec("1 aucun montant publié", `${illisibles} bloc(s) JSON-LD illisible(s) : leur contenu n'a pas pu être jugé`);
  if (fautives.length) {
    echec("1 aucun montant publié", `${total} occurrence(s) sur ${fautives.length} fiche(s)`);
    for (const l of fautives.slice(0, 40)) console.error(`      ${l}`);
    if (fautives.length > 40) console.error(`      … et ${fautives.length - 40} autres`);
  } else if (!illisibles) ok(`1 aucun montant publié — 0 occurrence sur ${fiches.length} fiches, titre + corps + métas + JSON-LD`);
}

/* ---- 2. CONTRE-ÉPREUVE : UNE MUTATION DU CORPS VISIBLE DOIT ROUGIR -------------------------- */
/* Une garde qui ne rougit jamais ne prouve rien : peut-être ne lit-elle rien. On injecte un
 * montant là où le gabarit écrit vraiment de la prose visible — le corps d'un bloc `.k` — et on
 * exige que la garde le voie DANS LE CORPS, pas ailleurs.
 *
 * ELLE JUGE UN ÉCART, PAS UN TOTAL, et c'est une correction : la première rédaction exigeait que
 * la page mutée porte EXACTEMENT un montant, ce qui la rendait dépendante de la propreté de la
 * page choisie — elle rougissait sur une fiche qui en portait déjà un, en disant « vu 199 € et
 * 8 € », c'est-à-dire en accusant la mutation d'un défaut qui n'était pas le sien. L'écart, lui,
 * mesure ce que la mutation AJOUTE, quelle que soit la page. Que la page soit propre est une
 * autre affirmation : c'est le contrôle 1 qui la tient, séparément. */
{
  const f = fiches.find((x) => x.langue === "fr") ?? fiches[0];
  const html = readFileSync(f.chemin, "utf8");
  const ancre = html.match(/<div class="k"[^>]*>/);
  if (!ancre) echec("2 mutation du corps", `aucun bloc « .k » sur ${f.langue}/${f.slug} : l'ancre de mutation n'existe plus`);
  else {
    const mute = html.replace(ancre[0], `${ancre[0]}Supplément de 199 € par trajet. `);
    if (mute === html) echec("2 mutation du corps", "la mutation n'a rien changé");
    else {
      const avant = montantsDe(html), apres = montantsDe(mute);
      const ajoutes = apres.corps.map((x) => x.texte);
      for (const t of avant.corps.map((x) => x.texte)) ajoutes.splice(ajoutes.indexOf(t), 1);
      if (ajoutes.length !== 1 || ajoutes[0] !== "199 €")
        echec("2 mutation du corps", `la mutation ajoute ${JSON.stringify(ajoutes)} au lieu du seul « 199 € »`);
      else if (apres.metas.length !== avant.metas.length || apres.jsonLd.length !== avant.jsonLd.length)
        echec("2 mutation du corps", "une mutation du corps a bougé le compte des métas ou du JSON-LD : les zones se recouvrent");
      else ok(`2 mutation du corps — « 199 € » injecté dans ${f.langue}/${f.slug} est vu dans le corps, et là seulement`);
    }
  }
}

/* ---- 3. CONTRE-ÉPREUVE : UNE MUTATION DE `metaDesc` DOIT ROUGIR DANS LES MÉTAS ET LE JSON-LD -- */
/* Celle-ci porte sur la surface qui m'avait échappé. Elle commence par ÉTABLIR le fait qu'elle
 * suppose — la description de la fiche est bien recopiée dans les trois balises `<meta>` ET dans
 * le JSON-LD — puis mute cette phrase partout où elle paraît. Si le gabarit cessait un jour de la
 * recopier dans le JSON-LD, l'ancrage échoue ici, au lieu de laisser la mutation faire semblant. */
{
  const f = fiches.find((x) => x.langue === "fr") ?? fiches[0];
  const html = readFileSync(f.chemin, "utf8");
  const desc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1];
  const jsonLd = zonesDe(html).jsonLd;
  const metas = zonesDe(html).metas;

  if (!desc) echec("3 mutation de metaDesc", `pas de <meta name="description"> sur ${f.langue}/${f.slug}`);
  else {
    const exemplaires = (metas.split(desc).length - 1) + (jsonLd.split(desc).length - 1);
    if (metas.split(desc).length - 1 !== 3)
      echec("3 mutation de metaDesc", `la description ne paraît que ${metas.split(desc).length - 1} fois dans les balises <meta> au lieu de 3 (description, og, twitter)`);
    else if (jsonLd.split(desc).length - 1 < 1)
      echec("3 mutation de metaDesc", "la description n'est plus recopiée dans le JSON-LD : l'ancrage de la contre-épreuve est caduc");
    else {
      const mute = html.split(desc).join(`${desc} Tarif animal : 199 €.`);
      const avant = montantsDe(html), apres = montantsDe(mute);
      const dMetas = apres.metas.length - avant.metas.length;
      const dJson = apres.jsonLd.length - avant.jsonLd.length;
      const nouveaux = [...apres.metas, ...apres.jsonLd].filter((x) => x.texte === "199 €").length;
      if (dMetas !== 3) echec("3 mutation de metaDesc", `la garde voit ${dMetas} montant(s) de plus dans les balises <meta>, attendu 3`);
      else if (dJson < 1) echec("3 mutation de metaDesc", `la garde voit ${dJson} montant de plus dans le JSON-LD, attendu au moins 1`);
      else if (nouveaux !== dMetas + dJson) echec("3 mutation de metaDesc", `${nouveaux} occurrence(s) de « 199 € » pour ${dMetas + dJson} montants ajoutés`);
      else ok(`3 mutation de metaDesc — ${exemplaires} exemplaires publics de la description sur ${f.langue}/${f.slug}, les ${dMetas + dJson} vus`);
    }
  }
}

/* ---- 4. LA PHRASE QUALITATIVE DE VIRGIN AUSTRALIA RESTE PUBLIÉE ----------------------------- */
/* L'arbitrage du 31/08/2026 est explicite : on retire les chiffres, pas les faits de transport.
 * Si une rédaction future « nettoyait » cette phrase, ce contrôle le dirait. */
{
  const cibles = fiches.filter((x) => x.slug.includes("virgin-australia") || x.slug.includes("virgin_australia"));
  if (!cibles.length) echec("4 Virgin Australia", "aucune fiche Virgin Australia dans le dist");
  else {
    const manquantes = cibles.filter((c) => !/Virgin Australia Cargo/i.test(readFileSync(c.chemin, "utf8")));
    if (manquantes.length)
      echec("4 Virgin Australia", `la mention « Virgin Australia Cargo » a disparu de ${manquantes.map((m) => m.langue).join(", ")}`);
    else ok(`4 Virgin Australia — la phrase qualitative reste publiée dans les ${cibles.length} langues`);
  }
}

/* ---- 6, 7, 8. LES TROIS FORMES QUI TRAVERSAIENT LA GARDE ------------------------------------ */
/* Elles viennent de la contre-revue du 01/09/2026 et ne sont pas théoriques : chacune a été
 * reproduite sur la garde précédente, qui restait VERTE. Elles muent une vraie page construite,
 * là où le gabarit écrit vraiment, et exigent que la zone concernée — et elle seule — bouge. */
{
  const f = fiches.find((x) => x.langue === "fr") ?? fiches[0];
  const html = readFileSync(f.chemin, "utf8");
  const avant = montantsDe(html);
  const ecart = (mute, zone) => {
    const apres = montantsDe(mute);
    const bouge = ["titre", "corps", "metas", "jsonLd"].filter((z) => apres[z].length !== avant[z].length);
    return { delta: apres[zone].length - avant[zone].length, bouge, textes: apres[zone].map((x) => x.texte) };
  };

  /* 6. L'ENTITÉ HTML. « 199 &euro; » s'affiche « 199 € » : le lecteur voit un prix, la garde
   *    précédente ne voyait qu'une suite de lettres. Les trois écritures sont exercées. */
  {
    const ancre = html.match(/<div class="k"[^>]*>/);
    const formes = { "&euro;": "199 &euro;", "&#8364;": "199 &#8364;", "&#x20AC;": "199 &#x20AC;" };
    const rates = [];
    for (const [nom, injecte] of Object.entries(formes)) {
      if (!ancre) { rates.push(`${nom} : aucune ancre « .k »`); continue; }
      const r = ecart(html.replace(ancre[0], `${ancre[0]}${injecte} `), "corps");
      if (r.delta !== 1 || r.bouge.join() !== "corps") rates.push(`${nom} : delta ${r.delta}, zones ${r.bouge.join("+") || "aucune"}`);
    }
    if (rates.length) echec("6 entité HTML dans le corps", rates.join(" ; "));
    else ok(`6 entité HTML dans le corps — « &euro; », « &#8364; » et « &#x20AC; » sont lus comme « € » sur ${f.langue}/${f.slug}`);
  }

  /* 7. LE TITRE. Il n'entrait dans aucune zone : un prix y était publiquement affiché, en tête de
   *    l'onglet et du résultat de recherche, sans que rien ne rougisse. */
  {
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!t) echec("7 montant dans le titre", `pas de <title> sur ${f.langue}/${f.slug}`);
    else {
      const r = ecart(html.replace(t[0], `<title>${t[1]} — 199 €</title>`), "titre");
      if (r.delta !== 1 || r.bouge.join() !== "titre") echec("7 montant dans le titre", `delta ${r.delta}, zones ${r.bouge.join("+") || "aucune"}`);
      else ok(`7 montant dans le titre — « 199 € » ajouté au <title> de ${f.langue}/${f.slug} est vu, et là seulement`);
    }
  }

  /* 8. LA DEVISE ÉCHAPPÉE DU JSON-LD. JSON écrit « \u20ac » là où le moteur lit « € » ; comparer
   *    le texte brut du bloc revenait à chercher un caractère qui n'y figure jamais. */
  {
    const bloc = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
    if (!bloc) echec("8 devise échappée dans le JSON-LD", `pas de bloc ld+json sur ${f.langue}/${f.slug}`);
    else {
      let objet;
      try { objet = JSON.parse(bloc[1]); } catch { objet = null; }
      if (!objet) echec("8 devise échappée dans le JSON-LD", "le bloc ld+json de la page ne se parse pas");
      else {
        const sali = Array.isArray(objet) ? [{ ...objet[0], description: `${objet[0].description ?? ""} \u20ac199` }, ...objet.slice(1)]
          : { ...objet, description: `${objet.description ?? ""} \u20ac199` };
        /* On réécrit le bloc avec les échappements JSON — c'est bien la forme servie. */
        const brut = JSON.stringify(sali).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
        if (brut.includes("\\u20ac") === false) echec("8 devise échappée dans le JSON-LD", "la mutation n'a pas produit d'échappement");
        else {
          const r = ecart(html.replace(bloc[0], bloc[0].replace(bloc[1], brut)), "jsonLd");
          if (r.delta !== 1 || r.bouge.join() !== "jsonLd") echec("8 devise échappée dans le JSON-LD", `delta ${r.delta}, zones ${r.bouge.join("+") || "aucune"}`);
          else ok(`8 devise échappée dans le JSON-LD — « \\u20ac199 » est lu « €199 » sur ${f.langue}/${f.slug}`);
        }
      }
    }
  }
}

/* ---- 5. LE DÉTECTEUR NE CONFOND PAS UN CHIFFRE AVEC UN PRIX --------------------------------- */
/* Sans ce contrôle, la garde pourrait passer au vert en devenant aveugle — ou rougir sur les
 * poids et les dimensions, ce qui obligerait à les retirer des fiches. Les deux sens sont tenus. */
{
  const VUS = ["$150", "150 $", "€200", "200 €", "ZAR 300", "300 ZAR", "€89.99", "89,99 €", "CHF 90",
    "90 CHF", "¥5,000", "¥5.000", "5 000 ¥", "US$ 500", "€8", "180 THB", "385 AED",
    /* Alias de symbole, ajoutés à la contre-revue du 01/09/2026 — ils traversaient les DEUX
       contrôles, celui des sources comme celui du rendu. Exercés avant ET après le nombre. */
    "RMB 500", "500 RMB", "RM 500", "500 RM", "Rp 500", "500 Rp", "Rs 500", "500 Rs", "Rs. 500",
    "₱300", "300 PHP", "PKR 5 000", "1 200 MYR",
    /* LES SIX CODES QUI ÉTAIENT ÉCARTÉS DU MONDE ENTIER parce qu'ils s'écrivent comme des mots.
       Ils sont maintenant vus : c'est la CASSE qui sépare le code du mot, pas une liste noire. */
    "ALL 4 000", "CUP 500", "TOP 100", "GEL 100", "SOS 500", "BSD 300",
    /* UN PRIX RAPPORTÉ À UN NOMBRE DE PERSONNES RESTE UN PRIX. Deux rédactions d'une « règle du
       rapport », destinée à écarter « SOS 24/7 », ont rendu ces trois formes invisibles. Elles
       sont ordinaires, et un faux négatif tarifaire est précisément ce que ce lot interdit. */
    "€100/2 personnes", "USD 100/2 passengers", "SOS 500/2 trajets", "€200/trajet",
    "1000/1100 TRY",
    /* LA CASSE N'EST PAS UNE CONDITION. Exiger la capitale évitait « Top 10 », mais rendait
       invisibles « Usd 100 », « eur 99 » et « cad 200 » — des écritures tarifaires plausibles.
       Les trois casses de chaque code sont exercées, avant ET après le nombre. */
    "USD 100", "Usd 100", "usd 100", "EUR 99", "Eur 99", "eur 99", "CAD 200", "cad 200",
    "100 usd", "99 Eur"];
  const REFUSES = ["8 kg", "55 × 35 × 25 cm", "2026-07-11", "10 h 30", "100 %", "Boeing 737",
    "limite 32 kg", "1 500 g", "score 50/100", "quatre animaux par vol", "3 mois", "23 kg",
    /* CE QUE LE DÉTECTEUR NE PEUT PAS CONFONDRE, ET PAR STRUCTURE : sans marqueur de devise
       adjacent, aucun nombre n'est un montant, si gros soit-il. */
    "ouvert 24/7", "BSD-3-Clause", "note 4/5", "score 50/100"];
  /* LES FAUX POSITIFS ASSUMÉS, CONSIGNÉS ICI POUR QU'AUCUN NE SE DÉCOUVRE UN JOUR PAR SURPRISE.
     Cinq expressions ordinaires portent, par accident, un code ISO devant ou derrière un nombre :
     ALL, CUP, TOP, GEL et SOS. Le détecteur les voit, et ce ne sont pas des prix.

     AUCUNE N'EST BORDÉE, ET C'EST MESURÉ, PAS SUPPOSÉ. Balayage des 103 fiches sources et des 408
     fiches construites, dans les quatre zones publiques : zéro occurrence de l'une d'elles. Les
     border coûterait, selon la borne choisie, six devises ou toutes leurs écritures minuscules —
     c'est-à-dire des tarifs invisibles, ce que ce lot interdit. Le jour où une fiche en écrira
     une, la garde rougira et il faudra trancher par une exception bornée à un chemin et à un
     fragment exact, AU CONTRÔLE APPELANT, jamais dans le détecteur. Un faux positif se voit et se
     discute ; un faux négatif tarifaire, non.

     Le contrôle ci-dessous exige que chacune soit RÉELLEMENT vue : si le détecteur cessait de les
     voir, ce commentaire mentirait, et il rougirait pour le dire. */
  const FAUX_POSITIFS_ASSUMES = ["SOS 24/7", "All 4 dogs", "World Cup 2026", "Top 10", "gel 100 ml"];
  const rates = VUS.filter((t) => compter(t) !== 1);
  const faux = REFUSES.filter((t) => compter(t) !== 0);
  const dementis = FAUX_POSITIFS_ASSUMES.filter((t) => compter(t) === 0);
  if (rates.length) echec("5 détecteur", `formes non vues : ${rates.join(", ")}`);
  else if (faux.length) echec("5 détecteur", `pris pour des montants : ${faux.join(", ")}`);
  else if (dementis.length) echec("5 détecteur", `faux positif déclaré mais inexistant : ${dementis.join(", ")} — le commentaire ment`);
  else ok(`5 détecteur — ${VUS.length} formes vues, ${REFUSES.length} pièges refusés, `
    + `${FAUX_POSITIFS_ASSUMES.length} faux positifs assumés et déclarés (${FAUX_POSITIFS_ASSUMES.join(" · ")})`);
}

console.log(defauts === 0
  ? `\n[montants] ${fiches.length} fiches publiées, aucun montant numérique.`
  : `\n[montants] ${defauts} défaut(s).`);
process.exit(defauts === 0 ? 0 : 1);
