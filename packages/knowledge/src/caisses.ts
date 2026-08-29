import { z } from "zod";
import { Source, reviewDueFrom } from "./common";
import { SourcedQuote } from "./breed-restrictions";

/**
 * Contrat des CAISSES DE TRANSPORT — schéma seul, sans données.
 * Conception : DOSSIER-TARIFS-PRELANCEMENT.md (v3, feu vert de contre-revue du 29/08/2026).
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE CONTRAT EXISTE, ET CE QU'IL INTERDIT
 *
 * Le Flight Finder affichait un montant comme prix du trajet alors qu'il recopiait une chaîne
 * générique. La correction impose de savoir dans quelle TRANCHE de poids tombe l'ensemble
 * « animal + caisse » — donc de connaître le poids d'une caisse. Et c'est exactement là qu'on
 * remplacerait un prix inventé par un POIDS inventé si rien ne s'y opposait.
 *
 * TROIS RÈGLES, chacune tirée d'une faute constatée pendant la conception :
 *
 * 1. UNE SOURCE NE PROUVE PAS UN CHIFFRE. `Source` dit d'où vient une page ; elle ne dit pas que
 *    la dimension enregistrée y figure. Chaque spécification porte donc SA citation et SON
 *    locator. (La v1 du dossier attribuait à une caisse des dimensions que personne n'avait
 *    mesurées : la source était réelle, les chiffres non.)
 *
 * 2. LA VALEUR ORIGINALE D'ABORD, LA CONVERSION ENSUITE. Petmate publie en pouces et en livres,
 *    Ferplast en centimètres et en kilogrammes. On enregistre ce que la page dit, et la valeur
 *    normalisée en est DÉRIVÉE — jamais saisie. Une normalisée qui ne correspond pas à la
 *    conversion de son originale est refusée ici, pas découverte plus tard.
 *
 * 3. LE POIDS EST CELUI QUI EST NOMMÉ « POIDS NET ». Une même page peut exposer, à côté, un poids
 *    d'expédition ou un poids de plateforme marchande. Prendre le premier nombre trouvé serait une
 *    erreur silencieuse ; `champ_source` oblige à nommer le champ retenu.
 *
 * ET UNE RÈGLE SUPÉRIEURE, QUI NE SE DISCUTE PAS : IATA publie des exigences minimales de
 * contenant et déclare explicitement NE CERTIFIER, N'APPROUVER NI NE RECOMMANDER aucune marque ni
 * aucun modèle ; l'acceptation finale appartient à l'opérateur. Aucun champ de ce contrat ne peut
 * porter une homologation, et une déclaration de conformité reste une phrase de fabricant, citée
 * et attribuée.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Un nombre de production : strictement positif. Aucun zéro de gabarit dans les données. */
const positif = z.number().positive();

/**
 * `locator` est OPTIONNEL dans le schéma canonique — il ne l'est pas ici. Une spécification sans
 * l'endroit où la lire n'est pas vérifiable par un relecteur : elle demanderait de re-parcourir
 * la page entière, c'est-à-dire de refaire la collecte pour contrôler la collecte.
 */
export const PreuveChiffree = SourcedQuote.refine((s) => typeof s.locator === "string" && s.locator.length > 0, {
  message: "`locator` est obligatoire pour une preuve chiffrée : sans lui, le chiffre n'est pas retrouvable",
  path: ["locator"],
});
export type PreuveChiffree = z.infer<typeof PreuveChiffree>;

export const UniteLongueur = z.enum(["cm", "in"]);
export const UniteMasse = z.enum(["kg", "lb"]);

export const POUCE_EN_CM = 2.54;
export const LIVRE_EN_KG = 0.45359237;

/** La conversion, écrite UNE fois : le schéma la vérifie, le dériveur l'applique. */
export function versCm(valeur: number, unite: z.infer<typeof UniteLongueur>): number {
  return unite === "cm" ? valeur : valeur * POUCE_EN_CM;
}
export function versKg(valeur: number, unite: z.infer<typeof UniteMasse>): number {
  return unite === "kg" ? valeur : valeur * LIVRE_EN_KG;
}
/** Tolérance de comparaison : deux décimales suffisent, et une conversion exacte les tient. */
const proche = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * LES LIBELLÉS DE POIDS ADMIS — EN PRODUCTION, jamais dans un harnais.
 *
 * La première version laissait cette liste dans le fichier de test : la contre-épreuve se donnait
 * donc elle-même la réponse, et rien n'empêchait un registre d'inscrire « shipping weight ».
 * Une garde qui ne vit que dans son test ne garde rien.
 *
 * Ce qui est admis : le poids de l'objet vendu, tel que la page le nomme. Ce qui ne l'est pas :
 * un poids d'expédition (emballage compris) ou un poids de plateforme marchande, souvent affiché
 * à côté et souvent différent.
 */
