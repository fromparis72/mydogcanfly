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
 *   · PDF   : flux `stream…endstream` dégonflés quand ils sont FlateDecode (zlib de Node,
 *             rien d'externe), opérateurs de texte `Tj`/`TJ`/`'` relevés, chaînes littérales
 *             (échappements et octaux) et hexadécimales décodées, blancs unifiés. Un PDF
 *             scanné ou illisible produit une chaîne VIDE — et rien ne s'ancre dans le vide :
 *             c'est voulu, un extrait qui prétend en venir rougit ;
 *   · autre : chaîne vide — on n'ancre pas dans ce qu'on ne sait pas lire.
 *
 * `normaliser` est exporté : c'est la normalisation UNIQUE, utilisée des deux côtés de la
 * recherche (texte dérivé et extrait), définie une fois.
 */
import { inflateSync } from "node:zlib";

export const VERSION_EXTRACTEUR = "lot-a-2";

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

/** Décode une chaîne littérale PDF : échappements \n \r \t \( \) \\ et octaux \ddd. */
const decoderLitterale = (s) => s.replace(/\\(\d{1,3}|.)/g, (_, e) => {
  if (/^\d/.test(e)) { try { return String.fromCharCode(parseInt(e, 8)); } catch { return ""; } }
  return { n: "\n", r: "\r", t: "\t", "(": "(", ")": ")", "\\": "\\" }[e] ?? e;
});

const extrairePdf = (tampon) => {
  const brut = tampon.toString("latin1");
  /* Chaque flux est tenté en FlateDecode ; s'il ne se dégonfle pas, il est lu tel quel. */
  const morceaux = [];
  const flux = /stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while ((m = flux.exec(brut)) !== null) {
    let contenu = m[1];
    try { contenu = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { /* flux non compressé */ }
    morceaux.push(contenu);
  }
  const corpus = morceaux.length ? morceaux.join("\n") : brut;
  const textes = [];
  /* (chaîne) Tj · (chaîne) ' · [ (a) -120 (b) ] TJ · <hex> Tj */
  for (const t of corpus.matchAll(/\(((?:\\.|[^\\()])*)\)\s*(?:Tj|')/g)) textes.push(decoderLitterale(t[1]));
  for (const t of corpus.matchAll(/\[((?:\((?:\\.|[^\\()])*\)|[^\]])*)\]\s*TJ/g)) {
    for (const s of t[1].matchAll(/\(((?:\\.|[^\\()])*)\)/g)) textes.push(decoderLitterale(s[1]));
  }
  for (const t of corpus.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    const hex = t[1].replace(/\s+/g, "");
    let s = "";
    for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    textes.push(s);
  }
  return textes.join(" ").replace(/\s+/g, " ").trim();
};

/** Le brut → le texte où les extraits s'ancrent. Pure, déterministe, versionnée.
 *  Le routage suit le FORMAT DÉTECTÉ DEPUIS LES OCTETS — le Content-Type ne sert qu'à
 *  admettre le texte brut sans balises (une page text/plain reste citable). */
export function extraireTexte(tampon, contentType) {
  const format = detecterFormat(tampon);
  if (format === "pdf") return extrairePdf(tampon);
  if (format === "html") return extraireHtml(tampon);
  if (/text\/|xml|json/i.test(String(contentType))) return normaliser(tampon.toString("utf-8"));
  return "";
}
