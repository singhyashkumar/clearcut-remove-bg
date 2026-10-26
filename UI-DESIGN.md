# Clearcut UI refinement

Direction: preserve the approved white, charcoal and deep green homepage, Poppins headings, full-column animated hero, original artwork and existing product behaviour. Apply Premium UI Engine's software-tool principles: one clear primary action, legible supporting details, reachable navigation and a consistent reading experience. The approved Clearcut composition is the visual reference; guide pages adapt its type hierarchy and spacing for longer reading.

Scope: homepage header/navigation, upload supporting text, pricing/support text sizes, guide directory, and the shared static guide/about/privacy/contact template. Keep current homepage fonts; use the licensed existing Poppins file for article headings and the existing Arial body fallback. No new media, dependencies, backend, pricing or model changes.

Navigation uses native HTML details/summary on phones, with visible focus and working links even without JavaScript. Guides remain static and crawlable. Article CSP admits only same-origin fonts while retaining its script and connection restrictions. Hero motion preferences and reduced-motion poster remain unchanged.

QA: production preview inspected at 1440px, 820px, 390px and 320px. No horizontal overflow at sampled widths. Hero media and text column edges match at desktop. Checked mobile menu destinations, close-after-navigation, Enter/Escape and focus return. Guide template inspected at 390px and 1440px. All 27 tests pass, including menu behaviour, model-selection and payment verification regressions; production build passes. Existing GIF/reduced-motion tests pass. Payment/authentication and inference are outside this visual change; no new real payment, Google account sign-in or model inference run was performed.
