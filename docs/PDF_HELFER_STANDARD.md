# Kramurai: Standard für Browser-Helfer und PDF-Dokumentationen

Stand: 19. Oktober 2026. Von Felix als wiederverwendbarer Projektstandard gewünscht. Referenz sind die freigegebenen Helfer für Retoure, Router-Rückgabe, Handyverkauf, Autoverkauf und Reparatur sowie die zugehörigen Drucklayouts. Dieser Standard gilt für neue Helfer und die Überarbeitung vorhandener Helfer; er ändert keine Lizenzbedingungen.

## Erzeugung und technische Grundlage

- Nutzer füllen einen geführten Helfer im Browser aus. Aus denselben Vorgangsdaten entsteht eine lesbare Zusammenfassung; die PDF wird über den Browser-Druckdialog gespeichert. Eine zusätzliche Serververarbeitung ist dafür nicht erforderlich.
- Die vorhandenen Helferstrukturen, gemeinsamen Komponenten und `register-theme.css` wiederverwenden. Keine unabhängige zweite Formular- oder PDF-Datenlogik aufbauen. Der PDF-Export bleibt eine lesbare Dokumentation; er ist keine wieder importierbare Vorgangssicherung und standardmäßig kein ausfüllbares AcroForm.
- `window.print()` synchron aus der Nutzeraktion aufrufen. Daten, Fotos und Vorschauen vorher fertigstellen. Während Dateioperationen, Vorgangsöffnung und Neuanlage PDF-Schaltflächen sperren, damit kein falscher oder unvollständiger Stand gedruckt wird.
- Angaben lokal im Browser speichern, Dateien in IndexedDB. Mehrere getrennte Vorgänge und eine versionierte JSON-Sicherung mit Dateien unterstützen. Browserdaten können verloren gehen; PDF und Sicherung haben unterschiedliche Zwecke. Sicherungen sind unverschlüsselt und entsprechend zu kennzeichnen.
- Bestehende Speicherkennungen und Dateischlüssel erhalten. Änderungen am Datenmodell benötigen eine geprüfte Migration älterer Vorgänge und Sicherungen. Import legt einen zusätzlichen Vorgang an; vorhandene Vorgänge nicht überschreiben.

## Gestaltung und Druck

- Freigegebene Vektor-Markenassets aus `assets/brand/` verwenden; Einsatzregeln stehen in `assets/brand/README.md`. Logo und Wortmarke proportional skalieren. Keine neu nachgebauten Schriftzüge, verzerrten Logos oder für den Hintergrund ungeeigneten Varianten einsetzen.
- Dunkelpetrol im Dokumentkopf, Koralle als Akzent, weiße Druckflächen, lesbare dunkle Schrift und klare Abschnittsüberschriften. Mehrseitige Dokumentationen benötigen keine künstliche Begrenzung auf eine Seite.
- A4 mit dem gemeinsamen benannten Seitenlayout `kramurai-helper`. Aktueller Ausgangspunkt: 10 mm Rand oben und seitlich, 16 mm unten für die Fußzeile. Drucknavigation, Eingabemasken und Website-Bedienelemente ausblenden.
- Kopfbereich mit Kramurai-Marke, Dokumenttitel und sachlichem Untertitel; Erstellungs- und Änderungszeit des Vorgangs gesondert darstellen. Diese Zeitangaben nicht mit dem Vorlagenstand verwechseln.
- Zusammenfassung in klar beschrifteten Abschnitten und gut lesbaren Schlüssel-Wert-Zeilen. Lange Texte vollständig umbrechen und über Seiten fortsetzen; keine festen Höhen oder abgeschnittenen Inhalte. Zusammengehörige kurze Blöcke möglichst nicht trennen.
- Fotos mit unverzerrtem Seitenverhältnis, verständlicher Beschriftung und ggf. dokumentiertem Hinzufügezeitpunkt. Im Druck die vorhandene Anordnung in Zweiergruppen verwenden, sofern lesbar. Keine Fotos durch übergroße Abstände auf unnötige Folgeseiten verdrängen.
- Fußzeile auf jeder erzeugten Seite: links Herkunft, Rechtehinweis zur Vorlagengestaltung und Vorlagenstand; rechts `Seite X von Y`. Aktueller Wortlaut:

  `© 2026 Kramurai · Vorlagengestaltung · kramurai.github.io · Stand 19.10.2026`

  Aktuell 8 pt links, 8,5 pt für die Seitenzahl. Bei Änderungen genug Raum zwischen beiden Angaben lassen. Jahres- und Standangaben bewusst pflegen; historische Versionen nicht nachträglich umdatieren.

## Feldlogik und Aussagekraft

