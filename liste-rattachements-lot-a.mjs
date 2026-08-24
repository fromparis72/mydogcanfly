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

/** LA borne PARTAGÉE en octets d'un corps de réponse : 25 MiB. Le collecteur la passe à curl
 *  (`--max-filesize`) et la revérifie par stat avant toute lecture ; le validateur exige que
 *  `capture.octets` lui soit inférieur ou égal ET égal à la taille réelle du fichier. */
export const LIMITE_CORPS_OCTETS = 26214400;

/** LE contrat HTTP(S) — un seul code pour toutes les URL du lot A : la liste versionnée,
 *  l'`url_finale` revalidée par le collecteur, et le schéma du manifeste côté validateur
 *  (contre-revue v5-sexies : `z.string().url()` acceptait `file://`). */
export const estUrlHttp = (valeur) => {
  try {
    const u = new URL(String(valeur));
    return /^https?:$/.test(u.protocol) && u.hostname.length > 0;
  } catch { return false; }
};

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
    let parsable = true;
    try { new URL(String(r.url)); } catch { parsable = false; }
    if (!parsable) {
      erreurs.push(`[${k}] : URL imparsable « ${r.url} »`);
    } else if (!estUrlHttp(r.url)) {
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
