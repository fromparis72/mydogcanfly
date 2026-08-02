# -*- coding: utf-8 -*-
"""
Configuration du pipeline MyDogCanFly — rafraîchissement mensuel des routes.

Tout ce qui est "métier" (aéroports, compagnies, dates d'échantillonnage) se règle ici.
Aucune clé secrète dans ce fichier : la clé RapidAPI se passe par variable d'environnement.
"""

# ---------------------------------------------------------------------------
# 1) PÉRIMÈTRE — les 249 aéroports référencés sur le site.
#    Une arête n'est retenue que si SES DEUX extrémités figurent ici.
# ---------------------------------------------------------------------------
AIRPORTS = set("""
CDG,ORY,JFK,LAX,YUL,NRT,HND,LHR,FRA,MAD,MEX,NCE,LYS,AMS,EIN,MUC,BER,DUS,BCN,PMI,
AGP,LGW,MAN,STN,VIE,BRU,CRL,SOF,BOJ,LCA,PFO,ZAG,SPU,DBV,CPH,BLL,TLL,HEL,ATH,SKG,
HER,BUD,DUB,ORK,FCO,MXP,BGY,VCE,RIX,VNO,LUX,MLA,WAW,KRK,GDN,LIS,OPO,FAO,OTP,CLJ,
BTS,LJU,ARN,GOT,PRG,ZRH,GVA,OSL,BGO,KEF,BEG,TGD,TIV,TIA,KBP,TBS,BUS,ORD,MIA,SFO,
ATL,YYZ,YVR,YYC,CUN,GDL,MTY,GRU,GIG,BSB,VCP,EZE,AEP,SCL,BOG,MDE,CTG,LIM,SJO,LIR,
HAV,PUJ,SDQ,PTY,KIX,NGO,IST,SAW,AYT,DXB,AUH,DWC,BKK,DMK,HKT,SIN,PEK,PVG,CAN,SZX,
PKX,DEL,BOM,BLR,HYD,CGK,DPS,SUB,SGN,HAN,DAD,ICN,GMP,PUS,KUL,BKI,PEN,CMB,HKG,TPE,
KHH,MNL,CEB,CRK,DOH,JED,RUH,DMM,TLV,AMM,SYD,MEL,BNE,PER,AKL,CHC,CMN,RAK,TNG,TUN,
NBE,DJE,ALG,ORN,CZL,CAI,HRG,SSH,JNB,CPT,DUR,DSS,MRU,NBO,MBA,ADD,MID,EWR,LGA,DFW,
DEN,SEA,BOS,IAD,DCA,MSP,DTW,PHL,IAH,CLT,PHX,LAS,MCO,SLC,SAN,TPA,PDX,HNL,AUS,RDU,
BWI,YOW,YEG,YHZ,YWG,EDI,PGF,MRS,TLS,BOD,NTE,BSL,HAM,CGN,STR,VLC,SVQ,BIO,LIN,NAP,
BLQ,CTA,SVO,BAH,KWI,MCT,BEY,ABJ,LOS,ACC,RUN,SEZ,TNR,MAA,CCU,MLE,KTM,NAN,PPT,NOU,
UIO,MVD,PTP,FDF,CAY,SXM,SJU,MBJ,NAS
""".split(","))
AIRPORTS = {a.strip() for a in AIRPORTS if a.strip()}

# Sous-ensemble "hubs / bases" — pour un test peu coûteux avant le balayage complet.
# (En balayant les hubs on capte l'essentiel des réseaux hub-and-spoke.)
HUBS = set("""
CDG,ORY,AMS,LHR,LGW,FRA,MUC,DUS,CGN,HAM,STR,BER,MAD,BCN,FCO,MXP,VIE,BRU,ZRH,GVA,
CPH,OSL,ARN,HEL,KEF,WAW,PRG,BUD,OTP,LIS,OPO,DUB,IST,DOH,DXB,AUH,JED,RUH,DMM,CMN,
TUN,ALG,ADD,CAI,NBO,JNB,DEL,BOM,BLR,SIN,KUL,BKK,HKG,PVG,PEK,CAN,ICN,NRT,HND,TPE,
MNL,CGK,HAN,SGN,SYD,MEL,BNE,PER,AKL,JFK,EWR,ORD,IAH,DEN,SFO,LAX,ATL,MIA,DFW,CLT,
SEA,BOS,PHX,SLC,MSP,DTW,SEA,YYZ,YUL,YVR,YYC,YEG,MEX,MTY,GRU,GIG,SCL,LIM,BOG,PTY,
TLV,MLA,PMI
""".split(","))
HUBS = {a.strip() for a in HUBS if a.strip()} & AIRPORTS

