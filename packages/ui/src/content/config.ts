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
    /* LA RUBRIQUE DU GUIDE — une clé, jamais un libellé.
     *
     * Ce champ était `categories: z.array(z.string()).default([])`, et cette signature portait
     * trois fautes à elle seule. Un TABLEAU, alors qu'une seule valeur était lue. Une CHAÎNE
     * LIBRE, donc traduite dans les 62 guides français importés et anglaise dans les 10 nés du
     * lot 2 — l'index français affichait cinq rubriques pour quatre thèmes. Et un DÉFAUT VIDE,
     * qui laissait un guide sans rubrique se construire sans rien dire.
     *
     * `z.enum` déplace la sanction au plus tôt : une rubrique inventée n'abîme plus l'affichage,
     * elle EMPÊCHE LE SITE DE SE CONSTRUIRE, avec le nom du fichier fautif. Obligatoire et sans
     * défaut : un guide doit dire où il va, et l'oubli doit se voir.
     *
     * Le libellé affiché vit dans les traductions (`travel_hub.category.*`), pas ici. C'est toute
     * la leçon du défaut : un identifiant de regroupement et un texte d'interface sont deux
     * choses, et les confondre rend l'un intraduisible et l'autre invérifiable. */
    category: z.enum(["gear", "travel", "health", "destinations"]),
    tags: z.array(z.string()).default([]),
    /* L'URL sur le site d'origine — matière première des redirections.
     *
     * OPTIONNEL, et il faut dire pourquoi. Ce champ ne sépare pas les langues : il sépare ce qui
     * a été IMPORTÉ de ce qui NAÎT ici. Les 124 guides importés — 62 anglais, 62 français —
     * viennent d'ailleurs : chacun a une adresse antérieure, et `gen-redirects.mjs` la lit pour
     * fabriquer les 301. Tout le reste naît ici et n'a aucun prédécesseur : les guides espagnols
     * et portugais, et désormais les articles anglais écrits directement pour ce site. Leur
     * inventer un `sourceUrl` produirait une donnée fausse — et un jour, une redirection vers une
     * page qui n'a jamais existé.
     *
     * Rendre le champ optionnel ne relâche rien : la garantie est déplacée, pas supprimée.
     * `test-guides-traduits.mjs` exige que les 62 importés anglais et les 62 français soient
     * TOUJOURS là, qu'aucun guide `es`/`pt` ne s'invente une adresse, et — côté anglais, où le
     * corpus hérité est dans ce dépôt — que chaque `sourceUrl` désigne un article de
     * `content/posts/` qui existe réellement. Rien de tout cela n'est formulable par le schéma,
     * qui ne voit ni le chemin du fichier ni le reste du dépôt. */
    sourceUrl: z.string().startsWith("/").optional(),
    /** Le « en bref » : des données, pas un paragraphe, donc réutilisables ailleurs. */
    enbref: z.array(z.string()).default([]),
    cover: z
      .object({
        image: z.string(),
        alt: z.string().optional(),
        /* LE CRÉDIT PHOTO — apprécié, jamais exigé, et ce commentaire disait le contraire.
         *
         * Il affirmait « la licence Unsplash l'exige ». C'est faux : cette licence accorde le
         * droit de copier, modifier et distribuer, y compris commercialement, SANS attribution
         * — laquelle est encouragée et non obligatoire. Une contrainte inventée dans un
         * commentaire finit par être obéie comme une vraie, et se retourne le jour où l'on
         * décide légitimement de s'en écarter.
         *
         * Les 62 guides importés portent une attribution ; les 10 nés du lot 2 n'en portent pas,
         * par décision du propriétaire du site. Le champ reste donc optionnel, et l'écart entre
         * les deux familles est un choix documenté, pas une négligence. */
        credit: z.string().optional(),
      })
      .optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { guides };
