import { createClient } from '@supabase/supabase-js';

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

if (!serviceUrl || !serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE or NEXT_PUBLIC_SUPABASE_URL on server');
}

const supabaseAdmin = createClient(serviceUrl || '', serviceKey || '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    // Identify user from token
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResp?.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const uid = userResp.user.id;

    // Check role in profiles
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();
    if (profErr) throw profErr;
    const role = profile?.role || 'operator';
    if (!['supervisor', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Query breakdowns between dates directly using the service role key
    const { start_date = '1970-01-01', end_date = '2099-12-31' } = req.body || {};
    const { data, error } = await supabaseAdmin
      .from('breakdowns')
      .select('*')
      .gte('occurred_on', start_date)
      .lte('occurred_on', end_date)
      .order('occurred_on', { ascending: true });
    if (error) throw error;

    // Return CSV payload as attachment
    const rows = data || [];
    // Build CSV server-side
    const csvHeader = Object.keys(rows[0] || {}).join(',');
    const csvRows = rows.map((r) =>
      Object.values(r)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [csvHeader, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=breakdowns_export.csv');
    res.status(200).send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
}
