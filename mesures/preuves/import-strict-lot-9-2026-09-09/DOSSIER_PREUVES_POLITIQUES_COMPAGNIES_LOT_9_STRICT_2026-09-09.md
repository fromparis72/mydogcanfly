# Politiques compagnies — lot strict 9, lot de clôture

Date de lecture : **9 septembre 2026**. Ce dossier accompagne
`PREUVES_POLITIQUES_COMPAGNIES_LOT_9_STRICT_2026-09-09.json`.

## Portée

Les **9 dernières compagnies du référentiel**, 18 faits importables et 9
non-décisions explicites. Après ce lot, les 102 compagnies ont été examinées au
moins une fois dans les neuf lots stricts. Cela signifie **couverture de
l’examen**, pas « preuve sur les 306 canaux » : une absence de preuve reste une
absence de preuve.

| Compagnie | Cabine | Soute | Fret | Point de prudence |
| --- | --- | --- | --- | --- |
| Aerolíneas Argentinas | sous conditions | sous conditions | sous conditions | cabine/soute fondées sur un document interne public ; 9 kg avec contenant en cabine |
| Air Astana | sous conditions | sous conditions | sous conditions | fret documenté pour des destinations excluant le transport comme bagage |
| Batik Air Indonesia | refus documenté | refus documenté | non décidé | la page passager interdit d’amener un animal ; elle ne décrit pas un éventuel fret contractuel |
| Batik Air Malaysia | non décidé | non décidé | non décidé | aucun texte officiel actuel exploitable ; ne pas confondre avec Batik Indonesia ou Malaysia Airlines |
| Croatia Airlines | sous conditions | sous conditions | non décidé | sources de 2023 et 2019 : importables mais à revoir en priorité |
| Edelweiss Air | sous conditions | sous conditions | sous conditions | fret non accompagné via SWISS WorldCargo |
| EL AL Israel Airlines | non décidé | non décidé | non décidé | checklist officielle trouvée, mais aucune frontière actuelle entre les trois canaux |
| Neos | sous conditions | sous conditions | non décidé | seuil combiné de 10 kg ; cargo cité pour d’autres espèces, pas pour les chiens |
| TAROM | sous conditions | sous conditions | sous conditions | A320 et brachycéphales exclus de soute ; chiens > 40 kg orientés cargo |

## Ce que ce lot clôt réellement

- **102 compagnies sur 102 ont désormais une issue explicite pour chacun des
  trois canaux dans les artefacts stricts** : fait cité ou non-décision motivée.
- Le lot ne prétend pas que 102 compagnies ont une politique prouvée sur les
  trois canaux.
- Batik Air Malaysia et EL AL restent entièrement à confirmer. C’est le résultat
  de la recherche, pas un oubli de collecte.
- Croatia Airlines est le seul dossier importé à partir de documents datés de
  2019/2023. Ses deux décisions doivent remonter en tête de la prochaine cadence
  de relecture, même si `reviewDueFrom` calcule l’échéance générale.

## Décisions volontairement non prises

- **Batik Air Indonesia — fret** : l’interdiction faite au passager n’établit pas
  l’existence ou l’absence d’un service de fret séparément contracté.
- **Batik Air Malaysia — les trois canaux** : ses conditions officielles de 2020
  ne comportent pas de politique animaux. Les résultats concernant Batik Air
  Indonesia ou Malaysia Airlines appartiennent à d’autres transporteurs.
- **EL AL — les trois canaux** : la checklist de cage prouve qu’EL AL traite des
  animaux vivants, mais elle ne dit pas quel chien va en cabine, soute ou fret.
  Les sites non officiels trouvés ont été rejetés.
- **Croatia Airlines — fret** : les manuels d’exploitation ne prouvent pas une
  offre fret canin réservable par un voyageur.
- **Neos — fret** : la phrase cargo vise les espèces autres que chiens, chats et
  furets ; elle ne doit pas être étendue aux chiens.

