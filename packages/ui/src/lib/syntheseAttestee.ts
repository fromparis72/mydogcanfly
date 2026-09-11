/**
 * LA SYNTHÈSE LOCALISÉE D'UN CANAL — construite UNIQUEMENT sur des faits attestés (annexe 51).
 *
 * Arbitrage de Philippe, relayé par Codex, après la fiche Air France lue en portugais : le visiteur
 * lisait un état traduit puis une phrase en français, et repartait sans le chiffre. La réponse n'est
 * ni de traduire la citation — une citation traduite n'est plus une citation — ni de réafficher
 * `channels[].detail`, le texte éditorial historique dont les seuils ne sont rattachés à rien.
 *
 * Un nombre et une unité, eux, se rendent dans n'importe quelle langue sans rien interpréter. Cette
 * fonction ne fait que cela : mettre en mots, dans la langue de la page, des faits que le contrat
 * `attestations.ts` a déjà déclarés rattachés à la phrase qui les établit. Elle ne décide rien, ne
 * déduit rien, et rend `null` dès qu'il n'y a aucun fait attesté — ce qui est le cas de 300 des
 * 302 politiques au 11/09/2026.
 *
 * *Le mot du contenant est une convention de RENDU, nommée pour la contre-revue.* Ce que la preuve
 * établit est `includes_carrier` — le seuil porte sur le chien AVEC son contenant. Le mot choisi
 * pour ce contenant suit le CANAL (sac en cabine, caisse en soute et en fret), comme dans l'exemple
 * d'arbitrage de Codex : « cachorro + bolsa » en cabine, « cachorro + caixa » en soute. Ce n'est pas
 * tiré de la citation, et c'est pourquoi c'est écrit ici plutôt que présenté comme un fait.
 */
import { t } from "@mydogcanfly/knowledge";
import type { Claim } from "@mydogcanfly/knowledge";

const nb = (n: number) => String(n);

/** Le sujet pesé : chien avec son contenant, ou chien seul. */
function sujet(claims: Claim[], placement: string, locale: string): string | null {
  const poids = claims.filter((c) => c.kind === "weight_max" || c.kind === "weight_min");
  if (poids.length === 0) return null;
  const avecContenant = poids.some((c) => (c as { includes_carrier: boolean }).includes_carrier);
  if (!avecContenant) return t(locale, "premium.fait.chien_seul");
  return t(locale, placement === "cabin" ? "premium.fait.avec_sac" : "premium.fait.avec_caisse");
}

/** Les bornes, dans l'ordre où on les lit : le plancher puis le plafond. */
function bornes(claims: Claim[], locale: string): string | null {
  const max = claims.find((c) => c.kind === "weight_max") as { kg: number; bound: "lt" | "lte" } | undefined;
  const min = claims.find((c) => c.kind === "weight_min") as { kg: number; bound: "gt" | "gte" } | undefined;
  const mots: string[] = [];
  if (min) mots.push(t(locale, `premium.fait.min_${min.bound}`).replace("{n}", nb(min.kg)));
  if (max) mots.push(t(locale, `premium.fait.max_${max.bound}`).replace("{n}", nb(max.kg)));
  if (mots.length === 0) return null;
  return mots.join(` ${t(locale, "premium.fait.et")} `);
}

/** Les dimensions du contenant. AUCUNE n'est attestée au 11/09/2026 — les dix politiques qui en
 *  portent ont toutes une citation qui n'en dit rien. La branche existe pour le jour où une phrase
 *  officielle sera relevée, pas pour publier ce qui traîne dans le YAML. */
function dimensions(claims: Claim[]): string | null {
  const d = claims.find((c) => c.kind === "carrier_dims_cm") as { l: number; w: number; h: number } | undefined;
  return d ? `${nb(d.l)} × ${nb(d.w)} × ${nb(d.h)} cm` : null;
}

/**
 * LA SYNTHÈSE, ou `null`. Jamais de phrase vide, jamais de « non précisé » : l'absence de fait
 * attesté se dit par l'absence de ligne, pas par une ligne qui parle de rien.
 */
export function syntheseAttestee(claims: readonly Claim[], placement: string, locale: string): string | null {
  const c = [...claims];
  if (c.length === 0) return null;
  const morceaux = [sujet(c, placement, locale), bornes(c, locale), dimensions(c)].filter(Boolean) as string[];
  return morceaux.length ? morceaux.join(", ") : null;
}

/**
 * LE NOM DE LA LANGUE D'UNE CITATION, rendu dans la langue de la page, depuis son étiquette BCP-47.
 *
 * *Exigence de Codex, 11/09* : « conserver le code BCP-47 et produire son nom localisé
 * dynamiquement ; aucune liste limitée au français et à l'anglais ». La mesure lui donne raison —
 * le dépôt cite déjà du coréen et de l'anglais australien. `Intl.DisplayNames` rend « coréen » en
 * français, « inglês » en portugais, « inglés australiano » en espagnol, sans table à maintenir.
 * Si l'étiquette est illisible, on rend l'étiquette elle-même plutôt qu'un nom inventé.
 */
export function nomDeLangue(tag: string | undefined, locale: string): string | null {
  if (!tag) return null;
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
