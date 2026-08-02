#!/usr/bin/env node
/* Round-trip: exit blocks batch 2 — 19 more essential non-EU destinations (Balkans, Middle East, Asia).
   Authorities + procedures from official government sources (authorityUrl). Titer per EU list 2026/131.
   Timing windows only where an official source states them; otherwise generic. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content/countries");

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
const ONSITE_10D = {
  en: "The certificate is valid 10 days to reach the EU border check — arrange it close to departure.",
  fr: "Le certificat est valable 10 jours pour atteindre le contrôle à la frontière UE — organise-le peu avant le départ.",
  es: "El certificado vale 10 días para llegar al control fronterizo de la UE — organízalo cerca de la salida.",
};

const DATA = {
  // ---- Balkans (listed, no titer) ----
  rs: {
    authority: "Uprava za veterinu", url: "https://www.vet.minpolj.gov.rs/movement-of-pets/",
    intro: {
      en: "Serbia is a listed country, so no rabies titer is needed to return to the EU — the EU health certificate is issued by an official veterinarian of the Veterinary Directorate.",
      fr: "La Serbie est un pays listé : pas de titrage pour rentrer dans l'UE — le certificat sanitaire UE est délivré par un vétérinaire officiel de la Direction vétérinaire.",
      es: "Serbia es un país listado: no hace falta titulación para volver a la UE — el certificado sanitario UE lo emite un veterinario oficial de la Dirección Veterinaria.",
    },
    steps: [{ timing: "window", text: {
      en: "Your dog needs a microchip and valid rabies vaccination (at least 21 days after the primary shot); the EU-model health certificate is completed and endorsed by an official veterinarian of the Veterinary Directorate before departure.",
      fr: "Ton chien doit être pucé et vacciné contre la rage (au moins 21 jours après la primo-vaccination) ; le certificat sanitaire au modèle UE est rempli et visé par un vétérinaire officiel de la Direction vétérinaire avant le départ.",
      es: "Tu perro necesita microchip y vacuna antirrábica válida (al menos 21 días tras la primovacunación); el certificado sanitario en modelo UE lo rellena y refrenda un veterinario oficial de la Dirección Veterinaria antes de salir.",
    } }],
    onSiteNote: ONSITE_10D,
  },
  ba: {
    authority: "Ured za veterinarstvo BiH", url: "https://www.vet.gov.ba/en/dokument/d346",
    intro: {
      en: "Bosnia and Herzegovina is a listed country, so no rabies titer is needed to return to the EU — the EU health certificate is issued by an official veterinarian of the Veterinary Office of BiH.",
      fr: "La Bosnie-Herzégovine est un pays listé : pas de titrage pour rentrer dans l'UE — le certificat sanitaire UE est délivré par un vétérinaire officiel de l'Office vétérinaire de BiH.",
      es: "Bosnia y Herzegovina es un país listado: no hace falta titulación para volver a la UE — el certificado sanitario UE lo emite un veterinario oficial de la Oficina Veterinaria de BiH.",
    },
    steps: [{ timing: "window", text: {
      en: "With microchip and valid rabies vaccination (21-day wait), the EU-model animal health certificate is completed and issued by an official government veterinarian before departure.",
      fr: "Avec puce et vaccination antirabique valide (délai de 21 jours), le certificat sanitaire au modèle UE est rempli et délivré par un vétérinaire officiel avant le départ.",
      es: "Con microchip y vacuna antirrábica válida (espera de 21 días), el certificado sanitario en modelo UE lo rellena y emite un veterinario oficial antes de salir.",
    } }],
    onSiteNote: {
      en: "A new EU certificate format applies since 22 April 2026 (Reg. (EU) 2026/131) — make sure your vet uses the current model.",
      fr: "Un nouveau format de certificat UE s'applique depuis le 22 avril 2026 (règlement (UE) 2026/131) — assure-toi que ton vétérinaire utilise le modèle en vigueur.",
      es: "Desde el 22 de abril de 2026 se aplica un nuevo formato de certificado UE (Reg. (UE) 2026/131) — asegúrate de que tu veterinario use el modelo vigente.",
    },
  },
  me: {
    authority: "UBHVFP", url: "https://www.gov.me/ubh/veterina",
    intro: {
      en: "Montenegro is a listed country, so no rabies titer is needed to return to the EU — export certificates are issued by the Administration for Food Safety, Veterinary and Phytosanitary Affairs (UBHVFP).",
      fr: "Le Monténégro est un pays listé : pas de titrage pour rentrer dans l'UE — les certificats d'export sont délivrés par l'Administration pour la sécurité alimentaire, vétérinaire et phytosanitaire (UBHVFP).",
      es: "Montenegro es un país listado: no hace falta titulación para volver a la UE — los certificados de exportación los emite la Administración de Seguridad Alimentaria, Veterinaria y Fitosanitaria (UBHVFP).",
    },
    steps: [{ timing: "window", text: {
      en: "With microchip and valid rabies vaccination, the EU-model health certificate is issued and endorsed by the UBHVFP veterinary inspection under its special rules for export to the EU.",
      fr: "Avec puce et vaccination antirabique valide, le certificat au modèle UE est délivré et visé par l'inspection vétérinaire de l'UBHVFP, selon ses règles spéciales d'export vers l'UE.",
      es: "Con microchip y vacuna antirrábica válida, el certificado en modelo UE lo emite y refrenda la inspección veterinaria de la UBHVFP según sus reglas especiales de exportación a la UE.",
    } }],
    onSiteNote: ONSITE_10D,
  },
  mk: {
    authority: "FVA", url: "https://fva.gov.mk/en/pets",
    intro: {
      en: "North Macedonia is a listed country, so no rabies titer is needed to return to the EU — the EU health certificate is issued by an official veterinarian of the Food and Veterinary Agency (FVA).",
      fr: "La Macédoine du Nord est un pays listé : pas de titrage pour rentrer dans l'UE — le certificat sanitaire UE est délivré par un vétérinaire officiel de l'Agence pour l'alimentation et la vétérinaire (FVA).",
      es: "Macedonia del Norte es un país listado: no hace falta titulación para volver a la UE — el certificado sanitario UE lo emite un veterinario oficial de la Agencia de Alimentos y Veterinaria (FVA).",
    },
    steps: [{ timing: "window", text: {
      en: "Your dog needs a microchip and valid rabies vaccination; an FVA authorised veterinarian completes and endorses the EU-model health certificate before departure.",
      fr: "Ton chien doit être pucé et vacciné contre la rage ; un vétérinaire autorisé de la FVA remplit et vise le certificat au modèle UE avant le départ.",
      es: "Tu perro necesita microchip y vacuna antirrábica válida; un veterinario autorizado de la FVA rellena y refrenda el certificado en modelo UE antes de salir.",
    } }],
    onSiteNote: ONSITE_10D,
  },
  al: {
    authority: "AKU", url: "https://aku.gov.al/",
    intro: {
      en: "Albania is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a health certificate endorsed by a National Food Authority (AKU) official veterinarian.",
      fr: "L'Albanie est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire visé par un vétérinaire officiel de l'Autorité nationale de l'alimentation (AKU).",
      es: "Albania no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario refrendado por un veterinario oficial de la Autoridad Nacional de Alimentos (AKU).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "The EU-model animal health certificate is completed and signed by an AKU official veterinarian shortly before the flight.",
      fr: "Le certificat sanitaire au modèle UE est rempli et signé par un vétérinaire officiel de l'AKU peu avant le vol.",
      es: "El certificado sanitario en modelo UE lo rellena y firma un veterinario oficial de la AKU poco antes del vuelo.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  xk: {
    authority: "AUV", url: "https://auvk.rks-gov.net/shendeti-i-kafsheve/",
    intro: {
      en: "Kosovo is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a health certificate issued by a Food and Veterinary Agency (AUV) official veterinarian.",
      fr: "Le Kosovo est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire délivré par un vétérinaire officiel de l'Agence de l'alimentation et de la vétérinaire (AUV).",
      es: "Kosovo no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario emitido por un veterinario oficial de la Agencia de Alimentos y Veterinaria (AUV).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "The EU-model animal health certificate is issued and signed by an AUV official veterinarian before departure.",
      fr: "Le certificat sanitaire au modèle UE est délivré et signé par un vétérinaire officiel de l'AUV avant le départ.",
      es: "El certificado sanitario en modelo UE lo emite y firma un veterinario oficial de la AUV antes de salir.",
    } }],
    onSiteNote: ONSITE_TITER,
  },

  // ---- Middle East / Gulf + Egypt ----
  eg: {
    authority: "GOVS", url: "https://www.govs.gov.eg",
    intro: {
      en: "Egypt is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a health certificate endorsed by the General Organization for Veterinary Services (GOVS).",
      fr: "L'Égypte est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire visé par l'Organisation générale des services vétérinaires (GOVS).",
      es: "Egipto no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario refrendado por la Organización General de Servicios Veterinarios (GOVS).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "GOVS veterinary quarantine endorses the EU entry health certificate at the port before departure — a private-vet certificate alone is not enough.",
      fr: "La quarantaine vétérinaire de la GOVS vise le certificat sanitaire d'entrée UE au port avant le départ — un certificat de vétérinaire privé seul ne suffit pas.",
      es: "La cuarentena veterinaria de la GOVS refrenda el certificado sanitario de entrada a la UE en el puerto antes de salir — un certificado de veterinario privado por sí solo no basta.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  sa: {
    authority: "MEWA", url: "https://www.mewa.gov.sa",
    intro: {
      en: "Saudi Arabia is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a MEWA export health certificate.",
      fr: "L'Arabie saoudite est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire d'export MEWA.",
      es: "Arabia Saudí no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario de exportación de MEWA.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Apply through MEWA's online platform Anaam; a certificate from a MEWA-accredited clinic is approved at the MEWA branch after clinical and lab examination, and the export permission is valid 30 days.",
      fr: "Fais la demande sur la plateforme en ligne Anaam du MEWA ; un certificat d'une clinique agréée MEWA est validé au bureau MEWA après examen clinique et de laboratoire, et l'autorisation d'export est valable 30 jours.",
      es: "Solicítalo en la plataforma en línea Anaam de MEWA; un certificado de una clínica acreditada por MEWA se aprueba en la oficina de MEWA tras examen clínico y de laboratorio, y el permiso de exportación es válido 30 días.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  qa: {
    authority: "Department of Animal Resources", url: "https://portal.www.gov.qa",
    intro: {
      en: "Qatar is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an export veterinary health certificate from the Department of Animal Resources.",
      fr: "Le Qatar est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire vétérinaire d'export du Département des ressources animales.",
      es: "Catar no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario veterinario de exportación del Departamento de Recursos Animales.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Request the export veterinary health certificate via the Hukoomi e-government service with the travel health certificate, microchip and rabies records; the exit certificate is valid 15 days from issue.",
      fr: "Demande le certificat sanitaire vétérinaire d'export via le service e-gouvernement Hukoomi avec le certificat de voyage, la puce et le carnet antirabique ; le certificat de sortie est valable 15 jours.",
      es: "Solicita el certificado sanitario veterinario de exportación a través del servicio de gobierno electrónico Hukoomi con el certificado de viaje, el microchip y el registro antirrábico; el certificado de salida es válido 15 días.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  lb: {
    authority: "Ministère de l'Agriculture", url: "https://www.agriculture.gov.lb",
    intro: {
      en: "Lebanon is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a health certificate signed and stamped by a government veterinarian of the Ministry of Agriculture.",
      fr: "Le Liban est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire signé et tamponné par un vétérinaire officiel du ministère de l'Agriculture.",
      es: "Líbano no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario firmado y sellado por un veterinario oficial del Ministerio de Agricultura.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Under the Ministry of Agriculture's veterinary quarantine rules, the travel health certificate must be signed and stamped by an official government veterinarian before departure.",
      fr: "Selon les règles de quarantaine vétérinaire du ministère de l'Agriculture, le certificat sanitaire de voyage doit être signé et tamponné par un vétérinaire officiel avant le départ.",
      es: "Según las reglas de cuarentena veterinaria del Ministerio de Agricultura, el certificado sanitario de viaje debe ser firmado y sellado por un veterinario oficial antes de salir.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  jo: {
    authority: "Ministry of Agriculture", url: "https://www.moa.gov.jo",
    intro: {
      en: "Jordan is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a health certificate endorsed by a government veterinarian of the Ministry of Agriculture.",
      fr: "La Jordanie est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat sanitaire visé par un vétérinaire officiel du ministère de l'Agriculture.",
      es: "Jordania no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado sanitario refrendado por un veterinario oficial del Ministerio de Agricultura.",
    },
    steps: [TITER, { timing: "window", text: {
      en: "The Ministry of Agriculture oversees export permits and veterinary requirements; your dog's health certificate must be endorsed by a government veterinarian before the flight.",
      fr: "Le ministère de l'Agriculture supervise les permis d'export et les exigences vétérinaires ; le certificat sanitaire de ton chien doit être visé par un vétérinaire officiel avant le vol.",
      es: "El Ministerio de Agricultura supervisa los permisos de exportación y los requisitos veterinarios; el certificado sanitario de tu perro debe ser refrendado por un veterinario oficial antes del vuelo.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  bh: {
    authority: "Animal Wealth Directorate", url: "https://www.mun.gov.bh/newportal/en",
    intro: {
      en: "Bahrain is a listed country, so no rabies titer is needed to return to the EU — but you must obtain an export permit and endorsed health certificate from the Veterinary Quarantine (Animal Wealth Directorate).",
      fr: "Bahreïn est un pays listé : pas de titrage pour rentrer dans l'UE — mais tu dois obtenir un permis d'export et un certificat sanitaire visé par la Quarantaine vétérinaire (Direction de la richesse animale).",
      es: "Baréin es un país listado: no hace falta titulación para volver a la UE — pero debes obtener un permiso de exportación y un certificado sanitario refrendado por la Cuarentena Veterinaria (Dirección de Riqueza Animal).",
    },
    steps: [{ timing: "window", text: {
      en: "Contact the Veterinary Quarantine Department before travel to obtain the export permit and the endorsed original health certificate for your dog.",
      fr: "Contacte le service de Quarantaine vétérinaire avant le voyage pour obtenir le permis d'export et le certificat sanitaire original visé pour ton chien.",
      es: "Contacta con el Departamento de Cuarentena Veterinaria antes del viaje para obtener el permiso de exportación y el certificado sanitario original refrendado para tu perro.",
    } }],
    onSiteNote: ONSITE_10D,
  },

  // ---- Asia (batch 2) ----
  my: {
    authority: "DVS", url: "https://www.dvs.gov.my/",
    intro: {
      en: "Malaysia is a listed country, so no rabies titer is needed to return to the EU — the Department of Veterinary Services (DVS) issues the export veterinary health certificate.",
      fr: "La Malaisie est un pays listé : pas de titrage pour rentrer dans l'UE — le Département des services vétérinaires (DVS) délivre le certificat sanitaire vétérinaire d'export.",
      es: "Malasia es un país listado: no hace falta titulación para volver a la UE — el Departamento de Servicios Veterinarios (DVS) emite el certificado sanitario veterinario de exportación.",
    },
    steps: [{ timing: "window", text: {
      en: "Apply for the veterinary health certificate and export permit online through the DVS e-Permit / MAQIS system; DVS advises applying at least a week before travel (permit valid 30 days).",
      fr: "Demande le certificat sanitaire vétérinaire et le permis d'export en ligne via le système e-Permit / MAQIS du DVS ; le DVS conseille de s'y prendre au moins une semaine avant (permis valable 30 jours).",
      es: "Solicita el certificado sanitario veterinario y el permiso de exportación en línea a través del sistema e-Permit / MAQIS del DVS; el DVS recomienda hacerlo al menos una semana antes (permiso válido 30 días).",
    } }],
    onSiteNote: {
      en: "A licensed vet completes the EU health certificate; the DVS endorsement is the official step — allow a few working days.",
      fr: "Un vétérinaire agréé remplit le certificat sanitaire UE ; l'endossement DVS est l'étape officielle — prévois quelques jours ouvrés.",
      es: "Un veterinario autorizado rellena el certificado sanitario UE; el refrendo del DVS es el paso oficial — prevé unos días hábiles.",
    },
  },
  hk: {
    authority: "AFCD", url: "https://www.afcd.gov.hk/english/quarantine/qua_ie/qua_ie_eapao/qua_ie_eapao_ioahc/qua_ie_eapao_ioahc_eu_uk.html",
    intro: {
      en: "Hong Kong is a listed country, so no rabies titer is needed to return to the EU — the AFCD officially certifies the EU-format health documentation for your dog.",
      fr: "Hong Kong est un pays listé : pas de titrage pour rentrer dans l'UE — l'AFCD certifie officiellement les documents sanitaires au format UE pour ton chien.",
      es: "Hong Kong es un país listado: no hace falta titulación para volver a la UE — el AFCD certifica oficialmente la documentación sanitaria en formato UE para tu perro.",
    },
    steps: [{ timing: "window", text: {
      en: "The dog must be microchipped, rabies-vaccinated (at least 21 days after the primary shot) and examined by an approved vet; the AFCD then officially endorses the EU-format certificate, valid 10 days in the EU.",
      fr: "Le chien doit être pucé, vacciné contre la rage (au moins 21 jours après la primo-vaccination) et examiné par un vétérinaire agréé ; l'AFCD vise ensuite officiellement le certificat au format UE, valable 10 jours dans l'UE.",
      es: "El perro debe estar microchipado, vacunado contra la rabia (al menos 21 días tras la primovacunación) y examinado por un veterinario aprobado; luego el AFCD refrenda oficialmente el certificado en formato UE, válido 10 días en la UE.",
    } }],
    onSiteNote: {
      en: "For Finland, Ireland, Malta or Norway, dogs must be treated against tapeworm 24–120 hours before EU arrival.",
      fr: "Pour la Finlande, l'Irlande, Malte ou la Norvège, les chiens doivent être traités contre le ténia 24 à 120 h avant l'arrivée dans l'UE.",
      es: "Para Finlandia, Irlanda, Malta o Noruega, los perros deben recibir tratamiento contra la tenia 24–120 h antes de llegar a la UE.",
    },
  },
  tw: {
    authority: "APHIA", url: "https://www.aphia.gov.tw/en/ws.php?id=14261",
    intro: {
      en: "Taiwan is a listed country, so no rabies titer is needed to return to the EU — APHIA (formerly BAPHIQ) inspects your dog and issues the export certificate.",
      fr: "Taïwan est un pays listé : pas de titrage pour rentrer dans l'UE — l'APHIA (ex-BAPHIQ) inspecte ton chien et délivre le certificat d'export.",
      es: "Taiwán es un país listado: no hace falta titulación para volver a la UE — la APHIA (antes BAPHIQ) inspecciona a tu perro y emite el certificado de exportación.",
    },
    steps: [{ timing: "window", text: {
      en: "Obtain the destination's health-certificate form and file an export-quarantine application at an APHIA branch office; APHIA advises submitting it at least about a week before shipment, then inspects the dog and endorses the certificate.",
      fr: "Procure-toi le formulaire de certificat sanitaire de la destination et dépose une demande de quarantaine d'export à un bureau APHIA ; l'APHIA conseille de le faire au moins une semaine avant, puis inspecte le chien et vise le certificat.",
      es: "Consigue el formulario de certificado sanitario del destino y presenta una solicitud de cuarentena de exportación en una oficina de la APHIA; la APHIA recomienda hacerlo al menos una semana antes, luego inspecciona al perro y refrenda el certificado.",
    } }],
    onSiteNote: {
      en: "Confirm the specific EU member-state requirements too — APHIA certifies to the destination country's designated form.",
      fr: "Vérifie aussi les exigences propres à l'État membre UE de destination — l'APHIA certifie selon le formulaire désigné par le pays d'arrivée.",
      es: "Confirma también los requisitos del Estado miembro de la UE de destino — la APHIA certifica según el formulario designado por el país de llegada.",
    },
  },
  vn: {
    authority: "DAH", url: "https://cucthuy.gov.vn/en",
    intro: {
      en: "Vietnam is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an export quarantine certificate from the Department of Animal Health (DAH).",
      fr: "Le Vietnam est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat de quarantaine d'export du Département de la santé animale (DAH).",
      es: "Vietnam no está listado: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado de cuarentena de exportación del Departamento de Salud Animal (DAH).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "The DAH, through its regional sub-departments and border quarantine stations, inspects the dog and issues the export health certificate before departure.",
      fr: "Le DAH, via ses sous-directions régionales et postes de quarantaine frontaliers, inspecte le chien et délivre le certificat sanitaire d'export avant le départ.",
      es: "El DAH, a través de sus subdepartamentos regionales y estaciones de cuarentena fronteriza, inspecciona al perro y emite el certificado sanitario de exportación antes de salir.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  id: {
    authority: "Barantin", url: "https://karantinaindonesia.go.id/",
    intro: {
      en: "Indonesia is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an animal quarantine certificate from the Indonesian Quarantine Authority (Barantin).",
      fr: "L'Indonésie est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat de quarantaine animale de l'Autorité indonésienne de quarantaine (Barantin).",
      es: "Indonesia no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado de cuarentena animal de la Autoridad de Cuarentena de Indonesia (Barantin).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "Lodge a quarantine request at your local Barantin office; a quarantine veterinarian examines the dog and, if healthy, issues the animal health certificate, with the EU-model certificate officially certified before departure.",
      fr: "Dépose une demande de quarantaine à ton bureau Barantin local ; un vétérinaire de quarantaine examine le chien et, s'il est sain, délivre le certificat sanitaire, le certificat au modèle UE étant certifié officiellement avant le départ.",
      es: "Presenta una solicitud de cuarentena en tu oficina local de Barantin; un veterinario de cuarentena examina al perro y, si está sano, emite el certificado sanitario, con el certificado en modelo UE certificado oficialmente antes de salir.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  ph: {
    authority: "BAI", url: "https://www.bai.gov.ph/",
    intro: {
      en: "The Philippines is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus an export permit and international veterinary health certificate (EP/IVHC) from the Bureau of Animal Industry (BAI).",
      fr: "Les Philippines sont un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un permis d'export et un certificat sanitaire vétérinaire international (EP/IVHC) du Bureau de l'industrie animale (BAI).",
      es: "Filipinas no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un permiso de exportación y un certificado sanitario veterinario internacional (EP/IVHC) del Buró de Industria Animal (BAI).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "The BAI issues the export permit / international veterinary health certificate (EP/IVHC) within 10 days before departure — apply to the BAI as the official veterinary authority.",
      fr: "Le BAI délivre le permis d'export / certificat sanitaire vétérinaire international (EP/IVHC) dans les 10 jours avant le départ — adresse-toi au BAI, l'autorité vétérinaire officielle.",
      es: "El BAI emite el permiso de exportación / certificado sanitario veterinario internacional (EP/IVHC) dentro de los 10 días antes de salir — dirígete al BAI, la autoridad veterinaria oficial.",
    } }],
    onSiteNote: ONSITE_TITER,
  },
  kr: {
    authority: "APQA", url: "https://www.qia.go.kr/english/html/Animal_livestock/02AnimalLivestock_007-8.jsp",
    intro: {
      en: "South Korea is non-listed, so a valid rabies antibody titer is mandatory to return to the EU — plus a government export certificate from the Animal and Plant Quarantine Agency (APQA).",
      fr: "La Corée du Sud est un pays non listé : un titrage antirabique valide est obligatoire pour rentrer dans l'UE — plus un certificat d'export officiel de l'Agence de quarantaine animale et végétale (APQA).",
      es: "Corea del Sur no está listada: una titulación antirrábica válida es obligatoria para volver a la UE — más un certificado de exportación oficial de la Agencia de Cuarentena Animal y Vegetal (APQA).",
    },
    steps: [TITER, { timing: "window", text: {
      en: "A vet completes the EU-model animal health certificate; APQA inspects the dog at export and provides the official government endorsement before departure.",
      fr: "Un vétérinaire remplit le certificat au modèle UE ; l'APQA inspecte le chien à l'export et fournit l'endossement officiel avant le départ.",
      es: "Un veterinario rellena el certificado en modelo UE; la APQA inspecciona al perro en la exportación y proporciona el refrendo oficial antes de salir.",
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
  writeFileSync(file, t.replace(m[0], `${m[1]}\n${buildExit(d)}\nhero:`));
  done++;
}
console.log(`\nBlocs exit ajoutés (lot 2) : ${done}`);
