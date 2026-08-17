/* ═══════════════════════════════════════════════════════════════════
   POST /api/create-checkout-session

   Creates a Stripe Checkout Session and returns { url } for the browser to
   redirect to. This exists because a Stripe secret key can never be shipped
   to a browser — the static site holds no key and quotes no price.

   Deploy on any Node serverless host (Vercel: this path works as-is;
   Netlify/Cloudflare: see README for the wrapper). Requires:

     STRIPE_SECRET_KEY   sk_live_… or sk_test_…
     SITE_URL            https://your-domain.example  (for the return links)
   ═══════════════════════════════════════════════════════════════════ */

const Stripe = require('stripe');

/* The only prices that exist. The browser sends a fit key and a quantity;
   what that costs is decided here and nowhere else, so a tampered client
   cannot buy a $19.99 case for a penny. */
const CATALOGUE = {
  pods12: { name: 'AirPods 1 & 2',     amount: 1599 },
  pro12:  { name: 'AirPods Pro 1 & 2', amount: 1999 },
  pods3:  { name: 'AirPods 3',         amount: 1699 },
  pods4:  { name: 'AirPods 4',         amount: 1799 },
};

const COLOURS = {
  'forest-green':  'Forest Green',
  'amber-red':     'Amber Red',
  'midnight-blue': 'Midnight Blue',
};

const CURRENCY           = 'usd';
const FREE_SHIPPING_OVER = 2500;   /* cents — matches the storefront copy */
const SHIPPING_FLAT      = 399;
const MAX_QTY            = 10;

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 1e5) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(new Error('Malformed JSON')); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'Stripe is not configured on the server' });

  let body;
  try { body = await readBody(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0)  return res.status(400).json({ error: 'Your bag is empty' });
  if (items.length > 20)   return res.status(400).json({ error: 'Too many lines in one order' });

  const line_items = [];
  let subtotal = 0;

  for (const item of items) {
    const product = CATALOGUE[item && item.fit];
    const colour  = COLOURS[item && item.colour];
    if (!product) return res.status(400).json({ error: `Unknown fit: ${item && item.fit}` });
    if (!colour)  return res.status(400).json({ error: `Unknown colourway: ${item && item.colour}` });

    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return res.status(400).json({ error: `Quantity must be a whole number from 1 to ${MAX_QTY}` });
    }

    subtotal += product.amount * qty;
    line_items.push({
      quantity: qty,
      price_data: {
        currency: CURRENCY,
        unit_amount: product.amount,
        product_data: {
          name: `NovaCase NC·01 — ${colour}`,
          description: `${product.name} · quicksand glow shell`,
        },
      },
    });
  }

  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
  const site     = (process.env.SITE_URL || '').replace(/\/$/, '');

  try {
    const stripe  = Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: typeof body.email === 'string' && body.email.includes('@') ? body.email : undefined,
      success_url: `${site}/?order=confirmed&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${site}/#checkout`,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'IE', 'AU', 'NZ'] },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: shipping === 0 ? 'Free shipping' : 'Standard shipping',
          fixed_amount: { amount: shipping, currency: CURRENCY },
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 2 },
            maximum: { unit: 'business_day', value: 5 },
          },
        },
      }],
      automatic_tax: { enabled: false },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    /* Never leak Stripe internals to the browser; log them for yourself. */
    console.error('[stripe] session create failed:', err);
    return res.status(502).json({ error: 'Could not start checkout. Please try again.' });
  }
};
