#!/usr/bin/env node
/**
 * LOT A — L'EXTRACTEUR DE TEXTE DÉTERMINISTE ET VERSIONNÉ. La seule voie du brut vers le
 * texte où les extraits s'ancrent.
 *
 * POURQUOI. La contre-revue a montré deux trous dans l'ancrage v5 : un « extrait » fait
 * uniquement de balises se normalisait en chaîne vide — et `"".includes` est vrai partout ;
 * et 17 des 91 candidates sont des PDF, que le validateur lisait en UTF-8 avant d'y retirer
 * des balises HTML — une citation de PDF ne pouvait pas s'ancrer honnêtement par ce chemin.
 *
 * CE MODULE est la réponse : une fonction PURE, sans réseau ni horloge, versionnée par
 * `VERSION_EXTRACTEUR` — le brut, le texte dérivé ET cette version sont scellés ensemble,
 * et le validateur RE-DÉRIVE le texte depuis le brut pour vérifier que le dérivé scellé est
 * bien celui de cet extracteur-là.
 *
 *   · HTML  : balises ôtées (`script`/`style` compris), entités décodées, blancs unifiés,
 *             casse conservée ;
 *   · PDF   : chaîne VIDE, PAR CONSTRUCTION — le brut est conservé (sa capture est sa seule
 *             pièce licite), mais il n'est NI décompressé NI analysé. Rien ne s'ancre dans
 *             le vide : un extrait qui prétend venir d'un PDF rougit ;
 *   · autre : chaîne vide — on n'ancre pas dans ce qu'on ne sait pas lire.
 *
 * `normaliser` est exporté : c'est la normalisation UNIQUE, utilisée des deux côtés de la
 * recherche (texte dérivé et extrait), définie une fois.
 */

/* lot-a-3 : la regex des tableaux TJ de lot-a-2 était AMBIGUË — retour-arrière exponentiel
 * sur les flux dégonflés de PDF réels (incident de collecte du 24/08/2026, PDF des Bahamas :
 * 0,5 s à 20 groupes, 19 s à 28, au-delà de 100 s à 32).
 * lot-a-4 : la même frontière de calcul restait ouverte par `inflateSync`, SANS LIMITE — la
 * borne de 25 MiB s'applique au PDF comprimé, pas aux flux dégonflés (contre-épreuve Codex :
 * 32 699 octets bruts → 33 554 432 octets dégonflés, ratio ×1026, +67,5 MiB de mémoire).
 * Puisque le lot A n'admet AUCUNE preuve textuelle depuis un PDF, le chemin d'analyse PDF
 * est FERMÉ en entier : `extraireTexte` retourne immédiatement la chaîne vide pour tout
 * format `pdf` — plus de décompression, plus d'analyse, plus de surface. */
export const VERSION_EXTRACTEUR = "lot-a-4";

/** Le FORMAT se détecte depuis les OCTETS, jamais depuis le Content-Type déclaré (contre-revue
 *  v5-ter : les mêmes octets `%PDF-` servis en `text/plain` redevenaient une preuve). La
 *  signature `%PDF-` est cherchée dans les 1024 premiers octets, comme le veut la norme. */
export function detecterFormat(tampon) {
  const tete = tampon.slice(0, 1024).toString("latin1");
  if (tete.includes("%PDF-")) return "pdf";
  const debut = tete.replace(/^\uFEFF/, "").trimStart();
  if (debut.startsWith("<") || /<!doctype|<html/i.test(tete)) return "html";
  return "autre";
}

/** Normalisation déterministe : balises ôtées, entités décodées, blancs unifiés, casse gardée. */
export const normaliser = (texte) => String(texte)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"').replace(/&apos;|&#0*39;/gi, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return " "; } })
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(Number(d)); } catch { return " "; } })
  .replace(/\s+/g, " ").trim();

const extraireHtml = (tampon) => normaliser(tampon.toString("utf-8"));

/** Le brut → le texte où les extraits s'ancrent. Pure, déterministe, versionnée.
 *  Le routage suit le FORMAT DÉTECTÉ DEPUIS LES OCTETS — le Content-Type ne sert qu'à
 *  admettre le texte brut sans balises (une page text/plain reste citable).
 *  PDF → chaîne vide IMMÉDIATE (lot-a-4) : ni décompression, ni analyse — le chemin PDF
 *  probatoire est fermé par conception, pas seulement borné. */
export function extraireTexte(tampon, contentType) {
  const format = detecterFormat(tampon);
  if (format === "pdf") return "";
  if (format === "html") return extraireHtml(tampon);
  if (/text\/|xml|json/i.test(String(contentType))) return normaliser(tampon.toString("utf-8"));
  return "";
}
