import { hasSupabaseAdmin, listAllAuthUsers, supabaseAdmin } from '../../lib/supabase-admin.js';

export default async function handler(request, response) {
  if (!hasSupabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });

  const { email, password, username, nickname } = request.body ?? {};
  const safeEmail = String(email ?? '').trim().toLowerCase();
  const safePassword = String(password ?? '');
  const safeUsername = String(username ?? '').trim().toLowerCase();
  const safeNickname = String(nickname ?? '').trim();

  if (!safeEmail || !safePassword || !safeUsername || !safeNickname) {
    return response.status(400).json({ error: 'invalid_request' });
  }

  try {
    const users = await listAllAuthUsers();
    const emailTaken = users.some((user) => String(user.email ?? '').toLowerCase() === safeEmail);
    const usernameTaken = users.some((user) => String(user.user_metadata?.username ?? '').toLowerCase() === safeUsername);
    const nicknameTaken = users.some((user) => String(user.user_metadata?.nickname ?? '').toLowerCase() === safeNickname.toLowerCase());

    if (emailTaken) return response.status(409).json({ error: 'email_taken' });
    if (usernameTaken) return response.status(409).json({ error: 'username_taken' });
    if (nicknameTaken) return response.status(409).json({ error: 'nickname_taken' });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: {
        username: safeUsername,
        nickname: safeNickname
      }
    });

    if (error) throw error;
    return response.status(201).json({ ok: true, userId: data.user?.id ?? null });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
