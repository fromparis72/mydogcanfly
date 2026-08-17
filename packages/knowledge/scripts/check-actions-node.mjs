#!/usr/bin/env node
/**
 * check-actions-node.mjs — les actions GitHub sont épinglées, et sur un runtime supporté.
 *
 *   node packages/knowledge/scripts/check-actions-node.mjs               # hors ligne (CI)
 *   node packages/knowledge/scripts/check-actions-node.mjs --en-ligne    # + relecture chez GitHub
 *
 * CE QUE CE CONTRÔLE PROTÈGE. Le 16/08/2026, la CI passait au vert en écrivant ceci dans son
 * journal, sans que rien ne la fasse rougir :
 *
 *   ##[warning]Node.js 20 is deprecated. The following actions target Node.js 20 but are being
 *   forced to run on Node.js 24: actions/checkout@11d5960a…, actions/setup-node@49933ea5…
 *
 * « Forced to run » : le code de ces actions tournait déjà sous un Node qu'il n'avait jamais vu.
 * Un avertissement de journal ne casse aucune construction et personne ne relit 6 800 lignes de
 * log — cette dette a donc vécu tant qu'elle n'était portée que par un texte.
 *
 * DEUX NODE, À NE JAMAIS CONFONDRE. Celui des ACTIONS (`runs.using` dans leur `action.yml`, choisi
 * par leur auteur) et celui du PROJET (installé par `setup-node` depuis `.nvmrc`, 22.22.2, qui
 * exécute le build et les harnais). Ce script ne parle que du premier. Le second ne bouge pas :
 * un build Astro complet sous Node 24 échoue après plusieurs milliers de pages.
 *
 * CE QU'IL VÉRIFIE, HORS LIGNE — donc sans réseau, donc reproductible :
 *   1. chaque `uses:` est épinglé sur un SHA de 40 hexadécimaux, jamais sur un tag flottant ;
 *   2. chaque épingle porte un commentaire de version, et ce couple (SHA, version) est déclaré au
 *      manifeste `.github/actions-epinglees.json` ;
 *   3. le runtime relevé au manifeste fait partie des runtimes admis ;
 *   4. aucune entrée du manifeste ne dort : une épingle déclarée mais plus utilisée est signalée,
 *      sans quoi une ligne périmée resterait comme une preuve valide.
 *
 * CE QU'IL NE PEUT PAS VÉRIFIER HORS LIGNE : que ces SHA portent bien, chez GitHub, le `using`
 * inscrit au manifeste. C'est une lecture datée. `--en-ligne` la refait : il clone chaque action,
 * relit `action.yml` au SHA épinglé, et compare. Il exige aussi que le tag nommé pointe encore sur
 * ce SHA — un tag qu'on déplace est le scénario que l'épinglage par SHA sert précisément à parer.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const DOSSIER_WORKFLOWS = join(REPO_ROOT, ".github/workflows");
const MANIFESTE = join(REPO_ROOT, ".github/actions-epinglees.json");
const EN_LIGNE = process.argv.includes("--en-ligne");

const dire = (m) => process.stdout.write(`[actions-node] ${m}\n`);
const echecs = [];
const faute = (m) => echecs.push(m);

/* ---- Le manifeste ---------------------------------------------------------------------------- */
if (!existsSync(MANIFESTE)) {
  process.stderr.write(`[actions-node] ÉCHEC — manifeste ABSENT : ${MANIFESTE}\n`);
  process.exit(1);
}
const manifeste = JSON.parse(readFileSync(MANIFESTE, "utf8"));
const RUNTIMES_ADMIS = manifeste.runtimes_admis;
if (!Array.isArray(RUNTIMES_ADMIS) || RUNTIMES_ADMIS.length === 0) {
  process.stderr.write("[actions-node] ÉCHEC — `runtimes_admis` vide ou absent : sans liste, tout passerait.\n");
  process.exit(1);
}
const parSha = new Map();
for (const e of manifeste.epingles ?? []) {
  if (parSha.has(e.sha)) faute(`manifeste : le SHA ${e.sha} est déclaré deux fois.`);
  parSha.set(e.sha, { ...e, vue: false });
}
if (parSha.size === 0) {
  process.stderr.write("[actions-node] ÉCHEC — manifeste sans aucune épingle.\n");
  process.exit(1);
}

/* ---- Les workflows --------------------------------------------------------------------------- */
/* Aucun repli « faute de matière » : zéro workflow lu est un échec, pas un silence. */
const fichiers = existsSync(DOSSIER_WORKFLOWS)
  ? readdirSync(DOSSIER_WORKFLOWS).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort()
  : [];
if (fichiers.length === 0) {
  process.stderr.write(`[actions-node] ÉCHEC — aucun workflow lu dans ${DOSSIER_WORKFLOWS}. `
    + "Un contrôle qui ne lit rien reste vert pour de mauvaises raisons.\n");
  process.exit(1);
}

