import { createClient } from '@supabase/supabase-js';

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
const supabaseAdmin = createClient(serviceUrl || '', serviceKey || '');

// simple in-memory cache: { key: {ts, data} }
const CACHE = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // rate-limit by ip
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
  const rlKey = `rl:${ip}`;
  const now = Date.now();
  const rl = global[rlKey] || { ts: now, count: 0 };
  if (now - rl.ts > 60_000) {
    rl.ts = now;
    rl.count = 0;
  }
  rl.count += 1;
  global[rlKey] = rl;
  if (rl.count > 60) return res.status(429).json({ error: 'Rate limit exceeded' });

  // authenticate caller token (optional: allow public read but we check role)
  const token = req.headers.authorization?.replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResp?.user) return res.status(401).json({ error: 'Invalid token' });
    const uid = userResp.user.id;

    // Only supervisors/admins allowed to list in this admin portal
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();
    const role = profile?.role || 'operator';
    if (!['supervisor', 'admin'].includes(role))
      return res.status(403).json({ error: 'Forbidden' });

    const page = Math.max(0, parseInt(req.query.page || '0', 10));
    const limit = Math.min(1000, parseInt(req.query.limit || '20', 10));
    const status = req.query.status || '';
    const category = req.query.category || '';
    const search = req.query.search || '';
    const supervisor = req.query.supervisor || '';
    const event_type = req.query.event_type || '';
    const start_date = req.query.start_date || null;
    const end_date = req.query.end_date || null;
    const min_downtime = req.query.min_downtime ? parseInt(req.query.min_downtime, 10) : null;
    const max_downtime = req.query.max_downtime ? parseInt(req.query.max_downtime, 10) : null;

    const cacheKey = JSON.stringify({ page, limit, status, category, search, supervisor, event_type, start_date, end_date, min_downtime, max_downtime });
    const cached = CACHE.get(cacheKey);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return res.status(200).json({ rows: cached.data.rows, page, hasMore: cached.data.hasMore });
    }

    const from = page * limit;
    const to = from + limit - 1;
    let query = supabaseAdmin
      .from('breakdowns')
      .select('*')
      .order('occurred_on', { ascending: false })
      .range(from, to);
    
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (supervisor) query = query.ilike('supervisor', `%${supervisor}%`);
    if (event_type) query = query.eq('event_type', event_type);
    if (start_date) query = query.gte('occurred_on', start_date);
    if (end_date) query = query.lte('occurred_on', end_date);
    if (min_downtime !== null) query = query.gte('downtime_minutes', min_downtime);
    if (max_downtime !== null) query = query.lte('downtime_minutes', max_downtime);
    
    // Multi-field search: equipment, description, section, reported_by_name
    if (search) {
      query = query.or(`equipment_item.ilike.%${search}%,description.ilike.%${search}%,section.ilike.%${search}%,reported_by_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const hasMore = (data?.length || 0) === limit;
    const payload = { rows: data || [], page, hasMore };
    CACHE.set(cacheKey, { ts: now, data: payload });
    return res.status(200).json(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
