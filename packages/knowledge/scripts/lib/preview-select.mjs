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
