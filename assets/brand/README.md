# Kramurai-Markenassets

Die freigegebenen Vektorformen sind auf allen sieben Website-Seiten eingebunden. Inhalte, Seitenfarben, Navigation und Formularabläufe bleiben erhalten. Der Claim lautet „Einfach. Nützlich. Kostenlos.“.

## Verwendung

- `kramurai-raven-light-background.svg`: Rabenprofil für das helle Logofeld im Website- und Dokumentkopf.
- `kramurai-wordmark-header.svg`: kompakte Wortmarke aus v13 für dunkle Kopfbereiche.
- `kramurai-wordmark-footer.svg`: dieselbe kompakte Form für helle Fußbereiche und kleine PDF-Markenblöcke.
- `kramurai-wordmark-light-background.svg` / `kramurai-wordmark-dark-background.svg`: detaillierte Wortmarke aus v24 für größere Anwendungen und Druck.
- `kramurai-logo-claim-light-background.svg` / `kramurai-logo-claim-dark-background.svg`: vollständige Kombinationen mit Rabenprofil und Claim.
- `kramurai-logo-header.svg`: kompakte Kombination für dunkle Flächen, ohne Claim.
- `favicon.svg`: skalierbares Rabenprofil für Browser-Tabs.
- `favicon.ico`: eingebundene Browser-Alternative mit 16, 32, 48 und 64 Pixeln; identische Kopie unter `/favicon.ico` für automatische Abrufe.
- `apple-touch-icon.png`: 180-Pixel-Symbol für Smartphone-Verknüpfungen; identische Kopie unter `/apple-touch-icon.png`.

Die SVG-Dateien enthalten ausgeformte Schriftpfade und benötigen keine installierte Schrift. Die Schriftlizenz liegt in `FONT-LICENSE.txt`. Wortmarke, Rabe und Kombinationen stammen aus dem freigegebenen Kramurai-Markenpaket 1.0. Kleine Darstellungen verwenden die kompakte Füllung, größere Anwendungen die detaillierte Füllung.

## PDF-Vorlage

`/assets/entsorgungsnachweis-starterbatterie-v1.0.pdf` behält beide Seiten, alle Texte und alle zehn interaktiven Felder. Die Marke wurde ausschließlich im freien Fußbereich ergänzt. Die Formularversion bleibt 1.0, da die Formularstruktur unverändert ist.

`tools/brand_starterbatterie.py` reproduziert den Markenaustausch. Der unveränderte Ausgangsstand der Website-Vorlage ist im Git-Commit `06f5c32d86aec0d67c7f1c750ccefc5b9378efb6` enthalten. Das Skript erwartet eine Originaldatei unter `--source`, einen Zielpfad unter `--output` und die freigegebenen SVGs unter `--raven` und `--wordmark`. Der zusätzliche Schalter `--replace-header-images` ersetzt ausschließlich die zwei älteren Raster-Markenbilder in der separat vorhandenen Version 1.4.

Zusätzliche Vorschläge zu Texten, Farben, Seitenaufteilung oder Navigation werden vor einer Umsetzung separat vorgestellt und vom Nutzer entschieden.