export const LIBELLES_POIDS_NET = [
  "net weight", "poids net", "peso netto", "peso neto", "peso líquido", "nettogewicht",
] as const;

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function estLibellePoidsNet(champ: string): boolean {
  const c = norm(champ);
  return LIBELLES_POIDS_NET.some((l) => c.includes(norm(l)));
}

/**
 * LES PARSEURS — la seule façon dont un chiffre entre au registre.
 *
 * `valeur_textuelle` est le fragment EXACT de la page ; les valeurs originales en sont dérivées
 * mécaniquement, et le schéma exige l'égalité. Sans cela, la citation et les chiffres pouvaient
 * vivre côte à côte sans se parler : l'attaque du 29/08/2026 conservait la citation
 * « 100 x 60 x 70 cm — net weight 10 kg » et inscrivait 999 × 888 × 777 / 66 kg — acceptés.
 */
const nombre = (s: string) => Number(s.replace(",", "."));

export function parserDimensions(texte: string): { l: number; w: number; h: number; unite: "cm" | "in" } | null {
  const t = texte.replace(/\s+/g, " ").trim();
  const m = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|in|inches|")?/i.exec(t);
  if (!m) return null;
  const u = (m[4] ?? "").toLowerCase();
  const unite = u === "in" || u === "inches" || u === '"' ? "in" : u === "cm" || u === "" ? "cm" : null;
  if (!unite) return null;
  return { l: nombre(m[1]), w: nombre(m[2]), h: nombre(m[3]), unite };
}

export function parserPoids(texte: string): { valeur: number; unite: "kg" | "lb" } | null {
  const t = texte.replace(/\s+/g, " ").trim();
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs|pounds)\b/i.exec(t);
  if (!m) return null;
  const u = m[2].toLowerCase();
  return { valeur: nombre(m[1]), unite: u.startsWith("kg") ? "kg" : "lb" };
}

/**
 * Une spécification chiffrée : le fragment de page, et la citation qui le contient.
 * Les deux sont exigés ENSEMBLE — c'est ce lien qui manquait.
 */
export const SpecificationChiffree = z.object({
  /** Le fragment EXACT de la page qui porte le chiffre. */
  valeur_textuelle: z.string().min(1),
  citation: PreuveChiffree,
}).strict().refine((s) => s.citation.quote.includes(s.valeur_textuelle), {
  message: "`valeur_textuelle` doit apparaître MOT POUR MOT dans la citation — sinon le chiffre n'est rattaché à rien",
  path: ["valeur_textuelle"],
});

/** La spécification de poids porte en plus le libellé du champ, qui doit être dans la citation. */
export const SpecificationPoids = z.object({
  valeur_textuelle: z.string().min(1),
  /** Le nom du champ, tel que la page le libelle — et il doit y être. */
  champ_source: z.string().min(1),
  citation: PreuveChiffree,
}).strict()
  .refine((s) => s.citation.quote.includes(s.valeur_textuelle), {
    message: "`valeur_textuelle` doit apparaître MOT POUR MOT dans la citation",
    path: ["valeur_textuelle"],
  })
  .refine((s) => norm(s.citation.quote).includes(norm(s.champ_source)), {
    message: "`champ_source` doit apparaître dans la citation : c'est la page qui nomme le champ, pas nous",
    path: ["champ_source"],
  })
  .refine((s) => estLibellePoidsNet(s.champ_source), {
    message: `le poids doit venir d'un champ de POIDS NET (${LIBELLES_POIDS_NET.join(", ")}) — un poids d'expédition ou de plateforme marchande n'est pas le poids de l'objet`,
    path: ["champ_source"],
  });

export const ValeursOriginales = z.object({
  unite_longueur: UniteLongueur,
  unite_masse: UniteMasse,
  l: positif, w: positif, h: positif,
  poids_a_vide: positif,
  /* `champ_source` a DÉMÉNAGÉ sur la preuve de poids : il doit être confronté à la citation,
     et un champ ne peut pas se confronter à une phrase qu'il ne côtoie pas. */
}).strict();

export const ValeursNormalisees = z.object({
  l: positif, w: positif, h: positif, poids_a_vide_kg: positif,
  derive_de: z.literal("conversion mécanique depuis valeurs_originales"),
}).strict();

