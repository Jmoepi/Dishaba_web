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

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
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

    // Check if email already exists in auth.users
    const { data: existingUsers, error: checkErr } = await supabaseAdmin.auth.admin.listUsers();
    if (checkErr) {
      console.error('Failed to list users:', checkErr);
      return res.status(500).json({ error: 'Failed to check existing users' });
    }

    const emailExists = existingUsers?.users?.some(u => u.email === email.trim());
    if (emailExists) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create auth user with auto-confirm enabled (they'll set password via reset link)
    const { data: newAuthUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: Math.random().toString(36).slice(-16), // Random password (they won't use it)
      email_confirm: false, // Not confirmed yet
      user_metadata: {
        full_name: full_name.trim(),
        role: role,
      },
    });

    if (createAuthErr || !newAuthUser?.user) {
      console.error('Failed to create auth user:', createAuthErr);
      return res.status(500).json({ error: 'Failed to create user account' });
    }

    const newUserId = newAuthUser.user.id;

    // Create profile
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: newUserId,
        full_name: full_name.trim(),
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
        full_name: full_name.trim(),
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

    // Send password reset email (user will set password via link)
    const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?email=${encodeURIComponent(email.trim())}`,
    });

    if (resetErr) {
      console.error('Failed to send password reset email:', resetErr);
      // Don't fail - user is created but won't get email
      // They can use "Forgot Password" later
    }

    // Log audit
    await logAudit(creatorId, 'create_user_and_staff', newUserId, {
      email,
      full_name,
      role,
      email_sent: !resetErr,
    });

    return res.status(201).json({
      ok: true,
      user_id: newUserId,
      email: email.trim(),
      message: resetErr
        ? 'User created but email failed. They can use "Forgot Password" to set password.'
        : 'User created and invitation email sent',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
