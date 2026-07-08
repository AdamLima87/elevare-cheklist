/**
 * Detects whether the cloud copy of an inspection changed since this client last saw it,
 * meaning a push from this client would silently clobber someone else's newer edit.
 */
export function isCloudNewer(
  lastKnownCloudUpdatedAt: string | null | undefined,
  cloudUpdatedAt: string | null | undefined,
): boolean {
  if (!cloudUpdatedAt || !lastKnownCloudUpdatedAt) return false;
  return new Date(cloudUpdatedAt).getTime() > new Date(lastKnownCloudUpdatedAt).getTime();
}
