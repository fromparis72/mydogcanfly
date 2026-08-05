// Ingest country entry guides: content/countries/*.yml -> packages/ui/src/data/countries.generated.json
//
//   node packages/knowledge/scripts/ingest-countries.mjs
//
// Validates every guide against a Zod schema (bilingual, official-source discipline)
// and exits non-zero on any error so it can gate the deploy chain. Files starting with
// "_" (e.g. _template.yml) or "." are skipped.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const OUT = join(HERE, "..", "..", "ui", "src", "data", "countries.generated.json");

// Zod, en mode « strip » par défaut, efface en silence toute clé non déclarée : une langue
// absente d'ici disparaîtrait des données sans qu'aucune erreur ne le signale (c'est ce qui
// était arrivé à `brachy_allowed`). Toute langue ajoutée doit donc être déclarée ici.
const LT = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
  es: z.string().min(1).optional(),
  pt: z.string().min(1).optional(),
});
/* La condition d'origine d'une puce d'arrivée, rendue lisible par la machine.
 *
 * Elle était déjà écrite — mais dans la phrase (« From another EU country: … »), donc invisible
 * au moteur, qui affichait toutes les puces quel que soit le pays de départ. La clé la sort du
 * texte sans y toucher : aucune traduction à refaire, et l'absence de clé vaut « toutes origines ».
 * C'est ce défaut qui permet la migration puce par puce, et qui garantit qu'une fiche non taguée
 * se comporte exactement comme avant.
 *
 * Deux valeurs seulement, et c'est délibéré : le partage UE / hors-UE est le seul motif assez
 * régulier pour être posé au gabarit. Les grilles propres à un pays — groupes de Hong Kong,
 * catégories néo-zélandaises, « depuis les États-Unis ou le Canada » au Mexique — demandent
 * chacune leur propre vocabulaire et seront traitées à part.
 */
/* Deux formes, parce que le corpus en contient deux et pas trois :
 *
 *   from: eu | non_eu   le partage UE/hors-UE, seul motif assez régulier pour être nommé ;
 *   from: [us, ca]      la grille propre à un pays d'arrivée, qui est toujours une liste ;
 *   from_except: […]    son complément, écrit en creux — lister les 190 autres pays serait
 *                       ingérable, et la paire ne pourrait plus diverger de sa négation.
 *
 * Les deux clés sont exclusives : une puce qui porterait les deux ne dirait plus rien de clair,
 * et c'est le genre d'ambiguïté qui se découvre en production. Zod la refuse à l'ingestion. */
const FromOrigin = z.enum(["eu", "non_eu"]);
const ISO2 = z.string().regex(/^[a-z]{2}$/, "code pays ISO 3166-1 alpha-2, en minuscules");
const ArrivalPoint = LT.extend({
  from: z.union([FromOrigin, z.array(ISO2).min(1)]).optional(),
  from_except: z.array(ISO2).min(1).optional(),
}).refine((p) => !(p.from && p.from_except), {
  message: "`from` et `from_except` sont exclusifs sur une même puce",
});
const CLS = z.enum(["ok", "no", "warn", "neutral"]);
const SummaryRow = z.object({ requirement: LT, status: LT, cls: CLS });
const Factor = z.object({ stars: z.number().int().min(1).max(5), label: LT, text: LT });
const ReqRow = z.object({ item: LT, required: LT, when: LT, exceptions: LT, ref: LT });
// `tag` : libellé de colonne propre à la fiche. Le gabarit UE / listé / non listé ne convient
// qu'aux régimes européens ; ailleurs (groupes australiens, UEEA, chien accompagné vs fret…)
// la fiche doit pouvoir nommer elle-même ses cas.
/* `from` / `from_except` sur une CASE, exactement comme sur une puce : ils disent à quelle
 * origine ce cas s'applique. C'est ce qui permet au moteur de reprendre la main sur les fiches
 * qui ont leur propre grille — au lieu de présenter les trois cas et de laisser le lecteur
 * chercher le sien, il désigne le bon. Dans une fiche dont AU MOINS une case est ainsi
 * qualifiée, une case sans condition cesse d'être un cas d'origine : c'est une remarque
 * (« documents manquants », « voyage de retour »), et elle passe au repli. */
const OriginBlock = z.object({
  title: LT, body: LT, cls: CLS.optional(), tag: LT.optional(),
  /* `any` : le cas général de la fiche, celui qui s'applique à défaut d'un autre. Beaucoup de
   * pays n'ont pas de grille d'origine du tout — leurs trois cases sont « le cas courant », puis
   * deux remarques sur les chiots, le fret ou les papiers manquants. Sans `any`, le moteur
   * n'avait rien à désigner et se taisait ; avec, il montre le cas courant, qui est justement
   * celui du lecteur neuf fois sur dix. Il est toujours évalué EN DERNIER, pour qu'une condition
   * précise l'emporte. */
  from: z.union([z.enum(["eu", "non_eu", "any"]), z.array(z.string().regex(/^[a-z]{2}$/)).min(1)]).optional(),
  from_except: z.array(z.string().regex(/^[a-z]{2}$/)).min(1).optional(),
});
const SourceLink = z.object({ label: LT, url: z.string().url() });
// Round-trip layer (ADR: return-journey awareness). Both optional — populated progressively,
// so existing guides stay valid. `regime` = the country's pet-movement classification;
// `exit` = the sourced formalities to LEAVE this country with a dog (the often-forgotten step ③).
const Regime = z.enum(["eu", "listed", "non_listed", "island_controlled", "island_strict"]);
/* `scope` : cette étape vaut-elle pour toute destination, ou seulement vers l'Europe ?
 *
 * Les blocs « sortie » ont été rédigés pour un lecteur qui rentrait en Europe. 100 étapes sur 180
 * parlent effectivement du dispositif européen — modèle de certificat UE, laboratoire agréé UE,
 * fenêtre de validité avant l'entrée dans l'UE — mais 80 décrivent seulement la machinerie
 * d'export du pays, et celles-là sont vraies où que l'on aille.
 *
 * Le défaut est `eu`, délibérément : une étape mal classée `any` s'afficherait à tort sur un
 * trajet qui n'a rien d'européen, ce qui est le défaut qu'on répare ; mal classée `eu`, elle
 * manque seulement à l'appel. En cas de doute, on se tait. */
