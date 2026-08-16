// TEMPORARY build-sharding helper.
// Lets the large static build run in smaller passes to fit sandbox time limits.
// No effect on a normal build (env vars unset) → returns all paths unchanged.
//   BUILD_ONLY   : if set, only the matching route groups emit pages (others → [])
//                  accepts a COMMA-SEPARATED list — « airlines,countries »
//   BUILD_SLUGS  : if set, only these slugs are emitted. Une entrée peut être NOMMÉE par sa
//                  famille — « airlines:thai-airways,countries:fr » — sinon elle vaut pour
//                  toutes. Le nommage évite qu'un slug demandé pour une famille en filtre une
//                  autre au passage (« fr » est un pays, ce n'est pas une compagnie).
//   BUILD_SHARDS : total number of shards (default 1)
//   BUILD_SHARD  : this pass's shard index, 0-based (default 0)
//
// ---- Pourquoi BUILD_ONLY accepte une LISTE, et pourquoi BUILD_SLUGS existe -------------------
//
// Le contre-test navigateur du 15/08/2026 a trouvé trois anomalies sur les pages d'entités, que
// AUCUN contrôle automatique ne regardait : `build:ci` construit avec `BUILD_ONLY=__none__`, donc
// zéro page d'entité, et les harnais DOM ne lisent que l'accueil et `/tools/fiche`.
//
// Documenter le prérequis n'aurait pas refermé le trou : il fallait que la CI CONSTRUISE des
// pages sentinelles. Deux obstacles, levés ici :
//   · une seule famille à la fois — or il faut une fiche compagnie ET une page pays, et deux
//     builds successifs se nettoient l'un l'autre (`dist` est purgé à chaque passe) ;
//   · tout ou rien dans une famille — 102 compagnies et 200 pays feraient exploser les 36 s
//     du build réduit, alors que quatre fiches suffisent à couvrir les quatre formes de décision.
//
// Les pages hors entités (accueil, outils) ne passent pas par ce filtre : elles restent construites
// quoi qu'il arrive.
export function shardPaths<T extends { params?: Record<string, unknown> }>(name: string, paths: T[]): T[] {
  const env = (globalThis as any).process?.env ?? {};
  const only = env.BUILD_ONLY;
  if (only) {
    const groupes = String(only).split(",").map((s) => s.trim()).filter(Boolean);
    if (!groupes.includes(name)) return [];
  }
  const slugs = env.BUILD_SLUGS;
  let sortie = paths;
  if (slugs) {
    const voulus = new Set<string>();
    for (const brut of String(slugs).split(",").map((s) => s.trim()).filter(Boolean)) {
      const i = brut.indexOf(":");
      if (i < 0) voulus.add(brut);                                   // vaut pour toutes les familles
      else if (brut.slice(0, i) === name) voulus.add(brut.slice(i + 1)); // nommée : celle-ci seulement
    }
    /* Aucune entrée ne vise cette famille → elle n'est pas filtrée par slug. Sinon un
       « countries:fr » viderait au passage la famille `airlines`, sans rien dire. */
    if (voulus.size > 0) {
      /* Le slug est le dernier segment identifiant de la route ; toutes les familles le nomment
         `slug`. Une entrée sans `slug` est conservée — mieux vaut construire une page de trop
         qu'en manquer une et faire passer un harnais faute de matière. */
      sortie = paths.filter((p) => {
        const s = p?.params?.slug;
        return typeof s === "string" ? voulus.has(s) : true;
      });
    }
  }
  const shards = Number(env.BUILD_SHARDS ?? "1");
  const shard = Number(env.BUILD_SHARD ?? "0");
  if (!Number.isFinite(shards) || shards <= 1) return sortie;
  return sortie.filter((_, i) => i % shards === shard);
}
