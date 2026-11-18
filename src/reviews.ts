import { getGoogleAuthToken, signInWithGoogle, watchGoogleAuth, type GoogleUser } from './firebase-auth.ts';

const configuredApiBase = (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_PAYMENT_API_BASE_URL || '').replace(/\/$/, '');

type RequestOptions = { method?: string; body?: object; token?: string };
type PublicReview = { id: string; display_name: string; rating: number; body: string; published_at: number };
type SavedReview = Pick<PublicReview, 'id' | 'display_name' | 'rating' | 'body'> & { status: string };

async function request<Result>(apiBase: string, path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<Result> {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Reviews could not be loaded.');
  return result as Result;
}

export function renderApprovedReviews(list: HTMLElement, reviews: readonly PublicReview[], doc = document) {
  list.replaceChildren();
  for (const review of reviews) {
    const card = doc.createElement('li');
    card.className = 'review-card';
    const head = doc.createElement('div');
    head.className = 'review-card-head';
    const name = doc.createElement('strong');
    name.textContent = review.display_name;
    const stars = doc.createElement('span');
    stars.className = 'review-stars';
    stars.setAttribute('aria-label', `${review.rating} out of 5 stars`);
    stars.textContent = `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}`;
    head.append(name, stars);
    const copy = doc.createElement('p');
    copy.textContent = review.body;
    const time = doc.createElement('time');
    const date = new Date(review.published_at * 1000);
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    card.append(head, copy, time);
    list.append(card);
  }
}

export function initReviews(section: Element | null, { apiBase = configuredApiBase, doc = document } = {}) {
  if (!section) return;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => section.querySelector<T>(`#${id}`)!;
  const list = get('reviews-list'), summary = get('reviews-summary'), empty = get('reviews-empty');
  const form = get<HTMLFormElement>('review-form'), name = get<HTMLInputElement>('review-name'), body = get<HTMLTextAreaElement>('review-body');
  const count = get('review-count'), status = get('review-status'), signIn = get<HTMLButtonElement>('review-signin');
  const submit = get<HTMLButtonElement>('review-submit'), remove = get<HTMLButtonElement>('review-delete');
  const admin = get('review-admin'), adminList = get('review-admin-list');
  const adminRefresh = get('review-admin-refresh'), adminStatus = get('review-admin-status');
  let currentUser: GoogleUser | null = null, mine: SavedReview | null = null, authRevision = 0;

  const setStatus = (message: string) => { status.textContent = message; };
  const setFormEnabled = (enabled: boolean) => {
    for (const control of form.elements) {
      if (control === signIn) continue;
      if ('disabled' in control) control.disabled = !enabled;
    }
  };
  const updateCounter = () => { count.textContent = `${body.value.length} / 1000`; };
  body.addEventListener('input', updateCounter);
  updateCounter();

  if (!apiBase) {
    setFormEnabled(false);
    signIn.hidden = true;
    summary.textContent = 'Public reviews are being prepared.';
    setStatus('Review submission is not available yet. You can still send private feedback by email.');
    return;
  }

  async function loadPublic() {
    try {
      const result = await request<{ reviews: PublicReview[]; count: number; average: number | null }>(apiBase, '/api/reviews');
      const reviews = Array.isArray(result.reviews) ? result.reviews : [];
      renderApprovedReviews(list, reviews, doc);
      empty.hidden = reviews.length > 0;
      if (result.count > 0) summary.textContent = `${Number(result.average).toFixed(1)} out of 5 · ${result.count} ${result.count === 1 ? 'review' : 'reviews'}`;
      else summary.textContent = 'No published reviews yet. Be the first to share a genuine experience.';
    } catch {
      summary.textContent = 'Published reviews are temporarily unavailable.';
      empty.hidden = true;
    }
  }

  function fillMine(review: SavedReview | null) {
    mine = review || null;
    if (!review) {
      form.reset();
      updateCounter();
      remove.hidden = true;
      submit.textContent = 'Submit review';
      setStatus('Your review will be published immediately.');
      return;
    }
    name.value = review.display_name;
    body.value = review.body;
    const rating = form.querySelector<HTMLInputElement>(`input[name="rating"][value="${review.rating}"]`);
    if (rating) rating.checked = true;
    updateCounter();
    remove.hidden = false;
    submit.textContent = review.status === 'approved' ? 'Update published review' : 'Publish review';
    setStatus(review.status === 'approved'
      ? 'This review is published. Saved edits appear immediately.'
      : review.status === 'rejected'
        ? 'This review was removed by moderation. A genuine edit can be published again.'
        : 'Your review is awaiting moderation.');
  }

  async function loadMine(revision: number) {
    try {
      const token = await getGoogleAuthToken();
      const result = await request<{ review: SavedReview | null; is_admin: boolean }>(apiBase, '/api/reviews/mine', { token });
      if (revision === authRevision) {
        fillMine(result.review);
        admin.hidden = !result.is_admin;
        if (result.is_admin) await loadAdminQueue();
      }
    } catch {
      if (revision === authRevision) setStatus('Your saved review could not be loaded. Refresh and try again.');
    }
  }

  async function loadAdminQueue() {
    if (!currentUser || admin.hidden) return;
    adminStatus.textContent = 'Loading pending reviews…';
    try {
      const token = await getGoogleAuthToken();
      const result = await request<{ reviews: SavedReview[] }>(apiBase, '/api/admin/reviews?status=pending', { token });
      adminList.replaceChildren();
      for (const review of result.reviews || []) {
        const item = doc.createElement('li');
        const heading = doc.createElement('strong');
        heading.textContent = `${review.display_name} · ${review.rating}/5`;
        const copy = doc.createElement('p');
        copy.textContent = review.body;
        const reason = doc.createElement('input');
        reason.type = 'text';
        reason.maxLength = 300;
        reason.placeholder = 'Optional moderation note';
        reason.setAttribute('aria-label', `Moderation note for ${review.display_name}`);
        const actions = doc.createElement('div');
        actions.className = 'review-admin-actions';
        for (const [action, label] of [['approve', 'Approve'], ['reject', 'Reject']]) {
          const button = doc.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.addEventListener('click', async () => {
            button.disabled = true;
            adminStatus.textContent = `${label} review…`;
            try {
              await request(apiBase, '/api/admin/reviews/moderate', { method: 'POST', token: await getGoogleAuthToken(), body: {
                review_id: review.id, action, reason: reason.value.trim()
              } });
              await Promise.all([loadAdminQueue(), loadPublic()]);
            } catch (error) { adminStatus.textContent = error instanceof Error ? error.message : 'Reviews could not be loaded.'; }
            finally { button.disabled = false; }
          });
          actions.append(button);
        }
        item.append(heading, copy, reason, actions);
        adminList.append(item);
      }
      adminStatus.textContent = result.reviews?.length ? `${result.reviews.length} pending review${result.reviews.length === 1 ? '' : 's'}.` : 'No reviews are waiting for moderation.';
    } catch (error) { adminStatus.textContent = error instanceof Error ? error.message : 'Reviews could not be loaded.'; }
  }

  setFormEnabled(false);
  watchGoogleAuth(user => {
    currentUser = user;
    const revision = ++authRevision;
    signIn.hidden = Boolean(user);
    signIn.disabled = false;
    setFormEnabled(Boolean(user));
    if (user) loadMine(revision);
    else {
      mine = null;
      form.reset();
      updateCounter();
      remove.hidden = true;
      admin.hidden = true;
      setStatus('Sign in with Google to submit one public review. Reading reviews does not require an account.');
    }
  }, () => setStatus('Google sign-in could not be loaded. You can still read published reviews.')).catch(() => {});

  signIn.addEventListener('click', async () => {
    signIn.disabled = true;
    setStatus('Opening Google sign-in…');
    try { await signInWithGoogle(); }
    catch { setStatus('Sign-in was not completed. Please try again.'); }
    finally { signIn.disabled = false; }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentUser) return;
    const data = new FormData(form);
    submit.disabled = true;
    remove.disabled = true;
    setStatus('Submitting your review…');
    try {
      const token = await getGoogleAuthToken();
      await request(apiBase, '/api/reviews', { method: 'POST', token, body: {
        display_name: name.value.trim(), rating: Number(data.get('rating')), body: body.value.trim()
      } });
      await loadMine(authRevision);
      setStatus('Thank you. Your review is published.');
      await loadPublic();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Reviews could not be loaded.'); }
    finally { submit.disabled = false; remove.disabled = false; }
  });

  adminRefresh.addEventListener('click', loadAdminQueue);

  remove.addEventListener('click', async () => {
    if (!currentUser || !mine || !window.confirm('Delete your saved review? This cannot be undone.')) return;
    remove.disabled = true;
    submit.disabled = true;
    setStatus('Deleting your review…');
    try {
      await request(apiBase, '/api/reviews/delete', { method: 'POST', token: await getGoogleAuthToken(), body: {} });
      fillMine(null);
      setStatus('Your review was deleted.');
      await loadPublic();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Reviews could not be loaded.'); }
    finally { remove.disabled = false; submit.disabled = false; }
  });

  loadPublic();
}
