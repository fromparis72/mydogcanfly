# Politiques compagnies — lot strict 4

Date de lecture : **9 septembre 2026**. Ce dossier accompagne
`PREUVES_POLITIQUES_COMPAGNIES_LOT_4_STRICT_2026-09-09.json`.

## Portée

10 compagnies, 23 faits importables, 7 non-décisions explicites. Chaque fait
repose sur une citation continue, dans une page de première partie de la
compagnie. Une source qui parle de « cargo hold » ne devient pas par raccourci
la catégorie publique `cargo` du Finder.

| Compagnie | Cabine | Soute | Fret | Point de prudence |
| --- | --- | --- | --- | --- |
| Austrian Airlines | refus si chien seul > 8 kg | sous conditions | non décidé | le plafond comprend le contenant |
| American Airlines | sous conditions | non décidé | sous conditions | la soute accompagnée est réservée à des personnels en mission officielle |
| SWISS | refus si chien seul > 8 kg | sous conditions | non décidé | races brachycéphales exclues de la soute |
| Emirates | refus documenté | sous conditions | sous conditions | la compagnie choisit l’un ou l’autre, selon le cas |
| Qantas | refus documenté | sous conditions | sous conditions | aéroports et accord Qantas déterminent la soute |
| ITA Airways | sous conditions | sous conditions | non décidé | plafond différent entre vols intérieurs italiens et autres vols |
| Aer Lingus | refus documenté | sous conditions | non décidé | agent animalier requis ; certains appareils et régional exclus |
| Brussels Airlines | refus si chien seul > 8 kg | sous conditions | non décidé | plafond avec contenant ; restriction de route/breed |
| WestJet | sous conditions | sous conditions | non décidé | « most international flights », donc jamais réponse absolue |
| Alaska Airlines | sous conditions | sous conditions | sous conditions | fret Pet Connect pour animal non accompagné |

## Décisions volontairement non prises

- **American — soute** : la source la limite aux militaires américains actifs
  et Foreign Service Department en ordre officiel ; le Finder ne pose pas cette
  question d’éligibilité.
- **ITA — plafond cabine** : 12 kg sur certains vols domestiques italiens,
  8 kg ailleurs. Écrire un seuil mondial serait faux sur l’une des deux routes.
- **Emirates — soute/fret** : les deux canaux sont documentés comme possibles,
  mais le choix appartient à Emirates selon le dossier ; l’interface ne doit
  jamais les présenter comme deux réservations simultanément ouvertes.
- **WestJet — fret** et les autres non-décisions listées dans le JSON : le texte
  consulté n’établit pas une offre fret générale assez précise pour le contrat
  du Finder.

## Règles d’intégration obligatoires

1. Importer seulement les 23 éléments de `facts`, sans compléter les canaux
   non décidés depuis les notes éditoriales existantes.
2. Conserver mot pour mot `url`, `quote`, `quote_language`, `locator` et la
   date de vérification du 09/09/2026.
3. Utiliser la cadence compagnie existante pour `review_due` ; elle doit être
   calculée par le dépôt, pas figée par cet artefact.
4. Une valeur `offered_with_conditions` doit s’afficher « accepté sous
   conditions » : ni disponibilité de place, ni autorisation finale, ni
   garantie de tarif.
5. Les trois plafonds de 8 kg sont seulement des refus **au-dessus** de 8 kg
   quand le chien seul dépasse déjà le plafond combiné chien + contenant. Ils
   ne prouvent pas une acceptation à 8 kg ou moins.
6. Rejouer l’inventaire de preuves, les tests du quatrième état, et au moins un
   scénario Finder réel avant toute PR.

## Sources directes relues

- Austrian Airlines — https://www.austrian.com/us/en/plan/special-requirements/travelling-with-animals
- American Airlines — https://www.aa.com/web/i18n/travel-info/special-assistance/pets.html
- SWISS — https://www.swiss.com/xx/en/prepare/special-care/animals-travelling
- Emirates — https://www.emirates.com/us/english/before-you-fly/baggage/unusual-baggage-and-special-allowances/
- Qantas — https://www.qantas.com/en-au/book/flights/conditions-of-carriage
- Qantas (cabine) — https://www.qantas.com/content/dam/qantas/pdfs/fly/specific-needs/qantas-disability-access-facilitation-plan.pdf
- ITA Airways — https://www.ita-airways.com/us/en/book-and-prepare/other-requests/travelling-with-pets/pets-in-cabin.html
- Aer Lingus — https://www.aerlingus.com/localized/en/modals/baggage-information.html
- Brussels Airlines — https://www.brusselsairlines.com/be/en/special-care/pets/cats-and-small-dogs-in-the-cabin
- WestJet — https://www.westjet.com/en-ca/pets/general-entrance-requirements
- Alaska Airlines — https://www.alaskaair.com/content/travel-info/pets

## Vérification avant livraison

- 10 identifiants compagnie contrôlés dans le référentiel : tous existent.
- 23 citations : aucune ellipse, aucune paraphrase posée comme citation.
- 7 omissions délibérées : inscrites avec leur raison, pas silencieuses.
- Aucune donnée, aucun code ni aucune branche du dépôt n’est modifié par ce
  dossier.
