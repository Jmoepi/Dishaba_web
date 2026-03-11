import { createClient } from '@supabase/supabase-js';

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE env for admin endpoints');
}
const supabaseAdmin = createClient(serviceUrl || '', serviceKey || '');

// simple rate limiter per ip
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

  const { id, data } = req.body || {};
  if (!id || !data) return res.status(400).json({ error: 'Invalid payload' });

  try {
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResp?.user) {
      console.error('auth.getUser failed', userErr);
      return res.status(401).json({ error: 'Invalid token' });
    }
    const uid = userResp.user.id;

    // Fetch profile role - ONLY ADMINS CAN EDIT AND CLOSE
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();
    const role = profile?.role || 'operator';

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can review and close breakdowns' });
    }

    // Fetch the breakdown to verify it exists
    const { data: breakdown, error: fetchErr } = await supabaseAdmin
      .from('breakdowns')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) {
      console.error('Failed to fetch breakdown', fetchErr);
      return res.status(500).json({ error: 'Failed to fetch breakdown' });
    }
    if (!breakdown) return res.status(404).json({ error: 'Not found' });

    // Build the update payload
    const updatePayload = {
      ...data,
      status: 'Closed',
      updated_at: new Date().toISOString(),
      closed_out_by: uid,
      closed_out_by_name: userResp.user?.user_metadata?.full_name || userResp.user?.user_metadata?.name || userResp.user?.email || null,
    };

    // Calculate downtime_minutes if start_time and end_time are provided
    if (data.start_time && data.end_time) {
      const [sh, sm] = (data.start_time || '').split(':').map(Number);
      const [eh, em] = (data.end_time || '').split(':').map(Number);
      if (![sh, sm, eh, em].some(n => Number.isNaN(n))) {
        let startMin = sh * 60 + sm;
        let endMin = eh * 60 + em;
        if (endMin < startMin) {
          endMin += 24 * 60; // next day
        }
        updatePayload.downtime_minutes = Math.max(0, endMin - startMin);
      }
    }

    // Update the breakdown
    const { error: updateErr } = await supabaseAdmin
      .from('breakdowns')
      .update(updatePayload)
      .eq('id', id);

    if (updateErr) {
      console.error('Failed to update breakdown', updateErr);
      throw updateErr;
    }

    // Record status history change
    try {
      const closerName = userResp.user?.user_metadata?.full_name || userResp.user?.user_metadata?.name || userResp.user?.email || null;
      await supabaseAdmin
        .from('breakdown_status_history')
        .insert([{
          breakdown_id: id,
          old_status: breakdown.status || 'Open',
          new_status: 'Closed',
          changed_by: uid,
          changed_by_name: closerName,
          reason: data.resolution || null,
          created_at: new Date().toISOString(),
        }]);
    } catch (e) {
      console.warn('Status history insert failed:', e);
    }

    // Audit log insert (best-effort)
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert([
          {
            user_id: uid,
            action: 'admin_close_breakdown',
            target_id: id,
            details: updatePayload,
          },
        ]);
    } catch (e) {
      console.warn('Audit log failed', e);
    }

    return res.status(200).json({ ok: true, downtime_minutes: updatePayload.downtime_minutes || 0 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
