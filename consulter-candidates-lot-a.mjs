#!/usr/bin/env node
/**
 * LOT A — LA CONSULTATION MÉCANIQUE DES 91 CANDIDATES. UNE PANNE D'ENVIRONNEMENT N'EST PAS
 * UNE OBSERVATION DE SOURCE.
 *
 *   node consulter-candidates-lot-a.mjs
 *
 * POURQUOI CE SCRIPT TOURNE SUR LE MAC. L'environnement distant est derrière un proxy à liste
 * d'autorisation (« EGRESS_BLOCKED ») : ses refus ne disent RIEN des sources. La v1 de ce
 * script avait le même vice à une autre échelle — contre-épreuve de Codex : `curl` absent
 * produisait « 91 tentatives », sortie 0. Un collecteur qui transforme sa propre panne en
 * 91 observations fabrique des pièces. D'où les gardes ci-dessous.
 *
 * AVANT TOUTE ÉCRITURE :
 *   · les 18 pays, les 91 triplets et leurs EMPREINTES sont reconfrontés au scellé
 *     `etat-reference-lot-a.json` — collecter sur un inventaire dérivé est refusé ;
 *   · `curl --version` doit répondre — sinon refus explicite ;
 *   · une SONDE (https://example.com) doit obtenir un 2xx — un échec, ou la signature d'un
 *     proxy bloquant (« CONNECT tunnel failed », « EGRESS_BLOCKED »), est une PANNE
 *     SYSTÉMIQUE : refus, sortie 2, rien d'écrit.
 *
 * PENDANT LA COLLECTE :
 *   · UNE SEULE invocation curl par URL : corps (`-o`), en-têtes (`-D`), métadonnées (`-w`,
 *     `Content-Type` compris) et trace (`-v`, stderr) viennent du MÊME appel ;
 *   · le PROTOCOLE est ÉPINGLÉ (`--proto =http,https`, `--proto-redir =http,https`) et
 *     l'`url_finale` est REVALIDÉE au même contrat HTTP(S) avant toute persistance : une
 *     redirection qui quitte le web interrompt tout le run, corps provisoire détruit,
 *     manifeste intact (contre-revue v5-quinquies) ;
 *   · la DÉTECTION ENVIRONNEMENTALE vaut pour CHAQUE requête, et inspecte STDERR, les
 *     EN-TÊTES et le CORPS PROVISOIRE avant toute classification (contre-revue v5-bis : un
 *     403 dont seul le corps portait « EGRESS_BLOCKED » devenait une tentative légitime) :
 *     `r.error`, `status === null` ou une signature environnementale où que ce soit
 *     interrompent TOUT le run, sortie 2, manifeste intact ;
 *   · les EN-TÊTES BRUTS ne touchent JAMAIS `audit-pays-pieces/` : curl les écrit dans un
 *     fichier temporaire HORS du dépôt, et seule leur PROJECTION ASSAINIE (`Set-Cookie`,
 *     `Authorization`, `WWW-Authenticate`, `Proxy-*` expurgés) entre dans le run — même un
 *     refus environnemental ne laisse aucun secret dans les pièces (contre-revue v5-ter) ;
 *   · le FORMAT est détecté depuis les OCTETS (`%PDF-` dans l'en-tête du fichier), enregistré
 *     comme `format_detecte` et recalculé par le validateur — un PDF déguisé en `text/plain`
 *     reste un PDF ;
 *   · les URL de RATTACHEMENT hors des 91 candidates (fichier versionné
 *     `rattachements-a-consulter.json`) sont collectées dans le même run, comme observations
 *     distinctes de rôle « rattachement » — une preuve de rattachement doit, elle aussi,
 *     venir du manifeste ;
 *   · chaque corps 2xx est conservé BRUT (extension selon le Content-Type), et son TEXTE
 *     DÉRIVÉ est produit par l'extracteur déterministe versionné
 *     (`extraire-texte-lot-a.mjs`, version scellée dans le manifeste) — c'est dans ce texte
 *     que les extraits s'ancreront ;
 *   · chaque run écrit dans un RÉPERTOIRE NEUF `audit-pays-pieces/run-<horodatage>/` ; rien
 *     n'est effacé — les runs précédents restent ce qu'ils sont ;
 *   · le manifeste est l'INVENTAIRE EXACT des pièces du run : une TENTATIVE ne garde que sa
 *     trace — corps provisoire et en-têtes assainis sont supprimés, aucune pièce orpheline
 *     (contre-revue v5-sexies) ;
 *   · le corps est BORNÉ en octets (`--max-filesize` + stat avant toute lecture, 25 MiB) :
 *     un corps au-delà devient une tentative explicite, jamais une capture ni une lecture
 *     en mémoire ;
 *   · les traces sont ASSAINIES avant écriture : toute ligne portant une information de proxy
 *     ou d'authentification est remplacée par « [ligne expurgée : proxy/authentification] ».
 *
 * APRÈS LA COLLECTE :
 *   · si AUCUNE consultation n'a abouti, le manifeste n'est PAS publié : 0/91 est la
 *     signature d'une panne, pas un état du monde — sortie 2 ;
 *   · le manifeste `audit-pays-consultations.json` n'est publié qu'à 91/91 résultats, par
 *     RENOMMAGE ATOMIQUE depuis le répertoire de run — une interruption laisse un run
 *     incomplet SANS manifeste, jamais un relevé partiel qui se fait passer pour complet.
 *
 * Il n'émet AUCUN verdict, ne touche ni objects.json, ni les guides, ni la matrice.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extraireTexte, detecterFormat, VERSION_EXTRACTEUR } from "./extraire-texte-lot-a.mjs";
import { erreursListeRattachements, estUrlHttp } from "./liste-rattachements-lot-a.mjs";

const RACINE_PIECES = "audit-pays-pieces";
const MANIFESTE = "audit-pays-consultations.json";
/* La borne en OCTETS d'un corps de réponse : 25 MiB — `--max-time` borne le temps, pas la
 * taille, et le corps est ensuite chargé en mémoire pour l'empreinte et l'extraction. La
 * borne est passée à curl (`--max-filesize`) ET revérifiée sur le fichier avant toute
 * lecture ; un corps au-delà devient une TENTATIVE explicite, jamais une capture. */
