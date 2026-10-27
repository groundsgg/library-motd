---
title: "Minecraft Serverlisten Editor und NPM Bibliothek"
description: "Eigenständige Bibliothek für Minecraft Serverlisten mit realistischer Vorschau, Inline Editing und austauschbaren Integrationen."
---

Die Bibliothek ermöglicht dir, einen Minecraft-Servereintrag direkt in einer realistischen Serverlisten-Vorschau zu bearbeiten. Du kannst sie in einer unabhängigen Website einsetzen, ausschließlich ihre Textverarbeitung unter Node.js verwenden oder sie über eine optionale React-Anbindung integrieren. Das Grounds-Portal ist ein Anwender der Bibliothek und bestimmt weder ihren Funktionsumfang noch ihr Datenmodell.

Der abgestimmte Umfang umfasst MOTD, Protokollhinweis, Servericon, Spieleranzeige und Spieler-Hovertext. Diese Spezifikation konkretisiert die Architektur und Abnahmekriterien für die erste Umsetzung.

## Ziele und Abgrenzung

- Die NPM-Bibliothek funktioniert ohne Grounds-Dienste, Anmeldung und verpflichtende Netzwerkzugriffe.
- Vorschau, visuelle Bearbeitung und Quelltextmodus verwenden dasselbe Dokumentmodell.
- Darstellung und Export verwenden dieselben Schriftmetriken und Layoutregeln.
- Funktionen, Werkzeugleisten, Beschriftungen und Gestaltung sind konfigurierbar.
- Der Viewer bildet das Verhalten des gewählten Vanilla-Java-Clientprofils nach. Nicht native MOTD-Animationen werden auch nicht als optionale Vorschau-Simulation ergänzt.
- Fremde Formatinformationen bleiben beim Import erhalten, auch wenn der visuelle Editor sie nicht bearbeiten kann.
- Die erste Oberfläche konzentriert sich auf die Java-Edition. Der Textkern bleibt auch für spätere Chat-, Tablist- und Kicknachrichten verwendbar. Bedrock-Darstellung ist eine spätere Erweiterung mit eigenen Profilen.

Die Bibliothek bearbeitet und rendert Statusdaten. Eine einbettende Anwendung entscheidet, wie sie Änderungen speichert und an einen Minecraft-Server ausliefert. Sie liefert auch Live-Spielerzahlen, Serverimporte und weitere dynamische Werte.

## Architekturentscheidung

Ein frameworkunabhängiger Kern mit einem DOM-Editor und einer optionalen React-Anbindung erfüllt die unabhängige Nutzung und die Portal-Integration. Eine ausschließlich in React implementierte Lösung würde andere Anwender an React binden. Eine ausschließlich auf Canvas basierende Oberfläche würde Eingabe, Textauswahl und Barrierefreiheit erheblich aufwendiger machen.

Als Paketname dient in diesem Entwurf `@groundsgg/motd`. Die Implementierung liefert ein einzelnes Paket mit getrennten Einstiegspunkten; der Name beschreibt keine Abhängigkeit von Grounds.

| Einstiegspunkt          | Verantwortung                                                              | Laufzeit                              |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| `@groundsgg/motd`       | Dokumentmodell, Parser, Serializer, Platzhalter, Layout und Diagnosen      | Browser und Node.js, ohne DOM         |
| `@groundsgg/motd/dom`   | Serverlisten-Vorschau, Inline-Editor, Werkzeugleisten und Icon-Bearbeitung | Browser, ohne React                   |
| `@groundsgg/motd/react` | Deklarative Anbindung derselben DOM-Oberfläche und Ereignisse              | React als optionale Peer-Abhängigkeit |

Der Hauptimport und der React-Einstiegspunkt dürfen beim Import auf dem Server keine Browserobjekte ansprechen. Die interaktive Oberfläche initialisiert sich nach dem Mount. TypeScript-Typen und explizite Paketexports gehören zum Paket; nicht verwendete Oberflächen werden nicht durch den Hauptimport geladen.

## Dokumentmodell und Zuständigkeiten

Das versionierte Dokument trennt Serverstatus, Editorinformationen und Vorschaukontext.