# ---------------------------------------------------------------------------
# 2) COMPAGNIES suivies (codes IATA), = les ~80 du site.
#    Seules les arêtes dont l'OPÉRANT est dans cette liste sont attribuées.
#    -> Les vols opérés par un régional (ex. Endeavor 9E pour Delta) ou une
#       autre compagnie ne sont PAS attribués à la marque : c'est exactement
#       la règle "métal propre".
# ---------------------------------------------------------------------------
CARRIERS = set("""
AF KL LH SN U2 TO
BA DL UA AA AC IB
TK A3 AM AH TX UX
AI MK TN TS AS NH
OS AV CX CI CM SS
MS EK ET EY EW BR
AY BF I2 AZ JL B6
KE LA LO DY PR QR
AT FR SK SV SQ LX
TP TG TU VN V7 VY
WS W6 DE QS VS VA
QF LY CA CZ MU 6E
NZ EI MH GA KM FI
""".split())

# Fusion de codes : plusieurs AOC d'un même groupe = même politique animaux,
# on les rattache à un code unique (comme dans la base actuelle).
CODE_MERGE = {
    "HV": "TO",   # Transavia Netherlands -> Transavia (TO)
    "EC": "U2",   # easyJet Europe -> easyJet (U2)
    "DS": "U2",   # easyJet Switzerland -> easyJet (U2)
    # Ajoute ici d'autres fusions si besoin (ex. filiales régionales à assimiler).
}

def norm_carrier(iata):
    if not iata:
        return None
    iata = iata.strip().upper()
    return CODE_MERGE.get(iata, iata)

# ---------------------------------------------------------------------------
# 3) ÉCHANTILLONNAGE SAISONNIER.
#    On interroge chaque aéroport sur quelques jours d'ÉTÉ et quelques jours d'HIVER.
#    - présent été ET hiver  -> direct_routes (année-pleine)
#    - présent une seule saison -> seasonal_routes
#    Plusieurs jours par saison = plus robuste (évite les effets "jour de la semaine").
#    ADAPTE ces dates au mois où tu lances (mets des dates futures proches).
# ---------------------------------------------------------------------------
# --- Mode "BALAYAGE DÉFINITIF" (une bonne fois pour toutes) ---------------
# Une SEMAINE PLEINE par saison : capte toute route qui vole >= 1x/semaine.
# 249 aéroports x 14 jours x 2 fenêtres ~= 6 970 appels x 2 unités ~= 14 000 unités
# -> tient dans le tier Ultra (~32$, 60 000 unités) avec large marge.
SUMMER_DATES = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
                "2026-08-07", "2026-08-08", "2026-08-09"]   # semaine pleine, pic été
WINTER_DATES = ["2027-01-18", "2027-01-19", "2027-01-20", "2027-01-21",
                "2027-01-22", "2027-01-23", "2027-01-24"]   # semaine pleine, creux hiver
# Pour un rafraîchissement MENSUEL léger (moins cher), réduis à 3 jours par saison,
# p.ex. SUMMER_DATES=["...-03","...-05","...-07"] -> ~6 000 unités (tient dans le tier ~5$).

# ---------------------------------------------------------------------------
# 4) API AeroDataBox (via RapidAPI par défaut).
#    La clé se lit dans la variable d'environnement RAPIDAPI_KEY (jamais en dur).
# ---------------------------------------------------------------------------
API_HOST = "aerodatabox.p.rapidapi.com"
API_BASE = "https://aerodatabox.p.rapidapi.com"
RATE_LIMIT_SLEEP = 1.2      # secondes entre appels (plans à 1 req/s -> garde >1s)
MAX_CALLS = 8000            # garde-fou : couvre le balayage définitif (~6970 appels) + marge.
                            # 1 appel FIDS = 2 unités (mesuré). 8000 appels = 16 000 unités.
REQUEST_TIMEOUT = 30

SOURCE_URL = "https://aerodatabox.com (airport schedules, operating carrier)"
