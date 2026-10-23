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
  assert.equal(elements['quality-before'].src, '/test-base/examples/people-before.png');
  assert.equal(elements['quality-after'].src, '/test-base/examples/people-after.png');
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
  assert.equal(slider.attributes['aria-valuetext'], '100% original photo visible');
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

test('landing sections use distinct image sets without duplicate files', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(images).size, images.length, 'An image was repeated in another section');
  const comparison = new Set(['products', 'people', 'animals', 'cars', 'graphics'].flatMap(category => ['before', 'after'].map(kind => `%BASE_URL%examples/${category}-${kind}.png`)));
  const outsideComparison = html.replace(/<div id="quality-panel"[\s\S]*?<\/section>/, '');
  for (const match of outsideComparison.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    assert.equal(comparison.has(match[1]), false, 'Comparison samples must not reappear in other sections');
  }
  const assets = [...new Set([...images, ...comparison])];
  const hashes = assets.map(path => createHash('sha256').update(readFileSync(new URL(`../public/${path.replace('%BASE_URL%', '')}`, import.meta.url))).digest('hex'));
  assert.equal(new Set(hashes).size, hashes.length, 'The same image was copied to a different filename');
});
