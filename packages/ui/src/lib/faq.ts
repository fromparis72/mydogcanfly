import { inlineT, inlineF } from "@mydogcanfly/knowledge";
/**
 * FAQ générées depuis les données existantes — compagnies et pays.
 *
 * Objectif GEO plus que SEO : les moteurs génératifs citent des unités question→réponse
 * autosuffisantes. Chaque réponse répète donc le nom de l'entité et se tient hors contexte,
 * plutôt que de dire « cette compagnie » ou « ici ».
 *
 * Rien n'est inventé : tout est dérivé de champs déjà sourcés et datés. Une question dont
 * la donnée manque est simplement omise — mieux vaut cinq questions vraies que sept dont
 * deux sont vides.
 */

type LT = { en: string; fr: string; es: string };
export type FaqItem = { q: string; a: string };

const colonOf = (locale: string) => (locale === "fr" ? " : " : ": ");
const L = (locale: string) => (v: LT | string | undefined): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return (v as any)[locale] ?? v.en ?? "";
};

/** Coupe proprement à la fin d'une phrase, pour des réponses lisibles hors contexte. */
function clip(s: string, max = 320): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" ; "), cut.lastIndexOf(" — "));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim() + "…";
}

const join = (parts: (string | undefined)[], sep = " ") =>
  parts.filter((p) => p && p.trim()).join(sep).replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- compagnies

export function airlineFaq(d: any, locale: string): FaqItem[] {
  const t = L(locale);
  const name: string = d.name;
  const out: FaqItem[] = [];
  const push = (q: string, a: string) => { if (a && a.trim().length > 20) out.push({ q, a: clip(a) }); };

  const chan = (key: "Cabin" | "Hold" | "Cargo") =>
    (d.channels ?? []).find((c: any) => c?.name?.en === key);

  const Q = inlineT(locale);
  const F = inlineF(locale); // phrases où la donnée entre par un trou numéroté

  // 1 — cabine
  const cabin = chan("Cabin");
  if (cabin) {
    push(
      F("Can my dog travel in the cabin on {0}?",
        "Mon chien peut-il voyager en cabine sur {0} ?",
        "¿Mi perro puede viajar en cabina en {0}?", name),
      join([`${name} — ${t(cabin.statusLabel)}.`, t(cabin.detail),
            cabin.fee ? F("Fare: {0}.", "Tarif : {0}.", "Tarifa: {0}.", t(cabin.fee)) : ""]),
    );
  }

  // 2 — soute et fret réunis : c'est la même question pour un grand chien
  const hold = chan("Hold"), cargo = chan("Cargo");
  if (hold || cargo) {
    push(
      F("Does {0} carry dogs in the hold?",
        "{0} accepte-t-elle les chiens en soute ?",
        "¿{0} acepta perros en bodega?", name),
      join([
        hold ? `${Q("Hold", "Soute", "Bodega")} — ${t(hold.statusLabel)}. ${t(hold.detail)}` : "",
        cargo ? `${Q("Cargo", "Fret", "Carga")} — ${t(cargo.statusLabel)}. ${t(cargo.detail)}` : "",
      ], " "),
    );
  }

  // 3 — prix
  const rows = d.fareGrid?.rows ?? [];
  if (rows.length) {
    const line = rows.slice(0, 3)
      .map((r: any) => `${t(r.zone)}${colonOf(locale)}${[r.cabin, r.hold].filter(Boolean).join(" / ")}`)
      .join(" · ");
    push(
      F("How much does it cost to fly a dog on {0}?",
        "Combien coûte le transport d'un chien sur {0} ?",
        "¿Cuánto cuesta viajar con un perro en {0}?", name),
      join([
        F("{0} publishes these fares (cabin / hold):",
          "{0} publie ces tarifs (cabine / soute) :",
          "{0} publica estas tarifas (cabina / bodega):", name),
        line + ".",
        d.fareGrid?.note ? t(d.fareGrid.note) : "",
      ]),
    );
  }

  // 4 — brachycéphales : la question la plus posée
  const brachy = (d.restrictions ?? []).find((r: any) =>
    /flat-faced|brachy|snub/i.test(r?.title?.en ?? ""));
  if (brachy) {
    const pills = (brachy.pills ?? []).map((p: any) => t(p.label)).join(" · ");
    push(
      F("Does {0} accept flat-faced (brachycephalic) breeds?",
        "{0} accepte-t-elle les races brachycéphales ?",
        "¿{0} acepta razas de hocico chato (braquicéfalas)?", name),
      join([pills ? `${name} — ${pills}.` : `${name}${colonOf(locale).trimEnd()}`, t(brachy.note)]),
    );
  }

  // 5 — caisse
  const crate = d.crate ?? [];
  if (crate.length) {
    push(
      F("What kind of crate does {0} require?",
        "Quelle caisse {0} exige-t-elle ?",
        "¿Qué tipo de jaula exige {0}?", name),
      join([
        F("{0} requires an IATA-compliant crate:",
          "{0} exige une caisse conforme IATA :",
          "{0} exige una jaula conforme a la IATA:", name),
        crate.slice(0, 4).map((c: any) => t(c)).join(" ; ") + ".",
      ]),
    );
  }

  // 6 — chaleur
  const temp = d.temperature;
  if (temp?.note) {
    push(
      F("Does {0} suspend dog transport in hot weather?",
        "{0} suspend-elle le transport des chiens en cas de forte chaleur ?",
        "¿{0} suspende el transporte de perros con calor?", name),
      join([t(temp.note)]),
    );
  }

  // 7 — chien d'assistance
  const asst = (d.assistance ?? [])[0];
  if (asst) {
    push(
      F("Are assistance dogs accepted on {0}?",
        "Les chiens d'assistance sont-ils acceptés sur {0} ?",
        "¿Se aceptan perros de asistencia en {0}?", name),
      join([`${name} — ${t(asst.label)}.`, t(asst.value)]),
    );
  }

  return out.slice(0, 7);
}

