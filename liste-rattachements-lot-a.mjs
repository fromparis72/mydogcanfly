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

/** L'ASSAINISSEMENT PARTAGÉ des projections diagnostiques — un seul code pour le collecteur
 *  et pour tout outil de réparation (contre-revue de la collecte : 46 en-têtes `Set-Cookie`
 *  en clair dans 23 traces, parce que l'assainisseur de traces ne connaissait ni les en-têtes
 *  sensibles ni les préfixes `< `/`> ` de `curl -v` — le harnais n'injectait le secret que
 *  dans la sortie `-D`, jamais dans stderr : faux vert).
 *
 *  · en-têtes (`-D`) : toute ligne `Set-Cookie` / `Authorization` / `WWW-Authenticate` /
 *    `Proxy-*` est remplacée par la marque d'expurgation ;
 *  · traces (`-v`, stderr) : les MÊMES en-têtes sensibles, préfixes curl `< ` et `> `
 *    compris, PLUS toute ligne décrivant notre réseau (proxy, CONNECT, authentification). */
const ENTETE_SENSIBLE = /^(set-cookie|authorization|www-authenticate|proxy-[^:]*)\s*:/i;
export const assainirEntetes = (texte) => String(texte).split(/\r?\n/)
  .map((l) => (ENTETE_SENSIBLE.test(l) ? "[en-tête expurgé : cookies/authentification/proxy]" : l))
  .join("\n");
export const assainirTrace = (texte) => String(texte).split("\n")
  .map((l) => (ENTETE_SENSIBLE.test(l.replace(/^\s*[<>]\s*/, "").replace(/\r$/, ""))
    || /proxy|CONNECT|Authorization|authorization|NO_PROXY|no_proxy/i.test(l)
    ? "[ligne expurgée : proxy/authentification]" : l))
  .join("\n");

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
