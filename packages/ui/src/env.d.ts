/// <reference path="../.astro/types.d.ts" />

/* Les trois fonctions posées par le script en ligne de `Base.astro`, déclarées ici pour que
 * TypeScript les connaisse dans les blocs <script> des composants.
 *
 * Elles vivent sur `window` et non dans un module parce qu'elles doivent être disponibles AVANT
 * tout script de composant : Astro compile ces derniers en modules différés, alors que le bloc
 * `is:inline` de Base.astro s'exécute à l'analyse du document. Un import créerait une dépendance
 * qui inverserait cet ordre.
 *
 *   mdcfQuery  lit les paramètres de pré-saisie — dans le dièse d'abord, dans la requête ensuite
 *              (rétrocompatibilité avec les URL déjà indexées et imprimées).
 *   mdcfAncre  rend l'ancre seule du fragment, sans les paramètres.
 *   mdcfPut    ajoute un paramètre à une URL en le plaçant dans le dièse, ancre préservée.
 */
interface Window {
  mdcfQuery: () => URLSearchParams;
  mdcfAncre: () => string;
  mdcfPut: (url: string, cle: string, val: string | null | undefined) => string;
  mdcfCtx?: {
    breed: string;
    air: string;
    setBreed: (v: string) => void;
    setAir: (v: string) => void;
  };
}