/**
 * Une déclaration de conformité du fabricant. `attribution` et `condition` vivent DANS
 * L'ENVELOPPE, jamais dans la citation : `SourcedQuote` est `.strict()` et rejetterait tout champ
 * ajouté (mesuré : `unrecognized_keys attribution`).
 *
 * `condition` n'est pas une phrase libre : elle doit être CONTENUE dans la citation, ou n'être pas
 * là. Sans cette contrainte, ce champ deviendrait l'endroit où une nuance s'invente — le fabricant
 * Ferplast, par exemple, subordonne sa déclaration à l'emploi d'un kit de grille, et cette réserve
 * doit venir de sa page, pas de nous.
 */
export const DeclarationFabricant = z.object({
  attribution: z.string().min(1),
  condition: z.string().min(1).optional(),
  citation: PreuveChiffree,
}).strict().refine((d) => d.condition == null || d.citation.quote.includes(d.condition), {
  message: "`condition` doit être contenue mot pour mot dans la citation — une condition reformulée est une condition inventée",
  path: ["condition"],
});

export const ModeleCaisse = z.object({
  id: z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)+$/, "identifiant « fabricant_modele » attendu"),
  fabricant: z.string().min(1),
  modele: z.string().min(1),
  type: z.enum(["rigide", "souple"]),
  materiau: z.string().min(1).optional(),
  specifications: z.object({
    valeurs_originales: ValeursOriginales,
    normalisees_cm_kg: ValeursNormalisees,
    /* DEUX PREUVES, PAS UNE. Dimensions et poids ne se lisent pas au même endroit d'une page, et
       une preuve unique laissait l'une des deux sans ancrage — c'est par là que l'attaque du
       29/08/2026 est passée. */
    preuve_dimensions: SpecificationChiffree,
    preuve_poids: SpecificationPoids,
  }).strict(),
  declaration_fabricant: DeclarationFabricant.optional(),
}).strict()
  /* LA CONVERSION EST VÉRIFIÉE ICI, pas seulement produite ailleurs : un registre édité à la main
     ne peut pas porter une normalisée qui ne découle pas de son originale. */
  /* LES CHIFFRES SONT CEUX DE LA CITATION — le lien qui manquait.
     `valeurs_originales` n'est plus une saisie libre : elle doit être exactement ce que le
     parseur tire du fragment cité. Une citation intacte et des chiffres changés se refusent
     désormais au chemin de la preuve, et non plus par un effet de bord de la conversion. */
  .refine((m) => {
    const d = parserDimensions(m.specifications.preuve_dimensions.valeur_textuelle);
    const o = m.specifications.valeurs_originales;
    return d != null && proche(d.l, o.l) && proche(d.w, o.w) && proche(d.h, o.h) && d.unite === o.unite_longueur;
  }, { message: "les dimensions inscrites ne sont pas celles que porte la citation", path: ["specifications", "preuve_dimensions", "valeur_textuelle"] })
  .refine((m) => {
    const p = parserPoids(m.specifications.preuve_poids.valeur_textuelle);
    const o = m.specifications.valeurs_originales;
    return p != null && proche(p.valeur, o.poids_a_vide) && p.unite === o.unite_masse;
  }, { message: "le poids inscrit n'est pas celui que porte la citation", path: ["specifications", "preuve_poids", "valeur_textuelle"] })
  /* LA CONVERSION, ensuite : normalisées = conversion mécanique des originales. */
  .refine((m) => {
    const o = m.specifications.valeurs_originales, n = m.specifications.normalisees_cm_kg;
    return proche(n.l, versCm(o.l, o.unite_longueur)) && proche(n.w, versCm(o.w, o.unite_longueur))
      && proche(n.h, versCm(o.h, o.unite_longueur))
      && proche(n.poids_a_vide_kg, versKg(o.poids_a_vide, o.unite_masse));
  }, { message: "les valeurs normalisées ne sont pas la conversion des valeurs originales", path: ["specifications", "normalisees_cm_kg"] })
  /* `review_due` est DÉRIVÉE de la cadence « equipment » (365 j) — sur LES TROIS citations, la
     déclaration du fabricant comprise : une réserve de conformité vieillit comme un chiffre. */
  .refine((m) => [
    m.specifications.preuve_dimensions.citation,
    m.specifications.preuve_poids.citation,
    ...(m.declaration_fabricant ? [m.declaration_fabricant.citation] : []),
  ].every((c) => c.review_due === reviewDueFrom(c.verified_date, "equipment")), {
    message: "`review_due` doit être reviewDueFrom(verified_date, « equipment ») sur CHAQUE citation, déclaration du fabricant comprise",
    path: ["specifications", "preuve_poids", "citation", "review_due"],
  });