const LIMITE_CORPS_OCTETS = 26214400;
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const jsonCanonique = (x) => {
  if (Array.isArray(x)) return "[" + x.map(jsonCanonique).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + jsonCanonique(x[k])).join(",") + "}";
  return JSON.stringify(x);
};
const refus = (code, m) => { process.stderr.write(`[collecte] REFUS — ${m}\n`); process.exit(code); };

/* ---- 1. l'inventaire est reconfronté au scellé AVANT toute écriture ------------------------- */
const scelle = JSON.parse(readFileSync("etat-reference-lot-a.json", "utf-8"));
const guides = JSON.parse(readFileSync("packages/ui/src/data/countries.generated.json", "utf-8"));
const pays = Object.keys(scelle.pays);
if (pays.length !== 18) refus(2, `le scellé porte ${pays.length} pays au lieu de 18`);
let attendus = 0;
for (const id of pays) {
  const liens = guides[id]?.sources ?? [];
  const empreinte = sha256(jsonCanonique(liens));
  if (empreinte !== scelle.pays[id].empreinte_sources) {
    refus(2, `les liens publiés de ${id} ne correspondent plus au scellé — collecter sur un inventaire dérivé fabriquerait des pièces`);
  }
  attendus += liens.length;
}
if (attendus !== scelle.liens_total) refus(2, `${attendus} liens relevés, scellé ${scelle.liens_total}`);
/* La liste des rattachements — versionnée, curée AVANT le run, et au SCHÉMA STRICT PARTAGÉ
 * (`liste-rattachements-lot-a.mjs`, le même code que le validateur permanent) : la v4
 * acceptait file:///etc/passwd (contre-revue v5-quater), et le vrai curl aurait laissé du
 * contenu LOCAL dans le fichier provisoire du run. HTTP(S) uniquement, objets sans champ
 * inconnu, motif non blanc, URL uniques, fichier OBLIGATOIRE — tout écart refuse AVANT toute
 * écriture. */
