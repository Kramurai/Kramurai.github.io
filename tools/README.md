# Technische Prüfung der Helfer

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
