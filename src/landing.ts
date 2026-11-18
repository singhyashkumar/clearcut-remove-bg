import useCases from './use-cases.json' with { type: 'json' };

export function initLanding(doc: Document) {
  const tabs = [...doc.querySelectorAll<HTMLButtonElement>('[data-example]')];
  const before = doc.getElementById('quality-before') as HTMLImageElement;
  const after = doc.getElementById('quality-after') as HTMLImageElement;
  const slider = doc.getElementById('quality-slider') as HTMLInputElement;
  const panel = doc.getElementById('quality-panel')!;
  const comparison = doc.querySelector<HTMLElement>('.quality-comparison')!;
  const backdrops: Record<string, string> = { products: '#dce8d8', people: '#e9e2d8', animals: '#d8e4db', cars: '#dce4ea', graphics: '#efe0d9' };
  const categories = new Set(Object.keys(backdrops));
  const ImageClass = doc.defaultView?.Image;
  const previews = new Map<string, Promise<HTMLImageElement>>();
  let selection = 0;
  const previewUrl = (category: string) => `${import.meta.env.BASE_URL}artwork/gallery/${category}.webp`;
  function warmPreview(category: string | undefined) {
    if (!ImageClass || !category) return null;
    if (previews.has(category)) return previews.get(category);
    const image = new ImageClass();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    const ready = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = async () => {
        try { await image.decode?.(); } catch { /* Loaded image can still render. */ }
        resolve(image);
      };
      image.onerror = () => { previews.delete(category); reject(new Error('Preview unavailable')); };
    });
    previews.set(category, ready);
    image.src = previewUrl(category);
    return ready;
  }
  function updateSlider() {
    const value = Number(slider.value);
    const split = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
    comparison.style.setProperty('--split', `${split}%`);
    slider.setAttribute('aria-valuetext', `${split}% studio backdrop visible`);
  }

  async function selectTab(tab: HTMLButtonElement) {
    const category = tab.dataset.example;
    if (!category || !categories.has(category)) return;
    const ticket = ++selection;
    const ready = warmPreview(category);
    if (ready) {
      panel.setAttribute('aria-busy', 'true');
      try { await ready; } catch {
        if (ticket === selection) panel.setAttribute('aria-busy', 'false');
        return; // Keep the previous pair visible on a failed download.
      }
      if (ticket !== selection) return;
    }
    panel.setAttribute('aria-busy', 'false');
    for (const item of tabs) {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    }
    comparison.style.setProperty('--preview-background', backdrops[category]);
    before.loading = after.loading = 'eager';
    before.src = previewUrl(category);
    after.src = previewUrl(category);
    before.alt = `Original ${category} Clearcutt artwork on a studio backdrop`;
    after.alt = `Original ${category} Clearcutt artwork on transparency`;
    panel.setAttribute('aria-labelledby', tab.id);
    slider.value = '50';
    updateSlider();
  }

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => selectTab(tab));
    const anticipateSelection = () => warmPreview(tab.dataset.example)?.catch(() => {});
    tab.addEventListener('pointerenter', anticipateSelection, { once: true });
    tab.addEventListener('focus', anticipateSelection, { once: true });
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next]);
      tabs[next].focus();
    });
  }
  slider.addEventListener('input', updateSlider);

  const cards = [...doc.querySelectorAll<HTMLButtonElement>('[data-use-case]')];
  const detail = doc.getElementById('use-case-detail')!;
  const title = doc.getElementById('use-case-title')!;
  const copy = doc.getElementById('use-case-copy')!;
  let activeCard: HTMLButtonElement | undefined;
  title.tabIndex = -1;
  for (const card of cards) {
    card.setAttribute('aria-expanded', 'false');
    card.addEventListener('click', () => {
      const item = useCases[Number(card.dataset.useCase)];
      if (!item) return;
      activeCard = card;
      for (const other of cards) other.setAttribute('aria-expanded', String(other === card));
      title.textContent = item.title;
      copy.textContent = item.copy;
      detail.hidden = false;
      title.focus({ preventScroll: true });
      detail.scrollIntoView({ block: 'nearest' });
    });
  }
  doc.getElementById('close-use-case')!.addEventListener('click', () => {
    detail.hidden = true;
    activeCard?.setAttribute('aria-expanded', 'false');
    activeCard?.focus();
  });
}

export function initFinishPreview(preview: HTMLElement | null) {
  if (!preview) return;
  const backgrounds: Record<string, string> = { transparent: 'transparent', white: '#ffffff', sage: '#e4eddf', blush: '#f6e4dd' };
  const buttons = [...preview.querySelectorAll<HTMLButtonElement>('[data-finish-color]')];
  const status = preview.querySelector('.finish-status')!;
  for (const button of buttons) button.addEventListener('click', () => {
    const name = button.dataset.finishColor;
    if (!name || !Object.hasOwn(backgrounds, name)) return;
    preview.dataset.finish = name;
    preview.style.setProperty('--finish-background', backgrounds[name]);
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
    status.textContent = button.getAttribute('aria-label');
  });
}

export function initMobileMenu(menu: HTMLDetailsElement | null) {
  if (!menu) return;
  for (const link of menu.querySelectorAll('a')) link.addEventListener('click', () => { menu.open = false; });
  menu.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    menu.querySelector('summary')!.focus();
  });
}

export function initHeroAnimation(image: HTMLImageElement, motion: MediaQueryList, preference: HTMLInputElement | null, storage?: Storage) {
  if (!image) return;
  image.onerror = () => {
    if (image.getAttribute('src') === image.dataset.animationSrc) image.src = image.dataset.posterSrc!;
  };
  let saved: string | null | undefined = null;
  try { saved = storage?.getItem('clearcut-hero-motion'); } catch {}
  const update = () => {
    const animate = saved === 'on' || (saved !== 'off' && !motion.matches);
    if (preference) preference.checked = animate;
    image.src = (animate ? image.dataset.animationSrc : image.dataset.posterSrc)!;
  };
  preference?.addEventListener('change', () => {
    saved = preference.checked ? 'on' : 'off';
    try { storage?.setItem('clearcut-hero-motion', saved); } catch {}
    update();
  });
  motion.addEventListener('change', update);
  update();
}

if (typeof document !== 'undefined') {
  import('./reviews.ts').then(({ initReviews }) => initReviews(document.querySelector('#reviews'))).catch(() => {});
  initLanding(document);
  initFinishPreview(document.querySelector<HTMLElement>('.finish-preview'));
  initMobileMenu(document.querySelector<HTMLDetailsElement>('.mobile-menu'));
  let storage;
  try { storage = window.localStorage; } catch {}
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const preference = document.querySelector<HTMLInputElement>('#hero-motion');
  for (const image of document.querySelectorAll<HTMLImageElement>('[data-animation-src]')) initHeroAnimation(image, motion, preference, storage);
}