// --------------------------------------------------------------------- pays

export function countryFaq(g: any, locale: string): FaqItem[] {
  const t = L(locale);
  const name: string = t(g.name);
  const out: FaqItem[] = [];
  const push = (q: string, a: string) => { if (a && a.trim().length > 20) out.push({ q, a: clip(a) }); };

  const Q = inlineT(locale);
  const F = inlineF(locale); // phrases où la donnée entre par un trou numéroté

  const reqs = g.requirements ?? [];
  // « Not required », « Not published », « No official requirement » contiennent tous le mot
  // « required » : sans exclure la négation, la FAQ annonçait comme exigées des pièces que le
  // tableau de la même page déclare facultatives (91 fiches sur 140 étaient concernées).
  const isReq = (r: any) => {
    const s = (r?.required?.en ?? "").toLowerCase();
    if (/\b(not|no|never|none|unknown|optional|n\/a)\b/.test(s)) return false;
    return /required|obligat|requis/.test(s);
  };
  // Un tiret cadratin seul est un « non renseigné » dans les données, pas une réponse.
  const said = (v: any) => { const x = t(v).trim(); return x.length > 1 && x !== "—" && x !== "-" ? x : ""; };

  // Forme « Pays : question ? ». Elle évite d'avoir à décliner les prépositions propres à
  // chaque nom de pays (en France, au Canada, aux Pays-Bas, à Cuba…) dans trois langues,
  // et place le mot-clé en tête — ce que privilégient les moteurs génératifs.
  // Le français sépare le nom du pays de la question par une espace insécable avant le
  // deux-points ; les autres langues collent le deux-points. Le portugais suit l'usage anglais.
  const P = (en: string, fr: string, es: string) => {
    const q = inlineT(locale)(en, fr, es);
    return name + colonOf(locale) + q.charAt(0).toUpperCase() + q.slice(1);
  };

  // 1 — l'essentiel
  const core = reqs.filter(isReq).slice(0, 5).map((r: any) => t(r.item));
  if (core.length) {
    push(
      P("what does my dog need to enter?",
        "de quoi mon chien a-t-il besoin pour entrer ?",
        "¿qué necesita mi perro para entrar?"),
      join([
        F("{0} requires:", "{0} exige :", "{0} exige:", name),
        core.join(", ") + ".",
      ]),
    );
  }

  // 2 — titrage : le point qui coûte le plus cher en délai
  const titer = reqs.find((r: any) => /titer|titre|titulaci/i.test(r?.item?.en ?? "") || /antibody/i.test(r?.item?.en ?? ""));
  if (titer) {
    push(
      P("is a rabies antibody test required?",
        "un titrage antirabique est-il exigé ?",
        "¿se exige una prueba de titulación de rabia?"),
      join([`${name} — ${t(titer.item)}${colonOf(locale)}${t(titer.required)}.`, said(titer.when)]),
    );
  }

  // 3 — races interdites
  if (g.restrictedDogs?.intro) {
    push(
      P("are any dog breeds banned?",
        "des races de chiens sont-elles interdites ?",
        "¿hay razas de perros prohibidas?"),
      t(g.restrictedDogs.intro),
    );
  }

  // 4 — délai de préparation
  const prep = g.prepTime?.eu ?? g.prepTime?.listed ?? g.prepTime?.nonListed;
  if (prep) {
    push(
      P("how long does it take to prepare a dog?",
        "combien de temps faut-il pour préparer un chien ?",
        "¿cuánto tiempo lleva preparar a un perro?"),
      join([t(prep), g.prepTime?.nonListed && g.prepTime.nonListed !== prep ? t(g.prepTime.nonListed) : ""]),
    );
  }

  // 5 — vol intérieur (là où l'erreur est la plus fréquente)
  if (g.domestic?.intro) {
    push(
      P("do domestic flights have the same requirements?",
        "les vols intérieurs imposent-ils les mêmes formalités ?",
        "¿los vuelos nacionales tienen los mismos requisitos?"),
      join([t(g.domestic.intro), (g.domestic.points ?? []).slice(0, 2).map((p: any) => t(p)).join(" ")]),
    );
  }

  // 6 — sortie du pays
  if (g.exit?.intro) {
    push(
      P("what is needed to leave with a dog?",
        "que faut-il pour en repartir avec son chien ?",
        "¿qué se necesita para salir con un perro?"),
      t(g.exit.intro),
    );
  }

  // 7 — difficulté globale
  if (g.difficulty?.label) {
    push(
      P("is it difficult to travel there with a dog?",
        "est-ce difficile d'y voyager avec un chien ?",
        "¿es difícil viajar allí con un perro?"),
      join([`${name} — ${t(g.difficulty.label)}.`, Array.isArray(g.notice) ? t(g.notice[0]) : g.notice ? t(g.notice) : ""]),
    );
  }

  return out.slice(0, 7);
}

/** JSON-LD FAQPage — à n'émettre que si les mêmes Q/R sont visibles sur la page. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
