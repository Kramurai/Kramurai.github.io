# Technische Prüfung der Helfer

`check_helper_workflows.cjs` prüft Retoure, Router-Rückgabe und Handyverkauf in einem isolierten Chromium-Browser: Pflichtfeld, Tastaturbedienung, lokale Speicherung, Fotos, Zusammenfassung, beide Druckknöpfe, Vorgangswechsel, gezieltes Löschen sowie Sicherung und Wiederherstellung. Zusätzlich prüft es langsame und fehlerhafte Fotoverarbeitung. Es verändert keine vorhandenen Browserdaten und sendet keine Daten an die öffentliche Website.

Voraussetzung: Node.js, Playwright und Chromium. Vom Repository aus starten:

```bash
node tools/check_helper_workflows.cjs
```

Bei separat installierten Laufzeiten können `PLAYWRIGHT_MODULE` (Pfad zum Playwright-Modul) und `CHROMIUM_EXECUTABLE` (Pfad zur Chromium-Datei) gesetzt werden. Testdateien, Screenshots und das JSON-Ergebnis landen in einem neuen temporären Ordner; dessen Pfad wird am Ende ausgegeben. Ein fehlgeschlagener Test liefert einen Exitcode ungleich null. Die Druckknöpfe werden auf den synchronen Aufruf von `window.print()` geprüft; der Betriebssystem-Druckdialog wird nicht geöffnet.
