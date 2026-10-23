import useCases from './use-cases.json' with { type: 'json' };

export function initLanding(doc) {
  const tabs = [...doc.querySelectorAll('[data-example]')];
  const before = doc.getElementById('quality-before');
  const after = doc.getElementById('quality-after');
  const slider = doc.getElementById('quality-slider');
  const panel = doc.getElementById('quality-panel');
  const comparison = doc.querySelector('.quality-comparison');
  const backdrops = { products: '#dce8d8', people: '#e9e2d8', animals: '#d8e4db', cars: '#dce4ea', graphics: '#efe0d9' };
  const categories = new Set(Object.keys(backdrops));

  function updateSlider() {
    const value = Number(slider.value);
    const split = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
    comparison.style.setProperty('--split', `${split}%`);
    slider.setAttribute('aria-valuetext', `${split}% studio backdrop visible`);
  }

  function selectTab(tab) {
    const category = tab.dataset.example;
    if (!categories.has(category)) return;
    for (const item of tabs) {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    }
    comparison.style.setProperty('--preview-background', backdrops[category]);
    before.src = `${import.meta.env.BASE_URL}artwork/${category}.png`;
    after.src = `${import.meta.env.BASE_URL}artwork/${category}.png`;
    before.alt = `Original ${category} Clearcut artwork on a studio backdrop`;
    after.alt = `Original ${category} Clearcut artwork on transparency`;
    panel.setAttribute('aria-labelledby', tab.id);
    slider.value = '50';
    updateSlider();
  }

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => selectTab(tab));
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

  const cards = [...doc.querySelectorAll('[data-use-case]')];
  const detail = doc.getElementById('use-case-detail');
  const title = doc.getElementById('use-case-title');
  const copy = doc.getElementById('use-case-copy');
  let activeCard;
  title.tabIndex = -1;
  for (const card of cards) {
    card.setAttribute('aria-expanded', 'false');
    card.addEventListener('click', () => {
      const item = useCases[card.dataset.useCase];
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
  doc.getElementById('close-use-case').addEventListener('click', () => {
    detail.hidden = true;
    activeCard?.setAttribute('aria-expanded', 'false');
    activeCard?.focus();
  });
}

export function initHeroVideo(video, motion, preference, storage) {
  if (!video) return;
  let saved = null;
  try { saved = storage?.getItem('clearcut-hero-motion'); } catch {}
  const update = () => {
    const animate = saved === 'on' || (saved !== 'off' && !motion.matches);
    if (preference) preference.checked = animate;
    if (animate) { video.muted = true; video.play().catch(() => {}); }
    else { video.pause(); video.currentTime = 0; }
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
  initLanding(document);
  let storage;
  try { storage = window.localStorage; } catch {}
  initHeroVideo(document.getElementById('hero-video'), window.matchMedia('(prefers-reduced-motion: reduce)'), document.getElementById('hero-motion'), storage);
}
