export function isRejectedUserToken(error) {
  const status = Number(error?.status);
  if (status >= 500 || status === 429) return false;
  return status === 401 || ['bad_jwt', 'no_authorization', 'user_not_found', 'session_not_found', 'session_expired'].includes(error?.code);
}