export type ModeleCaisse = z.infer<typeof ModeleCaisse>;

/**
 * UN PROFIL PUBLIE UN POIDS OU IL N'EN PUBLIE PAS. La règle vient de l'arbitrage : deux à quatre
 * modèles, dont au moins DEUX FABRICANTS DISTINCTS. Un seul fabricant décrit sa gamme, pas le
 * marché ; et un champ de confiance ne remplace pas des observations manquantes.
 *
 * AUCUNE ENVELOPPE DE DIMENSIONS. Prendre séparément les minima et maxima de longueur, largeur et
 * hauteur fabriquerait une caisse composite qu'aucun fabricant ne vend, et l'adéquation d'un chien
 * s'y jugerait contre un objet inexistant. Les dimensions restent PAR MODÈLE ; seul le poids à
 * vide s'agrège.
 */
export const ProfilCaisse = z.object({
  id: z.string().regex(/^[a-z]+_[a-z0-9]+$/, "identifiant « type_taille » attendu (ex. rigide_xl)"),
  modeles: z.array(z.string()).max(4),
  publiable: z.boolean(),
  poids_kg: z.object({
    min: positif, max: positif,
    arrondi: z.tuple([positif, positif]),
    derive_de: z.literal("min/max des poids à vide normalisés des modèles cités"),
  }).strict().optional(),
}).strict()
  .refine((p) => !p.publiable || (p.modeles.length >= 2 && p.poids_kg != null), {
    message: "un profil publiable exige au moins deux modèles et un intervalle dérivé", path: ["publiable"],
  })
  .refine((p) => p.publiable || p.poids_kg == null, {
    message: "un profil NON publiable ne porte aucun poids : un intervalle présent serait affiché tôt ou tard",
    path: ["poids_kg"],
  })
  .refine((p) => p.poids_kg == null || p.poids_kg.min <= p.poids_kg.max, {
    message: "intervalle inversé", path: ["poids_kg"],
  });
export type ProfilCaisse = z.infer<typeof ProfilCaisse>;

/**
 * La correspondance race → profils est une HYPOTHÈSE MyDogCanFly, et le champ le dit. Sans les
 * mesures réelles du chien — que la méthode de dimensionnement exige —, elle ne peut jamais être
 * présentée comme une certitude. Plusieurs profils adjacents valent mieux qu'une fausse précision.
 */
export const CorrespondanceRace = z.object({
  breed_id: z.string().min(1),
  profils_probables: z.array(z.string()).min(1),
  methode: z.string().min(1),
  confiance: z.number().int().min(1).max(5),
  nature: z.literal("hypothèse MyDogCanFly — les mesures réelles du chien priment"),
}).strict();
export type CorrespondanceRace = z.infer<typeof CorrespondanceRace>;

/* Le commentaire de tête est DÉCLARÉ : les registres sont `.strict()`, et une prose qui
   explique le fichier ne doit pas se faire refuser — ni passer par un trou laissé ouvert. */
const commentaire = z.string().min(1);
export const RegistreModeles = z.object({ schema: z.literal(1), _commentaire: commentaire, modeles: z.array(ModeleCaisse) }).strict();
export const RegistreProfils = z.object({ schema: z.literal(1), _commentaire: commentaire, profils: z.array(ProfilCaisse) }).strict();
export const RegistreCorrespondances = z.object({ schema: z.literal(1), _commentaire: commentaire, correspondances: z.array(CorrespondanceRace) }).strict();

/**
 * LA DÉRIVATION — la seule façon dont un intervalle de profil peut naître.
 * Rend `{ profil }` ou `{ refus }` : un profil qui ne peut pas publier le dit, il ne devine pas.
 */
export function deriverProfil(id: string, modeles: ModeleCaisse[]): { profil: ProfilCaisse } | { refus: string } {
  if (modeles.length < 2) return { refus: `${id} : ${modeles.length} modèle(s) — deux au minimum pour publier un intervalle` };
  if (modeles.length > 4) return { refus: `${id} : ${modeles.length} modèles — quatre au maximum, au-delà l'intervalle cesse d'être lisible` };
  const fabricants = new Set(modeles.map((m) => m.fabricant.toLowerCase()));
  if (fabricants.size < 2) {
    return { refus: `${id} : un seul fabricant (${[...fabricants][0]}) — un fabricant décrit sa gamme, pas le marché` };
  }
  const poids = modeles.map((m) => m.specifications.normalisees_cm_kg.poids_a_vide_kg);
  const min = Math.min(...poids), max = Math.max(...poids);
  return {
    profil: {
      id, modeles: modeles.map((m) => m.id), publiable: true,
      poids_kg: { min, max, arrondi: [Math.floor(min), Math.ceil(max)],
                  derive_de: "min/max des poids à vide normalisés des modèles cités" },
    },
  };
}