let rattachements;
try { rattachements = JSON.parse(readFileSync("rattachements-a-consulter.json", "utf-8")); }
catch { refus(2, "rattachements-a-consulter.json ABSENT ou JSON invalide — la liste versionnée est obligatoire, rien n'est écrit"); }
for (const e of erreursListeRattachements(rattachements)) refus(2, `rattachements-a-consulter.json ${e}`);

/* ---- 2. l'environnement est apte, sinon on REFUSE — on n'observe pas avec un thermomètre cassé */
const version = spawnSync("curl", ["--version"], { encoding: "utf-8" });
if (version.error || version.status !== 0) refus(2, "curl est absent ou inopérant — panne d'environnement, aucune « tentative » ne sera fabriquée");
const SIGNATURES_PROXY = /CONNECT tunnel failed|EGRESS_BLOCKED|Proxy CONNECT aborted|Received HTTP code 403 from proxy/i;
const sonde = spawnSync("curl", ["-vsS", "--proto", "=http,https", "--proto-redir", "=http,https",
  "--max-time", "20", "--max-filesize", String(LIMITE_CORPS_OCTETS),
  "-o", "/dev/null", "-w", "%{http_code}", "https://example.com/"], { encoding: "utf-8" });
if (sonde.error || sonde.status !== 0 || !/^2\d\d$/.test(sonde.stdout) || SIGNATURES_PROXY.test(sonde.stderr || "")) {
  refus(2, `la sonde https://example.com/ échoue (${sonde.stdout || sonde.error?.message || "réseau"}) — panne systémique ou proxy bloquant : rien ne sera collecté`);
}

/* ---- 3. répertoire de run NEUF — rien n'est effacé ------------------------------------------ */
const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
const RUN = join(RACINE_PIECES, `run-${horodatage}`);
if (existsSync(RUN)) refus(2, `le répertoire de run ${RUN} existe déjà`);
mkdirSync(RUN, { recursive: true });
const aujourdhui = new Date().toISOString().slice(0, 10);

/* En-têtes assainis avant scellement : aucun cookie, aucun secret d'authentification. */
const assainirEntetes = (texte) => String(texte).split(/\r?\n/)
  .map((l) => (/^(set-cookie|authorization|www-authenticate|proxy-[^:]*)\s*:/i.test(l)
    ? "[en-tête expurgé : cookies/authentification/proxy]" : l))
  .join("\n");

/* Les traces sont assainies : rien de ce qui décrit NOTRE réseau n'est versionné. */
const assainir = (texte) => String(texte).split("\n")
  .map((l) => (/proxy|CONNECT|Authorization|authorization|NO_PROXY|no_proxy/i.test(l) ? "[ligne expurgée : proxy/authentification]" : l))
  .join("\n");

/* ---- 4. UNE invocation par URL : corps + métadonnées + trace corrélés ----------------------- */
const resultats = [];
let n = 0;

