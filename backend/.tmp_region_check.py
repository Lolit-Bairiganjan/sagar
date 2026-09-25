from app.db import get_connection

conn = get_connection()
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM ais_positions WHERE ts >= NOW() - INTERVAL '1 hour'")
print("ais_last_hour", cur.fetchone())
cur.execute("SELECT COUNT(*) FROM ais_positions WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(57.7484375, -20.3542067), 4326)::geography, 50000)")
print("ais_near_spill_point", cur.fetchone())
cur.execute("SELECT COUNT(*) FROM ais_positions WHERE ts >= NOW() - INTERVAL '1 hour' AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(57.7484375, -20.3542067), 4326)::geography, 50000)")
print("ais_near_point_recent", cur.fetchone())
cur.close()
conn.close()
