# Client reference validation

Target: Minecraft Java 1.21.1, default font, GUI scale 2, 854 by 480 window.
Capture the server list row using a local status server with known two-line text,
formatted spaces, narrow glyphs, Latin accents, icon, version, sample-player hover
and both compatibility states. Save original captures, crop coordinates, version,
status inputs and SHA-256 hashes in tests/fixtures/client/java-1.21.1.

The OFL font metrics are implemented and tested. An actual 1.21.1 client capture
has not yet been obtained; the profile deliberately reports verified: false.
Browser-generated screenshots must not be substituted for client references.
