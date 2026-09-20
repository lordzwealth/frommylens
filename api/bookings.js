// POST /api/bookings
// Body: { shoot_date, name, package, email, phone, message }
// Inserts a new pending booking request. Contact details never
// touch the browser again after this — they live only in Neon,
// read from the SQL editor or a future admin view.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shoot_date, name, package: pkg, email, phone, message } = req.body || {};

  if (!shoot_date || !name || !pkg || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await sql`
      insert into bookings (shoot_date, name, package, email, phone, message, status)
      values (${shoot_date}, ${name}, ${pkg}, ${email}, ${phone}, ${message || null}, 'pending')
    `;
    res.status(200).json({ ok: true });
  } catch (err) {
    // unique_violation — the active-booking-per-date index already caught this date
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That date was just taken — please pick another.' });
    }
    console.error('booking insert error:', err);
    res.status(500).json({ error: 'Could not save booking' });
  }
}
