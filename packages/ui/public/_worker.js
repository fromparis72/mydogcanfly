// Cloudflare Pages advanced-mode Worker — anciennes URL du site v1, et rien d'autre.
//
// « / » répond TOUJOURS 200, en anglais. Aucune négociation de langue : ni sur l'IP, ni sur
// Accept-Language, ni sur un cookie. La raison tient en une phrase : le sitemap, les balises
// hreflang et x-default désignent tous « / » comme la page anglaise, et une ressource
// annoncée comme stable ne peut pas répondre autre chose selon qui la demande.
//
// Ce que ça coûte, et pourquoi c'est acceptable : un lecteur francophone qui tape le domaine
// nu arrive en anglais. Il a le sélecteur de langue en haut à droite, et un bandeau lui
// propose sa langue (voir components/LanguageSuggestion.astro) — une proposition qu'il peut
// refuser, pas un aiguillage subi. Et il n'arrive presque jamais par le domaine nu : cherchant
// en français, Google lui sert directement /fr/, c'est précisément le rôle des hreflang.
//
// Historique, à ne pas refaire. Jusqu'au 01/08/2026, « / » renvoyait un 302 vers /fr/ ou /es/
// d'après CF-IPCountry et Accept-Language. Googlebot n'envoie ni cookie ni Accept-Language :
// il tombait donc sur le pays de sa sortie réseau. Depuis les États-Unis il voyait bien
// l'anglais — d'où l'illusion que le dispositif était sans danger — mais Google explore aussi
// depuis des IP européennes, et la racine anglaise se dérobait alors sous ses pas. Le cookie
// avait par ailleurs vieilli sans qu'on s'en aperçoive : sa lecture ne connaissait que
// (en|fr|es), si bien qu'un lecteur brésilien ayant choisi le portugais voyait son choix
// ignoré au retour suivant. Deux symptômes, une seule cause : faire dépendre une URL
// canonique de qui la demande.

