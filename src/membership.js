export function renderMembership(doc, user, entitlement, mode = 'live', now = Date.now()) {
  const get = id => doc.getElementById(id);
  const active = Boolean(user && entitlement?.plan_id === 'plus-monthly' && entitlement.expires_at * 1000 > now);
  get('account-email').textContent = user?.email || '';
  get('account-email').title = user?.email || '';
  get('membership-badge').hidden = !active;
  get('membership-summary').hidden = !active;
  get('membership-email').textContent = active ? user.email || 'Your Google account' : '';
  const expiry = active ? new Date(entitlement.expires_at * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  get('membership-expiry').textContent = active ? `Active until ${expiry}. One-time payment; no automatic renewal.` : '';
  get('razorpay-checkout').textContent = active ? 'Extend Plus · ₹90 for 30 days' : mode === 'live' ? 'Pay ₹90 with Razorpay' : 'Try ₹90 sandbox checkout';
  get('payment-status').textContent = active ? 'Your Clearcut Plus membership is active and saved to this Google account.' : '';
  return active;
}
