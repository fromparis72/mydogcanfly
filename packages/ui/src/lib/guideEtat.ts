import type { Guide } from "./guides";

/* L'état de connaissance d'un guide du Travel Hub, en un seul endroit.
 *
 * POURQUOI CETTE PORTE EXISTE (13/09/2026). Les 288 pages du Travel Hub étaient les seules du
 * site à entrer au sitemap sans condition : les fiches d'aéroport passent par `reliefEtat.ts`,
 * les fiches de race par `raceEtat.ts`, et le Travel Hub, lui, n'avait rien à prouver. C'était
 * d'autant moins tenable que ces guides ont été produits sans enquête propre — constat de
 * Philippe, 13/09/2026 — et que la Search Console les rangeait déjà en nombre parmi les pages
 * détectées et jamais explorées.
 *
 * LA RÈGLE, arrêtée avec Philippe : reste au sitemap le guide qui CITE au moins une source
 * extérieure vérifiable. Pas une source déclarée en en-tête — le schéma n'en prévoit pas — mais
 * un lien sortant réellement présent dans le corps, vers un domaine qui n'appartient ni au
 * réseau de Philippe ni aux réseaux sociaux. C'est le même principe que partout ailleurs : une
 * page n'est proposée à Google que si elle a quelque chose à dire et qu'elle peut dire d'où elle
 * le tient.
 *
 * CE QUE ÇA DONNE, mesuré sur les 288 fichiers : 204 guides citent au moins un domaine extérieur
 * — service-public.fr, l'ANSES, l'IATA, l'AVMA, le ministère de l'Agriculture, la Centrale
 * Canine, la Commission européenne — et 84 n'en citent aucun, soit 21 guides déclinés en quatre
 * langues. Ce sont, sans exception, des pages d'équipement et de conseils généraux.
 *
 * DEUX EXCLUSIONS QUI NE VONT PAS DE SOI.
 *
 * Les domaines de Philippe ne comptent pas comme source extérieure. `stay-with-bailey.com`
 * apparaît dans 32 guides et appartient au même réseau : le compter reviendrait à laisser une
 * page s'auto-sourcer, ce qui est exactement le défaut que la règle 13 du protocole de preuve
 * interdit aux fiches compagnie. La liste est explicite plutôt que devinée — un domaine ajouté
 * au réseau devra être ajouté ici, et c'est voulu : mieux vaut une omission visible qu'une
 * heuristique qui se trompe en silence.
 *
 * Les réseaux sociaux non plus : un lien vers une chaîne YouTube n'établit rien.
 *
 * CE QUI N'EST PAS FAIT : les 84 guides ne sont ni supprimés, ni retirés du hub, ni coupés du
 * maillage. Ils restent en ligne, listés et atteignables, en `noindex, follow`. Ils reviendront
 * le jour où ils citeront quelque chose — et la porte le constatera d'elle-même, sans qu'une
 * ligne d'ici ne change, puisqu'elle lit le texte et ne tient aucune liste.
 */

/** Le réseau de Philippe. Un lien vers l'un de ces domaines n'est pas une source extérieure. */
const DOMAINES_DU_RESEAU =
  /(^|\.)(mydogcanfly\.com|stay-with-bailey\.com|lechienvoyageur\.com|b2bvenues\.com|eyeshot\.fr|decryptage-tech\.com|trimrs\.com|alerte-canicule\.com|domatch\.fr)$/i;

/** Un profil social n'établit rien. */
const RESEAUX_SOCIAUX = /(^|\.)(instagram\.com|tiktok\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|facebook\.com|pinterest\.[a-z.]+|linkedin\.com)$/i;

const LIEN_MARKDOWN = /\]\((https?:\/\/[^)\s]+)\)/g;
const LIEN_HTML = /href="(https?:\/\/[^"]+)"/g;

/** Les domaines extérieurs réellement cités par le corps d'un guide. */
export function domainesCites(entry: Guide): string[] {
  const corps = (entry as unknown as { body?: string }).body ?? "";
  const vus = new Set<string>();
  for (const motif of [LIEN_MARKDOWN, LIEN_HTML]) {
    motif.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = motif.exec(corps))) {
      let hote: string;
      try {
        hote = new URL(m[1]).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      if (DOMAINES_DU_RESEAU.test(hote) || RESEAUX_SOCIAUX.test(hote)) continue;
      vus.add(hote);
    }
  }
  return [...vus];
}

/** Indexable si, et seulement si, le guide cite au moins une source extérieure. */
export const guideIndexable = (entry: Guide): boolean => domainesCites(entry).length > 0;
