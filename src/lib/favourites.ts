/**
 * OWNER: teammate C.
 *
 * DONE:  a starred list, kept in localStorage, with a subscription so every
 *        star on screen stays in step.
 * TODO:  nothing.
 *
 * This is the one thing the app remembers between visits. It holds landmark
 * ids and nothing else — no account, no history, no analytics. Everything
 * stays on the visitor's own device, and clearing site data clears it.
 *
 * localStorage rather than sessionStorage on purpose: a list you saved on
 * Tuesday should still be there when you go on Saturday.
 */

const KEY = 'darb:favourites';

/** Notified whenever the set changes, so every star re-renders together. */
const listeners = new Set<() => void>();

let cache: Set<string> | null = null;

function read(): Set<string> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    // Private browsing, or someone hand-edited the value into nonsense.
    // An empty list is the safe reading — never throw over a saved star.
    cache = new Set();
  }
  return cache;
}

function write(next: Set<string>): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Out of quota or blocked. The star still works for this session.
  }
  listeners.forEach((fn) => fn());
}

export function isFavourite(id: string): boolean {
  return read().has(id);
}

/** Adds or removes a landmark. Returns its new state. */
export function toggleFavourite(id: string): boolean {
  const next = new Set(read());
  const nowFavourite = !next.has(id);
  if (nowFavourite) next.add(id);
  else next.delete(id);
  write(next);
  return nowFavourite;
}

export function favouriteIds(): string[] {
  return [...read()];
}

export function favouriteCount(): number {
  return read().size;
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function onFavouritesChanged(fn: () => void): () => void {
  listeners.add(fn);

  // Another tab may have changed the list.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}
