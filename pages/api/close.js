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

  const { id, resolution } = req.body || {};
  if (!id || !resolution || resolution.trim().length < 6)
    return res.status(400).json({ error: 'Invalid payload' });

  try {
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResp?.user) {
      console.error('auth.getUser failed', userErr);
      return res.status(401).json({ error: 'Invalid token' });
    }
    const uid = userResp.user.id;

    // Fetch profile role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();
    const role = profile?.role || 'operator';

    // Fetch the breakdown to check owner and start_time
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

    const isOwner = breakdown.reported_by === uid;
    if (!(['supervisor', 'admin'].includes(role) || (role === 'operator' && isOwner))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Compute end_time and downtime_minutes
    const now = new Date();
    const endHHmm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // parse start (occurred_on + start_time assumed 'HH:mm')
    const startIso = `${breakdown.occurred_on}T${breakdown.start_time}:00`;
    let startDate = new Date(startIso);
    if (isNaN(startDate.getTime())) {
      // fallback: today with start_time
      const parts = breakdown.start_time.split(':');
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        parseInt(parts[0] || '0', 10),
        parseInt(parts[1] || '0', 10)
      );
    }
    let endDate = now;
    if (endDate < startDate) {
      // assume next day
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }
    const mins = Math.max(0, Math.round((endDate - startDate) / 60000));

    // Prepare update payload
    const basePayload = {
      status: 'Closed',
      resolution: resolution.trim(),
      end_time: endHHmm,
      downtime_minutes: mins,
      updated_at: new Date().toISOString(),
    };

    // Try to include who closed the incident (best-effort; retry without if column missing)
    const closerName = userResp.user?.user_metadata?.full_name || userResp.user?.user_metadata?.name || userResp.user?.email || null;
    const closerPayload = {
      closed_by: uid,
      closed_by_name: closerName,
      closed_by_email: userResp.user?.email || null,
    };

    let updateErr = null;
    try {
      const { error } = await supabaseAdmin.from('breakdowns').update({ ...basePayload, ...closerPayload }).eq('id', id);
      updateErr = error;
    } catch (e) {
      updateErr = e;
    }

    // If update failed due to missing columns in the schema, retry without the closer fields
    if (updateErr) {
      const msg = String(updateErr.message || updateErr);
      if (msg.includes("Could not find the '") || msg.includes('PGRST204')) {
        const { error } = await supabaseAdmin.from('breakdowns').update(basePayload).eq('id', id);
        if (error) throw error;
      } else {
        throw updateErr;
      }
    }

    // Audit log insert (best-effort)
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert([
          {
            user_id: uid,
            action: 'close_breakdown',
            target_id: id,
            details: { resolution, downtime_minutes: mins },
          },
        ]);
    } catch (e) {
      console.warn('Audit log failed', e);
    }

    return res.status(200).json({ ok: true, downtime_minutes: mins });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
