import { hasSupabaseAdmin, listAllAuthUsers, supabaseAdmin } from '../../lib/supabase-admin.js';

const COMMUNITY_TABLE = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';
const NOTIFICATIONS_TABLE = process.env.SUPABASE_USER_NOTIFICATIONS_TABLE || 'user_notifications';
const PUSH_SUBSCRIPTIONS_TABLE = process.env.SUPABASE_USER_PUSH_SUBSCRIPTIONS_TABLE || 'user_push_subscriptions';
const MARKET_LISTINGS_TABLE = process.env.SUPABASE_MARKET_LISTINGS_TABLE || 'market_listings';
const MARKET_LISTING_IMAGES_TABLE = process.env.SUPABASE_MARKET_LISTING_IMAGES_TABLE || 'market_listing_images';
const MARKET_VERIFICATIONS_TABLE = process.env.SUPABASE_MARKET_VERIFICATIONS_TABLE || 'market_seller_verifications';
const MARKET_INQUIRIES_TABLE = process.env.SUPABASE_MARKET_INQUIRIES_TABLE || 'market_inquiries';
const MARKET_CONVERSATIONS_TABLE = process.env.SUPABASE_MARKET_CONVERSATIONS_TABLE || 'market_conversations';
const MARKET_MESSAGES_TABLE = process.env.SUPABASE_MARKET_MESSAGES_TABLE || 'market_messages';

function getBearerToken(request) {
  const header = String(request.headers?.authorization || request.headers?.Authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function isMissingTableError(error) {
  return error?.code === '42P01' || /relation .* does not exist/i.test(String(error?.message || ''));
}

async function runCleanup(query) {
  const { error } = await query;
  if (error && !isMissingTableError(error)) throw error;
}

async function deleteAccountData(user) {
  const userId = user.id;
  if (String(user.user_metadata?.username || '').toLowerCase() === 'admin') throw new Error('admin_account_cannot_be_deleted');

  const { data: listings, error: listingsError } = await supabaseAdmin
    .from(MARKET_LISTINGS_TABLE)
    .select('id')
    .eq('seller_user_id', userId);
  if (listingsError && !isMissingTableError(listingsError)) throw listingsError;
  const listingIds = (listings || []).map((row) => row.id).filter(Boolean);

  const { data: conversations, error: conversationsError } = await supabaseAdmin
    .from(MARKET_CONVERSATIONS_TABLE)
    .select('id')
    .or(`seller_user_id.eq.${userId},buyer_user_id.eq.${userId}`);
  if (conversationsError && !isMissingTableError(conversationsError)) throw conversationsError;
  const conversationIds = (conversations || []).map((row) => row.id).filter(Boolean);

  if (conversationIds.length) {
    await runCleanup(supabaseAdmin.from(MARKET_MESSAGES_TABLE).delete().in('conversation_id', conversationIds));
  }
  await runCleanup(supabaseAdmin.from(MARKET_MESSAGES_TABLE).delete().eq('sender_user_id', userId));
  await runCleanup(supabaseAdmin.from(MARKET_INQUIRIES_TABLE).delete().eq('buyer_user_id', userId));
  await runCleanup(supabaseAdmin.from(MARKET_CONVERSATIONS_TABLE).delete().or(`seller_user_id.eq.${userId},buyer_user_id.eq.${userId}`));
  if (listingIds.length) {
    await runCleanup(supabaseAdmin.from(MARKET_LISTING_IMAGES_TABLE).delete().in('listing_id', listingIds));
  }
  await runCleanup(supabaseAdmin.from(MARKET_LISTINGS_TABLE).delete().eq('seller_user_id', userId));
  await runCleanup(supabaseAdmin.from(MARKET_VERIFICATIONS_TABLE).delete().eq('user_id', userId));
  await runCleanup(supabaseAdmin.from(NOTIFICATIONS_TABLE).delete().eq('user_id', userId));
  await runCleanup(supabaseAdmin.from(PUSH_SUBSCRIPTIONS_TABLE).delete().eq('user_id', userId));
  await runCleanup(supabaseAdmin.from(COMMUNITY_TABLE).delete().eq('id', `state-${userId}`));
  await runCleanup(supabaseAdmin.from(COMMUNITY_TABLE).delete().eq('author_token', `user:${userId}`));

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) throw deleteError;
}

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
      const { email, password, username, nickname, termsAccepted, privacyAccepted, consentVersion } = request.body ?? {};
      const safeEmail = String(email ?? '').trim().toLowerCase();
      const safePassword = String(password ?? '');
      const safeUsername = String(username ?? '').trim().toLowerCase();
      const safeNickname = String(nickname ?? '').trim();
      if (!safeEmail || !safePassword || !safeUsername || !safeNickname) {
        return response.status(400).json({ error: 'invalid_request' });
      }
      if (termsAccepted !== true || privacyAccepted !== true) {
        return response.status(400).json({ error: 'consent_required' });
      }

      const users = await listAllAuthUsers();
      const emailTaken = users.some((user) => String(user.email ?? '').toLowerCase() === safeEmail);
      const usernameTaken = users.some((user) => String(user.user_metadata?.username ?? '').toLowerCase() === safeUsername);
      const nicknameTaken = users.some((user) => String(user.user_metadata?.nickname ?? '').toLowerCase() === safeNickname.toLowerCase());

      if (emailTaken) return response.status(409).json({ error: 'email_taken' });
      if (usernameTaken) return response.status(409).json({ error: 'username_taken' });
      if (nicknameTaken) return response.status(409).json({ error: 'nickname_taken' });

      const consentAcceptedAt = new Date().toISOString();
      const safeConsentVersion = String(consentVersion || '2026-07-14').slice(0, 32);
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: safeEmail,
        password: safePassword,
        email_confirm: true,
        user_metadata: {
          username: safeUsername,
          nickname: safeNickname,
          terms_accepted_at: consentAcceptedAt,
          terms_version: safeConsentVersion,
          privacy_accepted_at: consentAcceptedAt,
          privacy_version: safeConsentVersion
        }
      });
      if (error) throw error;
      return response.status(201).json({ ok: true, userId: data.user?.id ?? null });
    }

    if (action === 'delete-account' && request.method === 'DELETE') {
      const token = getBearerToken(request);
      if (!token) return response.status(401).json({ error: 'unauthorized' });
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user?.id) return response.status(401).json({ error: 'unauthorized' });
      await deleteAccountData(data.user);
      return response.status(200).json({ ok: true });
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
