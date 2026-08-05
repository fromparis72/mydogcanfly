#!/usr/bin/env node
/* Les 22 fiches dont TOUTES les étapes de sortie parlaient du certificat européen.
 *
 * L'étiquetage précédent (exit-scope.mjs) a sauvé 80 étapes sur 180 : celles qui décrivent la
 * machinerie d'export du pays sans nommer l'Europe. 76 fiches sur 98 gardent ainsi du contenu
 * réel à l'étape 1 quelle que soit la destination. Restaient 22 fiches où chaque étape était
 * européenne, et dont l'étape 1 se réduisait à la phrase générique et au lien vers l'autorité.
 *
 * CE QUE CE SCRIPT AJOUTE — ET CE QU'IL N'AJOUTE PAS. Chaque fiche reçoit UNE étape marquée
 * `scope: non_eu`, qui est l'étape européenne existante MOINS sa mention de l'Europe. Rien d'autre.
 *
 *   avant  « Fais remplir le certificat sanitaire UE par un vétérinaire agréé USDA, puis fais-le
 *            endosser par l'USDA APHIS (soumis via VEHCS, puis signé à l'encre et embossé). »
 *   après  « Fais remplir le certificat sanitaire exigé par la destination par un vétérinaire
 *            agréé USDA, puis fais-le endosser par l'USDA APHIS (soumis via VEHCS, puis signé
 *            à l'encre et embossé). »
 *
 * Le mécanisme — qui examine, qui signe, par quel portail, en combien de jours — était déjà écrit
 * dans la fiche et repose sur la source qu'elle cite. Seul l'OBJET était européen. Généraliser
 * revient donc à retirer une restriction, jamais à ajouter une affirmation : c'est ce qui permet
 * de le faire sur 22 pays sans rouvrir 22 dossiers d'autorité vétérinaire.
 *
 * Trois exceptions au principe, et elles sont volontaires. Les onze étapes « anticipe le titrage
 * antirabique en laboratoire agréé UE » n'ont PAS d'équivalent neutre : le titrage est une
 * exigence de la DESTINATION, pas une formalité du pays de départ. Sa place est à l'étape 2, où
 * elle figure déjà. On ne la généralise pas, on la laisse tomber.
 *
 * `scope: non_eu` plutôt qu'un remplacement : l'étape européenne reste intacte et continue de
 * s'afficher vers l'UE, avec sa précision de modèle et sa fenêtre de validité. Aucune régression
 * possible sur le trajet le plus fréquenté du site.
 *
 * Rejouable : une fiche qui porte déjà une étape `non_eu` est laissée intacte.
 *
 *   node packages/knowledge/scripts/exit-non-eu.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

const ETAPES = {
  al: {
    en: "The animal health certificate is completed and signed by an AKU official veterinarian shortly before the flight.",
    fr: "Le certificat sanitaire est rempli et signé par un vétérinaire officiel de l'AKU peu avant le vol.",
    es: "El certificado sanitario lo completa y firma un veterinario oficial de la AKU poco antes del vuelo.",
    pt: "O certificado sanitário é preenchido e assinado por um veterinário oficial da AKU pouco antes do voo.",
  },
  ar: {
    en: "A private vet handles the microchip, rabies vaccination and health certificate; present them at a SENASA office, which issues the CVI (valid 10 days).",
    fr: "Un vétérinaire privé s'occupe de la puce, du vaccin antirabique et du certificat sanitaire ; présente-les dans un bureau SENASA, qui délivre le CVI (valable 10 jours).",
    es: "Un veterinario privado se encarga del microchip, la vacuna antirrábica y el certificado sanitario; preséntalos en una oficina del SENASA, que emite el CVI (válido 10 días).",
    pt: "Um veterinário particular cuida do microchip, da vacina antirrábica e do atestado sanitário; apresente-os em um escritório do SENASA, que emite o CVI (válido por 10 dias).",
  },
  au: {
    en: "An accredited vet prepares the health certificate required by the destination; DAFF officers endorse it before departure.",
    fr: "Un vétérinaire accrédité prépare le certificat sanitaire exigé par la destination ; les agents du DAFF le visent avant le départ.",
    es: "Un veterinario acreditado prepara el certificado sanitario que exige el destino; los agentes del DAFF lo validan antes de la salida.",
    pt: "Um veterinário credenciado prepara o certificado sanitário exigido pelo destino; os agentes do DAFF o endossam antes da partida.",
  },
  ba: {
    en: "With a microchip and a valid rabies vaccination, the animal health certificate is completed and issued by an official government veterinarian before departure.",
    fr: "Avec une puce et une vaccination antirabique valide, le certificat sanitaire est rempli et délivré par un vétérinaire officiel de l'État avant le départ.",
    es: "Con microchip y vacunación antirrábica válida, el certificado sanitario lo completa y expide un veterinario oficial del Estado antes de la salida.",
    pt: "Com microchip e vacinação antirrábica válida, o certificado sanitário é preenchido e emitido por um veterinário oficial do Estado antes da partida.",
  },
  ca: {
    en: "A licensed vet completes and signs the health certificate required by the destination; book an appointment to have it endorsed by a CFIA Animal Health Office before departure — CFIA cannot endorse it once the dog has left.",
    fr: "Un vétérinaire agréé remplit et signe le certificat sanitaire exigé par la destination ; prends rendez-vous pour le faire viser par un bureau de santé animale de l'ACIA avant le départ — l'ACIA ne peut plus le viser une fois le chien parti.",
    es: "Un veterinario autorizado completa y firma el certificado sanitario que exige el destino; pide cita para que lo valide una oficina de sanidad animal de la CFIA antes de salir — la CFIA no puede validarlo una vez que el perro se ha ido.",
    pt: "Um veterinário licenciado preenche e assina o certificado sanitário exigido pelo destino; agende o endosso em um escritório de saúde animal da CFIA antes da partida — a CFIA não pode endossá-lo depois que o cachorro sai.",
  },
  do: {
    en: "A private vet does the pre-export check; the certificate is signed by the veterinary college (COLVET) where required, then submitted to DIGEGA for validation and official signature.",
    fr: "Un vétérinaire privé fait le contrôle pré-export ; le certificat est signé par le collège vétérinaire (COLVET) quand c'est exigé, puis soumis à la DIGEGA pour validation et signature officielle.",
    es: "Un veterinario privado hace el control previo a la exportación; el certificado lo firma el colegio veterinario (COLVET) cuando se exige, y luego se presenta a DIGEGA para su validación y firma oficial.",
    pt: "Um veterinário particular faz a checagem pré-exportação; o certificado é assinado pelo conselho veterinário (COLVET) quando exigido e depois enviado à DIGEGA para validação e assinatura oficial.",
  },
  ec: {
    en: "A registered vet submits the request at least 72 hours before travel; an AGROCALIDAD official signs and stamps the export certificate (valid 10 days).",
    fr: "Un vétérinaire enregistré dépose la demande au moins 72 heures avant le départ ; un agent d'AGROCALIDAD signe et tamponne le certificat d'export (valable 10 jours).",
    es: "Un veterinario registrado presenta la solicitud al menos 72 horas antes del viaje; un funcionario de AGROCALIDAD firma y sella el certificado de exportación (válido 10 días).",
    pt: "Um veterinário registrado envia o pedido pelo menos 72 horas antes da viagem; um agente da AGROCALIDAD assina e carimba o certificado de exportação (válido por 10 dias).",
  },
  eg: {
    en: "GOVS veterinary quarantine endorses the health certificate at the port before departure — a private-vet certificate alone is not enough.",
    fr: "La quarantaine vétérinaire du GOVS vise le certificat sanitaire au port avant le départ — un certificat de vétérinaire privé seul ne suffit pas.",
    es: "La cuarentena veterinaria del GOVS valida el certificado sanitario en el puerto antes de la salida — un certificado de veterinario privado por sí solo no basta.",
    pt: "A quarentena veterinária do GOVS endossa o certificado sanitário no porto antes da partida — só o certificado de um veterinário particular não basta.",
  },
  hk: {
    en: "The dog must be microchipped, rabies-vaccinated (at least 21 days after the primary shot) and examined by an approved vet; the AFCD then officially endorses the export certificate.",
    fr: "Le chien doit être pucé, vacciné contre la rage (au moins 21 jours après la primo-injection) et examiné par un vétérinaire agréé ; l'AFCD vise ensuite officiellement le certificat d'export.",
    es: "El perro debe tener microchip, vacuna antirrábica (al menos 21 días después de la primera dosis) y un examen de un veterinario autorizado; luego el AFCD valida oficialmente el certificado de exportación.",
    pt: "O cachorro precisa de microchip, vacinação antirrábica (no mínimo 21 dias após a primeira dose) e exame por um veterinário credenciado; depois o AFCD endossa oficialmente o certificado de exportação.",
  },
  hn: {
    en: "Register on SENASA's online export platform (SECEH) and submit the export certificate request; SENASA reviews, approves and issues it.",
    fr: "Inscris-toi sur la plateforme d'export en ligne du SENASA (SECEH) et dépose la demande de certificat d'export ; le SENASA l'examine, l'approuve et le délivre.",
    es: "Regístrate en la plataforma de exportación en línea del SENASA (SECEH) y presenta la solicitud del certificado de exportación; el SENASA la revisa, la aprueba y lo emite.",
    pt: "Cadastre-se na plataforma de exportação on-line do SENASA (SECEH) e envie o pedido do certificado de exportação; o SENASA analisa, aprova e emite.",
  },
  id: {
    en: "Lodge a quarantine request at your local Barantin office; a quarantine veterinarian examines the dog and, if healthy, issues the animal health certificate.",
    fr: "Dépose une demande de quarantaine au bureau Barantin local ; un vétérinaire de quarantaine examine le chien et, s'il est en bonne santé, délivre le certificat sanitaire.",
    es: "Presenta una solicitud de cuarentena en la oficina local de Barantin; un veterinario de cuarentena examina al perro y, si está sano, expide el certificado sanitario.",
    pt: "Protocole um pedido de quarentena no escritório local do Barantin; um veterinário de quarentena examina o cachorro e, se estiver saudável, emite o certificado sanitário.",
  },
  kr: {
    en: "A vet completes the health certificate required by the destination; APQA inspects the dog at export and provides the official government endorsement before departure.",
    fr: "Un vétérinaire remplit le certificat sanitaire exigé par la destination ; l'APQA inspecte le chien à l'export et appose le visa officiel avant le départ.",
    es: "Un veterinario completa el certificado sanitario que exige el destino; la APQA inspecciona al perro en la exportación y añade el visado oficial antes de la salida.",
    pt: "Um veterinário preenche o certificado sanitário exigido pelo destino; a APQA inspeciona o cachorro na exportação e faz o endosso oficial antes da partida.",
  },
  me: {
    en: "With a microchip and a valid rabies vaccination, the health certificate is issued and endorsed by the UBHVFP veterinary inspection before departure.",
    fr: "Avec une puce et une vaccination antirabique valide, le certificat sanitaire est délivré et visé par l'inspection vétérinaire de l'UBHVFP avant le départ.",
    es: "Con microchip y vacunación antirrábica válida, el certificado sanitario lo expide y valida la inspección veterinaria de la UBHVFP antes de la salida.",
    pt: "Com microchip e vacinação antirrábica válida, o certificado sanitário é emitido e endossado pela inspeção veterinária da UBHVFP antes da partida.",
  },
  mk: {
    en: "Your dog needs a microchip and a valid rabies vaccination; an FVA authorised veterinarian completes and endorses the health certificate before departure.",
    fr: "Ton chien a besoin d'une puce et d'une vaccination antirabique valide ; un vétérinaire habilité par la FVA remplit et vise le certificat sanitaire avant le départ.",
    es: "Tu perro necesita microchip y vacunación antirrábica válida; un veterinario autorizado por la FVA completa y valida el certificado sanitario antes de la salida.",
    pt: "Seu cachorro precisa de microchip e vacinação antirrábica válida; um veterinário autorizado pela FVA preenche e endossa o certificado sanitário antes da partida.",
  },
  mu: {
    en: "The DVS issues the international veterinary certificate after inspecting the dog and checking its health; request it before departure.",
    fr: "Le DVS délivre le certificat vétérinaire international après inspection du chien et contrôle sanitaire ; demande-le avant le départ.",
    es: "El DVS expide el certificado veterinario internacional tras inspeccionar al perro y comprobar su salud; solicítalo antes de la salida.",
    pt: "O DVS emite o certificado veterinário internacional após inspecionar o cachorro e verificar sua saúde; solicite antes da partida.",
  },
  rs: {
    en: "Your dog needs a microchip and a valid rabies vaccination (at least 21 days after the primary shot); the health certificate is completed and endorsed by an official veterinarian of the Veterinary Directorate before departure.",
    fr: "Ton chien a besoin d'une puce et d'une vaccination antirabique valide (au moins 21 jours après la primo-injection) ; le certificat sanitaire est rempli et visé par un vétérinaire officiel de la Direction vétérinaire avant le départ.",
    es: "Tu perro necesita microchip y vacunación antirrábica válida (al menos 21 días después de la primera dosis); el certificado sanitario lo completa y valida un veterinario oficial de la Dirección Veterinaria antes de la salida.",
    pt: "Seu cachorro precisa de microchip e vacinação antirrábica válida (no mínimo 21 dias após a primeira dose); o certificado sanitário é preenchido e endossado por um veterinário oficial da Direção Veterinária antes da partida.",
  },
  sv: {
    en: "MAG (Quarantine Division) issues the export zoosanitary certificate from a vet's health certificate dated within 15 days, 3–5 working days before travel.",
    fr: "Le MAG (division Quarantaine) délivre le certificat zoosanitaire d'export à partir d'un certificat vétérinaire de moins de 15 jours, 3 à 5 jours ouvrés avant le voyage.",
    es: "El MAG (División de Cuarentena) expide el certificado zoosanitario de exportación a partir de un certificado veterinario de menos de 15 días, 3–5 días hábiles antes del viaje.",
    pt: "O MAG (Divisão de Quarentena) emite o certificado zoossanitário de exportação a partir de um atestado veterinário com até 15 dias, de 3 a 5 dias úteis antes da viagem.",
  },
  th: {
    en: "Apply to the DLD for the export licence and health certificate, with the pre-export inspection done at the airport 48 hours before departure.",
    fr: "Demande au DLD la licence d'export et le certificat sanitaire, avec l'inspection pré-export faite à l'aéroport 48 heures avant le départ.",
    es: "Solicita al DLD la licencia de exportación y el certificado sanitario, con la inspección previa hecha en el aeropuerto 48 horas antes de la salida.",
    pt: "Solicite ao DLD a licença de exportação e o certificado sanitário, com a inspeção pré-embarque feita no aeroporto 48 horas antes da partida.",
  },
  us: {
    en: "Have a USDA-accredited vet complete the health certificate required by the destination, then get it endorsed by USDA APHIS (submitted via VEHCS, then ink-signed and embossed).",
    fr: "Fais remplir le certificat sanitaire exigé par la destination par un vétérinaire agréé USDA, puis fais-le endosser par l'USDA APHIS (soumis via VEHCS, puis signé à l'encre et embossé).",
    es: "Haz que un veterinario acreditado por el USDA complete el certificado sanitario que exige el destino y luego consigue el visado del USDA APHIS (enviado por VEHCS, después firmado en tinta y con sello en relieve).",
    pt: "Peça a um veterinário credenciado pelo USDA que preencha o certificado sanitário exigido pelo destino e depois obtenha o endosso do USDA APHIS (enviado pelo VEHCS, depois assinado a tinta e com selo em relevo).",
  },
  ve: {
    en: "INSAI issues the export inspection certificate with the current rabies and deworming records.",
    fr: "L'INSAI délivre le certificat d'inspection à l'export avec les registres à jour de vaccination antirabique et de vermifugation.",
    es: "El INSAI expide el certificado de inspección de exportación con los registros vigentes de vacunación antirrábica y desparasitación.",
    pt: "O INSAI emite o certificado de inspeção de exportação com os registros atualizados de vacinação antirrábica e vermifugação.",
  },
  xk: {
    en: "The animal health certificate is issued and signed by an AUV official veterinarian before departure.",
    fr: "Le certificat sanitaire est délivré et signé par un vétérinaire officiel de l'AUV avant le départ.",
    es: "El certificado sanitario lo expide y firma un veterinario oficial de la AUV antes de la salida.",
    pt: "O certificado sanitário é emitido e assinado por um veterinário oficial da AUV antes da partida.",
  },
  za: {
    en: "Apply to DALRRD for the export permit; a State Veterinarian endorses the health certificate confirming the dog is fit to travel.",
    fr: "Demande le permis d'export au DALRRD ; un vétérinaire d'État vise le certificat sanitaire attestant que le chien est apte au voyage.",
    es: "Solicita el permiso de exportación al DALRRD; un veterinario estatal valida el certificado sanitario que confirma que el perro está apto para viajar.",
    pt: "Solicite a licença de exportação ao DALRRD; um veterinário estadual endossa o certificado sanitário confirmando que o cachorro está apto a viajar.",
  },
};

/** Échappement YAML minimal : nos textes sont entre guillemets doubles et n'en contiennent pas. */
const q = (s) => { if (s.includes('"')) throw new Error(`guillemet double interdit : ${s}`); return `"${s}"`; };

