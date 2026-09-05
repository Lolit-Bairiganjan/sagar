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