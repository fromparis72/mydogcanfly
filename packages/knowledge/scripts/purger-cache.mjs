#!/usr/bin/env node
/**
 * PURGE DU CACHE DE BORD, APRÈS DÉPLOIEMENT.
 *
 * POURQUOI CE SCRIPT EXISTE (13/09/2026). Une règle de cache « HTML — cache everything » a été
 * créée ce jour-là dans la zone Cloudflare : le HTML est désormais servi depuis le bord pendant
 * 24 h, avec sept jours de `stale-while-revalidate`. C'est ce qui rend les 3 121 pages tenables
 * pour le budget d'exploration de Google — mais c'est aussi ce qui fait qu'une correction
 * publiée cesse d'être visible immédiatement.
 *
 * Cloudflare Pages purge son propre cache d'actifs en déployant. Les objets stockés par une
 * RÈGLE DE ZONE relèvent d'un autre mécanisme, et rien ne garantit qu'un déploiement les
 * évince. Plutôt que de parier là-dessus à chaque mise en ligne, on purge explicitement.
 *
 * PURGE TOTALE ET NON PAR URL, délibérément : un déploiement touche le gabarit partagé, donc
 * potentiellement chaque page. Énumérer les URL modifiées serait plus fin, plus lent, et faux
 * le jour où une correction de gabarit passe inaperçue dans la liste.
 *
 * CE QU'IL FAUT POUR QUE ÇA MARCHE, et qui n'est pas dans le dépôt : un jeton d'API Cloudflare
 * portant la permission « Zone · Cache Purge · Purge », exporté dans l'environnement sous
 * CLOUDFLARE_PURGE_TOKEN. Il se crée sur https://dash.cloudflare.com/profile/api-tokens.
 * Ce jeton n'est PAS celui de wrangler : `wrangler login` produit un jeton OAuth qui ne sert
 * pas l'API REST de purge.
 *
 * DEUX MODES D'ÉCHEC, TRAITÉS DIFFÉREMMENT, et c'est le cœur de ce fichier.
 *
 *   · Jeton ABSENT → on avertit bruyamment et on rend la main SANS échouer. Le déploiement,
 *     lui, a réussi ; faire rougir `release` après une mise en ligne réussie ferait croire à un
 *     déploiement raté, ce qui est un mensonge plus coûteux qu'une purge oubliée.
 *   · Jeton PRÉSENT mais purge REFUSÉE → on échoue, code de sortie 1. Là, le site est en ligne
 *     ET le cache sert peut-être l'ancienne version : personne ne doit pouvoir ignorer ça en
 *     regardant défiler la console.
 *
 * Dans les deux cas le message donne la manœuvre manuelle, parce qu'un avertissement qui ne dit
 * pas quoi faire ne vaut pas mieux que le silence.
 */
const ZONE = process.env.CLOUDFLARE_ZONE_ID ?? "fc9f0d3d42813c414f05c0a91e5efa18"; // mydogcanfly.com
const JETON = process.env.CLOUDFLARE_PURGE_TOKEN ?? "";
const MANUEL =
  "  Purge manuelle : tableau de bord Cloudflare → mydogcanfly.com → Caching → Configuration\n" +
  "                   → Purge Cache → Purge Everything.";

const dire = (s) => process.stdout.write(s + "\n");

if (!JETON) {
  dire("");
  dire("⚠  CACHE NON PURGÉ — aucun jeton dans CLOUDFLARE_PURGE_TOKEN.");
  dire("");
  dire("  Le déploiement a réussi. Mais depuis le 13/09/2026 une règle de zone garde le HTML");
  dire("  jusqu'à 24 h au bord : sans purge, les visiteurs et Googlebot peuvent continuer de");
  dire("  recevoir la version précédente.");
  dire("");
  dire(MANUEL);
  dire("");
  dire("  Pour automatiser : créer un jeton « Zone · Cache Purge · Purge » sur");
  dire("  https://dash.cloudflare.com/profile/api-tokens, puis l'exporter dans le shell");
  dire("  sous CLOUDFLARE_PURGE_TOKEN.");
  dire("");
  process.exit(0);
}

const reponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`, {
  method: "POST",
  headers: { Authorization: `Bearer ${JETON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ purge_everything: true }),
}).catch((e) => ({ ok: false, status: 0, json: async () => ({ errors: [{ message: e.message }] }) }));

const corps = await reponse.json().catch(() => ({}));

if (reponse.ok && corps?.success) {
  dire("✓ cache de bord purgé — la version qui vient d'être déployée est celle qui sera servie.");
  process.exit(0);
}

dire("");
dire("✗ LE SITE EST EN LIGNE, MAIS LE CACHE N'A PAS ÉTÉ PURGÉ.");
dire("");
dire(`  Réponse de Cloudflare : ${reponse.status} ${JSON.stringify(corps?.errors ?? corps)}`);
dire("");
dire("  Tant que la purge n'a pas eu lieu, le bord peut servir la version précédente pendant");
dire("  24 h. Ce n'est pas un échec de déploiement — c'est un écart entre ce qui est publié et");
dire("  ce qui est servi.");
dire("");
dire(MANUEL);
dire("");
process.exit(1);
