const ID_KEY = "minesw1pe:guestId";
const NAME_KEY = "minesw1pe:guestName";

/**
 * Guest identity lives in sessionStorage rather than localStorage on purpose:
 * it is scoped to one tab, so opening a second tab gives you a genuinely
 * separate player. That's what makes two-player testing (and two people on one
 * machine) work, and it still survives a reload so a mid-match refresh
 * reconnects as the same racer instead of a new one.
 */
export function getGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function loadGuestName(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(NAME_KEY) ?? "";
}

export function saveGuestName(name: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NAME_KEY, name);
}

export function clearGuestIdentity(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ID_KEY);
  sessionStorage.removeItem(NAME_KEY);
}
