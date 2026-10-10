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

Die Website bietet `/assets/entsorgungsnachweis-starterbatterie-v1.4.pdf` zum Download an. Die freigegebene Version 1.4 enthält die bereits vorhandene Gestaltung mit Vektorlogo und Vektorwortmarke im Kopfbereich, zwei Seiten und zehn unveränderte interaktive Formularfelder.

Die ältere `/assets/entsorgungsnachweis-starterbatterie-v1.0.pdf` bleibt unter ihrer bisherigen Adresse erreichbar, damit bestehende Links gültig bleiben.

`tools/brand_starterbatterie.py` reproduziert den Markenaustausch. Der unveränderte Ausgangsstand der Website-Vorlage ist im Git-Commit `06f5c32d86aec0d67c7f1c750ccefc5b9378efb6` enthalten. Das Skript erwartet eine Originaldatei unter `--source`, einen Zielpfad unter `--output` und die freigegebenen SVGs unter `--raven` und `--wordmark`. Der zusätzliche Schalter `--replace-header-images` ersetzt ausschließlich die zwei älteren Raster-Markenbilder in der separat vorhandenen Version 1.4.

Zusätzliche Vorschläge zu Texten, Farben, Seitenaufteilung oder Navigation werden vor einer Umsetzung separat vorgestellt und vom Nutzer entschieden.

## Farbstand 10. Oktober 2026

Freigegebene Farbversion B: Dunkelpetrol #18554D, mittlere Facetten #23695F und #2F8073, Relieflicht #78BEAB, Reliefschatten #0C3933. Auf dunklem Hintergrund: #A4C9BC, #BDD9CC, #D6E8DF und Reliefschatten #659687. Koralle #EA6B55, Korallenschatten #C74F40 und Creme #F4F1E8 bleiben erhalten. Formen, Pfade, Facettenanordnung und Seitenfarben sind unverändert. `tools/refresh_brand_colors.py` enthält die Farbzuordnung.

## Lesbarer Claim im Website-Header

„Einfach. Nützlich. Kostenlos.“ wird als separate Textzeile unter der Wortmarke gesetzt: 12 px auf größeren Displays, 10,5 px bis 520 px Bildschirmbreite und 3 px Abstand. Auf schmalen Helferseiten wechselt der Startseitenlink bei Platzmangel in eine weitere Zeile; sein Wortlaut bleibt vollständig sichtbar. Die Wortmarke und die Markenfarben sind unverändert.