- Nur für den jeweiligen Zweck notwendige Angaben als Pflichtfelder behandeln. Optionale Gerätekennungen und Zusatzangaben in verständlich benannten aufklappbaren Bereichen anbieten, wenn dies den Ablauf vereinfacht.
- Nicht ausgefüllte optionale Zusatzzeilen im PDF weglassen. Fehlende Kernangaben ausdrücklich als `Nicht dokumentiert` oder mit einer gleich klaren Formulierung ausweisen.
- Unbekannt, ausdrücklich nicht vorhanden, geplant und tatsächlich erfolgt unterscheiden. Unmarkierte Kästchen nicht als bestätigtes Nichtvorhandensein auslegen. Kein Erfolg, vollständiges Zubehör, Zahlungseingang oder Rücknahme ohne passende Angaben behaupten.
- Eigene Beobachtungen, Angaben Dritter und bereits getroffene Vereinbarungen auseinanderhalten. Verdeckte oder für den aktuellen Status unzutreffende Eingaben nicht als aktuelle Tatsachen drucken.
- Offene Vorgänge warm-gelb/amber, konkrete Probleme und Widersprüche rötlich hervorheben. Immer zusätzlich verständlichen Text verwenden. Eine noch offene Rückmeldung ist noch keine Ablehnung.
- Datumswidersprüche und als abgeschlossen bezeichnete zukünftige Ereignisse sichtbar erklären. Wesentliche Warnungen müssen auch im PDF erscheinen.
- Dokumentation eigener Angaben klar benennen. Keine unabhängige Prüfung, rechtliche Beweiskraft, Zahlungsquittung, Vertragswirkung oder Erklärung zur Abnahme suggerieren, die der Helfer nicht tatsächlich leistet. Der Autoverkauf-Helfer bleibt eine Ergänzung zum Kaufvertrag; der Reparaturhelfer erteilt keinen Auftrag und keine Kostenfreigabe.

## Dateien, Rechte und Datenschutz

- Nutzerfotos und Belege nicht automatisch zu Kramurai oder einem Analysedienst übertragen. Statistikanfragen dürfen keine Formularinhalte, Dateinamen oder sonstigen Vorgangsdaten enthalten; die bestehenden Einwilligungs- und Datenschutzregeln gelten weiter.
- Einzelne Fotos und Belege gezielt entfernen können. Fehlerhafte neue Dateien dürfen eine zuvor gespeicherte Datei nicht unbemerkt zerstören.
- Hochgeladene PDF-Belege bleiben bytegleich separat herunterladbar. Nicht behaupten, sie seien vollständig in der gedruckten Dokumentation enthalten. Dies in Bedienoberfläche und Dokumentation verständlich angeben.
- Der ©-Hinweis bezieht sich auf eigene schutzfähige Vorlagengestaltung, nicht auf die vom Nutzer eingetragenen Inhalte oder beigefügten Fotos. Rechte und Lizenzhinweise Dritter erhalten. Keine pauschalen Rechte an Fremdmaterial oder automatischen Ausschließlichkeitsrechte an KI-Ausgaben behaupten.
- Standardmäßig keine Öffnungskennwörter, Kopier- oder Bearbeitungssperren auf individuell erzeugte Dokumentationen setzen. Eine technische Sperre für separat bereitgestellte Leerformulare wäre eine eigene Entscheidung. Keine neuen Verbote oder Nutzungsbedingungen stillschweigend ergänzen.
- Fremdvorlagen wie den ADAC-Kaufvertrag nur passend verlinken; nicht als Kramurai-Vorlage übernehmen oder mit eigenen Rechtehinweisen versehen. Der bestehende ausfüllbare Starterbatterie-Nachweis bleibt ein eigenständiger Download; historische Versionsdateien behalten ihren Inhalt und ihre Adresse.

## Prüfung vor Freigabe und Veröffentlichung

Die Prüfung richtet sich nach den Änderungen. Ein reiner Fußzeilenwechsel erfordert keine komplette Wiederholung aller Speicherabläufe; Änderungen an Daten, Dateien oder Ablauf benötigen die jeweils betroffenen Funktionsprüfungen.

1. Relevante Abläufe mit isolierten, erkennbar erfundenen Beispieldaten prüfen: Pflichtfelder, Vor/Zurück, Speichern/Neuladen, Vorgangswechsel, Sicherung und Wiederherstellung sowie langsame/fehlerhafte Dateien, soweit betroffen. Bestehende Prüfskripte verwenden; Hinweise stehen in `tools/README.md`.
2. Schmale und breite Ansichten kontrollieren; mindestens 320, 390 und 1280 Pixel als Ausgangspunkt. Beschriftungen, Tastaturbedienung und Fokus beim Schrittwechsel berücksichtigen.
3. PDF aus einem ausgefüllten Beispiel erzeugen, alle Seiten rendern und visuell ansehen. Vollständigkeit, Seitenumbrüche, Fotos, Warnungen, Logo, ©-Hinweis und Seitenzahlen prüfen. Auch einen langen Text und einen unvollständigen/offenen Vorgang berücksichtigen, wenn die Änderung diese Fälle berührt.
4. Extrahierten Text und logische Felddaten ergänzend prüfen. Textprüfung allein ersetzt keine visuelle Kontrolle. Bei ausfüllbaren PDFs müssen Feldwerte, Feldstruktur und sichtbare Darstellung übereinstimmen; vorhandene Signaturen nicht ohne eigenen Auftrag verändern.
5. Tests dürfen keine realen Vorgangsdaten und keine echten Statistikbesuche erzeugen. Automatisierte Chromium-PDF-Erzeugung und der Aufruf von `window.print()` ersetzen keinen Test jedes nativen Geräte-Druckdialogs; den tatsächlich geprüften Umfang benennen.
6. Bei Änderungen an Skripten oder Druck-CSS die Cache-Versionen der betroffenen Seiten aktualisieren. Nach Veröffentlichung die ausgelieferten relevanten Dateien und Abläufe kontrollieren.

Neue Helfer und wesentliche sichtbare Änderungen mit einer fertigen Vorschau zur vereinbarten Freigabe vorlegen. Eine bereits erteilte Freigabe für denselben Stand nicht erneut einholen. Dieser Standard speichert die Arbeitsweise; er ist keine pauschale Freigabe zukünftiger Veröffentlichungen.
