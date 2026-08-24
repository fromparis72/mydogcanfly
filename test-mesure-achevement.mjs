#!/usr/bin/env node
/**
 * LA VÉRIFICATION DU DOSSIER MORD DANS LES DEUX SENS : DOCUMENT ALTÉRÉ, ET DONNÉE QUI BOUGE.
 *
 *   node test-mesure-achevement.mjs
 *
 * POURQUOI. Deux P0 de contre-revue sur la v3 du dossier, le 24/08/2026 :
 *
 *   · « un fragment présent deux fois laisse passer l'altération » — la concordance cherchait des
 *     sous-chaînes avec `includes()`. Contre-épreuve de Codex : « 28/09/2026 » figurait dans la
 *     section fraîcheur ET dans le lot B ; altérer l'une des occurrences sortait en 0. Le dossier
 *     embarque désormais un BLOC CONTRACTUEL JSON unique, comparé au relevé à égalité exacte et
 *     dans les deux sens.
 *   · « le validateur de forme est partiel » — l'instrument exigeait trois champs là où le schéma
 *     canonique `Source` en contraint sept. Il réutilise désormais ce schéma, en bloquant.
 *
 * Ce harnais éprouve les deux fermetures — et il ne suffit pas que les mécanismes existent : il
 * faut les voir ROUGIR, classe d'écart par classe d'écart. Un vérificateur qu'on n'a jamais vu
 * rougir est un ornement.
 *
 * C'EST UNE PREUVE MANUELLE, DATÉE — comme `preuve-migration-categories.mjs`, et pour la même
 * raison : elle éprouve la livraison de CE dossier, pas un invariant permanent du dépôt. Elle
 * n'est délibérément pas câblée en CI.
 *
 * VINGT-ET-UN CAS, en trois familles :
 *
 *   DATES (5) — « 2026-02-31 », « 2026-13-01 », « 2027-02-29 » (non bissextile) : sortie 2 en
 *   nommant la date. « 2028-02-29 » (bissextile) : sortie 0 — sans ce cas, les trois premiers
 *   seraient satisfaits par un validateur qui refuse tout. Et le dossier réel, conforme : sortie 0.
 *
 *   DOCUMENT (5) — sur des COPIES du dossier : une valeur du bloc altérée d'un caractère ; une
 *   entrée supprimée du bloc ; une entrée inventée ajoutée au bloc ; le bloc dupliqué (doublon
 *   documentaire — lequel ferait foi ?) ; le bloc absent. Chaque cas : sortie 1, et le diagnostic
 *   nomme la classe d'écart.
 *
 *   DONNÉES (11) — dans un ARBRE DE TRAVAIL GIT jetable où l'on mute les données réelles :
 *   les cinq contre-épreuves minimales exigées par la contre-revue sur le schéma canonique —
 *   confiance absente, relecteur absent, type de source inconnu, date impossible, URL invalide —
 *   chacune : sortie 1, chemin et champ nommés. Puis une `review_due` déplacée vers une autre
 *   date VALIDE : le schéma passe, mais `--verifier-dossier` voit la donnée qui a bougé sous le
 *   bloc resté figé. Puis les trois mutations INVISIBLES AUX AGRÉGATS — URL valide remplacée,
 *   relecteur modifié, `verified_date` déplacée sans changer de tranche — que seule l'empreinte
 *   SHA-256 du registre exact peut voir, localisées par famille. Une source datée glissée sous un
 *   `history` HORS du contrat d'archive : bloquée et nommée, au lieu de disparaître du registre
 *   en silence. Enfin un contact dupliqué — même URL deux fois dans un même tableau — fait
 *   retomber une identité sur l'indice, et le compteur `identites_instables`, figé à 0 par le
 *   bloc, fait rougir la concordance.
 */
import { readFileSync, writeFileSync, copyFileSync, symlinkSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const AS_OF = "2026-08-23";
const DEBUT = "<!-- BLOC-CONTRACTUEL:debut -->";
const FIN = "<!-- BLOC-CONTRACTUEL:fin -->";

const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);
const lancer = (cwd, ...a) =>
  spawnSync("node", ["--import", "tsx", "mesurer-achevement.mjs", ...a], { cwd, encoding: "utf-8" });

/* ============================== DATES ========================================================= */

