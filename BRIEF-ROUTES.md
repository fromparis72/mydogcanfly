# Brief autonome — Base de routes MyDogCanFly

> À joindre comme CONNAISSANCE DE PROJET dans un projet Cowork dédié.
> La session distante ne peut PAS lire le dépôt : tout ce dont elle a besoin est ici.

## Objectif

Pour chaque compagnie, la liste de ses vols SANS ESCALE, en métal propre, entre les aéroports référencés.
Ces routes alimentent le moteur de décision : sans elles, le « vol direct » affiché au visiteur est une
heuristique fondée sur les hubs, pas un fait vérifié.

## Les trois règles qui font tout

1. **Métal propre uniquement.** Un vol vendu BA mais opéré par American ou Comair n'est PAS une route BA :
   c'est la politique animaux du transporteur OPÉRANT qui s'applique au chien. Exclure les partages de code
   et les franchises régionales. Si l'opérateur est indéterminable → `uncertain`, ne jamais deviner.
2. **Routes saisonnières incluses mais marquées** dans `seasonal_routes`. Les exclure priverait un
   voyageur d'août d'options réelles ; les traiter comme permanentes ferait clignoter le diff mensuel à
   chaque changement de saison.
3. **Destinations hors du jeu d'aéroports** → `candidate_airports` (aéroport candidat à ajouter au
   site), jamais dans `direct_routes`.

## Source

Le plan de vol, les horaires ou le moteur de réservation **publiés par la compagnie elle-même**, horaires
2026 courants. NE PAS utiliser OpenFlights, les tableaux Wikipédia ni les agrégateurs : périmés.
Citer l'URL réellement utilisée, par compagnie.

## Format de sortie (STRICT)

Identifiant aéroport = code IATA en minuscules préfixé `airport_`.
Chaque arête = paire NON ORDONNÉE, les deux identifiants triés ALPHABÉTIQUEMENT, joints par `|`.
Londres Heathrow–New York JFK s'écrit `airport_jfk|airport_lhr` (jfk avant lhr), jamais l'inverse.
Tableau trié alphabétiquement, sans doublon. `route_count` = longueur de `direct_routes`.

```json
{
  "BA": {
    "direct_routes": ["airport_jfk|airport_lhr"],
    "seasonal_routes": ["airport_kef|airport_lgw"],
    "candidate_airports": ["FNC — Funchal, desservi depuis LGW"],
    "uncertain": ["LHR-XXX : opérateur non confirmé"],
    "source_url": "https://...",
    "verified_date": "2026-07-XX",
    "route_count": 1
  }
}
```

## Modèle de référence — Air France, déjà en base (154 arêtes)

```json
["airport_abj|airport_cdg","airport_alg|airport_cdg","airport_alg|airport_mrs","airport_amm|airport_cdg","airport_ams|airport_cdg","airport_ams|airport_lys","airport_ams|airport_mrs","airport_ams|airport_nte","airport_arn|airport_cdg","airport_ath|airport_cdg"]
```

## Les 249 aéroports référencés

Périmètre : les DEUX extrémités d'une route doivent figurer ici.

```
CDG,ORY,JFK,LAX,YUL,NRT,HND,LHR,FRA,MAD,MEX,NCE,LYS,AMS,EIN,MUC,BER,DUS,BCN,PMI,AGP,LGW,MAN,STN,VIE,BRU,CRL,SOF,BOJ,LCA,PFO,ZAG,SPU,DBV,CPH,BLL,TLL,HEL,ATH,SKG,HER,BUD,DUB,ORK,FCO,MXP,BGY,VCE,RIX,VNO,LUX,MLA,WAW,KRK,GDN,LIS,OPO,FAO,OTP,CLJ,BTS,LJU,ARN,GOT,PRG,ZRH,GVA,OSL,BGO,KEF,BEG,TGD,TIV,TIA,KBP,TBS,BUS,ORD,MIA,SFO,ATL,YYZ,YVR,YYC,CUN,GDL,MTY,GRU,GIG,BSB,VCP,EZE,AEP,SCL,BOG,MDE,CTG,LIM,SJO,LIR,HAV,PUJ,SDQ,PTY,KIX,NGO,IST,SAW,AYT,DXB,AUH,DWC,BKK,DMK,HKT,SIN,PEK,PVG,CAN,SZX,PKX,DEL,BOM,BLR,HYD,CGK,DPS,SUB,SGN,HAN,DAD,ICN,GMP,PUS,KUL,BKI,PEN,CMB,HKG,TPE,KHH,MNL,CEB,CRK,DOH,JED,RUH,DMM,TLV,AMM,SYD,MEL,BNE,PER,AKL,CHC,CMN,RAK,TNG,TUN,NBE,DJE,ALG,ORN,CZL,CAI,HRG,SSH,JNB,CPT,DUR,DSS,MRU,NBO,MBA,ADD,MID,EWR,LGA,DFW,DEN,SEA,BOS,IAD,DCA,MSP,DTW,PHL,IAH,CLT,PHX,LAS,MCO,SLC,SAN,TPA,PDX,HNL,AUS,RDU,BWI,YOW,YEG,YHZ,YWG,EDI,PGF,MRS,TLS,BOD,NTE,BSL,HAM,CGN,STR,VLC,SVQ,BIO,LIN,NAP,BLQ,CTA,SVO,BAH,KWI,MCT,BEY,ABJ,LOS,ACC,RUN,SEZ,TNR,MAA,CCU,MLE,KTM,NAN,PPT,NOU,UIO,MVD,PTP,FDF,CAY,SXM,SJU,MBJ,NAS
```

## Déjà traité — ne pas refaire

AF (154) · KL (83) · LH (193) · SN (40) · U2 (282) · TO (79)

## Lots à traiter — 72 compagnies, 12 lots

Depuis le téléphone, une phrase suffit : « Traite le LOT N du brief, rends le JSON. »
Un lot par session. Ne pas enchaîner deux lots dans la même session : la sortie doit rester récupérable.

### LOT 1

**BA — British Airways** · hubs : LHR,LGW
Aéroports desservis déjà connus (131), à confirmer et compléter : `ACC,AGP,ALG,AMM,AMS,ARN,ATH,ATL,AUH,AUS,AYT,BAH,BCN,BER,BKK,BLL,BLQ,BLR,BOD,BOM,BOS,BRU,BSL,BUD,BWI,CAI,CDG,CPH,CPT,CTA,CUN,DBV,DEL,DEN,DFW,DOH,DUB,DUS,DXB,EDI,EWR,EZE,FAO,FCO,FRA,GIG,GOT,GRU,GVA,HAM,HEL,HKG,HND,HYD,IAD,IAH,IST,JED,JFK,JNB,KEF,KRK,KUL,KWI,LAS,LAX,LCA,LGW,LHR,LIN,LIS,LJU,LOS,LUX,LYS,MAA,MAD,MAN,MCO,MEX,MIA,MLA,MLE,MRS,MRU,MUC,MXP,NAP,NAS,NBO,NCE,OPO,ORD,OSL,OTP,PDX,PFO,PHL,PHX,PMI,PRG,PUJ,PVG,RAK,RUH,SAN,SCL,SEA,SFO,SIN,SJO,SKG,SOF,SPU,SSH,SYD,TBS,TIA,TIV,TLS,TLV,TPA,VCE,VIE,VLC,WAW,YUL,YVR,YYZ,ZAG,ZRH`

