from app.db import get_connection

conn = get_connection()
cur = conn.cursor()
cur.execute("SELECT id, detected_at, ST_AsText(geom), ST_Area(geom::geography)/1000000.0 AS area_km2 FROM spill_events WHERE id = 60")
print("spill_row", cur.fetchone())
cur.execute("SELECT COUNT(*) FROM ais_positions WHERE ts BETWEEN TIMESTAMP '2017-01-28' AND TIMESTAMP '2017-02-05'")
print("ais_total_window", cur.fetchone())
cur.close()
conn.close()
