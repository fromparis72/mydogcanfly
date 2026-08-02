#!/usr/bin/env node
/* Génère BRIEF-ROUTES.md : brief autonome pour une session Cowork DISTANTE.
   La session distante ne peut pas lire le dépôt — tout doit être dans le fichier. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const o = JSON.parse(readFileSync(resolve(ROOT, "packages/knowledge/raw/objects.json"), "utf8"));

const iata = Object.fromEntries(o.airports.map((a) => [a.id, a.iata]));
const codes = o.airports.map((a) => a.iata).filter(Boolean);
const done = o.airlines.filter((a) => a.direct_routes?.length);
const todo = o.airlines.filter((a) => !a.direct_routes?.length);
const B = [];
for (let i = 0; i < todo.length; i += 6) B.push(todo.slice(i, i + 6));

const F = "`"; // backtick
const FENCE = F + F + F;

let m = `# Brief autonome — Base de routes MyDogCanFly

> À joindre comme CONNAISSANCE DE PROJET dans un projet Cowork dédié.
> La session distante ne peut PAS lire le dépôt : tout ce dont elle a besoin est ici.

## Objectif

Pour chaque compagnie, la liste de ses vols SANS ESCALE, en métal propre, entre les aéroports référencés.
Ces routes alimentent le moteur de décision : sans elles, le « vol direct » affiché au visiteur est une
heuristique fondée sur les hubs, pas un fait vérifié.

## Les trois règles qui font tout

1. **Métal propre uniquement.** Un vol vendu BA mais opéré par American ou Comair n'est PAS une route BA :
   c'est la politique animaux du transporteur OPÉRANT qui s'applique au chien. Exclure les partages de code
   et les franchises régionales. Si l'opérateur est indéterminable → ${F}uncertain${F}, ne jamais deviner.
2. **Routes saisonnières incluses mais marquées** dans ${F}seasonal_routes${F}. Les exclure priverait un
   voyageur d'août d'options réelles ; les traiter comme permanentes ferait clignoter le diff mensuel à
   chaque changement de saison.
3. **Destinations hors du jeu d'aéroports** → ${F}candidate_airports${F} (aéroport candidat à ajouter au
   site), jamais dans ${F}direct_routes${F}.

## Source

Le plan de vol, les horaires ou le moteur de réservation **publiés par la compagnie elle-même**, horaires
2026 courants. NE PAS utiliser OpenFlights, les tableaux Wikipédia ni les agrégateurs : périmés.
Citer l'URL réellement utilisée, par compagnie.

## Format de sortie (STRICT)

Identifiant aéroport = code IATA en minuscules préfixé ${F}airport_${F}.
Chaque arête = paire NON ORDONNÉE, les deux identifiants triés ALPHABÉTIQUEMENT, joints par ${F}|${F}.
Londres Heathrow–New York JFK s'écrit ${F}airport_jfk|airport_lhr${F} (jfk avant lhr), jamais l'inverse.
Tableau trié alphabétiquement, sans doublon. ${F}route_count${F} = longueur de ${F}direct_routes${F}.

${FENCE}json
{
  "BA": {
    "direct_routes": ["airport_jfk|airport_lhr"],
    "seasonal_routes": ["airport_kef|airport_lgw"],
    "candidate_airports": ["FNC — Funchal, desservi depuis LGW"],
    "uncertain": ["LHR-XXX : opérateur non confirmé"],
    "source_url": "https://...",
    "verified_date": "2026-07-XX",
    "route_count": 1
  }
}
${FENCE}

## Modèle de référence — Air France, déjà en base (154 arêtes)

${FENCE}json
${JSON.stringify(done.find((a) => a.iata === "AF").direct_routes.slice(0, 10))}
${FENCE}

## Les 249 aéroports référencés

Périmètre : les DEUX extrémités d'une route doivent figurer ici.

${FENCE}
${codes.join(",")}
${FENCE}

## Déjà traité — ne pas refaire

${done.map((a) => a.iata + " (" + a.direct_routes.length + ")").join(" · ")}

## Lots à traiter — ${todo.length} compagnies, ${B.length} lots

Depuis le téléphone, une phrase suffit : « Traite le LOT N du brief, rends le JSON. »
Un lot par session. Ne pas enchaîner deux lots dans la même session : la sortie doit rester récupérable.

`;

B.forEach((b, i) => {
  m += `### LOT ${i + 1}\n\n`;
  for (const a of b) {
    const s = (a.served_airport_ids || []).map((x) => iata[x]).filter(Boolean);
    const hubs = (a.hub_airport_ids || []).map((x) => iata[x]).join(",") || "—";
    m += `**${a.iata} — ${a.name.en || a.name}** · hubs : ${hubs}\n`;
    m += s.length
      ? `Aéroports desservis déjà connus (${s.length}), à confirmer et compléter : ${F}${s.join(",")}${F}\n\n`
      : `Aucun périmètre préalable — partir du plan de vol publié par la compagnie.\n\n`;
  }
});

writeFileSync(resolve(ROOT, "BRIEF-ROUTES.md"), m);
console.log(`BRIEF-ROUTES.md — ${todo.length} compagnies · ${B.length} lots · ${(m.length / 1024).toFixed(0)} Ko`);
