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
 *   · la DÉTECTION ENVIRONNEMENTALE vaut pour CHAQUE requête, pas seulement la sonde
 *     (contre-revue : la sonde passait, une autorité répondait « CONNECT tunnel failed »,
 *     et cette signature — expurgée — devenait une « tentative » de la source) : `r.error`,
 *     `status === null` ou une signature de proxy dans la trace BRUTE interrompent TOUT le
 *     run, sortie 2, manifeste intact ;
 *   · chaque corps 2xx est conservé BRUT (extension selon le Content-Type), et son TEXTE
 *     DÉRIVÉ est produit par l'extracteur déterministe versionné
 *     (`extraire-texte-lot-a.mjs`, version scellée dans le manifeste) — c'est dans ce texte
 *     que les extraits s'ancreront ;
 *   · chaque run écrit dans un RÉPERTOIRE NEUF `audit-pays-pieces/run-<horodatage>/` ; rien
 *     n'est effacé — les runs précédents restent ce qu'ils sont ;
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
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { extraireTexte, VERSION_EXTRACTEUR } from "./extraire-texte-lot-a.mjs";

const RACINE_PIECES = "audit-pays-pieces";
const MANIFESTE = "audit-pays-consultations.json";
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

/* ---- 2. l'environnement est apte, sinon on REFUSE — on n'observe pas avec un thermomètre cassé */
const version = spawnSync("curl", ["--version"], { encoding: "utf-8" });
if (version.error || version.status !== 0) refus(2, "curl est absent ou inopérant — panne d'environnement, aucune « tentative » ne sera fabriquée");
const SIGNATURES_PROXY = /CONNECT tunnel failed|EGRESS_BLOCKED|Proxy CONNECT aborted|Received HTTP code 403 from proxy/i;
const sonde = spawnSync("curl", ["-vsS", "--max-time", "20", "-o", "/dev/null", "-w", "%{http_code}", "https://example.com/"], { encoding: "utf-8" });
if (sonde.error || sonde.status !== 0 || !/^2\d\d$/.test(sonde.stdout) || SIGNATURES_PROXY.test(sonde.stderr || "")) {
  refus(2, `la sonde https://example.com/ échoue (${sonde.stdout || sonde.error?.message || "réseau"}) — panne systémique ou proxy bloquant : rien ne sera collecté`);
}

/* ---- 3. répertoire de run NEUF — rien n'est effacé ------------------------------------------ */
const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
const RUN = join(RACINE_PIECES, `run-${horodatage}`);
if (existsSync(RUN)) refus(2, `le répertoire de run ${RUN} existe déjà`);
mkdirSync(RUN, { recursive: true });
const aujourdhui = new Date().toISOString().slice(0, 10);

/* Les traces sont assainies : rien de ce qui décrit NOTRE réseau n'est versionné. */
const assainir = (texte) => String(texte).split("\n")
  .map((l) => (/proxy|CONNECT|Authorization|authorization|NO_PROXY|no_proxy/i.test(l) ? "[ligne expurgée : proxy/authentification]" : l))
  .join("\n");

