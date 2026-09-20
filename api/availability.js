// GET /api/availability
// Returns the list of dates that are already pending or confirmed,
// so the calendar can grey them out. No personal info is exposed —
// just dates.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await sql`
      select shoot_date from bookings
      where status in ('pending', 'confirmed')
    `;
    res.status(200).json({ dates: rows.map(r => r.shoot_date) });
  } catch (err) {
    console.error('availability error:', err);
    res.status(500).json({ error: 'Could not load availability' });
  }
}
