/**
 * LOT A — LE SCHÉMA STRICT DE LA LISTE DES RATTACHEMENTS, PARTAGÉ.
 *
 * La contre-revue v5-quinquies a montré qu'un schéma tenu par le seul collecteur laisse le
 * validateur permanent VERT devant une liste difforme (`{}` remplaçant le tableau versionné,
 * sortie 0). Le contrat est donc UN SEUL code, importé par les deux outils :
 *   · le collecteur (`consulter-candidates-lot-a.mjs`) refuse AVANT toute écriture ;
 *   · le validateur (`valider-audit-pays.mjs`) rougit sur la même cause, en CI.
 *
 * Le contrat : un TABLEAU d'objets portant EXACTEMENT { url, motif } — URL HTTP(S) uniquement
 * (un schéma local comme file:// ne sera jamais consulté), motif non blanc, URL uniques.
 */

/** Retourne la liste des écarts (vide si la valeur est conforme). */
export function erreursListeRattachements(liste) {
  if (!Array.isArray(liste)) return ["un TABLEAU d'objets { url, motif } est attendu"];
  const erreurs = [];
  const urlsVues = new Set();
  for (const [k, r] of liste.entries()) {
    const cles = Object.keys(r ?? {}).sort();
    if (JSON.stringify(cles) !== JSON.stringify(["motif", "url"])) {
      erreurs.push(`[${k}] : champs [${cles.join(", ")}] — exactement { url, motif } est exigé, aucun champ inconnu`);
      continue;
    }
    let u = null;
    try { u = new URL(String(r.url)); } catch { /* jugé ci-dessous */ }
    if (!u) {
      erreurs.push(`[${k}] : URL imparsable « ${r.url} »`);
    } else if (!/^https?:$/.test(u.protocol) || u.hostname.length === 0) {
      erreurs.push(`[${k}] : « ${r.url} » — HTTP(S) UNIQUEMENT, un schéma local ne sera jamais consulté`);
    }
    if (typeof r.motif !== "string" || r.motif.trim().length === 0) {
      erreurs.push(`[${k}] : motif blanc ou absent`);
    }
    if (urlsVues.has(r.url)) erreurs.push(`[${k}] : URL « ${r.url} » en double`);
    urlsVues.add(r.url);
  }
  return erreurs;
}
