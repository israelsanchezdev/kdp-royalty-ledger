import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_ID = 'price_1TV2POA1yezEO1P1RtyacW5F'; // KDP Tracker $5/month
const SUPABASE_URL = 'https://oieyaymfflvznviyeprc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, email, return_url } = req.body;

  if (!user_id || !email) {
    return res.status(400).json({ error: 'Missing user_id or email' });
  }

  try {
    // Check if user already has a Stripe customer ID
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/kdp_subscribers?user_id=eq.${user_id}&select=stripe_customer_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      }
    );
    const [sub] = await sbRes.json();
    let customerId = sub?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { user_id } });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      mode: 'subscription',
      success_url: `${return_url}/app.html?subscribed=true`,
      cancel_url: `${return_url}/app.html`,
      subscription_data: {
        metadata: { user_id }
      },
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
}
