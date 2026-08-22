#!/usr/bin/env node
/**
 * test-plancher-node.mjs — LE PLANCHER DE VERSION, ÉPROUVÉ SUR CE QUE L'HISTOIRE NE DONNE PAS.
 *
 * `mesures/t0b3a/outils/reproduire.mjs` refuse de rejouer une mesure sous un Node qui ne satisfait
 * pas le `.nvmrc` du commit historique. Ce contrôle ne pouvait pas être éprouvé : il ne se
 * déclenche que si ce `.nvmrc` est absent ou mal formé, et un commit est immuable — on ne peut pas
 * fabriquer le cas.
 *
 * D'où une fonction PURE, et ce harnais qui lui passe les cas manquants. La contre-revue du
 * 23/08/2026 en avait trouvé un vrai : un `.nvmrc` PRÉSENT MAIS VIDE passait, parce qu'un `Buffer`
 * vide est truthy et que le ternaire `nvmrc ? … : true` rendait alors la conformité VRAIE.
 */
import { plancherNode } from "./mesures/t0b3a-arbitrage-brachy/outils/lib-arbitrage.mjs";

let echecs = 0;
const dire = (m) => process.stdout.write(m + "\n");
function exiger(libelle, condition, detail = "") {
  if (condition) { dire(`  ✔ ${libelle}`); return; }
  echecs++; dire(`  ✗ ${libelle}${detail ? ` — ${detail}` : ""}`);
}
const refuse = (nvmrc, version, libelle) => {
  const r = plancherNode(nvmrc, version);
  exiger(libelle, r.ok === false && r.motif.length > 0, `accepté : ${JSON.stringify(r)}`);
};
const accepte = (nvmrc, version, libelle) => {
  const r = plancherNode(nvmrc, version);
  exiger(libelle, r.ok === true && r.motif === "", `refusé : ${r.motif}`);
};

dire("\nCE QUI DOIT ÊTRE REFUSÉ");
refuse("", "v22.22.2", "`.nvmrc` vide — le défaut trouvé le 23/08/2026");
refuse("   ", "v22.22.2", "`.nvmrc` fait d'espaces");
refuse(null, "v22.22.2", "`.nvmrc` absent");
refuse("22", "v22.22.2", "version tronquée à la majeure");
refuse("22.22", "v22.22.2", "version sans correctif");
refuse("lts/hydrogen", "v22.22.2", "alias au lieu d'une version");
refuse("v22.22.2", "v20.11.0", "majeure inférieure");
refuse("v22.22.2", "v24.0.0", "majeure supérieure — le contrat exige la MÊME majeure");
refuse("v22.22.2", "v22.22.1", "correctif antérieur au plancher");
refuse("v22.22.2", "v22.21.9", "mineure antérieure au plancher");

dire("\nCE QUI DOIT ÊTRE ACCEPTÉ");
accepte("v22.22.2", "v22.22.2", "version exactement au plancher");
accepte("22.22.2", "v22.22.2", "plancher écrit sans le « v »");
accepte("v22.22.2", "v22.22.9", "correctif postérieur");
accepte("v22.22.2", "v22.23.0", "mineure postérieure");
accepte(" v22.22.2 \n", "v22.22.2", "plancher entouré d'espaces");

dire("");
if (echecs) { process.stderr.write(`[plancher-node] ÉCHEC — ${echecs} contrôle(s) non tenu(s)\n`); process.exit(1); }
dire("[plancher-node] le plancher refuse ce qu'il doit refuser, y compris un `.nvmrc` vide.");