const ExitStep = z.object({
  text: LT,
  timing: z.enum(["before", "window", "longlead"]).default("window"),
  scope: z.enum(["eu", "any", "non_eu"]).default("eu"),
});
const ExitBlock = z.object({
  authority: z.string().min(1),          // local authority name (e.g. "SENASICA"), language-neutral
  authorityUrl: z.string().url(),
  intro: LT,                              // one-line summary of the exit/export procedure
  steps: z.array(ExitStep).min(1),
  onSiteNote: LT.optional(),              // the "trap" caveat: arrange during the stay, airport time
});

/** Domestic travel (same country at both ends): no border, so no import rules — what actually applies instead. */
const DomesticTerritory = z.object({
  name: LT,                               // e.g. "Guyane", "Hawaii" — a same-country special sanitary regime
  note: LT,                               // what applies there, sourced
  url: z.string().url().optional(),       // official source for that territory
});
const DomesticBlock = z.object({
  intro: LT,                              // "no import formality on a domestic flight" headline
  points: z.array(LT).min(1),             // what DOES apply (identification, state rules, airline policy…)
  territories: z.array(DomesticTerritory).optional(),
});

const Guide = z
  .object({
    id: z.string().regex(/^country_[a-z0-9_]+$/),
    iso2: z.string().length(2),
    name: LT,
    region: LT,
    hero: z.object({ h1: LT, intro: LT }),
    difficulty: z.object({ level: z.enum(["easy", "moderate", "difficult"]), label: LT }),
    prepTime: z.object({ eu: LT, listed: LT, nonListed: LT }),
    summary: z.array(SummaryRow).min(1),
    notice: z.array(LT).min(1),
    noticeClose: LT,
    factors: z.object({ title: LT, intro: LT, items: z.array(Factor).min(1), note: LT }),
    requirements: z.array(ReqRow).min(1),
    /* `scheme` dit ce que les trois cases VEULENT DIRE dans cette fiche — et il n'y a pas de
     * valeur par défaut, parce qu'une valeur par défaut ici est une affirmation gratuite.
     *
     *   eu   les cases sont bien « depuis l'UE », « depuis un pays listé », « depuis un pays
     *        non listé » : le moteur peut en choisir une d'après le régime du pays de départ.
     *   own  le pays classe le monde à sa façon — groupes australiens, régions désignées
     *        japonaises, Amérique du Nord contre le reste au Mexique, UEEA en Russie. Le régime
     *        européen du pays de départ ne dit alors RIEN sur la case qui s'applique, et le
     *        moteur doit s'abstenir de choisir : il présente les cas, le lecteur reconnaît le sien.
     *
     * C'est ce champ qui manquait : la fiche de voyage lisait « France = regime eu » donc « case
     * n° 1 », et servait au voyageur parisien le paragraphe mexicain « depuis les États-Unis ou
     * le Canada ». Le tort n'était pas dans la donnée mexicaine, il était dans la présomption. */
    origin: z.object({
      scheme: z.enum(["eu", "own"]),
      eu: OriginBlock, listed: OriginBlock, nonListed: OriginBlock,
    }),
    arrival: z.object({ intro: LT, points: z.array(ArrivalPoint).min(1) }),
    regime: Regime.optional(),
    exit: ExitBlock.optional(),
    domestic: DomesticBlock.optional(),
    travellerExperience: LT.nullable(),
    restrictedDogs: z.object({ intro: LT, cat1: LT, cat2: LT, note: LT }),
    checklist: z.array(LT).min(1),
    sources: z.array(SourceLink).min(1),
    seo: z.object({ title: LT, metaTitle: LT, metaDesc: LT, slug: z.string().min(1), shortDesc: LT }),
    verified_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewer: z.string().min(1),
    confidence: z.number().int().min(1).max(5),
  })
  .strict();

const files = readdirSync(SRC).filter(
  (f) => (f.endsWith(".yml") || f.endsWith(".yaml")) && !f.startsWith("_") && !f.startsWith("."),
);

const out = {};
let errors = 0;
for (const f of files) {
  const parsed = YAML.parse(readFileSync(join(SRC, f), "utf8"));
  const r = Guide.safeParse(parsed);
  if (!r.success) {
    errors++;
    console.error(`\n✖ ${f}`);
    for (const issue of r.error.issues) console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    continue;
  }
  if (out[r.data.id]) {
    errors++;
    console.error(`\n✖ ${f}: duplicate id ${r.data.id}`);
    continue;
  }
  out[r.data.id] = r.data;
}

if (errors) {
  console.error(`\n${errors} file(s) failed validation. Nothing written.`);
  process.exit(1);
}

const sorted = {};
for (const k of Object.keys(out).sort()) sorted[k] = out[k];
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`✓ ${files.length} country guide(s) ingested -> ${OUT}`);
