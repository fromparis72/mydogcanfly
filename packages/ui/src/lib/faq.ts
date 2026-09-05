import { inlineT, inlineF, t as tt } from "@mydogcanfly/knowledge";
import { politiqueDuCanal, cleLibelleStatut, preuveAuditee, type Placement } from "./decisionCanal";
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

export function airlineFaq(d: any, locale: string, policy?: any): FaqItem[] {
  /* `L(locale)` n'est plus lu ici : plus aucune réponse de compagnie ne vient d'un champ
     éditorial quadrilingue. Il sert toujours aux fiches PAYS, plus bas. */
  const name: string = d.name;
  const out: FaqItem[] = [];
  const push = (q: string, a: string) => { if (a && a.trim().length > 20) out.push({ q, a: clip(a) }); };

  const Q = inlineT(locale);
  const F = inlineF(locale); // phrases où la donnée entre par un trou numéroté

  /* ── LA FAQ LIT LA POLITIQUE CANONIQUE, PLUS L'ÉDITORIAL (contre-revue du 05/09/2026) ───────
   *
   * LE DÉFAUT. La fiche a DEUX chemins de données pour un même canal : la politique de la base
   * de connaissances — citée, datée, franchie par la frontière de confiance — et le tableau
   * historique `channels[]`, où `statusLabel` et `detail` sont du texte libre écrit à la main,
   * sans source et sans possibilité d'en avoir une. La CARTE a été ramenée sur la politique ;
   * la FAQ, elle, lisait toujours l'éditorial. J'ai donc masqué `detail` sur la carte tout en le
   * republiant dix lignes plus bas, en réponse à une question — et, pire, dans le JSON-LD
   * `FAQPage`, où un moteur génératif le lit comme une réponse autorisée. Le contrôle DOM des
   * fiches sentinelles l'a attrapé : Air France « moins de 8 kg … 46 × 28 × 24 cm », Thai
   * Airways « 34 races : fret uniquement ».
   *
   * LA FERMETURE. Ces réponses se construisent désormais avec les MÊMES pièces que la carte :
   * le libellé publié du statut canonique, puis — si la décision repose sur une phrase citée —
   * cette phrase VERBATIM avec son lien officiel ; sinon la phrase générique d'ignorance. Aucun
   * seuil, aucune dimension, aucune modalité ne peut plus rentrer par ici. C'est aussi ce qui
   * rend IMPOSSIBLE le retour des 295 divergences `cls`/`statusLabel` : elles ne sont plus lues
   * nulle part par l'interface, sans qu'aucun sous-système de réconciliation ait été construit.
   *
   * `policy` est optionnel POUR LES SEULS APPELANTS QUI N'EN ONT PAS — mais alors la réponse se
   * limite au libellé et à l'ignorance : jamais de repli sur l'éditorial. */
  /* ON N'INTERROGE QUE LES CANAUX QUE LA FICHE DÉCLARE — comme la carte, qui itère `d.channels`.
     Première rédaction : je demandais le triplet cabine/soute/fret à toutes les fiches. Air
     Tahiti Nui n'a pas de politique de soute, et `politiqueDuCanal` LÈVE plutôt que de déduire
     une décision d'un `cls` éditorial : le build de production s'est arrêté sur elle. Le garde
     avait raison — c'est ma question qui inventait un canal. */
  const declares = new Set<string>((d.channels ?? []).map((c: any) => c?.placement).filter(Boolean));
  const reponseCanal = (placement: Placement): string | null => {
    if (!policy || !declares.has(placement)) return null;
    const decision = politiqueDuCanal(policy, placement, d.id ?? name);
    const libelle = tt(locale, cleLibelleStatut(decision.status));
    const preuve = preuveAuditee(decision);
    /* La citation est publiée telle qu'elle a été lue, dans SA langue, et signalée comme une
       citation : la traduire serait en faire notre phrase, et nous n'avons pas lu la nôtre. */
    const fond = preuve?.quote
      ? `« ${preuve.quote} » (${preuve.url})`
      : tt(locale, "premium.channel_unproven");
    return join([`${name} — ${libelle}.`, fond]);
  };

  // 1 — cabine
  const repCabine = reponseCanal("cabin");
  if (repCabine) {
    push(
      F("Can my dog travel in the cabin on {0}?",
        "Mon chien peut-il voyager en cabine sur {0} ?",
        "¿Mi perro puede viajar en cabina en {0}?", name),
      repCabine,
    );
  }

  // 2 — soute et fret réunis : c'est la même question pour un grand chien
  const repSoute = reponseCanal("hold"), repFret = reponseCanal("cargo");
  if (repSoute || repFret) {
    push(
      F("Does {0} carry dogs in the hold?",
        "{0} accepte-t-elle les chiens en soute ?",
        "¿{0} acepta perros en bodega?", name),
      join([
        repSoute ? `${Q("Hold", "Soute", "Bodega")} — ${repSoute}` : "",
        repFret ? `${Q("Cargo", "Fret", "Carga")} — ${repFret}` : "",
      ], " "),
    );
  }

  /* 3 — LA QUESTION « COMBIEN ÇA COÛTE » A ÉTÉ RETIRÉE (micro-lot Tarifs, 29/08/2026).
     Elle recopiait la grille par zone dans la FAQ — donc dans le texte visible ET dans le
     JSON-LD FAQPage, où un moteur la lit comme une réponse. Une réponse chiffrée à une question
     de prix est exactement ce que ce lot interdit tant qu'aucune table structurée ne la fonde.
     La question reviendra avec sa table, et elle répondra alors pour un trajet, pas en général. */

  /* 4 À 7 — BRACHYCÉPHALES, CAISSE, CHALEUR, CHIEN D'ASSISTANCE : RETIRÉES (05/09/2026).
   *
   * Elles lisaient `restrictions`, `crate`, `temperature` et `assistance`. MESURE : ces quatre
   * champs sont du texte libre quadrilingue — les entrées de `crate` n'ont que les clés `en`,
   * `fr`, `es`, `pt`, aucune place pour une source ; aucune des 201 `restrictions` n'en porte
   * une. Ils affirment pourtant, compagnie nommée à l'appui, des seuils (« 8–25 kg »), des
   * dimensions (« 55 × 40 × 23 cm »), des exceptions d'appareil (« DH8-100 et ATR ») et des
   * refus de races (« 34 races : fret uniquement »).
   *
   * Une réponse de FAQ est catégorique par construction, et le balisage `FAQPage` la donne à
   * lire à une machine comme une réponse autorisée. C'est exactement ce que le critère de
   * réussite interdit : « aucune information insuffisamment prouvée ne doit produire à elle
   * seule une réponse catégorique susceptible d'induire le visiteur en erreur ». Ces quatre
   * questions reviendront quand leurs champs porteront une source citée — pas avant. Les mêmes
   * blocs sont masqués sur la fiche par `surfacesEditorialesAffichables`, du même mouvement.
   *
   * Il reste donc deux questions par fiche, toutes deux adossées à la politique canonique. */

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
