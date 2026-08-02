#!/usr/bin/env node
/* Domestic-travel blocks for the 29 non-EU/non-US countries that have >= 2 airports.
   Sourced from national authorities. Three families:
     A. a real legal requirement for a domestic flight (BR, CO, CN, IN, ID, PH, VN, TR, TW, MY)
     B. a standing ownership duty (rabies/ID) that is not travel-specific (ZA, DZ, EG, GE, KE)
     C. nothing imposed by the State — what you are asked for is carrier policy (the rest)
   Internal sanitary borders and outright bans are carried in `territories`. Anything not confirmable
   from an official source is stated as unknown rather than invented. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content/countries");

// Reusable closing point: the airline's own conditions are contractual, not law.
const CARRIER = {
  en: "Whatever the airline asks for (health certificate, vaccination record, breed or crate rules) is its own commercial policy, not a legal requirement — check with your carrier.",
  fr: "Ce que la compagnie demande (certificat de santé, carnet de vaccination, règles de race ou de caisse) relève de sa politique commerciale, pas d'une obligation légale — vérifie auprès d'elle.",
  es: "Lo que pida la aerolínea (certificado de salud, cartilla de vacunación, reglas de raza o jaula) es su política comercial, no una obligación legal — consúltalo con ella.",
};
const NO_STATE_RULE = {
  en: "No document is required by the State for a domestic flight.",
  fr: "Aucun document n'est exigé par l'État pour un vol intérieur.",
  es: "El Estado no exige ningún documento para un vuelo nacional.",
};

const T = (en, fr, es) => ({ en, fr, es });
const terr = (nameEn, nameFr, nameEs, en, fr, es, url) => ({ name: T(nameEn, nameFr, nameEs), note: T(en, fr, es), url });

const D = {
  // ---------- A. Real legal requirement on a domestic flight ----------
  br: {
    intro: T("Domestic flight in Brazil: no import formality, but the State does require a transit certificate.",
      "Vol intérieur au Brésil : aucune formalité d'import, mais l'État exige bien un certificat de transit.",
      "Vuelo nacional en Brasil: ningún trámite de importación, pero el Estado sí exige un certificado de tránsito."),
    points: [
      T("An Atestado Sanitário for the domestic transit of dogs and cats, issued by a CRMV-registered vet and valid 10 days, must accompany the animal.",
        "Un Atestado Sanitário pour le transit national des chiens et chats, établi par un vétérinaire inscrit au CRMV et valable 10 jours, doit accompagner l'animal.",
        "Un Atestado Sanitário para el tránsito nacional de perros y gatos, emitido por un veterinario inscrito en el CRMV y válido 10 días, debe acompañar al animal."),
      T("Rabies vaccination is required for dogs over 90 days, valid one year. The livestock GTA does not apply to dogs and cats.",
        "La vaccination antirabique est exigée pour les chiens de plus de 90 jours, valable un an. La GTA du bétail ne s'applique pas aux chiens et chats.",
        "La vacuna antirrábica es obligatoria para perros de más de 90 días, válida un año. La GTA del ganado no se aplica a perros y gatos."),
      CARRIER,
    ],
    territories: [terr("Fernando de Noronha", "Fernando de Noronha", "Fernando de Noronha",
      "Dogs and cats are banned from the island whatever their origin, with narrow exceptions for assistance and police dogs and for residents. The airline itself is fined for carrying a non-compliant animal.",
      "Les chiens et chats sont interdits sur l'île quelle que soit leur origine, avec de rares exceptions pour les chiens d'assistance, de police et ceux des résidents. La compagnie elle-même est sanctionnée si elle embarque un animal non conforme.",
      "Los perros y gatos están prohibidos en la isla sea cual sea su origen, con escasas excepciones para perros de asistencia, de policía y de residentes. La propia aerolínea es multada si embarca un animal no conforme.",
      "https://www.noronha.pe.gov.br/saude/vigilancia-em-saude/vigilancia-animal/")],
  },
  co: {
    intro: T("Domestic flight in Colombia: no import formality, but aviation rules require a vaccination record.",
      "Vol intérieur en Colombie : aucune formalité d'import, mais la réglementation aérienne impose un carnet de vaccination.",
      "Vuelo nacional en Colombia: ningún trámite de importación, pero la normativa aérea exige una cartilla de vacunación."),
    points: [
      T("Aviation regulation RAC 3 requires a vaccination card or certificate signed by a vet, with their professional registration number.",
        "Le règlement aérien RAC 3 impose un carnet ou certificat de vaccination signé par un vétérinaire, avec son numéro d'inscription professionnelle.",
        "El reglamento aéreo RAC 3 exige un carné o certificado de vacunación firmado por un veterinario, con su número de matrícula profesional."),
      T("ICA states explicitly that its CIS sanitary inspection certificate is NOT required to move dogs and cats within the country.",
        "L'ICA précise explicitement que son certificat d'inspection sanitaire (CIS) n'est PAS requis pour déplacer chiens et chats à l'intérieur du pays.",
        "El ICA precisa explícitamente que su certificado de inspección sanitaria (CIS) NO se requiere para mover perros y gatos dentro del país."),
      CARRIER,
    ],
  },
  cn: {
    intro: T("Domestic flight in China: this is the strictest domestic regime of all — a per-animal quarantine certificate is mandatory by law.",
      "Vol intérieur en Chine : c'est le régime domestique le plus strict qui soit — un certificat de quarantaine par animal est obligatoire par la loi.",
      "Vuelo nacional en China: es el régimen nacional más estricto — un certificado de cuarentena por animal es obligatorio por ley."),
    points: [
      T("The Animal Epidemic Prevention Law requires a quarantine certificate for every animal moved by air; without it the carrier may not accept the dog.",
        "La loi sur la prévention des épizooties impose un certificat de quarantaine pour chaque animal transporté par avion ; sans lui, la compagnie n'a pas le droit d'accepter le chien.",
        "La ley de prevención de epizootias exige un certificado de cuarentena por cada animal transportado en avión; sin él, la aerolínea no puede aceptar al perro."),
      T("The national protocol requires a valid rabies vaccination AND a passing rabies antibody titre test. Several provinces add their own conditions.",
        "Le protocole national exige une vaccination antirabique valide ET un titrage des anticorps antirabiques satisfaisant. Plusieurs provinces ajoutent leurs propres conditions.",
        "El protocolo nacional exige una vacuna antirrábica válida Y una titulación de anticuerpos antirrábicos satisfactoria. Varias provincias añaden sus propias condiciones."),
      T("Most Chinese carriers take pets in the hold or as cargo only, not in the cabin.",
        "La plupart des compagnies chinoises n'acceptent les animaux qu'en soute ou en fret, pas en cabine.",
        "La mayoría de aerolíneas chinas solo aceptan mascotas en bodega o carga, no en cabina."),
    ],
  },
  in: {
    intro: T("Domestic flight in India: no import formality, but a veterinary health certificate is legally required.",
      "Vol intérieur en Inde : aucune formalité d'import, mais un certificat sanitaire vétérinaire est légalement exigé.",
      "Vuelo nacional en India: ningún trámite de importación, pero se exige legalmente un certificado sanitario veterinario."),
    points: [
      T("The Transport of Animals Rules 1978 require a health certificate from a qualified vet, certifying the dog is fit to travel and free of infectious disease including rabies; the animal must be examined within 12 hours of departure.",
        "Les Transport of Animals Rules de 1978 imposent un certificat de santé d'un vétérinaire qualifié, attestant que le chien est apte au voyage et indemne de maladie contagieuse dont la rage ; l'animal doit être examiné dans les 12 heures précédant le départ.",
        "Las Transport of Animals Rules de 1978 exigen un certificado de salud de un veterinario cualificado, que acredite que el perro está apto para viajar y libre de enfermedad contagiosa incluida la rabia; debe examinarse en las 12 horas previas a la salida."),
      T("Without that certificate the carrier must refuse the animal. Cabin, hold and breed conditions are then set by each airline.",
        "Sans ce certificat, la compagnie doit refuser l'animal. Les conditions de cabine, de soute et de race sont ensuite propres à chaque compagnie.",
        "Sin ese certificado, la aerolínea debe rechazar al animal. Las condiciones de cabina, bodega y raza las fija luego cada aerolínea."),
    ],
  },
  id: {
    intro: T("Domestic flight in Indonesia: islands are separate sanitary zones — quarantine clearance is required at both ends.",
      "Vol intérieur en Indonésie : les îles constituent des zones sanitaires distinctes — un passage en quarantaine est exigé au départ comme à l'arrivée.",
      "Vuelo nacional en Indonesia: las islas son zonas sanitarias distintas — se exige control de cuarentena tanto a la salida como a la llegada."),
    points: [
      T("The quarantine law requires a health certificate, use of designated exit and entry points, and reporting the animal to quarantine on departure AND on arrival.",
        "La loi de quarantaine impose un certificat sanitaire, l'usage de points de sortie et d'entrée désignés, et la présentation de l'animal à la quarantaine au départ ET à l'arrivée.",
        "La ley de cuarentena exige un certificado sanitario, el uso de puntos de salida y entrada designados, y presentar al animal en cuarentena a la salida Y a la llegada."),
      T("Rabies vaccination is required, and a protective antibody titre is asked for inter-island movement. Districts are classified rabies-free or infected, and the list is revised annually.",
        "La vaccination antirabique est exigée, et un titrage d'anticorps protecteur est demandé pour les mouvements entre îles. Les districts sont classés indemnes ou infectés, et la liste est révisée chaque année.",
        "Se exige vacuna antirrábica, y se pide una titulación de anticuerpos protectora para el movimiento entre islas. Los distritos se clasifican como libres o infectados, y la lista se revisa anualmente."),
      CARRIER,
    ],
    territories: [terr("Bali", "Bali", "Bali",
      "Bali is classified rabies-infected and the movement of dogs, cats and monkeys is prohibited both INTO and OUT OF the province. Some carriers also exclude Denpasar from pet carriage.",
      "Bali est classée infectée par la rage et le mouvement des chiens, chats et singes y est interdit dans les deux sens, à l'entrée comme à la sortie. Certaines compagnies excluent aussi Denpasar du transport d'animaux.",
      "Bali está clasificada como infectada de rabia y el movimiento de perros, gatos y monos está prohibido en ambos sentidos, tanto de entrada como de salida. Algunas aerolíneas también excluyen Denpasar del transporte de mascotas.",
      "https://distanpangan.baliprov.go.id/wp-content/uploads/2025/10/Pergub-No.-88-Th-2008-Penutupan-Sementara-HPR.pdf")],
  },
  ph: {
    intro: T("Domestic flight in the Philippines: every inter-island move of a pet needs a national shipping permit.",
      "Vol intérieur aux Philippines : tout déplacement d'animal entre îles requiert un permis national de transport.",
      "Vuelo nacional en Filipinas: todo traslado de mascota entre islas requiere un permiso nacional de transporte."),
    points: [
      T("A Local Shipping Permit from the Bureau of Animal Industry is required for domestic movement, including inter-island. It is free and takes about 3 working days, applied for online.",
        "Un Local Shipping Permit du Bureau of Animal Industry est exigé pour tout mouvement intérieur, y compris entre îles. Il est gratuit, s'obtient en ligne et prend environ 3 jours ouvrés.",
        "Se exige un Local Shipping Permit del Bureau of Animal Industry para el movimiento nacional, incluido entre islas. Es gratuito, se solicita en línea y tarda unos 3 días hábiles."),
      T("Rabies vaccination must be at least 14 days and at most 1 year old, and the dog must be about 4 months minimum to be shipped.",
        "La vaccination antirabique doit dater d'au moins 14 jours et d'au plus 1 an, et le chien doit avoir environ 4 mois minimum pour être transporté.",
        "La vacuna antirrábica debe tener al menos 14 días y como máximo 1 año, y el perro debe tener unos 4 meses mínimo para ser transportado."),
      T("Some provinces are declared rabies-free and add their own entry rules at local level — check with the destination provincial or city veterinary office.",
        "Certaines provinces sont déclarées indemnes de rage et ajoutent leurs propres règles d'entrée au niveau local — renseigne-toi auprès du bureau vétérinaire provincial ou municipal de destination.",
        "Algunas provincias están declaradas libres de rabia y añaden sus propias reglas de entrada a nivel local — consulta la oficina veterinaria provincial o municipal de destino."),
    ],
  },
  vn: {
    intro: T("Domestic flight in Vietnam: crossing a provincial boundary requires a veterinary quarantine certificate — there is no exemption for pets.",
      "Vol intérieur au Vietnam : franchir une limite provinciale impose un certificat de quarantaine vétérinaire — il n'existe aucune exemption pour les animaux de compagnie.",
      "Vuelo nacional en Vietnam: cruzar un límite provincial exige un certificado de cuarentena veterinaria — no hay exención para mascotas."),
    points: [
      T("Dogs are expressly listed among the animals needing a quarantine certificate to leave a province, issued by the provincial veterinary authority. The 'two pets' exemption people cite applies to crossing an international border, not domestic travel.",
        "Les chiens figurent expressément parmi les animaux nécessitant un certificat de quarantaine pour quitter une province, délivré par l'autorité vétérinaire provinciale. L'exemption « deux animaux » souvent citée concerne le passage d'une frontière internationale, pas un trajet intérieur.",
        "Los perros figuran expresamente entre los animales que necesitan certificado de cuarentena para salir de una provincia, emitido por la autoridad veterinaria provincial. La exención de «dos mascotas» que se cita se refiere a cruzar una frontera internacional, no a un viaje nacional."),
      T("A vaccinated dog from a disease-free area is processed faster (about one working day) than an unvaccinated one, which triggers lab testing.",
        "Un chien vacciné venant d'une zone indemne est traité plus vite (environ un jour ouvré) qu'un chien non vacciné, qui déclenche des analyses de laboratoire.",
        "Un perro vacunado procedente de una zona libre se tramita más rápido (aproximadamente un día hábil) que uno sin vacunar, que activa análisis de laboratorio."),
      T("Where a rabies outbreak zone is declared, moving dogs in or out is suspended entirely — check the situation at your departure province before booking.",
        "Là où une zone d'épizootie rabique est déclarée, tout mouvement de chiens y est suspendu dans les deux sens — vérifie la situation de ta province de départ avant de réserver.",
        "Donde se declara una zona de brote de rabia, el movimiento de perros queda suspendido en ambos sentidos — comprueba la situación de tu provincia de salida antes de reservar."),
    ],
  },
  tr: {
    intro: T("Domestic flight in Turkey: the pet passport is compulsory even inside the country — but no health certificate is needed.",
      "Vol intérieur en Turquie : le passeport pour animal est obligatoire même à l'intérieur du pays — mais aucun certificat sanitaire n'est requis.",
      "Vuelo nacional en Turquía: el pasaporte para mascotas es obligatorio incluso dentro del país — pero no se exige certificado sanitario."),
    points: [
      T("Carrying the pet passport is compulsory for domestic movements of dogs, cats and ferrets. It is issued by an authorised vet or the provincial agriculture directorate.",
        "Le port du passeport pour animal est obligatoire pour les mouvements intérieurs de chiens, chats et furets. Il est délivré par un vétérinaire agréé ou la direction provinciale de l'agriculture.",
        "Llevar el pasaporte de mascota es obligatorio para los movimientos nacionales de perros, gatos y hurones. Lo emite un veterinario autorizado o la dirección provincial de agricultura."),
      T("Conversely, non-commercial pets are expressly exempt from the veterinary health report. Rabies vaccination is compulsory annually from 3 months, and an ISO microchip is mandatory — both as general ownership duties.",
        "À l'inverse, les animaux de compagnie non commerciaux sont expressément dispensés du rapport sanitaire vétérinaire. La vaccination antirabique est obligatoire chaque année dès 3 mois, et la puce ISO est obligatoire — l'une et l'autre au titre des obligations générales du détenteur.",
        "En cambio, las mascotas no comerciales están expresamente exentas del informe sanitario veterinario. La vacuna antirrábica es obligatoria anualmente desde los 3 meses, y el microchip ISO es obligatorio — ambas como obligaciones generales del propietario."),
      CARRIER,
    ],
  },
  tw: {
    intro: T("Domestic flight in Taiwan: nothing is required within the main island, but the outlying islands of Kinmen and Matsu are a real internal border.",
      "Vol intérieur à Taïwan : rien n'est exigé sur l'île principale, mais les îles de Kinmen et Matsu constituent une véritable frontière intérieure.",
      "Vuelo nacional en Taiwán: nada se exige en la isla principal, pero las islas de Kinmen y Matsu son una verdadera frontera interior."),
    points: [
      T("Pet registration with an implanted microchip and annual rabies vaccination are compulsory as ownership duties.",
        "L'enregistrement de l'animal avec puce implantée et la vaccination antirabique annuelle sont obligatoires au titre des devoirs du détenteur.",
        "El registro de la mascota con microchip implantado y la vacuna antirrábica anual son obligatorios como deberes del propietario."),
      T("Within Taiwan proper, including Penghu, no movement document is required.",
        "Sur Taïwan proprement dit, Penghu compris, aucun document de mouvement n'est requis.",
        "En Taiwán propiamente dicho, incluido Penghu, no se exige documento de movimiento."),
      CARRIER,
    ],
    territories: [terr("Kinmen and Matsu", "Kinmen et Matsu", "Kinmen y Matsu",
      "Dogs moving in either direction between Taiwan proper and these islands must be inspected: pet registration dated at least 30 days before, and rabies vaccination at least 7 days before arrival and under a year old. Documents are filed before departure and the animal is presented on arrival.",
      "Les chiens circulant dans un sens comme dans l'autre entre Taïwan et ces îles doivent être inspectés : enregistrement datant d'au moins 30 jours, et vaccination antirabique d'au moins 7 jours avant l'arrivée et de moins d'un an. Les documents se déposent avant le départ et l'animal est présenté à l'arrivée.",
      "Los perros que se muevan en cualquier sentido entre Taiwán y estas islas deben ser inspeccionados: registro con al menos 30 días de antigüedad, y vacuna antirrábica de al menos 7 días antes de la llegada y de menos de un año. Los documentos se presentan antes de salir y el animal se presenta a la llegada.",
      "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=M0130014")],
  },
  my: {
    intro: T("Domestic flight in Malaysia: flying to Sabah or Sarawak is legally an import, with permit, titer and quarantine.",
      "Vol intérieur en Malaisie : rejoindre Sabah ou Sarawak constitue juridiquement une importation, avec permis, titrage et quarantaine.",
      "Vuelo nacional en Malasia: volar a Sabah o Sarawak es jurídicamente una importación, con permiso, titulación y cuarentena."),
    points: [
      T("Sabah and Sarawak run their own animal-health legislation and treat a dog from Peninsular Malaysia as an imported animal.",
        "Sabah et Sarawak appliquent leur propre législation sanitaire et traitent un chien venant de Malaisie péninsulaire comme un animal importé.",
        "Sabah y Sarawak aplican su propia legislación sanitaria y tratan a un perro procedente de Malasia peninsular como un animal importado."),
      T("Airlines take pets in the hold rather than the cabin, and at least one Malaysian carrier refuses animals entirely.",
        "Les compagnies acceptent les animaux en soute plutôt qu'en cabine, et au moins une compagnie malaisienne les refuse totalement.",
        "Las aerolíneas aceptan mascotas en bodega más que en cabina, y al menos una aerolínea malasia las rechaza por completo."),
    ],
    territories: [
      terr("Sabah", "Sabah", "Sabah",
        "An import licence from the state veterinary service is mandatory, with rabies vaccination between 6 months and 1 year old, a rabies antibody titer of at least 0.5 IU/ml, a microchip, and a minimum 14-day quarantine — extended to 60 days if the titer is missing.",
        "Une licence d'importation du service vétérinaire de l'État est obligatoire, avec vaccination antirabique datant de 6 mois à 1 an, un titrage antirabique d'au moins 0,5 UI/ml, une puce, et une quarantaine minimale de 14 jours — portée à 60 jours en l'absence de titrage.",
        "Se exige una licencia de importación del servicio veterinario estatal, con vacuna antirrábica de entre 6 meses y 1 año, titulación antirrábica de al menos 0,5 UI/ml, microchip y cuarentena mínima de 14 días — ampliada a 60 días si falta la titulación.",
        "https://vet.sabah.gov.my/import"),
      terr("Sarawak", "Sarawak", "Sarawak",
        "An import permit is required, the dog must be at least 3 months old and microchipped, with a health certificate within 7 days. Quarantine is 14 days, but can be waived entirely if the rabies titer exceeds 0.5 IU/ml.",
        "Un permis d'importation est exigé, le chien doit avoir au moins 3 mois et être pucé, avec un certificat sanitaire de moins de 7 jours. La quarantaine est de 14 jours, mais peut être totalement levée si le titrage antirabique dépasse 0,5 UI/ml.",
        "Se exige permiso de importación, el perro debe tener al menos 3 meses y microchip, con certificado sanitario de menos de 7 días. La cuarentena es de 14 días, pero puede eliminarse por completo si la titulación antirrábica supera 0,5 UI/ml.",
        "https://dvs.sarawak.gov.my/web/subpage/download_list/"),
    ],
  },

  // ---------- B. Standing ownership duty, not travel-specific ----------
  za: {
    intro: T("Domestic flight in South Africa: no permit or health certificate is required by the State, but rabies vaccination is compulsory for every dog.",
      "Vol intérieur en Afrique du Sud : aucun permis ni certificat sanitaire n'est exigé par l'État, mais la vaccination antirabique est obligatoire pour tout chien.",
      "Vuelo nacional en Sudáfrica: el Estado no exige permiso ni certificado sanitario, pero la vacuna antirrábica es obligatoria para todo perro."),
    points: [
      T("Rabies vaccination is compulsory for all dogs and cats: at 3 months, a second dose within 12 months, then every 3 years. This is a standing duty on the owner, not a travel rule.",
        "La vaccination antirabique est obligatoire pour tous les chiens et chats : à 3 mois, une seconde dose dans les 12 mois, puis tous les 3 ans. C'est une obligation permanente du détenteur, pas une règle de voyage.",
        "La vacuna antirrábica es obligatoria para todos los perros y gatos: a los 3 meses, una segunda dosis en 12 meses, y luego cada 3 años. Es un deber permanente del propietario, no una regla de viaje."),
      T("No microchip and no movement permit are required for an ordinary healthy dog. In practice airlines turn the vaccination duty into a document you must produce at check-in.",
        "Ni puce ni permis de mouvement ne sont exigés pour un chien sain ordinaire. En pratique, les compagnies transforment cette obligation vaccinale en document à présenter à l'enregistrement.",
        "No se exige microchip ni permiso de movimiento para un perro sano corriente. En la práctica, las aerolíneas convierten ese deber de vacunación en un documento que hay que presentar en el mostrador."),
      T("Around an active rabies outbreak a local restriction can be imposed at short notice — check with the state veterinarian if in doubt.",
        "Autour d'un foyer de rage actif, une restriction locale peut être imposée à bref délai — renseigne-toi auprès du vétérinaire d'État en cas de doute.",
        "Alrededor de un brote activo de rabia puede imponerse una restricción local con poca antelación — consulta al veterinario estatal en caso de duda."),
    ],
  },
  dz: {
    intro: T("Domestic flight in Algeria: no travel document is required by law, but rabies vaccination is compulsory for every dog.",
      "Vol intérieur en Algérie : aucun document de voyage n'est exigé par la loi, mais la vaccination antirabique est obligatoire pour tout chien.",
      "Vuelo nacional en Argelia: la ley no exige ningún documento de viaje, pero la vacuna antirrábica es obligatoria para todo perro."),
    points: [
      T("Rabies vaccination of dogs and cats is compulsory, and the certificate is registered with the communal hygiene office. This is a general obligation, never tied to travel.",
        "La vaccination antirabique des chiens et chats est obligatoire, et le certificat s'enregistre au bureau d'hygiène communal. C'est une obligation générale, jamais liée au voyage.",
        "La vacuna antirrábica de perros y gatos es obligatoria, y el certificado se registra en la oficina de higiene comunal. Es una obligación general, nunca ligada al viaje."),
      T("No microchip is required by Algerian law; a dog in a public place must wear a collar with the owner's name and address.",
        "Aucune puce n'est exigée par le droit algérien ; un chien sur la voie publique doit porter un collier avec le nom et l'adresse de son maître.",
        "La ley argelina no exige microchip; un perro en la vía pública debe llevar collar con el nombre y la dirección de su dueño."),
      T("Where a wilaya declares a rabies-infected zone, leash and muzzle rules apply and movement can be restricted.",
        "Là où une wilaya déclare une zone infectée par la rage, les règles de laisse et de muselière s'appliquent et les mouvements peuvent être restreints.",
        "Donde una wilaya declara zona infectada de rabia, se aplican reglas de correa y bozal y el movimiento puede restringirse."),
    ],
  },
  eg: {
    intro: T("Domestic flight in Egypt: no travel certificate is required, but owning a dog requires a licence and several common breeds are classed as dangerous.",
      "Vol intérieur en Égypte : aucun certificat de voyage n'est exigé, mais détenir un chien requiert une licence et plusieurs races courantes sont classées dangereuses.",
      "Vuelo nacional en Egipto: no se exige certificado de viaje, pero tener un perro requiere licencia y varias razas comunes se clasifican como peligrosas."),
    points: [
      T("Rabies vaccination is a general legal obligation, and keeping a dog requires a possession licence from the veterinary services. Identification is by numbered collar tag, not microchip.",
        "La vaccination antirabique est une obligation légale générale, et détenir un chien exige une licence de possession délivrée par les services vétérinaires. L'identification se fait par médaille numérotée, pas par puce.",
        "La vacuna antirrábica es una obligación legal general, y tener un perro exige una licencia de posesión de los servicios veterinarios. La identificación es por chapa numerada, no por microchip."),
      T("The law treats transporting an animal from one place to another as 'circulation', and breeds listed as dangerous — German Shepherd, Rottweiler, Boxer, Husky, Doberman among others — may not circulate without a licence. Confirm your breed's status before booking.",
        "La loi assimile le transport d'un animal d'un lieu à un autre à une « circulation », et les races classées dangereuses — berger allemand, rottweiler, boxer, husky, doberman notamment — ne peuvent circuler sans licence. Vérifie le statut de ta race avant de réserver.",
        "La ley asimila transportar un animal de un lugar a otro a «circulación», y las razas clasificadas como peligrosas — pastor alemán, rottweiler, bóxer, husky, doberman entre otras — no pueden circular sin licencia. Verifica el estatus de tu raza antes de reservar."),
      CARRIER,
    ],
  },
  ge: {
    intro: T("Domestic flight in Georgia: no travel document is required, but identification and rabies vaccination are compulsory for every pet.",
      "Vol intérieur en Géorgie : aucun document de voyage n'est exigé, mais l'identification et la vaccination antirabique sont obligatoires pour tout animal.",
      "Vuelo nacional en Georgia: no se exige documento de viaje, pero la identificación y la vacuna antirrábica son obligatorias para toda mascota."),
    points: [
      T("Under the pet law in force since 2026, dogs must be identified and registered in the national database, and vaccinated against rabies. Both are ownership duties, not flight conditions.",
        "En vertu de la loi sur les animaux de compagnie en vigueur depuis 2026, les chiens doivent être identifiés et enregistrés dans la base nationale, et vaccinés contre la rage. Ce sont des obligations de détention, pas des conditions de vol.",
        "Según la ley de mascotas vigente desde 2026, los perros deben estar identificados y registrados en la base nacional, y vacunados contra la rabia. Son deberes de tenencia, no condiciones de vuelo."),
      NO_STATE_RULE,
      T("Carriers on the small domestic network differ widely, and the operator serving the mountain airfields publishes no pet policy at all — call before you count on flying with your dog.",
        "Les compagnies du petit réseau intérieur diffèrent beaucoup, et l'opérateur desservant les aérodromes de montagne ne publie aucune politique animaux — appelle avant de compter voyager avec ton chien.",
        "Las aerolíneas de la pequeña red nacional difieren mucho, y el operador que sirve los aeródromos de montaña no publica ninguna política de mascotas — llama antes de contar con volar con tu perro."),
    ],
  },
  ke: {
    intro: T("Domestic flight in Kenya: no national travel rule for dogs, but rabies control areas and county licensing can apply.",
      "Vol intérieur au Kenya : aucune règle nationale de voyage pour les chiens, mais les zones de contrôle de la rage et les licences de comté peuvent s'appliquer.",
      "Vuelo nacional en Kenia: ninguna regla nacional de viaje para perros, pero pueden aplicarse zonas de control de la rabia y licencias de condado."),
    points: [
      T("The national livestock movement permit does not cover dogs. But moving a dog into or out of a declared rabies control area requires prior written permission from a veterinary officer.",
        "Le permis national de mouvement du bétail ne couvre pas les chiens. En revanche, faire entrer ou sortir un chien d'une zone déclarée de contrôle de la rage exige l'autorisation écrite préalable d'un vétérinaire officiel.",
        "El permiso nacional de movimiento de ganado no cubre a los perros. En cambio, sacar o meter un perro de una zona declarada de control de la rabia exige autorización escrita previa de un veterinario oficial."),
      T("Dog licensing is devolved to counties: in Nairobi, a licence is required to keep a dog and a rabies vaccination certificate is part of the application. Rules elsewhere vary.",
        "L'octroi de licences pour chiens relève des comtés : à Nairobi, une licence est requise pour détenir un chien et un certificat de vaccination antirabique fait partie du dossier. Les règles diffèrent ailleurs.",
        "Las licencias para perros dependen de los condados: en Nairobi se exige licencia para tener un perro y un certificado de vacuna antirrábica forma parte de la solicitud. Las reglas varían en otros lugares."),
      T("Several Kenyan carriers refuse pets outright or take them only as cargo — confirm before booking.",
        "Plusieurs compagnies kényanes refusent purement et simplement les animaux ou ne les acceptent qu'en fret — confirme avant de réserver.",
        "Varias aerolíneas keniatas rechazan las mascotas o solo las aceptan como carga — confírmalo antes de reservar."),
    ],
  },

  // ---------- C. Nothing imposed by the State: carrier policy ----------
  ca: {
    intro: T("Domestic flight in Canada: no federal or provincial formality — the paperwork you may be asked for is the airline's.",
      "Vol intérieur au Canada : aucune formalité fédérale ni provinciale — les documents éventuellement demandés sont ceux de la compagnie.",
      "Vuelo nacional en Canadá: ningún trámite federal ni provincial — los documentos que puedan pedirte son de la aerolínea."),
    points: [
      T("There are no interprovincial rabies vaccination requirements, no microchip obligation and no health certificate for domestic arrival. Newfoundland's old entry restriction was repealed in 2012.",
        "Il n'existe aucune exigence interprovinciale de vaccination antirabique, aucune obligation de puce ni certificat sanitaire à l'arrivée. L'ancienne restriction d'entrée de Terre-Neuve a été abrogée en 2012.",
        "No existe ningún requisito interprovincial de vacuna antirrábica, ninguna obligación de microchip ni certificado sanitario a la llegada. La antigua restricción de entrada de Terranova fue derogada en 2012."),
      T("Ontario does require every dog over 3 months living there to be vaccinated against rabies — an ownership duty, checked by public health, not at the airport.",
        "L'Ontario exige toutefois que tout chien de plus de 3 mois y résidant soit vacciné contre la rage — une obligation de détention, contrôlée par la santé publique, pas à l'aéroport.",
        "Ontario sí exige que todo perro de más de 3 meses que resida allí esté vacunado contra la rabia — un deber de tenencia, controlado por salud pública, no en el aeropuerto."),
      T("The real constraints are carrier embargoes: brachycephalic bans, winter holiday blackouts on hold carriage, and cold-weather refusals on northern routes.",
        "Les vraies contraintes sont les embargos des compagnies : interdictions des races brachycéphales, blocages de la soute pendant les fêtes, et refus par grand froid sur les liaisons nordiques.",
        "Las verdaderas limitaciones son los embargos de las aerolíneas: prohibiciones de razas braquicéfalas, bloqueos de bodega en fiestas y rechazos por frío en rutas del norte."),
    ],
  },
  mx: {
    intro: T("Domestic flight in Mexico: no federal formality — in practice it is the airlines that impose the paperwork.",
      "Vol intérieur au Mexique : aucune formalité fédérale — en pratique, ce sont les compagnies qui imposent les documents.",
      "Vuelo nacional en México: ningún trámite federal — en la práctica son las aerolíneas las que imponen los documentos."),
    points: [
      T("No federal rule requires rabies vaccination, a microchip or a sanitary certificate for a domestic flight, and SENASICA's certificate is not triggered for pet dogs.",
        "Aucune règle fédérale n'impose vaccination antirabique, puce ou certificat sanitaire pour un vol intérieur, et le certificat du SENASICA ne s'applique pas aux chiens de compagnie.",
        "Ninguna norma federal exige vacuna antirrábica, microchip ni certificado sanitario para un vuelo nacional, y el certificado de SENASICA no aplica a perros de compañía."),
      T("Mexican carriers, however, commonly require a vaccination record plus a health certificate issued within about 5 days, with weight limits and long brachycephalic exclusion lists.",
        "Les compagnies mexicaines exigent en revanche couramment un carnet de vaccination et un certificat de santé de moins de 5 jours environ, avec limites de poids et longues listes d'exclusion de races brachycéphales.",
        "Las aerolíneas mexicanas sí suelen exigir cartilla de vacunación y certificado de salud de unos 5 días, con límites de peso y largas listas de exclusión de razas braquicéfalas."),
    ],
  },
  ar: {
    intro: T("Domestic flight in Argentina: the State has no specific rule — the vet certificate is asked for by the airlines.",
      "Vol intérieur en Argentine : l'État n'a pas de réglementation spécifique — le certificat vétérinaire est demandé par les compagnies.",
      "Vuelo nacional en Argentina: el Estado no tiene reglamentación específica — el certificado veterinario lo piden las aerolíneas."),
    points: [
      T("SENASA states it has no specific regulation for domestic pet transport, and that its involvement is requested by the airlines rather than imposed by law.",
        "Le SENASA indique n'avoir aucune réglementation spécifique pour le transport intérieur d'animaux, et que son intervention est sollicitée par les compagnies plutôt qu'imposée par la loi.",
        "SENASA indica que no tiene reglamentación específica para el transporte nacional de mascotas, y que su intervención la solicitan las aerolíneas, no la impone la ley."),
      T("Vaccinating your dog is a standing legal duty of ownership, which is a different thing from a flight requirement. The Patagonian sanitary barrier restricts meat and fruit, not pet dogs.",
        "Vacciner son chien est une obligation légale permanente du détenteur, ce qui est autre chose qu'une exigence de vol. La barrière sanitaire patagonienne restreint les viandes et les fruits, pas les chiens de compagnie.",
        "Vacunar a tu perro es un deber legal permanente del propietario, cosa distinta de un requisito de vuelo. La barrera sanitaria patagónica restringe carnes y frutas, no perros de compañía."),
      T("The restriction that catches most travellers is at destination: dogs are banned from national parks, which matters for Bariloche, El Calafate, Ushuaia and Iguazú.",
        "La restriction qui piège le plus de voyageurs est à destination : les chiens sont interdits dans les parcs nationaux, ce qui concerne Bariloche, El Calafate, Ushuaia et Iguazú.",
        "La restricción que más sorprende está en destino: los perros están prohibidos en los parques nacionales, lo que afecta a Bariloche, El Calafate, Ushuaia e Iguazú."),
    ],
  },
  cr: {
    intro: T("Domestic flight in Costa Rica: no State requirement found for a domestic flight.",
      "Vol intérieur au Costa Rica : aucune exigence de l'État identifiée pour un vol intérieur.",
      "Vuelo nacional en Costa Rica: no se ha identificado ningún requisito del Estado para un vuelo nacional."),
    points: [
      T("SENASA's dog and cat procedures are written for leaving the country; no domestic permit or certificate exists for pets.",
        "Les procédures du SENASA pour chiens et chats sont écrites pour la sortie du territoire ; aucun permis ni certificat intérieur n'existe pour les animaux de compagnie.",
        "Los procedimientos de SENASA para perros y gatos están escritos para salir del país; no existe permiso ni certificado nacional para mascotas."),
      T("The domestic operator carries dogs in the hold rather than the cabin and asks for a vaccination record — a carrier condition.",
        "L'opérateur intérieur transporte les chiens en soute plutôt qu'en cabine et demande un carnet de vaccination — une condition de la compagnie.",
        "El operador nacional transporta perros en bodega más que en cabina y pide una cartilla de vacunación — una condición de la aerolínea."),
    ],
  },
  do: {
    intro: T("Domestic flight in the Dominican Republic: no State requirement — the movement guide does not cover dogs.",
      "Vol intérieur en République dominicaine : aucune exigence de l'État — la guía de movilización ne couvre pas les chiens.",
      "Vuelo nacional en República Dominicana: ningún requisito del Estado — la guía de movilización no cubre a los perros."),
    points: [
      T("The national movement guide applies to sheep, goats, horses, cattle and bees — dogs are not listed. Any paperwork at the airport is the airline's own.",
        "La guía de movilización nationale s'applique aux ovins, caprins, équidés, bovins et abeilles — les chiens n'y figurent pas. Tout document exigé à l'aéroport est propre à la compagnie.",
        "La guía de movilización nacional se aplica a ovinos, caprinos, equinos, bovinos y apícolas — los perros no figuran. Cualquier documento exigido en el aeropuerto es de la aerolínea."),
      T("The main domestic carrier takes small dogs in the cabin only, with weight limits, a health certificate and breed restrictions.",
        "La principale compagnie intérieure n'accepte les petits chiens qu'en cabine, avec limites de poids, certificat de santé et restrictions de race.",
        "La principal aerolínea nacional solo acepta perros pequeños en cabina, con límites de peso, certificado de salud y restricciones de raza."),
    ],
  },
  jp: {
    intro: T("Domestic flight in Japan: no quarantine or certificate for internal travel — animal quarantine applies only to international movement.",
      "Vol intérieur au Japon : aucune quarantaine ni certificat pour un trajet interne — la quarantaine animale ne concerne que l'international.",
      "Vuelo nacional en Japón: ninguna cuarentena ni certificado para un trayecto interno — la cuarentena animal solo afecta a lo internacional."),
    points: [
      T("Every dog over 91 days must be registered and vaccinated against rabies annually — an ownership duty under the Rabies Prevention Act, independent of travel. Japan is rabies-free, so there is no internal zoning.",
        "Tout chien de plus de 91 jours doit être enregistré et vacciné contre la rage chaque année — une obligation de détention, indépendante du voyage. Le Japon est indemne de rage, il n'existe donc aucun zonage interne.",
        "Todo perro de más de 91 días debe estar registrado y vacunado contra la rabia anualmente — un deber de tenencia, independiente del viaje. Japón está libre de rabia, por lo que no hay zonificación interna."),
      T("Japanese carriers take pets in the hold only, never in the cabin, check the rabies record, and refuse snub-nosed breeds during the warm months.",
        "Les compagnies japonaises n'acceptent les animaux qu'en soute, jamais en cabine, vérifient le carnet antirabique et refusent les races à nez court pendant les mois chauds.",
        "Las aerolíneas japonesas solo aceptan mascotas en bodega, nunca en cabina, comprueban la cartilla antirrábica y rechazan razas chatas durante los meses cálidos."),
    ],
  },
  kr: {
    intro: T("Domestic flight in South Korea: no quarantine certificate for internal travel — those are issued for departures abroad only.",
      "Vol intérieur en Corée du Sud : aucun certificat de quarantaine pour un trajet interne — ils ne sont délivrés que pour les départs à l'étranger.",
      "Vuelo nacional en Corea del Sur: ningún certificado de cuarentena para un trayecto interno — solo se emiten para salidas al extranjero."),
    points: [
      T("Dogs aged 2 months and over must be registered with an RFID microchip — an ownership duty under the Animal Protection Act, not a travel condition.",
        "Les chiens de 2 mois et plus doivent être enregistrés avec une puce RFID — une obligation de détention au titre de la loi sur la protection animale, pas une condition de voyage.",
        "Los perros de 2 meses o más deben estar registrados con microchip RFID — un deber de tenencia bajo la ley de protección animal, no una condición de viaje."),
      T("Jeju does run a distinct inbound quarantine regime, but its published scope covers cloven-hoofed livestock and poultry — dogs are not listed.",
        "Jeju applique bien un régime de quarantaine distinct à l'entrée, mais son champ publié vise le bétail à onglons et la volaille — les chiens n'y figurent pas.",
        "Jeju sí aplica un régimen de cuarentena distinto a la entrada, pero su ámbito publicado abarca ganado de pezuña hendida y aves — los perros no figuran."),
      CARRIER,
    ],
  },
  nz: {
    intro: T("Domestic flight in New Zealand: nothing is required to fly, including between the North and South Islands.",
      "Vol intérieur en Nouvelle-Zélande : rien n'est exigé pour voler, y compris entre l'île du Nord et l'île du Sud.",
      "Vuelo nacional en Nueva Zelanda: no se exige nada para volar, tampoco entre la Isla Norte y la Isla Sur."),
    points: [
      T("New Zealand has never had a case of rabies, so no rabies vaccination applies. Microchipping is legally required for dog registration, but it is not a boarding condition, and no health certificate or permit exists for internal movement.",
        "La Nouvelle-Zélande n'a jamais connu de cas de rage, aucune vaccination antirabique ne s'applique donc. La puce est légalement requise pour l'enregistrement du chien, mais ce n'est pas une condition d'embarquement, et aucun certificat ni permis n'existe pour un mouvement interne.",
        "Nueva Zelanda nunca ha tenido un caso de rabia, así que no aplica vacuna antirrábica. El microchip es legalmente obligatorio para registrar al perro, pero no es condición de embarque, y no existe certificado ni permiso para el movimiento interno."),
      T("The real restriction is at destination: dogs are banned from conservation land and national parks without written approval, and a dog found there may be seized. Some areas require a permit obtained days in advance.",
        "La vraie restriction est à destination : les chiens sont interdits sur les terres de conservation et dans les parcs nationaux sans autorisation écrite, et un chien qui s'y trouve peut être saisi. Certaines zones exigent un permis obtenu plusieurs jours à l'avance.",
        "La verdadera restricción está en destino: los perros están prohibidos en tierras de conservación y parques nacionales sin autorización escrita, y un perro allí puede ser incautado. Algunas zonas exigen un permiso obtenido días antes."),
      T("One national carrier takes pets in the hold with no vaccination or vet document requested at all, while another refuses animals entirely.",
        "Une compagnie nationale accepte les animaux en soute sans exiger la moindre vaccination ni document vétérinaire, tandis qu'une autre les refuse totalement.",
        "Una aerolínea nacional acepta mascotas en bodega sin exigir vacuna ni documento veterinario alguno, mientras que otra los rechaza por completo."),
    ],
  },
  au: {
    intro: T("Domestic flight in Australia: nothing is required between mainland states — but Tasmania and the external territories are real biosecurity borders.",
      "Vol intérieur en Australie : rien n'est exigé entre États du continent — mais la Tasmanie et les territoires extérieurs constituent de véritables frontières de biosécurité.",
      "Vuelo nacional en Australia: nada se exige entre estados continentales — pero Tasmania y los territorios exteriores son verdaderas fronteras de bioseguridad."),
    points: [
      T("Australia is rabies-free, so no rabies vaccination applies. Microchipping is required to register a dog in most states, but it is never a boarding condition.",
        "L'Australie est indemne de rage, aucune vaccination antirabique ne s'applique donc. La puce est exigée pour enregistrer un chien dans la plupart des États, mais n'est jamais une condition d'embarquement.",
        "Australia está libre de rabia, así que no aplica vacuna antirrábica. El microchip es obligatorio para registrar al perro en la mayoría de estados, pero nunca es condición de embarque."),
      T("Western Australia runs biosecurity checkpoints but imposes no dog-specific entry condition. Restricted breeds are controlled by the destination council, not at the airport.",
        "L'Australie-Occidentale tient des postes de biosécurité mais n'impose aucune condition d'entrée propre aux chiens. Les races réglementées sont contrôlées par la commune de destination, pas à l'aéroport.",
        "Australia Occidental tiene puestos de bioseguridad pero no impone condición de entrada específica para perros. Las razas restringidas las controla el municipio de destino, no el aeropuerto."),
      T("Carrier rules matter more than law here: one major airline refuses pets entirely, another is the only one allowing cabin travel, and heat and cold limits apply to hold carriage.",
        "Les règles des compagnies comptent ici plus que la loi : une grande compagnie refuse totalement les animaux, une autre est la seule à autoriser la cabine, et des limites de chaleur et de froid s'appliquent à la soute.",
        "Aquí las reglas de las aerolíneas pesan más que la ley: una gran aerolínea rechaza las mascotas por completo, otra es la única que permite cabina, y hay límites de calor y frío para la bodega."),
    ],
    territories: [
      terr("Tasmania", "Tasmanie", "Tasmania",
        "The one genuine interstate requirement: praziquantel treatment at 5 mg/kg within 14 days before entry, against hydatid disease, plus a tick-freedom declaration. Proof can be a vet statement, a statutory declaration or the pill packet. Without it the tablet is given at the port, at your cost.",
        "La seule véritable exigence entre États : un traitement au praziquantel à 5 mg/kg dans les 14 jours précédant l'entrée, contre l'échinococcose, plus une déclaration d'absence de tiques. La preuve peut être une attestation vétérinaire, une déclaration sur l'honneur ou la boîte du médicament. À défaut, le comprimé est administré au port, à tes frais.",
        "El único requisito real entre estados: tratamiento con prazicuantel a 5 mg/kg en los 14 días previos a la entrada, contra la hidatidosis, más una declaración de ausencia de garrapatas. La prueba puede ser un certificado veterinario, una declaración jurada o el envase del medicamento. Si no, la pastilla se administra en el puerto, a tu costa.",
        "https://nre.tas.gov.au/biosecurity-tasmania/biosecurity/importing-animals/dogs"),
      terr("Christmas Island", "Île Christmas", "Isla de Navidad",
        "Dogs and cats are banned outright from Christmas Island. Only an assistance animal may be approved, on written application to the Administrator.",
        "Les chiens et chats sont purement interdits sur l'île Christmas. Seul un animal d'assistance peut être autorisé, sur demande écrite à l'Administrateur.",
        "Los perros y gatos están totalmente prohibidos en la Isla de Navidad. Solo puede autorizarse un animal de asistencia, mediante solicitud escrita al Administrador.",
        "https://www.infrastructure.gov.au/territories-regions-cities/territories/indian-ocean-territories/christmas-island/travel-information"),
      terr("Norfolk Island", "Île Norfolk", "Isla Norfolk",
        "A full international-style protocol applies from the mainland: microchip, core vaccinations at least 14 days before, continuous parasite cover, a negative Ehrlichia canis test within 45 days, negative heartworm and leptospirosis tests, and a vet health certificate within 5 days. The return leg is unrestricted.",
        "Un protocole de type international s'applique depuis le continent : puce, vaccins de base au moins 14 jours avant, couverture antiparasitaire continue, test Ehrlichia canis négatif dans les 45 jours, tests dirofilariose et leptospirose négatifs, et certificat vétérinaire de moins de 5 jours. Le retour, lui, est libre.",
        "Se aplica un protocolo de tipo internacional desde el continente: microchip, vacunas básicas al menos 14 días antes, cobertura antiparasitaria continua, test de Ehrlichia canis negativo en 45 días, pruebas negativas de dirofilariosis y leptospirosis, y certificado veterinario de menos de 5 días. La vuelta es libre.",
        "https://www.agriculture.gov.au/biosecurity-trade/cats-dogs/norfolk-island-from-mainland-australia"),
    ],
  },
  th: {
    intro: T("Domestic flight in Thailand: no national document is required for a pet dog — but a declared epidemic zone changes everything.",
      "Vol intérieur en Thaïlande : aucun document national n'est exigé pour un chien de compagnie — mais une zone d'épizootie déclarée change tout.",
      "Vuelo nacional en Tailandia: no se exige ningún documento nacional para un perro de compañía — pero una zona epidémica declarada lo cambia todo."),
    points: [
      T("Dogs are deliberately absent from the list of species needing an inter-provincial movement licence, which covers livestock and poultry.",
        "Les chiens sont délibérément absents de la liste des espèces nécessitant une licence de mouvement interprovincial, qui vise le bétail et la volaille.",
        "Los perros están deliberadamente ausentes de la lista de especies que necesitan licencia de movimiento interprovincial, que cubre ganado y aves."),
      T("But inside a declared epidemic or surveillance zone naming dogs, no one may move an animal in, out, through or within the zone without written permission from the responsible veterinarian, every single time. Rabies zones are declared routinely at sub-district level — check with the livestock office at your origin.",
        "Mais à l'intérieur d'une zone d'épizootie ou de surveillance déclarée visant les chiens, nul ne peut déplacer un animal vers, hors, à travers ou dans la zone sans autorisation écrite du vétérinaire responsable, à chaque fois. Des zones rabiques sont déclarées couramment au niveau des sous-districts — renseigne-toi auprès du bureau de l'élevage de ton point de départ.",
        "Pero dentro de una zona epidémica o de vigilancia declarada que nombre a los perros, nadie puede mover un animal hacia, fuera, a través o dentro de la zona sin permiso escrito del veterinario responsable, cada vez. Las zonas de rabia se declaran habitualmente a nivel de subdistrito — consulta la oficina de ganadería de tu origen."),
      T("No Thai carrier is confirmed to allow a dog in the cabin: expect hold or cargo, a health certificate within 24 hours on some routes, and long banned-breed lists.",
        "Aucune compagnie thaïlandaise n'est confirmée comme autorisant le chien en cabine : prévois la soute ou le fret, un certificat de santé de moins de 24 heures sur certaines lignes, et de longues listes de races interdites.",
        "Ninguna aerolínea tailandesa está confirmada como que permita perros en cabina: cuenta con bodega o carga, certificado de salud de menos de 24 horas en algunas rutas, y largas listas de razas prohibidas."),
    ],
  },
  sa: {
    intro: T("Domestic flight in Saudi Arabia: no domestic movement rule is published — the quarantine framework covers import, export and transit only.",
      "Vol intérieur en Arabie saoudite : aucune règle de mouvement intérieur n'est publiée — le cadre de quarantaine ne couvre que l'import, l'export et le transit.",
      "Vuelo nacional en Arabia Saudí: no se publica ninguna regla de movimiento nacional — el marco de cuarentena solo cubre importación, exportación y tránsito."),
    points: [
      NO_STATE_RULE,
      T("Aviation regulation only obliges carriers to publish their animal rules; acceptance is left entirely to them. One national carrier takes small dogs in the cabin, another refuses animals altogether.",
        "La réglementation aérienne oblige seulement les compagnies à publier leurs règles animaux ; l'acceptation leur est entièrement laissée. Une compagnie nationale accepte les petits chiens en cabine, une autre refuse tout animal.",
        "La normativa aérea solo obliga a las aerolíneas a publicar sus reglas de animales; la aceptación queda enteramente en sus manos. Una aerolínea nacional acepta perros pequeños en cabina, otra rechaza todo animal."),
      T("Assistance animals travel free on domestic flights with a letter from the competent authority.",
        "Les animaux d'assistance voyagent gratuitement sur les vols intérieurs avec une attestation de l'autorité compétente.",
        "Los animales de asistencia viajan gratis en vuelos nacionales con una carta de la autoridad competente."),
    ],
  },
  ae: {
    intro: T("Domestic flight in the United Arab Emirates: no internal movement permit exists for pets.",
      "Vol intérieur aux Émirats arabes unis : aucun permis de mouvement interne n'existe pour les animaux de compagnie.",
      "Vuelo nacional en Emiratos Árabes Unidos: no existe permiso de movimiento interno para mascotas."),
    points: [
      T("The federal ministry issues import, transit and export permits only — nothing for moving a pet between emirates.",
        "Le ministère fédéral ne délivre que des permis d'import, de transit et d'export — rien pour déplacer un animal entre émirats.",
        "El ministerio federal solo emite permisos de importación, tránsito y exportación — nada para mover una mascota entre emiratos."),
      T("Federal law requires a dog licence and a leash in public, and the emirates run their own pet registration schemes, but these are ownership rules rather than arrival rules.",
        "La loi fédérale impose une licence pour chien et la laisse en public, et les émirats gèrent leurs propres enregistrements d'animaux, mais ce sont des règles de détention et non d'arrivée.",
        "La ley federal exige licencia para perro y correa en público, y los emiratos gestionan sus propios registros de mascotas, pero son reglas de tenencia, no de llegada."),
      T("Note that the domestic network is very limited: carriers here describe international sectors, with widely differing cabin and breed rules.",
        "Note que le réseau intérieur est très limité : les compagnies décrivent ici des vols internationaux, avec des règles de cabine et de race très variables.",
        "Ten en cuenta que la red nacional es muy limitada: las aerolíneas describen aquí trayectos internacionales, con reglas de cabina y raza muy dispares."),
    ],
  },
  ma: {
    intro: T("Domestic flight in Morocco: no official domestic requirement could be confirmed — what is asked for comes from the airline.",
      "Vol intérieur au Maroc : aucune exigence intérieure officielle n'a pu être confirmée — ce qui est demandé vient de la compagnie.",
      "Vuelo nacional en Marruecos: no se ha podido confirmar ningún requisito nacional oficial — lo que se pide viene de la aerolínea."),
    points: [
      T("The veterinary authority publishes identification and certificate models for import and export only; no domestic movement document was found, and even the general rabies obligation could not be verified on an official page.",
        "L'autorité vétérinaire ne publie des modèles d'identification et de certificats que pour l'import et l'export ; aucun document de mouvement intérieur n'a été trouvé, et même l'obligation générale de vaccination antirabique n'a pu être vérifiée sur une page officielle.",
        "La autoridad veterinaria solo publica modelos de identificación y certificados para importación y exportación; no se encontró documento de movimiento nacional, y ni siquiera la obligación general de vacuna antirrábica pudo verificarse en una página oficial."),
      T("The airports authority imposes nothing of its own and defers entirely to the airline, which does ask for health and vaccination certificates and bans snub-nosed breeds.",
        "L'autorité aéroportuaire n'impose rien en propre et s'en remet entièrement à la compagnie, qui exige bien certificats de santé et de vaccination et interdit les races à nez court.",
        "La autoridad aeroportuaria no impone nada propio y se remite enteramente a la aerolínea, que sí exige certificados de salud y vacunación y prohíbe razas chatas."),
    ],
  },
  tn: {
    intro: T("Domestic flight in Tunisia: no travel formality is published — the vaccination booklet is asked for by the carrier.",
      "Vol intérieur en Tunisie : aucune formalité de voyage n'est publiée — le carnet de vaccination est demandé par la compagnie.",
      "Vuelo nacional en Túnez: no se publica ningún trámite de viaje — la cartilla de vacunación la pide la aerolínea."),
    points: [
      T("Rabies vaccination is described by the ministry as free and compulsory as a public-health measure, but nothing ties it to travel, and the administrative services list no domestic pet certificate.",
        "La vaccination antirabique est présentée par le ministère comme gratuite et obligatoire au titre de la santé publique, mais rien ne la relie au voyage, et les services administratifs ne listent aucun certificat intérieur pour animaux.",
        "El ministerio presenta la vacuna antirrábica como gratuita y obligatoria por salud pública, pero nada la vincula al viaje, y los servicios administrativos no listan ningún certificado nacional para mascotas."),
      T("The domestic operator does require a vaccination booklet to carry an animal — the only vaccination requirement genuinely attached to a Tunisian domestic flight, and it is contractual.",
        "L'opérateur intérieur exige bien un carnet de vaccination pour transporter un animal — la seule exigence vaccinale réellement attachée à un vol intérieur tunisien, et elle est contractuelle.",
        "El operador nacional sí exige una cartilla de vacunación para transportar un animal — el único requisito de vacunación realmente ligado a un vuelo nacional tunecino, y es contractual."),
    ],
  },
};

const q = (s) => '"' + String(s).replace(/"/g, "'") + '"';
const lt3 = (o, ind) => `${ind}en: ${q(o.en)}\n${ind}fr: ${q(o.fr)}\n${ind}es: ${q(o.es)}`;
function build(d) {
  let y = "domestic:\n";
  y += "  intro:\n" + lt3(d.intro, "    ") + "\n";
  y += "  points:\n";
  for (const p of d.points) y += `    - en: ${q(p.en)}\n      fr: ${q(p.fr)}\n      es: ${q(p.es)}\n`;
  if (d.territories && d.territories.length) {
    y += "  territories:\n";
    for (const t of d.territories) {
      y += `    - name: { en: ${q(t.name.en)}, fr: ${q(t.name.fr)}, es: ${q(t.name.es)} }\n`;
      y += "      note:\n" + lt3(t.note, "        ") + "\n";
      if (t.url) y += `      url: ${t.url}\n`;
    }
  }
  return y;
}

let done = 0; const skip = [];
for (const [iso, d] of Object.entries(D)) {
  const file = resolve(DIR, iso + ".yml");
  let t;
  try { t = readFileSync(file, "utf8"); } catch { skip.push(iso + "(absent)"); continue; }
  if (/^domestic:/m.test(t)) { skip.push(iso + "(déjà)"); continue; }
  const m = t.match(/^(regime: \w+)\n/m);
  if (!m) { skip.push(iso + "(pas de regime)"); continue; }
  writeFileSync(file, t.replace(m[0], `${m[1]}\n${build(d)}`));
  done++;
}
console.log(`Blocs domestic ajoutés : ${done}`);
if (skip.length) console.log("ignorés :", skip.join(", "));
