#!/usr/bin/env node
/* Page 11 : la parole de Bailey — texte définitif, coupes définitives, bord de photo fondu.
 *
 * TEXTE. Le français est celui de Philippe, au mot et à la ponctuation près. Les « !! » et le
 * « :-) » ne sont pas des scories : ce sont les marques d'oralité qui font qu'un chien semble
 * parler. Bailey vole depuis ses TROIS mois, la mention « mâle » a disparu, l'eau était à 32°.
 *
 * COUPES. Chaque paragraphe est coupé en deux par un <br>, aux endroits qu'il a indiqués. Ce
 * n'est pas de la mise en page, c'est du souffle : « Je voyage depuis mes 3 mois !! » ou « Tout
 * en restant propre (ça se travaille !) » sont des chutes, et une chute posée sur sa propre ligne
 * s'entend. Elles coûtent cher en hauteur — voir plus bas — et elles les valent.
 *
 * LA FIN. Corrigée sur un point de vérité : il n'y a pas de porte qui s'ouvre. Bailey est en
 * soute, il ne voit pas la scène que la première version décrivait. Ne reste donc que le fait,
 * qui suffit : il retrouve son maître. Puis une phrase courte pour le message, et un cœur.
 *
 * CORPS. 2,05cqh, un cran au-dessus de la page 10. Une première version était descendue à 1,6cqh sur un
 * calcul de tenue fait à la main — Chromium ne démarre pas dans mon bac à sable, je ne peux pas
 * rendre la page. Le rendu réel a montré que ce calcul surestimait la largeur des caractères
 * d'environ un tiers : le texte tenait en quatorze lignes et laissait un quart de page vide.
 * La leçon est simple et vaut pour la suite : sur cette page, mesurer sur une capture plutôt
 * que raisonner sur des moyennes.
 *
 * BORD DE PHOTO. La photo commence à 40 % sur une arête franche : son masque elliptique la laisse
 * à environ 69 % d'opacité à cet endroit, si bien qu'elle apparaît d'un coup. Un voile de 80 px
 * la fait naître du fond. C'est un calque posé PAR-DESSUS, en dégradé du fond de page vers le
 * transparent, et non un second masque sur l'image : les masques composés se rendent diversement
 * d'un moteur à l'autre, et cette page part à l'impression. Le voile est incliné du même angle
 * que la photo — sans quoi il ne recouvre le bord qu'à mi-hauteur — et il commence par un palier
 * opaque qui recouvre le bord franc avant que le fondu ne s'ouvre.
 *
 * Rejouable : le bloc de texte et le voile sont remplacés s'ils existent déjà.
 *
 *   node packages/knowledge/scripts/presskit-p11-bailey-texte.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
const dry = process.argv.includes("--dry");
const PAGE = 10;

const FOND = "#F4F6FA";       // fond de la page 11
/* 2,05cqh, soit 8 % de plus que la page 10. Le texte de Bailey est plus court que celui de
 * Philippe et sa colonne est plus étroite ; à corps égal, il paraissait plus petit qu'il ne
 * l'était — un bloc étroit et dense se lit toujours comme du petit texte.
 *
 * L'interligne descend en compensation de 1,52 à 1,48, et l'écart entre paragraphes de 1,4 à
 * 1,3cqh. Le bloc grandit donc beaucoup moins que les caractères : c'est ce qui permet
 * d'agrandir sans pousser la signature hors de la page. 1,48 reste confortable — en dessous de
 * 1,40 les lignes commenceraient à se toucher. */
const CORPS = "font-size:2.05cqh;line-height:1.48;color:#5A6B84";
/* Deux lignes sautées avant le premier paragraphe. Volontairement laissé à 7cqh alors que deux
 * interlignes de 1,9cqh en vaudraient 8 : la page est pleine, et ce sont les deux centimètres
 * qui font la différence entre un texte qui tient et un texte qui pousse la signature. */
