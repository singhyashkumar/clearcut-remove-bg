/**
 * Genuine car-example images supplied by the site owner and reported to have
 * been processed with Clearcutt's Standard model.
 *
 * The supplied files are JPEGs with their displayed backgrounds baked into the
 * pixels (four black backgrounds and one rocky outdoor scene). They contain no
 * alpha transparency, so every caption and alt text below describes opaque
 * images only. Originals are kept byte-for-byte as JPEG fallbacks; the
 * `-480.webp` and `-960.webp` files are resized derivatives of the same pixels.
 * No image was generated, retouched, recoloured or cropped.
 */

const escape = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('"', '&quot;');

export const carExamplesBase = '/artwork/guides/car-examples';

export type CarExample = Readonly<{
  file: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}>;

export const carExamples: readonly CarExample[] = [
  {
    file: 'car-example-01-silver-electric-crossover',
    width: 1600,
    height: 819,
    alt: 'Silver electric-style crossover viewed from the front three-quarter angle on a black background',
    caption: 'Silver electric-style crossover, front three-quarter view, black background.',
  },
  {
    file: 'car-example-02-black-sports-car',
    width: 1600,
    height: 800,
    alt: 'Black sports car with red accents viewed from the front three-quarter angle on a black background',
    caption: 'Black sports car with red accents, front three-quarter view.',
  },
  {
    file: 'car-example-03-futuristic-electric-sedan',
    width: 1600,
    height: 800,
    alt: 'Futuristic electric-style sedan with cyan lighting viewed from the front on a black background',
    caption: 'Futuristic electric-style sedan with cyan lighting, front view.',
  },
  {
    file: 'car-example-04-blue-coupe-rear-view',
    width: 1600,
    height: 800,
    alt: 'Dark blue performance coupe viewed from the rear three-quarter angle on a black background',
    caption: 'Dark blue performance coupe, rear three-quarter view.',
  },
  {
    file: 'car-example-05-offroad-suv-rocky-scene',
    width: 1536,
    height: 1024,
    alt: 'Rugged off-road SUV on rocky outdoor terrain',
    caption: 'Rugged off-road SUV on rocky outdoor terrain.',
  },
];

/** The silver crossover represents the car guide in metadata and social previews. */
export const carPrimaryImage = {
  src: `${carExamplesBase}/car-example-01-silver-electric-crossover.jpg`,
  alt: carExamples[0].alt,
  width: carExamples[0].width,
  height: carExamples[0].height,
} as const;

// One full-width image per row inside the 756px content column: on desktop the
// image renders at min(100vw - 64px, 756px) minus the frame's 22px of padding
// and border; on mobile the page padding is 24px per side.
const gallerySizes = '(max-width: 767px) calc(100vw - 70px), 736px';

/**
 * Responsive example gallery for the car guide. Renders below the page
 * metadata and before the guide sections; the first image is the only
 * above-the-fold candidate, so only it gets fetch priority.
 */
export function renderCarGallery(): string {
  const items = carExamples.map((example, index) => {
    const base = `${carExamplesBase}/${example.file}`;
    const priority = index === 0 ? ' fetchpriority="high"' : ' loading="lazy"';
    return `<li><figure class="car-gallery-item"><div class="car-gallery-frame"><picture><source type="image/webp" srcset="${base}-480.webp 480w, ${base}-960.webp 960w" sizes="${gallerySizes}"><img src="${base}.jpg" alt="${escape(example.alt)}" width="${example.width}" height="${example.height}" decoding="async"${priority}></picture></div><figcaption>${escape(example.caption)}</figcaption></figure></li>`;
  }).join('');
  return `<section class="car-gallery" aria-labelledby="car-gallery-heading"><h2 id="car-gallery-heading">Car Background Removal Examples</h2><p>Explore vehicle images processed with Clearcutt’s Standard model. These examples show different vehicle shapes, angles and selected backgrounds. Inspect glass, mirrors, wheel gaps and fine edges in your own results before downloading.</p><ul class="car-gallery-grid">${items}</ul></section>`;
}

/**
 * Supplementary opaque-image comparison for the transparent-background guide.
 * The supplied JPEG demonstrates a fixed background baked into the pixels; it
 * is never presented as a transparent export.
 */
export function renderOpaqueExampleSection(): string {
  const example = carExamples[0];
  const base = `${carExamplesBase}/${example.file}`;
  const alt = 'Opaque JPEG of a silver electric-style crossover with its black background baked into the image pixels';
  const caption = 'Opaque JPEG example: the black background is part of the image pixels. It is not a transparent PNG and contains no alpha channel.';
  return `<section><h2>Transparent PNG vs. JPEG with a Fixed Background</h2><p>The vehicle image below is an opaque JPEG: its black background is baked into the image pixels. A fixed-background JPEG like this always shows the background it was exported with. A transparent PNG is different—when you select Transparent in Clearcutt and download PNG, the file keeps genuinely transparent pixels, so whatever you place the cutout over shows through where the background was removed.</p><figure class="guide-visual guide-visual--opaque-example"><picture><source type="image/webp" srcset="${base}-480.webp 480w, ${base}-960.webp 960w" sizes="(max-width: 767px) calc(100vw - 48px), 756px"><img class="guide-visual-image" src="${base}.jpg" alt="${escape(alt)}" width="${example.width}" height="${example.height}" loading="lazy" decoding="async"></picture><figcaption>${escape(caption)}</figcaption></figure></section>`;
}
