import { createClient } from '@supabase/supabase-js';

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE env for admin endpoints');
}
const supabaseAdmin = createClient(serviceUrl || '', serviceKey || '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    // Simple reopen: set status back to Open and clear end_time/resolution/downtime
    const { error } = await supabaseAdmin
      .from('breakdowns')
      .update({ status: 'Open', end_time: null, resolution: null, downtime_minutes: null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    // Audit log
    try {
      await supabaseAdmin.from('admin_audit_logs').insert([{ user_id: null, action: 'reopen_breakdown', target_id: id, details: {} }]);
    } catch (e) {
      // ignore
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
