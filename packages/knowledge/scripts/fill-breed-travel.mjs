#!/usr/bin/env node
/* Fill breed.travel from DogTime's published 1–5 ratings (dogtime-breeds.json), stored verbatim.
   Source: DogTime.com breed pages. Idempotent · matches by lowercased breed name (+ a few aliases). */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const DT = JSON.parse(readFileSync(resolve(HERE, "dogtime-breeds.json"), "utf8"));
const TODAY = "2026-07-10";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

// our breed name (normalised) -> DogTime dataset key, when they differ
const ALIAS = {
  "german shepherd": "german shepherd dog",
  "long-haired german shepherd": "german shepherd dog",
  "standard poodle": "poodle", "miniature poodle": "poodle", "toy poodle": "poodle", "medium poodle": "poodle",
  "english bulldog": "bulldog",
  "cavalier king charles": "cavalier king charles spaniel", "cavalier spaniel": "cavalier king charles spaniel",
  "american akita": "akita", "akita inu": "akita",
  "belgian shepherd groenendael": "belgian sheepdog", "belgian shepherd tervuren": "belgian tervuren",
  "anatolian shepherd": "anatolian shepherd dog", "kangal anatolian shepherd": "anatolian shepherd dog",
  "caucasian shepherd": "caucasian shepherd dog",
  "hungarian vizsla": "vizsla",
  "doberman": "doberman pinscher",
  "rough collie": "collie",
  "american cocker spaniel": "cocker spaniel",
  "brittany spaniel": "brittany",
  "king charles spaniel": "english toy spaniel", "continental toy spaniel": "papillon",
  "landseer": "newfoundland",
  "english pointer": "pointer",
  "miniature dachshund": "dachshund",
  "mixed breed large": "mutt", "mixed breed medium": "mutt", "mixed breed small": "mutt",
  "parson russell terrier": "jack russell terrier",
  "miniature american shepherd": "australian shepherd",
  "miniature bull terrier": "bull terrier",
  "shar pei": "chinese shar-pei",
  "podenco": "ibizan hound",
  "presa canario": "perro de presa canario", "dogo canario": "perro de presa canario",
  "munsterlander": "small munsterlander pointer",
};

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
const deparen = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "").replace(/\s*\([^)]*\)\s*/g, "").replace(/\s+/g, " ").trim();
const DTN = {}; for (const k of Object.keys(DT)) DTN[norm(k)] = k;      // normalised DogTime index
const slug = (key) => key.replace(/[’']/g, "").replace(/\s+/g, "-");

const data = JSON.parse(readFileSync(OBJ, "utf8"));
let matched = 0; const missing = [];
for (const b of data.breeds) {
  const n = norm(b.name), dp = deparen(b.name);
  const key = ALIAS[n] || ALIAS[dp] || DTN[n] || DTN[dp] || null;
  const v = key ? DT[key] : null;
  if (!v) { missing.push(b.name); continue; }
  const [adaptability, sensitivity, tolerates_alone, cold_tolerance, heat_tolerance, energy] = v;
  b.travel = {
    adaptability, sensitivity, tolerates_alone, cold_tolerance, heat_tolerance, energy,
    source: { url: `https://dogtime.com/dog-breeds/${slug(key)}`, source_type: "other", verified_date: TODAY, review_due: plus(TODAY, 365), confidence: 3, reviewer: "research", history: [] },
  };
  matched++;
}
writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
console.log(`breed.travel : ${matched}/${data.breeds.length} races remplies depuis DogTime`);
if (missing.length) console.log("non appariées (" + missing.length + "):", missing.join(", "));