/** Consulte UNE url. `role` = « candidate » (les 91) ou « rattachement » (liste versionnée). */
function consulter(url, role, extras) {
  n++;
  const num = String(n).padStart(2, "0");
  const hote = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "hote-invalide"; } })();
  process.stdout.write(`[${num}] ${role} · ${url}\n`);

  const corpsProvisoire = join(RUN, `${num}-${hote}.corps`);
  /* Les en-têtes BRUTS n'entrent jamais dans les pièces : fichier temporaire hors dépôt. */
  const entetesBrutsChemin = join(tmpdir(), `lot-a-entetes-${process.pid}-${n}.tmp`);
  const cheminEntetes = join(RUN, `${num}-${hote}.headers.txt`);
  let r;
  try {
    r = spawnSync("curl", [
      /* Le protocole est ÉPINGLÉ, redirections comprises : une redirection ne peut pas faire
       * quitter HTTP(S) — file://, ftp://, gopher:// ne seront JAMAIS suivis (contre-revue
       * v5-quinquies : une url_finale locale était persistée). */
      "-vsSL", "--proto", "=http,https", "--proto-redir", "=http,https", "--max-time", "30",
      "--max-filesize", String(LIMITE_CORPS_OCTETS),
      "-A", "MyDogCanFly-Audit/lot-A (contact: audit@mydogcanfly.com)",
      "-o", corpsProvisoire, "-D", entetesBrutsChemin,
      "-w", "%{http_code}\t%{url_effective}\t%{num_redirects}\t%{content_type}", url,
    ], { encoding: "utf-8" });

    /* LA DÉTECTION ENVIRONNEMENTALE VAUT POUR CHAQUE REQUÊTE — trace BRUTE, EN-TÊTES BRUTS et
     * CORPS PROVISOIRE, avant toute classification : une panne de NOTRE côté interrompt tout,
     * elle ne devient jamais une observation. Le manifeste précédent reste intact. */
    const entetesBruts = existsSync(entetesBrutsChemin) ? readFileSync(entetesBrutsChemin, "utf-8") : "";
    /* La BORNE EN OCTETS est revérifiée sur le fichier AVANT toute lecture en mémoire —
     * `--max-filesize` la tient déjà côté curl, la stat la tient même si curl ne l'a pas pu. */
    const tailleCorps = existsSync(corpsProvisoire) ? statSync(corpsProvisoire).size : 0;
    const corpsBrut = tailleCorps > 0 && tailleCorps <= LIMITE_CORPS_OCTETS ? readFileSync(corpsProvisoire) : Buffer.alloc(0);
    const signatureEnv = SIGNATURES_PROXY.test(r.stderr || "") ? "trace"
      : SIGNATURES_PROXY.test(entetesBruts) ? "en-têtes"
      : SIGNATURES_PROXY.test(corpsBrut.toString("latin1")) ? "corps" : null;
    if (r.error || r.status === null || signatureEnv) {
      rmSync(entetesBrutsChemin, { force: true });
      refus(2, `panne d'environnement sur ${url} (${r.error?.message ?? (r.status === null ? "processus interrompu" : `signature de blocage environnemental dans ${signatureEnv}`)}) — ` +
        `TOUT le run est interrompu, le manifeste n'est pas touché (répertoire conservé : ${RUN})`);
    }
    const [code, urlFinale, redirections, contentType] = (r.stdout || "\t\t\t").split("\t");
    /* L'URL FINALE est revalidée au MÊME contrat HTTP(S) que les listes d'entrée, AVANT toute
     * persistance : même si un curl non épinglé suivait une redirection hors du web, rien de
     * local n'entrerait dans les pièces — le corps provisoire est détruit, tout le run
     * s'interrompt, le manifeste précédent reste intact (contre-revue v5-quinquies). */
    if (r.status === 0) {
      if (!estUrlHttp(urlFinale)) {
        rmSync(corpsProvisoire, { force: true });
        rmSync(entetesBrutsChemin, { force: true });
        refus(2, `url_finale « ${urlFinale} » hors HTTP(S) sur ${url} — une redirection a quitté le web : ` +
          `TOUT le run est interrompu, le corps provisoire est détruit, le manifeste n'est pas touché (répertoire conservé : ${RUN})`);
      }
    }
    /* Seule la PROJECTION ASSAINIE des en-têtes entre dans le run. */
    writeFileSync(cheminEntetes, assainirEntetes(entetesBruts));
    const trace = assainir(`# ${aujourdhui} — ${url}\n# curl exit=${r.status} · http=${code || "?"}\n\n${r.stderr || ""}`);
    const cheminTrace = join(RUN, `${num}-${hote}.trace.txt`);
    writeFileSync(cheminTrace, trace);

    if (r.status === 0 && /^2\d\d$/.test(code) && tailleCorps <= LIMITE_CORPS_OCTETS) {
      const contenu = readFileSync(corpsProvisoire);
      /* Le FORMAT vient des OCTETS — le Content-Type déclaré ne décide de rien. */
      const format = detecterFormat(contenu);
      const ext = format === "pdf" ? "pdf" : format === "html" ? "html" : "bin";
      const corps = join(RUN, `${num}-${hote}.${ext}`);
      renameSync(corpsProvisoire, corps);
      const texte = extraireTexte(contenu, contentType);
      const cheminTexte = join(RUN, `${num}-${hote}.texte.txt`);
      writeFileSync(cheminTexte, texte);
      const entetes = readFileSync(cheminEntetes);
      resultats.push({
        n, role, ...extras,
        acces: "consultee", statut_http: Number(code), url_finale: urlFinale,
        redirections: Number(redirections), consultee_le: aujourdhui,
        content_type: contentType || "inconnu",
        capture: { chemin: corps, sha256: sha256(contenu), octets: contenu.length,
          content_type: contentType || "inconnu", format_detecte: format,
          texte_derive: { chemin: cheminTexte, sha256: sha256(Buffer.from(texte)) },
          extracteur: VERSION_EXTRACTEUR },
        entetes: { chemin: cheminEntetes, sha256: sha256(entetes) },
        trace: { type: "transcript", chemin: cheminTrace, sha256: sha256(Buffer.from(trace)) },
      });
    } else {
      /* TENTATIVE : le run ne garde QUE la trace. Le corps provisoire et les en-têtes
       * assainis sont SUPPRIMÉS — le manifeste est l'inventaire EXACT des pièces du run,
       * une pièce orpheline n'existe pas (contre-revue v5-sexies). */
      rmSync(corpsProvisoire, { force: true });
      rmSync(cheminEntetes, { force: true });
      resultats.push({
        n, role, ...extras,
        acces: "tentative", tentee_le: aujourdhui,
        resultat: r.status === 63 ? `curl exit 63 (corps au-delà de la borne de ${LIMITE_CORPS_OCTETS} octets)`
          : r.status !== 0 ? `curl exit ${r.status} (réseau/délai)`
          : !/^2\d\d$/.test(code) ? `HTTP ${code}`
          : `corps de ${tailleCorps} octets au-delà de la borne de ${LIMITE_CORPS_OCTETS} octets`,
        trace: { type: "transcript", chemin: cheminTrace, sha256: sha256(Buffer.from(trace)) },
      });
    }
  } finally {
    rmSync(entetesBrutsChemin, { force: true });
  }
}