| Bereich             | Inhalt                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| MOTD                | Strukturierter Text, Zeilen, Ausrichtung, Formatierung und Quelltextzuordnung                                             |
| Version             | Automatischer Status, bedingter eigener Hinweis oder dauerhaft eigener Hinweis mit erzwungener Inkompatibilitätsanzeige   |
| Icon                | Normalisiertes PNG und Informationen für die Bearbeitung                                                                  |
| Spieleranzeige      | Übernommene, feste oder berechnete Onlinezahl und Kapazität sowie verborgene Anzeige                                      |
| Spieler-Hover       | Übernommene Spielerauswahl, eigener Text oder deaktivierter eigener Inhalt                                                |
| Editorinformationen | Schema-Version, Auswahl, Undo-Verlauf und Importinformationen; temporäre Zustände werden nicht als Serverdaten exportiert |
| Vorschaukontext     | Clientversion, Profil, Fensterbreite, GUI-Skalierung, Ping, Beispielspieler und Platzhalterwerte                          |

Servername und Ping sind ausdrücklich Vorschauwerte. Der im Client gespeicherte Servername wird nicht als serverseitig änderbares Ping-Feld behandelt. Eine simulierte Ping-Latenz wird nicht als wirksame Serverkonfiguration exportiert.

Vorschauwerte werden nicht versehentlich in die gespeicherte MOTD eingebrannt. Erweiterungsdaten erhalten einen eigenen Namensraum. Die Eingabegrenzen des Portals, zum Beispiel dessen derzeitiges Zeichenlimit, gehören in den Grounds-Adapter und werden nicht zu unveränderlichen Bibliotheksgrenzen.

## MOTD und Inline Editing

Du kannst direkt in den beiden MOTD-Zeilen schreiben, Text markieren und über eine Werkzeugleiste formatieren. Eine zusätzliche Eigenschaftsansicht bietet präzise Werte und den Quelltextmodus.

- Farben, fett, kursiv, unterstrichen, durchgestrichen und Obfuscation.
- Verläufe mit mehreren Farbstopps und expliziten Stopppositionen.
- Ausrichtung je Zeile mit sichtbar berechnetem Leerzeichen-Padding für passende Exportziele.
- Undo und Redo für Text-, Format-, Verlauf- und Icon-Änderungen.
- Tastaturnavigation, Tastaturkürzel, Copy/Paste und Eingabekomposition.
- Stabile Auswahl beim Öffnen der Werkzeugleiste und beim Anwenden einer Formatierung.
- Gemeinsam markierbare Textbereiche über Formatgrenzen hinweg.

Textauswahl wird über stabile Dokumentpositionen abgebildet. Nativ unterstützte Bewegung, etwa Obfuscation, darf weder den ursprünglichen Text noch Cursorpositionen verändern. Sichtbare Grapheme und die Regeln des ausgewählten Minecraft-Schriftprofils bestimmen Darstellung und Eingabeverhalten; UTF-16-Längen werden nicht als universelle Zeichenbreiten verwendet.

Die visuelle Oberfläche begrenzt die MOTD auf zwei sichtbare Zeilen. Importierter längerer Inhalt bleibt im Quelltext erhalten und bekommt eine Diagnose für die ausgewählte Serverlisten-Darstellung. Die Bibliothek entfernt keine überzähligen Zeilen ohne ausdrückliche Bearbeitung.

## Vorschau und Schriftprofile

Die Vorschau stellt einen vollständigen Servereintrag mit Icon, Servername, MOTD, Spieleranzeige, Versionsstatus und Ping-Symbol dar. Ein Vergleichsmodus zeigt denselben Entwurf mit unterschiedlichen Clientkontexten.

Ein Schriftprofil definiert Glyphen, Zeichenfortschritte, Fallbacks, Textschatten, Dekorationen und Versionsbezug. Ein Clientprofil definiert Serverlisten-Geometrie, verfügbare Textbreite, GUI-Skalierung und Tooltipverhalten. Die Breite wird aus dem Profil und dem Vorschaufenster bestimmt; ein globaler Wert von 256 Pixeln ist keine universelle Konstante.

Zum Lieferumfang gehören ein offline nutzbares Standardprofil und ein zugehöriger Asset-Satz mit dokumentierter Herkunft und Weitergabemöglichkeit. Eigene Schriftprofile und Assets können explizit übergeben werden. Es gibt keine stillen Downloads von Schriftarten, Texturen oder Drittanbieter-APIs.

Die erste Abnahme erfolgt gegen Minecraft Java 1.21.1 mit Standardschrift und festgehaltenen GUI-Einstellungen. Weitere Clientprofile müssen ihre Version und ihre Referenzprüfung ausweisen. Ein abweichendes Schrift- oder Ressourcenpaket wird als eigenes Profil behandelt; die Standardvorschau behauptet dafür keine identische Darstellung.

