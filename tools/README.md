# Technische Prüfung der Helfer

## Linkvorschauen erzeugen

`python3 tools/build_link_previews.py` erzeugt die sechs JPEG-Linkvorschauen unter `assets/social/` aus den vorhandenen Marken-, Formular- und Beispielbildern. Benötigt Inkscape und Pillow. Die Bilder haben 1200 × 630 Pixel; jede Seite verweist mit Open-Graph- und Twitter-Card-Angaben auf ihr Motiv. Nach visueller Prüfung und vor einer Änderung der Dateinamen die Bildadressen in den sechs zugehörigen HTML-Seiten mit anpassen.

## Besuchsstatistik prüfen

`node tools/check_statistics.cjs` prüft in isolierten Browserprofilen die freiwillige Statistik: vor Zustimmung und nach Ablehnung keine Anfragen, genau ein Aufruf nach Zustimmung, Wiederaufruf und Widerruf, Datenschutzsignale, gesperrter Speicher, abgelaufene Auswahl, verdächtige URL-Werte sowie den Widerruf während eines langsamen Ladevorgangs. Die acht Seiten werden bei 320 Pixeln geprüft; die vier Helfer müssen auch ohne Statistik bis zur Zusammenfassung funktionieren. Der Test fängt alle Netzwerkanfragen ab und sendet keine echten Besuche an Metricool. Screenshots und Ergebnisse liegen im ausgegebenen temporären Ordner.

## Helferabläufe prüfen

`check_helper_workflows.cjs` prüft Retoure, Router-Rückgabe, Handyverkauf und Autoverkauf in einem isolierten Chromium-Browser: Pflichtfeld, Tastaturbedienung, lokale Speicherung, Fotos, Zusammenfassung, beide Druckknöpfe, Vorgangswechsel, gezieltes Löschen sowie Sicherung und Wiederherstellung. Zusätzlich prüft es langsame und fehlerhafte Fotoverarbeitung. Es verändert keine vorhandenen Browserdaten und sendet keine Daten an die öffentliche Website.

Voraussetzung: Node.js, Playwright und Chromium. Vom Repository aus starten:

```bash
node tools/check_helper_workflows.cjs
```

Bei separat installierten Laufzeiten können `PLAYWRIGHT_MODULE` (Pfad zum Playwright-Modul) und `CHROMIUM_EXECUTABLE` (Pfad zur Chromium-Datei) gesetzt werden. Testdateien, Screenshots und das JSON-Ergebnis landen in einem neuen temporären Ordner; dessen Pfad wird am Ende ausgegeben. Ein fehlgeschlagener Test liefert einen Exitcode ungleich null. Die Druckknöpfe werden auf den synchronen Aufruf von `window.print()` geprüft; der Betriebssystem-Druckdialog wird nicht geöffnet.

## Beschriftungen, Tastatur und Seitenangaben

```bash
node tools/check_page_accessibility.cjs
```

Diese ergänzende Prüfung kontrolliert die Namen von Formularfeldern und Foto-Schaltflächen, Bildbeschreibungen, kanonische Seitenadressen und die Übernahme vorhandener Titel und Beschreibungen in Linkvorschauen. Die vier Helfer werden bei 320 und 1280 Pixeln per Tastatur durchlaufen: Fokus am neuen Schritt, Tab-Reihenfolge, Zurück und Öffnen des nativen Dateidialogs. Sie ist eine gezielte Prüfung dieser Abläufe, keine vollständige Prüfung aller Anforderungen an Barrierefreiheit.

## Autoverkauf und PDF-Darstellung

```bash
node tools/check_car_sale.cjs
```

Prüft zusätzlich unbekannte Angaben, Hinweise auf widersprüchliche Zahlungs- und Übergabestände, den separaten ADAC-Vertragslink, das Entfernen einzelner Fotos, Text-Escaping und den bytegleichen Download eines PDF-Belegs. Prüft außerdem getrennte Zustandsangaben, frühe Vertragshinweise, zusätzliche Fotos mit Beschreibungen samt Sicherungs-Rundlauf, Migration älterer Sicherungen und lokal gespeicherter Vorgänge sowie gedruckte Prüfhinweise. Erstellt vier synthetische Dokumentations-PDFs (mit sieben Fotos, mit langem Mängeltext, als kompakte Vorbereitung und mit offenen Prüfhinweisen) sowie Screenshots bei sechs Ansichtsbreiten. Die PDFs lassen sich für die visuelle Prüfung rendern. Alle Daten sind isolierte Testdaten.
