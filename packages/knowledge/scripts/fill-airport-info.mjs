#!/usr/bin/env node
/* Seed airport.info for witness airports with real, sourced data (ADR-0006). Idempotent. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OBJ = resolve(dirname(fileURLToPath(import.meta.url)), "../raw/objects.json");
const TODAY = "2026-07-10";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const L = (en, fr) => ({ en, fr });
const src = (url, type, confidence) => ({ url, source_type: type, verified_date: TODAY, review_due: plus(TODAY, 365), confidence, reviewer: "research", history: [] });

const PARIS = "https://www.parisaeroport.fr/en/passengers/flight-preparation/travelling-with-pets";

const INFO = {
  airport_cdg: {
    address: "95700 Roissy-en-France, France",
    website: "https://www.parisaeroport.fr/en/passengers/charles-de-gaulle-airport",
    terminals: "1 · 2A–2G · 3",
    access: L(
      "North-east of Paris; reachable by RER B, TGV high-speed rail, coach and taxi.",
      "Au nord-est de Paris ; accessible en RER B, TGV, autocar et taxi.",
    ),
    terminal_rules: {
      items: [
        L("Dogs may walk on a leash inside the terminals.", "Les chiens peuvent circuler en laisse à l'intérieur des terminaux."),
        L("In lounges, pets must stay in their carrier.", "En salon, l'animal doit rester dans son sac de transport."),
        L("Cabin carrier: soft-sided, pet + bag ≤ 8 kg, under the seat.", "Sac cabine : souple, animal + sac ≤ 8 kg, sous le siège."),
        L("Assistance dogs stay on a leash, close to their handler.", "Les chiens d'assistance restent en laisse, près de leur maître."),
      ],
      source: src(PARIS, "official_website", 4),
    },
    border_post: {
      note: L(
        "Dogs arriving from outside the EU clear the veterinary border-inspection post (SIVEP / PCF) at Roissy — the largest in France, inspecting around 3,000 animal consignments a year.",
        "Les chiens arrivant de l'extérieur de l'UE passent par le poste d'inspection vétérinaire frontalier (SIVEP / PCF) de Roissy — le plus grand de France, avec environ 3 000 lots d'animaux inspectés par an.",
      ),
      applies_when: L("Non-EU arrivals only", "Arrivées hors-UE uniquement"),
      phone: "+33 1 48 62 23 22",
      address: "BP 12112, 95701 Roissy-CDG cedex",
      source: src("https://agriculture.gouv.fr/inspecter-les-animaux-importes-la-mission-du-service-dinspection-veterinaire-et-phytosanitaire", "government", 5),
    },
    assistance: {
      note: L(
        "Recognised assistance dogs travel in the cabin at no charge, kept on a leash. Contact the accessibility desk before security for guidance and relief-area access.",
        "Les chiens d'assistance reconnus voyagent en cabine gratuitement, tenus en laisse. Contactez le comptoir accessibilité avant les contrôles pour être orienté et accéder aux zones de soulagement.",
      ),
      source: src(PARIS, "official_website", 4),
    },
    contacts: [
      { label: L("Airport information", "Information aéroport"), value: "+33 1 70 36 39 50 (3950)" },
      { label: L("Veterinary border post (SIVEP)", "Poste vétérinaire frontalier (SIVEP)"), value: "+33 1 48 62 23 22" },
    ],
  },
};

const data = JSON.parse(readFileSync(OBJ, "utf8"));
let n = 0;
for (const ap of data.airports) if (INFO[ap.id]) { ap.info = INFO[ap.id]; n++; }
writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
console.log(`airport.info rempli pour ${n} aéroport(s):`, Object.keys(INFO).join(", "));