**DL — Delta Air Lines** · hubs : ATL,DTW,MSP,JFK,SLC,SEA,LAX,BOS
Aéroports desservis déjà connus (104), à confirmer et compléter : `ACC,AKL,AMS,ARN,ATH,ATL,AUS,BCN,BER,BNE,BOG,BOS,BRU,BWI,CDG,CLT,CMN,CPH,CPT,CTA,CUN,DCA,DEL,DEN,DFW,DSS,DTW,DUB,EDI,EWR,EZE,FCO,FDF,FRA,GDL,GIG,GRU,HAV,HND,HNL,IAD,IAH,ICN,JFK,JNB,KEF,LAS,LAX,LGA,LHR,LIM,LIR,LIS,LOS,MAD,MAN,MBJ,MCO,MDE,MEL,MEX,MIA,MLA,MSP,MTY,MUC,MXP,NAP,NAS,NCE,OPO,ORD,PDX,PHL,PHX,PRG,PTP,PTY,PUJ,PVG,RAK,RDU,SAN,SCL,SDQ,SEA,SFO,SJO,SJU,SLC,SXM,SYD,TLV,TPA,TPE,VCE,VIE,YHZ,YOW,YUL,YVR,YYC,YYZ,ZRH`

**UA — United Airlines** · hubs : ORD,EWR,IAD,DEN,SFO,IAH,LAX
Aéroports desservis déjà connus (113), à confirmer et compléter : `ACC,AGP,AKL,AMS,ARN,ATH,ATL,AUS,BCN,BER,BIO,BKK,BNE,BOG,BOS,BRU,BWI,CDG,CEB,CHC,CLT,CPT,CUN,DBV,DCA,DEL,DEN,DFW,DTW,DUB,DXB,EDI,EWR,EZE,FAO,FCO,FRA,GDL,GIG,GRU,GVA,HKG,HND,HNL,IAD,IAH,ICN,JNB,KEF,KHH,KIX,LAS,LAX,LGA,LHR,LIM,LIR,LIS,LOS,MAD,MBJ,MCO,MDE,MEL,MEX,MIA,MID,MNL,MSP,MTY,MUC,MXP,NAP,NAS,NCE,NGO,NRT,OPO,ORD,PDX,PEK,PHL,PHX,PMI,PTY,PUJ,PVG,RAK,RDU,SAN,SCL,SDQ,SEA,SFO,SGN,SIN,SJO,SJU,SLC,SPU,SXM,SYD,TLV,TPA,TPE,UIO,VCE,YHZ,YUL,YVR,YYC,YYZ,ZRH`

**AA — American Airlines** · hubs : DFW,CLT,ORD,MIA,PHX,PHL,LAX,JFK
Aéroports desservis déjà connus (90), à confirmer et compléter : `AKL,AMS,ATH,ATL,AUS,BCN,BNE,BOG,BOS,BUD,BWI,CDG,CLT,CPH,CTG,CUN,DCA,DEL,DEN,DFW,DTW,DUB,EDI,EWR,EZE,FCO,FDF,FRA,GDL,GIG,GRU,HAV,HND,HNL,IAD,IAH,ICN,JFK,LAS,LAX,LGA,LHR,LIM,LIR,LIS,MAD,MBJ,MCO,MDE,MEX,MIA,MID,MSP,MTY,MUC,MXP,NAP,NAS,NCE,NRT,ORD,PDX,PHL,PHX,PRG,PTP,PTY,PUJ,PVG,RDU,SAN,SCL,SDQ,SEA,SFO,SJO,SJU,SLC,SXM,SYD,TPA,UIO,VCE,YHZ,YOW,YUL,YVR,YYC,YYZ,ZRH`

**AC — Air Canada** · hubs : YYZ,YUL,YVR,YYC
Aéroports desservis déjà connus (107), à confirmer et compléter : `AKL,ALG,AMS,ARN,ATH,ATL,AUS,BCN,BER,BKK,BNE,BOG,BOM,BOS,BRU,BUD,CDG,CLT,CMN,CPH,CTA,CTG,CUN,DCA,DEL,DEN,DFW,DTW,DUB,DXB,EDI,EWR,EZE,FCO,FDF,FRA,GDL,GIG,GRU,GVA,HKG,HND,HNL,IAD,IAH,ICN,JFK,KEF,KIX,LAS,LAX,LGA,LHR,LIM,LIR,LIS,LYS,MAD,MAN,MBJ,MCO,MEX,MIA,MNL,MSP,MTY,MUC,MXP,NAP,NAS,NCE,NRT,OPO,ORD,PDX,PEK,PHL,PHX,PMI,PRG,PTP,PUJ,PVG,RDU,SAN,SCL,SDQ,SEA,SFO,SIN,SJO,SJU,SLC,SXM,SYD,TLS,TLV,TPA,VCE,VIE,YHZ,YOW,YUL,YVR,YYC,YYZ,ZRH`

**IB — Iberia** · hubs : MAD
Aéroports desservis déjà connus (73), à confirmer et compléter : `ALG,ARN,ATH,BCN,BGO,BIO,BKK,BLQ,BOG,BOM,BOS,BRU,BUD,CAI,CDG,CMN,CTA,DBV,DFW,DOH,DSS,DUS,EZE,FCO,FRA,GIG,GRU,GVA,HAM,HAV,IAD,IST,JFK,LAX,LHR,LIM,LIN,LIS,LJU,MAD,MCO,MDE,MEX,MIA,MRS,MUC,MVD,MXP,NRT,OPO,ORD,ORN,ORY,OSL,OTP,PRG,PTY,RAK,SCL,SDQ,SFO,SJO,SJU,SPU,TIA,TLV,TNG,UIO,VCE,VIE,YYZ,ZAG,ZRH`

### LOT 2