// ---------------------------------------------------------------------------
// Anciennes URL du site v1 (Search Console en signale plusieurs centaines).
// 301 quand un équivalent pertinent existe — l'autorité des liens est conservée.
// 410 pour ce qui est définitivement supprimé — Google désindexe plus vite qu'avec un 404.
// Les données entre les marqueurs sont générées par packages/knowledge/scripts/map-legacy-urls.mjs.
// Le périmètre est contrôlé par _routes.json : le Worker ne voit jamais les pages vivantes.
// ---------------------------------------------------------------------------
// >>> LEGACY-DATA-START
// GÉNÉRÉ depuis legacy-urls-registre.json par packages/knowledge/scripts/generer-worker-legacy.mjs.
// Ne pas éditer à la main : le registre porte la décision et son motif, ce bloc n'en est que la copie.
const LEGACY_REDIRECTS = new Map([
  ["/aegean-airlines-dog-policy/", "/airlines/aegean/"],
  ["/aeromexico-dog-policy/", "/airlines/aeromexico/"],
  ["/air-algerie-dog-policy/", "/airlines/air-algerie/"],
  ["/air-canada-dog-policy/", "/airlines/air-canada/"],
  ["/air-caraibes-dog-policy/", "/airlines/air-caraibes/"],
  ["/air-europa-dog-policy/", "/airlines/air-europa/"],
  ["/air-france-dog-policy/", "/airlines/air-france/"],
  ["/air-india-dog-policy/", "/airlines/air-india/"],
  ["/air-mauritius-dog-policy/", "/airlines/air-mauritius/"],
  ["/air-tahiti-nui-dog-policy/", "/airlines/air-tahiti-nui/"],
  ["/air-transat-dog-policy/", "/airlines/air-transat/"],
  ["/airline-approved-dog-crate/", "/travel-hub/airline-approved-dog-crate/"],
  ["/airline-pet-policies/", "/airlines/"],
  ["/alaska-airlines-dog-policy/", "/airlines/alaska/"],
  ["/american-airlines-dog-policy/", "/airlines/american/"],
  ["/ana-dog-policy/", "/airlines/ana/"],
  ["/austrian-airlines-dog-policy/", "/airlines/austrian/"],
  ["/avianca-dog-policy/", "/airlines/avianca/"],
  ["/best-dog-cooling-mats/", "/travel-hub/best-dog-cooling-mats/"],
  ["/best-dog-water-fountains-2026/", "/travel-hub/best-dog-water-fountains-2026/"],
  ["/best-travel-dog-bowls/", "/travel-hub/best-travel-dog-bowls/"],
  ["/british-airways-dog-policy/", "/airlines/british-airways/"],
  ["/brussels-airlines-dog-policy/", "/airlines/brussels/"],
  ["/camping-with-a-dog/", "/travel-hub/camping-with-a-dog/"],
  ["/car-travel-dog-gear/", "/travel-hub/car-travel-dog-gear/"],
  ["/categories/", "/travel-hub/"],
  ["/categories/airlines/", "/airlines/"],
  ["/categories/destinations/", "/tools/destinations/"],
  ["/categories/gear/", "/tools/best-crates/"],
  ["/categories/health/", "/travel-hub/"],
  ["/categories/travel/", "/travel-hub/"],
  ["/cathay-pacific-dog-policy/", "/airlines/cathay-pacific/"],
  ["/china-airlines-dog-policy/", "/airlines/china-airlines/"],
  ["/city-trips-with-a-dog/", "/travel-hub/city-trips-with-a-dog/"],
  ["/contact/", "/report-error/"],
  ["/copa-airlines-dog-policy/", "/airlines/copa/"],
  ["/corsair-dog-policy/", "/airlines/corsair/"],
  ["/countryside-weekend-with-a-dog/", "/travel-hub/countryside-weekend-with-a-dog/"],
  ["/delta-dog-policy/", "/airlines/delta/"],
  ["/dog-car-barriers/", "/travel-hub/dog-car-barriers/"],
  ["/dog-car-harness/", "/travel-hub/dog-car-harness/"],
  ["/dog-carrier-backpacks/", "/travel-hub/dog-carrier-backpacks/"],
  ["/dog-carriers-and-crates/", "/travel-hub/dog-carriers-and-crates/"],
  ["/dog-coats-and-boots/", "/travel-hub/dog-coats-and-boots/"],
  ["/dog-digestive-issues-travel/", "/travel-hub/dog-digestive-issues-travel/"],
  ["/dog-ear-infections-swimming/", "/travel-hub/dog-ear-infections-swimming/"],
  ["/dog-first-aid-kit/", "/travel-hub/dog-first-aid-kit/"],
  ["/dog-friendly-accommodation/", "/travel-hub/dog-friendly-accommodation/"],
  ["/dog-friendly-beaches/", "/travel-hub/dog-friendly-beaches/"],
  ["/dog-friendly-france/", "/travel-hub/dog-friendly-france/"],
  ["/dog-friendly-rest-stops/", "/travel-hub/dog-friendly-rest-stops/"],
  ["/dog-gps-trackers/", "/travel-hub/dog-gps-trackers/"],
  ["/dog-grooming-kit-travel/", "/travel-hub/dog-grooming-kit-travel/"],
  ["/dog-heat-safety/", "/tools/heat/"],
  ["/dog-heat-safety/cavalier-king-charles-spaniel/", "/breeds/cavalier-king-charles/"],
  ["/dog-heatstroke/", "/travel-hub/dog-heatstroke/"],
  ["/dog-hypothermia/", "/travel-hub/dog-hypothermia/"],
  ["/dog-injury-first-aid/", "/travel-hub/dog-injury-first-aid/"],
  ["/dog-leashes-collars-harnesses/", "/travel-hub/dog-leashes-collars-harnesses/"],
  ["/dog-motion-sickness/", "/travel-hub/dog-motion-sickness/"],
  ["/dog-muzzles-for-travel/", "/travel-hub/dog-muzzles-for-travel/"],
  ["/dog-night-safety-gear/", "/travel-hub/dog-night-safety-gear/"],
  ["/dog-paw-pad-care/", "/travel-hub/dog-paw-pad-care/"],
  ["/dog-potty-breaks-travel/", "/travel-hub/dog-potty-breaks-travel/"],
  ["/dog-ramps-and-steps/", "/travel-hub/dog-ramps-and-steps/"],
  ["/dog-separation-anxiety-vacation/", "/travel-hub/dog-separation-anxiety-vacation/"],
  ["/dog-stings-and-bites/", "/travel-hub/dog-stings-and-bites/"],
  ["/dog-travel-accessories/", "/travel-hub/dog-travel-accessories/"],
  ["/dog-travel-anxiety/", "/travel-hub/dog-travel-anxiety/"],
  ["/dog-travel-beds/", "/travel-hub/dog-travel-beds/"],
  ["/dog-travel-gear/", "/travel-hub/dog-travel-gear/"],
  ["/dog-travel-requirements-by-country/", "/countries/"],
  ["/dog-travel-toys/", "/travel-hub/dog-travel-toys/"],
  ["/dog-travel-vaccinations/", "/travel-hub/dog-travel-vaccinations/"],
  ["/dog-water-bottles/", "/travel-hub/dog-water-bottles/"],
  ["/easyjet-dog-policy/", "/airlines/easyjet/"],
  ["/editorial-standards/", "/about/"],
  ["/egyptair-dog-policy/", "/airlines/egyptair/"],
  ["/emirates-dog-policy/", "/airlines/emirates/"],
  ["/ethiopian-airlines-dog-policy/", "/airlines/ethiopian/"],
  ["/etihad-airways-dog-policy/", "/airlines/etihad/"],
  ["/eurowings-dog-policy/", "/airlines/eurowings/"],
  ["/eva-air-dog-policy/", "/airlines/eva-air/"],
  ["/feeding-your-dog-while-traveling/", "/travel-hub/feeding-your-dog-while-traveling/"],
  ["/ferry-travel-with-a-dog/", "/travel-hub/ferry-travel-with-a-dog/"],
  ["/finnair-dog-policy/", "/airlines/finnair/"],
  ["/first-vacation-with-your-dog/", "/travel-hub/first-vacation-with-your-dog/"],
  ["/flying-with-a-dog-cabin-hold-cargo/", "/travel-hub/flying-with-a-dog-cabin-hold-cargo/"],
  ["/flying-with-a-dog/", "/travel-hub/flying-with-a-dog/"],
  ["/foxtails-danger-dogs/", "/travel-hub/foxtails-danger-dogs/"],
  ["/french-bee-dog-policy/", "/airlines/french-bee/"],
  ["/hot-pavement-dog-paws/", "/travel-hub/hot-pavement-dog-paws/"],
  ["/iberia-dog-policy/", "/airlines/iberia/"],
  ["/iberia-express-dog-policy/", "/airlines/iberia-express/"],
  ["/international-travel-with-a-dog/", "/travel-hub/international-travel-with-a-dog/"],
  ["/ita-airways-dog-policy/", "/airlines/ita-airways/"],
  ["/japan-airlines-dog-policy/", "/airlines/jal/"],
  ["/jetblue-dog-policy/", "/airlines/jetblue/"],
  ["/klm-dog-policy/", "/airlines/klm/"],
  ["/korean-air-dog-policy/", "/airlines/korean-air/"],
  ["/latam-dog-policy/", "/airlines/latam/"],
  ["/lot-polish-airlines-dog-policy/", "/airlines/lot/"],
  ["/lufthansa-dog-policy/", "/airlines/lufthansa/"],
  ["/mountain-vacations-with-a-dog/", "/travel-hub/mountain-vacations-with-a-dog/"],
  ["/no-pull-dog-harness/", "/travel-hub/no-pull-dog-harness/"],
  ["/norwegian-dog-policy/", "/airlines/norwegian/"],
  ["/philippine-airlines-dog-policy/", "/airlines/philippine/"],
  ["/portable-dog-feeding-gear/", "/travel-hub/portable-dog-feeding-gear/"],
  ["/privacy-policy/", "/privacy/"],
  ["/protecting-dog-paw-pads/", "/travel-hub/protecting-dog-paw-pads/"],
  ["/public-transit-with-a-dog/", "/travel-hub/public-transit-with-a-dog/"],
  ["/qatar-airways-dog-policy/", "/airlines/qatar-airways/"],
  ["/road-trip-with-a-dog/", "/travel-hub/road-trip-with-a-dog/"],
  ["/royal-air-maroc-dog-policy/", "/airlines/royal-air-maroc/"],
  ["/ryanair-dog-policy/", "/airlines/ryanair/"],
  ["/sas-dog-policy/", "/airlines/sas/"],
  ["/saudia-dog-policy/", "/airlines/saudia/"],
  ["/singapore-airlines-dog-policy/", "/airlines/singapore-airlines/"],
  ["/small-dog-carriers/", "/travel-hub/small-dog-carriers/"],
  ["/swiss-air-dog-policy/", "/airlines/swiss/"],
  ["/tap-air-portugal-dog-policy/", "/airlines/tap/"],
  ["/thai-airways-dog-policy/", "/airlines/thai-airways/"],
  ["/ticks-and-fleas-dog-travel/", "/travel-hub/ticks-and-fleas-dog-travel/"],
  ["/train-travel-with-a-dog/", "/travel-hub/train-travel-with-a-dog/"],
  ["/transavia-dog-policy/", "/airlines/transavia/"],
  ["/traveling-by-car-with-a-dog/", "/travel-hub/traveling-by-car-with-a-dog/"],
  ["/traveling-to-australia-with-a-dog/", "/countries/au/"],
  ["/traveling-to-belgium-netherlands-with-a-dog/", "/countries/"],
  ["/traveling-to-brazil-with-a-dog/", "/countries/br/"],
  ["/traveling-to-canada-with-a-dog/", "/countries/ca/"],
  ["/traveling-to-dubai-uae-with-a-dog/", "/countries/ae/"],
  ["/traveling-to-germany-with-a-dog/", "/countries/de/"],
  ["/traveling-to-greece-with-a-dog/", "/countries/gr/"],
  ["/traveling-to-ireland-finland-malta-norway-with-a-dog/", "/countries/"],
  ["/traveling-to-italy-with-a-dog/", "/countries/it/"],
  ["/traveling-to-japan-with-a-dog/", "/countries/jp/"],
  ["/traveling-to-mexico-with-a-dog/", "/countries/mx/"],
  ["/traveling-to-morocco-with-a-dog/", "/countries/ma/"],
  ["/traveling-to-new-zealand-with-a-dog/", "/countries/nz/"],
  ["/traveling-to-portugal-with-a-dog/", "/countries/pt/"],
  ["/traveling-to-singapore-with-a-dog/", "/countries/sg/"],
  ["/traveling-to-spain-with-a-dog/", "/countries/es/"],
  ["/traveling-to-switzerland-with-a-dog/", "/countries/ch/"],
  ["/traveling-to-thailand-with-a-dog/", "/countries/th/"],
  ["/traveling-to-the-eu-with-a-dog/", "/countries/"],
  ["/traveling-to-the-uk-with-a-dog/", "/countries/gb/"],
  ["/traveling-to-the-usa-with-a-dog/", "/countries/us/"],
  ["/traveling-to-tunisia-with-a-dog/", "/countries/tn/"],
  ["/traveling-to-turkey-with-a-dog/", "/countries/tr/"],
  ["/traveling-with-a-puppy/", "/travel-hub/traveling-with-a-puppy/"],
  ["/traveling-with-a-senior-or-sick-dog/", "/travel-hub/traveling-with-a-senior-or-sick-dog/"],
  ["/tunisair-dog-policy/", "/airlines/tunisair/"],
  ["/turkish-airlines-dog-policy/", "/airlines/turkish/"],
  ["/united-airlines-dog-policy/", "/airlines/united/"],
  ["/vietnam-airlines-dog-policy/", "/airlines/vietnam-airlines/"],
  ["/volotea-dog-policy/", "/airlines/volotea/"],
  ["/vueling-dog-policy/", "/airlines/vueling/"],
  ["/weekend-near-paris-with-a-dog/", "/travel-hub/weekend-near-paris-with-a-dog/"],
  ["/westjet-dog-policy/", "/airlines/westjet/"],
  ["/wizz-air-dog-policy/", "/airlines/wizz-air/"],
]);
const GONE_EXACT = new Set([
  "/author/",
  "/posts/",
  "/tags/",
]);
const GONE_PREFIXES = ["/tags/", "/dog-heat-safety/"];
const REDIRECT_PREFIXES = new Map([
  ["/categories/", "/travel-hub/"],
]);
const BREED_ALIAS = new Map([
  ["cavalier-king-charles-spaniel", "cavalier-king-charles"],
]);
// <<< LEGACY-DATA-END
// Search Console, 30/07/2026 : /dog-heat-safety/<race>/ pesait 1 175 impressions, soit
// 14,8 % du site, avec /dog-heat-safety/american-akita/ en page la plus vue (373). Ces URL
// étaient traitées en 410 avec /tags/ et /categories/, comme des vestiges sans équivalent.
// C'était faux : chacune a une fiche race vivante qui traite précisément la chaleur.
// On redirige donc en 301 quand la race existe, et on ne garde le 410 que sinon.
// >>> BREED-SLUGS-START
const BREED_SLUGS = new Set([
  "affenpinscher",
  "afghan-hound",
  "airedale-terrier",
  "akita-inu",
  "alaskan-malamute",
  "alpine-dachsbracke",
  "american-akita",
  "american-bulldog",
  "american-bully-xl",
  "american-cocker-spaniel",
  "american-pit-bull-terrier",
  "american-staffordshire-terrier",
  "anatolian-shepherd",
  "ariege-pointer",
  "australian-cattle-dog-blue-heeler",
  "australian-kelpie",
  "australian-shepherd",
  "barbet",
  "basenji",
  "basset-hound",
  "beagle",
  "beauceron",
  "belgian-malinois",
  "belgian-shepherd-groenendael",
  "belgian-shepherd-tervuren",
  "bernese-mountain-dog",
  "bichon-frise",
  "blue-picardy-spaniel",
  "boerboel",
  "bolognese",
  "border-collie",
  "border-terrier",
  "borzoi-russian-wolfhound",
  "boston-terrier",
  "bouvier-des-flandres",
  "boxer",
  "briard",
  "brittany-spaniel",
  "brussels-griffon",
  "bull-terrier",
  "bullmastiff",
  "ca-de-bou-majorca-mastiff",
  "cairn-terrier",
  "canaan-dog",
  "cane-corso",
  "cardigan-welsh-corgi",
  "caucasian-shepherd",
  "cavalier-king-charles",
  "cavalier-spaniel",
  "central-asian-shepherd",
  "chesapeake-bay-retriever",
  "chihuahua",
  "chow-chow",
  "cirneco-dell-etna",
  "continental-bulldog",
  "continental-toy-spaniel",
  "coton-de-tulear",
  "czechoslovakian-wolfdog",
  "dachshund",
  "dalmatian",
  "doberman",
  "dogo-argentino",
  "dogue-de-bordeaux",
  "dutch-shepherd",
  "english-bulldog",
  "english-cocker-spaniel",
  "english-pointer",
  "english-setter",
  "english-springer-spaniel",
  "eurasier",
  "fila-brasileiro",
  "finnish-lapphund",
  "flat-coated-retriever",
  "fox-terrier",
  "french-bulldog",
  "german-pinscher",
  "german-shepherd",
  "german-shorthaired-pointer",
  "golden-retriever",
  "gordon-setter",
  "great-dane",
  "great-pyrenees",
  "great-pyrenees-patou",
  "greater-swiss-mountain-dog",
  "greyhound",
  "havanese",
  "hovawart",
  "hungarian-vizsla",
  "irish-setter",
  "irish-water-spaniel",
  "irish-wolfhound",
  "italian-greyhound",
  "jack-russell-terrier",
  "japanese-chin",
  "kangal-anatolian-shepherd",
  "kerry-blue-terrier",
  "king-charles-spaniel",
  "kokoni",
  "komondor",
  "kuvasz",
  "labrador-retriever",
  "landseer",
  "large-munsterlander",
  "leonberger",
  "lhasa-apso",
  "long-haired-german-shepherd",
  "lowchen",
  "maltese",
  "maremma-sheepdog",
  "mastiff-english-mastiff",
  "medium-poodle",
  "miniature-american-shepherd",
  "miniature-bull-terrier",
  "miniature-dachshund",
  "miniature-pinscher",
  "miniature-poodle",
  "miniature-schnauzer",
  "mixed-breed-large",
  "mixed-breed-medium",
  "mixed-breed-small",
  "munsterlander",
  "neapolitan-mastiff",
  "newfoundland",
  "norfolk-terrier",
  "norwich-terrier",
  "nova-scotia-duck-tolling-retriever",
  "olde-english-bulldogge",
  "papillon-continental-toy-spaniel",
  "parson-russell-terrier",
  "pekingese",
  "pembroke-welsh-corgi",
  "petit-basset-griffon-vendeen",
  "picardy-spaniel",
  "podenco",
  "polish-lowland-sheepdog",
  "pomeranian",
  "pomeranian-toy-spitz",
  "poodle",
  "portuguese-water-dog",
  "prague-ratter",
  "presa-canario-dogo-canario",
  "pug",
  "pyrenean-shepherd",
  "rhodesian-ridgeback",
  "rottweiler",
  "rough-collie",
  "saint-bernard",
  "saluki",
  "samoyed",
  "schipperke",
  "scottish-deerhound",
  "scottish-terrier",
  "sealyham-terrier",
  "shar-pei",
  "shetland-sheepdog",
  "shetland-sheepdog-sheltie",
  "shiba-inu",
  "shih-tzu",
  "siberian-husky",
  "soft-coated-wheaten-terrier",
  "spanish-greyhound-galgo",
  "spanish-mastiff",
  "spanish-water-dog",
  "staffordshire-bull-terrier",
  "tibetan-terrier",
  "tosa-inu",
  "toy-poodle",
  "weimaraner",
  "west-highland-white-terrier",
  "whippet",
  "white-swiss-shepherd",
  "yorkshire-terrier"
]);
// <<< BREED-SLUGS-END


