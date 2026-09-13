export function readAuthCallbackError(href) {
  try {
    const url = new URL(href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const params = url.searchParams.has('error') || url.searchParams.has('error_description')
      ? url.searchParams : hash;
    if (!params.has('error') && !params.has('error_description')) return null;
    return {
      code: params.get('error_code') || params.get('error') || '',
      message: params.get('error_description') || params.get('error') || ''
    };
  } catch {
    return null;
  }
}

export function clearAuthCallbackError(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const keys = ['error', 'error_code', 'error_description'];
  for (const params of [url.searchParams, hash]) {
    if (!params.has('error') && !params.has('error_description')) continue;
    keys.forEach((key) => params.delete(key));
    if (params === hash) url.hash = hash.toString();
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getSocialAuthErrorMessage(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || error || '');
  if (/Multiple accounts with the same email/i.test(message)) {
    return '기존 계정의 로그인 정보가 중복되어 소셜 로그인을 연결하지 못했습니다. 기존 아이디·비밀번호 또는 가입했던 방식으로 로그인한 뒤, 마이페이지에서 소셜 로그인을 연결해 주세요. 기존 데이터는 유지됩니다.';
  }
  if (code === 'identity_already_exists' || /identity.*already.*(linked|exists)/i.test(message)) {
    return '이 소셜 계정은 다른 Card Pone 계정에 연결되어 있습니다. 계정은 자동으로 합치지 않습니다. 기존 로그인 방식으로 이용하거나 고객센터에 문의해 주세요.';
  }
  if (code === 'access_denied' || /access_denied|user.*(cancel|denied)/i.test(message)) {
    return '소셜 로그인이 취소되었거나 동의가 완료되지 않았습니다. 다시 시도해 주세요.';
  }
  if (code === 'manual_linking_disabled') {
    return '현재 소셜 계정 연결을 사용할 수 없습니다. 기존 로그인 방식으로 이용해 주세요.';
  }
  if (/session|refresh_token|flow_state|code_verifier/i.test(`${code} ${message}`)) {
    return '로그인 인증이 만료되었거나 완료되지 않았습니다. 로그인 버튼을 눌러 다시 시작해 주세요.';
  }
  return '소셜 로그인을 완료하지 못했습니다. 다시 시도하거나 다른 로그인 방식을 이용해 주세요. 문제가 계속되면 고객센터로 문의해 주세요.';
}
