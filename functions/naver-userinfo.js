const NAVER_PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestGet({ request }) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'missing_bearer_token' }, 401);
  }

  let response;
  try {
    response = await fetch(NAVER_PROFILE_URL, {
      headers: {
        Authorization: authorization,
        Accept: 'application/json'
      }
    });
  } catch {
    return jsonResponse({ error: 'naver_profile_unavailable' }, 502);
  }

  const payload = await response.json().catch(() => null);
  const profile = payload?.response;
  if (!response.ok || payload?.resultcode !== '00' || !profile?.id) {
    return jsonResponse({ error: 'invalid_naver_profile' }, response.ok ? 502 : response.status);
  }

  const email = String(profile.email || '').trim().toLowerCase();
  if (!email) return jsonResponse({ error: 'naver_email_required' }, 422);

  const id = String(profile.id);
  const name = String(profile.name || profile.nickname || '').trim();
  const nickname = String(profile.nickname || profile.name || '').trim();
  const picture = String(profile.profile_image || '').trim();

  return jsonResponse({
    sub: id,
    id,
    email,
    email_verified: true,
    name,
    nickname,
    preferred_username: nickname,
    picture,
    avatar_url: picture
  });
}
