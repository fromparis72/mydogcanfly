/**
 * LA PHRASE D'ACCUEIL SUR LES CANAUX PROUVÉS — contre-épreuve du contre-test navigateur du 08/09/2026.
 *
 * L'accueil disait, dans les quatre langues : « Aucun canal de compagnie n'est encore confirmé par
 * une source officielle citée. » Deux clics plus loin, la fiche British Airways montrait un refus
 * cabine cité et daté du 05/09/2026. La phrase confondait « confirmé » et « confirmé OUVERT » :
 * vraie pour les ouvertures, fausse pour les refus.
 *
 * Elle est maintenant CALCULÉE à chaque build depuis la projection des politiques de canal — seuls
 * `allowed` et `denied` sortent de `projectPlacementPolicy` sur citation — et cette contre-épreuve
 * recompte de son côté, puis relit l'accueil construit dans ses zones publiques.
 *
 *   node --import tsx test-accueil-canaux-prouves.mjs --dist=packages/ui/dist
 *
 * `--dist=` EST OBLIGATOIRE, et son absence est un REFUS — pas un vert. Première rédaction
 * fautive, nommée : ce test lisait un dist par défaut et vivait dans `test:unit`, qui tourne en CI
 * AVANT le build ; il a rougi sur « index.html absent du dist » (run 34213137943). Localement je
 * l'avais joué après un build, et j'ai pris mon ordre d'exécution pour celui de la CI. Il suit
 * désormais la convention de `test-etape3-dom` : joué en CI après le build, sur le site complet.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadKB } from "@mydogcanfly/knowledge";
import { zonesDe } from "./test-lib/zones-publiques.mjs";

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
if (!DIST || !existsSync(DIST)) {
  console.error("[accueil-canaux] REFUS — `--dist=<chemin>` est obligatoire et doit exister.");
  console.error("                 Une garde qui se saute faute d'artefact ne garde rien.");
  process.exit(1);
}
let defauts = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const echec = (m, d) => { defauts++; console.log(`  ✗ ${m}${d ? ` — ${d}` : ""}`); };

console.log("=== L'accueil et les canaux prouvés ===");

/* 1. LE COMPTE, refait ici depuis la même projection que le site. */
const kb = loadKB();
const compte = { ouverts: 0, refus: 0, aConfirmer: 0, total: 0 };
for (const a of kb.airlines.values()) {
  for (const v of Object.values(a.premium?.policy ?? {})) {
    if (!v) continue;
    compte.total++;
    if (v.status === "allowed" || v.status === "accepted_with_conditions") compte.ouverts++;
    else if (v.status === "denied") compte.refus++;
    else compte.aConfirmer++;
  }
}
console.log(`  base : ${compte.total} politiques de canal — ${compte.ouverts} ouverte(s) prouvée(s), ${compte.refus} refus prouvé(s), ${compte.aConfirmer} à confirmer`);
if (compte.total === 0) echec("aucune politique de canal chargée — la contre-épreuve ne mord sur rien");

/* 2. LA PHRASE ATTENDUE, dans chaque langue, depuis les mêmes tables que le site. */
const tables = Object.fromEntries(["en", "fr", "es", "pt"].map((l) => [l, JSON.parse(readFileSync(`packages/knowledge/translations/${l}/strings.json`, "utf8"))]));
const cle = compte.ouverts === 0 ? "home.rated.sub.none_open" : "home.rated.sub.some_open";
const ANCIENNES = [
  /No airline channel is confirmed by a quoted official source yet/,
  /Aucun canal de compagnie n'est encore confirmé par une source officielle citée/,
  /ningún canal de aerolínea confirmado por una fuente oficial citada/i,
  /nenhum canal de companhia confirmado por uma fonte oficial citada/i,
];
const pages = { en: "index.html", fr: "fr/index.html", es: "es/index.html", pt: "pt/index.html" };
for (const [l, rel] of Object.entries(pages)) {
  const f = join(DIST, rel);
  if (!existsSync(f)) { echec(`${l} : ${rel} absent du dist`); continue; }
  const z = zonesDe(readFileSync(f, "utf8"));
  const tout = [z.titre, z.corps, z.metas, z.jsonLd, z.attributs].join("\n");
  const attendue = tables[l][cle].replace("{open}", String(compte.ouverts)).replace("{refusals}", String(compte.refus));
  if (!attendue || attendue === cle) echec(`${l} : la clé ${cle} manque dans strings.json`);
  else if (!z.corps.includes(attendue)) echec(`${l} : la phrase calculée n'est pas dans le corps de l'accueil`, attendue.slice(0, 80));
  else ok(`${l} : l'accueil dit « ${attendue.slice(0, 70)}… »`);
  const ancienne = ANCIENNES.find((re) => re.test(tout));
  if (ancienne) echec(`${l} : l'ancienne phrase « aucun canal confirmé » est encore publiée (une zone)`, String(ancienne));
  if (/\{(open|refusals)\}/.test(tout)) echec(`${l} : un gabarit {open}/{refusals} est publié tel quel`);
  if (compte.refus > 0 && z.corps.includes(attendue) && !attendue.includes(String(compte.refus))) echec(`${l} : la phrase ne porte pas le nombre de refus`);
}

