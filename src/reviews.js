import { getGoogleAuthToken, signInWithGoogle, watchGoogleAuth } from './firebase-auth.js';

const configuredApiBase = (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_PAYMENT_API_BASE_URL || '').replace(/\/$/, '');

async function request(apiBase, path, { method = 'GET', body, token } = {}) {
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
  return result;
}

export function renderApprovedReviews(list, reviews, doc = document) {
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

export function initReviews(section, { apiBase = configuredApiBase, doc = document } = {}) {
  if (!section) return;
  const get = id => section.querySelector(`#${id}`);
  const list = get('reviews-list'), summary = get('reviews-summary'), empty = get('reviews-empty');
  const form = get('review-form'), name = get('review-name'), body = get('review-body');
  const count = get('review-count'), status = get('review-status'), signIn = get('review-signin');
  const submit = get('review-submit'), remove = get('review-delete');
  const admin = get('review-admin'), adminList = get('review-admin-list');
  const adminRefresh = get('review-admin-refresh'), adminStatus = get('review-admin-status');
  let currentUser = null, mine = null, authRevision = 0;

  const setStatus = message => { status.textContent = message; };
  const setFormEnabled = enabled => {
    for (const control of form.elements) {
      if (control === signIn) continue;
      control.disabled = !enabled;
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
      const result = await request(apiBase, '/api/reviews');
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

  function fillMine(review) {
    mine = review || null;
    if (!review) {
      form.reset();
      updateCounter();
      remove.hidden = true;
      submit.textContent = 'Submit review';
      setStatus('Your review will appear publicly only after moderation.');
      return;
    }
    name.value = review.display_name;
    body.value = review.body;
    const rating = form.querySelector(`input[name="rating"][value="${review.rating}"]`);
    if (rating) rating.checked = true;
    updateCounter();
    remove.hidden = false;
    submit.textContent = review.status === 'approved' ? 'Submit edited review' : 'Update review';
    setStatus(review.status === 'approved'
      ? 'This review is published. Editing it sends it back for moderation.'
      : review.status === 'rejected'
        ? 'This review was not published. You can edit and resubmit it.'
        : 'Your review is awaiting moderation.');
  }

  async function loadMine(revision) {
    try {
      const token = await getGoogleAuthToken();
      const result = await request(apiBase, '/api/reviews/mine', { token });
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
      const result = await request(apiBase, '/api/admin/reviews?status=pending', { token });
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
            } catch (error) { adminStatus.textContent = error.message; }
            finally { button.disabled = false; }
          });
          actions.append(button);
        }
        item.append(heading, copy, reason, actions);
        adminList.append(item);
      }
      adminStatus.textContent = result.reviews?.length ? `${result.reviews.length} pending review${result.reviews.length === 1 ? '' : 's'}.` : 'No reviews are waiting for moderation.';
    } catch (error) { adminStatus.textContent = error.message; }
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
      setStatus('Thank you. Your review is saved and awaiting moderation.');
      await loadPublic();
    } catch (error) { setStatus(error.message); }
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
    } catch (error) { setStatus(error.message); }
    finally { remove.disabled = false; submit.disabled = false; }
  });

  loadPublic();
}