Padding, Umbruch, Abschneiden, Formatbreiten und Tooltipverhalten werden gegen Clientreferenzen geprüft. Obfuscation verwendet zum Profil passende Zeichenbreiten. Reduzierte Bewegung und eine manuelle Animationspause werden unterstützt.

## Protokollhinweis

Der Bereich rechts im Servereintrag ist konfigurierbar:

| Modus                                | Verhalten                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Automatisch                          | Übernimmt die Versionsdaten und stellt die Kompatibilität zum Vorschauclient dar                         |
| Eigener Hinweis bei Inkompatibilität | Verwendet eigenen Text, wenn der Anwendungskontext den Client als inkompatibel einordnet                 |
| Eigener Hinweis dauerhaft            | Verwendet eigenen Text und erzeugt die dafür erforderliche Inkompatibilitätsanzeige in der Statusantwort |

Der Text ist inline und über die Eigenschaftsansicht bearbeitbar. Formatierung wird entsprechend den Fähigkeiten des tatsächlichen Versionsfelds serialisiert, nicht pauschal wie eine MOTD-Komponente behandelt. Ein frei formatierter Spielertext an derselben Position nutzt denselben Modus; zwei konkurrierende Texte werden dort nicht gleichzeitig dargestellt.

Der Vorschauclient kann gewechselt werden. Die Anwendung liefert ihre Kompatibilitätsentscheidung, damit Protokollübersetzungen berücksichtigt werden können. Ein dauerhaft eigener Hinweis ändert die Statusanzeige; tatsächliche Regeln für Verbindungsaufbau oder Wartung bleiben eine Aufgabe des Servers.

Der Hover über dem Inkompatibilitätssymbol folgt dem Clientprofil und wird nicht als beliebig serverseitig editierbarer Text angeboten.

## Servericon

Du kannst ein Bild hochladen, quadratisch zuschneiden und für den Java-Servereintrag als 64 mal 64 Pixel großes PNG normalisieren. Das Icon ist direkt anklickbar, austauschbar und zurücksetzbar. Ein Anwendungsadapter kann ein vorhandenes Icon liefern.

PNG und JPEG sind Eingabeformate der ersten Umsetzung. Dekodierfehler, übergroße Bilder und beschädigte Dateien erzeugen verständliche Diagnosen. Bilder werden lokal verarbeitet. Ein Importadapter für entfernte Bilder muss ausdrücklich bereitgestellt und aufgerufen werden.

## Spieleranzeige und Hovertext

Onlinezahl und Maximum können jeweils übernommene Werte, feste Zahlen oder deklarative Berechnungen sein. Unterstützte Berechnungen sind ein additiver Offset, ein Prozentwert sowie eine freie Kapazität oberhalb der ausgewerteten Onlinezahl. Beliebige ausführbare Ausdrücke werden nicht in Dokumenten gespeichert.

Standardmäßig übernimmt die Bibliothek die übergebenen Werte. Der Modus für die verborgene Spieleranzeige bildet die fehlenden Spielerdaten der Java-Statusantwort und die daraus entstehende Anzeige nach. Die Kombination mit einem eigenen Hover wird als Konflikt angezeigt, wenn der Client diesen Hover in diesem Modus nicht darstellen kann.

Der Spieler-Hover ist separat konfigurierbar: vorhandene Spielerauswahl übernehmen, eigenen mehrzeiligen Text verwenden oder eigene Sample-Einträge entfernen. Eigener Text unterstützt passende Farben, Formatierungen und Platzhalter. Die Vorschau bildet zusätzliche, vom Client erzeugte Zeilen und die tatsächlich erreichbaren Hoverbereiche nach.

Hover über Spielerzahl, Ping-Symbol und Versionsfehler sind getrennte Interaktionsbereiche. Die Eigenschaftsansicht erlaubt die Bearbeitung eines Spieler-Hovers auch dann, wenn er im gewählten Protokollmodus nicht sichtbar ist; sie zeigt den Grund an.

## Parser und Export

Die erste Umsetzung liest und schreibt MiniMessage, Legacy mit `&` oder `§`, Java-Properties-MOTD-Werte und JSON-Textkomponenten. Ein versioniertes eigenes JSON-Format speichert das vollständige Editordokument. Eine separate Statusauswertung erzeugt die Felder einer Java-Statusantwort aus Dokument und Laufzeitkontext.

