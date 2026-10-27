import type { englishLabels } from "./en.js";
/** Complete German catalog; override individual keys for host terminology. */
export const germanLabels = {
  "diagnostic.fontSourceInput":
    "Ungültige Daten für die Laufzeit-Schriftquelle.",
  "diagnostic.fontSourceOptions":
    "Ungültige Limits für die Laufzeit-Schriftquelle.",
  "diagnostic.fontSourceLimit":
    "Die Laufzeit-Schriftquelle überschreitet {limit}.",
  "diagnostic.fontSourceRaster":
    "Die gewählte Laufzeit-Glyphe konnte keine gültigen RGBA-Pixel liefern.",
  "diagnostic.fontUnihexDefinition":
    "Ungültige oder unbrauchbare Unihex-Bereichsdefinition.",
  "diagnostic.fontUnihexFormat":
    "Ungültige oder nicht unterstützte Unihex-Zeilensyntax.",
  "diagnostic.fontUnihexInput":
    "Explizit bereitgestellte Unihex-Bytearrays werden erwartet.",
  "diagnostic.fontUnihexOptions": "Ungültige Limits zur Unihex-Decodierung.",
  "diagnostic.fontUnihexLimit":
    "Die Unihex-Decodierung hat {limit} überschritten.",
  "diagnostic.fontUnihexDuplicates":
    "Für {count} doppelte Unihex-Zeichendeklarationen wurde die letzte Zeile verwendet.",
  "diagnostic.fontBitmapDefinition":
    "Ungültige oder unbrauchbare Bitmap-Fontgeometrie.",
  "diagnostic.fontBitmapImage":
    "Ungültiges decodiertes RGBA-Bild der Bitmap-Schrift.",
  "diagnostic.fontBitmapOptions":
    "Ungültige Limits zur Bitmap-Fontdecodierung.",
  "diagnostic.fontBitmapLimit":
    "Die Bitmap-Fontdecodierung hat {limit} überschritten.",
  "diagnostic.fontBitmapDuplicates":
    "Für {count} doppelte Bitmap-Zeichendeklarationen wurde die letzte Zelle verwendet.",
  "diagnostic.fontDefinition": "Ungültige Fontprovider-Definition.",
  "diagnostic.fontResourceId":
    "Ungültiger oder unsicherer lokaler Font-Ressourcenbezeichner.",
  "diagnostic.fontOptions": "Ungültige Optionen zur Fontauflösung.",
  "diagnostic.fontCancelled": "Die Fontauflösung wurde abgebrochen.",
  "diagnostic.fontLimit": "Die Fontauflösung hat {limit} überschritten.",
  "diagnostic.fontRead":
    "Der Host konnte die Fontdefinition nicht als Bytes lesen.",
  "diagnostic.fontResourceMissing":
    "Eine benötigte lokale Fontdefinition fehlt.",
  "diagnostic.fontReferenceCycle": "Fontreferenzen enthalten einen Zyklus.",
  "diagnostic.fontProviderUnsupported":
    "Dieser aktive Fontprovider-Typ wird nicht unterstützt.",
  comparisonProtocol: "Protokoll",
  comparisonScale: "GUI-Skalierung",
  comparisonBackground: "Hintergrund",
  comparisonReference: "Referenzvorschau",
  comparisonDifferences: "Abweichungen zur Referenz",
  comparisonSame: "Gleicher berechneter Status wie die Referenz",
  panoramaSpeed: "Panorama-Geschwindigkeit",
  pausePanorama: "Panorama pausieren",
  panoramaDemoNote: "Originale Demo-Grafik. Keine Spieltexturen enthalten.",
  comparisonDiagnostics: "Diagnosen der Vorschau",
  comparisonEmpty: "Keine Clients ausgewählt",
  cancelUpload: "Upload abbrechen",
  iconEditor: "Server-Icon bearbeiten",
  iconPreview: "Vorschau des Icon-Zuschnitts",
  chooseImage: "Bild auswählen",
  resetIcon: "Icon zurücksetzen",
  cancel: "Abbrechen",
  apply: "Anwenden",
  imageLoading: "Bild wird vorbereitet…",
  imageError: "Ungültiges Bild: Dekodierung fehlgeschlagen",
  serverIcon: "Server-Icon",
  entryTools: "Server-Einstellungen",
  playerDisplay: "Spieleranzeige",
  hidePlayers: "Spielerzahl ausblenden",
  evaluatedPlayerCounts: "Berechnete Spielerzahlen",
  calculatedPreview: "Berechnete Vorschau: {online}/{maximum}",
  versionSettings: "Versionseinstellungen",
  versionDisplay: "Versionsanzeige",
  editHiddenVersion: "Ausgeblendeten Versionstext bearbeiten",
  playerHover: "Spieler-Hovertext",
  close: "Schließen",
  selectionExpired: "Die Auswahl ist nicht mehr verfügbar.",
  colorPicker: "Farbauswahl",
  hexColor: "Hexfarbe",
  invalidGradient: "Verwende unterschiedliche Positionen zwischen 0 und 1.",
  gradientColor: "Verlaufsfarbe",
  gradientPosition: "Position im Verlauf",
  removeStop: "Farbpunkt entfernen",
  gradientPhase: "Phase des Farbverlaufs",
  addStop: "Farbpunkt hinzufügen",
  placeholderName: "Name des Platzhalters",
  insert: "Einfügen",
  rainbowPhase: "Regenbogenphase",
  reverseRainbow: "Regenbogen umkehren",
  applyRainbow: "Regenbogen anwenden",
  removeRainbow: "Regenbogen entfernen",
  rainbow: "Regenbogen",
  undo: "Rückgängig",
  redo: "Wiederholen",
  textTools: "Textwerkzeuge",
  formatting: "Textformatierung",
  sourceEditor: "Quelltexteditor",
  sourceField: "Quelltextfeld",
  sourceFormat: "Quelltextformat",
  export: "Exportieren",
  exportOutput: "Exportausgabe",
  exportField: "Exportfeld",
  exportFormat: "Exportformat",
  copy: "Ausgabe kopieren",
  copyFallback: "Kopiere die ausgewählte Ausgabe mit deinem Browser.",
  importStatus: "Serverstatus importieren",
  importPreview: "Importierter Serverstatus",
  importServer: "Server importieren",
  importLoading: "Serverstatus wird geladen…",
  importReady:
    "Prüfe den importierten Status und wähle Anwenden. Deaktivierte Felder bleiben erhalten.",
  importFailed: "Import fehlgeschlagen",
  serverAddress: "Serveradresse",
  source: "Quelltext",
  import: "Importieren",
  multiplayerTitle: "Mehrspieler",
  serverEntry: "Minecraft-Servereintrag",
  onlinePlayers: "Spieler online",
  versionInfo: "Versionsinformationen",
  connectionStatus: "Verbindungsstatus",
  morePlayers: "… und {count} weitere …",
  incompatible: "Nicht kompatible Version!",
  unverifiedProfile:
    "Das Client-Profil ist teilweise mit nativen Aufnahmen geprüft",
  bold: "Fett",
  italic: "Kursiv",
  underlined: "Unterstrichen",
  strikethrough: "Durchgestrichen",
  obfuscated: "Verschleierung",
  color: "Textfarbe",
  gradient: "Farbverlauf",
  placeholder: "Platzhalter einfügen",
  moreFormatting: "Weitere Formatierungen",
  alignLeft: "Linksbündig ausrichten",
  alignCenter: "Zentriert ausrichten",
  alignRight: "Rechtsbündig ausrichten",
  lineAlignment: "Ausrichtung für Zeile {line}",
  motd: "MOTD direkt bearbeiten",
  version: "Version direkt bearbeiten",
  hover: "Hovertext direkt bearbeiten",
  joinServer: "Server betreten",
  directConnection: "Direkt verbinden",
  addServer: "Server hinzufügen",
  editServer: "Bearbeiten",
  deleteServer: "Löschen",
  refreshServers: "Aktualisieren",
  back: "Zurück",
  "diagnostic.expectedString": "Eine Zeichenfolge wird erwartet.",
  "diagnostic.textLimit":
    "Der Text überschreitet die konfigurierte Begrenzung.",
  "diagnostic.invalidText": "Ungültige Textkomponente.",
  "diagnostic.invalidStatusVersion": "Ungültige Serverversion.",
  "diagnostic.statusTextLimit":
    "Die Server-MOTD überschreitet die Importbegrenzung.",
  "diagnostic.invalidStatusPlayers": "Ungültige Spielerzahlen des Servers.",
  "diagnostic.iconDataUri": "Das Server-Icon muss eine PNG-Daten-URI sein.",
  "diagnostic.invalidStatus": "Ungültige Serverstatusantwort.",
  "diagnostic.unsupportedExport":
    "Geschützte Konstrukte können in diesem Format nicht dargestellt werden.",
  "diagnostic.protectedPreview":
    "Geschützte Komponente wird angenähert dargestellt; Aktionen und client-/serverabhängige Inhalte werden nicht aufgelöst.",
  "diagnostic.protectedLayoutMultiline":
    "Leere oder mehrzeilige geschützte Komponenten benötigen Änderungen am Quelltext. Exportiere ohne Layout oder löse den Wert zuerst auf.",
  "diagnostic.protectedLayoutBreak":
    "Ein visueller Umbruch liegt in einer geschützten Komponente oder einem Platzhalter. Exportiere ohne Layout oder löse den Wert zuerst auf.",
  "diagnostic.protectedEffect":
    "Die geschützte Komponente bleibt erhalten; ihr umgebender Farbeffekt kann nicht berechnet werden.",
  "diagnostic.protectedLayoutJson":
    "Geschützte Komponenten können nicht als JSON-Layout exportiert werden. Exportiere ohne Layout.",
  "diagnostic.unsupportedColor": "Das Zielformat unterstützt keine RGB-Farben.",
  "diagnostic.reducedColor":
    "RGB wurde auf die ähnlichste Legacy-Farbe reduziert.",
  "diagnostic.depthLimit":
    "Die Textverschachtelung überschreitet die konfigurierte Begrenzung.",
  "diagnostic.unsupportedTag":
    "Nicht unterstütztes Tag <{tag}> wurde beibehalten.",
  "diagnostic.unknownPlaceholder": "Für {{{name}}} ist kein Wert vorhanden.",
  "diagnostic.missingPlayers":
    "Für eine Berechnung fehlen die ursprünglichen Spielerdaten.",
  "diagnostic.countClamped":
    "Die Spielerzahl wurde auf den unterstützten Ganzzahlbereich begrenzt.",
  "diagnostic.hiddenHover":
    "Bei ausgeblendeten Spielerdaten gibt es keinen Spielerlisten-Hovertext.",
  "diagnostic.unreachableHover":
    "Der inkompatible Status ersetzt das Hoverziel der Spielerzahl.",
  "diagnostic.invalidDocument":
    "Begrenzte JSON-Daten ohne Zyklen werden erwartet.",
  "diagnostic.unsupportedSchema": "Nur Dokumentschema 1 wird unterstützt.",
  "diagnostic.invalidMotd": "Ungültiger MOTD-Text oder ungültige Ausrichtung.",
  "diagnostic.invalidVersion": "Ungültige Versionsregel.",
  "diagnostic.missingPlayerRules": "Spielerregeln fehlen.",
  "diagnostic.expectedBoolean": "Ein Wahrheitswert wird erwartet.",
  "diagnostic.invalidCount": "Ungültige Spielerzahlregel.",
  "diagnostic.invalidHover": "Ungültiger Spieler-Hovertext.",
  "diagnostic.invalidIcon":
    "Eine vollständige, begrenzte PNG-Datei mit 64×64 Pixeln wird erwartet.",
  "diagnostic.invalidExtensions": "Ein Erweiterungsobjekt wird erwartet.",
  "diagnostic.documentLimit": "Das Dokument ist zu groß.",
  "diagnostic.invalidJson": "Das Dokument enthält kein gültiges JSON.",
  "diagnostic.alignmentUnavailable":
    "Für die Ausrichtung benötigt dieses Schriftprofil eine positive Leerzeichenbreite.",
  "diagnostic.unsupportedTextLayout":
    "Der Text liegt außerhalb der unterstützten LTR-Schriften dieses Profils. Kontextabhängige Zeichenformen und bidirektionale Anordnung sind angenähert.",
  "diagnostic.carriageReturnGlyph":
    "Der Wagenrücklauf wird als ? angezeigt; sein natives Steuerzeichen liegt außerhalb der DOM-Schriftunterstützung.",
  "diagnostic.missingGlyph":
    "Für {glyph} gibt es in diesem Schriftprofil kein Zeichen. Ersatzdarstellung und Breite sind angenähert.",
  "diagnostic.lineOverflow":
    "Der Text wird über die gewählte Zeilenbreite hinaus umgebrochen.",
  "diagnostic.hiddenLines": "Nur die ersten beiden Zeilen sind sichtbar.",
  "diagnostic.imageBytes":
    "Das Bild überschreitet die konfigurierte Dateigröße.",
  "diagnostic.imageFormat": "Ungültiges Bild: Wähle PNG oder JPEG.",
  "diagnostic.imageHeader": "Ungültiges Bild: beschädigter Dateikopf.",
  "diagnostic.imagePixels":
    "Das Bild überschreitet die konfigurierte Pixelanzahl.",
  "diagnostic.invalidCrop":
    "Der Zuschnitt muss ein Quadrat innerhalb des Bildes sein.",
  "diagnostic.imageDecode": "Ungültiges Bild: Dekodierung fehlgeschlagen.",
  gradientColorNumber: "{label} {index}",
  gradientPositionNumber: "{label} {index}",
  removeStopNumber: "{label} {index}",
  addStopButton: "+ {label}",
  decorations: "Weitere Formatierungen",
  motdSource: "MOTD-Quelltext",
  versionSource: "Versionsquelltext",
  hoverSource: "Hover-Quelltext",
  onlineMode: "Modus für Spieler online",
  onlineValue: "Wert für Spieler online",
  maximumMode: "Modus für maximale Spielerzahl",
  maximumValue: "Wert für maximale Spielerzahl",
  "countMode.inherit": "Livewert",
  "countMode.fixed": "Fester Wert",
  "countMode.offset": "Abweichung addieren",
  "countMode.percent": "Prozent des Livewerts",
  "countMode.headroom": "Freie Plätze über der Onlinezahl",
  "versionMode.automatic": "Automatisch",
  "versionMode.when-incompatible": "Bei Inkompatibilität anpassen",
  "versionMode.always": "Immer anpassen",
  "hoverMode.inherit": "Aktuelle Spielerliste",
  "hoverMode.custom": "Eigener Text",
  "hoverMode.disabled": "Keine eigenen Einträge",
  versionHintAutomatic:
    "Wähle einen benutzerdefinierten Modus, um den Versionstext zu bearbeiten.",
  versionHintCompatible:
    "Dieser Client zeigt Spielerzahlen. Eigener Versionstext bleibt für inkompatible Clients erhalten.",
  versionHintEditable: "Bearbeite den Versionstext direkt im Servereintrag.",
  hoverHintUnavailable:
    "Dieser Client kann mit den aktuellen Statuseinstellungen keinen Spieler-Hovertext anzeigen. Dein eigener Text bleibt bearbeitbar.",
  hoverHintInherited:
    "Die aktuelle Spielerliste wird angezeigt. Wähle Eigener Text, um sie zu bearbeiten.",
  hoverHintDisabled:
    "Eigene Einträge sind deaktiviert. Wähle Eigener Text, um sie zu bearbeiten.",
  hoverEditor: "Spieler-Hovertext bearbeiten",
  versionEditor: "Versionstext bearbeiten",
  closehover: "Spieler-Hovertext schließen",
  closeversion: "Versionstext schließen",
  cropx: "X-Position des Zuschnitts",
  cropy: "Y-Position des Zuschnitts",
  uploadIcon: "Server-Icon hochladen",
  editIcon: "Server-Icon bearbeiten",
  edit: "Bearbeiten",
  upload: "Hochladen",
  "format.minimessage": "MiniMessage",
  "format.legacy-ampersand": "Legacy-Codes (&)",
  "format.legacy-section": "Legacy-Codes (§)",
  "format.properties": "server.properties",
  "format.json": "JSON-Komponenten",
  "comparisonField.version": "Version",
  "comparisonField.players": "Spieler",
  "comparisonField.description": "MOTD",
  "comparisonField.favicon": "Icon",
  "background.auto": "Automatisch",
  "background.none": "Kein Hintergrund",
  "background.dirt": "Erdtextur",
  "background.panorama": "Panorama",
  "background.custom": "Eigenes Bild",
  protectedSourceHint:
    "Geschütztes Quelltextkonstrukt; im Quelltextmodus bearbeiten",
  iconDraftInvalidated:
    "Das Dokument wurde geändert. Dieser Entwurf kann nicht mehr angewendet werden. Öffne das Werkzeug erneut.",
  transferDraftInvalidated:
    "Das Dokument oder die Editorkonfiguration wurde geändert. Dieser Entwurf kann nicht mehr angewendet werden. Öffne das Werkzeug erneut.",
  importTimedOut: "Zeitüberschreitung beim Import",
  importCancelled: "Import abgebrochen",
  cropsize: "Größe des Zuschnitts",
  "diagnostic.hiddenLinesCount": "Nur die ersten {lines} Zeilen sind sichtbar.",
  importAssistance: "Importhilfe",
  assistanceHint:
    "Prüfe einen Vorschlag, bevor du Farben oder beabsichtigte führende Leerzeichen ersetzt. Erst Übernehmen ändert das Dokument.",
  assistanceColorTolerance: "RGB-Toleranz (0–255)",
  assistancePositionTolerance: "Positionstoleranz (0–4 GUI-Pixel)",
  assistanceProposal: "Vorschlag",
  assistanceBefore: "Vorher",
  assistanceAfter: "Vorschlag",
  assistanceOriginalSource: "Ursprünglicher Quelltext",
  assistanceSuggestedSource: "Vorgeschlagener Quelltext",
  assistanceMetrics:
    "RGB-Abweichung: {color}; Positionsabweichung: {position} GUI-Pixel; ersetzte führende Leerzeichen: {spaces}.",
  assistanceInvalidated:
    "Das Dokument oder die Editorkonfiguration wurde geändert. Schließe und öffne die Importhilfe erneut, bevor du einen Vorschlag übernimmst.",
  assistanceEmpty:
    "Keine sicheren Vorschläge bei diesen Toleranzen. Geschützte Inhalte, vorhandene Effekte und nicht unterstützte Layouts bleiben erhalten.",
  assistanceNoProposal: "Kein Vorschlag",
  "assistanceField.motd": "MOTD",
  "assistanceField.version": "Version",
  "assistanceField.hover": "Hovertext",
  "assistanceKind.gradient": "Farbverlauf: {field}",
  "assistanceKind.alignment": "Ausrichtung: {field}",
  "diagnostic.staticIcon":
    "PNG-Animationen werden vom Java-Status-Icon nicht unterstützt; es wird das statische Standardbild verwendet.",
  "diagnostic.inheritedIcon":
    "Das geerbte Server-Icon ist kein unterstütztes 64×64-PNG; das Standard-Icon wird verwendet.",
} satisfies Readonly<Record<keyof typeof englishLabels, string>>;
