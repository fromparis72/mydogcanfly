#!/usr/bin/env node
/* Round-trip: add sourced `exit` blocks for 19 essential non-EU destinations.
   Authorities + procedures confirmed from official government sources (see authorityUrl).
   Titer requirement follows the EU list (Reg. (EU) 2026/131): listed = no titer, non_listed = titer.
   Timing windows only stated where an official source gives them; otherwise phrased generically. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content/countries");

// Reusable pieces for non-listed countries.
const TITER = {
  timing: "longlead",
  text: {
    en: "Anticipate the rabies antibody titer: blood test in an EU-approved lab, at least 30 days after vaccination — a valid result is essential to re-enter the EU and cannot be arranged at the last minute.",
    fr: "Anticipe le titrage antirabique : prise de sang dans un labo agréé UE, au moins 30 jours après la vaccination — un résultat valide est indispensable pour rentrer dans l'UE et ne se règle pas à la dernière minute.",
    es: "Anticipa la titulación antirrábica: análisis de sangre en un laboratorio aprobado por la UE, al menos 30 días tras la vacuna — un resultado válido es imprescindible para volver a la UE y no se puede resolver a última hora.",
  },
};
const ONSITE_TITER = {
  en: "If your dog already had a valid EU rabies titer before leaving, it stays valid for life as long as the rabies vaccination is kept up — check this before you travel.",
  fr: "Si ton chien avait déjà un titrage antirabique UE valide avant de partir, il reste valable à vie tant que la vaccination antirabique est à jour — vérifie-le avant de voyager.",
  es: "Si tu perro ya tenía una titulación antirrábica UE válida antes de salir, sigue siendo válida de por vida mientras la vacuna antirrábica esté al día — compruébalo antes de viajar.",
};

const DATA = {
  // ---------- LISTED (no titer) ----------
  ca: {
    authority: "CFIA",
    url: "https://inspection.canada.ca/en/animal-health/terrestrial-animals/exports/pets/eu-non-commercial",
    intro: {
      en: "Canada is a listed country, so no rabies titer is needed to return — but the EU health certificate signed by your vet must be endorsed by a CFIA official veterinarian before you leave Canada.",
      fr: "Le Canada est un pays listé : pas de titrage pour revenir — mais le certificat sanitaire UE signé par ton vétérinaire doit être endossé par un vétérinaire officiel de la CFIA avant de quitter le Canada.",
      es: "Canadá es un país listado: no hace falta titulación para volver — pero el certificado sanitario UE firmado por tu veterinario debe ser refrendado por un veterinario oficial de la CFIA antes de salir de Canadá.",
    },
    steps: [{ timing: "window", text: {
      en: "A licensed vet completes and signs the EU non-commercial health certificate; book an appointment to have it endorsed by a CFIA Animal Health Office before departure (CFIA cannot endorse once the dog has left).",
      fr: "Un vétérinaire accrédité remplit et signe le certificat sanitaire UE non commercial ; prends rendez-vous pour le faire endosser par un bureau vétérinaire de la CFIA avant le départ (la CFIA ne peut plus l'endosser une fois le chien parti).",
      es: "Un veterinario acreditado rellena y firma el certificado sanitario UE no comercial; pide cita para que lo refrende una oficina veterinaria de la CFIA antes de salir (la CFIA no puede refrendarlo una vez que el perro se ha ido).",
    } }],
    onSiteNote: {
      en: "For Finland, Ireland, Malta or Norway, a tapeworm (Echinococcus) treatment must be given and recorded 24–120 hours before EU entry, before the CFIA endorsement.",
      fr: "Pour la Finlande, l'Irlande, Malte ou la Norvège, un traitement contre le ténia (échinocoque) doit être administré et enregistré 24 à 120 h avant l'entrée dans l'UE, avant l'endossement CFIA.",
      es: "Para Finlandia, Irlanda, Malta o Noruega, debe administrarse y registrarse un tratamiento contra la tenia (equinococo) 24–120 h antes de entrar en la UE, antes del refrendo de la CFIA.",
    },
  },
  ae: {
    authority: "MOCCAE",
    url: "https://www.moccae.gov.ae/en/services/animal-health-certificate-for-export-re-export-of-live-animals",
    intro: {
      en: "The UAE is a listed country, so no rabies titer is needed to return — but you must obtain a MOCCAE export veterinary health certificate for your dog.",
      fr: "Les Émirats sont un pays listé : pas de titrage pour revenir — mais tu dois obtenir un certificat sanitaire vétérinaire d'export MOCCAE pour ton chien.",
      es: "Los EAU son un país listado: no hace falta titulación para volver — pero debes obtener un certificado sanitario veterinario de exportación de MOCCAE para tu perro.",
    },
    steps: [{ timing: "window", text: {
      en: "Apply through the MOCCAE digital portal for the export/re-export veterinary health certificate; it is issued after examination of the dog and is valid 30 days from issue (processing about 1 working day).",
      fr: "Fais la demande sur le portail numérique MOCCAE pour le certificat vétérinaire d'export/ré-export ; il est délivré après examen du chien et valable 30 jours (traitement en ~1 jour ouvré).",
      es: "Solicita en el portal digital de MOCCAE el certificado veterinario de exportación/reexportación; se emite tras el examen del perro y es válido 30 días (tramitación ~1 día hábil).",
    } }],
    onSiteNote: {
      en: "Arrange the MOCCAE certificate close to departure so it is still valid on arrival; the separate EU health certificate is completed by your vet.",
      fr: "Organise le certificat MOCCAE peu avant le départ pour qu'il soit encore valide à l'arrivée ; le certificat sanitaire UE distinct est rempli par ton vétérinaire.",
      es: "Gestiona el certificado MOCCAE cerca de la salida para que siga siendo válido a la llegada; el certificado sanitario UE aparte lo rellena tu veterinario.",
    },
  },
  mu: {
    authority: "DVS",
    url: "https://sps.govmu.org/lvd-exports/",
    intro: {
      en: "Mauritius is a listed country, so no rabies titer is needed to return — but the Division of Veterinary Services (DVS) is the competent authority that certifies your dog for export to the EU.",
      fr: "Maurice est un pays listé : pas de titrage pour revenir — mais la Division des services vétérinaires (DVS) est l'autorité compétente qui certifie ton chien pour l'export vers l'UE.",
      es: "Mauricio es un país listado: no hace falta titulación para volver — pero la División de Servicios Veterinarios (DVS) es la autoridad competente que certifica a tu perro para la exportación a la UE.",
    },
    steps: [{ timing: "window", text: {
      en: "The DVS issues the international veterinary certificate after inspection of the dog and health control; request it before departure so it meets the EU entry conditions.",
      fr: "La DVS délivre le certificat vétérinaire international après inspection du chien et contrôle sanitaire ; demande-le avant le départ pour qu'il respecte les conditions d'entrée UE.",
      es: "La DVS emite el certificado veterinario internacional tras la inspección del perro y el control sanitario; solicítalo antes de salir para que cumpla las condiciones de entrada en la UE.",
    } }],
    onSiteNote: {
      en: "The DVS is Mauritius's competent authority for certifying animals bound for the EU — go through it, not just a private vet.",
      fr: "La DVS est l'autorité compétente mauricienne pour certifier les animaux à destination de l'UE — passe par elle, pas seulement par un vétérinaire privé.",
      es: "La DVS es la autoridad competente de Mauricio para certificar animales con destino a la UE — pasa por ella, no solo por un veterinario privado.",
    },
  },
  ar: {
    authority: "SENASA",
    url: "https://www.argentina.gob.ar/senasa/informacion-al-viajero/viajar-al-exterior/envios-al-exterior-perros-yo-gatos/requisitos-particulares-por-destino/union-europea",
    intro: {
      en: "Argentina is a listed country, so no rabies titer is needed to return — SENASA issues the international veterinary certificate (CVI) for your dog.",
      fr: "L'Argentine est un pays listé : pas de titrage pour revenir — le SENASA délivre le certificat vétérinaire international (CVI) pour ton chien.",
      es: "Argentina es un país listado: no hace falta titulación para volver — el SENASA emite el certificado veterinario internacional (CVI) para tu perro.",
    },
    steps: [{ timing: "window", text: {
      en: "A private vet handles the microchip, rabies vaccination and health certificate; present them at a SENASA office, which issues the CVI, valid 10 days up to the EU border check.",
      fr: "Un vétérinaire privé s'occupe de la puce, de la vaccination antirabique et du certificat sanitaire ; présente-les à un bureau SENASA, qui délivre le CVI, valable 10 jours jusqu'au contrôle à la frontière UE.",
      es: "Un veterinario privado se ocupa del microchip, la vacuna antirrábica y el certificado sanitario; preséntalos en una oficina del SENASA, que emite el CVI, válido 10 días hasta el control fronterizo de la UE.",
    } }],
    onSiteNote: {
      en: "The rabies vaccination must be at least 21 days old before EU arrival; time the SENASA CVI within its 10-day window.",
      fr: "La vaccination antirabique doit dater d'au moins 21 jours avant l'arrivée dans l'UE ; cale le CVI SENASA dans sa fenêtre de 10 jours.",
      es: "La vacuna antirrábica debe tener al menos 21 días antes de llegar a la UE; programa el CVI del SENASA dentro de su ventana de 10 días.",
    },
  },
  cl: {
    authority: "SAG",
    url: "https://www.sag.gob.cl/tramites/solicitud-de-certificado-zoosanitario-de-exportacion-para-salir-de-chile-con-perros-y-gatos",
    intro: {
      en: "Chile is a listed country, so no rabies titer is needed to return — SAG issues the export zoosanitary certificate (CZE) for your dog.",
      fr: "Le Chili est un pays listé : pas de titrage pour revenir — le SAG délivre le certificat zoosanitaire d'export (CZE) pour ton chien.",
      es: "Chile es un país listado: no hace falta titulación para volver — el SAG emite el certificado zoosanitario de exportación (CZE) para tu perro.",
    },
    steps: [{ timing: "window", text: {
      en: "Apply on the SAG website with a private vet's health certificate (max 10 days old) plus vaccination records; SAG advises applying about 10 days ahead and processes it in roughly 3 business days.",
      fr: "Fais la demande sur le site du SAG avec le certificat sanitaire d'un vétérinaire privé (10 jours max) et les preuves de vaccination ; le SAG conseille de s'y prendre ~10 jours avant, traitement en ~3 jours ouvrés.",
      es: "Solicítalo en la web del SAG con el certificado sanitario de un veterinario privado (máx. 10 días) y los registros de vacunación; el SAG recomienda hacerlo ~10 días antes y lo tramita en ~3 días hábiles.",
    } }],
    onSiteNote: {
      en: "If your dog entered Chile on an EU pet passport, it can return to the EU on that passport without a CZE.",
      fr: "Si ton chien est entré au Chili avec un passeport européen, il peut rentrer dans l'UE avec ce passeport, sans CZE.",
      es: "Si tu perro entró en Chile con un pasaporte europeo, puede volver a la UE con ese pasaporte, sin CZE.",
    },
  },
  sg: {
    authority: "AVS (NParks)",
    url: "https://avs.nparks.gov.sg/pets/importing-exporting-a-pet/export/dogs-and-cats/",
    intro: {
      en: "Singapore is a listed country, so no rabies titer is needed to return — but AVS (NParks) must endorse the EU health certificate and issue an export licence.",
      fr: "Singapour est un pays listé : pas de titrage pour revenir — mais l'AVS (NParks) doit endosser le certificat sanitaire UE et délivrer une licence d'export.",
      es: "Singapur es un país listado: no hace falta titulación para volver — pero AVS (NParks) debe refrendar el certificado sanitario UE y emitir una licencia de exportación.",
    },
    steps: [
      { timing: "longlead", text: {
        en: "Obtain the AVS export licence via the GoBusiness Licensing Portal (valid 90 days), and request the pre-export inspection at least 5 days before departure.",
        fr: "Obtiens la licence d'export AVS via le portail GoBusiness Licensing (valable 90 jours), et demande l'inspection pré-export au moins 5 jours avant le départ.",
        es: "Obtén la licencia de exportación de AVS a través del GoBusiness Licensing Portal (válida 90 días) y solicita la inspección previa a la exportación al menos 5 días antes de salir.",
      } },
      { timing: "window", text: {
        en: "A licensed vet completes the EU health certificate; AVS then endorses it (allow about 2 working days — no express service for endorsement).",
        fr: "Un vétérinaire agréé remplit le certificat sanitaire UE ; l'AVS l'endosse ensuite (compte ~2 jours ouvrés — pas de service express pour l'endossement).",
        es: "Un veterinario autorizado rellena el certificado sanitario UE; luego AVS lo refrenda (calcula ~2 días hábiles — sin servicio exprés para el refrendo).",
      } },
    ],
    onSiteNote: {
      en: "Plan the licence and endorsement together — neither is instant, and the endorsement has no express option.",
      fr: "Planifie la licence et l'endossement ensemble — aucun n'est instantané, et l'endossement n'a pas d'option express.",
      es: "Planifica la licencia y el refrendo juntos — ninguno es inmediato, y el refrendo no tiene opción exprés.",
    },
  },

  // ---------- NON-LISTED (titer required) ----------
  tn: {
    authority: "DGSV",
    url: "https://www.douane.gov.tn/animaux-de-compagnie/",
    intro: {
      en: "Tunisia is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an official export health certificate endorsed by a government veterinarian.",
      fr: "La Tunisie est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire d'export officiel visé par un vétérinaire officiel.",
      es: "Túnez no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario de exportación visado por un veterinario oficial.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "An international health certificate is drawn up by a practising vet and must be endorsed by an official government veterinarian shortly before the flight.",
      fr: "Un certificat sanitaire international est établi par un vétérinaire sanitaire et doit être visé par un vétérinaire officiel peu avant le vol.",
      es: "Un certificado sanitario internacional lo redacta un veterinario sanitario y debe ser visado por un veterinario oficial poco antes del vuelo.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  dz: {
    authority: "DSV",
    url: "https://psl.madr.gov.dz/dsv/",
    intro: {
      en: "Algeria is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a sanitary export clearance from the veterinary services (DSV).",
      fr: "L'Algérie est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus une dérogation sanitaire d'export des services vétérinaires (DSV).",
      es: "Argelia no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más una autorización sanitaria de exportación de los servicios veterinarios (DSV).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Obtain the sanitary export clearance and the official veterinary visa via the DSV platform; the health certificate is issued by a vet and endorsed by the official veterinary services.",
      fr: "Obtiens la dérogation sanitaire d'export et le visa vétérinaire officiel via la plateforme DSV ; le certificat sanitaire est établi par un vétérinaire et visé par les services vétérinaires officiels.",
      es: "Obtén la autorización sanitaria de exportación y el visado veterinario oficial a través de la plataforma DSV; el certificado sanitario lo emite un veterinario y lo refrenda el servicio veterinario oficial.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  sn: {
    authority: "DSV",
    url: "https://elevage.sec.gouv.sn/",
    intro: {
      en: "Senegal is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an export authorization from the Veterinary Services (DSV).",
      fr: "Le Sénégal est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus une autorisation d'export des Services vétérinaires (DSV).",
      es: "Senegal no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más una autorización de exportación de los Servicios Veterinarios (DSV).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Request the export authorization from the Director of Veterinary Services; an international zoosanitary certificate is then issued and certified by an official veterinarian, with veterinary inspection for pets flying out.",
      fr: "Demande l'autorisation d'export au Directeur des Services vétérinaires ; un certificat zoosanitaire international est ensuite délivré et certifié par un vétérinaire officiel, avec inspection vétérinaire pour les animaux qui prennent l'avion.",
      es: "Solicita la autorización de exportación al Director de los Servicios Veterinarios; después se emite y certifica un certificado zoosanitario internacional por un veterinario oficial, con inspección veterinaria para las mascotas que vuelan.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  ci: {
    authority: "DSV (MIRAH)",
    url: "https://ressourcesanimales.gouv.ci/direction/direction-des-services-veterinaires-dsv/",
    intro: {
      en: "Côte d'Ivoire is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a health certificate validated by the Veterinary Services (DSV).",
      fr: "La Côte d'Ivoire est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire validé par les Services vétérinaires (DSV).",
      es: "Costa de Marfil no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario validado por los Servicios Veterinarios (DSV).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Request the health certificate from an authorized vet a few days before departure (in French or with an official translation); it is validated within the DSV/MIRAH framework, which runs border sanitary control.",
      fr: "Demande le certificat sanitaire à un vétérinaire autorisé quelques jours avant le départ (en français ou avec traduction officielle) ; il est validé dans le cadre DSV/MIRAH, qui assure le contrôle sanitaire aux frontières.",
      es: "Solicita el certificado sanitario a un veterinario autorizado unos días antes de salir (en francés o con traducción oficial); se valida en el marco DSV/MIRAH, que ejerce el control sanitario fronterizo.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  br: {
    authority: "VIGIAGRO (MAPA)",
    url: "https://www.gov.br/agricultura/pt-br/assuntos/vigilancia-agropecuaria/animais-estimacao/sair-do-brasil",
    intro: {
      en: "Brazil is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an international veterinary certificate (CVI) issued by VIGIAGRO/MAPA.",
      fr: "Le Brésil est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat vétérinaire international (CVI) délivré par VIGIAGRO/MAPA.",
      es: "Brasil no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado veterinario internacional (CVI) emitido por VIGIAGRO/MAPA.",
    },
    steps: [
      { timing: "longlead", text: {
        en: "Anticipate the rabies antibody titer well ahead: blood test in an EU-approved lab at least 30 days after vaccination — MAPA notes the full EU process can take 3 to 6 months.",
        fr: "Anticipe largement le titrage antirabique : prise de sang dans un labo agréé UE au moins 30 jours après la vaccination — le MAPA indique que le processus UE complet peut prendre 3 à 6 mois.",
        es: "Anticipa ampliamente la titulación antirrábica: análisis de sangre en un laboratorio aprobado por la UE al menos 30 días tras la vacuna — el MAPA indica que el proceso completo de la UE puede tardar de 3 a 6 meses.",
      } },
      { timing: "window", text: {
        en: "Submit the online request on gov.br with your vet's health certificate and records; a federal agricultural auditor reviews it (up to 48h) and issues the digitally signed CVI, free of charge.",
        fr: "Dépose la demande en ligne sur gov.br avec le certificat sanitaire et les documents de ton vétérinaire ; un auditeur fédéral agricole l'examine (jusqu'à 48 h) et délivre le CVI signé numériquement, gratuitement.",
        es: "Presenta la solicitud en línea en gov.br con el certificado sanitario y los documentos de tu veterinario; un auditor fiscal federal agropecuario lo revisa (hasta 48 h) y emite el CVI firmado digitalmente, de forma gratuita.",
      } },
    ],
    onSiteNote: ONSITE_TITER,
  },
  co: {
    authority: "ICA",
    url: "https://www.ica.gov.co/importacion-y-exportacion/otros-procedimientos/requisitos-para-importar-mascotas/salida-de-perros-y-gatos-desde-colombia",
    intro: {
      en: "Colombia is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a sanitary inspection certificate (CIS) issued by ICA at the airport.",
      fr: "La Colombie est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat d'inspection sanitaire (CIS) délivré par l'ICA à l'aéroport.",
      es: "Colombia no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado de inspección sanitaria (CIS) emitido por el ICA en el aeropuerto.",
    },
    steps: [
      { timing: "longlead", text: {
        en: "Plan the rabies titer early: per ICA, the blood sample must be taken at least 1 month after vaccination and 3 months before travel (minimum age about 7 months).",
        fr: "Planifie le titrage tôt : selon l'ICA, la prise de sang doit être faite au moins 1 mois après la vaccination et 3 mois avant le voyage (âge minimum ~7 mois).",
        es: "Planifica pronto la titulación: según el ICA, la muestra de sangre debe tomarse al menos 1 mes tras la vacuna y 3 meses antes del viaje (edad mínima ~7 meses).",
      } },
      { timing: "window", text: {
        en: "Register and request the ICA inspection up to 3 days before travel; an inspection is done about 24h before departure at the ICA airport office, then the CIS is issued.",
        fr: "Inscris-toi et demande l'inspection ICA jusqu'à 3 jours avant le voyage ; une inspection est réalisée ~24 h avant le départ au bureau ICA de l'aéroport, puis le CIS est délivré.",
        es: "Regístrate y solicita la inspección del ICA hasta 3 días antes del viaje; se realiza una inspección ~24 h antes de la salida en la oficina del ICA en el aeropuerto y luego se emite el CIS.",
      } },
    ],
    onSiteNote: ONSITE_TITER,
  },
  pe: {
    authority: "SENASA",
    url: "https://www.senasa.gob.pe/senasacontigo/senasa-viajas-con-tu-mascota-conoce-cuales-son-los-requisitos-sanitarios-para-ingresar-o-salir-de-peru/",
    intro: {
      en: "Peru is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an export sanitary certificate from SENASA.",
      fr: "Le Pérou est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire d'export du SENASA.",
      es: "Perú no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario de exportación del SENASA.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Request the SENASA export certificate at least 72 hours before travel, with the destination's requirements, a current health certificate and vaccination record; SENASA inspects the dog before certifying.",
      fr: "Demande le certificat d'export SENASA au moins 72 h avant le voyage, avec les exigences de destination, un certificat sanitaire à jour et le carnet de vaccination ; le SENASA examine le chien avant de certifier.",
      es: "Solicita el certificado de exportación del SENASA al menos 72 horas antes del viaje, con los requisitos del destino, un certificado sanitario vigente y el registro de vacunación; el SENASA inspecciona al perro antes de certificar.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  do: {
    authority: "DIGEGA",
    url: "https://www.ganaderia.gob.do/index.php/servicios/item/539-autorizacion-para-la-exportacion-de-animales-productos-y-subproductos-de-origen-animal",
    intro: {
      en: "The Dominican Republic is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a health certificate validated by DIGEGA.",
      fr: "La République dominicaine est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire validé par la DIGEGA.",
      es: "República Dominicana no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario validado por la DIGEGA.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "A private vet does the pre-export check and completes the EU non-commercial certificate; it is signed by the veterinary college (COLVET) where required, then submitted to DIGEGA for validation and official signature.",
      fr: "Un vétérinaire privé réalise le contrôle pré-export et remplit le certificat UE non commercial ; il est signé par l'ordre vétérinaire (COLVET) si nécessaire, puis soumis à la DIGEGA pour validation et signature officielle.",
      es: "Un veterinario privado hace el control previo a la exportación y rellena el certificado UE no comercial; lo firma el colegio veterinario (COLVET) cuando corresponde y luego se presenta a la DIGEGA para su validación y firma oficial.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  tr: {
    authority: "Tarım ve Orman Bakanlığı",
    url: "https://www.tarimorman.gov.tr",
    intro: {
      en: "Turkey is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a government-issued veterinary health certificate.",
      fr: "La Turquie est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire vétérinaire délivré par l'administration.",
      es: "Turquía no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario veterinario emitido por la administración.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Since 2024 the export health certificate is issued by the District Agriculture and Forestry Directorate of your place of residence (a government vet, not a private one) — apply in person with the dog and documents.",
      fr: "Depuis 2024, le certificat sanitaire d'export est délivré par la Direction de district de l'Agriculture et des Forêts de ton lieu de résidence (un vétérinaire officiel, pas privé) — présente-toi en personne avec le chien et les documents.",
      es: "Desde 2024 el certificado sanitario de exportación lo emite la Dirección de Distrito de Agricultura y Bosques de tu lugar de residencia (un veterinario oficial, no privado) — preséntate en persona con el perro y los documentos.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  in: {
    authority: "AQCS",
    url: "https://aqcsindia.gov.in/Home/ExportPets",
    intro: {
      en: "India is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an AQCS export certificate.",
      fr: "L'Inde est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat d'export AQCS.",
      es: "India no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado de exportación de AQCS.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Get a fit-to-fly certificate from a registered vet, then submit the dog and documents to the AQCS quarantine office 7 days before departure (by appointment); the AQCS export certificate is valid 10 days from issue.",
      fr: "Obtiens un certificat d'aptitude au vol d'un vétérinaire enregistré, puis présente le chien et les documents au bureau de quarantaine AQCS 7 jours avant le départ (sur rendez-vous) ; le certificat d'export AQCS est valable 10 jours.",
      es: "Consigue un certificado de aptitud para volar de un veterinario registrado y luego presenta al perro y los documentos en la oficina de cuarentena de AQCS 7 días antes de salir (con cita); el certificado de exportación de AQCS es válido 10 días.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  cn: {
    authority: "GACC",
    url: "http://english.customs.gov.cn",
    intro: {
      en: "China is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an exit quarantine certificate from Customs (GACC).",
      fr: "La Chine est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat de quarantaine de sortie délivré par les douanes (GACC).",
      es: "China no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado de cuarentena de salida emitido por la Aduana (GACC).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "GACC (Customs) at the exit port carries out the quarantine inspection and issues the exit health certificate; the dog must be microchipped and rabies-vaccinated between 30 days and 12 months before travel.",
      fr: "La GACC (douanes) au point de sortie réalise l'inspection de quarantaine et délivre le certificat sanitaire de sortie ; le chien doit être pucé et vacciné contre la rage entre 30 jours et 12 mois avant le voyage.",
      es: "La GACC (Aduana) en el puerto de salida realiza la inspección de cuarentena y emite el certificado sanitario de salida; el perro debe estar microchipado y vacunado contra la rabia entre 30 días y 12 meses antes del viaje.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  il: {
    authority: "IVSAH (MOAG)",
    url: "https://www.gov.il/en/departments/ministry_of_agriculture",
    intro: {
      en: "Israel is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an export certificate approved by a government veterinarian.",
      fr: "Israël est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat d'export approuvé par un vétérinaire officiel.",
      es: "Israel no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado de exportación aprobado por un veterinario oficial.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "The export health certificate must be signed and approved by a government veterinarian of the MOAG Veterinary Services (a private-vet certificate alone is not valid), issued at the regional veterinary offices.",
      fr: "Le certificat sanitaire d'export doit être signé et approuvé par un vétérinaire officiel des Services vétérinaires du MOAG (un certificat de vétérinaire privé seul ne suffit pas), délivré dans les bureaux vétérinaires régionaux.",
      es: "El certificado sanitario de exportación debe ser firmado y aprobado por un veterinario oficial de los Servicios Veterinarios del MOAG (un certificado de veterinario privado por sí solo no es válido), emitido en las oficinas veterinarias regionales.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  za: {
    authority: "DALRRD",
    url: "https://www.dalrrd.gov.za",
    intro: {
      en: "South Africa is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an export permit and a State Veterinarian's endorsement.",
      fr: "L'Afrique du Sud est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un permis d'export et l'endossement d'un vétérinaire d'État.",
      es: "Sudáfrica no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un permiso de exportación y el refrendo de un veterinario estatal.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Apply to DALRRD for the export permit; a State Veterinarian endorses the health certificate confirming the dog is fit to travel and meets the EU conditions.",
      fr: "Demande à la DALRRD le permis d'export ; un vétérinaire d'État endosse le certificat sanitaire attestant que le chien est apte au voyage et conforme aux conditions UE.",
      es: "Solicita a DALRRD el permiso de exportación; un veterinario estatal refrenda el certificado sanitario confirmando que el perro está apto para viajar y cumple las condiciones de la UE.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
};

const q = (s) => '"' + s + '"';
const lt = (o, ind) => Object.entries(o).map(([k, v]) => `${ind}${k}: ${q(v)}`).join("\n");
function buildExit(d) {
  let y = "exit:\n";
  y += `  authority: ${d.authority}\n`;
  y += `  authorityUrl: ${d.url}\n`;
  y += "  intro:\n" + lt(d.intro, "    ") + "\n";
  y += "  steps:\n";
  for (const s of d.steps) {
    y += `    - timing: ${s.timing}\n`;
    y += "      text:\n" + lt(s.text, "        ") + "\n";
  }
  y += "  onSiteNote:\n" + lt(d.onSiteNote, "    ") + "\n";
  return y;
}

let done = 0;
for (const [iso, d] of Object.entries(DATA)) {
  const file = resolve(DIR, iso + ".yml");
  const t = readFileSync(file, "utf8");
  if (/^exit:/m.test(t)) { console.log(`skip ${iso} (déjà exit)`); continue; }
  const m = t.match(/^(regime: \w+)\n\nhero:/m);
  if (!m) { console.log(`!! ${iso}: motif regime/hero introuvable`); continue; }
  const block = buildExit(d);
  const replaced = t.replace(m[0], `${m[1]}\n${block}\nhero:`);
  writeFileSync(file, replaced);
  done++;
}
console.log(`\nBlocs exit ajoutés : ${done}`);
