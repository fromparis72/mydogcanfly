/**
 * Sélection d'une version Worker Cloudflare par son tag, isolée ici pour être TESTABLE sans
 * compte Cloudflare ni déploiement (voir test-preview-select.mjs à la racine du dépôt).
 *
 * Règle, décidée avec Codex le 11/08/2026 : correspondance EXACTE et UNIQUE sur
 * `annotations["workers/tag"]`, plus `has_preview === true`. Aucun repli heuristique.
 *
 * Pourquoi pas de repli sur le `number` maximal, qui semblait pourtant raisonnable : le jour où
 * deux téléversements se croisent, il choisirait silencieusement la version de l'autre. La
 * vérification de santé en aval finirait par l'attraper, mais après avoir construit et déployé
 * Pages contre la mauvaise adresse — un échec tardif et illisible plutôt qu'un refus net.
 *
 * Piège de format à ne pas réintroduire : `wrangler versions list --json` renvoie les 100
 * versions les plus récentes classées par `number` CROISSANT (la plus récente est la DERNIÈRE).
 * Cette fonction ne dépend d'aucun ordre, exprès.
 */

/** @returns {{ok: true, version: object} | {ok: false, code: string, message: string}} */
export function selectVersionByTag(versions, tag) {
  if (!Array.isArray(versions)) {
    return { ok: false, code: "not_a_list", message: "la sortie de `versions list --json` n'est pas un tableau." };
  }
  const matches = versions.filter((v) => v?.annotations?.["workers/tag"] === tag);

  if (matches.length === 0) {
    return {
      ok: false,
      code: "no_match",
      message:
        `aucune version taguée « ${tag} » dans les ${versions.length} plus récentes ` +
        "(Cloudflare en renvoie au maximum 100). Le téléversement a-t-il abouti, ou le tag a-t-il été perdu ?",
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      code: "ambiguous",
      message:
        `${matches.length} versions portent le tag « ${tag} » (${matches.map((v) => v.id).join(", ")}). ` +
        "Correspondance ambiguë : refus de choisir arbitrairement.",
    };
  }
  const version = matches[0];
  if (version.metadata?.has_preview !== true) {
    return {
      ok: false,
      code: "no_preview",
      message: `la version ${version.id} n'expose pas d'URL de preview (has_preview ≠ true) : rien à vérifier ni à épingler.`,
    };
  }
  if (typeof version.id !== "string" || version.id.length < 8) {
    return { ok: false, code: "bad_id", message: `identifiant de version inexploitable : ${JSON.stringify(version.id)}.` };
  }
  return { ok: true, version };
}

/** URL de preview versionnée : `<8 premiers caractères de l'id>-<worker>.<sous-domaine>` */
export function versionPreviewUrl(versionId, workerName, subdomain) {
  return `https://${versionId.slice(0, 8)}-${workerName}.${subdomain}`;
}

/**
 * Prédicat de santé : la DOUBLE concordance exigée avant d'aller plus loin.
 * `sha` est déclaratif (passé en argument au déploiement, donc falsifiable) ; `worker_version_id`
 * est attribué par Cloudflare au code réellement reçu. Exiger les deux, c'est refuser qu'une
 * simple chaîne bien choisie suffise à faire croire à une traçabilité.
 */
export function healthMatches(body, expectedSha, expectedVersionId) {
  const shaOk = body?.sha === expectedSha;
  const idOk = body?.worker_version_id === expectedVersionId;
  return {
    ok: shaOk && idOk,
    shaOk,
    idOk,
    detail:
      `sha=${body?.sha} (attendu ${expectedSha}) · ` +
      `worker_version_id=${body?.worker_version_id} (attendu ${expectedVersionId})`,
  };
}

/* ── Ajouts du lot F (contre-revue Codex, 11/08/2026) ──────────────────────────────────── */

/** Forme attendue d'une URL Worker VERSIONNÉE : https://<8 hex>-<worker>.<sous-domaine> */
export function validateApiBase(url, workerName, subdomain) {
  if (typeof url !== "string" || url === "") {
    return { ok: false, message: "--api-base attend une URL non vide." };
  }
  const expected = new RegExp(`^https://[0-9a-f]{8}-${workerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.${subdomain.replace(/\./g, "\\.")}$`);
  if (!expected.test(url)) {
    return {
      ok: false,
      message:
        `--api-base=${url} n'est pas une URL Worker versionnée valide.\n` +
        `Attendu : https://<8 caractères hexadécimaux>-${workerName}.${subdomain}\n` +
        "Une URL arbitraire — et en particulier l'alias partagé, sans préfixe de version — est refusée : " +
        "un build de preview doit être épinglé sur une version immuable.",
    };
  }
  return { ok: true };
}

