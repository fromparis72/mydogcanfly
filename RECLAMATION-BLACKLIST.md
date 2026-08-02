# Déblocage mydogcanfly.com — Fortinet, Avast & Norton

Faux positif constaté le 28 juillet 2026. Détection **URL:Blacklist** (Avast) et
**Dangerous Web Page** (Norton Safe Web). Google Safe Browsing ne bloque pas.

## Résultat VirusTotal — 28 juillet 2026, 20:10 UTC

**1 détection sur 92.** Le seul moteur qui signale le site est **Fortinet**, qui le
classe en *Phishing*. Les 91 autres, dont BitDefender, Acronis, AlienVault, Abusix,
Certego et CRDF, le donnent *Clean*.

**Conséquence sur la stratégie : commencer par Fortinet.** Ni Avast ni Norton
n'apparaissent en rouge sur VirusTotal alors qu'ils bloquent en local — le motif
habituel quand un éditeur reprend un flux de réputation tiers. Faire corriger le
classement Fortinet est donc la seule action susceptible de débloquer les trois
d'un coup. Les réclamations Avast et Norton restent utiles en parallèle, mais
c'est la source qu'il faut traiter, pas seulement les symptômes.

Garder une capture du rapport VirusTotal : le ratio 1/92 est l'argument le plus
fort à joindre aux trois dossiers.

---

## ✅ Fortinet — RÉSOLU le 28 juillet 2026

Soumis à 13h17, corrigé à 20h01 (moins de 7 h). Reclassé **« Phishing » → « Society and
Lifestyles »**, catégorie neutre et non bloquante.

Fortinet précise que la mise à jour peut mettre du temps à se propager à cause du cache de
filtrage web. Conserver ce courriel : c'est la pièce maîtresse des relances ci-dessous.

**Prochaine étape** : relancer une analyse sur VirusTotal (bouton *Reanalyze*) pour vérifier
que Fortinet est repassé au vert et voir si Avast/Norton ont suivi. Si les blocages Avast et
Norton persistent au-delà de 48 à 72 h, les relancer avec l'argument de la source corrigée
(texte prêt en section 2 bis).

---

## 0. Fortinet — dossier initial (archivé)

