import type { APIRoute } from "astro";

/**
 * /v1/finder côté Pages — volontairement INERTE.
 *
 * Ce fichier exécutait le vrai moteur au build avec une requête écrite en dur
 * (CDG → Tokyo, Golden Retriever) et servait ce rapport à toute requête GET. C'était le
 * « repli hors ligne » du Finder ; en pratique c'était un piège :
 *
 *  - en développement, POST sur une route prérendue n'existe pas → le Finder retombait
 *    toujours sur ce GET, donc tout paraissait fonctionner alors que rien n'était calculé ;
 *  - en production, le moindre POST en échec affichait ce rapport sur le Japon à la place
 *    de la recherche du visiteur. Signalé le 30/07/2026 : « du Tokyo qui apparaît sans
 *    raison dans les résultats ».
 *
 * L'endpoint canonique est le Worker `@mydogcanfly/workers`, routé sur /v1/* : il lit la
 * query string en GET et le corps JSON en POST. Ici on ne renvoie plus qu'un refus explicite,
 * pour qu'aucune couche du site ne puisse plus présenter un exemple comme une réponse.
 * Le corps est le même contrat d'erreur que celui du Worker, sans le `verdict` que le Finder
 * exige désormais pour afficher un rapport.
 */
export const prerender = true;

const body = {
  error: "not_available_here",
  detail:
    "This path is served by the MyDogCanFly API Worker on /v1/*. The static site cannot compute a report: " +
    "use GET /v1/finder?origin=CDG&destination=NRT&weight_kg=8 or POST /v1/finder with a JSON body.",
};

export const GET: APIRoute = () =>
  new Response(JSON.stringify(body), {
    // 200 imposé par le prérendu statique : c'est l'absence de `verdict` qui protège le
    // client, pas le code HTTP. Le Finder refuse tout corps sans verdict.
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
