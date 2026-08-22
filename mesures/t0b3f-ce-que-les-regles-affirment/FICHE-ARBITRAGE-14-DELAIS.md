# Fiche d arbitrage — les 14 divergences de délai (T0-B3-f)

**Rien n est corrigé ici.** Cette fiche rassemble, pour chacune des 14 règles, ce que le moteur
applique, ce que la phrase publiée annonce, et la source à relire pour trancher. Le dossier
T0-B3-f a établi la divergence ; il ne peut pas dire lequel des deux nombres est le bon, parce
qu il ne lit aucune source externe.

Base : `5888c45c56d92288faf7d4ec589f1b9c3ca98674` · reproduction : `npm run mesure:t0b3f`

## Sens DANGEREUX — le moteur planifie MOINS que sa propre phrase (3)

Un voyageur qui suit l outil démarre plus tard que ce que le texte de la même page lui conseille.

### `rule_au_import`

| | |
|---|---|
| moteur applique | **150 jours** |
| phrase annonce | **« 6 to 7 months »** = 180–210 j |
| écart | −30 jours |
| source citée | https://www.agriculture.gov.au/biosecurity-trade/cats-dogs |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 6 to 7 months + quarantine. Requirements: import permit, microchip, rabies titer test, quarantine.

**À trancher :** la source dit-elle 150 j, ou 180–210 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_nz_import`

| | |
|---|---|
| moteur applique | **150 jours** |
| phrase annonce | **« 6 to 7 months »** = 180–210 j |
| écart | −30 jours |
| source citée | https://www.mpi.govt.nz/bring-send-to-nz/pets-travelling-to-nz/bringing-cats-and-dogs-to-nz/step-by-step-guide-to-bringing-cats-and-dogs-to-nz |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 6 to 7 months + quarantine. Requirements: import permit, microchip, rabies vaccination, rabies titer test, quarantine.

**À trancher :** la source dit-elle 150 j, ou 180–210 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_vn_import`

| | |
|---|---|
| moteur applique | **21 jours** |
| phrase annonce | **« About 1 month »** = 30 j |
| écart | −9 jours |
| source citée | https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/pet-travel-us-vietnam |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> About 1 month. Requirements: microchip, rabies vaccination, health certificate.

**À trancher :** la source dit-elle 21 j, ou 30 j ? Le perdant est corrigé, pas arbitré au milieu.

## Sens strict — le moteur exige PLUS que sa phrase (11)

### `rule_cn_import`

| | |
|---|---|
| moteur applique | **150 jours** |
| phrase annonce | **« 2 to 4 months »** = 60–120 j |
| écart | +30 jours |
| source citée | https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/pet-travel-us-china |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 2 to 4 months. Requirements: microchip, rabies vaccination, rabies titer test, health certificate, quarantine.

**À trancher :** la source dit-elle 150 j, ou 60–120 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_fi_import`

| | |
|---|---|
| moteur applique | **30 jours** |
| phrase annonce | **« 21 days »** = 21 j |
| écart | +9 jours |
| source citée | https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_en.htm |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 21 days + tapeworm treatment 1–5 days before. Requirements: microchip, rabies vaccination, EU pet passport, tapeworm treatment.

**À trancher :** la source dit-elle 30 j, ou 21 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_ie_import`

| | |
|---|---|
| moteur applique | **30 jours** |
| phrase annonce | **« 21 days »** = 21 j |
| écart | +9 jours |
| source citée | https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_en.htm |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 21 days + tapeworm treatment 1–5 days before. Requirements: microchip, rabies vaccination, EU pet passport, tapeworm treatment.

**À trancher :** la source dit-elle 30 j, ou 21 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_il_import`

| | |
|---|---|
| moteur applique | **150 jours** |
| phrase annonce | **« 2 to 3 months »** = 60–90 j |
| écart | +60 jours |
| source citée | https://www.gov.il/en/pages/importdogs |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 2 to 3 months. Requirements: microchip, rabies vaccination, rabies titer test, advance notification, health certificate.

**À trancher :** la source dit-elle 150 j, ou 60–90 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_ke_import`

| | |
|---|---|
| moteur applique | **60 jours** |
| phrase annonce | **« About 1 month »** = 30 j |
| écart | +30 jours |
| source citée | https://kenya.org.za/import-permit/ |
| type · confiance | other · 3/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> About 1 month. Requirements: microchip, rabies vaccination, import permit, health certificate.

**À trancher :** la source dit-elle 60 j, ou 30 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_kr_import`

| | |
|---|---|
| moteur applique | **150 jours** |
| phrase annonce | **« 3 to 4 months »** = 90–120 j |
| écart | +30 jours |
| source citée | https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/pet-travel-us-korea |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 3 to 4 months (rabies titer test). Requirements: microchip, rabies vaccination, rabies titer test, health certificate, advance notification.

**À trancher :** la source dit-elle 150 j, ou 90–120 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_mt_import`

| | |
|---|---|
| moteur applique | **30 jours** |
| phrase annonce | **« 21 days »** = 21 j |
| écart | +9 jours |
| source citée | https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_en.htm |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 21 days + tapeworm treatment 1–5 days before. Requirements: microchip, rabies vaccination, EU pet passport, tapeworm treatment.

**À trancher :** la source dit-elle 30 j, ou 21 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_no_import`

| | |
|---|---|
| moteur applique | **30 jours** |
| phrase annonce | **« 21 days »** = 21 j |
| écart | +9 jours |
| source citée | https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_en.htm |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 21 days + tapeworm treatment 1–5 days before. Requirements: microchip, rabies vaccination, EU pet passport, tapeworm treatment.

**À trancher :** la source dit-elle 30 j, ou 21 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_pa_import`

| | |
|---|---|
| moteur applique | **60 jours** |
| phrase annonce | **« 1 to 2 weeks »** = 7–14 j |
| écart | +46 jours |
| source citée | https://mida.gob.pa/requisitos-para-la-importacion-de-perros-y-gatos/ |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> 1 to 2 weeks of preparation. Requirements: rabies vaccination, health certificate, quarantine.

**À trancher :** la source dit-elle 60 j, ou 7–14 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_ph_import`

| | |
|---|---|
| moteur applique | **60 jours** |
| phrase annonce | **« About 1 month »** = 30 j |
| écart | +30 jours |
| source citée | https://www.bai.gov.ph/Stakeholders/PetImport |
| type · confiance | government · 4/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> About 1 month. Requirements: microchip, rabies vaccination, health certificate, import permit, antiparasitic treatment.

**À trancher :** la source dit-elle 60 j, ou 30 j ? Le perdant est corrigé, pas arbitré au milieu.

### `rule_ua_import`

| | |
|---|---|
| moteur applique | **150 jours** |
| phrase annonce | **« About 4 months »** = 120 j |
| écart | +30 jours |
| source citée | https://www.pettravel.com/information/pet-passports/ukraine-pet-import-requirements/ |
| type · confiance | other · 3/5 |
| vérifiée le | 2026-07-08 · revue due 2027-01-04 |

> About 4 months. Requirements: microchip, rabies vaccination, rabies titer test, health certificate.

**À trancher :** la source dit-elle 150 j, ou 120 j ? Le perdant est corrigé, pas arbitré au milieu.
