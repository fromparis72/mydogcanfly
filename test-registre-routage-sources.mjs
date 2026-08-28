#!/usr/bin/env node
/**
 * Garde SOURCES ↔ REGISTRE de routage — le versant que la porte ne regarde pas, et c'est nommé.
 *
 * La porte de lancement (P7 bis) ne lit QUE l'artefact : le `dist` et le registre scellé
 * (porte-routage-scelle.json). Cette garde-ci vit côté SOURCES, dans test:unit : elle vérifie
 * que les 62 fiches compagnies héritées du site v1 (`content/posts/*-dog-policy.md`) ont
 * chacune leur redirection au registre scellé, et réciproquement — si quelqu'un retire une
 * entrée du Worker ET rescelle, ce contrôle-ci dit qu'un fichier hérité vient de perdre sa
 * redirection ; si un fichier hérité apparaît sans règle, il le dit aussi.
 *
 * Contre-épreuve incluse : une entrée retirée d'une COPIE du registre est vue par le MÊME
 * vérificateur — jamais une réimplémentation.
 */
import { readFileSync, readdirSync } from "node:fs";

let defauts = 0;
const echec = (cas, detail) => { defauts++; console.error(`  ✗ ${cas} — ${detail}`); };
const ok = (cas) => console.log(`  ✓ ${cas}`);

/** LE vérificateur : fichiers hérités ↔ entrées *-dog-policy du registre, dans les deux sens. */
function verifier(fichiers, registre) {
  const problemes = [];
  const regles = new Map(registre.familles.legacy_redirects
    .filter((r) => /-dog-policy\/$/.test(r.source))
    .map((r) => [r.source, r.cible]));
  for (const f of fichiers) {
    const source = `/${f.replace(/\.md$/, "")}/`;
    const cible = regles.get(source);
    if (!cible) problemes.push(`${f} : aucune redirection « ${source} » au registre scellé`);
    else if (!/^\/airlines\/[a-z0-9-]+\/$/.test(cible)) problemes.push(`${f} : cible « ${cible} » hors de /airlines/<slug>/`);
  }
  const nomsFichiers = new Set(fichiers.map((f) => `/${f.replace(/\.md$/, "")}/`));
  for (const source of regles.keys()) {
    if (!nomsFichiers.has(source)) problemes.push(`règle « ${source} » au registre sans fichier hérité correspondant`);
  }
  return problemes;
}

const fichiers = readdirSync("content/posts").filter((f) => f.endsWith("-dog-policy.md"));
const registre = JSON.parse(readFileSync("porte-routage-scelle.json", "utf8"));

{
  const problemes = verifier(fichiers, registre);
  if (problemes.length) for (const p of problemes) echec("1 bijection", p);
  else ok(`1 bijection : ${fichiers.length} fiches héritées ↔ ${fichiers.length} redirections *-dog-policy scellées, cibles /airlines/<slug>/`);
  if (fichiers.length !== 62) echec("1 effectif", `${fichiers.length} fiches héritées (attendu : 62 — si la classe bouge, ce compte avance par mouvement nommé)`);
}

/* Contre-épreuve : l'entrée Alaska retirée d'une COPIE du registre → vue, nommée. */
{
  const copie = JSON.parse(JSON.stringify(registre));
  const avant = copie.familles.legacy_redirects.length;
  copie.familles.legacy_redirects = copie.familles.legacy_redirects.filter((r) => r.source !== "/alaska-airlines-dog-policy/");
  if (copie.familles.legacy_redirects.length !== avant - 1) echec("2 contre-épreuve", "la mutation ne s'applique pas — elle ne prouverait rien");
  else {
    const problemes = verifier(fichiers, copie);
    if (problemes.some((p) => p.includes("alaska-airlines-dog-policy"))) ok("2 contre-épreuve : l'entrée Alaska retirée du registre est détectée par le même vérificateur");
    else echec("2 contre-épreuve", "l'entrée Alaska retirée n'est PAS détectée");
  }
}

if (defauts) { console.error(`\n[routage-sources] ÉCHEC — ${defauts} défaut(s)`); process.exit(1); }
console.log("\n[routage-sources] chaque fiche héritée a sa redirection scellée, et réciproquement.");
