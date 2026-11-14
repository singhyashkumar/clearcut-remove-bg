# Guide artwork

These files support the ten public Clearcut how-to guides. They are controlled illustrations, not screenshots or measured AI-removal results.

## Sources and rights

- The terracotta shoe is original AI-generated artwork produced for Clearcut and already used by the homepage walkthrough.
- The portrait, squirrel and car use Clearcut's existing owned AI gallery artwork.
- Layout, labels, checkerboards, colour chips, crop marks and the `SAMPLE` demonstration are rendered locally by `render.mjs`.
- No marketplace, government, competitor or third-party brand assets are included.

## Delivery rules

- Each still has a 480 px mobile WebP and a 960 px desktop WebP.
- Mobile variants must stay at or below 15 KB; desktop variants must stay at or below 30 KB.
- The three-frame GIF is optional, lazy-loaded inside a closed disclosure, plays once and must stay at or below 70 KB.
- The GIF has a static WebP fallback for `prefers-reduced-motion`.
- HTML reserves every image's dimensions to avoid layout shift.

Run `node artwork/guides/render.mjs` to rebuild the stills. Re-optimise the GIF after changing its frames and run `npm test` to enforce the byte budgets.