**TK — Turkish Airlines** · hubs : IST
Aéroports desservis déjà connus (150), à confirmer et compléter : `ABJ,ACC,ADD,AGP,ALG,AMM,AMS,ARN,ATH,ATL,AUH,AYT,BAH,BCN,BEG,BER,BEY,BGY,BIO,BKK,BLQ,BOD,BOG,BOM,BOS,BRU,BSL,BUD,BUS,CAI,CAN,CDG,CGK,CGN,CLJ,CMB,CMN,CPH,CPT,CTA,CUN,CZL,DBV,DEL,DEN,DFW,DMM,DOH,DPS,DSS,DUB,DUR,DUS,DXB,EDI,EWR,EZE,FCO,FRA,GOT,GRU,GVA,HAM,HAN,HEL,HKG,HKT,HND,IAD,IAH,ICN,IST,JED,JFK,JNB,KIX,KRK,KTM,KUL,KWI,LAX,LGW,LHR,LIS,LJU,LOS,LUX,LYS,MAD,MAN,MBA,MCT,MEL,MEX,MIA,MLA,MLE,MNL,MRS,MRU,MUC,MXP,NAP,NBO,NCE,NRT,OPO,ORD,ORN,OSL,OTP,PEK,PRG,PTY,PVG,RAK,RIX,RUH,SCL,SEA,SEZ,SFO,SGN,SIN,SKG,SOF,SSH,STN,STR,SVQ,SYD,TBS,TGD,TIA,TIV,TLL,TLS,TNR,TPE,TUN,VCE,VIE,VLC,VNO,WAW,YUL,YVR,YYZ,ZAG,ZRH`

**A3 — Aegean Airlines** · hubs : ATH,SKG
Aéroports desservis déjà connus (85), à confirmer et compléter : `AGP,AMM,AMS,ARN,ATH,AUH,BCN,BEG,BER,BEY,BIO,BLQ,BOD,BOM,BRU,BSL,BUD,CAI,CDG,CGN,CPH,CTA,DBV,DEL,DMM,DUB,DUS,DXB,EDI,EIN,FCO,FRA,GOT,GVA,HAM,HEL,HER,IST,JED,KRK,KWI,LCA,LGW,LHR,LIS,LJU,LUX,LYS,MAD,MAN,MLA,MRS,MUC,MXP,NAP,NCE,NTE,OPO,OSL,OTP,PMI,PRG,RAK,RIX,RUH,SKG,SOF,SPU,SSH,STR,SVQ,TBS,TGD,TIA,TLL,TLS,TLV,TUN,VCE,VIE,VLC,VNO,WAW,ZAG,ZRH`

**AM — Aeromexico** · hubs : MEX,MTY
Aéroports desservis déjà connus (50), à confirmer et compléter : `AMS,ATL,AUS,BCN,BOG,BOS,CDG,CTG,CUN,DEN,DFW,DTW,EWR,EZE,FCO,GDL,GRU,HAV,IAD,IAH,ICN,JFK,LAS,LAX,LHR,LIM,MAD,MCO,MDE,MEX,MIA,MID,MTY,NRT,ORD,PHL,PHX,PTY,PUJ,RDU,SCL,SDQ,SEA,SFO,SJO,SLC,TPA,YUL,YVR,YYZ`

**AH — Air Algérie** · hubs : ALG,ORN,CZL
Aéroports desservis déjà connus (42), à confirmer et compléter : `ABJ,ADD,ALG,AMM,AYT,BCN,BEY,BOD,BRU,BSL,BUD,CAI,CDG,CRL,CZL,DOH,DSS,DXB,FCO,FRA,GVA,IST,JED,JNB,LHR,LIS,LYS,MAD,MRS,MXP,NCE,OPO,ORN,ORY,PEK,PMI,SVO,TLS,TUN,VIE,VLC,YUL`

**TX — Air Caraïbes** · hubs : ORY
Aéroports desservis déjà connus (8), à confirmer et compléter : `CAY,CUN,FDF,ORY,PTP,PUJ,SDQ,SXM`

**UX — Air Europa** · hubs : MAD
Aéroports desservis déjà connus (42), à confirmer et compléter : `AGP,AMS,ATH,BCN,BIO,BLQ,BOG,BRU,CUN,EZE,FCO,FRA,GRU,GVA,HAV,IST,JFK,JNB,LGW,LIM,LIS,MAD,MDE,MIA,MUC,MVD,MXP,OPO,ORY,PMI,PTY,PUJ,RAK,SDQ,SVQ,TLV,TNG,TUN,UIO,VCE,VLC,ZRH`

### LOT 3

**AI — Air India** · hubs : DEL,BOM
Aéroports desservis déjà connus (46), à confirmer et compléter : `AMS,BKK,BLR,BOM,CCU,CDG,CMB,CPH,DEL,DMM,DOH,DPS,DXB,EWR,FCO,FRA,HAN,HKG,HKT,HND,HYD,ICN,JED,JFK,KTM,KUL,LGW,LHR,MAA,MEL,MLE,MNL,MRU,MXP,ORD,PVG,RUH,SFO,SGN,SIN,SYD,TLV,VIE,YVR,YYZ,ZRH`

**MK — Air Mauritius** · hubs : MRU
Aéroports desservis déjà connus (13), à confirmer et compléter : `BOM,CDG,CPT,DEL,GVA,JNB,KUL,LGW,MAA,MRU,PER,RUN,TNR`

**TN — Air Tahiti Nui** · hubs : PPT
Aéroports desservis déjà connus (5), à confirmer et compléter : `AKL,CDG,LAX,NRT,PPT`

**TS — Air Transat** · hubs : YYZ,YUL,YVR,YYC
Aéroports desservis déjà connus (47), à confirmer et compléter : `AGP,AMS,ATH,BCN,BOD,BRU,BSL,CDG,CTG,CUN,DSS,DUB,FAO,FCO,FDF,GIG,HAV,KEF,LGW,LIR,LIS,LYS,MAD,MBJ,MCO,MDE,MIA,MRS,NCE,NTE,OPO,PTP,PUJ,RAK,SJO,SXM,TIA,TLS,VCE,VLC,YHZ,YOW,YUL,YVR,YYC,YYZ,ZAG`

**AS — Alaska Airlines** · hubs : SEA,PDX,SFO,LAX,PHX
Aéroports desservis déjà connus (42), à confirmer et compléter : `ATL,AUS,BOS,BWI,CUN,DCA,DEN,DFW,DTW,EWR,FCO,GDL,HNL,IAD,IAH,ICN,JFK,KEF,LAS,LAX,LHR,LIR,MCO,MIA,MSP,MTY,NRT,ORD,PDX,PHL,PHX,RDU,SAN,SEA,SFO,SJO,SLC,TPA,YEG,YVR,YYC,YYZ`

**NH — ANA (All Nippon Airways)** · hubs : HND,NRT
Aéroports desservis déjà connus (40), à confirmer et compléter : `ARN,BKK,BOM,BRU,CAN,CDG,CGK,DEL,FRA,GMP,HAN,HKG,HND,HNL,IAD,IAH,IST,JFK,KIX,KUL,LAX,LHR,MEX,MNL,MUC,MXP,NGO,NRT,ORD,PEK,PER,PVG,SEA,SFO,SGN,SIN,SYD,SZX,VIE,YVR`

### LOT 4

