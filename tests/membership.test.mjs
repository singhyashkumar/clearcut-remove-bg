import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMembership } from '../src/membership.js';

const now = Date.now();
const user = { uid: 'paid-user', email: 'member@example.com' };
const paid = { plan_id: 'plus-monthly', expires_at: Math.floor(now / 1000) + 86400 };
function fixture() {
  const elements = Object.fromEntries(['account-email', 'membership-badge', 'membership-summary', 'membership-email', 'membership-expiry', 'razorpay-checkout', 'payment-status'].map(id => [id, {}]));
  return { elements, getElementById: id => elements[id] };
}

test('verified paid access shows Plus, email, expiry and explicit renewal action', () => {
  const doc = fixture();
  assert.equal(renderMembership(doc, user, paid, 'live', now), true);
  assert.equal(doc.elements['membership-badge'].hidden, false);
  assert.equal(doc.elements['membership-email'].textContent, user.email);
  assert.match(doc.elements['membership-expiry'].textContent, /Active until.*no automatic renewal/);
  assert.match(doc.elements['razorpay-checkout'].textContent, /Extend Plus/);
});

test('sign-out or account switch clears previous membership and reload restores from server', () => {
  const doc = fixture();
  renderMembership(doc, user, paid, 'live', now);
  renderMembership(doc, null, null, 'live', now);
  assert.equal(doc.elements['membership-badge'].hidden, true);
  assert.equal(doc.elements['membership-email'].textContent, '');
  assert.equal(doc.elements['payment-status'].textContent, '');
  renderMembership(doc, { uid: 'other', email: 'other@example.com' }, null, 'live', now);
  assert.equal(doc.elements['membership-summary'].hidden, true);
  assert.equal(doc.elements['account-email'].textContent, 'other@example.com');
  assert.equal(renderMembership(fixture(), user, paid, 'live', now), true);
});

test('expired access is never shown as Plus', () => {
  const doc = fixture();
  assert.equal(renderMembership(doc, user, { ...paid, expires_at: Math.floor(now / 1000) - 1 }, 'live', now), false);
  assert.equal(doc.elements['membership-badge'].hidden, true);
  assert.match(doc.elements['razorpay-checkout'].textContent, /^Pay ₹90/);
});
