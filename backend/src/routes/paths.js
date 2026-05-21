import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/api/paths/:orderId", (req, res) => {
  const { orderId } = req.params;
  const row = db
    .prepare("SELECT order_id, path_data, created_at, updated_at FROM ride_paths WHERE order_id = ?")
    .get(orderId);

  if (!row) {
    return res.status(404).json({ error: "Path not found" });
  }

  res.json({
    orderId: row.order_id,
    path: JSON.parse(row.path_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
});

router.post("/api/paths/:orderId", (req, res) => {
  const { orderId } = req.params;
  const { points } = req.body;

  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: "points must be a non-empty array" });
  }

  const pathData = JSON.stringify(points);

  db.prepare(`
    INSERT INTO ride_paths (order_id, path_data)
    VALUES (?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
      path_data = excluded.path_data,
      updated_at = datetime('now')
  `).run(orderId, pathData);

  res.json({ orderId, count: points.length });
});

router.patch("/api/paths/:orderId", (req, res) => {
  const { orderId } = req.params;
  const { points } = req.body;

  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: "points must be a non-empty array" });
  }

  const existing = db
    .prepare("SELECT path_data FROM ride_paths WHERE order_id = ?")
    .get(orderId);

  let allPoints;
  if (existing) {
    const current = JSON.parse(existing.path_data);
    allPoints = [...current, ...points];
  } else {
    allPoints = points;
  }

  const pathData = JSON.stringify(allPoints);

  db.prepare(`
    INSERT INTO ride_paths (order_id, path_data)
    VALUES (?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
      path_data = excluded.path_data,
      updated_at = datetime('now')
  `).run(orderId, pathData);

  res.json({ orderId, totalCount: allPoints.length, addedCount: points.length });
});

router.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
