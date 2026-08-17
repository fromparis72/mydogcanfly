import { defineCollection, z } from "astro:content";

/* Le schéma des guides du Travel Hub.
 *
 * Il est strict à dessein. Les 124 fichiers ont été produits par un script d'import
 * (`import-travel-hub.mjs`) à partir de deux sources hétérogènes — un site Hugo français et
 * les fichiers anglais du site v1. Un schéma laxiste aurait laissé passer les divergences de
 * l'un des deux côtés sans rien dire, et on les aurait découvertes en production, page par
 * page. Ici, une clé manquante fait échouer la construction.
 *
 * `key` est le pivot : c'est lui, et non le slug, qui relie la version française à l'anglaise.
 * Chaque langue garde son propre slug — `camping-avec-chien` et `camping-with-a-dog` — parce
 * qu'une URL doit porter ses mots-clés dans la langue de son lecteur, et parce que les
 * redirections depuis l'ancien site restent ainsi exactement 1 pour 1.
 *
 * `sourceUrl` conserve l'adresse d'origine. Elle ne sert à rien à l'affichage : elle sert à
 * fabriquer les 301 sans avoir à réinventer une correspondance qu'on possède déjà.
 */
const guides = defineCollection({
  type: "content",
  schema: z.object({
    /** Identifiant stable, commun à toutes les langues d'un même guide. */
    key: z.string().min(1),
    title: z.string().min(1),
    /** Titre pour les moteurs quand il diffère du titre affiché. */
    seoTitle: z.string().optional(),
    description: z.string().min(1),
    /** Résumé d'une phrase, réutilisable en liste. */
    summary: z.string().optional(),
    date: z.string(),
    lastmod: z.string(),
    author: z.string().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    /* L'URL sur le site d'origine — matière première des redirections.
     *
     * OPTIONNEL DEPUIS L'ESPAGNOL ET LE PORTUGAIS, et il faut dire pourquoi. Les 124 guides
     * anglais et français viennent d'ailleurs : chacun a une adresse antérieure, et
     * `gen-redirects.mjs` la lit pour fabriquer les 301. Les guides espagnols et portugais,
     * eux, NAISSENT ici : ils n'ont aucun prédécesseur. Leur inventer un `sourceUrl` produirait
     * une donnée fausse — et un jour, une redirection vers une page qui n'a jamais existé.
     *
     * Rendre le champ optionnel ne relâche rien : la garantie est déplacée, pas supprimée.
     * `test-guides-traduits.mjs` exige qu'il soit PRÉSENT sur les 124 fichiers `en`/`fr` et
     * ABSENT des fichiers `es`/`pt` — ce que le schéma, qui ne voit pas le chemin du fichier,
     * ne peut pas formuler. */
    sourceUrl: z.string().startsWith("/").optional(),
    /** Le « en bref » : des données, pas un paragraphe, donc réutilisables ailleurs. */
    enbref: z.array(z.string()).default([]),
    cover: z
      .object({
        image: z.string(),
        alt: z.string().optional(),
        /* Le crédit photo n'est pas décoratif : la licence Unsplash l'exige, et héberger
         * la photo chez soi n'y change rien. */
        credit: z.string().optional(),
      })
      .optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { guides };
