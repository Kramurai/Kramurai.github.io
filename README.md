# Kramurai

**Einfach. Nützlich. Kostenlos.**

[Website öffnen](https://kramurai.github.io/)

Kostenlose Formulare und praktische Helfer für Alltagssituationen, direkt im Browser und ohne Anmeldung. Die Website besteht aus HTML, CSS und JavaScript und wird über GitHub Pages veröffentlicht.

## Standard für neue Helfer und PDF-Ausgaben

Der [PDF-Helfer-Standard](docs/PDF_HELFER_STANDARD.md) hält die freigegebene Arbeitsweise für Gestaltung, Feldlogik, lokale Speicherung, PDF-Erzeugung, Rechtehinweis und Qualitätsprüfung fest. Neue und überarbeitete Helfer orientieren sich daran. Die Projektregeln in [AGENTS.md](AGENTS.md) verweisen für künftige Entwicklungsarbeit darauf.

## Anwendungen

| Anwendung | Dateien |
| --- | --- |
| Retoure dokumentieren | [retoure-dokumentieren](retoure-dokumentieren/index.html) |
| Router / Mietgerät zurückgeben | [router-zurueckgeben](router-zurueckgeben/index.html) |
| Handy / Elektronik an Ankaufportal schicken | [handy-trade-in-dokumentieren](handy-trade-in-dokumentieren/index.html) |
| Autoverkauf dokumentieren | [autoverkauf-dokumentieren](autoverkauf-dokumentieren/index.html) |
| Reparatur dokumentieren | [reparatur-dokumentieren](reparatur-dokumentieren/index.html) |
| Entsorgungsnachweis für Starterbatterien | [entsorgungsnachweis-starterbatterie](entsorgungsnachweis-starterbatterie/index.html) |

## Starterbatterie: Helfer und PDF 1.5 (Entwurf, 19. Oktober 2026)

Die bestehende Batterie-Seite erhält einen Helfer mit drei Schritten: Batterie und eigene Angaben, Rückgabe und Nachweis, Prüfen und PDF. Vorbereitung, tatsächliche Abgabe, Rücknahme ohne Pfanderstattung und ein bereits vorhandener Originalnachweis werden getrennt. Angaben bleiben lokal; ein optionales Foto und ein Bild-/PDF-Nachweis können mit der gemeinsamen Sicherungsroutine gespeichert werden. Ein PDF-Beleg bleibt ein separater Download.

`assets/entsorgungsnachweis-starterbatterie-v1.5.pdf` enthält zwei Seiten und dieselben zehn ausfüllbaren Feldnamen wie Version 1.4. Inhaltliche Änderungen: tatsächliche Rücknahme ohne Pfanderstattung statt vorweggenommener abgeschlossener Verwertung; aktuelle Hinweise nach §§ 6, 18 und 19 BattDG; schriftlicher oder elektronischer Nachweis und Altersgrenze von zwei Wochen bei Vorlage beim Fernabsatzhändler. Die Vorlage allein ist noch kein bestätigter Nachweis. Die Weitergabeerlaubnis bleibt erhalten. Ältere Versionsdateien werden nicht überschrieben.

`python3 tools/build_battery_template.py` erzeugt die neue Vorlage reproduzierbar. `node tools/check_battery.cjs` prüft den neuen Helfer isoliert. Neue und geänderte sichtbare Inhalte bleiben bis zur Freigabe im Entwurf. Ergänzend liegt ein noch nicht geltender Vorschlag für [Nutzungshinweise](docs/NUTZUNGSHINWEISE_ENTWURF.md) vor.

## Lokal ansehen

Im Repository einen lokalen Webserver starten:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Anschließend `http://127.0.0.1:8000/` öffnen. Es ist kein Build-Schritt erforderlich. Für die Helfer einen Webserver verwenden, damit die absoluten Dateipfade und die Browser-Speicherung wie auf der Website funktionieren.

## Vorgänge, Fotos und Sicherungen

Die interaktiven Helfer speichern Angaben im Local Storage und Fotos sowie Belege in IndexedDB. Die Vorgänge gehören zum jeweiligen Browser auf dem jeweiligen Gerät. Sie werden nicht automatisch an Kramurai übertragen. Browserdaten löschen kann auch diese Vorgänge und Dateien löschen.

„Vorgang sichern“ erstellt eine JSON-Datei mit Angaben und gespeicherten Dateien. „Sicherung öffnen“ legt daraus einen zusätzlichen Vorgang an; vorhandene Vorgänge bleiben erhalten. Die Sicherungsdatei ist unverschlüsselt. Sie sollte entsprechend ihrem Inhalt aufbewahrt werden.

„PDF speichern“ öffnet den Druckdialog für die lesbare Dokumentation. Eine hochgeladene PDF als Beleg muss separat gespeichert und beigefügt werden, wie im Helfer beschrieben. Für die spätere Weiterbearbeitung auf einem anderen Gerät die Vorgangssicherung verwenden. Fertige PDFs und Sicherungen außerhalb des Browsers aufbewahren.

## Logo und Schriftzug

Die eingebundenen Markenassets, ihre Einsatzregeln und die freigegebene Palette stehen in [assets/brand/README.md](assets/brand/README.md). Die SVGs enthalten ausgeformte Buchstaben; die zugehörigen Vektor-PDFs benötigen keine installierte Schrift. Das separate Markenpaket enthält weitere Einsatzvarianten und transparente PNGs.

## Geprüfter Basisstand

Stand der Anwendung: [f8f8009](https://github.com/Kramurai/Kramurai.github.io/commit/f8f80090b7f628b45978199b3cca3a469fcef245), dokumentiert am 11. Oktober 2026.

- 66 Funktionsprüfungen für die drei Helfer: Angaben, Fotos, Neuladen, Vorgangswechsel, Sicherung, Wiederherstellung, gezieltes Löschen und langsame beziehungsweise fehlerhafte Fotoverarbeitung.
- 13 ergänzende Prüfszenarien für Beschriftungen, Seitenangaben und Tastaturbedienung; darin 32 Schrittwechsel bei 320 und 1280 Pixeln Ansichtsbreite.
- 40 verständliche Beschriftungen für die Foto-Schaltflächen. Der Fokus beginnt nach einem Schrittwechsel am neuen Abschnitt.
- Die öffentlich ausgelieferten Dateien wurden mit dem getesteten Stand verglichen.

Diese Angaben beschreiben die durchgeführten digitalen Prüfungen. Die Skripte prüfen den Aufruf des Druckdialogs, nicht einen Betriebssystem-Druckdialog oder alle Anforderungen an Barrierefreiheit.

## Autoverkauf-Erweiterung (11. Oktober 2026)

Der vierte Helfer dokumentiert Fahrzeug und Beteiligte, bekannte Mängel und Reparaturen, Zubehör, Unterlagen, Fotos, Zahlung und Übergabe. Er ist eine ergänzende Dokumentation, kein Kaufvertrag und keine unabhängig bestätigte Zahlungsquittung. Die externe ADAC-Seite wird verlinkt; die ADAC-Vorlage wird nicht übernommen oder eingebettet.

Die gemeinsamen Ablauftests erfassen nun vier Helfer mit insgesamt 88 Einzelprüfungen. Die ergänzende Beschriftungs- und Tastaturprüfung umfasst 16 Szenarien, 54 Foto-Beschriftungen und 42 Vorwärtsschritte. `check_car_sale.cjs` prüft außerdem die Verkaufsangaben, widersprüchliche Zahlungs- und Übergabestände, das Entfernen einzelner Dateien und separate PDF-Belege. Die synthetischen Muster-PDFs wurden auf Seitenumbrüche und Lesbarkeit geprüft.

Die ADAC-orientierte Überarbeitung zeigt den Vertragslink vor dem ersten Schritt, trennt Fahrbereitschaft und Mängel und bündelt Zusatzangaben in aufklappbaren Bereichen. Bis zu 20 zusätzliche Fotos mit Beschreibungen sind möglich. Wesentliche Widersprüche bleiben auch im PDF sichtbar; leere Zusatzfelder entfallen. Ältere lokale Vorgänge und Sicherungen werden mit unveränderten ursprünglichen Angaben und Dateischlüsseln übernommen. Die gemeinsame Sicherungsroutine bietet dafür eine optionale Migration vor ihrer strikten Prüfung; die übrigen Helfer verwenden weiterhin ihre bisherigen Schemas.

## Prüfungen wiederholen

Voraussetzung: Node.js, Playwright und Chromium. Einzelheiten und die Optionen für separat installierte Laufzeiten stehen in [tools/README.md](tools/README.md).

```bash
node tools/check_helper_workflows.cjs
node tools/check_page_accessibility.cjs
node tools/check_car_sale.cjs
```

Die Prüfungen verwenden isolierte Browserdaten und schreiben ihre Ergebnisse in einen neuen temporären Ordner.

## Wiederherstellungspunkt

Der Prüfstand mit dieser Anleitung ist unter `checkpoint/2026-10-11-geprueft` festgehalten. Zum lokalen Öffnen:

```bash
git fetch origin
git switch --detach origin/checkpoint/2026-10-11-geprueft
```

Damit wird der festgehaltene Stand lokal geöffnet. Für eine erneute Veröffentlichung die gewünschten Dateien kontrolliert in `main` übernehmen. Eine Git-Sicherung enthält den Website-Code und die Markenassets; die lokal gespeicherten Vorgänge der Nutzer liegen in ihren Browsern.

## Reparatur dokumentieren (Entwurf, 19. Oktober 2026)

Der zusätzliche Helfer erfasst Fehlerbild und Gerät, die vorbereitete oder erfolgte Abgabe und die spätere Rücknahme. Er dokumentiert eigene Angaben und Beobachtungen; er erteilt keinen Reparaturauftrag, keine Kostenfreigabe und keine Erklärung zur Abnahme. Vier Fotoplätze und ein Bild-/PDF-Beleg, mehrere lokale Vorgänge sowie die vorhandene versionierte Sicherung stehen bereit. Ein PDF-Beleg bleibt ein separater Download.

`node tools/check_repair.cjs` prüft den Ablauf isoliert, einschließlich offener Rücknahme, Datumshinweisen im PDF, Sicherungsrundlauf mit vier Fotos, Neuladen, gezieltem Entfernen, fehlerhaften Bildern, separatem PDF-Beleg und Vorgangswechsel. Die Beispiele enthalten erfundene Angaben und schematische Abbildungen.

Die Überarbeitung vom 19. Oktober unterscheidet nicht erfasstes Zubehör, ausdrücklich kein Zubehör und eine vorhandene Liste. Ein Zubehörvergleich ohne Abgabeliste bestätigt keine Vollständigkeit. Optionale Kennungen und Absprachen sind eingeklappt; ein eigener Prüfumfang lässt sich nach der Rücknahme ergänzen. Offene Abläufe erscheinen warm-gelb, konkrete Probleme und Widersprüche rötlich. Die 28 Prüfszenarien umfassen auch die Migration früherer Entwurfsvorgänge und -sicherungen.

## Qualitätsüberarbeitung der vorhandenen Helfer (Entwurf, 19. Oktober 2026)

Gerätekennungen der drei Versandhelfer sind optional aufklappbar; Felder, Speicherkennungen und Sicherungsformate bleiben erhalten. Nicht erfasste Angaben werden ausdrücklich als nicht dokumentiert bezeichnet. Beim Router sind Vertragspartner und Rücksendeempfänger getrennt beschriftet, Hinweise auf ein Ankaufportal sind korrigiert, offene oder abgelehnte Anbieter-Rückmeldungen werden mit Text und Farbe erkennbar. Im Handy-Helfer wird eine noch nicht dokumentierte Rückmeldung ausdrücklich als offen bezeichnet. Die bereits vorhandenen wichtigen Widerspruchshinweise beim Autoverkauf erhalten eine rötliche Hervorhebung. Die Druckseiten tragen Herkunft, Website und Vorlagenstand, ohne pauschalen Copyright- oder Lizenzvermerk.

Beim Öffnen oder Anlegen eines Vorgangs bleiben die PDF-Schaltflächen gesperrt, bis dessen Daten und Vorschauen bereitstehen. `node tools/check_case_loading.cjs` prüft dies mit absichtlich verzögerten Dateizugriffen in allen vier Helfern.
