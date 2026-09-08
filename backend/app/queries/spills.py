import json
from app.db import get_connection


def insert_spill(spill_data) -> int:
    """Inserts the spill row and returns its new id."""
    query = """
        INSERT INTO spill_events (geom, detected_at)
        VALUES (ST_SetSRID(ST_GeomFromGeoJSON(%(geom)s), 4326), %(detected_at)s)
        RETURNING id;
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(query, {
            "geom": json.dumps(spill_data.spill_polygon_geojson),
            "detected_at": spill_data.detected_at,
        })
        spill_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return spill_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_all_spills(limit: int = 50) -> list[dict]:
    """
    Retrieves historical oil spill events with calculated slick areas (km2),
    centroids, and reverse-drift parameters.
    """
    query = """
        SELECT 
            s.id,
            s.detected_at,
            ROUND((ST_Area(s.geom::geography) / 1000000.0)::numeric, 2) AS area_km2,
            ROUND(ST_Y(ST_Centroid(s.geom))::numeric, 4) AS centroid_lat,
            ROUND(ST_X(ST_Centroid(s.geom))::numeric, 4) AS centroid_lon,
            r.wind_speed_kmh,
            r.wind_direction_deg,
            r.current_speed_kmh,
            r.current_direction_deg,
            r.total_drift_distance_km,
            r.combined_drift_direction_deg,
            r.drift_hours_assumed,
            (r.computed_at IS NOT NULL) AS has_drift_estimate
        FROM spill_events s
        LEFT JOIN reverse_drift_estimates r ON r.spill_id = s.id
        ORDER BY s.detected_at DESC, s.id DESC
        LIMIT %(limit)s;
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(query, {"limit": limit})
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
        cur.close()
        return rows
    finally:
        conn.close()


def get_spill_by_id(spill_id: int) -> dict | None:
    """
    Retrieves full details for a single spill event including its GeoJSON polygon,
    reverse-drift parameters, and calculated origin point.
    """
    query = """
        SELECT 
            s.id,
            s.detected_at,
            ROUND((ST_Area(s.geom::geography) / 1000000.0)::numeric, 2) AS area_km2,
            ROUND(ST_Y(ST_Centroid(s.geom))::numeric, 4) AS centroid_lat,
            ROUND(ST_X(ST_Centroid(s.geom))::numeric, 4) AS centroid_lon,
            ST_AsGeoJSON(s.geom) AS polygon_geojson,
            r.wind_speed_kmh,
            r.wind_direction_deg,
            r.current_speed_kmh,
            r.current_direction_deg,
            r.current_data_source,
            r.combined_drift_speed_kmh,
            r.combined_drift_direction_deg,
            r.total_drift_distance_km,
            r.drift_hours_assumed,
            r.computed_at,
            CASE 
                WHEN r.total_drift_distance_km IS NOT NULL AND r.combined_drift_direction_deg IS NOT NULL THEN
                    ST_AsGeoJSON(
                        ST_Project(
                            ST_Centroid(s.geom)::geography,
                            r.total_drift_distance_km * 1000.0,
                            radians(MOD(CAST(r.combined_drift_direction_deg + 180 AS numeric), 360))
                        )::geometry
                    )
                ELSE NULL
            END AS estimated_origin_geojson
        FROM spill_events s
        LEFT JOIN reverse_drift_estimates r ON r.spill_id = s.id
        WHERE s.id = %(spill_id)s;
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(query, {"spill_id": spill_id})
        row = cur.fetchone()
        if not row:
            cur.close()
            return None
        columns = [desc[0] for desc in cur.description]
        data = dict(zip(columns, row))
        cur.close()

        # Parse polygon and origin GeoJSON strings to native JSON objects
        if data.get("polygon_geojson"):
            data["polygon_geojson"] = json.loads(data["polygon_geojson"])
        if data.get("estimated_origin_geojson"):
            data["estimated_origin_geojson"] = json.loads(data["estimated_origin_geojson"])

        return data
    finally:
        conn.close()