const MARGE_HAUT = "7cqh";
const PHOTO_GAUCHE = "40%";
/* Le voile a un PALIER OPAQUE avant de commencer à s'estomper. C'est ce qui règle le liseré,
 * et la mesure sur capture le montre : à mi-hauteur de page, là où le masque elliptique est le
 * plus dense, le bord de la photo produisait une marche de 5 niveaux sur 255 en deux pixels.
 *
 * La cause n'était pas un décalage mais la forme du dégradé. L'image a un bord FRANC, opaque à
 * environ 69 % ; un dégradé qui part de 100 % pile sur ce bord ne le masque qu'au tout premier
 * pixel, et dès le deuxième il laisse passer un quart de la marche. Reculer la bande n'y change
 * rien : le bord reste dans la zone où le voile a déjà commencé à s'ouvrir.
 *
 * D'où le palier : le voile est TOTALEMENT opaque de son départ jusqu'à 18 px APRÈS le bord de
 * la photo. Le bord franc est donc recouvert par du fond pur, et le fondu ne commence que sur
 * de la matière continue, où il n'y a plus aucune marche à masquer. La photo paraît démarrer
 * 18 px plus à droite — quatre millimètres, invisibles. */
const VOILE_DEBORD = 8;    // px à gauche du bord de la photo
const VOILE_PALIER = 18;   // px opaques APRÈS le bord — c'est eux qui effacent le liseré
/* Le fondu est ramené de 80 à 60 px. Le voile mordait sur l'arrière du chien et l'image y
 * perdait en lisibilité ; l'emprise totale à l'intérieur de la photo passe de 98 à 78 px, soit
 * un demi-centimètre regagné. C'est le FONDU qu'on raccourcit, jamais le palier : c'est lui qui
 * efface le bord franc, et le rogner ferait revenir le liseré. */
const VOILE_FONDU = 60;    // px de fondu proprement dit
const VOILE_PX = VOILE_DEBORD + VOILE_PALIER + VOILE_FONDU;
const COEUR = `<span style="color:#EE7C1B">♥</span>`;

/* La patte qui suit le cœur.
 *
 * C'est un SVG dessiné ici, et non le caractère 🐾. La raison est décisive : les emoji sont
 * rendus par une police EN COULEUR, la patte serait donc marron, jamais orange. Son dessin
 * change en outre d'un système à l'autre, ce qui n'est pas tenable sur un document imprimé.
 * Un SVG, lui, s'aligne sur le corps du texte et prend exactement la couleur qu'on lui donne.
 *
 * L'os et la tête de chien ont été essayés puis retirés : quatre signes à la suite d'une phrase
 * de fin, cela cesse d'être une signature pour devenir une frise. Deux suffisent, et l'orange
 * commun au cœur et à la patte les lie en un seul geste au lieu de deux ornements séparés. */
const ORANGE = "#EE7C1B";
const PATTE =
  `<svg viewBox="0 0 24 24" aria-hidden="true" style="height:1.75cqh;width:1.75cqh;` +
  `vertical-align:-.18em;margin-left:.42em;fill:${ORANGE}">` +
  `<ellipse cx="5.4" cy="10.2" rx="2.4" ry="3.1"/><ellipse cx="10.2" cy="6.5" rx="2.5" ry="3.3"/>` +
  `<ellipse cx="15.6" cy="6.7" rx="2.5" ry="3.3"/><ellipse cx="20.2" cy="10.8" rx="2.3" ry="3"/>` +
  `<path d="M12.8 12.4c3.4 0 6.2 2.6 6.2 5.4 0 2.2-1.9 3.4-4 3.4-1.1 0-1.6-.4-2.2-.4s-1.1.4-2.2.4` +
  `c-2.1 0-4-1.2-4-3.4 0-2.8 2.8-5.4 6.2-5.4z"/></svg>`;

const SYMBOLES = PATTE;

/* La colonne de polaroïds glisse de 80 px vers la droite pour dégager la plage. Un
 * `translateX` plutôt qu'un `right` recalculé : la valeur reste lisible, et le jour où elle ne
 * convient plus il n'y a qu'un nombre à changer. La pile déborde donc du bord droit comme elle
 * débordait déjà du haut et du bas — c'est la logique de départ, une série qu'on ne voit pas finir. */