**OS — Austrian Airlines** · hubs : VIE
Aéroports desservis déjà connus (77), à confirmer et compléter : `AGP,AMM,AMS,ARN,ATH,AYT,BCN,BEG,BER,BGO,BIO,BKK,BLQ,BOS,BRU,BSL,BUD,CAI,CDG,CGN,CPH,CTA,CUN,DBV,DUS,EDI,EWR,FCO,FRA,GOT,GVA,HAM,HER,IAD,IST,JFK,KEF,KRK,LAX,LCA,LHR,LYS,MAN,MLE,MRS,MRU,MUC,MXP,NAP,NCE,NRT,OPO,ORD,OSL,OTP,PMI,PRG,PVG,RAK,SKG,SOF,SPU,STR,SVQ,TBS,TGD,TIA,TIV,TLV,VCE,VIE,VLC,VNO,WAW,YUL,ZAG,ZRH`

**AV — Avianca** · hubs : BOG
Aéroports desservis déjà connus (29), à confirmer et compléter : `BCN,BOG,BOS,CDG,CTG,CUN,EZE,GIG,GRU,IAD,IAH,JFK,LAX,LHR,LIM,MAD,MCO,MDE,MEX,MIA,MTY,MVD,ORD,PTY,SCL,SFO,SJO,TPA,UIO`

**CX — Cathay Pacific** · hubs : HKG
Aéroports desservis déjà connus (60), à confirmer et compléter : `AKL,AMS,BCN,BKK,BLR,BNE,BOM,BOS,BRU,CAN,CDG,CEB,CGK,CHC,CMB,DEL,DFW,DPS,DXB,FCO,FRA,HAN,HKG,HKT,HND,HYD,ICN,JFK,JNB,KHH,KIX,KTM,KUL,LAX,LHR,MAA,MAD,MAN,MEL,MNL,MUC,MXP,NGO,NRT,ORD,PEK,PEN,PER,PVG,RUH,SEA,SFO,SGN,SIN,SUB,SYD,TPE,YVR,YYZ,ZRH`

**CI — China Airlines** · hubs : TPE,KHH
Aéroports desservis déjà connus (41), à confirmer et compléter : `AKL,AMS,BKK,BNE,CAN,CEB,CGK,DAD,DPS,FCO,FRA,GMP,HAN,HKG,HND,ICN,JFK,KHH,KIX,KUL,LAX,LHR,MEL,MNL,NGO,NRT,PEK,PEN,PHX,PRG,PUS,PVG,SEA,SFO,SGN,SIN,SYD,SZX,TPE,VIE,YVR`

**CM — Copa Airlines** · hubs : PTY
Aéroports desservis déjà connus (43), à confirmer et compléter : `ATL,AUS,BOG,BOS,BSB,BWI,CTG,CUN,DEN,EZE,GDL,GIG,GRU,HAV,IAD,JFK,LAS,LAX,LIM,LIR,MBJ,MCO,MDE,MEX,MIA,MTY,MVD,NAS,ORD,PTY,PUJ,RDU,SAN,SCL,SDQ,SFO,SJO,SJU,SXM,TPA,UIO,YUL,YYZ`

**SS — Corsair** · hubs : ORY
Aéroports desservis déjà connus (12), à confirmer et compléter : `ABJ,BOD,FDF,LYS,MRS,MRU,NTE,ORY,PTP,PUJ,RUN,TNR`

### LOT 5

**MS — EgyptAir** · hubs : CAI
Aéroports desservis déjà connus (62), à confirmer et compléter : `ABJ,ACC,ADD,ALG,AMM,AMS,ARN,ATH,AUH,BAH,BCN,BER,BEY,BOM,BRU,BUD,CAI,CAN,CDG,CGK,CMN,CPH,DEL,DMM,DOH,DUB,DUS,DXB,EWR,FCO,FRA,GVA,HRG,IAD,IST,JED,JFK,JNB,KWI,LAX,LCA,LHR,LIS,LOS,MAD,MAN,MCT,MUC,MXP,NBO,NRT,ORD,PEK,PRG,PVG,RUH,SSH,TUN,VCE,VIE,YYZ,ZRH`

**EK — Emirates** · hubs : DXB
Aéroports desservis déjà connus (115), à confirmer et compléter : `ABJ,ACC,ADD,AKL,ALG,AMM,AMS,ARN,ATH,BAH,BCN,BEY,BKK,BLQ,BLR,BNE,BOG,BOM,BOS,BRU,BUD,CAI,CAN,CCU,CDG,CEB,CGK,CHC,CMB,CMN,CPH,CPT,CRK,DAD,DEL,DFW,DMM,DPS,DSS,DUB,DUR,DUS,DXB,EDI,EWR,EZE,FCO,FRA,GIG,GRU,GVA,HAM,HAN,HKG,HKT,HND,HYD,IAD,IAH,ICN,IST,JED,JFK,JNB,KIX,KUL,KWI,LAX,LCA,LGW,LHR,LIS,LOS,LYS,MAA,MAD,MAN,MCO,MCT,MEL,MEX,MIA,MLA,MLE,MNL,MRU,MUC,MXP,NBO,NCE,NRT,ORD,OSL,PEK,PER,PRG,PVG,RUH,SEA,SEZ,SFO,SGN,SIN,STN,SYD,SZX,TNR,TPE,TUN,VCE,VIE,WAW,YUL,YYZ,ZRH`

**ET — Ethiopian Airlines** · hubs : ADD
Aéroports desservis déjà connus (70), à confirmer et compléter : `ABJ,ACC,ADD,AMM,ARN,ATH,ATL,AUH,BAH,BEY,BKK,BLR,BOM,BRU,CAI,CAN,CDG,CGK,CPH,CPT,DEL,DMM,DOH,DSS,DUB,DXB,EWR,EZE,FCO,FRA,GRU,GVA,HAN,HKG,HYD,IAD,ICN,IST,JED,JFK,JNB,KUL,KWI,LGW,LHR,LOS,MAA,MAD,MAN,MBA,MCT,MNL,MRS,MXP,NBO,NRT,OPO,ORD,OSL,PEK,PVG,RUH,SEZ,SIN,TLV,TNR,VIE,WAW,YYZ,ZRH`

**EY — Etihad Airways** · hubs : AUH
Aéroports desservis déjà connus (74), à confirmer et compléter : `ADD,AGP,AMM,AMS,ATH,ATL,AUH,AYT,BAH,BCN,BEY,BKK,BLR,BOM,BOS,BRU,CAI,CCU,CDG,CGK,CMB,CMN,CPH,DEL,DMM,DOH,DPS,DUB,DUS,FCO,FRA,GVA,HAN,HKG,HKT,HYD,IAD,ICN,IST,JED,JFK,JNB,KIX,KUL,KWI,LHR,LIS,MAA,MAD,MAN,MCT,MEL,MLE,MNL,MUC,MXP,NBO,NCE,NRT,ORD,PKX,PRG,RUH,SEZ,SIN,SVO,SYD,TLV,TPE,TUN,VIE,WAW,YYZ,ZRH`

