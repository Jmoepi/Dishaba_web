import { createClient } from '@supabase/supabase-js';

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
const supabaseAdmin = createClient(serviceUrl || '', serviceKey || '');

const RATE = new Map();

function checkRate(ip) {
  const now = Date.now();
  const entry = RATE.get(ip) || { ts: now, count: 0 };
  if (now - entry.ts > 60_000) {
    entry.ts = now;
    entry.count = 0;
  }
  entry.count += 1;
  RATE.set(ip, entry);
  return entry.count <= 60;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
  if (!checkRate(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const token = req.headers.authorization?.replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResp?.user) return res.status(401).json({ error: 'Invalid token' });
    const uid = userResp.user.id;

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();
    const role = profile?.role || 'operator';

    if (role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const page = Math.max(0, parseInt(req.query.page || '0', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
    const filterAction = req.query.action || '';
    const filterUserId = req.query.user_id || '';
    const filterDays = Math.max(1, parseInt(req.query.days || '30', 10));

    const from = page * limit;
    const to = from + limit - 1;

    // Calculate date range (last N days)
    const now = new Date();
    const startDate = new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000);

    let query = supabaseAdmin
      .from('admin_audit_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filterAction) query = query.eq('action', filterAction);
    if (filterUserId) query = query.eq('user_id', filterUserId);

    const { data, error } = await query;
    if (error) throw error;

    const hasMore = (data?.length || 0) === limit;
    return res.status(200).json({ data: data || [], page, hasMore, limit });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
