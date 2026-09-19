from app.db import get_connection

conn = get_connection()
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM spill_events WHERE id = 60")
print("spill_exists", cur.fetchone())
cur.execute("SELECT COUNT(*) FROM reverse_drift_estimates WHERE spill_id = 60")
print("drift_estimate_rows", cur.fetchone())
cur.execute("SELECT COUNT(*) FROM ais_positions WHERE ts BETWEEN TIMESTAMP '2017-01-28' AND TIMESTAMP '2017-02-05' AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(57.7484375, -20.3542067), 4326)::geography, 50000)")
print("ais_in_aoi_window", cur.fetchone())
cur.close()
conn.close()