for (const id of pays) {
  for (const [i, lien] of guides[id].sources.entries()) {
    consulter(lien.url, "candidate", { country_id: id, index_lien: i, label: lien.label, url_publiee: lien.url });
  }
}
for (const r of rattachements) {
  consulter(r.url, "rattachement", { url_demandee: r.url, motif: r.motif });
}

/* ---- 5. publication ATOMIQUE, et jamais sur une collecte manifestement en panne ------------- */
const totalAttendu = attendus + rattachements.length;
if (resultats.length !== totalAttendu) refus(2, `${resultats.length}/${totalAttendu} résultats — run incomplet, manifeste NON publié (répertoire conservé : ${RUN})`);
const consultees = resultats.filter((x) => x.acces === "consultee").length;
if (consultees === 0) {
  refus(2, `0 consultation sur ${totalAttendu} — c'est la signature d'une panne d'environnement, pas un état du monde. ` +
    `Manifeste NON publié ; traces conservées dans ${RUN} pour diagnostic.`);
}
const brouillon = join(RUN, "manifeste.tmp.json");
writeFileSync(brouillon, JSON.stringify({ consultees_le: aujourdhui, run: RUN, total: totalAttendu,
  candidates: attendus, rattachements: rattachements.length,
  extracteur: VERSION_EXTRACTEUR, resultats }, null, 2) + "\n");
renameSync(brouillon, MANIFESTE);

process.stdout.write(`\n${totalAttendu} liens (${attendus} candidates + ${rattachements.length} rattachements) · ${consultees} consultation(s) · ${totalAttendu - consultees} tentative(s)\n`);
process.stdout.write(`manifeste : ${MANIFESTE} · pièces : ${RUN}/\n`);
process.stdout.write("Aucun verdict n'a été rendu : l'observation d'abord, le jugement ensuite.\n");
