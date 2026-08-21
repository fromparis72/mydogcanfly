/**
 * LA CARTE D'IDENTITÉ D'UN SITE CONSTRUIT — producteur et validateur, au même endroit.
 *
 * `packages/ui/dist` est ignoré par git : rien, en le lisant, ne dit de QUELLE version il sort.
 * Un dossier de mesure qui s'en contente parce qu'il « compte assez de pages » peut donc valider
 * un site construit d'un autre commit, ou amputé de centaines de pages qu'il ne regarde pas.
 *
 * POURQUOI CE MODULE EXISTE PLUTÔT QUE QUATRE COPIES. La première version écrivait la carte dans
 * `build-ci.mjs` ET `build-preview.mjs`, puis la relisait dans T0-B3-d ET T0-B3-e — quatre copies
 * d'un même contrat, qui avaient déjà commencé à diverger : l'une des deux écritures portait un
 * antislash littéral au lieu d'un saut de ligne. Un contrat écrit quatre fois n'est pas un contrat.
 * Relevé par la contre-revue du 20/08/2026.
 *
 * CE QUE L'EMPREINTE COUVRE, et pourquoi chaque entrée y est :
 *   · les trois arbres de sources dont le site est fait — le contenu des pages ;
 *   · `package.json`, `package-lock.json`, `.nvmrc` — un site construit avec d'autres dépendances
 *     ou un autre Node n'est pas le même site, et ces fichiers ne sont dans aucun des trois arbres ;
 *   · les PARAMÈTRES du build — `BUILD_ONLY`, `BUILD_SLUGS`, l'adresse de l'API, l'environnement :
 *     le même code sous d'autres paramètres produit un autre site, et c'est précisément la
 *     différence entre un build réduit et un build complet.
 *
 * LA PROPRETÉ EST MESURÉE SUR LE PÉRIMÈTRE ANNONCÉ, ni plus ni moins. Une modification dans
 * `mesures/` ne périme pas un site ; une modification dans `packages/ui`, si. Exiger l'arbre
 * ENTIER propre — ce que faisait la première version malgré son propre commentaire — rendait la
 * garde inutilisable : resceller un dossier salit `mesures/`, et le dossier suivant refusait alors
 * de mesurer un site qui n'avait pas bougé d'un octet.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Les arbres de sources dont le site est fait. */
export const ARBRES = ["packages/ui", "packages/knowledge", "packages/engine"];
/** Les fichiers qui déterminent le build sans appartenir à ces arbres. */
export const FICHIERS = ["package.json", "package-lock.json", ".nvmrc"];
/** Les variables d'environnement qui changent le site produit. */
export const PARAMETRES = ["BUILD_ONLY", "BUILD_SLUGS", "PUBLIC_API_BASE", "PUBLIC_SITE_ENV"];

const NOM = ".provenance.json";
const git = (...a) => {
  try { return execFileSync("git", a, { encoding: "utf8" }).trim(); } catch { return ""; }
};

/** Le nombre de pages HTML d'un site construit — `_astro` exclu, comme partout ailleurs. */
export function compterPages(dist) {
  if (!existsSync(dist)) return 0;
  let n = 0;
  for (const e of readdirSync(dist, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== "_astro") n += compterPages(join(dist, e.name)); }
    else if (e.name.endsWith(".html")) n++;
  }
  return n;
}

/** L'empreinte des sources : arbres, fichiers déterminants, paramètres du build. */
export function empreinte(env = process.env) {
  const sources = {};
  for (const d of ARBRES) sources[d] = git("rev-parse", `HEAD:${d}`);
  for (const f of FICHIERS) sources[f] = git("hash-object", f);
  const parametres = {};
  for (const p of PARAMETRES) parametres[p] = env[p] ?? null;
  return { sources, parametres };
}

/** L'arbre est-il sale SUR LE PÉRIMÈTRE ANNONCÉ ? Renvoie le relevé, ou "". */
export const salete = () =>
  git("status", "--porcelain", "--untracked-files=all", "--", ...ARBRES, ...FICHIERS);

/** Déposer la carte d'identité dans le site construit. */
export function ecrireProvenance(dist, portee, env = process.env) {
  const { sources, parametres } = empreinte(env);
  writeFileSync(join(dist, NOM), JSON.stringify({
    sha: git("rev-parse", "HEAD"),
    arbre_propre: salete() === "",
    sources, parametres, portee,
    pages: compterPages(dist),
  }, null, 2) + "\n");
}

/**
 * Relire la carte et la confronter à l'état courant. Renvoie la liste des écarts — vide si le
 * site correspond aux sources. `porteeAttendue` vaut « complet » pour les dossiers de mesure.
 */
