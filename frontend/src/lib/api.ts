export interface Point {
  lat: number;
  lng: number;
  ts: number;
}

export interface StoredPath {
  orderId: string;
  path: Point[];
  createdAt: string;
  updatedAt: string;
}

const BASE = "/api";

export async function getPath(orderId: string): Promise<StoredPath | null> {
  const res = await fetch(`${BASE}/paths/${encodeURIComponent(orderId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch path: ${res.statusText}`);
  return res.json();
}

export async function setPath(orderId: string, points: Point[]) {
  const res = await fetch(`${BASE}/paths/${encodeURIComponent(orderId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });
  if (!res.ok) throw new Error(`Failed to set path: ${res.statusText}`);
  return res.json();
}

export async function appendPoints(orderId: string, points: Point[]) {
  const res = await fetch(`${BASE}/paths/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });
  if (!res.ok) throw new Error(`Failed to append points: ${res.statusText}`);
  return res.json();
}
