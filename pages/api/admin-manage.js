import { createClient } from '@supabase/supabase-js';

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

const supabaseAdmin =
  serviceUrl && serviceKey
    ? createClient(serviceUrl, serviceKey)
    : null;

const RATE = new Map();

const VALID_STAFF_ROLES = new Set(['operator', 'supervisor', 'admin']);
const VALID_EQUIPMENT_CATEGORIES = new Set([
  'Mechanical',
  'Electrical',
  'Hydraulic',
  'Other',
]);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'local';
}

function getQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

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
  if (!supabaseAdmin) return;

  try {
    await supabaseAdmin.from('admin_audit_logs').insert([
      {
        user_id: userId,
        action,
        target_id: targetId,
        details,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (error) {
    console.warn('Audit log failed:', error);
  }
}

async function requireAdmin(req, res) {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Server configuration error' });
    return null;
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || null;
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return null;
  }

  const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userResp?.user) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }

  const uid = userResp.user.id;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle();

  if (profileErr) {
    res.status(500).json({ error: 'Failed to verify admin access' });
    return null;
  }

  if (profile?.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return null;
  }

  return { uid, user: userResp.user };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).end();
  }

  const ip = getClientIp(req);
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;

  const { uid } = adminCtx;
  const type = getQueryValue(req.query.type);
  const id = getQueryValue(req.query.id);
  const reqAction = typeof req.body?.action === 'string' ? req.body.action : '';

  try {
    // LIST staff
    if (req.method === 'GET' && type === 'staff') {
      const { data, error } = await supabaseAdmin
        .from('staff')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ data: data || [] });
    }

    // LIST equipment
    if (req.method === 'GET' && type === 'equipment') {
      const { data, error } = await supabaseAdmin
        .from('equipment')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ data: data || [] });
    }

    // CREATE equipment
    if (req.method === 'POST' && reqAction === 'create_equipment') {
      const name = req.body?.name;
      const category = req.body?.category;
      const section = req.body?.section;

      if (!isNonEmptyString(name) || !category) {
        return res.status(400).json({ error: 'Name and category are required' });
      }

      if (!VALID_EQUIPMENT_CATEGORIES.has(category)) {
        return res.status(400).json({ error: 'Invalid equipment category' });
      }

      const { data, error } = await supabaseAdmin
        .from('equipment')
        .insert([
          {
            name: name.trim(),
            category,
            section: isNonEmptyString(section) ? section.trim() : null,
            is_active: true,
          },
        ])
        .select();

      if (error) throw error;

      const created = data?.[0];
      await logAudit(uid, 'create_equipment', created?.id || null, {
        name: name.trim(),
        category,
        section: isNonEmptyString(section) ? section.trim() : null,
      });

      return res.status(201).json({ data: created });
    }

    // UPDATE equipment
    if (req.method === 'PUT' && reqAction === 'update_equipment') {
      if (!id && !req.body?.id) {
        return res.status(400).json({ error: 'Missing equipment ID' });
      }

      const equipmentId = req.body?.id || id;
      const updates = {};

      if (req.body?.name !== undefined) {
        if (!isNonEmptyString(req.body.name)) {
          return res.status(400).json({ error: 'Equipment name cannot be empty' });
        }
        updates.name = req.body.name.trim();
      }

      if (req.body?.category !== undefined) {
        if (!VALID_EQUIPMENT_CATEGORIES.has(req.body.category)) {
          return res.status(400).json({ error: 'Invalid equipment category' });
        }
        updates.category = req.body.category;
      }

      if (req.body?.section !== undefined) {
        updates.section = isNonEmptyString(req.body.section)
          ? req.body.section.trim()
          : null;
      }

      if (req.body?.is_active !== undefined) {
        updates.is_active = Boolean(req.body.is_active);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid equipment updates supplied' });
      }

      const { data, error } = await supabaseAdmin
        .from('equipment')
        .update(updates)
        .eq('id', equipmentId)
        .select();

      if (error) throw error;
      if (!data?.length) {
        return res.status(404).json({ error: 'Equipment not found' });
      }

      await logAudit(uid, 'update_equipment', equipmentId, updates);
      return res.status(200).json({ data: data[0] });
    }

    // DELETE equipment
    if (req.method === 'DELETE' && type === 'equipment' && id) {
      const { data, error } = await supabaseAdmin
        .from('equipment')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;
      if (!data?.length) {
        return res.status(404).json({ error: 'Equipment not found' });
      }

      await logAudit(uid, 'delete_equipment', id, {});
      return res.status(200).json({ ok: true });
    }

    // UPDATE staff
    if (req.method === 'PUT' && reqAction === 'update_staff') {
      if (!id && !req.body?.id) {
        return res.status(400).json({ error: 'Missing staff ID' });
      }

      const staffId = req.body?.id || id;
      const staffUpdates = {};

      if (req.body?.full_name !== undefined) {
        if (!isNonEmptyString(req.body.full_name)) {
          return res.status(400).json({ error: 'Full name cannot be empty' });
        }
        staffUpdates.full_name = req.body.full_name.trim();
      }

      if (req.body?.role !== undefined) {
        if (!VALID_STAFF_ROLES.has(req.body.role)) {
          return res.status(400).json({ error: 'Invalid role' });
        }
        staffUpdates.role = req.body.role;
      }

      if (req.body?.is_active !== undefined) {
        staffUpdates.is_active = Boolean(req.body.is_active);
      }

      if (Object.keys(staffUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid staff updates supplied' });
      }

      const { data, error } = await supabaseAdmin
        .from('staff')
        .update(staffUpdates)
        .eq('id', staffId)
        .select();

      if (error) throw error;
      if (!data?.length) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      const updatedStaff = data[0];

      // Keep profile in sync with staff record
      const { error: profileSyncError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          [
            {
              id: staffId,
              full_name: updatedStaff.full_name,
              role: updatedStaff.role,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'id' }
        );

      if (profileSyncError) throw profileSyncError;

      await logAudit(uid, 'update_staff', staffId, {
        staffUpdates,
        synced_profile: true,
      });

      return res.status(200).json({ data: updatedStaff });
    }

    // DELETE staff
    if (req.method === 'DELETE' && type === 'staff' && id) {
      if (id === uid) {
        return res.status(400).json({ error: 'You cannot delete your own admin account' });
      }

      const { data: existingStaff, error: existingStaffError } = await supabaseAdmin
        .from('staff')
        .select('id, full_name, role')
        .eq('id', id)
        .maybeSingle();

      if (existingStaffError) throw existingStaffError;
      if (!existingStaff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', id);

      if (profileDeleteError) throw profileDeleteError;

      const { data: deletedStaffRows, error: staffDeleteError } = await supabaseAdmin
        .from('staff')
        .delete()
        .eq('id', id)
        .select('id');

      if (staffDeleteError) throw staffDeleteError;
      if (!deletedStaffRows?.length) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      // Best-effort auth cleanup
      let authDeleted = false;
      try {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authDeleteError) {
          console.warn('Auth user delete failed:', authDeleteError);
        } else {
          authDeleted = true;
        }
      } catch (authDeleteCrash) {
        console.warn('Auth user delete crashed:', authDeleteCrash);
      }

      await logAudit(uid, 'delete_staff', id, {
        full_name: existingStaff.full_name,
        role: existingStaff.role,
        auth_deleted: authDeleted,
      });

      return res.status(200).json({
        ok: true,
        authDeleted,
      });
    }

    // Staff creation now lives in /api/admin-invite
    if (req.method === 'POST' && reqAction === 'create_staff') {
      return res.status(400).json({
        error: 'Use /api/admin-invite to create new staff users',
      });
    }

    return res.status(400).json({ error: 'Invalid request' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error?.message || String(error),
    });
  }
}