#!/usr/bin/env node
/* Emplacements réels des coins pipi — recherche des 29 et 30/07/2026 sur les sites officiels.
 *
 *   node packages/knowledge/scripts/add-pet-relief-locations.mjs [--dry]
 *
 * Pourquoi : 31 aéroports annonçaient « zone disponible » avec `locations: []`, déduits de
 * la règle fédérale américaine (14 CFR §382.51) et non observés. Le lecteur lisait « oui,
 * il y en a une » puis ne trouvait nulle part OÙ. Chaque emplacement ci-dessous a été lu sur
 * une page réellement consultée ; aucune n'est déduite.
 *
 * Traduction : le vocabulaire est très répétitif (terminal, concourse, gate, landside…).
 * Il est traduit par table, pas à la main, pour rester rigoureusement cohérent d'une fiche
 * à l'autre — un lecteur qui compare deux aéroports doit lire les mêmes mots.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OBJ = resolve(ROOT, "packages/knowledge/raw/objects.json");
const dry = process.argv.includes("--dry");
const TODAY = "2026-07-30", DUE = "2027-07-30";

// ── Vocabulaire commun. Ordre important : les expressions longues d'abord.
const VOCAB = [
  // Expressions longues d'abord : « baggage claim level » avant « level ».
  [/\bTom Bradley International Terminal\b/g, ["Terminal international Tom Bradley", "Terminal internacional Tom Bradley"]],
  [/\bInternational Arrivals Facility\b/g, ["terminal des arrivées internationales", "terminal de llegadas internacionales"]],
  [/\bGround Transportation Plaza\b/g, ["parvis des transports", "explanada de transportes"]],
  [/\bunderground train station\b/g, ["station du train souterrain", "estación del tren subterráneo"]],
  [/\bbaggage claim level\b/gi, ["niveau livraison bagages", "nivel de recogida de equipajes"]],
  [/\bBaggage Claim\b/gi, ["livraison bagages", "recogida de equipajes"]],
  [/\bbag claim\b/gi, ["livraison bagages", "recogida de equipajes"]],
  [/\bsecurity checkpoint\b/gi, ["poste de contrôle", "control de seguridad"]],
  [/\bGround Transportation\b/gi, ["pôle transports", "transporte terrestre"]],
  [/\bDenver Transit Center\b/g, ["gare intermodale de Denver", "estación intermodal de Denver"]],
  [/\bthe Light Rail station\b/gi, ["la station de tramway", "la estación de tranvía"]],
  [/\bLight Rail station\b/gi, ["station de tramway", "estación de tranvía"]],
  [/\bMetrorail station entrance\b/gi, ["entrée de la station de métro", "entrada de la estación de metro"]],
  [/\bMarine Air Terminal\b/g, ["Marine Air Terminal", "Marine Air Terminal"]],
  [/\bMcNamara Terminal\b/g, ["terminal McNamara", "terminal McNamara"]],
  [/\bEvans Terminal\b/g, ["terminal Evans", "terminal Evans"]],
  [/\bJeppesen Terminal\b/g, ["terminal Jeppesen", "terminal Jeppesen"]],
  [/\bBarbara Jordan Terminal\b/g, ["terminal Barbara Jordan", "terminal Barbara Jordan"]],
  [/\bMain Terminal\b/g, ["terminal principal", "terminal principal"]],
  [/\bAirport Mall\b/g, ["galerie marchande", "galería comercial"]],
  [/\bFood & Shops\b/g, ["restaurants et boutiques", "restaurantes y tiendas"]],
  [/\bFood Court\b/g, ["espace restauration", "zona de restauración"]],
  [/\bfamily restroom\b/gi, ["toilettes familiales", "aseo familiar"]],
  [/\brestrooms?\b/gi, ["toilettes", "aseos"]],
  [/\bparking garages?\b/gi, ["parking couvert", "aparcamiento cubierto"]],
  [/\bHourly Garage\b/g, ["parking horaire", "aparcamiento por horas"]],
  [/\bEconomy garages\b/gi, ["parkings longue durée", "aparcamientos de larga estancia"]],
  [/\bCell Phone Lot\b/gi, ["parking d'attente", "aparcamiento de espera"]],
  [/\bparking lot\b/gi, ["parking", "aparcamiento"]],
  [/\btraffic lanes\b/gi, ["voies de circulation", "carriles de circulación"]],
  [/\bterminal roadway curb\b/gi, ["trottoir devant le terminal", "acera frente a la terminal"]],
  [/\bDeparting Flights Road\b/g, ["voie des départs", "vía de salidas"]],
  [/\bArriving Flights Road\b/g, ["voie des arrivées", "vía de llegadas"]],
  [/\bArrivals drive\b/gi, ["voie des arrivées", "vía de llegadas"]],
  [/\bcustoms area\b/gi, ["zone douane", "zona de aduanas"]],
  [/\binternational arrivals area\b/gi, ["zone des arrivées internationales", "zona de llegadas internacionales"]],
  [/\binternational baggage claim\b/gi, ["livraison bagages internationale", "recogida de equipajes internacional"]],
  [/\barriving international passengers only\b/gi, ["passagers internationaux à l'arrivée uniquement", "solo pasajeros internacionales que llegan"]],
  [/\bside not published\b/gi, ["côté non publié", "lado no publicado"]],
  [/\blocation not published\b/gi, ["emplacement non publié", "ubicación no publicada"]],
  [/\bon request from the Assisted Travel team\b/gi, ["sur demande auprès de l'équipe Assisted Travel", "a petición del equipo Assisted Travel"]],
  [/\bService animal spend area after security\b/gi, ["Zone de soulagement pour chien d'assistance après les contrôles", "Zona de alivio para perro de asistencia tras el control"]],
  [/\bOutdoor Deck\b/g, ["terrasse extérieure", "terraza exterior"]],
  [/\boutdoor dog park\b/gi, ["parc à chiens extérieur", "parque canino exterior"]],
  [/\boutdoor dog area\b/gi, ["espace canin extérieur", "zona canina exterior"]],
  [/\bdog park\b/gi, ["parc à chiens", "parque canino"]],
  [/\bgrassy areas?\b/gi, ["espace enherbé", "zona con césped"]],
  [/\bfenced outdoor area\b/gi, ["espace extérieur clôturé", "zona exterior vallada"]],
  [/\bfenced grassy area\b/gi, ["espace enherbé clôturé", "zona con césped vallada"]],
  [/\bfenced\b/gi, ["clôturé", "vallado"]],
  [/\boutdoor atrium\b/gi, ["atrium extérieur", "atrio exterior"]],
  [/\bfour outdoor areas\b/gi, ["quatre espaces extérieurs", "cuatro zonas exteriores"]],
  [/\boutdoor area\b/gi, ["espace extérieur", "zona exterior"]],
  [/\bindoor area\b/gi, ["espace intérieur", "zona interior"]],
  [/\bindoor room\b/gi, ["local intérieur", "sala interior"]],
  [/\btemporary area\b/gi, ["zone provisoire", "zona provisional"]],
  [/\bCenter Core\b/gi, ["noyau central", "núcleo central"]],
  [/\bthe mail drop\b/gi, ["la boîte aux lettres", "el buzón de correo"]],
  [/\bmail drop\b/gi, ["la boîte aux lettres", "el buzón de correo"]],
  [/\bthe Great Hall\b/g, ["le Great Hall", "el Great Hall"]],
  [/\bNational Hall\b/g, ["National Hall", "National Hall"]],
  [/\bWest Plaza\b/g, ["West Plaza", "West Plaza"]],
  [/\bticket counter\b/gi, ["comptoir d'enregistrement", "mostrador de facturación"]],
  [/\bentry doors?\b/gi, ["porte d'accès", "puerta de acceso"]],
  [/\bexit Door\b/gi, ["sortie porte", "salida puerta"]],
  [/\bexit near\b/gi, ["sortie près de", "salida cerca de"]],
  [/\bexit\b/gi, ["sortie", "salida"]],
  [/\bentrance\b/gi, ["entrée", "entrada"]],
  [/\bconnector bridge\b/gi, ["passerelle de liaison", "pasarela de conexión"]],
  [/\bwalkway\b/gi, ["passerelle", "pasarela"]],
  [/\bConnector\b/gi, ["liaison", "conexión"]],
  [/\bCheckpoint\b/gi, ["poste de contrôle", "control de seguridad"]],
  [/\bsatellite piers\b/gi, ["satellites", "satélites"]],
  [/\bConcourses\b/g, ["jetées", "diques"]],
  [/\bConcourse\b/gi, ["jetée", "dique"]],
  // Attention : seul le PLURIEL désigne les satellites (Tampa « each of the four airsides »).
  // La forme singulière est le marqueur de zone et doit rester « côté piste » — la règle
  // « airsides? » attrapait les deux et affichait « (satellite) » sur 107 emplacements.
  [/\bairsides\b/gi, ["satellites", "satélites"]],
  [/\bTerminals\b/g, ["Terminaux", "Terminales"]],
  [/\bTerminal\b/gi, ["Terminal", "Terminal"]],
  [/\bnear Gates\b/gi, ["près des portes", "cerca de las puertas"]],
  [/\bnear Gate\b/gi, ["près de la porte", "cerca de la puerta"]],
  [/\bacross from Gate\b/gi, ["face à la porte", "frente a la puerta"]],
  [/\bnext to Gate\b/gi, ["à côté de la porte", "junto a la puerta"]],
  [/\bat Gate\b/gi, ["à la porte", "en la puerta"]],
  [/\bby Gate\b/gi, ["près de la porte", "cerca de la puerta"]],
  [/\bgate level\b/gi, ["niveau des portes", "nivel de puertas"]],
  [/\bGates\b/gi, ["portes", "puertas"]],
  [/\bGate\b/gi, ["porte", "puerta"]],
  [/\bMezzanine level\b/gi, ["niveau mezzanine", "nivel entreplanta"]],
  [/\bsecond level\b/gi, ["deuxième niveau", "segundo nivel"]],
  [/\blower level\b/gi, ["niveau inférieur", "nivel inferior"]],
  [/\bupper level\b/gi, ["niveau supérieur", "nivel superior"]],
  [/\bground level\b/gi, ["rez-de-chaussée", "planta baja"]],
  [/\bLevel 1 Arrivals\b/g, ["niveau 1 arrivées", "nivel 1 llegadas"]],
  [/\bLevel\b/gi, ["niveau", "nivel"]],
  [/\bArrivals\b/gi, ["arrivées", "llegadas"]],
  [/\bDepartures\b/gi, ["départs", "salidas"]],
  [/\bTicketing\b/gi, ["enregistrement", "facturación"]],
  [/\bcurbside\b/gi, ["au trottoir", "en la acera"]],
  [/\bcurb\b/gi, ["trottoir", "acera"]],
  [/\bpost-security\b/gi, ["après sûreté", "después del control"]],
  [/\bpre-security\b/gi, ["avant sûreté", "antes del control"]],
  [/\bairside\b/gi, ["côté piste", "lado aire"]],
  [/\blandside\b/gi, ["côté ville", "lado tierra"]],
  [/\binside security\b/gi, ["après les contrôles", "tras el control"]],
  [/\bafter security\b/gi, ["après les contrôles", "tras el control"]],
  // « end of the » doit passer avant la règle générique « of the », sinon « end » survit.
  [/\bat the end of the\b/gi, ["au bout de la", "al final de la"]],
  [/\bend of the\b/gi, ["bout de la", "final de la"]],
  [/\boutdoors\b/gi, ["en extérieur", "al aire libre"]],
  [/\boutdoor deck\b/gi, ["terrasse extérieure", "terraza exterior"]],
  [/\bnorth end\b/gi, ["extrémité nord", "extremo norte"]],
  [/\bsouth end\b/gi, ["extrémité sud", "extremo sur"]],
  [/\bwest end\b/gi, ["extrémité ouest", "extremo oeste"]],
  [/\beast end\b/gi, ["extrémité est", "extremo este"]],
  [/\ba grassy area at each end\b/gi, ["un espace enherbé à chaque extrémité", "una zona con césped en cada extremo"]],
  [/\beach end\b/gi, ["chaque extrémité", "cada extremo"]],
  [/\bwest side of\b/gi, ["côté ouest du", "lado oeste del"]],
  [/\beast side of\b/gi, ["côté est du", "lado este del"]],
  [/\bwest side\b/gi, ["côté ouest", "lado oeste"]],
  [/\beast side\b/gi, ["côté est", "lado este"]],
  [/\bnorth side\b/gi, ["côté nord", "lado norte"]],
  [/\bsouth side\b/gi, ["côté sud", "lado sur"]],
  [/\bwest of\b/gi, ["à l'ouest de", "al oeste de"]],
  [/\beast of\b/gi, ["à l'est de", "al este de"]],
  [/\bnorth of\b/gi, ["au nord de", "al norte de"]],
  [/\bsouth of\b/gi, ["au sud de", "al sur de"]],
  [/\bB side\b/g, ["côté B", "lado B"]],
  [/\bC side\b/g, ["côté C", "lado C"]],
  [/\bon the wing for\b/gi, ["dans l'aile desservant les", "en el ala que sirve a las"]],
  [/\bwing\b/gi, ["aile", "ala"]],
  [/\bthe terminal\b/gi, ["le terminal", "la terminal"]],
  [/\bthe building\b/gi, ["le bâtiment", "el edificio"]],
  [/\bthe tunnel\b/gi, ["le tunnel", "el túnel"]],
  [/\bCarousel\b/gi, ["tapis", "cinta"]],
  [/\bstore\b/gi, ["boutique", "tienda"]],
  [/\bClub\b/g, ["salon", "sala"]],
  [/\bLounge\b/gi, ["salon", "sala"]],
  [/\bGarden\b/g, ["Garden", "Garden"]],
  [/\bstation\b/gi, ["station", "estación"]],
  [/\badjacent to\b/gi, ["attenant à", "contiguo a"]],
  [/\bacross from\b/gi, ["face à", "frente a"]],
  [/\bnext to\b/gi, ["à côté de", "junto a"]],
  [/\bjust past\b/gi, ["juste après", "justo después de"]],
  [/\bjust outside\b/gi, ["juste à l'extérieur de", "justo fuera de"]],
  [/\bjust beyond\b/gi, ["juste après", "justo después de"]],
  [/\bbeginning of\b/gi, ["début de", "inicio de"]],
  [/\bbefore\b/gi, ["avant", "antes de"]],
  [/\bbehind\b/gi, ["derrière", "detrás de"]],
  [/\bbetween\b/gi, ["entre", "entre"]],
  [/\bthrough\b/gi, ["par", "por"]],
  [/\bacross\b/gi, ["de l'autre côté de", "al otro lado de"]],
  [/\boutside\b/gi, ["à l'extérieur de", "fuera de"]],
  [/\binside\b/gi, ["à l'intérieur de", "dentro de"]],
  [/\bpast\b/gi, ["après", "después de"]],
  [/\bnear the\b/gi, ["près de", "cerca de"]],
  [/\bnear\b/gi, ["près de", "cerca de"]],
  [/\bthen right\b/gi, ["puis à droite", "luego a la derecha"]],
  [/\bthen left\b/gi, ["puis à gauche", "luego a la izquierda"]],
  [/\bwith seating\b/gi, ["avec sièges", "con asientos"]],
  [/\bFour areas\b/gi, ["Quatre zones", "Cuatro zonas"]],
  [/\barea\b/gi, ["zone", "zona"]],
  [/\bareas\b/gi, ["zones", "zonas"]],
  [/\broom\b/gi, ["local", "sala"]],
  [/\bDoors?\b/gi, ["porte d'accès", "puerta de acceso"]],
  [/\bin front of\b/gi, ["devant", "delante de"]],
  [/\bon the\b/gi, ["au", "en el"]],
  [/\bin the\b/gi, ["dans", "en"]],
  [/\bat the\b/gi, ["au", "en el"]],
  [/\bof the\b/gi, ["du", "del"]],
  [/\bfor\b/gi, ["pour", "para"]],
  [/\band\b/gi, ["et", "y"]],
  [/\bthe\b/gi, ["le", "el"]],
  [/\bof\b/gi, ["de", "de"]],
  [/\bto\b/gi, ["à", "a"]],
  [/\bat\b/gi, ["à", "en"]],
  [/\bon\b/gi, ["à", "en"]],
  [/\bin\b/gi, ["dans", "en"]],
  [/\bonly\b/gi, ["uniquement", "únicamente"]],
];
const tr = (en, i) => {
  let s = en;
  for (const [rx, [fr, es]] of VOCAB) s = s.replace(rx, i === 0 ? fr : es);
  // Une phrase commence par une majuscule, quelle que soit la traduction du premier mot.
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const L = (en) => ({ en, fr: tr(en, 0), es: tr(en, 1) });

// ── Données de recherche. `locs` : emplacements en anglais, airside d'abord.
//    Chaque entrée porte SA source et SA confiance — elles ne se valent pas.
const DATA = {
  JFK: { post: true, conf: 5, url: "https://maps.jfkairport.com/su/wH7zRGH9",
    note: { en: "Locations from the Port Authority's official terminal maps. The airport blog states nine areas where the map data lists more — follow the on-site signage.", fr: "Emplacements issus des plans officiels de la Port Authority. Le blog de l'aéroport annonce neuf zones là où les données cartographiques en listent davantage — fie-toi à la signalétique sur place." },
    locs: ["Terminal 4, Level 3 Departures, near Gate B31 (airside)", "Terminal 5, Level 3 Departures, near Gate 28 (airside)", "Terminal 5, Rooftop & Wooftop outdoor deck, Level 3 Departures (airside)", "Terminal 7, Level 3 Departures (airside)", "Terminal 8, Level 3 Departures, near Gate 38 (airside)", "Terminal 1, Level 1 Arrivals, curbside (landside)", "Terminal 4, Level 1 Arrivals, curbside (landside)", "Terminal 5, Level 1 Arrivals, curbside (landside)", "Terminal 7, Level 1 Arrivals, curbside (landside)"] },
  LAX: { post: true, conf: 5, url: "https://www.flylax.com/sites/lax/files/documents/LAX%20Pet%20Relief%20Locations.pdf",
    note: { en: "The official per-terminal pages and the downloadable PDF disagree on two gate numbers; the terminal pages are more recent and were used here. No airside area is published for Terminal 8.", fr: "Les pages officielles par terminal et le PDF téléchargeable divergent sur deux numéros de porte ; les pages terminal, plus récentes, ont été retenues. Aucune zone côté piste n'est publiée pour le Terminal 8." },
    locs: ["Terminal 1, Level 3 Departures, near Gate 13 behind California Pizza Kitchen (airside)", "Terminal 2, Level 3 Departures, near Gate 21A (airside)", "Terminal 3, Level 3 Departures, outdoor atrium (airside)", "Terminal 4, Level 3 Departures, near Gate 50B (airside)", "Terminal 5, Level 3 Departures, near Gate 54B (airside)", "Terminal 6, Level 3 Departures, near Gate 62 (airside)", "Terminal 7, Level 3 Departures, near Gate 71A (airside)", "Tom Bradley International Terminal, Level 4 Departures, near the Great Hall (airside)", "Outdoor area between Terminals 1 and 2, Level 1 Baggage Claim (landside)", "Terminal 5, Level 1 Baggage Claim, curbside (landside)"] },
  MIA: { post: true, conf: 5, url: "https://www.miami-airport.com/map-animal-relief-areas.asp",
    note: { en: "The outdoor area by Terminal J is marked temporarily closed for construction. Several third-party sites list Gate G5; the airport's own map says G11.", fr: "La zone extérieure du Terminal J est signalée temporairement fermée pour travaux. Plusieurs sites tiers indiquent la porte G5 ; le plan de l'aéroport dit G11." },
    locs: ["North Terminal D, indoor room near Gate D34 (airside)", "Concourse F, indoor room near Gate F7 (airside)", "Concourse G, indoor room near Gate G11 (airside)", "Concourse H-J Connector, across from the InMotion store (airside)", "Terminal D, Level 1 Arrivals, across from Door 5, west of the Dolphin garage (landside)", "Terminal F, Level 1 Arrivals, across from Door 15 (landside)"] },
  ATL: { post: true, conf: 4, url: "https://www.atl.com/atls-relief-areas-provide-haven-for-service-animals-passenger-pets/",
    note: { en: "From the airport's own article, last updated April 2026. Third-party sites cite C17 and E15 where the airport says C19 and E14.", fr: "D'après l'article de l'aéroport, dernière mise à jour avril 2026. Des sites tiers citent C17 et E15 là où l'aéroport indique C19 et E14." },
    locs: ["Concourse T, near Gate T7 (airside)", "Concourse A, near Gate A10 (airside)", "Concourse B, near Gate B33 (airside)", "Concourse C, near Gate C19 (airside)", "Concourse D, at D Centerpoint (airside)", "Concourse E, near Gate E14 (airside)", "Concourse F International Terminal, near Gate F7 (airside)", "Poochie Park dog park, Domestic Terminal South, outside doors W1 and W2 (landside)", "International Terminal, Arrivals level, outside door A1 (landside)"] },
  EWR: { post: true, conf: 5, url: "https://maps.newarkairport.com/su/7bZ1L87D",
    note: { en: "Locations from the Port Authority's official terminal maps. Terminal B is being modernised — areas may move.", fr: "Emplacements issus des plans officiels de la Port Authority. Le Terminal B est en cours de modernisation — les zones peuvent bouger." },
    locs: ["Terminal B, Level 3 Departures, near Gate B40 (airside)", "Terminal B, Level 3 Departures, near Gate B58 (airside)", "Terminal B, Level 3 Departures, near Gates B66 and B67 (airside)", "Terminal C, Mezzanine level, near Gate C131 (airside)", "Terminal A, Arrivals level, curbside outdoor dog area (landside)", "Terminal B, Level 2 Arrivals, curbside outdoor dog park (landside)"] },
  LGA: { post: true, conf: 5, url: "https://maps.laguardiaairport.com/su/MUnkfIsU",
    note: { en: "Locations from the Port Authority's official terminal maps. Third-party sites cite different gate numbers that the official data does not confirm.", fr: "Emplacements issus des plans officiels de la Port Authority. Des sites tiers citent d'autres numéros de porte que la source officielle ne confirme pas." },
    locs: ["Terminal B, Level 2, near Gate 59 (airside)", "Terminal B, Level 4 Food & Shops, at the Food Court (airside)", "Terminal C, Level 2 Departures, near Gate 61 (airside)", "Terminal C, Level 3, past the security checkpoint (airside)", "Terminal A Marine Air Terminal, Departures level, curbside (landside)", "Terminal C, Level 1 Arrivals, curbside (landside)"] },
  DFW: { post: true, conf: 5, url: "https://www.dfwairport.com/explore/terminals/pettravel/",
    note: { en: "No airside area is published for Terminal C; its landside area is a temporary one in the parking garage near C17 because of construction.", fr: "Aucune zone côté piste n'est publiée pour le Terminal C ; sa zone côté ville est provisoire, dans le parking près de C17, en raison de travaux." },
    locs: ["Terminal A, inside security at A29 (airside)", "Terminal B, inside security at B28 (airside)", "Terminal D, inside security at D18 (airside)", "Terminal E, inside security at E31 (airside)", "Terminal A, outside entry door A8, lower level (landside)", "Terminal D, outside entry doors D15 and D29, lower level (landside)", "Terminal E, outside entry doors E2 and E38, lower level (landside)", "Terminal C, temporary area in the parking garage near C17 (landside)"] },
  DEN: { post: true, conf: 5, url: "https://www.flydenver.com/at-the-airport/services-and-amenities/traveling-with-pets/",
    note: { en: "The visible page text mentions only the three centre cores and Door 200; the full list below comes from the same official page's detail panels.", fr: "Le texte visible de la page ne cite que les trois noyaux centraux et la porte 200 ; la liste ci-dessous provient des panneaux de détail de cette même page officielle." },
    locs: ["Concourse A, Center Core near the mail drop (airside)", "Concourse A, near Gate A17 (airside)", "Concourse A, near Gate A25 (airside)", "Concourse A, Outdoor Deck near A15 (airside)", "Concourse B, Center Core near the mail drop (airside)", "Concourse B, near Gate B16 (airside)", "Concourse B, near Gate B69 (airside)", "Concourse B, Outdoor Deck near B7 (airside)", "Concourse C, Center Core near the mail drop (airside)", "Concourse C, near Gate C53 (airside)", "Concourse C, near Gate C62 (airside)", "Concourse C, Outdoor Deck near C67 (airside)", "Outside Door 200, west side of Jeppesen Terminal, fenced outdoor area (landside)", "Denver Transit Center (landside)"] },
  SEA: { post: true, conf: 5, url: "https://www.portseattle.org/services-amenities/traveling-pets",
    note: { en: "The airport's own FAQ still says three indoor and two outdoor areas — that page is out of date. The list below follows the current official page.", fr: "La FAQ de l'aéroport annonce encore trois zones intérieures et deux extérieures — cette page n'est plus à jour. La liste ci-dessous suit la page officielle actuelle." },
    locs: ["Concourse A, near Gate A10 (airside)", "Concourse D, at the restrooms near D1 (airside)", "Concourse S, at the S underground train station (airside)", "Concourse N, at the N underground train station (airside)", "International Arrivals Facility, Mezzanine level in the customs area (airside, arriving international passengers only)", "Outside Door 33, Departures level, north end (landside)", "Outside Door 26, Arrivals drive, north end (landside)", "Baggage claim level, south end past Carousel 1 (landside)"] },
  IAD: { post: true, conf: 5, url: "https://www.flydulles.com/travel-information/2024-holiday-travel-guide/pet-relief-areas",
    note: { en: "PetFlight lists four airside areas near A16, B51, C7 and D1; the airport publishes only A32 and D1. Construction of the new Concourse E may move things.", fr: "PetFlight annonce quatre zones côté piste près de A16, B51, C7 et D1 ; l'aéroport n'en publie que deux, A32 et D1. Les travaux de la nouvelle jetée E peuvent déplacer ces zones." },
    locs: ["Adjacent to Gate A32, next to the Virgin Atlantic Club (airside)", "Across from Gate D1, near &pizza (airside)", "Departures level, exit Door 16 near the United ticket counter, then right (landside)", "Departures level, exit Door 1 near the Aeromexico ticket counter, then left (landside)", "Arrivals level, exit near Baggage Claim 1, through the tunnel across the parking lot (landside)"] },
  DCA: { post: true, conf: 5, url: "https://www.flyreagan.com/travel-information/services-amenities/pet-relief-areas",
    note: { en: "Older third-party pages still claim all four areas are outdoors before security — that is out of date. The DCA Reimagined works are ongoing.", fr: "D'anciennes pages tierces affirment encore que les quatre zones sont extérieures et avant sûreté — c'est dépassé. Le chantier DCA Reimagined est en cours." },
    locs: ["Terminal 2, near Gates E46 to E59 (airside)", "Terminal 1, near Gates A1 to A9 (airside)", "Terminal 2, north end of National Hall (airside)", "Terminal 2, south end of National Hall (airside)", "Adjacent to the North Metrorail station entrance (landside)", "Adjacent to the South Metrorail station entrance (landside)", "North end of the Gates A1 to A9 terminal roadway curb (landside)"] },
  MSP: { post: true, conf: 5, url: "https://www.mspairport.com/airport/service-amenities/pet-services",
    note: { en: "PetFlight cites Gate F5 and a Gate C13 mezzanine area; the airport says F6 and simply the C/G connector bridge. An escort can be requested from your airline or Travelers Assistance.", fr: "PetFlight cite la porte F5 et une zone en mezzanine près de C13 ; l'aéroport indique F6 et simplement la passerelle C/G. Une escorte peut être demandée à ta compagnie ou au comptoir Travelers Assistance." },
    locs: ["Terminal 1, near the entrance to Concourse E in the Airport Mall (airside)", "Terminal 1, by Gate F6 (airside)", "Terminal 1, on the C/G connector bridge (airside)", "Terminal 2, indoor area near Gate H11 (airside)", "Terminal 1, outside Door 1 on the baggage claim level (landside)", "Terminal 1, outside Door 4 on the baggage claim level (landside)", "Terminal 2, grassy area outside Door 8 on Level 1 (landside)"] },
  DTW: { post: true, conf: 5, url: "https://www.metroairport.com/at-dtw/getting-around/accessibility-additional-assistance/traveling-pets",
    note: { en: "Bags and bins are provided. Ask your airline for an escort if you need to return through security.", fr: "Sacs et bacs sont fournis. Demande une escorte à ta compagnie si tu dois repasser les contrôles." },
    locs: ["McNamara Terminal, adjacent to Gate A34 (airside)", "Evans Terminal, across from Gate D16 (airside)", "McNamara Terminal, outside the international arrivals area, lower level (landside)", "Evans Terminal, Departures level curb, a grassy area at each end (landside)"] },
  PHL: { post: true, conf: 5, url: "https://www.phl.org/at-phl/services-and-amenities/petports",
    note: { en: "The official page's introduction says seven post-security areas while its own list details nine. The list is the reliable part.", fr: "L'introduction de la page officielle annonce sept zones après sûreté alors que sa propre liste en détaille neuf. C'est la liste qui fait foi." },
    locs: ["Terminal A-West, near Gate A16 (airside)", "Terminal A-East, before the A-B connector (airside)", "Terminal B, near the B side of the A-B walkway (airside)", "Terminal C, near the C side of the C-D walkway (airside)", "Terminal D, next to the United Club (airside)", "Terminal D, next to D3 (airside)", "Terminal E, near Gate E1 across from Good 2 Go (airside)", "Terminal F, just beyond the security checkpoint (airside)", "Departing Flights Road, between Terminals A-West and A-East (landside)", "Arriving Flights Road, adjacent to Terminal A-East baggage claim (landside)"] },
  IAH: { post: true, conf: 5, url: "https://www.fly2houston.com/iah/accessibility/travelingwithpets/",
    note: { en: "PetFlight adds a seventh outdoor area near the Terminal A rideshare pickup that the airport does not publish.", fr: "PetFlight ajoute une septième zone extérieure près du point VTC du Terminal A, que l'aéroport ne publie pas." },
    locs: ["Terminal A, near Gate A12 (airside)", "Terminal B, near Gate B1 across from The Fruteria (airside)", "Terminal C, across from Gate C2 (airside)", "Terminal D, across from Gate D12 (airside)", "Terminal E, across from Gate E12 (airside)", "Terminal E, Arrivals Level 1, exit Door E-103 and cross the traffic lanes (landside)"] },
  CLT: { post: true, conf: 5, url: "https://www.cltairport.com/airport-info/accessibility/terminal-amenities/service-animal-relief-areas/",
    note: { en: "An older official social post mentioned only three areas — the current page lists seven.", fr: "Une ancienne publication officielle n'en citait que trois — la page actuelle en liste sept." },
    locs: ["Concourse A connector, between Gates A1-A13 and A21-A29 (airside)", "Concourse E, near Gate E36 (airside)", "Corner of Concourses D and E, across from Checkpoint 3 (airside)", "D/E connector near the exit (airside)", "Baggage claim, curbside (landside)", "Baggage claim, near Carousel 3 (landside)", "Baggage claim, near Carousel 7 (landside)"] },
  PHX: { post: true, conf: 5, url: "https://www.skyharbor.com/at-the-airport/services/animal-relief-areas/",
    note: { en: "Third-party sites still mention a Pet Patch east of Terminal 2; Terminal 2 was demolished in 2020.", fr: "Des sites tiers citent encore un « Pet Patch » à l'est du Terminal 2 ; le Terminal 2 a été démoli en 2020." },
    locs: ["Terminal 3, South Concourse (airside)", "Terminal 3, North Concourse (airside)", "Terminal 4, D1-D8 concourse near the family restroom (airside)", "Terminal 4, D11-D18 concourse near the restrooms (airside)", "Terminal 4, B1-B14 concourse near the restrooms at Gate B2 (airside)", "The Paw Pad, Terminal 3 Level 1, West Plaza (landside)", "The Boneyard, Terminal 4 Level 1, west side outside baggage claim (landside)", "East Economy Park and Bark, near the East Economy garages (landside)"] },
  MCO: { post: true, conf: 4, url: "https://flymco.com/frequently-asked-questions/pets-service-animals/",
    note: { en: "The official page contradicts itself on one gate number (C236 in one list, C238 in another). Follow the airside signage on the airside terminals.", fr: "La page officielle se contredit sur un numéro de porte (C236 dans une liste, C238 dans l'autre). Fie-toi à la signalétique une fois côté piste." },
    locs: ["Gates 1-29, on the wing for Gates 20-29 (airside)", "Gates 30-59, on the wing for Gates 40-49 (airside)", "Gates 70-99, on the wing for Gates 90-99 (airside)", "Gates 100-129, across from Gate 121 (airside)", "Terminal C Level 2, near Gates C236, C241 and C242 (airside)", "Terminal C Level 6, before international baggage claim (airside)", "Terminal A Level 2, east end of the building (landside)", "Terminal B Level 2, west end of the building (landside)", "North Cell Phone Lot, east end (landside)"] },
  SLC: { post: true, conf: 5, url: "https://slcairport.com/airport-services/animal-relief-stations/",
    note: { en: "The official text says two stations inside security then lists three. Older sources describe outdoor areas facing Terminals 1 and 2 — SLC has had a single terminal since 2020.", fr: "Le texte officiel annonce deux stations après sûreté puis en liste trois. D'anciennes sources décrivent des zones extérieures face aux Terminaux 1 et 2 — SLC n'a plus qu'un terminal depuis 2020." },
    locs: ["Concourse A, near Gate A9 (airside)", "Concourse A, near Gate A34 (airside)", "Concourse B, near Gate B20 (airside)", "Outside the terminal, west side, ground level (landside)"] },
  SAN: { post: true, conf: 5, url: "https://www.san.org/services-and-facilities/",
    note: { en: "Specialist sites still describe six outdoor areas and a spot between Gates 46 and 47; the new Terminal 1 has changed the layout.", fr: "Les sites spécialisés décrivent encore six zones extérieures et un emplacement entre les portes 46 et 47 ; le nouveau Terminal 1 a modifié la configuration." },
    locs: ["Terminal 1, across from Gate 117 (airside)", "Terminal 2, near Gate 46 (airside)", "Ground Transportation Plaza at Terminal 1 (landside)", "Ground Transportation Plaza at Terminal 2 West, Level 1 (landside)"] },
  TPA: { post: true, conf: 4, url: "https://www.tampaairport.com/guest-experience/animals-airport",
    note: { en: "The airport says there is one area on the gate level of each airside without naming them; no gate landmark is published. Enclosed, covered, with synthetic grass and a sink.", fr: "L'aéroport indique une zone au niveau des portes de chaque satellite sans les nommer ; aucun repère de porte n'est publié. Espace fermé et couvert, gazon synthétique et point d'eau." },
    locs: ["Satellite piers A, C, E and F, gate level (airside)", "Main Terminal, baggage claim level, four outdoor areas (landside)", "Blue Express arrivals, curbside (landside)"] },
  PDX: { post: true, conf: 5, url: "https://flypdx.com/TravelTips",
    note: { en: "Specialist sites still place the post-security area by the Alaska Lounge on Concourse C — the main terminal reopened in August 2024 and that data is out of date.", fr: "Les sites spécialisés situent encore la zone après sûreté près du salon Alaska, jetée C — le terminal principal a rouvert en août 2024 et cette donnée est périmée." },
    locs: ["Just past the B and C security checkpoint, near Stumptown Coffee (airside)", "Concourse D, across from Gate D5 (airside)", "Outside baggage claim, south end of the terminal, lower level (landside)"] },
  HNL: { post: true, conf: 4, url: "https://airports.hawaii.gov/hnl/flights/traveling-with-pets/",
    note: { en: "Terminal 3 is listed as having a station but with no location published. Terminal 3 is about a kilometre from Terminal 2.", fr: "Le Terminal 3 est cité comme disposant d'une station, sans emplacement publié. Il se trouve à environ un kilomètre du Terminal 2." },
    locs: ["Terminal 1, ground level, C.B. Lansing Garden (airside)", "Terminal 2, ground level, Hawaiian Garden (airside)", "Fenced grassy area between the International and Terminal 2 parking garages, ground level (landside)"] },
  AUS: { post: true, conf: 5, url: "https://www.flyaustin.com/aus-all-accessibility-services",
    note: { en: "Specialist sites add an area at the South Terminal; it is absent from the official page and the South Terminal has closed to commercial flights.", fr: "Les sites spécialisés ajoutent une zone au South Terminal ; elle est absente de la page officielle et le South Terminal a fermé aux vols commerciaux." },
    locs: ["Barbara Jordan Terminal, next to Gate 9 (airside)", "Outside, west side of the terminal, lower level across from baggage claim (landside)", "Outside, east side of the terminal (landside)"] },
  RDU: { post: false, conf: 4, url: "https://www.rdu.com/rdu-faq/pets/",
    note: { en: "RDU publishes no post-security relief area. Plans for concourse areas have been reported but nothing confirms they have opened — do not count on one during a layover.", fr: "RDU ne publie aucune zone après sûreté. Des projets de zones en jetée ont été évoqués, mais rien ne confirme leur ouverture — n'y compte pas en correspondance." },
    locs: ["Terminal 1, outdoors on the baggage claim level, curbside (landside)", "Terminal 2, outdoors on the baggage claim level, curbside (landside)"] },
  BWI: { post: true, conf: 5, url: "https://bwiairport.com/animal-relief-areas/",
    note: { en: "All four areas have seating. The official page also gives walking directions to each.", fr: "Les quatre zones disposent de sièges. La page officielle donne aussi l'itinéraire pour chacune." },
    locs: ["Concourse C entrance, past Checkpoint C (airside)", "Connector between Concourses D and E, past the checkpoint (airside)", "Lower level, outside door 19, near the Light Rail station (landside)", "In front of the Hourly Garage, Level 3 (landside)"] },
  SJU: { post: null, conf: 3, url: "https://aeropuertosju.com/wp-content/uploads/2022/04/Mapa_SJU.pdf",
    note: { en: "The official terminal map marks a relief area on Terminal B's second level only. The map does not make clear whether it sits before or after security — ask on arrival.", fr: "Le plan officiel signale une zone au deuxième niveau du Terminal B uniquement. Le plan ne permet pas de dire si elle est avant ou après les contrôles — renseigne-toi sur place." },
    locs: ["Terminal B, second level, near Gate B2 (side not published)"] },
  LGW: { post: true, conf: 4, url: "https://www.gatwickairport.com/passenger-guides/assisted-travel.html",
    note: { en: "Gatwick confirms a service animal spend area after security, but it is escorted and on request through the Assisted Travel team, reserved for assistance dogs, and its location is published nowhere. There is no self-service relief area.", fr: "Gatwick confirme une zone de soulagement après les contrôles, mais elle est escortée et sur demande auprès de l'équipe Assisted Travel, réservée aux chiens d'assistance, et son emplacement n'est publié nulle part. Il n'existe aucune zone en libre accès." },
    locs: ["Service animal spend area after security, on request from the Assisted Travel team (airside, location not published)"] },
};

// ── Aéroports volontairement NON modifiés, et pourquoi.
const SKIPPED = {
  SFO: "donnée obtenue en contournant un domaine que l'outil de récupération refuse — écartée par principe de méthode, pas par doute sur le fond",
  BOS: "site de Massport inaccessible (blocage WAF) ; aucun emplacement précis publié ailleurs de source fiable",
  LAS: "l'aéroport confirme des zones après sûreté sans publier leur emplacement ; les repères qui circulent viennent de sites hors périmètre",
};

const obj = JSON.parse(readFileSync(OBJ, "utf8"));
const byIata = new Map(obj.airports.filter((a) => a.iata).map((a) => [a.iata, a]));
let done = 0, locs = 0;
const report = [];

for (const [iata, d] of Object.entries(DATA)) {
  const a = byIata.get(iata);
  if (!a) { report.push(`  ?  ${iata} — inconnu du catalogue`); continue; }
  const pr = a.pet_relief ?? (a.pet_relief = {});
  pr.available = "yes";
  if (d.post !== null) pr.post_security = d.post;
  pr.basis = "airport_official";
  pr.locations = d.locs.map(L);
  pr.note = { ...d.note, es: d.note.es ?? undefined };
  pr.source = { url: d.url, source_type: "official_website", verified_date: TODAY,
    review_due: DUE, confidence: d.conf, reviewer: "research", history: pr.source?.history ?? [] };
  done++; locs += d.locs.length;
  report.push(`  ✓  ${iata}  ${String(d.locs.length).padStart(2)} emplacement(s)   confiance ${d.conf}/5`);
}
for (const [iata, why] of Object.entries(SKIPPED)) report.push(`  ·  ${iata}  inchangé — ${why}`);

console.log(report.sort().join("\n"));
console.log("\n" + "─".repeat(60));
console.log(`${done} aéroports enrichis · ${locs} emplacements · ${Object.keys(SKIPPED).length} volontairement inchangés`);
if (dry) { console.log("\n(--dry : rien n'a été écrit)"); process.exit(0); }
writeFileSync(OBJ, JSON.stringify(obj, null, 2) + "\n");
console.log("objects.json mis à jour.");