## Règles d’intégration obligatoires

1. Importer exactement les 18 objets `facts`; conserver les 9 non-décisions.
2. Ne changer ni citation, ni URL, ni langue, ni localisateur, ni date.
3. Dériver l’échéance par `reviewDueFrom`; ne pas copier une date calculée.
4. **Batik Air Indonesia** : refus cabine et soute pour les animaux ordinaires,
   fret inconnu. Ne pas l’appliquer à Batik Air Malaysia et ne pas englober un
   éventuel chien d’assistance.
5. **Air Astana** : le fret est route-dépendant ; ne pas en faire une promesse
   générale sur chaque trajet.
6. **Croatia Airlines** : rendre visible la priorité de relecture des deux
   sources anciennes, sans transformer cela en refus ni en ignorance.
7. **Aerolíneas Argentinas** : 9 kg signifie chien + contenant ; soute soumise à
   disponibilité et fret soumis aux formalités Cargo.
8. **Neos** : ne pas déduire un cargo canin d’une phrase visant d’autres espèces.
9. **TAROM** : conserver les exclusions A320, brachycéphales et le seuil cargo.
10. Rejouer l’inventaire strict et les scénarios Finder différenciant les neuf
    compagnies, notamment Batik Indonesia/Malaysia.

## Sources directes relues

- Aerolíneas Argentinas, instruction cabine/soute — https://portalar.aerolineas.com.ar/campus/pluginfile.php/9597/mod_resource/content/2/resumen_obligaciones.pdf
- Aerolíneas Cargo — https://cargo.aerolineas.com.ar/es-AR/envios_personales
- Air Astana — https://help.airastana.com/hc/ru/sections/4417967707410-%D0%9F%D0%B5%D1%80%D0%B5%D0%B2%D0%BE%D0%B7%D0%BA%D0%B0-%D0%B6%D0%B8%D0%B2%D0%BE%D1%82%D0%BD%D1%8B%D1%85
- Batik Air Indonesia — https://help.batikair.com/article/bring-live-animalpet/753
- Batik Air Malaysia, conditions consultées — https://cms-cdn.batikair.com/66472e6388f4647bd5f90f87/assets/tandc/gtnc/OD-General-Conditions-of-Carriage.pdf
- Croatia Airlines, manuel 2023 — https://www.croatiaairlines.com/resources/documents/handling-agent/OP-ZOU-001-Ground_Operations_Manual_Issue_II_rev.11-24.01.2023.pdf
- Croatia Airlines, service AVIH 2019 — https://www.croatiaairlines.com/resources/dokumenti/ou-emd-distribution---services-policy--aaas--for-ouand-ta-oct19.pdf.pdf
- Edelweiss, réglementation — https://www.flyedelweiss.com/ch/en/prepare/flight-preparation/animals-travelling/regulations.html
- Edelweiss, FAQ — https://www.flyedelweiss.com/xk/en/customer-service/faq/animals.html
- EL AL, checklist animaux vivants — https://www.elal.com/media/2pvjlusr/live-animals-cage-guidelines-en.pdf
- Neos — https://www.neosair.com/us/en/information/traveling-with-pets
- TAROM, cabine — https://www.tarom.ro/en/informatii-pasageri/despre-calatorie/calatoria-cu-animale-de-companie/la-bordul-avionului/
- TAROM, soute et cargo — https://www.tarom.ro/en/travelling-with-pets/in-aircraft-hold

## Vérification avant livraison

- 9 identifiants compagnie présents dans le référentiel.
- 18 citations continues, sans ellipse dans `quote`.
- 9 canaux explicitement indécis.
- 27 issues uniques : une par compagnie × canal.
- Les citations réunies provenant d’une même URL restent sous la limite de 25
  mots par source.
- Aucun effet sur le dépôt applicatif, le Worker ou la production.
