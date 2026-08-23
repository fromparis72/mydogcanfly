#!/usr/bin/env node
/**
 * UN TÉLÉCHARGEMENT RATÉ NE PUBLIE RIEN, ET NE TOUCHE À AUCUN FRONT MATTER.
 *
 *   node test-fetch-couvertures.mjs
 *
 * POURQUOI. `fetch-guide-covers.mjs` écrivait DIRECTEMENT dans le fichier de destination. Un
 * téléchargement interrompu laissait un fichier partiel sur le disque ; l'erreur était bien
 * consignée, mais la phase de réécriture qui suit ne vérifiait que l'EXISTENCE du fichier. Elle
 * repointait donc les quatre langues vers une image cassée, dans la seconde même où le compte
 * rendu annonçait l'échec. Un fichier à moitié écrit qu'on publie est pire qu'un fichier absent :
 * le second se voit, le premier se sert.
 *
 * COMMENT ON L'ÉPROUVE. On ne peut pas provoquer un vrai téléchargement partiel de façon
 * reproductible, et un harnais qui dépend du réseau ne vaut rien. On place donc un `curl`
 * FACTICE en tête de `PATH` : le script appelle `curl` sans savoir lequel, exactement comme il
 * appellerait le vrai. C'est la seule manière d'éprouver un chemin d'erreur qui, par nature,
 * ne se présente jamais quand on l'observe.
 *
 * TROIS CAS :
 *   1. TÉLÉCHARGEMENT PARTIEL — `curl` rend un fichier de 300 octets. Attendu : aucune image
 *      publiée, aucun `.part` laissé derrière, et les QUATRE front matter INTACTS.
 *   2. CURL EN ÉCHEC — code de sortie non nul, aucun fichier produit. Mêmes exigences.
 *   3. TÉLÉCHARGEMENT VALIDE — un VRAI JPEG. Attendu : publié, et les quatre front matter
 *      repointés vers le chemin local. Sans ce cas, les deux premiers seraient satisfaits par un
 *      script qui ne fait jamais rien.
 *   4. FICHIER DÉJÀ PRÉSENT MAIS INVALIDE — un `.jpg` de 9 000 octets de TEXTE est posé avant le
 *      lancement. Le script le classait « déjà présent », donc valide, et repointait les quatre
 *      langues vers lui. « Existe » n'est pas « validé », et la taille ne dit rien du format.
 *   5. TÉLÉCHARGEMENT D'UN FICHIER QUI N'EST PAS UNE IMAGE — 20 000 octets de texte, donc au-delà
 *      du seuil de taille. Seule une lecture du CONTENU peut le voir.
 *
 * TOUT ÉCHEC DOIT AUSSI SORTIR EN CODE NON NUL : le script listait ses échecs et sortait en 0,
 * si bien qu'un appelant le croyait réussi.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, chmodSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve("packages/knowledge/scripts/fetch-guide-covers.mjs");
const RACINE = "packages/ui/src/content/guides";
const LANGUES = ["en", "fr", "es", "pt"];
const URL_SOURCE = "https://images.unsplash.com/photo-temoin?ixid=abc";

const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);

/* UNE VRAIE FIXTURE JPEG, ET C'EST TOUT LE SUJET DU CAS 3.
 *
 * La première version servait un WebP renommé `.jpg`. Sur Linux, sans `sips` ni ImageMagick,
 * aucun redimensionnement n'avait lieu et le harnais passait ; sur le Mac de Philippe, `sips`
 * refusait de réécrire ce fichier et le cas nominal échouait. Un harnais dont le verdict dépend
 * des outils présents sur la machine ne prouve rien — il constate un environnement.
 *
 * La fixture est donc un JPEG RÉEL, versionné, de 1200 px : elle traverse `sips` comme
 * ImageMagick comme l'absence des deux. */
const IMAGE_REELLE = "test-fixtures/couverture-temoin.jpg";

const guide = (cle, url) =>
  `---\nkey: "${cle}"\ntitle: "Titre"\ndate: "2026-01-01T00:00:00+01:00"\ncategory: "travel"\n` +
  `tags: ["chien"]\ncover:\n  image: "${url}"\n  alt: "Un texte"\n---\n\nCorps.\n`;

/**
 * Monte un dépôt d'essai complet et y installe un `curl` factice.
 * `mode` : "partiel" | "echec" | "valide".
 */