/**
 * L'INTERVALLE « ANIMAL + CAISSE », et ses trois issues.
 * `poidsChienSaisi` : le poids DONNÉ par le visiteur. Un poids déduit de la race ne peut pas
 * ouvrir un calcul monétaire — les 172 poids de race sont des valeurs ponctuelles, sans la
 * provenance qu'un chiffre affiché comme tarif exigerait.
 */
export function intervalleTotal(
  poidsChienSaisi: number | null,
  caisse: { min: number; max: number } | null,
): { total: [number, number] } | { refus: string } {
  if (poidsChienSaisi == null) return { refus: "poids du chien non saisi : aucune estimation numérique" };
  if (!(poidsChienSaisi > 0)) return { refus: "poids du chien invalide" };
  if (caisse == null) return { refus: "aucun poids de caisse disponible : ni saisi, ni profil publiable" };
  return { total: [poidsChienSaisi + caisse.min, poidsChienSaisi + caisse.max] };
}

/**
 * Une tranche couvre-t-elle TOUT l'intervalle ? C'est la seule condition qui autorise une
 * estimation. Si l'intervalle traverse la limite, il n'y a pas de « valeur la plus probable » :
 * il y a deux réponses possibles, et le dire est la seule honnête.
 */
export function trancheUnique(total: [number, number], limites: number[]): { couverte: true } | { traverse: number } {
  for (const limite of [...limites].sort((a, b) => a - b)) {
    if (total[0] <= limite && limite < total[1]) return { traverse: limite };
  }
  return { couverte: true };
}

/** Le contrat de provenance réutilisé, ré-exporté pour que les registres n'en inventent pas d'autre. */
export { Source, SourcedQuote };

/**
 * LE VALIDATEUR DES TROIS REGISTRES — en production, appelé par la CI ET par les consommateurs.
 *
 * Les boucles d'un harnais ne remplacent pas un validateur : elles ne tournent que là où on a
 * pensé à les écrire. Ce qui suit vit à côté des schémas, et tout ce qui lit les registres passe
 * par lui — un identifiant en double ou une référence morte n'a alors nulle part où se cacher.
 *
 * Rend la liste des écarts, chacun nommé. Vide = les trois registres se tiennent.
 */
export function verifierRegistresCaisses(
  modeles: ModeleCaisse[],
  profils: ProfilCaisse[],
  correspondances: CorrespondanceRace[],
): string[] {
  const ecarts: string[] = [];

  const doublons = (liste: string[], quoi: string) => {
    const vus = new Set<string>(), deja = new Set<string>();
    for (const id of liste) { if (vus.has(id) && !deja.has(id)) { deja.add(id); ecarts.push(`${quoi} : identifiant « ${id} » en double`); } vus.add(id); }
    return vus;
  };
  const idsModeles = doublons(modeles.map((m) => m.id), "modèles");
  const idsProfils = doublons(profils.map((p) => p.id), "profils");
  doublons(correspondances.map((c) => c.breed_id), "correspondances");

  /* Les références croisées, dans le sens qui compte : un profil qui cite un modèle absent
     publierait un intervalle tiré de rien. */
  for (const p of profils) {
    for (const id of p.modeles) if (!idsModeles.has(id)) ecarts.push(`profil « ${p.id} » : modèle « ${id} » absent du registre des modèles`);
    if (!p.publiable) continue;
    const siens = p.modeles.map((id) => modeles.find((m) => m.id === id)).filter((m): m is ModeleCaisse => m != null);
    const derive = deriverProfil(p.id, siens);
    if ("refus" in derive) { ecarts.push(`profil « ${p.id} » publiable mais non dérivable — ${derive.refus}`); continue; }
    if (JSON.stringify(derive.profil.poids_kg) !== JSON.stringify(p.poids_kg)) {
      ecarts.push(`profil « ${p.id} » : intervalle inscrit ${JSON.stringify(p.poids_kg)}, intervalle DÉRIVÉ ${JSON.stringify(derive.profil.poids_kg)} — le registre ne suit pas ses modèles`);
    }
  }
  for (const c of correspondances) {
    for (const id of c.profils_probables) if (!idsProfils.has(id)) ecarts.push(`correspondance « ${c.breed_id} » : profil « ${id} » absent du registre des profils`);
  }
  return ecarts;
}
