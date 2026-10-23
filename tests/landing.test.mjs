import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Use the production module, substituting only Vite's build-time base URL.
const source = readFileSync(new URL('../src/landing.js', import.meta.url), 'utf8')
  .replace("import useCases from './use-cases.json' with { type: 'json' };", `const useCases = ${readFileSync(new URL('../src/use-cases.json', import.meta.url), 'utf8')};`)
  .replaceAll('import.meta.env.BASE_URL', "'/test-base/'");
const { initLanding } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

class Element extends EventTarget {
  constructor(id, dataset = {}) {
    super(); this.id = id; this.dataset = dataset; this.attributes = {};
    this.style = { setProperty: (key, value) => { this.style[key] = value; } };
    this.value = '50'; this.hidden = true;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
}
function fixture() {
  const ids = ['quality-before', 'quality-after', 'quality-slider', 'quality-panel', 'use-case-detail', 'use-case-title', 'use-case-copy', 'close-use-case'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const tabs = ['products', 'people', 'animals', 'cars', 'graphics'].map(key => new Element(`quality-tab-${key}`, { example: key }));
  const cards = Array.from({ length: 9 }, (_, i) => new Element(`card-${i}`, { useCase: String(i) }));
  const comparison = new Element('comparison');
  initLanding({ getElementById: id => elements[id], querySelector: () => comparison, querySelectorAll: selector => selector === '[data-example]' ? tabs : cards });
  return { elements, tabs, cards, comparison };
}
test('category selection changes both comparison images and keyboard selection wraps', () => {
  const { elements, tabs } = fixture();
  tabs[1].dispatchEvent(new Event('click'));
  assert.equal(elements['quality-before'].src, '/test-base/artwork/people.png');
  assert.equal(elements['quality-after'].src, '/test-base/artwork/people.png');
  assert.equal(elements['quality-panel'].attributes['aria-labelledby'], 'quality-tab-people');
  const event = new Event('keydown', { cancelable: true });
  event.key = 'ArrowLeft'; tabs[0].dispatchEvent(event);
  assert.equal(tabs[4].attributes['aria-selected'], 'true');
  assert.equal(tabs[4].tabIndex, 0);
  assert.equal(tabs[4].focused, true);
  assert.equal(event.defaultPrevented, true);
});
test('comparison slider bounds its clipping value and exposes it accessibly', () => {
  const { elements, comparison } = fixture();
  const slider = elements['quality-slider'];
  slider.value = '100'; slider.dispatchEvent(new Event('input'));
  assert.equal(comparison.style['--split'], '100%');
  assert.equal(slider.attributes['aria-valuetext'], '100% studio backdrop visible');
  slider.value = '-10'; slider.dispatchEvent(new Event('input'));
  assert.equal(comparison.style['--split'], '0%');
  slider.value = 'invalid'; slider.dispatchEvent(new Event('input'));
  assert.equal(comparison.style['--split'], '50%');
});
test('use-case cards open their actual content and close returns keyboard focus', () => {
  const { elements, cards } = fixture();
  cards[4].dispatchEvent(new Event('click'));
  assert.equal(elements['use-case-detail'].hidden, false);
  assert.match(elements['use-case-copy'].textContent, /does not currently offer a public API/);
  assert.equal(cards[4].attributes['aria-expanded'], 'true');
  elements['close-use-case'].dispatchEvent(new Event('click'));
  assert.equal(elements['use-case-detail'].hidden, true);
  assert.equal(cards[4].attributes['aria-expanded'], 'false');
  assert.equal(cards[4].focused, true);
});

test('original artwork is not reused across sections and borrowed media is absent', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('examples/'), false);
  assert.equal(html.includes('<video'), false);
  const comparison = new Set(['products', 'people', 'animals', 'cars', 'graphics'].map(category => `%BASE_URL%artwork/${category}.png`));
  const outsideComparison = html.replace(/<div id="quality-panel"[\s\S]*?<\/section>/, '');
  const outsideImages = [...outsideComparison.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(outsideImages).size, outsideImages.length, 'A display image was repeated in another section');
  for (const path of outsideImages) assert.equal(comparison.has(path), false, 'Comparison artwork must not reappear in other sections');
  const paths = [...new Set([...outsideImages, ...comparison])];
  assert.equal(paths.length, 9, 'The nine original artwork assets must all be represented');
  const hashes = paths.map(path => createHash('sha256').update(readFileSync(new URL(`../public/${path.replace('%BASE_URL%', '')}`, import.meta.url))).digest('hex'));
  assert.equal(new Set(hashes).size, hashes.length, 'The same image was copied to a different filename');
});
