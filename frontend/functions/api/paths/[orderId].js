export async function onRequest({ env, request, params }) {
  const { orderId } = params;
  const db = env.grabpo_db;
  const cors = { "Access-Control-Allow-Origin": "*" };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // GET /api/paths/:orderId
  if (request.method === "GET") {
    const row = await db
      .prepare("SELECT order_id, path_data, created_at, updated_at FROM ride_paths WHERE order_id = ?")
      .bind(orderId)
      .first();

    if (!row) {
      return new Response(JSON.stringify({ error: "Path not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    return new Response(
      JSON.stringify({
        orderId: row.order_id,
        path: JSON.parse(row.path_data),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
      { headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  // POST /api/paths/:orderId (set/replace)
  if (request.method === "POST") {
    const body = await request.json();
    const { points } = body;

    if (!Array.isArray(points) || points.length === 0) {
      return new Response(JSON.stringify({ error: "points must be a non-empty array" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const pathData = JSON.stringify(points);

    await db
      .prepare(
        `INSERT INTO ride_paths (order_id, path_data)
         VALUES (?, ?)
         ON CONFLICT(order_id) DO UPDATE SET
           path_data = excluded.path_data,
           updated_at = datetime('now')`
      )
      .bind(orderId, pathData)
      .run();

    return new Response(JSON.stringify({ orderId, count: points.length }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  // PATCH /api/paths/:orderId (append)
  if (request.method === "PATCH") {
    const body = await request.json();
    const { points } = body;

    if (!Array.isArray(points) || points.length === 0) {
      return new Response(JSON.stringify({ error: "points must be a non-empty array" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const existing = await db
      .prepare("SELECT path_data FROM ride_paths WHERE order_id = ?")
      .bind(orderId)
      .first();

    let allPoints;
    if (existing) {
      const current = JSON.parse(existing.path_data);
      allPoints = [...current, ...points];
    } else {
      allPoints = points;
    }

    const pathData = JSON.stringify(allPoints);

    await db
      .prepare(
        `INSERT INTO ride_paths (order_id, path_data)
         VALUES (?, ?)
         ON CONFLICT(order_id) DO UPDATE SET
           path_data = excluded.path_data,
           updated_at = datetime('now')`
      )
      .bind(orderId, pathData)
      .run();

    return new Response(
      JSON.stringify({ orderId, totalCount: allPoints.length, addedCount: points.length }),
      { headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
