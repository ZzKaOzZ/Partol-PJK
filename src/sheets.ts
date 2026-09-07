import type { AppStore, PatrolRecord, PdRecord, TabId, ThermalRecord } from "./types";

export const SHEET_ID = "1-uyaYvEDLgl0yNn_cpoS1WxPhZCEvv9FlQIrkweeeTo";
export const DATA_GID = "1374913182";
export const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${DATA_GID}#gid=${DATA_GID}`;
export const SCRIPT_URL_KEY = "partol-apps-script-url";

export function getScriptUrl() {
  const stored = localStorage.getItem(SCRIPT_URL_KEY)?.trim() ?? "";
  const fromEnv = import.meta.env.VITE_APPS_SCRIPT_URL?.trim() ?? "";
  return stored || fromEnv;
}

export function setScriptUrl(url: string) {
  const value = url.trim();
  if (value) localStorage.setItem(SCRIPT_URL_KEY, value);
  else localStorage.removeItem(SCRIPT_URL_KEY);
}

export function compressImage(dataUrl: string, maxWidth = 1280, quality = 0.72) {
  return new Promise<string>((resolve, reject) => {
    if (!dataUrl.startsWith("data:image/")) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("อ่านรูปไม่สำเร็จ"));
    img.src = dataUrl;
  });
}

function scriptEndpoint(query = "") {
  const base = getScriptUrl().replace(/\/+$/, "");
  if (!base) return "";
  return query ? `${base}${base.includes("?") ? "&" : "?"}${query}` : base;
}

async function postScript(payload: Record<string, unknown>) {
  const url = scriptEndpoint();
  if (!url) return null;
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    const text = await res.text();
    if (!text) return { ok: true, opaque: true };
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    return { ok: true, opaque: true };
  }
}

export async function fetchRemoteStore(): Promise<AppStore | null> {
  const url = scriptEndpoint("action=list");
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<AppStore> & { ok?: boolean };
    if (!data?.patrol && !data?.thermal && !data?.pd) return null;
    return {
      patrol: (data.patrol ?? []) as PatrolRecord[],
      thermal: (data.thermal ?? []) as ThermalRecord[],
      pd: (data.pd ?? []) as PdRecord[],
    };
  } catch {
    return null;
  }
}

export async function upsertRemote(tab: TabId, record: PatrolRecord | ThermalRecord | PdRecord) {
  const payload = {
    ...record,
    photoData: record.photoData?.startsWith("data:") ? record.photoData : "",
  };
  const result = await postScript({ action: "upsert", tab, record: payload });
  if (!result || result.ok === false) return null;
  if (result.opaque) return record;
  const updated = result.record as PatrolRecord | ThermalRecord | PdRecord | undefined;
  return updated ? { ...record, ...updated } : record;
}

export async function deleteRemote(tab: TabId, id: string) {
  await postScript({ action: "delete", tab, id });
}

export function mergeStore(local: AppStore, remote: AppStore): AppStore {
  function merge<T extends { id: string; createdAt: string }>(a: T[], b: T[]) {
    const map = new Map<string, T>();
    for (const row of a) map.set(row.id, row);
    for (const row of b) {
      const prev = map.get(row.id);
      map.set(row.id, prev ? { ...prev, ...row } : row);
    }
    return [...map.values()].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }
  return {
    patrol: merge(local.patrol, remote.patrol),
    thermal: merge(local.thermal, remote.thermal),
    pd: merge(local.pd, remote.pd),
  };
}

export function photoSrc(record: { photoData?: string; photoUrl?: string }) {
  if (record.photoData?.startsWith("data:") || record.photoData?.startsWith("http")) {
    return record.photoData;
  }
  return record.photoUrl ?? "";
}
