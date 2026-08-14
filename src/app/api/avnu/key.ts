export function avnuKey(): string | undefined {
  const key = process.env.AVNU_PAYMASTER_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export function requireAvnuKey(): string {
  const key = avnuKey();
  if (!key) {
    throw Object.assign(new Error("AVNU private swap is not configured on this server."), { status: 503 });
  }
  return key;
}
