#!/usr/bin/env node
/* Add the round-trip layer (regime + sourced exit block) to the 9 remaining pilot countries.
   Idempotent: skips a file that already has a top-level `regime:`. Inserts before `hero:`. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const C = (file, block) => ({ file: resolve(ROOT, "content/countries", file), block });

const AHC = (a, u) => a; // helper noop for readability
const BLOCKS = [
  // EU + US: regime only (no export procedure to leave).
  C("france.yml", `regime: eu\n`),
  C("es.yml", `regime: eu\n`),
  C("de.yml", `regime: eu\n`),
  C("us.yml", `regime: listed\n`),
  // UK — APHA Animal Health Certificate
  C("gb.yml", `regime: island_controlled
exit:
  authority: GOV.UK / APHA
  authorityUrl: https://www.gov.uk/taking-your-pet-abroad/getting-an-animal-health-certificate
  intro:
    en: "Leaving the UK for the EU, your dog needs an Animal Health Certificate (AHC) from an APHA-authorised Official Veterinarian — the GB pet passport is no longer valid for the EU."
    fr: "Pour sortir du Royaume-Uni vers l'UE, ton chien a besoin d'un Animal Health Certificate (AHC) établi par un vétérinaire officiel agréé APHA — le passeport britannique n'est plus valable pour l'UE."
    es: "Para salir del Reino Unido hacia la UE, tu perro necesita un Animal Health Certificate (AHC) de un veterinario oficial autorizado por APHA — el pasaporte británico ya no es válido para la UE."
  steps:
    - timing: window
      text:
        en: "See an APHA Official Veterinarian to get the AHC — valid for 10 days of travel."
        fr: "Consulte un vétérinaire officiel agréé APHA pour obtenir l'AHC — valable 10 jours pour voyager."
        es: "Acude a un veterinario oficial autorizado por APHA para obtener el AHC — válido 10 días para viajar."
    - timing: before
      text:
        en: "Travel via an approved route/operator, microchip and rabies vaccination up to date."
        fr: "Voyage par une voie/opérateur agréé, puce et vaccin antirabique à jour."
        es: "Viaja por una vía/operador autorizado, con microchip y vacuna antirrábica al día."
  onSiteNote:
    en: "Book the vet during your stay — a new AHC is needed for each trip."
    fr: "Prends rendez-vous chez le vétérinaire pendant ton séjour — un nouvel AHC est requis à chaque voyage."
    es: "Reserva el veterinario durante tu estancia — se necesita un AHC nuevo para cada viaje."
`),
  // Morocco — ONSSA export certificate
  C("ma.yml", `regime: non_listed
exit:
  authority: ONSSA
  authorityUrl: https://www.onssa.gov.ma/import-and-export-controls/export-certification/export-of-live-animals/dogs-and-cats/?lang=en
  intro:
    en: "Leaving Morocco with your dog needs an official export health certificate (ONSSA model) signed by an official veterinarian."
    fr: "Sortir du Maroc avec ton chien demande un certificat sanitaire d'export officiel (modèle ONSSA) signé par un vétérinaire officiel."
    es: "Salir de Marruecos con tu perro requiere un certificado sanitario de exportación oficial (modelo ONSSA) firmado por un veterinario oficial."
  steps:
    - timing: window
      text:
        en: "Have an official veterinarian issue the ONSSA export health certificate shortly before departure."
        fr: "Fais établir le certificat sanitaire d'export ONSSA par un vétérinaire officiel peu avant le départ."
        es: "Haz que un veterinario oficial emita el certificado sanitario de exportación de ONSSA poco antes de la salida."
  onSiteNote:
    en: "Morocco is a non-listed country: the EU-return rabies titer is the real trap — do it in the EU BEFORE you leave to avoid a 3-month wait."
    fr: "Le Maroc est un pays non listé : le titrage antirabique du retour UE est le vrai piège — réalise-le dans l'UE AVANT de partir pour éviter les 3 mois d'attente."
    es: "Marruecos es un país no listado: la titulación antirrábica del regreso a la UE es la verdadera trampa — hazla en la UE ANTES de salir para evitar la espera de 3 meses."
`),
  // Australia — DAFF endorsement
  C("au.yml", `regime: island_strict
exit:
  authority: DAFF (Australie)
  authorityUrl: https://micor.agriculture.gov.au/live-animals/Pages/european_union/dogs.aspx
  intro:
    en: "Leaving Australia with your dog, the export health certificate must be endorsed by the Department of Agriculture (DAFF) through an accredited veterinarian."
    fr: "Pour sortir d'Australie avec ton chien, le certificat sanitaire d'export doit être endossé par le Department of Agriculture (DAFF) via un vétérinaire accrédité."
    es: "Para salir de Australia con tu perro, el certificado sanitario de exportación debe ser validado por el Department of Agriculture (DAFF) a través de un veterinario acreditado."
  steps:
    - timing: window
      text:
        en: "An accredited vet prepares the EU health certificate; DAFF officers endorse it before departure."
        fr: "Un vétérinaire accrédité prépare le certificat sanitaire UE ; les agents du DAFF l'endossent avant le départ."
        es: "Un veterinario acreditado prepara el certificado sanitario de la UE; los agentes del DAFF lo validan antes de la salida."
  onSiteNote:
    en: "Start well ahead — endorsement and supporting documents take time."
    fr: "Lance la démarche bien à l'avance — l'endossement et les documents justificatifs prennent du temps."
    es: "Inicia el trámite con mucha antelación — la validación y los documentos justificativos llevan tiempo."
`),
  // New Zealand — MPI export certificate
  C("nz.yml", `regime: island_strict
exit:
  authority: MPI (Nouvelle-Zélande)
  authorityUrl: https://www.mpi.govt.nz/take-or-send-from-nz/pets-leaving-nz/information-for-vets
  intro:
    en: "Leaving New Zealand with your dog needs an export certificate from an MPI Official Veterinarian (plus an Animal Welfare Export Certificate for flights over 6 hours)."
    fr: "Sortir de Nouvelle-Zélande avec ton chien demande un certificat d'export d'un vétérinaire officiel du MPI (plus un Animal Welfare Export Certificate pour les vols de plus de 6 heures)."
    es: "Salir de Nueva Zelanda con tu perro requiere un certificado de exportación de un veterinario oficial del MPI (más un Animal Welfare Export Certificate para vuelos de más de 6 horas)."
  steps:
    - timing: window
      text:
        en: "Only certain MPI-authorised vets can sign the export certificate; requirements follow the destination's OMAR."
        fr: "Seuls certains vétérinaires agréés MPI peuvent signer le certificat d'export ; les exigences suivent l'OMAR de la destination."
        es: "Solo ciertos veterinarios autorizados por MPI pueden firmar el certificado de exportación; los requisitos siguen el OMAR del destino."
  onSiteNote:
    en: "Plan with an MPI-authorised vet during your stay; long-haul flights add an animal-welfare certificate."
    fr: "Prévois avec un vétérinaire agréé MPI pendant ton séjour ; les vols long-courriers ajoutent un certificat de bien-être animal."
    es: "Planifica con un veterinario autorizado por MPI durante tu estancia; los vuelos de larga distancia añaden un certificado de bienestar animal."
`),
  // Japan — AQS export quarantine certificate
  C("jp.yml", `regime: island_strict
exit:
  authority: AQS (Japon)
  authorityUrl: https://www.maff.go.jp/aqs/english/animal/dog/export.html
  intro:
    en: "Leaving Japan with your dog needs an export quarantine certificate from the Animal Quarantine Service (AQS) — apply at least 10 days ahead."
    fr: "Sortir du Japon avec ton chien demande un certificat de quarantaine d'export de l'Animal Quarantine Service (AQS) — dépose la demande au moins 10 jours avant."
    es: "Salir de Japón con tu perro requiere un certificado de cuarentena de exportación del Animal Quarantine Service (AQS) — solicítalo al menos 10 días antes."
  steps:
    - timing: before
      text:
        en: "Apply for export inspection to the AQS at least 10 days before, with the destination's entry documents attached."
        fr: "Demande l'inspection d'export à l'AQS au moins 10 jours avant, avec les documents d'entrée de la destination joints."
        es: "Solicita la inspección de exportación al AQS al menos 10 días antes, adjuntando los documentos de entrada del destino."
    - timing: window
      text:
        en: "On departure day, the airport AQS office inspects the dog and issues the English export certificate (about 30–60 minutes)."
        fr: "Le jour du départ, le bureau AQS de l'aéroport inspecte le chien et délivre le certificat d'export en anglais (environ 30 à 60 minutes)."
        es: "El día de salida, la oficina del AQS del aeropuerto inspecciona al perro y emite el certificado de exportación en inglés (unos 30–60 minutos)."
  onSiteNote:
    en: "An ISO microchip is required; airport AQS offices operate 8:30–16:30."
    fr: "Une puce ISO est exigée ; les bureaux AQS des aéroports ouvrent de 8h30 à 16h30."
    es: "Se requiere un microchip ISO; las oficinas del AQS en los aeropuertos abren de 8:30 a 16:30."
`),
];

let done = 0;
for (const { file, block } of BLOCKS) {
  const t = readFileSync(file, "utf8");
  if (/^regime:/m.test(t)) { console.log("skip (déjà fait):", file.split("/").pop()); continue; }
  const idx = t.indexOf("\nhero:");
  if (idx < 0) { console.log("!! pas de 'hero:' dans", file); continue; }
  const out = t.slice(0, idx) + "\n\n" + block + t.slice(idx);
  writeFileSync(file, out);
  done++;
}
console.log(`Ajouté le bloc aller-retour à ${done} fiches.`);
