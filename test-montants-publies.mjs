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
 * POURQUOI LES QUATRE ZONES, SÉPARÉMENT. Une même phrase source — `metaDesc` — est recopiée par le
 * gabarit en QUATRE exemplaires publics par page : `<meta name="description">`, `og:description`,
 * `twitter:description` et la description du JSON-LD. Un contrôle qui ne regarderait que le corps
 * visible les manquerait tous les quatre, et ce sont précisément ceux que lisent les moteurs et
 * les aperçus de partage.
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
  return { corps: trouver(z.corps), metas: trouver(z.metas), jsonLd: trouver(z.jsonLd) };
}

{
  const fautives = [];
  let total = 0;
  for (const f of fiches) {
    const m = montantsDe(readFileSync(f.chemin, "utf8"));
    const n = m.corps.length + m.metas.length + m.jsonLd.length;
    if (!n) continue;
    total += n;
    fautives.push(`${f.langue}/${f.slug} : `
      + [["corps", m.corps], ["meta", m.metas], ["json-ld", m.jsonLd]]
        .filter(([, v]) => v.length).map(([z, v]) => `${z} [${v.map((x) => x.texte).join(", ")}]`).join(" ; "));
  }
  if (fautives.length) {
    echec("1 aucun montant publié", `${total} occurrence(s) sur ${fautives.length} fiche(s)`);
    for (const l of fautives.slice(0, 40)) console.error(`      ${l}`);
    if (fautives.length > 40) console.error(`      … et ${fautives.length - 40} autres`);
  } else ok(`1 aucun montant publié — 0 occurrence sur ${fiches.length} fiches, corps + métas + JSON-LD`);
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

/* ---- 5. LE DÉTECTEUR NE CONFOND PAS UN CHIFFRE AVEC UN PRIX --------------------------------- */
/* Sans ce contrôle, la garde pourrait passer au vert en devenant aveugle — ou rougir sur les
 * poids et les dimensions, ce qui obligerait à les retirer des fiches. Les deux sens sont tenus. */
{
  const VUS = ["$150", "150 $", "€200", "200 €", "ZAR 300", "300 ZAR", "€89.99", "89,99 €", "CHF 90",
    "90 CHF", "¥5,000", "¥5.000", "5 000 ¥", "US$ 500", "€8", "180 THB", "385 AED"];
  const REFUSES = ["8 kg", "55 × 35 × 25 cm", "2026-07-11", "10 h 30", "100 %", "Boeing 737",
    "limite 32 kg", "1 500 g", "score 50/100", "quatre animaux par vol", "3 mois", "23 kg"];
  const rates = VUS.filter((t) => compter(t) !== 1);
  const faux = REFUSES.filter((t) => compter(t) !== 0);
  if (rates.length) echec("5 détecteur", `formes non vues : ${rates.join(", ")}`);
  else if (faux.length) echec("5 détecteur", `pris pour des montants : ${faux.join(", ")}`);
  else ok(`5 détecteur — ${VUS.length} formes vues, ${REFUSES.length} pièges refusés`);
}

console.log(defauts === 0
  ? `\n[montants] ${fiches.length} fiches publiées, aucun montant numérique.`
  : `\n[montants] ${defauts} défaut(s).`);
process.exit(defauts === 0 ? 0 : 1);