MOTD-Textformate transportieren nur ihre jeweiligen Textfunktionen. Icon, Spielerregeln und Versionsstatus gehen ausschließlich in das vollständige Dokument beziehungsweise die Statusantwort ein. Kein Exportformat verspricht Felder, die das Zielformat nicht besitzt.

Für MiniMessage werden Farben, Farb-Aliase, Dekorationen, Resets, Zeilenumbrüche, Escapes, verschachtelte Formatierungen, Verläufe mit gleichmäßig verteilten Stops und Rainbow unterstützt. Benutzerdefinierte Stopppositionen werden für eine semantisch korrekte Ausgabe bei Bedarf zu expliziten Zeichenfarben aufgelöst. Nicht unterstützte Konstrukte bleiben als geschützte Quelltextbereiche erhalten und erzeugen eine Diagnose; sie werden nicht stillschweigend entfernt oder ausgeführt.

Unveränderte Importe behalten ihren ursprünglichen Quelltext. Nach visuellen Änderungen bleibt die Semantik der betroffenen unterstützten Bereiche erhalten; Formatnormalisierung darf den Text verändern, aber nicht die Bedeutung. Nicht darstellbare Merkmale eines Exportziels erfordern eine ausdrücklich gewählte Reduktion oder einen abgebrochenen Export mit Diagnose.

Verlaufserkennung und automatische Ausrichtungserkennung sind optionale Importhilfen. Standardmäßig bleiben Einzelzeichenfarben und absichtliche Leerzeichen exakt erhalten. Eine Vereinfachung zeigt vor ihrer Übernahme die entstehenden Abweichungen an.

Java-Properties-Export behandelt Backslashes, führende Leerzeichen, Zeilenumbrüche und die zum Ziel passende Zeichenkodierung ausdrücklich. Legacy-Export setzt Farben und Dekorationen auch für Leerzeichen korrekt zurück und verwendet eine konfigurierbare Hex-Darstellung. Zielfunktionen werden durch benannte Exportprofile beschrieben.

## Platzhalter und externe Anbindungen

Die Anwendung übergibt einen Platzhalterresolver sowie Werte für Vorschau und Auswertung. Eine Vorschau funktioniert auch mit rein lokalen Beispielwerten. Nicht bekannte Platzhalter bleiben sichtbar und erhalten eine Diagnose.

Werte werden standardmäßig als Text eingesetzt. Die Bibliothek verhindert, dass ein gewöhnlicher Platzhalterwert ungewollt Format-Tags einschleust. Erweiterungen mit strukturiertem Inhalt benötigen einen gesonderten, expliziten Resolvertyp.

Serverimport und besondere Anbieterimporte werden über eine injizierte Importfunktion angebunden. Die Anwendung steuert Transport, Berechtigungen und Fehlerbehandlung des jeweiligen Dienstes. Die Bibliothek verarbeitet das zurückgegebene Statusdokument. Sie importiert beim Start keinen zufällig ausgewählten Server.

## Öffentliche Oberfläche und Bedienbarkeit

Der DOM-Einstiegspunkt bietet getrennte Vorschau- und Editorinstanzen mit explizitem Lebenszyklus. Änderungen liefern ein neues Dokument und strukturierte Änderungsinformationen. Die React-Anbindung unterstützt einen kontrollierten Dokumentwert, Änderungsereignisse, schreibgeschützte Darstellung und deaktivierte Bearbeitung.

Funktionsschalter steuern MOTD, Icon, Protokollhinweis, Spieleranzeige, Hover, Import und Export. Anwendungen können Aktionen ausblenden oder durch eigene Werkzeugleisten auslösen. CSS-Custom-Properties und dokumentierte Stilklassen ermöglichen eigene Gestaltung; Oberflächenbeschriftungen sind austauschbar.

Alle Interaktionen sind per Tastatur erreichbar. Tooltips lassen sich auch über Fokus öffnen. Die Bibliothek bietet einen zugänglichen Textwert zusätzlich zur visuellen Darstellung. Schrift- oder Icon-Ladefehler werden angezeigt und führen zu einem erkennbaren Fallback. Parsergrenzen, Bildgrenzen und Importgrenzen sind konfigurierbar und erzeugen strukturierte Fehler.

## Qualität und Abnahme