Formulaire : <https://www.fortiguard.com/faq/wfratingsubmit>
(ou <https://www.fortiguard.com/webfilter> → saisir l'URL → *Request Reclassification*)

Délai annoncé : traitement sous 24 heures.

- **URL** : `https://mydogcanfly.com/`
- **Catégorie actuelle** : Phishing — cocher **Wrong Category**
- **Catégorie suggérée** : *Information Technology* ou *Travel*

**Message à coller :**

```
mydogcanfly.com is currently rated as "Phishing". This is incorrect.

The site is a static editorial information site about air travel with dogs. It
publishes airline pet policies and country entry requirements for pets, each
with its official government or airline source, a verification date and a
confidence level. Publisher: B2BVENUES. Legal and contact details are public at
https://mydogcanfly.com/legal-notice/

It cannot be phishing:
- 1,977 static HTML pages, no server-side application, no CMS, no database.
- No login form, no password field, no POST form, no user accounts.
- No payment, no checkout, no financial data collected.
- It does not imitate any brand, bank or service. It is not a lookalike domain.
- 0 third-party scripts. The only network origin called by its JavaScript is its
  own domain.
- No downloadable executables. The only iframes are youtube-nocookie.com,
  loaded on user click.
- Hosted on Cloudflare Pages, HTTPS only.

VirusTotal, 28 July 2026: 1 detection out of 92 engines — Fortinet is the only
one flagging it. Google Safe Browsing does not flag it either.

The site does link out to roughly 520 official government domains (veterinary
and customs authorities for 140 countries), some of which still publish over
plain HTTP. These citations are deliberate and are the basis of the site's
editorial credibility. We suspect this outbound-link pattern is what triggered
the automated classification.

Please re-evaluate. Suggested category: Information Technology (or Travel).

Philippe — B2BVENUES — fromparis@gmail.com
```

---

## 1. Avast

Formulaire : <https://www.avast.com/false-positive-file-form.php>
→ choisir **URL / Website**, pas *File*.

**Champ URL** : `https://mydogcanfly.com/`
**Détection signalée** : `URL:Blacklist`

**Message à coller :**

```
Hello,

mydogcanfly.com is being blocked by Avast Web Shield with the detection
"URL:Blacklist". This is a false positive and it is blocking legitimate traffic
to our site.

WHAT THE SITE IS
MyDogCanFly is an editorial information site about air travel with dogs. It
publishes airline pet policies and country entry requirements for pets, each
with its official government or airline source, a verification date and a
confidence level. It is published by B2BVENUES. Contact and legal details are
public at https://mydogcanfly.com/legal-notice/

TECHNICAL FACTS (verified on the deployed build, 28 July 2026)
- 1,977 static HTML pages, no server-side application, no CMS, no database.
- 0 third-party scripts. The only network origin called by our JavaScript is
  our own domain (https://mydogcanfly.com).
- 0 login forms, 0 password fields, 0 POST forms, no user accounts, no payment.
- 0 downloadable executables (.exe/.dmg/.apk/.msi).
- The only iframes are YouTube in privacy mode (youtube-nocookie.com), loaded
  on user click.
- Hosted on Cloudflare Pages, HTTPS only.

WHY THIS MAY HAVE TRIGGERED A HEURISTIC
The site cites official sources for 140 countries, so it links out to about 520
government domains worldwide, including administrations that still publish over
plain HTTP (for example customs and veterinary authorities in Cuba, Venezuela,
Thailand, Ethiopia and Nicaragua). These outbound citations are intentional and
are the basis of our editorial credibility, but we understand the pattern may
look unusual to an automated reputation system.

The site was also fully rebuilt recently, growing from a few dozen pages to
nearly 2,000 within a few weeks, which may resemble mass-generated content to a
heuristic. The content is human-reviewed and sourced.

REFERENCE
VirusTotal, 28 July 2026: 1 detection out of 92 engines. The only engine
flagging the site is Fortinet (as "Phishing"), which we have asked to
re-evaluate. Google Safe Browsing does not flag this domain either.

Please review and remove the detection. I am happy to provide any further
information.

Thank you,
Philippe — B2BVENUES
fromparis@gmail.com
```

---

## 2. Norton Safe Web

1. Aller sur <https://safeweb.norton.com/>
2. Rechercher `mydogcanfly.com`
3. Cliquer **Dispute this rating** (créer un compte Norton gratuit si demandé)

**Message à coller :**

```
mydogcanfly.com is rated as a dangerous page. This is a false positive.

The site is a static editorial information site about flying with a dog. It has
no login, no payment, no user-generated content, no downloads and no
third-party scripts. It is 1,977 static HTML pages hosted on Cloudflare Pages,
served over HTTPS only. The single network origin used by its JavaScript is its
own domain.

It cites official government sources for 140 countries, so it links out to
around 520 institutional domains, some of which still use plain HTTP. Those
outbound citations are deliberate and are what the site's credibility rests on.

VirusTotal, 28 July 2026: 1 detection out of 92 engines (Fortinet only, as
"Phishing" — re-evaluation requested). Google Safe Browsing does not flag this
domain. Publisher and contact details are public at
https://mydogcanfly.com/legal-notice/

Please re-review the rating.
```

---

## 2 bis. Relance Avast / Norton — après correction Fortinet

À n'envoyer que si le blocage persiste 48 à 72 h après le 28 juillet. Joindre le courriel
de Fortinet et le rapport VirusTotal réanalysé.

```
Follow-up on my earlier report about mydogcanfly.com being blocked.

The root cause has been corrected at the source. Fortinet — the only engine out of 92 on
VirusTotal that flagged this domain — reviewed the site and reclassified it on 28 July 2026:

  From: Phishing
  To:   Society and Lifestyles

Their confirmation email is attached. VirusTotal now shows no engine flagging the domain.

Your product still blocks the site locally with "URL:Blacklist" / "Dangerous Web Page".
Since the originating classification has been withdrawn, I would be grateful if you could
refresh your reputation data for this domain.

For reference, the site is a static editorial information site about air travel with dogs:
no login, no password field, no payment, no downloads, no third-party scripts, and it does
not imitate any brand. Publisher details: https://mydogcanfly.com/legal-notice/

Thank you,
Philippe — B2BVENUES — fromparis@gmail.com
```

---

## 3. À faire en parallèle

- **Google Search Console** → *Sécurité et actions manuelles*. Si c'est vierge,
  c'est le meilleur argument auprès des deux éditeurs : garder une capture.
- **Vérifier d'autres moteurs** pour savoir si le problème est plus large :
  - <https://www.virustotal.com/gui/home/url> (agrège ~90 moteurs)
  - <https://sitecheck.sucuri.net/>
- **Conserver le numéro de dossier** de chaque soumission.
- **Relancer au bout de 5 à 7 jours** sans réponse : les retours communautaires
  font état de délais chez Avast, parfois avec plusieurs soumissions.

## 4. Si le problème persiste

Piste à envisager seulement si les réclamations n'aboutissent pas : ajouter
`rel="nofollow"` est déjà en place sur les liens sortants, mais on pourrait
passer les rares liens gouvernementaux en HTTP par une page de redirection
interne, pour ne plus exposer d'URL non chiffrées dans le HTML. À ne faire
qu'en dernier recours : cela dégrade la transparence des sources.
