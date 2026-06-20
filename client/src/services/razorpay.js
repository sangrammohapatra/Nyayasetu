/**
 * client/src/services/razorpay.js
 *
 * Utility functions for loading the Razorpay Checkout script and opening
 * the payment modal.
 *
 * Usage example:
 *
 *   import { openCheckout } from '../services/razorpay';
 *
 *   await openCheckout({
 *     orderId: 'order_xxx',
 *     amount: 9900,
 *     currency: 'INR',
 *     name: 'NyayaSetu',
 *     description: 'Basic Plan — Monthly',
 *     prefill: { name: user.name, contact: user.phone, email: user.email },
 *     onSuccess: ({ razorpay_payment_id, razorpay_order_id, razorpay_signature }) => { ... },
 *     onDismiss: (error) => { ... },
 *   });
 */

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

let scriptLoadPromise = null;

/**
 * Dynamically inject the Razorpay checkout.js script exactly once.
 * Returns a promise that resolves when window.Razorpay is available.
 *
 * @returns {Promise<boolean>}
 */
export function loadRazorpay() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    // Avoid double-inject if script tag already exists
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => reject(new Error('Razorpay script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      scriptLoadPromise = null; // allow retry
      reject(new Error('Failed to load Razorpay checkout script'));
    };
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Open the Razorpay payment modal.
 *
 * @param {object}   opts
 * @param {string}   opts.orderId      Razorpay order_id from backend
 * @param {number}   opts.amount       Amount in paise
 * @param {string}   [opts.currency]   Default 'INR'
 * @param {string}   [opts.name]       Merchant name shown in modal
 * @param {string}   [opts.description] Shown below name
 * @param {string}   [opts.image]      Merchant logo URL
 * @param {object}   [opts.prefill]    { name, contact, email }
 * @param {Function} opts.onSuccess    Called with Razorpay response on success
 * @param {Function} [opts.onDismiss]  Called when user closes modal or payment fails
 * @returns {Promise<void>}
 */
export async function openCheckout({
  orderId,
  amount,
  currency = 'INR',
  name = 'NyayaSetu',
  description = 'Legal document service',
  image,
  prefill = {},
  key,        // optional: server-provided key_id (preferred over build-time env var)
  onSuccess,
  onDismiss,
}) {
  if (!orderId) throw new Error('orderId is required to open Razorpay checkout');

  const loaded = await loadRazorpay();
  if (!loaded || !window.Razorpay) {
    const err = new Error('Razorpay could not be loaded. Please check your internet connection.');
    if (onDismiss) onDismiss(err);
    throw err;
  }

  // Prefer key from server response so key rotation works without a redeploy.
  const keyId = key || RAZORPAY_KEY_ID;
  if (!keyId) {
    console.warn('[razorpay.js] No Razorpay key available — checkout will fail. Set VITE_RAZORPAY_KEY_ID or pass key from server.');
  }

  // Read the primary theme colour from CSS custom properties so the modal
  // matches the active NyayaSetu theme.
  const themeColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary')
      .trim() || '#1565C0';

  const options = {
    key: keyId,
    amount,
    currency,
    name,
    description,
    order_id: orderId,
    ...(image ? { image } : {}),
    prefill: {
      name: prefill.name || '',
      contact: prefill.contact || prefill.phone || '',
      email: prefill.email || '',
    },
    theme: {
      color: themeColor,
      hide_topbar: false,
    },
    modal: {
      // Don't escape on backdrop click — user must explicitly close
      backdropclose: false,
      escape: true,
      handleback: true,
      confirm_close: true,
      ondismiss: () => {
        if (onDismiss) onDismiss(null);
      },
    },
    handler: (response) => {
      // response: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      if (onSuccess) onSuccess(response);
    },
    // Surface payment failures to the caller
    'payment.failed': (response) => {
      const err = new Error(
        response.error?.description || response.error?.reason || 'Payment failed'
      );
      err.razorpayError = response.error;
      if (onDismiss) onDismiss(err);
    },
  };

  const rzp = new window.Razorpay(options);

  rzp.on('payment.failed', (response) => {
    const err = new Error(
      response.error?.description || response.error?.reason || 'Payment failed'
    );
    err.razorpayError = response.error;
    if (onDismiss) onDismiss(err);
  });

  rzp.open();
}

/**
 * Convenience: open checkout and return a Promise that resolves with the
 * Razorpay success response or rejects on failure / dismissal.
 */
export function openCheckoutAsync(opts) {
  return new Promise((resolve, reject) => {
    openCheckout({
      ...opts,
      onSuccess: resolve,
      onDismiss: (err) => reject(err || new Error('Payment dismissed')),
    });
  });
}
