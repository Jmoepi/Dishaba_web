import { createClient } from '@supabase/supabase-js';

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE env for admin endpoints');
}
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
  return entry.count <= 30;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
  if (!checkRate(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const token = req.headers.authorization?.replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing breakdown id' });

  try {
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResp?.user) {
      console.error('auth.getUser failed', userErr);
      return res.status(401).json({ error: 'Invalid token' });
    }
    const uid = userResp.user.id;

    // Only admins can approve
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();
    const role = profile?.role || 'operator';

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can approve breakdowns' });
    }

    // Fetch the breakdown
    const { data: breakdown, error: fetchErr } = await supabaseAdmin
      .from('breakdowns')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('Failed to fetch breakdown', fetchErr);
      return res.status(500).json({ error: 'Failed to fetch breakdown' });
    }
    if (!breakdown) return res.status(404).json({ error: 'Breakdown not found' });
    if (breakdown.status !== 'Pending') return res.status(400).json({ error: 'Only pending breakdowns can be approved' });

    const approverName = userResp.user?.user_metadata?.full_name || userResp.user?.user_metadata?.name || userResp.user?.email || null;

    // Update status to Open
    const { error: updateErr } = await supabaseAdmin
      .from('breakdowns')
      .update({
        status: 'Open',
        approved_by: uid,
        approved_by_name: approverName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) {
      console.error('Failed to update breakdown', updateErr);
      throw updateErr;
    }

    // Record status history
    try {
      await supabaseAdmin
        .from('breakdown_status_history')
        .insert([{
          breakdown_id: id,
          old_status: 'Pending',
          new_status: 'Open',
          changed_by: uid,
          changed_by_name: approverName,
          reason: 'Breakdown approved by admin',
          created_at: new Date().toISOString(),
        }]);
    } catch (e) {
      console.warn('Status history insert failed:', e);
    }

    // Audit log
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert([{
          user_id: uid,
          action: 'approve_breakdown',
          target_id: id,
          details: { approved_by: approverName },
        }]);
    } catch (e) {
      console.warn('Audit log failed', e);
    }

    return res.status(200).json({ ok: true, message: 'Breakdown approved and moved to Open status' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
