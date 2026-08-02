#!/usr/bin/env python3
"""Régénère les trois PDF du dossier de presse à partir des HTML.

Le HTML est la source, le PDF n'en est qu'un tirage : toute correction se fait dans le
`.html`, jamais dans le `.pdf`. Ce script existe pour que les deux ne divergent plus — ils
l'ont fait pendant plusieurs jours, le HTML ayant reçu des corrections que le PDF distribué
à la presse ne portait pas.

Deux étapes :
  · Chromium imprime en A4 paysage, fonds compris. Le composant <doc-page> pose déjà les
    règles @page, il n'y a rien à recalculer. On attend explicitement `document.fonts.ready` :
    sinon Chromium imprime parfois avec les polices de repli et le Playfair devient du Times,
    sans que rien ne le signale.
  · Ghostscript recomprime les images à 220 dpi. Le tirage brut fait ~18 Mo, intransmissible
    par courriel ; à 220 dpi il tombe sous 3 Mo, sans perte visible à l'écran ni à
    l'impression de bureau.

  python3 packages/knowledge/scripts/presskit-pdf.py [en] [fr] [es] [pt]
"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

DIR = "packages/ui/public/presskit"
PORT = 8931
TODO = [a for a in sys.argv[1:] if a in ("en", "fr", "es", "pt")] or ["en", "fr", "es", "pt"]
mb = lambda p: f"{os.path.getsize(p)/1048576:.2f}"

srv = subprocess.Popen(["python3", "-m", "http.server", str(PORT)], cwd=DIR,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for L in TODO:
            pg = b.new_page()
            pg.goto(f"http://localhost:{PORT}/press-kit-{L}.html", wait_until="networkidle")
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(1500)
            n = pg.locator("section.page").count()
            raw = f"/tmp/press-kit-{L}.raw.pdf"
            pg.pdf(path=raw, format="A4", landscape=True, print_background=True, prefer_css_page_size=True)
            pg.close()
            out = f"{DIR}/press-kit-{L}.pdf"
            subprocess.run(["gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5",
                            "-dPDFSETTINGS=/printer", "-dColorImageResolution=220",
                            "-dGrayImageResolution=220", "-dMonoImageResolution=600",
                            "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true",
                            "-dNOPAUSE", "-dQUIET", "-dBATCH",
                            f"-sOutputFile={out}", raw], check=True)
            print(f"{L} : {n} pages · {mb(raw)} Mo brut → {mb(out)} Mo")
        b.close()
finally:
    srv.terminate()
