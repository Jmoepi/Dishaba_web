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

async function logAudit(userId, action, targetId, details) {
  try {
    await supabaseAdmin
      .from('admin_audit_logs')
      .insert([{ user_id: userId, action, target_id: targetId, details, created_at: new Date().toISOString() }]);
  } catch (e) {
    console.warn('Audit log failed:', e);
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).end();

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

    const { action: reqAction } = req.body || {};

    // LIST staff
    if (req.method === 'GET' && req.query.type === 'staff') {
      const { data, error } = await supabaseAdmin
        .from('staff')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ data });
    }

    // LIST equipment
    if (req.method === 'GET' && req.query.type === 'equipment') {
      const { data, error } = await supabaseAdmin
        .from('equipment')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ data });
    }

    // CREATE staff
    if (req.method === 'POST' && reqAction === 'create_staff') {
      const { full_name, role: staffRole } = req.body;
      if (!full_name?.trim() || !staffRole) return res.status(400).json({ error: 'Missing required fields' });
      if (!['operator', 'supervisor', 'admin'].includes(staffRole)) 
        return res.status(400).json({ error: 'Invalid role' });

      const { data, error } = await supabaseAdmin
        .from('staff')
        .insert([{ full_name: full_name.trim(), role: staffRole, is_active: true }])
        .select();
      if (error) throw error;

      await logAudit(uid, 'create_staff', data[0].id, { full_name, staff_role: staffRole });
      return res.status(201).json({ data: data[0] });
    }

    // UPDATE staff
    if (req.method === 'PUT' && reqAction === 'update_staff') {
      const { id, full_name, role: staffRole, is_active } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing staff ID' });

      const updates = {};
      if (full_name !== undefined) updates.full_name = full_name.trim();
      if (staffRole !== undefined) {
        if (!['operator', 'supervisor', 'admin'].includes(staffRole)) 
          return res.status(400).json({ error: 'Invalid role' });
        updates.role = staffRole;
      }
      if (is_active !== undefined) updates.is_active = is_active;

      const { data, error } = await supabaseAdmin
        .from('staff')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      if (!data?.length) return res.status(404).json({ error: 'Staff not found' });

      await logAudit(uid, 'update_staff', id, updates);
      return res.status(200).json({ data: data[0] });
    }

    // DELETE staff
    if (req.method === 'DELETE' && req.query.id) {
      const { id } = req.query;
      const { error } = await supabaseAdmin.from('staff').delete().eq('id', id);
      if (error) throw error;

      await logAudit(uid, 'delete_staff', id, {});
      return res.status(200).json({ ok: true });
    }

    // CREATE equipment
    if (req.method === 'POST' && reqAction === 'create_equipment') {
      const { name, category, section } = req.body;
      if (!name?.trim() || !category) return res.status(400).json({ error: 'Missing required fields' });

      const { data, error } = await supabaseAdmin
        .from('equipment')
        .insert([{ name: name.trim(), category, section: section?.trim() || null, is_active: true }])
        .select();
      if (error) throw error;

      await logAudit(uid, 'create_equipment', data[0].id, { name, category, section });
      return res.status(201).json({ data: data[0] });
    }

    // UPDATE equipment
    if (req.method === 'PUT' && reqAction === 'update_equipment') {
      const { id, name, category, section, is_active } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing equipment ID' });

      const updates = {};
      if (name !== undefined) updates.name = name.trim();
      if (category !== undefined) updates.category = category;
      if (section !== undefined) updates.section = section?.trim() || null;
      if (is_active !== undefined) updates.is_active = is_active;

      const { data, error } = await supabaseAdmin
        .from('equipment')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      if (!data?.length) return res.status(404).json({ error: 'Equipment not found' });

      await logAudit(uid, 'update_equipment', id, updates);
      return res.status(200).json({ data: data[0] });
    }

    // DELETE equipment
    if (req.method === 'DELETE' && req.query.id) {
      const { id } = req.query;
      const { error } = await supabaseAdmin.from('equipment').delete().eq('id', id);
      if (error) throw error;

      await logAudit(uid, 'delete_equipment', id, {});
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid request' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