/** /dog-heat-safety/<slug>/ → /breeds/<slug>/ si la fiche existe, alias v1→v2 compris. */
function heatSafetyTarget(path) {
  const m = /^\/dog-heat-safety\/([a-z0-9-]+)\/?$/.exec(path);
  if (!m) return null;
  const slug = BREED_ALIAS.get(m[1]) ?? m[1];
  return BREED_SLUGS.has(slug) ? `/breeds/${slug}/` : null;
}

function normalizeLegacyPath(pathname) {
  let path = pathname || "/";
  try { path = decodeURI(path); } catch { /* chemin mal encodé : on garde tel quel */ }
  path = path.replace(/\/+/g, "/");
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && !path.endsWith("/")) path += "/";
  return path;
}

const GONE_BODY =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="robots" content="noindex"><title>410 Gone</title></head>' +
  "<body><h1>410 Gone</h1><p>This page has been permanently removed.</p>" +
  '<p><a href="/">MyDogCanFly</a></p></body></html>';

/* Alias tolérants vers /presskit/ — l'URL imprimée sur la plaquette de presse.
 *
 * Un document papier ne se corrige pas : « www.mydogcanfly.com/presskit » est distribué, donc
 * c'est la page qui porte ce nom exact. Ces variantes existent parce qu'un lecteur qui recopie
 * une adresse depuis du papier se trompe — et parce que « press kit » s'écrit aussi en deux
 * mots. Trois caractères de code valent mieux qu'un visiteur perdu sur une 404.
 * Les préfixes de langue sont gérés : /fr/press/ → /fr/presskit/. */