/* 3. LE POSITIONNEMENT SEO ET LE CONTENU VISIBLE DES QUATRE ACCUEILS
      (14/09/2026, arbitrage de Philippe).
      Ils sont vérifiés ICI plutôt que dans un harnais neuf : ce fichier ouvre déjà les quatre
      pages d'accueil CONSTRUITES, dans les quatre langues, et tourne en CI après le build. Un
      second harnais qui rouvrirait les mêmes quatre fichiers serait une seconde définition de
      « ce que l'accueil annonce » — la faute que ce dépôt collectionne.

      CE QU'ON MESURE, ET POURQUOI CHAQUE LIGNE EXISTE :
        · le `<title>` et la `<meta name="description">` valent EXACTEMENT le texte arbitré ;
        · `og:title`, `og:description`, `twitter:title` et `twitter:description` réemploient déjà
          ces deux valeurs dans `Base.astro` : on exige la concordance plutôt que de la supposer,
          car c'est précisément le genre de recopie qui se désynchronise en silence ;
        · les ANCIENS titres et descriptions ne subsistent dans aucune zone publique ;
        · le H1, l'introduction, le premier H2 et le badge gratuit valent eux aussi EXACTEMENT les
          textes arbitrés : le positionnement du head et celui de la page ne peuvent pas diverger ;
        · le portugais est du portugais du Brésil, ANNONCÉ comme tel (`lang="pt-BR"`,
          `og:locale = pt_BR`), et sans repli : ses chaînes lui sont propres. */
