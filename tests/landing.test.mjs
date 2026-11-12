import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Use the production module, substituting only Vite's build-time base URL.
const source = readFileSync(new URL('../src/landing.js', import.meta.url), 'utf8')
  .replace("import useCases from './use-cases.json' with { type: 'json' };", `const useCases = ${readFileSync(new URL('../src/use-cases.json', import.meta.url), 'utf8')};`)
  .replaceAll('import.meta.env.BASE_URL', "'/test-base/'");
const { initLanding, initHeroVideo, initHeroAnimation, initMobileMenu, initFinishPreview } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

class Element extends EventTarget {
  constructor(id, dataset = {}) {
    super(); this.id = id; this.dataset = dataset; this.attributes = {};
    this.style = { setProperty: (key, value) => { this.style[key] = value; } };
    this.value = '50'; this.hidden = true;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
}
test('finish preview changes only its background, updates selection and rejects unknown colours', () => {
  const preview = new Element('preview'), status = new Element('status');
  const buttons = ['transparent', 'white', 'sage', 'blush'].map(name => {
    const button = new Element(name, { finishColor: name });
    button.setAttribute('aria-label', `${name} background`);
    return button;
  });
  preview.querySelectorAll = () => buttons;
  preview.querySelector = () => status;
  initFinishPreview(preview);
  buttons[2].dispatchEvent(new Event('click'));
  assert.equal(preview.style['--finish-background'], '#e4eddf');
  assert.equal(preview.dataset.finish, 'sage');
  assert.equal(status.textContent, 'sage background');
  assert.deepEqual(buttons.map(button => button.getAttribute('aria-pressed')), ['false', 'false', 'true', 'false']);
  buttons[0].dispatchEvent(new Event('click'));
  assert.equal(preview.style['--finish-background'], 'transparent');
  assert.equal(preview.dataset.finish, 'transparent');
  buttons[1].dataset.finishColor = 'unknown';
  buttons[1].dispatchEvent(new Event('click'));
  assert.equal(preview.dataset.finish, 'transparent');
});

test('mobile menu closes on navigation and Escape restores focus to its summary', () => {
  const menu = new Element('menu'), link = new Element('link'), summary = new Element('summary');
  menu.querySelectorAll = () => [link];
  menu.querySelector = () => summary;
  initMobileMenu(menu);
  menu.open = true;
  link.dispatchEvent(new Event('click'));
  assert.equal(menu.open, false);
  menu.open = true;
  const escape = new Event('keydown'); escape.key = 'Escape';
  menu.dispatchEvent(escape);
  assert.equal(menu.open, false);
  assert.equal(summary.focused, true);
});
function fixture(ImageClass) {
  const ids = ['quality-before', 'quality-after', 'quality-slider', 'quality-panel', 'use-case-detail', 'use-case-title', 'use-case-copy', 'close-use-case'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const tabs = ['products', 'people', 'animals', 'cars', 'graphics'].map(key => new Element(`quality-tab-${key}`, { example: key }));
  const cards = Array.from({ length: 9 }, (_, i) => new Element(`card-${i}`, { useCase: String(i) }));
  const comparison = new Element('comparison');
  initLanding({ defaultView: { Image: ImageClass }, getElementById: id => elements[id], querySelector: () => comparison, querySelectorAll: selector => selector === '[data-example]' ? tabs : cards });
  return { elements, tabs, cards, comparison };
}
test('category selection changes both comparison images and keyboard selection wraps', () => {
  const { elements, tabs } = fixture();
  tabs[1].dispatchEvent(new Event('click'));
  assert.equal(elements['quality-before'].src, '/test-base/artwork/gallery/people.webp');
  assert.equal(elements['quality-after'].src, '/test-base/artwork/gallery/people.webp');
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
  assert.match(html, /<video id="hero-animation" autoplay muted loop playsinline/);
  assert.ok(html.includes('src="%BASE_URL%artwork/hero-demo.mp4"'));
  const comparison = new Set(['products', 'people', 'animals', 'cars', 'graphics'].map(category => `%BASE_URL%artwork/gallery/${category}.webp`));
  const outsideComparison = html.replace(/<div id="quality-panel"[\s\S]*?<\/section>/, '');
  const outsideImages = [...outsideComparison.matchAll(/<img[^>]+src="([^"]+)"/g), ...outsideComparison.matchAll(/<video[^>]+poster="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(outsideImages).size, outsideImages.length, 'A display image was repeated in another section');
  for (const path of outsideImages) assert.equal(comparison.has(path), false, 'Comparison artwork must not reappear in other sections');
  const paths = [...new Set([...outsideImages, ...comparison])];
  assert.equal(paths.length, 10, 'Category artwork, hero, feature and two distinct motion posters must be represented');
  const hashes = paths.map(path => createHash('sha256').update(readFileSync(new URL(`../public/${path.replace('%BASE_URL%', '')}`, import.meta.url))).digest('hex'));
  assert.equal(new Set(hashes).size, hashes.length, 'The same image was copied to a different filename');
});


test('GIF previews animate by default and use still frames for reduced motion', () => {
  const motion = new EventTarget(); motion.matches = false;
  const image = { dataset: { animationSrc: '/hero.gif', posterSrc: '/hero.jpg' } };
  initHeroAnimation(image, motion);
  assert.equal(image.src, '/hero.gif');
  motion.matches = true;
  motion.dispatchEvent(new Event('change'));
  assert.equal(image.src, '/hero.jpg');
});

test('one gallery motion preference controls the GIF previews', () => {
  const motion = new EventTarget(); motion.matches = false;
  const preference = new EventTarget(); preference.checked = true;
  const images = ['hero', 'fern', 'pet'].map(name => ({ dataset: { animationSrc: `/${name}.gif`, posterSrc: `/${name}.jpg` } }));
  for (const image of images) initHeroAnimation(image, motion, preference);
  assert.deepEqual(images.map(image => image.src), ['/hero.gif', '/fern.gif', '/pet.gif']);
  preference.checked = false; preference.dispatchEvent(new Event('change'));
  assert.deepEqual(images.map(image => image.src), ['/hero.jpg', '/fern.jpg', '/pet.jpg']);
  preference.checked = true; preference.dispatchEvent(new Event('change'));
  assert.deepEqual(images.map(image => image.src), ['/hero.gif', '/fern.gif', '/pet.gif']);
});

test('an animation that fails to load falls back to its poster without an error loop', () => {
  const motion = new EventTarget(); motion.matches = false;
  const image = { dataset: { animationSrc: '/loop.gif', posterSrc: '/poster.jpg' }, getAttribute() { return this.src; } };
  initHeroAnimation(image, motion);
  image.onerror();
  assert.equal(image.src, '/poster.jpg');
  image.onerror();
  assert.equal(image.src, '/poster.jpg');
});

test('explicit GIF preference overrides reduced motion and is restored on later visits', () => {
  const motion = new EventTarget(); motion.matches = true;
  const preference = new EventTarget(); preference.checked = false;
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const image = { dataset: { animationSrc: '/hero.gif', posterSrc: '/hero.jpg' } };
  initHeroAnimation(image, motion, preference, storage);
  assert.equal(image.src, '/hero.jpg');
  preference.checked = true;
  preference.dispatchEvent(new Event('change'));
  assert.equal(image.src, '/hero.gif');
  assert.equal(storage.getItem('clearcut-hero-motion'), 'on');
  const restored = { dataset: image.dataset };
  initHeroAnimation(restored, motion, new EventTarget(), storage);
  assert.equal(restored.src, '/hero.gif');
  preference.checked = false;
  preference.dispatchEvent(new Event('change'));
  assert.equal(image.src, '/hero.jpg');
  assert.equal(storage.getItem('clearcut-hero-motion'), 'off');
});



test('gallery warms all categories and stale loads cannot replace the newest selection', async () => {
 const images=[];
 class Preview {constructor(){images.push(this);} async decode(){} }
 const {elements,tabs}=fixture(Preview);
 assert.equal(images.length,5);
 assert.ok(images.every(image=>image.fetchPriority==='low'));
 tabs[1].dispatchEvent(new Event('click'));
 tabs[2].dispatchEvent(new Event('click'));
 await images[1].onload();
 await new Promise(setImmediate);
 assert.equal(elements['quality-before'].src,undefined);
 await images[2].onload();
 await new Promise(setImmediate);
 assert.equal(elements['quality-before'].src,'/test-base/artwork/gallery/animals.webp');
 assert.equal(elements['quality-after'].src,elements['quality-before'].src);
 assert.equal(elements['quality-panel'].attributes['aria-busy'],'false');
 tabs[3].dispatchEvent(new Event('click'));
 images[3].onerror();await new Promise(setImmediate);
 assert.equal(elements['quality-before'].src,'/test-base/artwork/gallery/animals.webp');
 tabs[3].dispatchEvent(new Event('click'));
 assert.equal(images.length,6);
 await images[5].onload();await new Promise(setImmediate);
 assert.equal(elements['quality-before'].src,'/test-base/artwork/gallery/cars.webp');
 tabs[2].dispatchEvent(new Event('click'));await new Promise(setImmediate);
 assert.equal(images.length,6,'decoded previews are reused');
});

test('hero video loops, resumes on return and respects an explicit pause', async () => {
 const video=new EventTarget(),button=new EventTarget(),doc=new EventTarget();
 doc.defaultView=new EventTarget();doc.hidden=false;let plays=0;
 video.paused=true;video.play=()=>{plays++;video.paused=false;return Promise.resolve();};
 video.pause=()=>{video.paused=true;};
 initHeroVideo(video,button,doc);
 assert.equal(plays,1);assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(video.playsInline,true);
 video.currentTime=10;video.dispatchEvent(new Event('ended'));
 assert.equal(video.currentTime,0);assert.equal(plays,2);
 video.pause();doc.dispatchEvent(new Event('visibilitychange'));assert.equal(plays,3);
 button.dispatchEvent(new Event('click'));assert.equal(video.paused,true);
 doc.dispatchEvent(new Event('visibilitychange'));assert.equal(plays,3);
 button.dispatchEvent(new Event('click'));assert.equal(plays,4);
});
test('blocked autoplay exposes a working play action without an unhandled rejection', async () => {
 const video=new EventTarget(),button=new EventTarget(),doc=new EventTarget();
 doc.defaultView=new EventTarget();let allowed=false;
 video.paused=true;video.play=()=>allowed?Promise.resolve():Promise.reject(Error('blocked'));
 video.pause=()=>{};
 initHeroVideo(video,button,doc);await Promise.resolve();
 assert.equal(button.textContent,'Play animation');
 allowed=true;button.dispatchEvent(new Event('click'));
 video.dispatchEvent(new Event('playing'));assert.equal(button.textContent,'Pause animation');
});