/* Chaque alias porte la langue qu'il sous-entend : quelqu'un qui tape « /presse » attend le
 * français, « /prensa » l'espagnol. Un préfixe explicite dans l'URL l'emporte toujours. */
const PRESSKIT_ALIASES = new Map([
  ["/press", ""], ["/press-kit", ""], ["/media-kit", ""],
  ["/presse", "/fr"], ["/dossier-presse", "/fr"], ["/dossier-de-presse", "/fr"],
  ["/prensa", "/es"], ["/dosier-prensa", "/es"], ["/dosier-de-prensa", "/es"],
]);

function presskitTarget(path) {
  // `normalizeLegacyPath` a déjà ajouté la barre oblique finale : le motif doit l'attendre.
  const m = /^(\/(?:fr|es))?(\/[a-z-]+)\/$/.exec(path);
  if (!m) return null;
  const implied = PRESSKIT_ALIASES.get(m[2]);
  if (implied === undefined) return null;
  return `${m[1] ?? implied}/presskit/`;
}

// Renvoie une Response pour une ancienne URL, ou null si le chemin n'en est pas une.
function legacyResponse(url) {
  const path = normalizeLegacyPath(url.pathname);

  const alias = presskitTarget(path);
  if (alias) {
    return new Response(null, {
      status: 301,
      headers: { Location: alias + url.search, "Cache-Control": "public, max-age=86400" },
    });
  }

  const target = LEGACY_REDIRECTS.get(path);
  if (target) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: target + url.search,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const heat = heatSafetyTarget(path);
  if (heat) {
    return new Response(null, { status: 301, headers: { Location: heat + url.search, "Cache-Control": "public, max-age=86400" } });
  }

  /* Les préfixes 301 passent APRÈS les entrées exactes et les alias de race : une rubrique qui
     a un équivalent précis y va, le reste rejoint le hub qui la reprend. */
  let gone = GONE_EXACT.has(path);
  if (!gone) {
    for (const [prefix, cible] of REDIRECT_PREFIXES) {
      if (path.startsWith(prefix)) {
        return new Response(null, {
          status: 301,
          headers: { Location: cible + url.search, "Cache-Control": "public, max-age=86400" },
        });
      }
    }
    for (const prefix of GONE_PREFIXES) {
      if (path.startsWith(prefix)) { gone = true; break; }
    }
  }
  if (gone) {
    return new Response(GONE_BODY, {
      status: 410,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "public, max-age=3600",
        "X-Robots-Tag": "noindex",
      },
    });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Anciennes URL : traitées avant tout le reste, mais jamais sur "/".
    if (url.pathname !== "/") {
      const legacy = legacyResponse(url);
      if (legacy) return legacy;
    }

    // « / » comme tout le reste : l'actif statique, tel quel. Voir l'en-tête du fichier —
    // aucune branche selon la langue, le pays ou le cookie ne doit réapparaître ici.
    return env.ASSETS.fetch(request);
  },
};