**EW — Eurowings** · hubs : DUS,CGN,HAM,STR,BER
Aéroports desservis déjà connus (73), à confirmer et compléter : `AGP,AMM,ARN,ATH,AUH,AYT,BCN,BEG,BER,BEY,BGO,BIO,BLQ,BRU,BSL,BUD,CAI,CDG,CGN,CLJ,CMN,CPH,CTA,DBV,DUB,DUS,DWC,DXB,EDI,FAO,FCO,FRA,GDN,GOT,GVA,HAM,HEL,HER,JED,KEF,KRK,LCA,LHR,LIS,LYS,MAN,MLA,MRS,MUC,MXP,NAP,NCE,OPO,OSL,OTP,PMI,PRG,RAK,SKG,SPU,STR,TBS,TIA,TIV,TLL,TLV,TNG,TUN,VCE,VIE,VLC,ZAG,ZRH`

**BR — EVA Air** · hubs : TPE
Aéroports desservis déjà connus (41), à confirmer et compléter : `AMS,BKK,BNE,CAN,CDG,CEB,CGK,CRK,DAD,DFW,DPS,GMP,HAN,HKG,HKT,HND,IAH,ICN,JFK,KHH,KIX,KUL,LAX,LHR,MNL,MUC,MXP,NRT,ORD,PEK,PUS,PVG,SEA,SFO,SGN,SIN,SZX,TPE,VIE,YVR,YYZ`

### LOT 6

**AY — Finnair** · hubs : HEL
Aéroports desservis déjà connus (81), à confirmer et compléter : `AGP,AMS,ARN,ATH,AYT,BCN,BER,BGO,BKK,BLL,BLQ,BOD,BOJ,BRU,BUD,CDG,CPH,CTA,DEL,DFW,DOH,DUB,DUS,DXB,EDI,FAO,FCO,FRA,GDN,GOT,GVA,HAV,HEL,HER,HKG,HKT,HND,ICN,JFK,KEF,KIX,KRK,LAX,LHR,LIN,LIS,LJU,LYS,MAD,MAN,MIA,MLA,MUC,MXP,NAP,NCE,NGO,NRT,OPO,ORD,OSL,PFO,PMI,PRG,PUJ,PVG,RIX,SEA,SIN,SPU,STR,TIA,TLL,TLV,VCE,VIE,VLC,VNO,WAW,YYZ,ZRH`

**BF — French Bee** · hubs : ORY
Aéroports desservis déjà connus (8), à confirmer et compléter : `EWR,LAX,MIA,ORY,PPT,RUN,SFO,YUL`

**I2 — Iberia Express** · hubs : MAD
Aéroports desservis déjà connus (15), à confirmer et compléter : `AGP,AMS,CDG,CPH,DUB,EDI,HER,KEF,LGW,MAD,MAN,NAP,PMI,SVQ,TLV`

**AZ — ITA Airways** · hubs : FCO,LIN
Aéroports desservis déjà connus (53), à confirmer et compléter : `ACC,AGP,ALG,AMS,ATH,BCN,BKK,BLQ,BOS,BRU,CAI,CDG,CTA,DEL,DSS,DUS,EZE,FCO,FRA,GIG,GRU,GVA,HAM,HER,HND,IAD,IAH,JFK,LAX,LHR,LIN,MAD,MIA,MLA,MLE,MRS,MRU,MUC,NAP,NCE,ORD,ORY,PMI,SFO,SKG,SOF,TIA,TLV,TUN,VCE,VLC,YYZ,ZRH`

**JL — Japan Airlines (JAL)** · hubs : HND,NRT
Aéroports desservis déjà connus (36), à confirmer et compléter : `BKK,BLR,BOS,CAN,CDG,CGK,DEL,DFW,DOH,FRA,GMP,HAN,HEL,HKG,HND,HNL,JFK,KIX,KUL,LAX,LHR,MEL,MNL,NGO,NRT,ORD,PEK,PVG,SAN,SEA,SFO,SGN,SIN,SYD,TPE,YVR`

**B6 — JetBlue** · hubs : JFK,BOS,EWR
Aéroports desservis déjà connus (46), à confirmer et compléter : `AMS,ATL,AUS,BCN,BOS,BWI,CDG,CLT,CUN,DCA,DEN,DFW,DTW,DUB,EDI,EWR,IAH,JFK,LAS,LAX,LGA,LGW,LHR,LIR,MAD,MBJ,MCO,MDE,MXP,NAS,ORD,PDX,PHL,PHX,PUJ,RDU,SAN,SDQ,SEA,SFO,SJO,SJU,SLC,SXM,TPA,YVR`

### LOT 7

**KE — Korean Air** · hubs : ICN,GMP
Aéroports desservis déjà connus (51), à confirmer et compléter : `AMS,ATL,BKK,BOS,BUD,CAN,CDG,CEB,CGK,DAD,DEL,DFW,DPS,DXB,FCO,FRA,GMP,HAN,HKG,HKT,HND,IAD,ICN,IST,JFK,KIX,KTM,KUL,LAS,LAX,LHR,MAD,MNL,MXP,NGO,NRT,ORD,PEK,PRG,PUS,PVG,SEA,SFO,SGN,SIN,SYD,SZX,TPE,YVR,YYZ,ZRH`

**LA — LATAM** · hubs : SCL,LIM,GRU,BOG
Aéroports desservis déjà connus (37), à confirmer et compléter : `AEP,AKL,BCN,BOG,BOS,BSB,CDG,CTG,CUN,EZE,FCO,FRA,GIG,GRU,HAV,JFK,JNB,LAX,LHR,LIM,LIS,MAD,MBJ,MCO,MDE,MEL,MEX,MIA,MVD,MXP,PPT,PUJ,SCL,SJO,SYD,UIO,VCP`

**LO — LOT Polish Airlines** · hubs : WAW
Aéroports desservis déjà connus (76), à confirmer et compléter : `AGP,AMS,ARN,ATH,BCN,BEG,BER,BEY,BGO,BKK,BLL,BLQ,BRU,BUD,CDG,CLJ,CPH,DBV,DEL,DUB,DUS,EWR,FCO,FRA,GDN,GOT,GVA,HAM,HER,ICN,IST,JFK,KEF,KRK,LAX,LCA,LHR,LIS,LJU,LUX,LYS,MAD,MIA,MLA,MUC,MXP,NCE,NRT,OPO,ORD,ORY,OSL,OTP,PMI,PRG,RAK,RIX,RUH,SFO,SKG,SOF,SPU,STR,TBS,TGD,TIA,TIV,TLL,TLV,VCE,VIE,VNO,WAW,YYZ,ZAG,ZRH`