for (const d of ["2026-02-31", "2026-13-01", "2027-02-29"]) {
  const r = lancer(".", `--as-of=${d}`, "--json");
  if (r.status !== 2) echec(`date ${d}`, `sortie ${r.status} au lieu de 2 — la date impossible est acceptée`);
  if (!r.stderr.includes(d)) echec(`date ${d}`, "le diagnostic ne nomme pas la date refusée");
}
{
  const r = lancer(".", "--as-of=2028-02-29", "--json");
  if (r.status !== 0) echec("date 2028-02-29", `sortie ${r.status} — un 29 février bissextile est refusé à tort`);
}
{
  const r = lancer(".", `--as-of=${AS_OF}`, "--verifier-dossier");
  if (r.status !== 0) {
    echec("dossier conforme", `sortie ${r.status} — la vérification échoue sur le dossier réel :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
  }
}

/* ============================== DOCUMENT ====================================================== */

const dossier = readFileSync("DOSSIER-ACHEVEMENT-PROJET.md", "utf-8");
const [avantBloc, reste] = dossier.split(DEBUT);
const [dedans, apresBloc] = reste.split(FIN);
const blocJson = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(dedans)[1]);
const copie = (o) => JSON.parse(JSON.stringify(o));
const remonter = (bloc) => `${DEBUT}\n\`\`\`json\n${JSON.stringify(bloc, null, 2)}\n\`\`\`\n${FIN}`;

/** Écrit une variante du dossier et lance `--verifier-dossier` dessus. */
const casDocument = (nom, contenu, motifAttendu) => {
  const base = mkdtempSync(join(tmpdir(), "dossier-altere-"));
  const chemin = join(base, "DOSSIER.md");
  writeFileSync(chemin, contenu);
  const r = lancer(".", `--as-of=${AS_OF}`, "--verifier-dossier", `--dossier=${chemin}`);
  if (r.status !== 1) echec(nom, `sortie ${r.status} au lieu de 1 — l'altération passe la vérification`);
  if (!motifAttendu.test(r.stderr)) echec(nom, `le diagnostic ne nomme pas la classe d'écart — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
  rmSync(base, { recursive: true, force: true });
};

{ /* valeur modifiée — le total, altéré d'un caractère : 1505 → 1506 */
  const b = copie(blocJson);
  if (b.referentiel?.sources_datees_total !== 1505) {
    echec("bloc · valeur modifiée", "le bloc réel ne porte pas sources_datees_total=1505 — le harnais ne mute pas ce qu'il croit");
  } else {
    b.referentiel.sources_datees_total = 1506;
    casDocument("bloc · valeur modifiée", avantBloc + remonter(b) + apresBloc,
      /valeur modifiée à bloc\.referentiel\.sources_datees_total/);
  }
}
{ /* entrée supprimée du bloc */
  const b = copie(blocJson);
  delete b.contre_epreuves;
  casDocument("bloc · entrée supprimée", avantBloc + remonter(b) + apresBloc,
    /entrée SUPPRIMÉE du bloc : bloc\.contre_epreuves/);
}
{ /* entrée ajoutée au bloc */
  const b = copie(blocJson);
  b.entree_inventee = 42;
  casDocument("bloc · entrée ajoutée", avantBloc + remonter(b) + apresBloc,
    /entrée AJOUTÉE au bloc : bloc\.entree_inventee/);
}
/* bloc dupliqué — le doublon documentaire : deux blocs, lequel ferait foi ? */
casDocument("bloc · dupliqué", avantBloc + remonter(blocJson) + "\n\n" + remonter(blocJson) + apresBloc,
  /2 bloc\(s\) contractuel\(s\)/);
/* bloc absent */
casDocument("bloc · absent", avantBloc + apresBloc, /0 bloc\(s\) contractuel\(s\)/);

/* ============================== DONNÉES ======================================================= */

const conteneur = mkdtempSync(join(tmpdir(), "mesure-wt-"));
const arbre = join(conteneur, "arbre");
const gitWt = (...a) => spawnSync("git", ["worktree", ...a], { encoding: "utf-8" });

try {
  const ajout = gitWt("add", "--detach", arbre, "HEAD");
  if (ajout.status !== 0) {
    echec("arbre de travail", `git worktree add a échoué :\n      ${(ajout.stderr || "").trim()}`);
  } else {
    /* L'arbre porte HEAD ; on y superpose l'instrument et le dossier COURANTS, et l'accès aux
     * dépendances (tsx, zod) par lien symbolique — les données, elles, restent celles du dépôt. */
    symlinkSync(resolve("node_modules"), join(arbre, "node_modules"));
    copyFileSync("mesurer-achevement.mjs", join(arbre, "mesurer-achevement.mjs"));
    copyFileSync("DOSSIER-ACHEVEMENT-PROJET.md", join(arbre, "DOSSIER-ACHEVEMENT-PROJET.md"));

    const CHEMIN_REGLES = join(arbre, "packages/knowledge/raw/rules.json");
    const CHEMIN_OBJETS = join(arbre, "packages/knowledge/raw/objects.json");
    const reglesPristines = readFileSync(CHEMIN_REGLES, "utf-8");
    const objetsPristins = readFileSync(CHEMIN_OBJETS, "utf-8");

    /* Les CINQ contre-épreuves minimales de la contre-revue, sur la première règle. Chaque cas
     * repart des données pristines, mute UN champ, et exige la sortie 1 avec le champ nommé. */
    const MUTATIONS = [
      ["confiance absente", (s) => { delete s.confidence; }, /confidence/],
      ["relecteur absent", (s) => { delete s.reviewer; }, /reviewer/],
      ["type de source inconnu", (s) => { s.source_type = "blog"; }, /source_type/],
      ["date impossible", (s) => { s.verified_date = "2026-02-31"; }, /verified_date/],
      ["URL invalide", (s) => { s.url = "pas une url"; }, /url/],
    ];
    for (const [nom, muter, champ] of MUTATIONS) {
      const regles = JSON.parse(reglesPristines);
      muter(regles[0].source);
      writeFileSync(CHEMIN_REGLES, JSON.stringify(regles, null, 2));
      const r = lancer(arbre, `--as-of=${AS_OF}`, "--json");
      if (r.status !== 1) echec(`schéma · ${nom}`, `sortie ${r.status} au lieu de 1 — la mutation passe le schéma canonique`);
      if (!/schéma canonique/.test(r.stderr)) echec(`schéma · ${nom}`, "le diagnostic n'invoque pas le schéma canonique");
      if (!r.stderr.includes(`rules[${regles[0].id}].source`)) echec(`schéma · ${nom}`, "le diagnostic ne nomme pas le chemin de la source fautive");
      if (!champ.test(r.stderr)) echec(`schéma · ${nom}`, `le diagnostic ne nomme pas le champ en défaut (${champ})`);
    }

    { /* review_due déplacée vers une autre date VALIDE : le schéma passe — c'est la concordance
       * qui doit voir la donnée bouger sous le bloc resté figé. */
      const regles = JSON.parse(reglesPristines);
      const moisDe = (r) => r.source.review_due.slice(0, 7);
      const autre = regles.find((r) => moisDe(r) !== moisDe(regles[0]));
      regles[0].source.review_due = autre.source.review_due;
      writeFileSync(CHEMIN_REGLES, JSON.stringify(regles, null, 2));
      const r = lancer(arbre, `--as-of=${AS_OF}`, "--verifier-dossier");
      if (r.status !== 1) echec("donnée · review_due déplacée", `sortie ${r.status} au lieu de 1 — la donnée a bougé sans que la concordance rougisse`);
      if (!/valeur modifiée à bloc\.referentiel\.echeances_par_mois/.test(r.stderr)) {
        echec("donnée · review_due déplacée", `le diagnostic ne nomme pas l'échéancier modifié — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
      }
      writeFileSync(CHEMIN_REGLES, reglesPristines);
    }

    /* Les TROIS contre-épreuves d'empreinte de la contre-revue. Aucune ne change le moindre
     * agrégat — ni total, ni répartition, ni classe d'auto-citation, ni tranche d'échéance.
     * C'est exactement le trou de la v4 : une source métier remplacée en silence pendant que la
     * vérification annonçait l'égalité exacte. Seule l'empreinte du registre exact peut les voir,
     * et l'empreinte par famille doit LOCALISER l'écart. */
    const INVISIBLES_AUX_AGREGATS = [
      ["URL valide remplacée", (s) => { s.url = "https://example.org/replacement-pet-policy"; }],
      ["relecteur modifié", (s) => { s.reviewer = "Quelqu'un d'autre"; }],
      ["verified_date déplacée sans changer de tranche", (s) => {
        const d = new Date(s.verified_date + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - 1);
        s.verified_date = d.toISOString().slice(0, 10);
      }],
    ];
    for (const [nom, muter] of INVISIBLES_AUX_AGREGATS) {
      const regles = JSON.parse(reglesPristines);
      muter(regles[0].source);
      writeFileSync(CHEMIN_REGLES, JSON.stringify(regles, null, 2));
      const r = lancer(arbre, `--as-of=${AS_OF}`, "--verifier-dossier");
      if (r.status !== 1) echec(`empreinte · ${nom}`, `sortie ${r.status} au lieu de 1 — la source est modifiée en silence sous une égalité annoncée exacte`);
      if (!/empreinte_registre/.test(r.stderr) || !/empreinte_par_famille\.rules/.test(r.stderr)) {
        echec(`empreinte · ${nom}`, `le diagnostic ne nomme pas l'empreinte globale ET celle de la famille rules — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 4).join("\n      ")}`);
      }
      writeFileSync(CHEMIN_REGLES, reglesPristines);
    }

    { /* une source datée sous un `history` HORS contrat d'archive : bloquée et nommée, au lieu
       * de sortir du registre en silence — c'est l'exclusion globale que la contre-revue a refusée. */
      const objets = JSON.parse(objetsPristins);
      const pays = objets.countries[0];
      const modele = JSON.parse(reglesPristines)[0].source;
      pays.history = [{ source: { ...modele } }];
      writeFileSync(CHEMIN_OBJETS, JSON.stringify(objets, null, 2));
      const r = lancer(arbre, `--as-of=${AS_OF}`, "--json");
      if (r.status !== 1) echec("donnée · history hors contrat", `sortie ${r.status} au lieu de 1 — une archive hors contrat est exclue en silence`);
      if (!/HORS CONTRAT/.test(r.stderr) || !r.stderr.includes(`countries[${pays.id}].history`)) {
        echec("donnée · history hors contrat", `le diagnostic ne nomme pas le chemin hors contrat — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
      }
      writeFileSync(CHEMIN_OBJETS, objetsPristins);
    }

    { /* une identité instable introduite : le même contact dupliqué dans un même tableau — même
       * URL, donc collision d'empreinte, donc retour à l'indice. Le bloc fige ce compteur à 0 ;
       * la concordance doit rougir. */
      const objets = JSON.parse(objetsPristins);
      const aeroport = objets.airports.find((a) => Array.isArray(a.info?.contacts) && a.info.contacts.length > 0);
      aeroport.info.contacts.push(JSON.parse(JSON.stringify(aeroport.info.contacts[0])));
      writeFileSync(CHEMIN_OBJETS, JSON.stringify(objets, null, 2));
      const r = lancer(arbre, `--as-of=${AS_OF}`, "--verifier-dossier");
      if (r.status !== 1) echec("donnée · identité instable", `sortie ${r.status} au lieu de 1 — une identité retombée sur l'indice ne rougit pas`);
      if (!/identites_instables/.test(r.stderr)) {
        echec("donnée · identité instable", `le diagnostic ne nomme pas identites_instables — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 4).join("\n      ")}`);
      }
      writeFileSync(CHEMIN_OBJETS, objetsPristins);
    }
  }
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ============================== verdict ======================================================= */

if (defauts.length === 0) {
  process.stdout.write("21 cas éprouvés : trois dates impossibles refusées en nommant la date, un 29 février\n");
  process.stdout.write("bissextile accepté, le dossier réel conforme ; cinq altérations du document — valeur\n");
  process.stdout.write("modifiée, entrée supprimée, entrée ajoutée, bloc dupliqué, bloc absent — chacune en 1\n");
  process.stdout.write("avec sa classe nommée ; et onze mutations de données en arbre de travail jetable —\n");
  process.stdout.write("les cinq rejets du schéma canonique avec chemin et champ, une review_due qui bouge\n");
  process.stdout.write("sous le bloc figé, trois mutations invisibles aux agrégats (URL valide remplacée,\n");
  process.stdout.write("relecteur modifié, verified_date déplacée dans sa tranche) vues par les empreintes\n");
  process.stdout.write("du registre exact et localisées par famille, une archive hors contrat bloquée au\n");
  process.stdout.write("lieu d'exclue en silence, une identité retombée sur l'indice qui fait rougir le\n");
  process.stdout.write("compteur figé à 0.\n\n");
  process.stdout.write("[mesure-achevement] la vérification mord, dans les deux sens.\n");
  process.exit(0);
}
process.stderr.write(`\n[mesure-achevement] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
