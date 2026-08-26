/**
 * LOT B — LE MODULE RÉSEAU GÉNÉRIQUE de la veille de fraîcheur (P1-4 de la contre-revue :
 * réutiliser les SÉCURITÉS du lot A sans importer son collecteur spécialisé).
 *
 * CE QU'IL GARANTIT :
 *   · HTTP(S) UNIQUEMENT — protocole épinglé (`--proto/--proto-redir =http,https`) et
 *     `url_finale` revalidée au contrat partagé avant tout retour ;
 *   · BORNE D'OCTETS partagée (25 MiB, `--max-filesize` + taille réelle vérifiée) ;
 *   · RIEN N'EST PERSISTÉ — corps et en-têtes vivent dans un répertoire de travail HORS
 *     dépôt, sont réduits à (empreinte SHA-256, taille, type, statut, url finale) puis
 *     DÉTRUITS ; aucun cookie, aucun secret ne peut atteindre un artefact ;
 *   · les DÉTAILS D'ERREUR retournés passent par l'assainisseur partagé du lot A
 *     (`assainirTrace`) — même un diagnostic ne transporte pas de secret ;
 *   · SIGNATURES ENVIRONNEMENTALES (proxy bloquant, egress) détectées dans le stderr, les
 *     en-têtes ET le corps ENTIER borné (contre-revue du socle : une tranche initiale de
 *     64 Kio laissait passer une signature tardive — le corps est déjà en mémoire pour
 *     l'empreinte, il se balaie en entier) : le résultat est marqué `environnement`, jamais
 *     une propriété de la source — le COUPE-CIRCUIT appartient au contrôleur ;
 *   · la SONDE (https://example.com) qualifie l'environnement avant tout run.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { estUrlHttp, LIMITE_CORPS_OCTETS, assainirTrace } from "../liste-rattachements-lot-a.mjs";

export const SIGNATURES_ENVIRONNEMENT = /CONNECT tunnel failed|EGRESS_BLOCKED|Proxy CONNECT aborted|Received HTTP code 403 from proxy/i;
const detail = (texte) => assainirTrace(String(texte ?? "")).split("\n").filter(Boolean).slice(0, 3).join(" · ");
/* Délai INDIVIDUEL réduit (contre-revue : 45 s × 280 URL séquentielles dépassait le budget
 * du workflow) — le budget GLOBAL vit chez le contrôleur, ce délai borne chaque URL. */
export const DELAI_PAR_URL_SECONDES = 20;

/** La sonde environnementale : un 2xx sans signature de proxy, sinon l'environnement est
 *  inapte et AUCUN contrôle ne doit être interprété. */
export function sondeEnvironnement() {
  const r = spawnSync("curl", ["-vsS", "--proto", "=http,https", "--proto-redir", "=http,https",
    "--max-time", "20", "--max-filesize", String(LIMITE_CORPS_OCTETS),
    "-o", "/dev/null", "-w", "%{http_code}", "https://example.com/"], { encoding: "utf-8" });
  if (r.error) return { apte: false, cause: `curl inopérant (${r.error.message})` };
  if (r.status !== 0 || !/^2\d\d$/.test(r.stdout) || SIGNATURES_ENVIRONNEMENT.test(r.stderr || "")) {
    return { apte: false, cause: `sonde https://example.com/ en échec (${detail(r.stdout || r.stderr || "réseau")})` };
  }
  return { apte: true };
}

/** Consulte UNE URL et la réduit à ses métadonnées prouvables. Retour :
 *    { controle: "ok", statut_http, url_finale, content_type, octets, empreinte_corps }
 *  | { controle: "inaccessible", cause }                — échec propre à cette URL
 *  | { controle: "environnement", cause }               — signature systémique : au contrôleur
 *                                                         de couper le circuit, jamais une
 *                                                         propriété de la source. */
export function consulterUrl(url) {
  if (!estUrlHttp(url)) return { controle: "inaccessible", cause: "URL hors du contrat HTTP(S) partagé" };
  const travail = mkdtempSync(join(tmpdir(), "fraicheur-"));
  const corps = join(travail, "corps");
  const entetes = join(travail, "entetes");
  try {
    const r = spawnSync("curl", ["-sS", "-v", "--proto", "=http,https", "--proto-redir", "=http,https",
      "-L", "--max-redirs", "5", "--max-time", String(DELAI_PAR_URL_SECONDES), "--max-filesize", String(LIMITE_CORPS_OCTETS),
      "-o", corps, "-D", entetes,
      "-w", "%{http_code}\t%{url_effective}\t%{content_type}", url], { encoding: "utf-8" });
    const stderrBrut = r.stderr || "";
    let entetesBruts = "", corpsBrut = null;
    try { entetesBruts = readFileSync(entetes, "latin1"); } catch { /* pas d'en-têtes : jugé plus bas */ }
    try { corpsBrut = readFileSync(corps); } catch { /* pas de corps : jugé plus bas */ }
    const octets = corpsBrut ? corpsBrut.length : 0;
    /* le corps est déjà en mémoire pour l'empreinte : la signature se cherche dans le corps
     * ENTIER borné — une tranche initiale laissait passer une signature tardive (contre-revue) */
    const corpsTexte = corpsBrut ? corpsBrut.toString("latin1") : "";
    if (SIGNATURES_ENVIRONNEMENT.test(stderrBrut) || SIGNATURES_ENVIRONNEMENT.test(entetesBruts) || SIGNATURES_ENVIRONNEMENT.test(corpsTexte)) {
      return { controle: "environnement", cause: `signature environnementale sur ${url}` };
    }
    if (r.error || r.status !== 0) {
      return { controle: "inaccessible", cause: `curl exit ${r.status ?? "?"} (${detail(r.error?.message || stderrBrut || "réseau")})` };
    }
    const [statut, urlFinale, contentType] = String(r.stdout || "").split("\t");
    if (!/^2\d\d$/.test(statut)) return { controle: "inaccessible", cause: `HTTP ${statut || "?"}` };
    if (!estUrlHttp(urlFinale)) return { controle: "inaccessible", cause: "redirigée hors du contrat HTTP(S)" };
    if (octets > LIMITE_CORPS_OCTETS) return { controle: "inaccessible", cause: `corps au-delà de la borne partagée (${octets} octets)` };
    return {
      controle: "ok",
      statut_http: Number(statut),
      url_finale: urlFinale,
      content_type: contentType || "",
      octets,
      empreinte_corps: createHash("sha256").update(corpsBrut ?? Buffer.alloc(0)).digest("hex"),
    };
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }
}
