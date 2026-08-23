/**
 * categories-guides.mjs — les quatre rubriques du Travel Hub, et la seule table qui les nomme.
 *
 * Une rubrique a une CLÉ, écrite dans la donnée, et un LIBELLÉ, écrit dans les traductions. La
 * confusion des deux est le défaut que ce module existe pour rendre impossible : jusqu'au
 * 23/08/2026, le champ `categories` du front matter contenait le texte affiché, traduit dans les
 * guides français importés et anglais partout ailleurs. L'index français montrait cinq rubriques
 * pour quatre thèmes ; les index espagnol et portugais affichaient « Gear » et « Health ».
 *
 * Cette table est lue par le script de migration ET par le script d'import. Elle n'est écrite
 * qu'ici : deux copies d'une même correspondance divergent toujours, et celle-là a déjà divergé
 * une fois — entre les guides importés et les guides traduits.
 */

/** Les quatre clés canoniques, dans l'ordre où elles ont été décidées. */
export const CLES = ["gear", "travel", "health", "destinations"];

/**
 * Toutes les orthographes rencontrées dans les données historiques, et leur clé.
 *
 * Écrite À LA MAIN, et il faut dire pourquoi : une normalisation automatique — minuscules,
 * accents retirés — apparierait « Santé » et « Sante », mais jamais « Voyager » et « Travel ».
 * Elle donnerait donc l'illusion de couvrir un cas qu'elle ne couvre pas, ce qui est pire que
 * de ne rien couvrir du tout.
 */
export const CANONIQUE = new Map([
  ["Gear", "gear"],
  ["Équipement", "gear"],
  ["Travel", "travel"],
  ["Voyager", "travel"],
  ["Health", "health"],
  ["Santé", "health"],
  ["Destinations", "destinations"],
]);

/**
 * Les valeurs admises en SECONDE position et délibérément abandonnées.
 *
 * Un seul article — `flying-with-a-dog-cabin-hold-cargo`, dans les quatre langues — portait
 * `["Travel", "Airlines"]`. Cette seconde valeur n'a jamais été rendue : le hub ne lisait que la
 * première. Ce n'est donc pas une cinquième rubrique qu'on supprime, c'est une donnée morte.
 *
 * Sur ce qu'il en reste, il faut être exact. Le même article porte des `tags` — avion, cabine,
 * soute, fret — qui recouvrent le sujet, mais ces `tags` NE SONT RENDUS NULLE PART : ni sur
 * l'index, ni sur la page d'un guide. Aucun gabarit ne les lit. Écrire qu'ils « restent
 * affichés » serait faux, et cette phrase a bel et bien figuré ici avant que la contre-revue ne
 * la relève. L'énoncé juste est plus modeste : rien de VISIBLE n'est perdu, puisque rien de tout
 * cela n'était visible, et le sujet reste retrouvable DANS LA DONNÉE.
 *
 * Les nommer ici est ce qui distingue une décision d'un oubli : une seconde valeur absente de
 * cette liste fait échouer l'appelant.
 */
export const ABANDONNEES = new Set(["Airlines", "Compagnies aériennes"]);

/** La clé d'un libellé historique, ou `null` s'il est inconnu. L'appelant décide quoi en faire. */
export const cleCanonique = (libelle) => CANONIQUE.get(libelle) ?? null;

/** Vrai si la valeur est déjà l'une des quatre clés. */
export const estCle = (v) => CLES.includes(v);
