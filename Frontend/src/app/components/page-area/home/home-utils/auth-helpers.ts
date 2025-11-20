export function getUserIdFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  try {
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return null;
    const decoded = atob(payloadBase64);
    const payload = JSON.parse(decoded);

    return payload.sub || null;
  } catch (err) {
    console.error('[AUTH HELPERS] Error parsing token payload:', err);
    return null;
  }
}
