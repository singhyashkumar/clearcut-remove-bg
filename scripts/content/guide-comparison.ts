const comparisons = {
  transparency: {
    alt: 'The same shoe cutout on a transparent checkerboard and on a white background',
    caption: 'Illustration: a checkerboard represents transparency; it is not included in the exported PNG.',
    labels: ['Transparent PNG', 'White background'],
  },
  cars: {
    alt: 'Illustrated car cutout shown on neutral and white backgrounds',
    caption: 'AI-generated illustration. Check glass, reflections, wheel gaps and the area beneath the vehicle.',
    labels: ['Start with a clear photo', 'Inspect glass and wheel gaps'],
  },
} as const;

const escape = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('"', '&quot;');

export function renderGuideComparison(name: keyof typeof comparisons): string {
  const { alt, caption, labels } = comparisons[name];
  const base = `/artwork/guides/${name}`;
  const panels = labels.map(label =>
    `<div class="guide-comparison-panel"><div class="guide-comparison-crop"></div><p>${escape(label)}</p></div>`
  ).join('');

  // The source and both mobile crops share one WebP request.
  return `<figure class="guide-visual"><div class="guide-comparison guide-comparison--${name}"><picture class="guide-comparison-wide"><source media="(max-width: 767px)" srcset="${base}-960.webp"><img class="guide-visual-image" src="${base}-960.webp" srcset="${base}-480.webp 480w, ${base}-960.webp 960w" sizes="(max-width: 767px) calc(100vw - 48px), 756px" width="960" height="600" alt="${escape(alt)}" decoding="async" fetchpriority="high"></picture><div class="guide-comparison-stack" aria-hidden="true">${panels}</div></div><figcaption>${escape(caption)}</figcaption></figure>`;
}
