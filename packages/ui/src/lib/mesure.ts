/**
 * MESURE D'AUDIENCE — les deux identifiants publics, et rien d'autre.
 *
 * POURQUOI CE FICHIER EXISTE (17/09/2026). Google Analytics n'affichait strictement aucune
 * activité pour mydogcanfly.com : la propriété existait, le flux « MyDogCanFly » aussi, mais
 * aucune page du site Astro n'a jamais porté de balise. Les anciens gabarits Hugo prévoyaient
 * un partial `google_analytics.html` que `hugo.toml` n'a jamais alimenté. Le site n'a donc
 * jamais rien mesuré, ni avant ni après la migration.
 *
 * DEUX OUTILS, DEUX RÉGIMES.
 *   · Cloudflare Web Analytics — sans cookie, sans identifiant persistant, sans empreinte :
 *     chargé sur toutes les pages, sans consentement, parce qu'il ne lit ni n'écrit rien sur
 *     l'appareil du lecteur. Il donne les pages vues, les pays, les référents.
 *   · Google Analytics 4 — dépose des cookies et transmet l'adresse IP à Google : chargé
 *     UNIQUEMENT après un clic explicite sur « Accepter » dans le bandeau. Avant ce clic, aucune
 *     requête ne part vers Google, pas même un « ping » sans cookie.
 *
 * Ces deux valeurs sont PUBLIQUES par nature : elles figurent dans le HTML de toute page qui
 * mesure son audience. Elles ne sont pas des secrets et ne passent pas par l'environnement — le
 * contrat de provenance scrute les lectures d'environnement dans les paquets, et une lecture
 * de plus aurait dû y être déclarée pour une valeur qui ne change pas le site produit.
 *
 * Le bandeau et le chargement vivent dans `components/Mesure.astro`. Pour couper un outil,
 * mettre sa valeur à "" : le composant n'émet alors rien pour lui.
 */

/** ID de mesure GA4 (forme `G-XXXXXXXXXX`), lu dans Administration → Flux de données. */
export const GA4_ID: string = "G-6H7KB5LR48";

/** Jeton du beacon Cloudflare Web Analytics, site « mydogcanfly.com » créé le 17/09/2026. */
export const CF_BEACON_TOKEN: string = "10692df64e244f9eacd6459f94399030";