**DY — Norwegian** · hubs : OSL,CPH,ARN,BGO
Aéroports desservis déjà connus (61), à confirmer et compléter : `AGP,ARN,ATH,AYT,BCN,BER,BGO,BGY,BIO,BLL,BLQ,BRU,BSL,BUD,CDG,CPH,CTA,DBV,DUB,DUS,EDI,FAO,FCO,GDN,GOT,GVA,HAM,HEL,HER,HRG,IST,KEF,KRK,LCA,LGW,LIS,MAD,MAN,MLA,MUC,MXP,NAP,NCE,OPO,OSL,OTP,PMI,PRG,RIX,SOF,SPU,TIA,TIV,TLL,TLS,TLV,VCE,VIE,VLC,VNO,ZAG`

**PR — Philippine Airlines** · hubs : MNL,CEB
Aéroports desservis déjà connus (34), à confirmer et compléter : `BKK,BNE,CEB,CGK,CRK,DAD,DOH,DPS,DXB,HAN,HKG,HND,ICN,JFK,KIX,LAX,MEL,MNL,NGO,NRT,ORD,PEK,PER,PUS,PVG,RUH,SEA,SFO,SGN,SIN,SYD,TPE,YVR,YYZ`

**QR — Qatar Airways** · hubs : DOH
Aéroports desservis déjà connus (112), à confirmer et compléter : `ABJ,ACC,ADD,AGP,AKL,ALG,AMM,AMS,ARN,ATH,ATL,AUH,AYT,BAH,BCN,BEG,BER,BEY,BKK,BLR,BNE,BOM,BOS,BRU,BUD,CAI,CAN,CCU,CDG,CEB,CGK,CMB,CMN,CPH,CPT,CRK,DEL,DFW,DMM,DOH,DPS,DUB,DUR,DUS,DXB,EDI,FCO,FRA,GRU,GVA,HAM,HAN,HKG,HKT,HYD,IAD,IAH,ICN,IST,JED,JFK,JNB,KIX,KTM,KUL,KWI,LAX,LCA,LGW,LHR,LIS,LOS,MAA,MAD,MAN,MCT,MEL,MIA,MLA,MLE,MNL,MUC,MXP,NBO,NCE,NRT,ORD,OSL,OTP,PEN,PER,PKX,PRG,PVG,RAK,RUH,SEA,SEZ,SFO,SGN,SIN,SOF,SVO,SYD,TBS,TUN,VCE,VIE,WAW,YYZ,ZAG,ZRH`

### LOT 8

**AT — Royal Air Maroc** · hubs : CMN
Aéroports desservis déjà connus (53), à confirmer et compléter : `ABJ,ACC,AGP,AMS,BCN,BLQ,BOD,BRU,CAI,CDG,CMN,DOH,DSS,DUS,DXB,FCO,FRA,GRU,GVA,IAD,IST,JED,JFK,LAX,LGW,LHR,LIS,LOS,LYS,MAD,MAN,MIA,MRS,MUC,MXP,NAP,NCE,NTE,OPO,ORY,PKX,RAK,RUH,STN,SVO,TLS,TNG,TUN,VCE,VLC,YUL,YYZ,ZRH`

**FR — Ryanair** · hubs : STN,DUB,BGY,CRL,BCN,CGN,BER,OPO,MAN,EDI,PMI
Aéroports desservis déjà connus (69), à confirmer et compléter : `AGP,AMM,AMS,ARN,ATH,BCN,BER,BGY,BLQ,BOJ,BRU,BSL,BTS,BUD,CGN,CLJ,CPH,CRL,CTA,DBV,DUB,EDI,EIN,FAO,FCO,GDN,GOT,HAM,HEL,HER,KRK,LCA,LGW,LIS,LUX,MAD,MAN,MLA,MRS,MXP,NAP,NCE,NTE,OPO,ORK,OSL,OTP,PFO,PGF,PMI,PRG,RAK,RIX,SKG,SOF,SPU,STN,SVQ,TGD,TIA,TLL,TLS,TNG,VCE,VIE,VLC,VNO,WAW,ZAG`

**SK — SAS Scandinavian** · hubs : CPH,OSL,ARN
Aéroports desservis déjà connus (82), à confirmer et compléter : `AGP,AMS,ARN,ATH,ATL,AYT,BCN,BER,BGO,BIO,BKK,BLL,BLQ,BOD,BOM,BOS,BRU,BUD,CDG,CPH,CTA,DBV,DUB,DUS,EDI,EWR,FAO,FCO,FRA,GDN,GOT,GVA,HAM,HEL,HER,HKT,HND,IAD,ICN,IST,JFK,KEF,KRK,LAX,LCA,LHR,LIN,LIS,LUX,LYS,MAD,MAN,MIA,MLA,MRS,MUC,MXP,NAP,NCE,OPO,ORD,OSL,OTP,PMI,PRG,RAK,RIX,SFO,SKG,SPU,STR,TIA,TIV,TLL,TLV,VCE,VIE,VLC,VNO,WAW,YYZ,ZRH`

**SV — Saudia** · hubs : JED,RUH,DMM
Aéroports desservis déjà connus (68), à confirmer et compléter : `ADD,AGP,ALG,AMM,AMS,ATH,AUH,AYT,BAH,BCN,BEY,BKK,BLR,BOM,BUS,CAI,CAN,CCU,CDG,CGK,CMN,CZL,DEL,DMM,DPS,DXB,FCO,FRA,GVA,HER,HKT,HRG,HYD,IAD,IST,JED,JFK,JNB,KUL,KWI,LAX,LCA,LGW,LHR,MAA,MAD,MAN,MCT,MLE,MNL,MUC,MXP,NBO,NCE,ORN,PKX,RAK,RUH,SIN,SSH,SUB,SVO,TNG,TUN,VCE,VIE,YYZ,ZRH`

**SQ — Singapore Airlines** · hubs : SIN
Aéroports desservis déjà connus (63), à confirmer et compléter : `AKL,AMS,BCN,BKK,BLR,BNE,BOM,BRU,CAN,CCU,CDG,CEB,CHC,CMB,CPH,CPT,DAD,DEL,DPS,DXB,EWR,FCO,FRA,HAN,HKG,HKT,HND,HYD,ICN,IST,JFK,JNB,KIX,KTM,KUL,LAX,LGW,LHR,MAA,MAN,MEL,MLE,MNL,MUC,MXP,NGO,NRT,PEK,PEN,PER,PKX,PUS,PVG,RUH,SEA,SFO,SGN,SIN,SUB,SYD,SZX,TPE,ZRH`

**LX — SWISS** · hubs : ZRH,GVA
Aéroports desservis déjà connus (81), à confirmer et compléter : `AGP,AMS,ARN,ATH,AYT,BCN,BEG,BER,BEY,BKK,BLL,BLQ,BOD,BOM,BOS,BRU,BUD,CAI,CDG,CLJ,CPH,CTA,DBV,DEL,DUB,DUS,DXB,EWR,FAO,FCO,GDN,GRU,GVA,HER,HKG,IAD,ICN,JFK,JNB,KRK,LAX,LGW,LHR,LIS,LJU,LUX,MAD,MAN,MIA,MLA,MRS,MUC,MXP,NAP,NCE,NRT,NTE,OPO,ORD,ORK,OSL,OTP,PMI,PRG,PVG,RAK,SFO,SIN,SKG,SOF,STR,TIA,TLL,VCE,VIE,VLC,VNO,WAW,YUL,YYZ,ZRH`