const SEO_ATTENDU = {
  en: {
    title: "Find Airlines That Allow Dogs by Route | MyDogCanFly.com",
    description: "Find airlines that allow dogs on your route—for free. Compare cabin, hold and cargo options, breed restrictions, health and entry rules with cited sources.",
    h1: "Can my dog fly? Check which airlines allow dogs on your route",
    intro: "Compare cabin, hold and cargo options, breed restrictions, and destination health and entry rules. Confirmed information is sourced and dated; anything uncertain is clearly flagged.",
    h2: "Compare airline policies for your dog",
    badge: "100% free online tool",
  },
  fr: {
    title: "Chien en avion : l’outil gratuit et complet | MyDogCanFly",
    description: "Outil gratuit : trouve les compagnies pour ton chien et ton trajet. Compare cabine, soute, fret, restrictions de race et formalités, avec sources citées.",
    h1: "Ton chien peut-il prendre l’avion ? Vérifie quelles compagnies l’acceptent sur ton trajet",
    intro: "Compare les options en cabine, en soute ou en fret, les restrictions de race et les formalités sanitaires et administratives. Chaque information confirmée est sourcée et datée ; ce qui reste incertain est clairement signalé.",
    h2: "Compare les politiques des compagnies pour ton chien",
    badge: "Outil en ligne 100 % gratuit",
  },
  es: {
    title: "Aerolíneas que aceptan perros por ruta | Herramienta gratis",
    description: "Herramienta gratis y completa: encuentra aerolíneas para tu perro y ruta. Compara cabina, bodega, carga, restricciones, requisitos y fuentes citadas.",
    h1: "¿Puede volar mi perro? Revisa qué aerolíneas lo aceptan en tu ruta",
    intro: "Compara en una sola búsqueda las opciones en cabina, bodega o carga, las restricciones de raza y los requisitos sanitarios y de entrada. La información confirmada incluye fuentes y fechas; cualquier punto pendiente aparece claramente marcado.",
    h2: "Compara las políticas de las aerolíneas para tu perro",
    badge: "Herramienta en línea 100 % gratis",
  },
  pt: {
    title: "Companhias aéreas para cachorro por rota | Ferramenta grátis",
    description: "Ferramenta grátis: encontre companhias aéreas para seu cachorro e sua rota. Compare cabine, porão, carga, restrições e requisitos, com fontes citadas.",
    h1: "Meu cachorro pode voar? Confira quais companhias aéreas o aceitam na sua rota",
    intro: "Compare em uma única busca as opções de cabine, porão ou carga, as restrições de raça e os requisitos sanitários e de entrada. As informações confirmadas incluem fonte e data; qualquer ponto pendente aparece claramente marcado.",
    h2: "Compare as políticas das companhias aéreas para seu cachorro",
    badge: "Ferramenta online 100% grátis",
  },
};
/* Les textes REMPLACÉS. Ils ne sont pas effacés du dépôt : ils sont ce que la garde traque. */
const SEO_ANCIENS = [
  "Can My Dog Fly? Airline Conditions, Confirmed or To Check | MyDogCanFly",
  "Voyager avec son chien en avion : ce qui est confirmé, ce qui reste à vérifier",
  "¿Puede volar mi perro? Normas de las aerolíneas, con fuentes",
  "O meu cão pode voar? Regras das companhias, com fontes",
  "Airline conditions for dogs — cabin, hold and cargo",
  "Les conditions des compagnies pour les chiens — cabine, soute, fret",
  "Las condiciones de las aerolíneas para perros — cabina, bodega y carga",
  "As condições das companhias para cães — cabine, porão e carga",
  "Flying With a Dog: Airline Policies and Entry Rules",
  "Check airline policies and destination-country entry requirements for flying with your dog: cabin, hold, cargo, documents, restrictions, and sources.",
  "Voyager avec son chien : compagnies et formalités par pays",
  "Consultez les conditions des compagnies aériennes et du pays de destination pour voyager avec votre chien : cabine, soute, fret, documents et restrictions.",
  "Volar con perro: aerolíneas y requisitos por país",
  "Consulta las condiciones de las aerolíneas y del país de destino para viajar con tu perro: cabina, bodega, carga, documentos y restricciones.",
  "Viajar com cachorro: companhias e regras por país",
  "Consulte as regras das companhias aéreas e do país de destino para viajar com seu cachorro: cabine, porão, carga, documentos e restrições.",
];
{
  const decoder = (v) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'");
  const balise = (html, re) => { const m = html.match(re); return m ? decoder(m[1]) : null; };
  const texte = (v) => decoder(String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
  for (const [l, rel] of Object.entries(pages)) {
    const f = join(DIST, rel);
    if (!existsSync(f)) { echec(`SEO ${l} : ${rel} absent du dist`); continue; }
    const html = readFileSync(f, "utf8");
    const att = SEO_ATTENDU[l];
    const titre = balise(html, /<title>([\s\S]*?)<\/title>/);
    const desc = balise(html, /<meta name="description" content="([^"]*)"/);
    if (titre !== att.title) echec(`SEO ${l} : <title> inattendu`, JSON.stringify({ vu: titre, attendu: att.title }));
    else ok(`SEO ${l} : <title> exact — « ${att.title} »`);
    if (desc !== att.description) echec(`SEO ${l} : meta description inattendue`, JSON.stringify({ vu: desc?.slice(0, 90), attendu: att.description.slice(0, 90) }));
    else ok(`SEO ${l} : meta description exacte (${att.description.length} caractères)`);
    /* Les métadonnées sociales réemploient les deux mêmes valeurs : on le CONSTATE. */
    for (const [nom, re, valeur] of [
      ["og:title", /<meta property="og:title" content="([^"]*)"/, att.title],
      ["og:description", /<meta property="og:description" content="([^"]*)"/, att.description],
      ["twitter:title", /<meta name="twitter:title" content="([^"]*)"/, att.title],
      ["twitter:description", /<meta name="twitter:description" content="([^"]*)"/, att.description],
    ]) {
      const vu = balise(html, re);
      if (vu !== valeur) echec(`SEO ${l} : ${nom} ne concorde pas avec la valeur arbitrée`, JSON.stringify({ vu: vu?.slice(0, 80) }));
    }
    /* Les anciens textes ne subsistent nulle part dans les zones publiques. */
    const z = zonesDe(html);
    const tout = [z.titre, z.corps, z.metas, z.jsonLd, z.attributs].join("\n");
    const survivant = SEO_ANCIENS.find((v) => tout.includes(v));
    if (survivant) echec(`SEO ${l} : un ancien texte est encore publié`, survivant);
    /* Le contenu visible est vérifié dans ses BALISES, pas par une recherche globale qui pourrait
       trouver la même phrase dans un bouton, un script ou un bloc JSON. */
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => texte(m[1]));
    const heroSub = texte(html.match(/<p class="hero__sub[^>]*>([\s\S]*?)<\/p>/)?.[1]);
    const premierH2 = texte(html.match(/<h2 class="mdcf-h2"[^>]*>([\s\S]*?)<\/h2>/)?.[1]);
    const badge = texte(html.match(/<p class="finder-free"[^>]*>([\s\S]*?)<\/p>/)?.[1]);
    if (h1s.length !== 1) echec(`SEO ${l} : l'accueil doit contenir exactement un H1`, String(h1s.length));
    else if (h1s[0] !== att.h1) echec(`SEO ${l} : H1 inattendu`, JSON.stringify({ vu: h1s[0], attendu: att.h1 }));
    else ok(`SEO ${l} : H1 unique et exact`);
    if (heroSub !== att.intro) echec(`SEO ${l} : introduction inattendue`, JSON.stringify({ vu: heroSub?.slice(0, 80) }));
    if (premierH2 !== att.h2) echec(`SEO ${l} : premier H2 inattendu`, JSON.stringify({ vu: premierH2 }));
    if (badge !== `✓ ${att.badge}`) echec(`SEO ${l} : badge de gratuité inattendu`, JSON.stringify({ vu: badge }));
    if (z.corps.includes(att.title)) echec(`SEO ${l} : le titre SEO est publié dans le CORPS de la page`, att.title);
    if (z.corps.includes(att.description)) echec(`SEO ${l} : la description SEO est publiée dans le CORPS de la page`);
  }
  /* Le portugais est du portugais du BRÉSIL, annoncé comme tel — et il ne se replie sur personne. */
  const pt = readFileSync(join(DIST, pages.pt), "utf8");
  if (!/<html lang="pt-BR"/.test(pt)) echec("SEO pt : la page ne s'annonce pas en pt-BR");
  else ok("SEO pt : la page s'annonce en pt-BR");
  if (!/<meta property="og:locale" content="pt_BR"/.test(pt)) echec("SEO pt : og:locale n'est pas pt_BR");
  for (const [autre, texte] of [["en", SEO_ATTENDU.en.title], ["fr", SEO_ATTENDU.fr.title], ["es", SEO_ATTENDU.es.title]]) {
    if (pt.includes(texte)) echec(`SEO pt : la page porte le titre ${autre} — repli de langue`, texte);
  }
  /* NON-VACUITÉ : les quatre titres et les quatre descriptions sont DISTINCTS deux à deux ; sans
     cela, une langue repliée sur une autre passerait tous les contrôles ci-dessus. */
  const titres = Object.values(SEO_ATTENDU).map((v) => v.title);
  const descs = Object.values(SEO_ATTENDU).map((v) => v.description);
  if (new Set(titres).size !== 4 || new Set(descs).size !== 4) echec("SEO : deux langues partagent un titre ou une description — le contrôle ne mordrait plus");
  else ok("SEO : les quatre titres et les quatre descriptions sont distincts — aucune langue n'en replie une autre");
}

/* 4. NON-VACUITÉ : la phrase calculée pour un autre compte serait différente — sinon le contrôle
      accepterait une phrase sans nombre. */
{
  const a = tables.fr[cle].replace("{open}", "0").replace("{refusals}", "1");
  const b = tables.fr[cle].replace("{open}", "0").replace("{refusals}", "7");
  if (a === b) echec("la phrase ne dépend pas du nombre de refus");
  else ok("la phrase change avec le compte — le contrôle mord");
}

console.log(defauts ? `\n[accueil-canaux] ÉCHEC — ${defauts} contre-épreuve(s) en défaut` : "\n[accueil-canaux] l'accueil dit exactement ce que la base prouve : ouvertures et refus, comptés au build.");
process.exit(defauts ? 1 : 0);