export function verifierProvenance(dist, porteeAttendue = "complet") {
  const chemin = join(dist, NOM);
  if (!existsSync(chemin)) {
    return [`${chemin} absent : impossible de savoir de quelle version ce site a été construit. `
      + "`npm run build:ci -- --complet` le déposera."];
  }
  let prov;
  try { prov = JSON.parse(readFileSync(chemin, "utf8")); }
  catch (e) { return [`${chemin} illisible : ${e.message}`]; }

  const ecarts = [];
  /* LE SHA DU COMMIT EST INSCRIT POUR LE LECTEUR, ET NE VAUT PAS EXIGENCE — quatrième fois que je
     dessine ce périmètre trop large, et cette fois le contrôle en trop était STRICTEMENT plus
     faible qu'un autre déjà présent. Tout commit déplace `HEAD`, y compris celui qui rescelle un
     dossier ou corrige une phrase : la carte devenait périmée sans que le site ait bougé d'un
     octet, et il fallait douze minutes de reconstruction pour rien. Ce qui détermine le site, ce
     sont les EMPREINTES vérifiées plus bas — les trois arbres, les fichiers déterminants, les
     paramètres du build. Elles sont plus précises que le SHA et le rendent inutile.
     Trouvé parce que le témoin « la mesure passe » échouait : sans lui, j'aurais publié quatre
     contre-épreuves qui ne prouvaient rien. */
  if (!prov.arbre_propre) ecarts.push("construit depuis des sources MODIFIÉES : ses pages ne correspondent à aucun commit");
  if (prov.portee !== porteeAttendue) ecarts.push(`portée « ${prov.portee} » et non « ${porteeAttendue} »`);

  const { sources } = empreinte();
  for (const [k, v] of Object.entries(sources)) {
    if (prov.sources?.[k] !== v) {
      ecarts.push(`${k} : site construit depuis ${String(prov.sources?.[k]).slice(0, 8)}…, sources à ${v.slice(0, 8)}…`);
    }
  }
  /* LES PARAMÈTRES SE JUGENT SUR CE QU'ILS DÉTERMINENT, PAS PAR COMPARAISON À L'ENVIRONNEMENT
     COURANT. Première version fausse : elle confrontait les paramètres du build à `process.env` du
     MESUREUR, qui n'en porte aucun — un site complet parfaitement valide était donc rejeté parce
     que le processus qui le relit n'a pas d'adresse d'API dans son environnement. Ce qui compte
     pour un dossier de mesure est la COMPLÉTUDE : un site « complet » ne peut pas avoir été
     construit sous un filtre d'entités. Les autres paramètres sont inscrits pour le lecteur, et
     confrontés à rien — leur valeur n'est pas une propriété de l'état courant. */
  if (porteeAttendue === "complet") {
    for (const k of ["BUILD_ONLY", "BUILD_SLUGS"]) {
      const v = prov.parametres?.[k];
      if (v) ecarts.push(`paramètre ${k} = « ${v} » : ce site a été construit sous un filtre `
        + "d'entités, il ne peut pas être complet quel que soit son nombre de pages");
    }
  }
  const sale = salete();
  if (sale) ecarts.push(`les sources du site ont changé depuis le build :\n      ${sale.replace(/\n/g, "\n      ")}`);

  /* ---- LA COMPLÉTUDE, PROUVÉE PAR BIJECTION ET NON PAR UN SEUIL ------------------------------
   * Compter « au moins 2 000 pages » et « au moins 2 000 URL » laissait passer un site amputé de
   * plusieurs centaines de pages : les sitemaps, eux, restent complets. On exige donc que le
   * décompte annoncé par la carte soit celui du site, et que CHAQUE URL des sitemaps ait son
   * fichier. Relevé par la contre-revue du 20/08/2026. */
  const pages = compterPages(dist);
  if (prov.pages !== pages) {
    ecarts.push(`la carte annonce ${prov.pages} pages, le site en contient ${pages} — `
      + "des fichiers ont été ajoutés ou retirés après le build");
  }
  const absentes = [];
  let urls = 0;
  for (const l of ["en", "fr", "es", "pt"]) {
    const f = join(dist, `sitemap-${l}.xml`);
    if (!existsSync(f)) { ecarts.push(`sitemap-${l}.xml absent`); continue; }
    for (const m of readFileSync(f, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls++;
      const p = m[1].replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
      if (!existsSync(join(dist, p, "index.html")) && !existsSync(join(dist, p))) absentes.push(p || "/");
    }
  }
  if (urls < 2000) ecarts.push(`${urls} URL aux sitemaps, attendu ≥ 2000`);
  if (absentes.length) {
    ecarts.push(`${absentes.length} URL des sitemaps sans page construite — le site est amputé : `
      + absentes.slice(0, 3).join(", ") + (absentes.length > 3 ? ", …" : ""));
  }
  return ecarts;
}

/** Confronter, et s'arrêter si le site ne correspond pas. Utilisé par les dossiers de mesure. */
export function exigerProvenance(dist, etiquette, porteeAttendue = "complet") {
  const ecarts = verifierProvenance(dist, porteeAttendue);
  if (!ecarts.length) return;
  process.stderr.write(`[${etiquette}] ÉCHEC — le site construit ne correspond pas aux sources mesurées :\n`
    + ecarts.map((e) => `  · ${e}`).join("\n") + "\n");
  process.exit(1);
}