/* Le titre passe de 5 à 4,6cqh. Sans cela « Notre bêta-testeur » ne tient plus dans la colonne
 * — elle est passée de 46 à 38,5 % — et Chromium coupe au trait d'union : « Notre bêta- /
 * testeur a 4 pattes ». La couleur orange démarrait alors au milieu d'une ligne, ce qui défait
 * l'effet à deux temps du titre.
 *
 * Réduire ne suffisait pas : `doc-page.js` impose `text-wrap: balance` à tous les titres, et
 * l'équilibrage préfère « Notre bêta- / testeur a 4 pattes » (160 et 234 px) à « Notre
 * bêta-testeur / a 4 pattes » (309 et 129), parce qu'il minimise la ligne la plus longue. Un
 * <br> explicite avant la partie orange règle la question quelle que soit la langue.
 *
 * 4,4cqh est dicté par l'espagnol : « Nuestro probador beta » mesure 379 px pour 380 disponibles
 * à 4,6cqh — un pixel de marge, donc aucune. À 4,4cqh il tombe à 362. Mesuré au navigateur, pas
 * estimé. */
const TITRE = "4.4cqh";
const SELFIES_DROITE = 50;   // 80 px sortaient trop la pile de la page
/* La signature se cale sur le BORD DROIT DE LA COLONNE, comme celle de Philippe en page 10 —
 * pas sur le bord droit de la page, qui la jetterait par-dessus la photo. D'où la largeur
 * reprise de la colonne de texte, lue dans la page plutôt que recopiée en dur. */
const SIGNATURE = "margin-top:auto;padding-top:2.4cqh;text-align:right";

/* Chaque paragraphe est une LISTE de segments, séparés par un retour forcé. La liste, plutôt
 * qu'une paire : « Autant dire que l'avion fait partie de ma vie depuis toujours. » est remontée
 * dans le premier paragraphe, qui en compte donc trois, et la coupe est descendue APRÈS elle.
 * Le gain est réel — la phrase conclut la présentation au lieu d'ouvrir un développement sur la
 * soute, où elle n'avait rien à faire.
 *
 * « à peu près » est retiré : « depuis toujours » dit la même chose et le dit mieux. Les trois
 * traductions perdent leur équivalent — « about », « casi », « praticamente ».
 *
 * La phrase finale — « L'important dans le voyage… » — devient un PARAGRAPHE à part entière et
 * non plus une ligne de la précédente. C'est juste : ce n'est pas la suite du raisonnement sur
 * les retrouvailles, c'est ce qu'on en retient. Isolée, elle se lit comme une signature.
 *
 * Le point d'exclamation de « envie de rentrer ! » aligne la chute mexicaine sur celles des
 * autres paragraphes. En espagnol il entraîne son ¡ ouvrant, placé au début de la proposition
 * exclamative et non de la phrase entière. */
/* Le français veut une espace avant « ! ? : » — et cette espace est une occasion de coupure.
 * Sans insécable, « ensemble ! ♥ 🐾 » se retrouvait seul sur sa ligne, la phrase finissant sur
 * « ensemble ». Les autres langues ne prennent pas cette espace et ne sont donc pas concernées. */
const fine = (s) => s.replace(/ ([!?:;])/g, "&nbsp;$1");