### LOT 9

**TP — TAP Air Portugal** · hubs : LIS,OPO
Aéroports desservis déjà connus (69), à confirmer et compléter : `ABJ,ACC,AGP,ALG,AMS,ARN,ATH,BCN,BER,BIO,BLQ,BOD,BOS,BRU,BSB,BSL,BUD,CMN,CPH,CPT,CUN,DJE,DSS,DUB,DUS,EWR,FAO,FCO,FRA,GIG,GRU,GVA,HAM,HEL,IAD,JFK,LAX,LGW,LHR,LIS,LUX,LYS,MAD,MAN,MIA,MRS,MUC,MXP,NAP,NCE,NTE,OPO,ORD,ORY,PMI,PRG,RAK,SFO,STR,SVQ,TLS,TLV,VCE,VIE,VLC,WAW,YUL,YYZ,ZRH`

**TG — Thai Airways** · hubs : BKK
Aéroports desservis déjà connus (41), à confirmer et compléter : `AMS,ARN,BKK,BLR,BOM,BRU,CAN,CCU,CDG,CMB,CPH,DEL,DPS,FRA,HAN,HKG,HKT,HND,HYD,ICN,IST,KHH,KIX,KTM,KUL,LHR,MAA,MEL,MNL,MUC,MXP,NGO,NRT,OSL,PEK,PEN,PER,SGN,SIN,SYD,ZRH`

**TU — Tunisair** · hubs : TUN,DJE
Aéroports desservis déjà connus (45), à confirmer et compléter : `ABJ,ALG,AMS,BCN,BEG,BER,BEY,BLQ,BOD,BRU,BSL,CAI,CMN,CZL,DJE,DSS,DUS,FCO,FRA,GVA,HAM,IST,JED,LGW,LHR,LIS,LYS,MAD,MLA,MRS,MUC,MXP,NAP,NBE,NCE,NTE,ORN,ORY,PRG,TLS,TUN,VCE,VIE,YUL,ZRH`

**VN — Vietnam Airlines** · hubs : HAN,SGN,DAD
Aéroports desservis déjà connus (39), à confirmer et compléter : `BKK,BLR,BOM,CAN,CDG,CEB,CGK,CPH,DAD,DEL,DPS,FRA,HAN,HKG,HKT,HND,HYD,ICN,KHH,KIX,KUL,LHR,MEL,MNL,MUC,MXP,NGO,NRT,PEK,PEN,PER,PKX,PUS,PVG,SFO,SGN,SIN,SYD,TPE`

**V7 — Volotea** · hubs : NTE,VCE,BOD,MRS,LYS,PMI,ATH
Aéroports desservis déjà connus (44), à confirmer et compléter : `AGP,ALG,ATH,BCN,BER,BIO,BLQ,BOD,BRU,CDG,CPH,CTA,DBV,FAO,FCO,HAM,HER,LGW,LIN,LIS,LUX,LYS,MAD,MLA,MRS,MXP,NAP,NCE,NTE,OPO,ORN,ORY,OSL,PGF,PMI,PRG,RAK,SKG,SPU,SVQ,TLS,VCE,VIE,VLC`

**VY — Vueling** · hubs : BCN,ORY,CDG,MAD,FCO
Aéroports desservis déjà connus (59), à confirmer et compléter : `AGP,ALG,AMS,ARN,ATH,BCN,BER,BIO,BLL,BLQ,BOD,BRU,BSL,CAI,CDG,CPH,CTA,DBV,DUB,DUS,EDI,FAO,FCO,GVA,HAM,HER,IST,KEF,LGW,LHR,LIS,LYS,MAD,MAN,MLA,MRS,MUC,MXP,NAP,NCE,NTE,OPO,ORN,ORY,OSL,PMI,PRG,RAK,SPU,STR,SVQ,TIA,TIV,TNG,TUN,VCE,VIE,VLC,ZRH`

### LOT 10

**WS — WestJet** · hubs : YYC,YYZ,YVR,YEG
Aéroports desservis déjà connus (56), à confirmer et compléter : `AMS,ATL,AUS,BCN,BOS,CDG,CPH,CUN,DEN,DTW,DUB,EDI,FCO,GDL,GRU,HAV,HNL,IAD,IAH,ICN,JFK,KEF,LAS,LAX,LGW,LHR,LIR,LIS,MAD,MBJ,MCO,MDE,MEX,MID,MSP,NRT,ORD,PDX,PHX,PTY,PUJ,SAN,SEA,SFO,SJU,SLC,SXM,TPA,YEG,YHZ,YOW,YUL,YVR,YWG,YYC,YYZ`

**W6 — Wizz Air** · hubs : BUD,OTP,WAW,KRK,GDN,TIA,SOF,BEG
Aéroports desservis déjà connus (66), à confirmer et compléter : `AGP,ARN,ATH,AUH,AYT,BCN,BEG,BER,BGO,BGY,BLL,BLQ,BOD,BOJ,BSL,BTS,BUD,CGN,CLJ,CPH,CRL,CTA,DBV,DXB,EIN,FCO,GDN,GOT,HAM,HER,HRG,IST,JED,KEF,KRK,LCA,LGW,LIS,LJU,LYS,MAD,MLA,MXP,NAP,NCE,OPO,ORY,OSL,OTP,PMI,PRG,RAK,SKG,SOF,SPU,SSH,STR,SVQ,TGD,TIA,TLL,TLV,VCE,VLC,VNO,WAW`

**DE — Condor** · hubs : FRA
Aéroports desservis déjà connus (50), à confirmer et compléter : `AGP,AYT,BCN,BER,BEY,BKK,BOS,BUD,CDG,CGN,CPT,CUN,DUS,DXB,FAO,FCO,FDF,FRA,HAM,HER,HKT,HRG,JFK,JNB,LAS,LAX,LCA,MBA,MBJ,MIA,MLE,MRU,MUC,MXP,PDX,PMI,PTY,PUJ,SDQ,SEA,SEZ,SFO,SPU,STR,VCE,VIE,YVR,YYC,YYZ,ZRH`

**QS — Smartwings** · hubs : PRG
Aéroports desservis déjà connus (46), à confirmer et compléter : `AGP,ARN,ATH,AYT,BAH,BCN,BIO,BOJ,BRU,BTS,BUD,CDG,CGN,CTA,DBV,DJE,DOH,DSS,DUS,DWC,DXB,FCO,GDN,GVA,HER,HRG,LCA,LIS,MAD,MBA,MCT,NAP,NCE,OPO,OTP,PMI,PRG,SKG,SPU,SSH,TLL,TLS,TLV,VCE,VLC,WAW`

