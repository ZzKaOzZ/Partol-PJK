import type { AppStore, PatrolRecord, PdRecord, ThermalRecord } from "./types";
import seed from "./data/seedRecords.json";

const KEY = "partol-store-v1";

function withPhoto<T extends { photoData?: string }>(row: T): T {
  return { ...row, photoData: row.photoData ?? "" };
}

function emptyStore(): AppStore {
  return {
    patrol: (seed.patrol as PatrolRecord[]).map(withPhoto),
    thermal: (seed.thermal as ThermalRecord[]).map((row) =>
      withPhoto({ ...row, deltaT: row.deltaT === "" ? "" : Number(row.deltaT) }),
    ),
    pd: (seed.pd as PdRecord[]).map(withPhoto),
  };
}

export function loadStore(): AppStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as AppStore;
    if (!parsed.patrol || !parsed.thermal || !parsed.pd) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: AppStore) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function resetStore(): AppStore {
  const next = emptyStore();
  saveStore(next);
  return next;
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
