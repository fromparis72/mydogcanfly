#!/usr/bin/env node
/* Generate V3 airline guides (EN+FR) for the wave-1 airlines, matching the existing template.
   Prose is generic/original; all figures come from {{fait:}} markers resolved at ingest from the KB. */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../content/hub/drafts/airline_guide");
mkdirSync(DIR, { recursive: true });

const A = [
  { id: "airline_el_al", slug: "el-al", name: "EL AL", mode: "full", src: "https://www.elal.com",
    hub: ["Tel Aviv Ben Gurion (TLV)", "Tel Aviv Ben Gourion (TLV)"], country: ["Israel", "Israël"],
    desc: ["the national airline of Israel", "la compagnie nationale d'Israël"],
    region: ["Europe, North America and Asia", "l'Europe, l'Amérique du Nord et l'Asie"] },
  { id: "airline_air_china", slug: "air-china", name: "Air China", mode: "hold", src: "https://www.airchina.com",
    hub: ["Beijing (PEK)", "Pékin (PEK)"], country: ["China", "Chine"],
    desc: ["the flag carrier of China and a Star Alliance member", "le transporteur national chinois, membre de Star Alliance"],
    region: ["Asia, Europe, North America and Oceania", "l'Asie, l'Europe, l'Amérique du Nord et l'Océanie"] },
  { id: "airline_china_southern", slug: "china-southern", name: "China Southern Airlines", mode: "hold", src: "https://www.csair.com",
    hub: ["Guangzhou (CAN)", "Canton (CAN)"], country: ["China", "Chine"],
    desc: ["one of China's 'big three' carriers and the largest airline in Asia by fleet", "l'une des « trois grandes » compagnies chinoises et la plus grande d'Asie par la flotte"],
    region: ["Asia, Oceania, Europe and the Americas", "l'Asie, l'Océanie, l'Europe et les Amériques"] },
  { id: "airline_china_eastern", slug: "china-eastern", name: "China Eastern Airlines", mode: "hold", src: "https://www.ceair.com",
    hub: ["Shanghai (PVG)", "Shanghai (PVG)"], country: ["China", "Chine"],
    desc: ["one of China's 'big three' carriers and a SkyTeam member", "l'une des « trois grandes » compagnies chinoises, membre de SkyTeam"],
    region: ["Asia, Europe, North America and Oceania", "l'Asie, l'Europe, l'Amérique du Nord et l'Océanie"] },
  { id: "airline_indigo", slug: "indigo", name: "IndiGo", mode: "none", src: "https://www.goindigo.in",
    hub: ["Delhi (DEL)", "Delhi (DEL)"], country: ["India", "Inde"],
    desc: ["India's largest airline", "la première compagnie aérienne indienne"],
    region: ["India, the Middle East and Asia", "l'Inde, le Moyen-Orient et l'Asie"] },
  { id: "airline_air_new_zealand", slug: "air-new-zealand", name: "Air New Zealand", mode: "hold", src: "https://www.airnewzealand.com",
    hub: ["Auckland (AKL)", "Auckland (AKL)"], country: ["New Zealand", "Nouvelle-Zélande"],
    desc: ["the flag carrier of New Zealand and a Star Alliance member", "le transporteur national néo-zélandais, membre de Star Alliance"],
    region: ["the Pacific, Australia, Asia and North America", "le Pacifique, l'Australie, l'Asie et l'Amérique du Nord"] },
  { id: "airline_aer_lingus", slug: "aer-lingus", name: "Aer Lingus", mode: "cargo", src: "https://www.aerlingus.com",
    hub: ["Dublin (DUB)", "Dublin (DUB)"], country: ["Ireland", "Irlande"],
    desc: ["the flag carrier of Ireland", "la compagnie nationale irlandaise"],
    region: ["Europe and North America", "l'Europe et l'Amérique du Nord"] },
  { id: "airline_malaysia_airlines", slug: "malaysia-airlines", name: "Malaysia Airlines", mode: "hold", src: "https://www.malaysiaairlines.com",
    hub: ["Kuala Lumpur (KUL)", "Kuala Lumpur (KUL)"], country: ["Malaysia", "Malaisie"],
    desc: ["the flag carrier of Malaysia and a oneworld member", "le transporteur national malaisien, membre de oneworld"],
    region: ["Southeast Asia, Asia, the Middle East and Oceania", "l'Asie du Sud-Est, l'Asie, le Moyen-Orient et l'Océanie"] },
  { id: "airline_garuda_indonesia", slug: "garuda-indonesia", name: "Garuda Indonesia", mode: "hold", src: "https://www.garuda-indonesia.com",
    hub: ["Jakarta (CGK)", "Jakarta (CGK)"], country: ["Indonesia", "Indonésie"],
    desc: ["the flag carrier of Indonesia and a SkyTeam member", "le transporteur national indonésien, membre de SkyTeam"],
    region: ["Indonesia, Asia, the Middle East and Oceania", "l'Indonésie, l'Asie, le Moyen-Orient et l'Océanie"] },
];

