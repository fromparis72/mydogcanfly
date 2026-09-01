/**
 * LE DÉTECTEUR DE MONTANTS TARIFAIRES — une seule définition, partagée par tous les contrôles.
 *
 * POURQUOI IL EXISTE. Le micro-lot Tarifs interdit de publier un prix que rien ne rattache au
 * trajet demandé. Plusieurs rédactions successives de mes contrôles ont manqué la moitié des cas :
 * l'une ne comparait que les chaînes EXACTES du champ hérité `fees` et laissait passer les mêmes
 * prix reformulés ailleurs ; une autre ne regardait que la balise `<meta name="description">` et
 * ignorait `og:description`, `twitter:description` et le JSON-LD, où la même phrase est recopiée.
 *
 * CE QU'IL RECONNAÎT — la devise AVANT ou APRÈS le nombre, en symbole ou en code ISO, avec la
 * virgule ou le point pour décimale, et les espaces d'usage typographique (fine, insécable) comme
 * séparateurs de milliers. Mesuré sur les fiches : China Southern écrit le même prix sous quatre
 * formes selon la langue — `¥5,000`, `¥5.000`, `5 000 ¥`, `5000 ¥` — et un détecteur qui n'en
 * verrait qu'une laisserait passer les trois autres.
 *
 * CE QU'IL NE RECONNAÎT PAS, ET PAR STRUCTURE PLUTÔT QUE PAR LISTE D'EXEMPLES. Un nombre n'est un
 * montant QUE s'il est adjacent à un marqueur de devise. Un poids (« 8 kg »), une dimension
 * (« 55 × 35 × 25 cm »), une durée (« 10 h »), une date (« 2026-07-11 ») ou un pourcentage n'en
 * portent aucun : ils ne peuvent donc pas être confondus, quelle que soit leur valeur. C'est le
 * marqueur qui décide, jamais la grandeur du nombre — « €8 » est un montant, « 8 kg » n'en est
 * pas un, et aucune liste d'exceptions n'est nécessaire pour les séparer.
 */

/* Les symboles, les plus longs d'abord : « US$ » doit gagner sur « $ ». */
const SYMBOLES = "US\\$|A\\$|C\\$|R\\$|NZ\\$|HK\\$|S\\$|NT\\$|\\$|€|£|¥|₩|₹|₽|฿|₺|₪|₦|₫";
/* Les codes ISO effectivement rencontrés sur les fiches, plus les grandes devises. */
const CODES = "EUR|USD|GBP|CHF|ZAR|AUD|NZD|CAD|SEK|NOK|DKK|ISK|PLN|CZK|HUF|RON|RSD|BGN|HRK|TRY"
  + "|MAD|TND|EGP|XPF|XOF|JPY|CNY|KRW|INR|THB|VND|IDR|MYR|SGD|PHP|TWD|HKD|BRL|MXN|ARS|CLP|COP"
  + "|PEN|UYU|AED|SAR|QAR|KWD|OMR|BHD|JOD|ILS|KES|MUR|NGN|GHS|RUB|UAH";
/* Le nombre : chiffres, séparateurs de milliers (virgule, point, espace fine ou insécable),
   décimales. Il doit COMMENCER et FINIR par un chiffre. */
const NOMBRE = "\\d(?:[\\d.,\\u00a0\\u202f\\u2009 ]*\\d)?";

export const MOTIF_MONTANT = new RegExp(
  `(?:${SYMBOLES})\\s?${NOMBRE}`               // €200, US$ 500, ¥5,000
  + `|${NOMBRE}\\s?(?:${SYMBOLES})`            // 200 €, 89,99 €
  + `|\\b(?:${CODES})\\s?${NOMBRE}`            // ZAR 300, CHF 90
  + `|\\b${NOMBRE}\\s?(?:${CODES})\\b`,        // 300 ZAR, 90 CHF
  "gi",
);

/** Combien de montants dans ce texte. */
export function compter(texte) {
  MOTIF_MONTANT.lastIndex = 0;
  return (String(texte ?? "").match(MOTIF_MONTANT) ?? []).length;
}

/** Les montants trouvés, dans l'ordre. */
export function trouver(texte) {
  MOTIF_MONTANT.lastIndex = 0;
  return [...String(texte ?? "").matchAll(MOTIF_MONTANT)].map((m) => ({ texte: m[0], index: m.index }));
}

/**
 * LES QUATRE ZONES D'UNE PAGE, séparément. Le corps seul ne suffit pas : la description est
 * recopiée dans `<meta name="description">`, `og:description`, `twitter:description` ET le
 * JSON-LD — quatre exemplaires publics d'une même phrase source, tous lus par les moteurs.
 */
export function zonesDe(html) {
  const metas = [...html.matchAll(/<meta[^>]*>/gi)].map((m) => m[0])
    .filter((m) => /name="(description|twitter:description)"|property="og:description"/i.test(m))
    .join("\n");
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]).join("\n");
  const corps = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/i, " ");
  return { corps, metas, jsonLd, tout: html };
}