const TEXTE = {
  fr: [
    ["Je m'appelle Bailey, je suis un Golden Retriever de 4 ans.",
     "Je voyage depuis mes 3 mois !!",
     "Autant dire que l'avion fait partie de ma vie depuis toujours."],
    ["Vu mon gabarit, ma place est en soute, dans ma caisse.",
     "J'ai eu la chance d'y être habitué très jeune, et ça change tout : aujourd'hui j'y entre tranquillement, je m'installe, et j'essaye de",
     "dormir malgré le bruit :-)"],
    ["J'ai déjà fait des trajets de plus de 18 heures de porte à porte,",
     "tout en restant propre (ça se travaille !)"],
    ["Le plus loin ? Le Mexique, pour les plages de la photo, juste à côté.",
     "L'eau était à 32°, le sable brûlant, et je crois que je n'ai jamais eu aussi peu envie de rentrer !"],
    ["Mais le meilleur moment du voyage, ce n'est ni le décollage ni la plage : c'est celui où je retrouve mon maître, à destination ou au retour à la maison !"],
    [`L'important dans le voyage, c'est surtout de partir ensemble !&nbsp;${COEUR}${SYMBOLES}`],
  ],
  en: [
    ["My name is Bailey, I'm a 4-year-old Golden Retriever.",
     "I've been flying since I was 3 months old!!",
     "So you could say planes have been part of my life for as long as I can remember."],
    ["Given my size, my place is in the hold, in my crate.",
     "I was lucky enough to get used to it very young, and that changes everything: today I walk in calmly, settle down, and try to",
     "sleep despite the noise :-)"],
    ["I've done door-to-door journeys of more than 18 hours,",
     "while staying clean the whole way (it takes practice!)"],
    ["The furthest? Mexico, for the beaches in the photo, right beside this.",
     "The water was 32°, the sand was scorching, and I don't think I've ever wanted to go home less!"],
    ["But the best moment of a trip is neither the take-off nor the beach: it's the one where I find my human again, at the destination or back home!"],
    [`What matters most is setting off together!&nbsp;${COEUR}${SYMBOLES}`],
  ],
  es: [
    ["Me llamo Bailey, soy un Golden Retriever de 4 años.",
     "¡¡Viajo desde los 3 meses!!",
     "Vamos, que el avión forma parte de mi vida desde siempre."],
    ["Por mi tamaño, mi sitio está en la bodega, dentro de mi transportín.",
     "Tuve la suerte de acostumbrarme muy pronto, y eso lo cambia todo: hoy entro tranquilo, me acomodo e intento",
     "dormir a pesar del ruido :-)"],
    ["He hecho trayectos de más de 18 horas de puerta a puerta,",
     "y sin ensuciar nada (¡eso se entrena!)"],
    ["¿Lo más lejos? México, por las playas de la foto, justo al lado.",
     "El agua estaba a 32°, la arena ardiendo, ¡y creo que nunca he tenido tan pocas ganas de volver!"],
    ["Pero el mejor momento del viaje no es el despegue ni la playa: es aquel en que vuelvo a encontrar a mi dueño, ¡al llegar a destino o de vuelta en casa!"],
    [`Lo importante del viaje es, sobre todo, partir juntos.&nbsp;${COEUR}${SYMBOLES}`],
  ],
  pt: [
    ["Meu nome é Bailey, sou um Golden Retriever de 4 anos.",
     "Viajo desde os 3 meses!!",
     "Ou seja, o avião faz parte da minha vida desde sempre."],
    ["Pelo meu porte, meu lugar é no porão, dentro da minha caixa de transporte.",
     "Tive a sorte de me acostumar bem cedo, e isso muda tudo: hoje eu entro tranquilo, me ajeito e tento",
     "dormir apesar do barulho :-)"],
    ["Já fiz viagens de mais de 18 horas de porta a porta,",
     "e cheguei limpinho (isso se treina!)"],
    ["O mais longe? O México, pelas praias da foto, bem ao lado.",
     "A água estava a 32°, a areia quente, e acho que nunca tive tão pouca vontade de voltar!"],
    ["Mas o melhor momento da viagem não é a decolagem nem a praia: é aquele em que reencontro meu dono, no destino ou de volta em casa!"],
    [`O mais importante na viagem é partir juntos!&nbsp;${COEUR}${SYMBOLES}`],
  ],
};

const VOILE_MARQUE = "data-voile";
/* Le voile est INCLINÉ COMME LA PHOTO. Une bande verticale posée contre un bord penché de 2,2°
 * ne recouvre le bord qu'à mi-hauteur : elle laisse une arête franche en haut et déborde de
 * huit millimètres en bas, ce qui se lit comme une découpe et non comme un fondu. L'angle n'est
 * pas écrit en dur ici, il est RELU sur la photo — si la photo est un jour redressée, le voile
 * suit. La bande est haute de 110 % pour que la rotation ne dégarnisse ni le haut ni le bas. */
const voile = (angle) =>
  `<div ${VOILE_MARQUE} style="position:absolute;z-index:1;left:calc(${PHOTO_GAUCHE} - ${VOILE_DEBORD}px);top:-5%;height:110%;` +
  `width:${VOILE_PX}px;pointer-events:none;transform:rotate(${angle});` +
  `background:linear-gradient(to right,${FOND} 0px,${FOND} ${VOILE_DEBORD + VOILE_PALIER}px,` +
  `rgba(244,246,250,.72) ${VOILE_DEBORD + VOILE_PALIER + VOILE_FONDU * 0.42}px,` +
  `rgba(244,246,250,0) ${VOILE_PX}px)"></div>`;

