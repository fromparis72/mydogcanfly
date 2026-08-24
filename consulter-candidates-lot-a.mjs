#!/usr/bin/env node
/**
 * LOT A — LA CONSULTATION MÉCANIQUE DES 91 CANDIDATES, DEPUIS UNE MACHINE QUI VOIT INTERNET.
 *
 *   node consulter-candidates-lot-a.mjs
 *
 * POURQUOI CE SCRIPT TOURNE SUR LE MAC. L'environnement de travail distant est derrière un
 * proxy qui n'autorise que les hôtes de développement : toute requête vers les autorités
 * auditées répond « EGRESS_BLOCKED ». Enregistrer ces refus comme des « tentatives » serait
 * une FAUSSE OBSERVATION — c'est notre réseau qui refuse, pas la source. La consultation se
 * fait donc ici, mécaniquement, et ses résultats sont VERSIONNÉS pour que le jugement (les
 * verdicts de la matrice) se fasse ensuite sur pièces, et se contre-vérifie.
 *
 * CE QU'IL FAIT, pour chacun des 91 liens publiés par les guides des 18 pays (lus depuis le
 * scellé `etat-reference-lot-a.json` + `countries.generated.json`, jamais d'URL inventée) :
 *   · appelle `curl -sSL` (30 s max, redirections suivies) ;
 *   · code HTTP 2xx → CONSULTATION : le corps est enregistré en CAPTURE
 *     `audit-pays-pieces/consultations/<nn>-<hôte>.html`, scellée par SHA-256 ;
 *   · tout le reste (403, 5xx, timeout, DNS) → TENTATIVE : la trace curl complète (`-v`)
 *     est enregistrée en TRANSCRIPT `<nn>-<hôte>.transcript.txt`, scellée par SHA-256 ;
 *   · écrit le relevé brut `audit-pays-consultations.json` : URL publiée, URL finale, code,
 *     date, chemin de pièce, empreinte. AUCUN verdict — l'observation d'abord, le jugement
 *     ensuite, par quelqu'un d'autre que ce script.
 *
 * Il ne touche ni objects.json, ni les guides, ni la matrice. Il écrit UNIQUEMENT sous
 * `audit-pays-pieces/` et le relevé brut. Relançable : il repart de zéro à chaque fois.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";

const DOSSIER_PIECES = "audit-pays-pieces/consultations";
const RELEVE = "audit-pays-consultations.json";
const scelle = JSON.parse(readFileSync("etat-reference-lot-a.json", "utf-8"));
const guides = JSON.parse(readFileSync("packages/ui/src/data/countries.generated.json", "utf-8"));

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const aujourdhui = new Date().toISOString().slice(0, 10);

rmSync(DOSSIER_PIECES, { recursive: true, force: true });
mkdirSync(DOSSIER_PIECES, { recursive: true });

const resultats = [];
let n = 0;
for (const id of Object.keys(scelle.pays)) {
  for (const [i, lien] of (guides[id].sources ?? []).entries()) {
    n++;
    const num = String(n).padStart(2, "0");
    const hote = (() => { try { return new URL(lien.url).hostname.replace(/^www\./, ""); } catch { return "hote-invalide"; } })();
    process.stdout.write(`[${num}/91] ${id} · ${lien.url}\n`);

    const corps = join(DOSSIER_PIECES, `${num}-${hote}.html`);
    const r = spawnSync("curl", [
      "-sSL", "--max-time", "30", "--retry", "1",
      "-A", "MyDogCanFly-Audit/lot-A (contact: audit@mydogcanfly.com)",
      "-o", corps, "-w", "%{http_code}\t%{url_effective}\t%{num_redirects}", lien.url,
    ], { encoding: "utf-8" });
    const [code, urlFinale, redirections] = (r.stdout || "\t\t").split("\t");
    const consultee = r.status === 0 && /^2\d\d$/.test(code);

    if (consultee) {
      const contenu = readFileSync(corps);
      resultats.push({
        n, country_id: id, index_lien: i, label: lien.label, url_publiee: lien.url,
        acces: "consultee", statut_http: Number(code), url_finale: urlFinale,
        redirections: Number(redirections), consultee_le: aujourdhui,
        capture: { chemin: corps, sha256: sha256(contenu), octets: contenu.length },
      });
    } else {
      rmSync(corps, { force: true });
      /* La trace DURABLE de la tentative : la sortie verbeuse complète de curl. */
      const t = spawnSync("curl", ["-vsSL", "--max-time", "30", "-o", "/dev/null", lien.url], { encoding: "utf-8" });
      const transcript = join(DOSSIER_PIECES, `${num}-${hote}.transcript.txt`);
      const texte = `# tentative du ${aujourdhui} — ${lien.url}\n# curl exit=${t.status} · http=${code || "?"}\n\n${t.stderr || ""}`;
      writeFileSync(transcript, texte);
      resultats.push({
        n, country_id: id, index_lien: i, label: lien.label, url_publiee: lien.url,
        acces: "tentative", tentee_le: aujourdhui,
        resultat: r.status !== 0 ? `curl exit ${r.status} (réseau/délai)` : `HTTP ${code}`,
        trace: { type: "transcript", chemin: transcript, sha256: sha256(Buffer.from(texte)) },
      });
    }
  }
}

writeFileSync(RELEVE, JSON.stringify({ consultees_le: aujourdhui, total: n, resultats }, null, 2) + "\n");
const ok = resultats.filter((x) => x.acces === "consultee").length;
process.stdout.write(`\n${n} liens · ${ok} consultation(s) · ${n - ok} tentative(s)\n`);
process.stdout.write(`relevé brut : ${RELEVE} · pièces : ${DOSSIER_PIECES}/\n`);
process.stdout.write("Aucun verdict n'a été rendu : l'observation d'abord, le jugement ensuite.\n");
