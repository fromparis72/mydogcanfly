// Central legal / entity constants for MyDogCanFly.
// Publisher is the same US entity as the sister site B2BVENUES (same team).
// NOTE for maintainers: if MyDogCanFly is moved to a dedicated LLC, update PUBLISHER + ADDRESS here only.
export const LEGAL = {
  site: "MyDogCanFly",
  domain: "mydogcanfly.com",
  url: "https://mydogcanfly.com",
  publisher: "B2B VENUES LLC",
  entityType: "Delaware limited liability company (USA)",
  addressLine: "501 Silverside Rd, Ste 105",
  addressCity: "Wilmington",
  addressRegion: "DE",
  addressZip: "19809",
  addressCountry: "USA",
  state: "Delaware",
  director: "Phil Albert-Benoist",
  linkedin: "https://www.linkedin.com/in/phil-e-albert-benoist-b6b876419",
  contactEmail: "contact@mydogcanfly.com",
  pressEmail: "press@mydogcanfly.com",
  /** Adresse dédiée aux partenariats, distincte du contact général. Vérifiée dans Cloudflare
   *  Email Routing le 30/07/2026 : règle active, redirigée comme les autres. Ne publier une
   *  adresse qu'après l'avoir vue dans les règles — le catch-all a longtemps été réglé sur
   *  « Drop », c'est-à-dire acceptation puis destruction silencieuse, sans avis à l'expéditeur. */
  partnershipsEmail: "partnerships@mydogcanfly.com",
  youtube: "https://www.youtube.com/channel/UCd0iDm_V-ZzJeTwcfL6fvfQ",
  instagram: "https://www.instagram.com/mydogcanfly/",
  tiktok: "https://www.tiktok.com/@mydogcanfly72",
  x: "https://x.com/Mydogcanfly72",
  host: "Cloudflare, Inc.",
  hostAddress: "101 Townsend Street, San Francisco, CA 94107, USA",
  hostService: "Cloudflare Pages",
  lastUpdated: "16 July 2026",
  lastUpdatedFr: "16 juillet 2026",
} as const;

export const fullAddress = `${LEGAL.addressLine}, ${LEGAL.addressCity}, ${LEGAL.addressRegion} ${LEGAL.addressZip}, ${LEGAL.addressCountry}`;

/* Les comptes officiels, dans l'ordre où le pied de page les affiche.
 *
 * Cette liste alimente `sameAs` en JSON-LD. Jusqu'au 01/08/2026 `sameAs` ne déclarait que le
 * LinkedIn du fondateur, alors que le pied de page pointait vers quatre réseaux : le site
 * affirmait donc une identité plus étroite que celle qu'il exposait. `sameAs` est le
 * mécanisme par lequel moteurs et moteurs de réponse rattachent un domaine récent à des
 * profils établis — c'est la déclaration d'identité la moins chère qui existe, et elle était
 * aux trois quarts vide.
 *
 * Règle : n'inscrire ici qu'un profil qu'on contrôle réellement et qui renvoie vers le site.
 * Un `sameAs` vers un compte qui ne vous appartient pas est une fausse déclaration. */
export const OFFICIAL_PROFILES: readonly string[] = [
  LEGAL.youtube,
  LEGAL.instagram,
  LEGAL.tiktok,
  LEGAL.x,
  LEGAL.linkedin,
];

/** L'adresse au format schema.org — celle de l'éditeur, identique aux mentions légales. */
export const postalAddressLd = {
  "@type": "PostalAddress",
  streetAddress: LEGAL.addressLine,
  addressLocality: LEGAL.addressCity,
  addressRegion: LEGAL.addressRegion,
  postalCode: LEGAL.addressZip,
  addressCountry: "US",
} as const;
