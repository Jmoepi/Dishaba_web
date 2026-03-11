import { createClient } from '@supabase/supabase-js';

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

if (!serviceUrl || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE environment variables');
}

const supabaseAdmin = createClient(serviceUrl, serviceKey);

function normalizeIp(forwardedFor, remoteAddress) {
  // x-forwarded-for can be comma-separated IPs; take the first (client IP)
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  return remoteAddress || 'local';
}

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
  return entry.count <= 20;
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
  if (req.method !== 'POST') return res.status(405).end();

  const ip = normalizeIp(req.headers['x-forwarded-for'], req.socket.remoteAddress);
  if (!checkRate(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const token = req.headers.authorization?.replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { email, full_name, role } = req.body || {};
  if (!email?.trim() || !full_name?.trim() || !role) {
    return res.status(400).json({ error: 'Email, name, and role are required' });
  }

  if (!['operator', 'supervisor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = full_name.trim();

    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userResp?.user) return res.status(401).json({ error: 'Invalid token' });
    const creatorId = userResp.user.id;

    // Verify creator is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', creatorId)
      .maybeSingle();
    const creatorRole = profile?.role || 'operator';

    if (creatorRole !== 'admin') return res.status(403).json({ error: 'Admin only' });

    // Use inviteUserByEmail (Supabase's dedicated invite flow)
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?email=${encodeURIComponent(cleanEmail)}`,
        data: {
          full_name: cleanName,
          role: role,
        },
      }
    );

    if (inviteErr || !invited?.user) {
      console.error('Failed to invite user:', inviteErr);
      return res.status(400).json({ error: inviteErr?.message || 'Failed to invite user' });
    }

    const newUserId = invited.user.id;

    // Create profile
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: newUserId,
        full_name: cleanName,
        role: role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

    if (profileErr) {
      console.error('Failed to create profile:', profileErr);
      // Try to delete the auth user since profile creation failed
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
      } catch (e) {
        console.warn('Failed to rollback user creation:', e);
      }
      return res.status(500).json({ error: 'Failed to create profile' });
    }

    // Create staff record
    const { error: staffErr } = await supabaseAdmin
      .from('staff')
      .insert([{
        id: newUserId,
        full_name: cleanName,
        role: role,
        is_active: true,
        created_at: new Date().toISOString(),
      }]);

    if (staffErr) {
      console.error('Failed to create staff record:', staffErr);
      // Rollback: delete profile and auth user
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', newUserId);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
      } catch (e) {
        console.warn('Failed to rollback staff creation:', e);
      }
      return res.status(500).json({ error: 'Failed to create staff record' });
    }

    // Log audit
    await logAudit(creatorId, 'create_user_and_staff', newUserId, {
      email: cleanEmail,
      full_name: cleanName,
      role,
    });

    return res.status(201).json({
      ok: true,
      user_id: newUserId,
      email: cleanEmail,
      message: 'Invitation sent successfully. User can click the link in their email to set up their password.',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
