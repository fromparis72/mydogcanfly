/**
 * PRÉPARER UN WORKTREE POUR QU'IL SOIT VRAIMENT LUI-MÊME.
 *
 * Défaut trouvé le 17/08/2026 en régénérant une baseline « avant » : un worktree détaché dont on
 * se contente de lier `node_modules` n'est PAS isolé. `node_modules/@mydogcanfly/knowledge` est un
 * lien vers `../../packages/knowledge`, et ce lien se résout depuis SON EMPLACEMENT — c'est-à-dire
 * dans le dépôt principal. Tout `import "@mydogcanfly/…"` exécuté dans le worktree lisait donc le
 * code ET les données d'AUJOURD'HUI. La preuve : au commit où le registre de race était vide, le
 * rejeu publiait 36 avis de sécurité.
 *
 * Les outils de mesure de T0-B3 et T0-B3-a importaient, eux, par chemin RELATIF : leurs données
 * venaient bien du worktree, et leurs artefacts rejoués octet pour octet le confirment. Mais la
 * garantie était fragile — le moteur du worktree tirait ses fonctions utilitaires du paquet
 * `knowledge` d'aujourd'hui. Une garantie qui tient par accident n'est pas une garantie.
 *
 * On construit donc un `node_modules` RÉEL dans le worktree : un lien par dépendance vers celui de
 * la racine — elles sont verrouillées par le lockfile, et le rejeu vérifie par ailleurs que ce
 * lockfile n'a pas bougé — mais le scope `@mydogcanfly` pointe vers les paquets DU WORKTREE.
 */
import { mkdirSync, readdirSync, symlinkSync, existsSync } from "node:fs";

export function preparerWorktree(base, racine) {
  const cible = `${base}/node_modules`;
  if (existsSync(cible)) throw new Error(`worktree déjà pourvu d'un node_modules : ${cible}`);
  mkdirSync(cible);
  for (const entree of readdirSync(`${racine}/node_modules`)) {
    if (entree === "@mydogcanfly") continue;
    symlinkSync(`${racine}/node_modules/${entree}`, `${cible}/${entree}`);
  }
  /* Le scope du dépôt : vers les paquets du WORKTREE, jamais ceux de la racine. */
  mkdirSync(`${cible}/@mydogcanfly`);
  for (const paquet of readdirSync(`${base}/packages`)) {
    symlinkSync(`${base}/packages/${paquet}`, `${cible}/@mydogcanfly/${paquet}`);
  }
}