/** Contrôles d'un manifeste avant de s'en servir pour promouvoir l'alias. */
export function validateManifest(m) {
  if (!m || typeof m !== "object") return { ok: false, message: "manifeste illisible ou vide." };
  if (m.schema_version !== 1) return { ok: false, message: `schema_version inattendue : ${m.schema_version} (attendu 1).` };
  if (m.status !== "verified") {
    return {
      ok: false,
      message: `manifeste en statut « ${m.status} »${m.failed_step ? ` (étape ${m.failed_step})` : ""} : seul un déploiement vérifié peut être promu.`,
    };
  }
  if (m.environment !== "preview") return { ok: false, message: `manifeste d'environnement « ${m.environment} », attendu « preview ».` };
  for (const f of ["git_sha", "worker_version_id", "worker_version_url", "pages_immutable_url"]) {
    if (typeof m[f] !== "string" || !m[f]) return { ok: false, message: `champ « ${f} » manquant ou vide dans le manifeste.` };
  }
  if (!/^[0-9a-f]{40}$/i.test(m.git_sha)) return { ok: false, message: `git_sha malformé : ${m.git_sha}` };
  return { ok: true };
}

/**
 * Retrouve l'UUID complet d'un déploiement Pages à partir du préfixe à 8 caractères de son URL
 * immuable, dans la sortie texte de `wrangler pages deployment list`.
 *
 * On cherche par PRÉFIXE et non par position dans un tableau : la mise en forme des colonnes de
 * wrangler peut changer, l'appariement préfixe → UUID non. Correspondance unique exigée.
 */
export function extractPagesDeploymentId(text, prefix) {
  if (typeof text !== "string" || !/^[0-9a-f]{8}$/i.test(prefix ?? "")) return null;
  const uuids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [];
  const matches = [...new Set(uuids.filter((u) => u.toLowerCase().startsWith(prefix.toLowerCase())))];
  return matches.length === 1 ? matches[0] : null;
}

/** Chunks JS hoistés référencés par une page HTML (pour le smoke du bundle réellement servi). */
export function extractHoistedChunks(html) {
  return [...new Set(String(html).match(/\/_astro\/hoisted\.[A-Za-z0-9_-]+\.js/g) ?? [])];
}

/** Réessaie `fn` (async, renvoyant {ok, detail}) jusqu'à succès ou expiration du délai total. */
export async function retryUntil(fn, { totalMs, intervalMs, onRetry = () => {} }) {
  const deadline = Date.now() + totalMs;
  let attempt = 0;
  let lastDetail = "aucune tentative";
  for (;;) {
    attempt++;
    const r = await fn(attempt);
    if (r.ok) return { ok: true, attempt };
    lastDetail = r.detail ?? "sans détail";
    if (Date.now() + intervalMs > deadline) return { ok: false, attempt, lastDetail };
    onRetry(attempt, lastDetail);
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

/* ── Règles d'adresses du bundle (extraites de check-bundle.mjs au L-bis, 11/08/2026) ──────────
 * Extraites ici pour UNE raison : être testables hors ligne par le harnais versionné. La matrice
 * des dix cas (sentinelle à laisser passer, Worker de production versionné à attraper, pièges de
 * sous-chaînes preview/prod…) avait été exécutée à la main lors du lot L — preuve non durable,
 * comme l'a relevé Codex. Elle vit désormais dans test-preview-select.mjs et tourne à chaque CI. */
export const MUTABLE_ALIAS = "https://mydogcanfly-api-preview.fromparis.workers.dev";
export const PRODUCTION_PATTERNS = [
  /https:\/\/(www\.)?mydogcanfly\.com\/v1\//, // l'API sur le domaine de production
  /https:\/\/api\.mydogcanfly\.com/, // hôte API prévu par le plan de séparation (document 12)
  /[0-9a-f]{0,8}-?mydogcanfly-api\.fromparis\.workers\.dev/, // Worker de PRODUCTION, versionné ou non
  /mydogcanfly\.pages\.dev/, // projet Pages Hugo hérité
  /mydogcanfly-v2-preview\.pages\.dev/, // le projet Pages lui-même : un bundle n'a pas à connaître son hôte
];

/** Vrai si la chaîne contient une adresse de production ou d'infrastructure interdite en bundle. */
export function matchesForbidden(src) {
  return PRODUCTION_PATTERNS.some((re) => re.test(src));
}
