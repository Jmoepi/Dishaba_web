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
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
  if (!checkRate(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const token = req.headers.authorization?.replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResp?.user) return res.status(401).json({ error: 'Invalid token' });
    const uid = userResp.user.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', uid)
      .maybeSingle();
    const userRole = profile?.role || 'operator';
    const userName = profile?.full_name || userResp.user?.user_metadata?.name || userResp.user?.email || 'Unknown';

    // GET comments for a breakdown
    if (req.method === 'GET') {
      const { breakdown_id } = req.query;
      if (!breakdown_id) return res.status(400).json({ error: 'Missing breakdown_id' });

      const { data, error } = await supabaseAdmin
        .from('breakdown_comments')
        .select('*')
        .eq('breakdown_id', breakdown_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ data: data || [] });
    }

    // GET status history for a breakdown
    if (req.method === 'GET' && req.query.history === 'true') {
      const { breakdown_id } = req.query;
      if (!breakdown_id) return res.status(400).json({ error: 'Missing breakdown_id' });

      const { data, error } = await supabaseAdmin
        .from('breakdown_status_history')
        .select('*')
        .eq('breakdown_id', breakdown_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ data: data || [] });
    }

    // POST a new comment
    if (req.method === 'POST') {
      const { breakdown_id, comment_text } = req.body;
      if (!breakdown_id || !comment_text?.trim()) {
        return res.status(400).json({ error: 'Missing breakdown_id or comment_text' });
      }

      // Verify breakdown exists
      const { data: breakdown, error: fetchErr } = await supabaseAdmin
        .from('breakdowns')
        .select('id, reported_by')
        .eq('id', breakdown_id)
        .maybeSingle();
      if (fetchErr || !breakdown) return res.status(404).json({ error: 'Breakdown not found' });

      // Check permission: 
      // - Admins can comment on any breakdown
      // - Operators can only comment on their own
      if (userRole === 'operator' && breakdown.reported_by !== uid) {
        return res.status(403).json({ error: 'Can only comment on own breakdowns' });
      }

      const { data, error } = await supabaseAdmin
        .from('breakdown_comments')
        .insert([{
          breakdown_id,
          user_id: uid,
          user_name: userName,
          user_role: userRole,
          comment_text: comment_text.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select();

      if (error) throw error;
      return res.status(201).json({ data: data?.[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
