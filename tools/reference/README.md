# Client reference validation

Actual Java 1.21.1 captures were obtained on 2026-10-21 using a clean temporary game directory, Xvfb 854×480 and GUI scale 2. A local status-only server advertised protocol 767, online 42/max500, sample Ada, bold gold Grounds and green Welcome, 42 players. The native client was launched offline without an account token.

`tests/browser/client-reference.spec.ts` compares independent native and browser foreground pixel masks at known row positions. It passes for all three tested colors. Capture origin is (126,72); browser row origin is (0,0). Player tooltip adds “… and 41 more …”. See fixture manifest for capture hashes. Native game jars/assets are not distributed.

Broader glyph/decorations/compatibility/wrapping validation and actual IME verification are still outstanding; the public profile therefore remains explicitly unverified.
