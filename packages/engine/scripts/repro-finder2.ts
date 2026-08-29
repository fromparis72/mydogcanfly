import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize } from "@mydogcanfly/knowledge";
import { FinderRequest, runFinder } from "../src/index";

/* Banc d'essai des deux cas du document A-REPRENDRE-FINDER-2 :
   Paris → JFK (Golden Retriever 30 kg) et Perpignan → JFK.
   Sert à démontrer sur pièces le comportement avant/après. */

const kroot = join(dirname(fileURLToPath(import.meta.url)), "../../knowledge");
const raw = {
  ...JSON.parse(readFileSync(join(kroot, "raw/objects.json"), "utf8")),
  rules: JSON.parse(readFileSync(join(kroot, "raw/rules.json"), "utf8")),
};
const kb = normalize(raw);

function show(title: string, req: Parameters<typeof FinderRequest.parse>[0]) {
  const r = runFinder(kb, FinderRequest.parse(req));
  console.log(`\n════ ${title} ════  verdict=${r.verdict} score=${r.score}`);
  for (const a of r.airlines) {
    const mode = [a.cabin && "cabin", a.hold && "hold", a.cargo && "cargo"].filter(Boolean).join("+") || "—";
    console.log(
      [
        a.name.padEnd(24),
        (a.direct ? "DIRECT" : `via ${a.connect_airport_id ?? "?"}`).padEnd(22),
        (a as { itinerary_confidence?: string }).itinerary_confidence ?? "-",
        mode.padEnd(16),
        `carries_pets=${a.carries_pets}`.padEnd(20),
        `label="${a.label}"`.padEnd(46),
        /* `fee` n'existe plus : le rapport porte des statuts PAR CANAL, jamais un montant. */
        `tarifs=${(a.statuts_tarifaires ?? []).map((s) => `${s.placement}:${s.statut}`).join(" · ") || "—"}`,
      ].join(" | "),
    );
  }
  const crate = r.partners.find((p) => p.vertical === "equipment");
  console.log(`  → recommandation équipement : ${crate ? crate.reason : "(aucune)"}`);
}

show("Paris (CDG+ORY) → JFK · Golden Retriever 30 kg", {
  origin: "airport_cdg",
  origins: ["airport_cdg", "airport_ory"],
  destination: "airport_jfk",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 30, brachycephalic: false },
  locale: "fr",
});

show("Perpignan (PGF) → JFK · Golden Retriever 30 kg", {
  origin: "airport_pgf",
  destination: "airport_jfk",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 30, brachycephalic: false },
  locale: "fr",
});

// Cas volontairement en fret : la recommandation d'équipement doit parler transitaire, pas soute.
show("Perpignan (PGF) → JFK · fret demandé", {
  origin: "airport_pgf",
  destination: "airport_jfk",
  placement: "cargo",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 30, brachycephalic: false },
  locale: "fr",
});

show("Paris (CDG) → Londres LHR · Golden Retriever 30 kg", {
  origin: "airport_cdg",
  destination: "airport_lhr",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 30, brachycephalic: false },
  locale: "fr",
});
