import json
from app.db import get_connection
from app.services.drift import estimate_spill_area_km2, process_new_spill

conn = get_connection()
cur = conn.cursor()
cur.execute("SELECT id, detected_at, ST_AsGeoJSON(geom) FROM spill_events ORDER BY id DESC LIMIT 1;")
row = cur.fetchone()
cur.close(); conn.close()
spill_id, detected_at, geom_json = row
geom = json.loads(geom_json)
ring = geom["coordinates"][0]
centroid_lon = sum(pt[0] for pt in ring) / len(ring)
centroid_lat = sum(pt[1] for pt in ring) / len(ring)
area_km2 = estimate_spill_area_km2(geom)
print("BEFORE", spill_id, detected_at, area_km2)
result = process_new_spill(spill_id, float(centroid_lat), float(centroid_lon), detected_at, spill_area_km2=area_km2)
print("RESULT", json.dumps(result, default=str))
