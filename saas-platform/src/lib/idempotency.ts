const memoryStore = new Map<string, string>();

export function buildIdempotencyKey(parts: string[]) {
  return parts.join(":").toLowerCase();
}

export function hasProcessedKey(key: string) {
  return memoryStore.has(key);
}

export function markProcessedKey(key: string, value: string) {
  memoryStore.set(key, value);
}