const LIGNE_USES = /^\s*(?:-\s+)?uses:\s*([^\s#]+)\s*(?:#\s*(\S+))?/;
const EPINGLE = /^([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)@([0-9a-f]{40})$/;

let epinglesLues = 0;
for (const f of fichiers) {
  const lignes = readFileSync(join(DOSSIER_WORKFLOWS, f), "utf8").split("\n");
  lignes.forEach((ligne, i) => {
    const m = LIGNE_USES.exec(ligne);
    if (!m) return;
    epinglesLues++;
    const [, reference, version] = m;
    const ou = `${f}:${i + 1}`;

    const p = EPINGLE.exec(reference);
    if (!p) {
      faute(`${ou} : « ${reference} » n'est pas épinglée sur un SHA complet de 40 hexadécimaux. `
        + "Un tag se déplace ; un SHA, non.");
      return;
    }
    const [, action, sha] = p;

    if (!version) {
      faute(`${ou} : ${action}@${sha.slice(0, 8)}… n'indique aucune version en commentaire. `
        + "Un SHA nu ne se relit pas.");
      return;
    }
    const declaree = parSha.get(sha);
    if (!declaree) {
      faute(`${ou} : ${action}@${sha} n'est PAS déclarée au manifeste `
        + "(.github/actions-epinglees.json). Toute épingle doit avoir été mesurée avant d'être posée.");
      return;
    }
    declaree.vue = true;
    if (declaree.action !== action) {
      faute(`${ou} : le SHA ${sha.slice(0, 8)}… est déclaré au manifeste pour ${declaree.action}, `
        + `pas pour ${action}.`);
    }
    if (declaree.version !== version) {
      faute(`${ou} : ${action}@${sha.slice(0, 8)}… est commenté « ${version} » alors que le manifeste `
        + `dit « ${declaree.version} ». Le commentaire est ce qu'un relecteur lit : il doit être vrai.`);
    }
    if (!RUNTIMES_ADMIS.includes(declaree.using)) {
      faute(`${ou} : ${action} ${declaree.version} déclare le runtime « ${declaree.using} », qui n'est `
        + `pas supporté (admis : ${RUNTIMES_ADMIS.join(", ")}). Le runner la forcerait sur un autre `
        + "Node que celui pour lequel elle a été construite.");
    }
  });
}

if (epinglesLues === 0) {
  faute(`aucune ligne « uses: » trouvée dans les ${fichiers.length} workflow(s) lu(s). `
    + "Le format a changé, ou la lecture est cassée — dans les deux cas ce contrôle ne prouve rien.");
}

for (const e of parSha.values()) {
  if (!e.vue) {
    faute(`manifeste : ${e.action} ${e.version} (${e.sha.slice(0, 8)}…) n'est utilisée par aucun `
      + "workflow. Une épingle qui dort finit par servir de caution à autre chose.");
  }
}

/* ---- La relecture chez GitHub (--en-ligne) ---------------------------------------------------- */
if (EN_LIGNE) {
  const travail = mkdtempSync(join(tmpdir(), "actions-node-"));
  try {
    for (const e of parSha.values()) {
      const depot = `https://github.com/${e.action}`;
      const local = join(travail, e.action.replace("/", "__"));
      try {
        execFileSync("git", ["clone", "--quiet", "--filter=blob:none", "--no-checkout", depot, local],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (err) {
        faute(`${e.action} : clone impossible (${String(err.message).trim().split("\n")[0]}). `
          + "Sans réseau, la relecture n'a pas eu lieu — ne pas la compter comme réussie.");
        continue;
      }
      const tags = execFileSync("git", ["-C", local, "ls-remote", "--tags", "origin"], { encoding: "utf8" });
      const attendu = tags.split("\n")
        .map((l) => l.split("\t"))
        .find(([, ref]) => ref === `refs/tags/${e.version}` || ref === `refs/tags/${e.version}^{}`);
      if (!attendu) faute(`${e.action} : le tag ${e.version} n'existe plus chez GitHub.`);
      else if (attendu[0] !== e.sha) {
        faute(`${e.action} : le tag ${e.version} pointe désormais sur ${attendu[0]}, pas sur ${e.sha} `
          + "— le tag a été DÉPLACÉ. L'épingle par SHA a tenu ; le manifeste doit être revu.");
      }
      let actionYml;
      try {
        actionYml = execFileSync("git", ["-C", local, "show", `${e.sha}:action.yml`], { encoding: "utf8" });
      } catch {
        faute(`${e.action} : aucun action.yml au SHA ${e.sha} — le SHA épinglé n'existe pas.`);
        continue;
      }
      const using = /^\s*using:\s*['"]?([A-Za-z0-9]+)['"]?/m.exec(actionYml)?.[1];
      if (using !== e.using) {
        faute(`${e.action} ${e.version} : le manifeste dit « ${e.using} », GitHub dit « ${using ?? "rien"} ».`);
      } else {
        dire(`relu chez GitHub : ${e.action} ${e.version} → using: ${using}`);
      }
    }
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }
}

/* ---- Verdict ---------------------------------------------------------------------------------- */
if (echecs.length) {
  process.stderr.write(`[actions-node] ÉCHEC — ${echecs.length} anomalie(s) :\n`
    + echecs.map((e) => `  · ${e}`).join("\n") + "\n");
  process.exit(1);
}
dire(`${epinglesLues} épingle(s) dans ${fichiers.length} workflow(s) : toutes sur un SHA complet, `
  + `déclarées au manifeste, runtime ${RUNTIMES_ADMIS.join("/")}${EN_LIGNE ? ", relues chez GitHub" : ""}.`);