let faits = 0;
for (const langue of ["en", "fr", "es", "pt"]) {
  const path = `${DIR}/press-kit-${langue}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  const html = readFileSync(path, "utf-8");
  const pages = html.match(/<section class="page"[^>]*>[\s\S]*?<\/section>/g) ?? [];
  if (pages.length !== 13) { console.error(`✗ ${langue} : ${pages.length} pages au lieu de 13`); process.exit(1); }
  const p = pages[PAGE];
  const echec = (quoi) => { console.error(`✗ ${langue} : ${quoi} — rien n'est écrit.`); process.exit(1); };
  if (!p.includes("assets/photos/france.jpg") || !p.includes("bailey-holbox")) echec(`la page ${PAGE + 1} n'est pas celle de Bailey`);

  let q = p;

  /* 1. Le voile, juste après la photo. On retire d'abord celui d'une passe précédente. */
  q = q.replace(new RegExp(`\\s*<div ${VOILE_MARQUE}[^>]*></div>`, "g"), "");
  const img = /(<img src="assets\/photos\/bailey-holbox[^"]*"[^>]*>)/;
  const balise = img.exec(q);
  if (!balise) echec("photo de Holbox introuvable");
  const angle = /transform:rotate\((-?[\d.]+deg)\)/.exec(balise[1])?.[1];
  if (!angle) echec("inclinaison de la photo illisible");
  q = q.replace(img, `$1\n  ${voile(angle)}`);

  /* 2. Le titre, réduit pour retrouver sa coupe. */
  const h2 = /(<h2 style="[^"]*font-size:)([\d.]+cqh)/;
  if (!h2.test(q)) echec("titre de la page introuvable");
  q = q.replace(h2, `$1${TITRE}`);
  /* Coupe explicite avant la partie orange, sans jamais en poser deux. */
  q = q.replace(/(<h2[^>]*>[\s\S]*?)(?:<br>)?\s*(<span style="color:#EE7C1B">)/, "$1<br>$2");

  /* 3. La colonne de polaroïds, décalée vers la droite. Idempotent : un décalage déjà posé est
   *    remplacé, jamais cumulé. */
  const pile = /(<div style="position:absolute;z-index:1;right:6%;[^"]*?)(?:;transform:translateX\(\d+px\))?(">)/;
  if (!pile.test(q)) echec("colonne de polaroïds introuvable");
  q = q.replace(pile, `$1;transform:translateX(${SELFIES_DROITE}px)$2`);

  /* 4. La signature, alignée à droite de la colonne. */
  const largeur = /<div style="width:(\d+(?:\.\d+)?%)">/.exec(q)?.[1];
  if (!largeur) echec("colonne de texte introuvable");
  /* Tolère les deux formes : celle d'origine, et celle qu'une passe précédente a déjà posée. */
  const sig = /<div style="(?:width:[\d.]+%;)?margin-top:auto;padding-top:2\.4cqh[^"]*">/;
  if (!sig.test(q)) echec("bloc de signature introuvable");
  q = q.replace(sig, `<div style="width:${largeur};${SIGNATURE}">`);

  /* 5. Le texte. On remplace la suite CONTIGUË de <p> gris, quel que soit son découpage. */
  const bloc = /(?:<p style="margin:[^"]*color:#5A6B84">[\s\S]*?<\/p>)+/;
  if (!bloc.test(q)) echec("bloc de texte introuvable");
  q = q.replace(bloc, TEXTE[langue].map((brut, i) => {
    const segments = langue === "fr" ? brut.map(fine) : brut;
    return `<p style="margin:${i ? "1.3cqh" : MARGE_HAUT} 0 0;${CORPS}">${segments.join("<br>")}</p>`;
  }).join(""));
  if (!q.includes(PATTE)) echec("la patte a été abîmée par les insécables");

  if (!dry) writeFileSync(path, html.replace(p, q));
  faits++;
  console.log(`${langue} : ${TEXTE[langue].length} paragraphes, ` +
    `${TEXTE[langue].flat().length} segments, ${TEXTE[langue].flat().join(" ").length} signes`);
}
console.log(`\n${faits} plaquette(s) mise(s) à jour${dry ? " — essai à blanc" : ""}`);