**VS — Virgin Atlantic** · hubs : LHR,MAN
Aéroports desservis déjà connus (24), à confirmer et compléter : `ATL,BLR,BOM,BOS,CPT,CUN,DEL,IAD,ICN,JFK,JNB,LAS,LAX,LHR,LOS,MAN,MBJ,MCO,MIA,MLE,SEA,SFO,TPA,YYZ`

**VA — Virgin Australia** · hubs : SYD,MEL,BNE,PER
Aéroports desservis déjà connus (6), à confirmer et compléter : `BNE,DPS,MEL,NAN,PER,SYD`

### LOT 11

**QF — Qantas** · hubs : SYD,MEL,BNE,PER
Aéroports desservis déjà connus (29), à confirmer et compléter : `AKL,BKK,BLR,BNE,CDG,CGK,CHC,DEL,DFW,DPS,FCO,HKG,HND,HNL,JFK,JNB,LAX,LHR,MEL,MNL,NAN,NOU,NRT,PER,SCL,SFO,SIN,SYD,YVR`

**LY — EL AL Israel Airlines** · hubs : TLV
Aéroports desservis déjà connus (32), à confirmer et compléter : `AMS,ATH,BCN,BER,BKK,BOS,BUD,CDG,DXB,EWR,FCO,FRA,GVA,HKT,ICN,JFK,LAX,LHR,LIS,MAD,MIA,MUC,MXP,NCE,NRT,OTP,PRG,SOF,TLV,VCE,VIE,ZRH`

**CA — Air China** · hubs : PEK,PKX
Aéroports desservis déjà connus (62), à confirmer et compléter : `AKL,ARN,ATH,BCN,BKK,BRU,BUD,CAI,CAN,CDG,CGK,CMB,CPH,DEL,DUS,DXB,FCO,FRA,GMP,GRU,GVA,HAN,HAV,HKG,HKT,HND,IAD,ICN,IST,JED,JFK,JNB,KIX,KTM,KUL,LAX,LGW,LHR,MAD,MEL,MNL,MUC,MXP,NGO,NRT,PEK,PKX,PUS,PVG,RUH,SFO,SGN,SIN,SVO,SYD,SZX,TBS,TPE,VIE,WAW,YVR,YYZ`

**CZ — China Southern Airlines** · hubs : CAN
Aéroports desservis déjà connus (75), à confirmer et compléter : `ADD,AKL,AMS,ATL,BEG,BKI,BKK,BNE,BOS,BUD,CAN,CDG,CEB,CGK,CHC,CMB,DAD,DEL,DFW,DMK,DOH,DPS,DXB,FCO,FRA,GMP,HAN,HKG,HKT,HND,IAD,IAH,ICN,IST,JED,JFK,KHH,KIX,KTM,KUL,LAX,LGW,LHR,LUX,MAD,MEL,MEX,MLE,MNL,MRU,MXP,NBO,NGO,NRT,ORD,PEK,PEN,PER,PKX,PUS,PVG,RUH,SFO,SGN,SIN,STN,SUB,SVO,SYD,SZX,TBS,TPE,VIE,YVR,YYZ`

**MU — China Eastern Airlines** · hubs : PVG
Aéroports desservis déjà connus (74), à confirmer et compléter : `ADD,AKL,AMS,ARN,AUH,BAH,BKK,BNE,BOM,BRU,CAI,CAN,CCU,CDG,CEB,CGK,CMB,CPH,CRK,DAD,DEL,DMK,DPS,DXB,EZE,FCO,FRA,GMP,GVA,HAM,HAN,HKG,HKT,HND,HNL,ICN,IST,JFK,JNB,KHH,KIX,KTM,KUL,LAX,LGW,LHR,MAD,MCT,MEL,MLE,MNL,MUC,MXP,NGO,NRT,ORD,PEK,PEN,PER,PKX,PRG,PUS,PVG,RUH,SFO,SGN,SIN,SVO,SYD,SZX,TPE,YVR,YYZ,ZRH`

**6E — IndiGo** · hubs : DEL,BOM,BLR,HYD,MAA,CCU
Aéroports desservis déjà connus (40), à confirmer et compléter : `AMS,ATH,AUH,BAH,BKK,BLR,BOM,CAN,CCU,CGK,CMB,DEL,DMM,DOH,DPS,DXB,HAN,HKG,HKT,HYD,IST,JED,KTM,KUL,KWI,LHR,MAA,MAN,MCT,MLE,MRU,NBO,PEN,PVG,RUH,RUN,SEZ,SGN,SIN,TBS`

### LOT 12

**NZ — Air New Zealand** · hubs : AKL,CHC
Aéroports desservis déjà connus (21), à confirmer et compléter : `AKL,BNE,CHC,DPS,HKG,HNL,IAH,JFK,LAX,MEL,NAN,NOU,NRT,PER,PPT,PVG,SFO,SIN,SYD,TPE,YVR`

**EI — Aer Lingus** · hubs : DUB,ORK
Aéroports desservis déjà connus (65), à confirmer et compléter : `AGP,AMS,ATH,BCN,BER,BIO,BOD,BOJ,BOS,BRU,BUD,CDG,CTA,CUN,DBV,DEN,DUB,DUS,EDI,EWR,FAO,FCO,FRA,GVA,HAM,HER,IAD,JFK,LAS,LAX,LHR,LIN,LIS,LYS,MAD,MAN,MCO,MIA,MLA,MRS,MSP,MUC,MXP,NAP,NCE,NTE,ORD,ORK,OSL,PGF,PHL,PMI,PRG,RAK,RDU,SEA,SFO,SPU,SVQ,TLS,VCE,VIE,WAW,YYZ,ZRH`

**MH — Malaysia Airlines** · hubs : KUL
Aéroports desservis déjà connus (40), à confirmer et compléter : `AKL,BKI,BKK,BLR,BNE,BOM,CAN,CCU,CDG,CGK,CMB,DAD,DEL,DOH,DPS,HAN,HKG,HKT,HND,HYD,ICN,JED,KIX,KTM,KUL,LHR,MAA,MEL,MLE,MNL,NRT,PEN,PER,PKX,PVG,SGN,SIN,SUB,SYD,TPE`

**GA — Garuda Indonesia** · hubs : CGK,DPS
Aéroports desservis déjà connus (17), à confirmer et compléter : `AMS,BKK,CAN,CGK,DOH,DPS,HKG,HND,ICN,JED,KUL,MEL,NRT,PVG,SIN,SUB,SYD`

**KM — KM Malta Airlines** · hubs : MLA
Aucun périmètre préalable — partir du plan de vol publié par la compagnie.

**FI — Icelandair** · hubs : KEF
Aucun périmètre préalable — partir du plan de vol publié par la compagnie.

