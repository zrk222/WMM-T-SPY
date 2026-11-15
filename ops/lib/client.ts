"use client";

export function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const method = init.method ?? "GET";
  const res = await fetch(path, {
    method,
    headers: {
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(method !== "GET" ? { "x-csrf": csrf() } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}