const petLine = {
  full: ["accepts companion dogs both in the passenger cabin (small dogs) and in the aircraft's climate-controlled hold, with cargo for larger animals",
         "accepte les chiens en cabine (petits gabarits) comme en soute climatisée, et en fret pour les plus grands"],
  hold: ["carries companion dogs in the aircraft's climate-controlled hold, or as cargo for larger animals; only recognised assistance dogs are accepted in the passenger cabin",
         "transporte les chiens en soute climatisée, ou en fret pour les plus grands ; seuls les chiens d'assistance reconnus sont admis en cabine"],
  cargo: ["carries pets as cargo through its cargo service; only recognised assistance dogs travel in the passenger cabin",
          "transporte les animaux en fret via son service cargo ; seuls les chiens d'assistance reconnus voyagent en cabine"],
  none: ["does not carry pets in the cabin, hold or cargo — only recognised assistance dogs are accepted in the cabin, for passengers with a disability",
         "ne transporte pas d'animaux de compagnie en cabine, en soute ni en fret — seuls les chiens d'assistance reconnus sont admis en cabine, pour les personnes en situation de handicap"],
};

function guide(a, loc) {
  const i = loc === "fr" ? 1 : 0;
  const ID = a.id;
  const T = (en, fr) => (loc === "fr" ? fr : en);
  const title = T(`Flying with a Dog on ${a.name}`, `Voyager avec son chien sur ${a.name}`);
  const F = (k) => `{{fait: ${ID} \\| ${k}}}`;   // table cell (escaped pipe)
  const f = (k) => `{{fait: ${ID} | ${k}}}`;     // inline
  const good = a.mode === "none"
    ? T(`For pet travel, not really — ${a.name} does not carry companion animals. If you must travel with a dog, choose another carrier on your route. ${a.name} remains an excellent option when flying without a pet or with a recognised assistance dog.`,
        `Pour voyager avec un animal, pas vraiment — ${a.name} ne transporte pas d'animaux de compagnie. Si vous devez voyager avec un chien, choisissez une autre compagnie sur votre trajet. ${a.name} reste une excellente option sans animal ou avec un chien d'assistance reconnu.`)
    : T(`Yes, provided your destination accepts pet imports and your itinerary meets the airline's operational requirements. ${a.name} is especially relevant for journeys involving ${a.region[0]}. As always, confirm both airline approval and the destination country's veterinary rules before booking.`,
        `Oui, à condition que votre destination accepte l'importation d'animaux et que votre itinéraire respecte les exigences de la compagnie. ${a.name} est particulièrement pertinente pour les trajets impliquant ${a.region[1]}. Comme toujours, vérifiez l'accord de la compagnie et les règles vétérinaires du pays de destination avant de réserver.`);

  return `---
type: airline_guide
entity_id: ${ID}
slug: ${a.slug}
locale: ${loc}
title: "${title}"
description: "${T(`Complete guide to travelling with your dog on ${a.name}: cabin, hold, cargo, booking advice, import rules and the MyDogCanFly rating.`, `Guide complet pour voyager avec son chien sur ${a.name} : cabine, soute, fret, conseils de réservation, formalités et notation MyDogCanFly.`)}"
status: draft
author: mydogcanfly
last_reviewed: 2026-07-10
sources:
  - id: src1
    url: ${a.src}
    publisher: ${a.name}
---
# ${title}
## Overview
${a.name} is ${a.desc[i]}. From its main hub at ${a.hub[i]}, it connects ${a.country[i]} with ${a.region[i]}.
${a.name} ${petLine[a.mode][i]}.
${T("A successful journey depends on three things: the airline's transport policy, the destination country's veterinary requirements, and the operational limits of your specific route. MyDogCanFly checks all three before recommending an itinerary.", "Un voyage réussi repose sur trois éléments : la politique de transport de la compagnie, les exigences vétérinaires du pays de destination et les contraintes opérationnelles de votre itinéraire. MyDogCanFly analyse ces trois niveaux avant de recommander un trajet.")}
---
# ${T("At a glance", "En un coup d'œil")}
| ${T("Category", "Catégorie")} | ${T("Information", "Information")} |
|----------|-------------|
| ⭐ ${T("MyDogCanFly Score", "Note MyDogCanFly")} | ${F("rating_score")} / 5 |
| 📊 ${T("Score", "Score détaillé")} | ${F("rating_points")} / 100 |
| 🧭 ${T("Travel Difficulty", "Difficulté du voyage")} | ${F("travel_difficulty")} |
| ✈️ ${T("Alliance", "Alliance")} | ${F("alliance")} |
| 🌍 ${T("Network", "Réseau")} | ${F("network_coverage")} |
| 💰 ${T("Price Level", "Niveau tarifaire")} | ${F("price_level")} |
| 🏠 ${T("Main Hub", "Hub principal")} | ${F("main_hub")} |
| ✈️ ${T("Cabin", "Cabine")} | ${F("cabin_summary")} |
| 🧳 ${T("Hold", "Soute")} | ${F("hold_summary")} |
| 📦 ${T("Cargo", "Fret")} | ${F("cargo_summary")} |
| 🦮 ${T("Assistance Dogs", "Chiens d'assistance")} | ${F("assistance_summary")} |
| ⚠️ ${T("Breed Restrictions", "Restrictions de races")} | ${F("breed_summary")} |
| 👍 ${T("Best suited for", "Idéal pour")} | ${F("recommended_for")} |
| 👎 ${T("Main limitations", "Points faibles")} | ${F("drawbacks")} |
---
# ${T("Why MyDogCanFly gives", "Pourquoi MyDogCanFly attribue")} ${a.name} ${f("rating_score")}/5
## ${T("Strengths", "Points forts")}
- ${f("strength_1")}
- ${f("strength_2")}
- ${f("strength_3")}
## ${T("Limitations", "Limites")}
- ${f("limitation_1")}
- ${f("limitation_2")}
- ${f("limitation_3")}
---
# ${T(`Is ${a.name} a good choice?`, `${a.name} est-elle un bon choix ?`)}
${good}
---
# ${T("Cabin, Hold or Cargo", "Cabine, soute ou fret")}
## ${T("Cabin", "Transport en cabine")}
${f("cabin_policy")}
---
## ${T("Hold", "Transport en soute")}
${f("hold_policy")}
${T("Dogs travelling in the hold must be booked in advance and carried in an IATA-compliant kennel.", "Les chiens voyageant en soute doivent être réservés à l'avance et transportés dans une caisse conforme aux normes IATA.")}
---
## ${T("Cargo", "Transport en fret")}
${f("cargo_policy")}
---
## ${T("Assistance Dogs", "Chiens d'assistance")}
${f("assistance_policy")}
---
# ${T("Travel Difficulty", "Difficulté du voyage")}
${f("travel_difficulty")}
${f("travel_difficulty_explanation")}
---
# ${T("Before Booking", "Avant de réserver")}
${T("Before purchasing your ticket:", "Avant d'acheter votre billet :")}
- ${T("verify the destination country's import requirements", "vérifiez les conditions d'importation du pays de destination")};
- ${T("confirm that pets are accepted on your specific route", "confirmez que les animaux sont acceptés sur votre itinéraire")};
- ${T("reserve your dog's transport as early as possible", "réservez le transport de votre chien le plus tôt possible")};
- ${T("prepare all veterinary documentation", "préparez tous les documents vétérinaires")};
- ${T("ensure your kennel complies with IATA Live Animals Regulations", "utilisez une caisse conforme aux normes IATA Live Animals Regulations")}.
---
# ${T("Common Mistakes", "Erreurs fréquentes")}
## ${T("Booking too late", "Réserver trop tard")}
${T("Pet capacity is limited on every flight.", "Le nombre d'animaux accepté est limité sur chaque vol.")}
---
## ${T("Underestimating destination requirements", "Sous-estimer les formalités de destination")}
${T("Import rules can be far stricter than those of your departure country.", "Les exigences peuvent être bien plus strictes que dans votre pays de départ.")}
---
## ${T("Using a non-compliant kennel", "Utiliser une caisse non conforme")}
${T("Only IATA-approved kennels are accepted.", "Seules les caisses conformes IATA sont acceptées.")}
---
## ${T("Forgetting transit-country rules", "Oublier les pays de transit")}
${T("Some itineraries cross countries with their own animal import or transit rules.", "Certains itinéraires traversent des pays ayant leurs propres règles d'importation ou de transit.")}
---
# ${T("Expert Advice", "Conseil d'expert")}
${T(`${a.name} can be a reliable choice for journeys involving ${a.region[0]}, but administrative preparation matters more than the flight itself. Confirm airline approval, destination requirements and veterinary documents before booking non-refundable arrangements.`, `${a.name} peut constituer un choix fiable pour les trajets impliquant ${a.region[1]}, mais la préparation administrative compte plus que le vol lui-même. Confirmez l'accord de la compagnie, les exigences de destination et les documents vétérinaires avant toute réservation non remboursable.`)}
---
# FAQ
### ${T("Can my dog travel in the cabin?", "Mon chien peut-il voyager en cabine ?")}
${f("cabin_policy")}
### ${T("Can large dogs travel?", "Les grands chiens sont-ils acceptés ?")}
${f("hold_policy")}
### ${T("Is cargo transport sometimes required?", "Un transport en fret est-il parfois obligatoire ?")}
${f("cargo_policy")}
### ${T("Should I reserve early?", "Dois-je réserver longtemps à l'avance ?")}
${T("Yes. Advance approval is strongly recommended because pet capacity is limited.", "Oui. Une réservation anticipée est vivement recommandée, le nombre d'animaux étant limité.")}
### ${T("Do destination-country regulations still apply?", "Les formalités du pays restent-elles obligatoires ?")}
${T("Always. Airline approval never replaces veterinary, customs or governmental import requirements.", "Toujours. L'autorisation de la compagnie ne remplace jamais les exigences vétérinaires, douanières ou administratives.")}
---
# ${T("Related guides", "Guides associés")}
- ${a.country[i]}
- ${a.hub[i]}
- ${T("IATA Crate Guide", "Guide des caisses IATA")}
- Flight Finder
---
# Sources
[src1] ${a.name} — ${T("official pet travel information.", "informations officielles relatives au transport des animaux.")}
${a.src}
`;
}

let n = 0;
for (const a of A) for (const loc of ["en", "fr"]) {
  writeFileSync(resolve(DIR, `${a.slug}.${loc}.md`), guide(a, loc));
  n++;
}
console.log(`Généré ${n} guides pour ${A.length} compagnies.`);