let ajoutees = 0, deja = 0;

for (const [c, txt] of Object.entries(ETAPES)) {
  const chemin = join(SRC, `${c}.yml`);
  const texte = readFileSync(chemin, "utf-8");
  const g = YAML.parse(texte);
  const pas = g?.exit?.steps;
  if (!pas?.length) { console.error(`✗ ${c}.yml — pas d'étapes de sortie`); process.exitCode = 1; continue; }
  if (pas.some((s) => s.scope === "non_eu")) { deja++; continue; }

  const lignes = texte.split("\n");
  /* Même ancrage que partout : on part de `exit:`, puis de `steps:`, et on s'arrête à la première
   * ligne qui quitte l'indentation de la liste. C'est la fin du bloc, donc le point d'insertion. */
  const iExit = lignes.findIndex((l) => /^exit:\s*$/.test(l));
  const relSteps = iExit < 0 ? -1 : lignes.slice(iExit + 1).findIndex((l) => /^\s{2}steps:\s*$/.test(l));
  if (iExit < 0 || relSteps < 0) { console.error(`✗ ${c}.yml — bloc exit/steps introuvable`); process.exitCode = 1; continue; }
  const iSteps = iExit + 1 + relSteps;

  let fin = lignes.length;
  for (let i = iSteps + 1; i < lignes.length; i++) {
    if (lignes[i].trim() === "") continue;
    if (!/^\s{4}/.test(lignes[i])) { fin = i; break; }
  }

  const bloc = [
    "    - timing: window",
    "      scope: non_eu",
    "      text:",
    ...["en", "fr", "es", "pt"].map((l) => `        ${l}: ${q(txt[l])}`),
  ];
  lignes.splice(fin, 0, ...bloc);
  if (!dry) writeFileSync(chemin, lignes.join("\n"));
  ajoutees++;
}

console.log(`${ajoutees} étape(s) « non_eu » ajoutée(s)${deja ? `, ${deja} déjà présente(s)` : ""}${dry ? " — essai à blanc" : ""}`);