function bac(mode) {
  const base = mkdtempSync(join(tmpdir(), "fetch-cov-"));
  for (const l of LANGUES) {
    mkdirSync(join(base, RACINE, l), { recursive: true });
    writeFileSync(join(base, RACINE, l, "temoin.md"), guide("temoin", URL_SOURCE));
  }
  mkdirSync(join(base, "packages/ui/public/travel-hub"), { recursive: true });

  const bin = join(base, "bin");
  mkdirSync(bin);
  const sortie = join(bin, "curl");
  /* Le script appelle `curl -fsSL --max-time 45 -o <cible> <url>` : le factice retrouve la
     cible après `-o`, exactement comme le vrai la lirait. */
  const corps = {
    partiel: `head -c 300 /dev/zero > "$CIBLE"`,
    echec: `exit 22`,
    valide: `cp ${resolve(IMAGE_REELLE)} "$CIBLE"`,
    "pas-une-image": `yes "ceci nest pas une image" | head -c 20000 > "$CIBLE"`,
    "deja-invalide": `cp ${resolve(IMAGE_REELLE)} "$CIBLE"`,
  }[mode];
  writeFileSync(sortie,
    `#!/bin/sh\nCIBLE=""\nwhile [ $# -gt 0 ]; do\n  if [ "$1" = "-o" ]; then CIBLE="$2"; shift; fi\n  shift\ndone\n${corps}\n`);
  chmodSync(sortie, 0o755);
  return { base, bin };
}

const empreintes = (base) => LANGUES.map((l) => readFileSync(join(base, RACINE, l, "temoin.md"), "utf-8"));

for (const [cas, mode, doitPublier] of [
  ["1 partiel", "partiel", false],
  ["2 curl en échec", "echec", false],
  ["3 valide", "valide", true],
  ["4 déjà présent mais invalide", "deja-invalide", false],
  ["5 pas une image", "pas-une-image", false],
]) {
  const { base, bin } = bac(mode);
  /* Le cas 4 pose le fichier AVANT le lancement : le script doit le rencontrer comme « déjà
     présent », et le refuser au lieu de s'en contenter. */
  if (mode === "deja-invalide") {
    writeFileSync(join(base, "packages/ui/public/travel-hub/temoin.jpg"), "x".repeat(9000));
  }
  const avant = empreintes(base);

  const r = spawnSync("node", [SCRIPT], {
    cwd: base, encoding: "utf-8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });

  const dest = join(base, "packages/ui/public/travel-hub");
  const fichiers = existsSync(dest) ? readdirSync(dest) : [];
  const apres = empreintes(base);
  const restes = fichiers.filter((f) => f.endsWith(".part"));

  if (restes.length) echec(cas, `${restes.length} fichier(s) temporaire(s) « .part » laissé(s) : ${restes.join(", ")}`);

  if (doitPublier) {
    if (!fichiers.includes("temoin.jpg")) {
      echec(cas, `l'image n'a PAS été publiée alors que le téléchargement était valide (sortie ${r.status})`);
    }
    const repointes = apres.filter((t) => t.includes('image: "/travel-hub/temoin.jpg"')).length;
    if (repointes !== LANGUES.length) {
      echec(cas, `${repointes} front matter repointé(s) sur ${LANGUES.length} — les quatre langues doivent suivre`);
    }
  } else {
    if (r.status === 0) echec(cas, "le script sort en 0 alors qu'il a échoué — un appelant le croirait réussi");
    /* Au cas 4 le fichier invalide était là AVANT : on n'exige pas qu'il disparaisse, mais qu'il
       ne soit ni déclaré valide ni utilisé. Aux autres cas, rien ne doit avoir été publié. */
    const publies = fichiers.filter((f) => !f.endsWith(".part"));
    if (mode !== "deja-invalide" && publies.length) echec(cas, `image PUBLIÉE malgré l'échec : ${publies.join(", ")}`);
    for (let n = 0; n < LANGUES.length; n++) {
      if (avant[n] !== apres[n]) {
        echec(cas, `le front matter ${LANGUES[n].toUpperCase()} a été MODIFIÉ alors que le téléchargement a échoué`);
      }
    }
    if (!/échecs?/.test(r.stdout + r.stderr)) echec(cas, "le compte rendu ne mentionne aucun échec");
  }

  rmSync(base, { recursive: true, force: true });
}

if (defauts.length === 0) {
  process.stdout.write("5 cas éprouvés avec un « curl » factice : téléchargement partiel, curl en échec,\n");
  process.stdout.write("téléchargement valide (vraie fixture JPEG), fichier déjà présent mais invalide,\n");
  process.stdout.write("téléchargement d'un fichier qui n'est pas une image.\n");
  process.stdout.write("Aucun temporaire laissé, aucun front matter touché, code de sortie non nul à chaque échec.\n\n");
  process.stdout.write("[fetch-couvertures] un téléchargement raté ne publie rien.\n");
  process.exit(0);
}
process.stderr.write(`\n[fetch-couvertures] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
