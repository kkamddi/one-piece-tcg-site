import { hasSupabaseAdmin, listAllAuthUsers, supabaseAdmin } from '../../lib/supabase-admin.js';

export default async function handler(request, response) {
  if (!hasSupabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });

  const action = String(request.query?.action ?? '').toLowerCase();

  try {
    if (action === 'check') {
      const { type, q } = request.query ?? {};
      const value = String(q ?? '').trim().toLowerCase();
      if (!type || !value) return response.status(400).json({ error: 'invalid_request' });
      const users = await listAllAuthUsers();
      const taken = users.some((user) => {
        const metadata = user.user_metadata ?? {};
        if (type === 'email') return String(user.email ?? '').toLowerCase() === value;
        if (type === 'username') return String(metadata.username ?? '').toLowerCase() === value;
        if (type === 'nickname') return String(metadata.nickname ?? '').toLowerCase() === value;
        return false;
      });
      return response.status(200).json({ available: !taken });
    }

    if (action === 'lookup') {
      const identifier = String(request.query?.identifier ?? '').trim();
      if (!identifier) return response.status(400).json({ error: 'invalid_request' });
      if (identifier.includes('@')) return response.status(200).json({ email: identifier });
      const users = await listAllAuthUsers();
      const found = users.find((user) => String(user.user_metadata?.username ?? '').toLowerCase() === identifier.toLowerCase());
      if (!found?.email) return response.status(404).json({ error: 'invalid_credentials' });
      return response.status(200).json({ email: found.email });
    }

    if (action === 'signup' && request.method === 'POST') {
      const { email, password, username, nickname } = request.body ?? {};
      const safeEmail = String(email ?? '').trim().toLowerCase();
      const safePassword = String(password ?? '');
      const safeUsername = String(username ?? '').trim().toLowerCase();
      const safeNickname = String(nickname ?? '').trim();
      if (!safeEmail || !safePassword || !safeUsername || !safeNickname) {
        return response.status(400).json({ error: 'invalid_request' });
      }

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
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