/* ---- 4. UNE invocation par URL : corps + métadonnées + trace corrélés ----------------------- */
const resultats = [];
let n = 0;
for (const id of pays) {
  for (const [i, lien] of guides[id].sources.entries()) {
    n++;
    const num = String(n).padStart(2, "0");
    const hote = (() => { try { return new URL(lien.url).hostname.replace(/^www\./, ""); } catch { return "hote-invalide"; } })();
    process.stdout.write(`[${num}/${attendus}] ${id} · ${lien.url}\n`);

    const corpsProvisoire = join(RUN, `${num}-${hote}.corps`);
    const cheminEntetes = join(RUN, `${num}-${hote}.headers.txt`);
    const r = spawnSync("curl", [
      "-vsSL", "--max-time", "30",
      "-A", "MyDogCanFly-Audit/lot-A (contact: audit@mydogcanfly.com)",
      "-o", corpsProvisoire, "-D", cheminEntetes,
      "-w", "%{http_code}\t%{url_effective}\t%{num_redirects}\t%{content_type}", lien.url,
    ], { encoding: "utf-8" });

    /* LA DÉTECTION ENVIRONNEMENTALE VAUT POUR CHAQUE REQUÊTE — sur la trace BRUTE, avant
     * tout assainissement : une panne de NOTRE côté interrompt tout, elle ne devient jamais
     * une « tentative » de la source. Le manifeste précédent reste intact. */
    if (r.error || r.status === null || SIGNATURES_PROXY.test(r.stderr || "")) {
      refus(2, `panne d'environnement sur ${lien.url} (${r.error?.message ?? (r.status === null ? "processus interrompu" : "signature de proxy bloquant dans la trace")}) — ` +
        `TOUT le run est interrompu, le manifeste n'est pas touché (répertoire conservé : ${RUN})`);
    }

    const [code, urlFinale, redirections, contentType] = (r.stdout || "\t\t\t").split("\t");
    const trace = assainir(`# ${aujourdhui} — ${lien.url}\n# curl exit=${r.status} · http=${code || "?"}\n\n${r.stderr || ""}`);
    const cheminTrace = join(RUN, `${num}-${hote}.trace.txt`);
    writeFileSync(cheminTrace, trace);

    if (r.status === 0 && /^2\d\d$/.test(code)) {
      const contenu = readFileSync(corpsProvisoire);
      /* Le brut garde son extension selon le Content-Type ; le texte dérivé vient de
       * l'extracteur déterministe versionné — c'est LUI que les extraits devront retrouver. */
      const ext = /pdf/i.test(contentType) ? "pdf" : (/html|xml|text\//i.test(contentType) ? "html" : "bin");
      const corps = join(RUN, `${num}-${hote}.${ext}`);
      renameSync(corpsProvisoire, corps);
      const texte = extraireTexte(contenu, contentType);
      const cheminTexte = join(RUN, `${num}-${hote}.texte.txt`);
      writeFileSync(cheminTexte, texte);
      const entetes = readFileSync(cheminEntetes);
      resultats.push({
        n, country_id: id, index_lien: i, label: lien.label, url_publiee: lien.url,
        acces: "consultee", statut_http: Number(code), url_finale: urlFinale,
        redirections: Number(redirections), consultee_le: aujourdhui,
        content_type: contentType || "inconnu",
        capture: { chemin: corps, sha256: sha256(contenu), octets: contenu.length,
          content_type: contentType || "inconnu",
          texte_derive: { chemin: cheminTexte, sha256: sha256(Buffer.from(texte)) },
          extracteur: VERSION_EXTRACTEUR },
        entetes: { chemin: cheminEntetes, sha256: sha256(entetes) },
        trace: { type: "transcript", chemin: cheminTrace, sha256: sha256(Buffer.from(trace)) },
      });
    } else {
      resultats.push({
        n, country_id: id, index_lien: i, label: lien.label, url_publiee: lien.url,
        acces: "tentative", tentee_le: aujourdhui,
        resultat: r.status !== 0 ? `curl exit ${r.status} (réseau/délai)` : `HTTP ${code}`,
        trace: { type: "transcript", chemin: cheminTrace, sha256: sha256(Buffer.from(trace)) },
      });
    }
  }
}

/* ---- 5. publication ATOMIQUE, et jamais sur une collecte manifestement en panne ------------- */
if (resultats.length !== attendus) refus(2, `${resultats.length}/${attendus} résultats — run incomplet, manifeste NON publié (répertoire conservé : ${RUN})`);
const consultees = resultats.filter((x) => x.acces === "consultee").length;
if (consultees === 0) {
  refus(2, `0 consultation sur ${attendus} — c'est la signature d'une panne d'environnement, pas un état du monde. ` +
    `Manifeste NON publié ; traces conservées dans ${RUN} pour diagnostic.`);
}
const brouillon = join(RUN, "manifeste.tmp.json");
writeFileSync(brouillon, JSON.stringify({ consultees_le: aujourdhui, run: RUN, total: attendus,
  extracteur: VERSION_EXTRACTEUR, resultats }, null, 2) + "\n");
renameSync(brouillon, MANIFESTE);

process.stdout.write(`\n${attendus} liens · ${consultees} consultation(s) · ${attendus - consultees} tentative(s)\n`);
process.stdout.write(`manifeste : ${MANIFESTE} · pièces : ${RUN}/\n`);
process.stdout.write("Aucun verdict n'a été rendu : l'observation d'abord, le jugement ensuite.\n");