| Prüfung              | Abnahmekriterium                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unabhängige Nutzung  | Eine kleine Website verwendet den DOM-Editor ohne React, Portalcode und Backend                                                                                        |
| Textverarbeitung     | Der Kern importiert und serialisiert übergebene Daten unter Node.js ohne Browserobjekte oder Netzwerkanfragen                                                          |
| React-Anbindung      | Eine separate Beispielanwendung hält Dokument und Editor über Änderungsereignisse synchron                                                                             |
| Texttreue            | MiniMessage- und Legacy-Fixtures stimmen semantisch mit Adventure-Referenzausgaben überein; Escapes, verschachtelte Formate und formatierte Leerzeichen sind abgedeckt |
| Importtreue          | Ein Verlauf mit ungleich verteilten Stops sowie geschützte Quelltextbereiche bleiben beim unveränderten Import und Export erhalten                                     |
| Visuelle Darstellung | Referenzaufnahmen für Java 1.21.1 prüfen Glyphen, Abstände, Schatten, zwei Zeilen, Padding, Überlauf, Icon, Kompatibilitätsstatus und Hover                            |
| Eingabe              | Browserprüfungen decken Auswahl über Formatgrenzen, Undo und Redo, Zwischenablage, Komposition und stabile Cursorpositionen ab                                         |
| Spieleranzeige       | Jeder Zählmodus und Konflikte zwischen verborgenen Spielerdaten, Hover und Versionshinweis werden korrekt dargestellt                                                  |
| Bilder               | Zuschnitt, Skalierung, PNG-Ausgabe sowie ungültige und zu große Eingaben sind geprüft                                                                                  |
| Paket                | Ein installierbares Paket enthält Typen, Einstiegspunkte, benötigte Styles und Assets; Beispiele verwenden das gepackte Artefakt                                       |
| Offlinebetrieb       | Demo und Kernfunktionen arbeiten nach dem Laden mit lokalen Daten; es gibt keine impliziten Drittanbieteranfragen                                                      |

Der Lieferumfang umfasst eine eigenständige Demo, eine Nutzung ohne Framework, ein React-Beispiel, API-Dokumentation, die Erklärung der Exportprofile und dokumentierte Erweiterungspunkte. Abweichungen einzelner Clientprofile werden konkret dokumentiert.

## Grounds Integration als eigener Schritt

Nach der eigenständigen Bibliothek wird ein Grounds-Adapter für normale und Wartungs-MOTDs umgesetzt. Er übernimmt Portalberechtigungen, Stage und Production, Versionskonflikte und Speichervorgänge. Zusätzliche serverseitige Funktionen benötigen passende Erweiterungen der Konfiguration und der Proxy-Auswertung; eine reine Portaländerung reicht dafür nicht aus.

Die vorhandene Trennung zwischen normaler MOTD und Wartungs-Override bleibt erhalten. Bei leerem Wartungs-Override gilt weiterhin die normale MOTD. Dokumente werden pro Umgebung netzwerkweit gespeichert. Vorschauwerte für Spielerzahlen kommen aus netzwerkweiten Präsenzdaten; regionale Werte sind ausdrücklich als solche auswählbar.

Die Integration prüft mindestens zwei Proxys, die Übernahme desselben Dokuments, regionsabhängige Platzhalter, konsistente Spielerzahlen und das Verhalten bei kurzzeitig ausgefallenem Konfigurationsdienst. Editorinformationen dürfen weder die Proxykompatibilität noch die bisherige Konfigurationsversionierung brechen.

## Referenzen

- [MOTD Studio](https://motd-studio.net/) und seine öffentlich ausgelieferten [Editorquellen](https://motd-studio.net/app.js) dienen als Funktionsreferenz. Die Bibliothek erhält eine eigene Implementierung und eigene Assets.
- [MiniMessage Format](https://docs.papermc.io/adventure/minimessage/format/) definiert die zu prüfende Textsemantik.
- [Adventure Legacy Serializer](https://docs.papermc.io/adventure/serializer/legacy/) beschreibt die Legacy- und Hex-Formate.
- [Velocity ServerPing Builder](https://jd.papermc.io/velocity/3.5.0/com/velocitypowered/api/proxy/server/ServerPing.Builder.html) beschreibt die getrennten Statusfelder für Version, Spieler und Icon.
- [ServerListPlus Player Slots](https://github.com/Minecrell/ServerListPlus/wiki/Player-Slots) erläutert die Versionsdarstellung für eigene Slottexte.
- [ServerListPlus Velocity Integration](https://github.com/Minecrell/ServerListPlus/blob/master/Velocity/src/main/java/net/minecrell/serverlistplus/velocity/VelocityPlugin.java) zeigt die Übertragung eigener Spieler-Hovertexte über Sample-Einträge.
