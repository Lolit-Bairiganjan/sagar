from app.db import get_connection


def get_suspects_for_spill(spill_id: int):
    """
    Runs the Version 3 correlation query for a given spill_id and
    returns a list of ranked suspects as plain dictionaries.
    """
    query = """
        WITH target_spill AS (
            SELECT
                se.id AS spill_id,
                se.detected_at,
                ST_Transform(se.geom, 32645) AS geom_m,
                ST_Area(ST_Transform(se.geom, 32645)) / 1000000.0 AS area_km2
            FROM spill_events se
            WHERE se.id = %(spill_id)s
        ),
        spill_estimates AS (
            SELECT
                *,
                GREATEST(1, LEAST(24, area_km2 / 0.4)) AS estimated_hours_elapsed,
                500 + (0.3 * GREATEST(1, LEAST(24, area_km2 / 0.4)) * 3600) AS dynamic_buffer_m
            FROM target_spill
        ),
        buffered_spill AS (
            SELECT *, ST_Buffer(geom_m, dynamic_buffer_m) AS buffered_geom_m
            FROM spill_estimates
        ),
        candidate_positions AS (
            SELECT
                a.mmsi, v.name, a.ts,
                bs.spill_id, bs.detected_at, bs.estimated_hours_elapsed,
                EXTRACT(EPOCH FROM (bs.detected_at - a.ts)) / 3600.0 AS hours_before_detection,
                ST_Distance(ST_Transform(a.geom, 32645), bs.geom_m) AS distance_m,
                bs.dynamic_buffer_m
            FROM ais_positions a
            JOIN vessels v ON v.mmsi = a.mmsi
            CROSS JOIN buffered_spill bs
            WHERE a.ts BETWEEN bs.detected_at - INTERVAL '48 hours' AND bs.detected_at
              AND ST_DWithin(ST_Transform(a.geom, 32645), bs.buffered_geom_m, 0)
        ),
        scored_positions AS (
            SELECT
                *,
                EXP(-distance_m / (dynamic_buffer_m / 3.0)) AS distance_score,
                EXP(-POWER(hours_before_detection - estimated_hours_elapsed, 2) / (2 * POWER(8, 2))) AS time_score
            FROM candidate_positions
        ),
        ranked_suspects AS (
            SELECT
                name, mmsi,
                MIN(distance_m) AS min_distance_m,
                MAX(distance_score) AS best_distance_score,
                MAX(time_score) AS best_time_score,
                (0.5 * MAX(distance_score) + 0.5 * MAX(time_score)) AS suspicion_score
            FROM scored_positions
            GROUP BY name, mmsi
        )
        SELECT
            name, mmsi,
            ROUND(min_distance_m::numeric, 1) AS min_distance_m,
            ROUND(best_distance_score::numeric, 3) AS distance_score,
            ROUND(best_time_score::numeric, 3) AS time_score,
            ROUND(suspicion_score::numeric, 3) AS suspicion_score
        FROM ranked_suspects
        ORDER BY suspicion_score DESC;
    """

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(query, {"spill_id": spill_id})
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        results = [dict(zip(columns, row)) for row in rows]
        cur.close()
        return results
    finally:
        conn.close()
        