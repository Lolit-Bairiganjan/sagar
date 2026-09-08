"""
ais_ingest.py — Real-time AIS Vessel Ingestion Worker.

Streams live ship positions from AisStream.io across the Indian Ocean & EEZ,
and continuously populates the PostGIS `vessels` and `ais_positions` tables.
"""

import asyncio
import json
import os
from pathlib import Path
from datetime import datetime, timezone

import websockets
import psycopg2
from dotenv import load_dotenv

# Load environment variables
_DIR = Path(__file__).resolve().parent
load_dotenv(_DIR.parent.parent / ".env")
load_dotenv()

API_KEY = os.getenv("AISSTREAM_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# AisStream Bounding Boxes: [[lat_max, lon_min], [lat_min, lon_max]]
AIS_REGION = os.getenv("AIS_REGION", "global").lower()

REGIONS = {
    # Worldwide global ocean surveillance
    "global": [[[90.0, -180.0], [-90.0, 180.0]]],
    # Critical global tanker chokepoints
    "chokepoints": [
        [[26.0, 50.0], [0.0, 100.0]],       # Indian Ocean, Arabian Sea & Malacca
        [[27.0, 55.0], [25.0, 57.0]],       # Strait of Hormuz
        [[52.0, 0.5], [50.0, 2.5]],         # English Channel / Strait of Dover
        [[30.0, -91.0], [27.0, -88.0]],     # Gulf of Mexico
        [[15.0, 42.0], [11.0, 45.0]],       # Bab-el-Mandeb & Red Sea
    ],
    # Indian Ocean & EEZ priority waters
    "indian_ocean": [[[26.0, 50.0], [0.0, 100.0]]],
}

ACTIVE_BBOX = REGIONS.get(AIS_REGION, REGIONS["global"])


def get_db_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set in backend/.env")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


async def run_ais_ingestion():
    if not API_KEY:
        print("[!] Error: AISSTREAM_API_KEY is not set in backend/.env", flush=True)
        return

    print("=================================================================", flush=True)
    print("  SAGAR REAL-TIME AIS VESSEL INGESTION SERVICE", flush=True)
    print("=================================================================", flush=True)
    print(f"[*] Target Region : {AIS_REGION.upper()} ({len(ACTIVE_BBOX)} bounding zone(s))", flush=True)
    print(f"[*] Database Host : {DATABASE_URL.split('@')[-1] if DATABASE_URL else 'Not set'}", flush=True)

    while True:
        try:
            print("[*] Connecting to wss://stream.aisstream.io/v0/stream ...", flush=True)
            conn = get_db_connection()
            cur = conn.cursor()

            async with websockets.connect(
                "wss://stream.aisstream.io/v0/stream",
                ping_interval=20,
                ping_timeout=20,
                close_timeout=10,
            ) as ws:
                subscribe_msg = {
                    "APIKey": API_KEY,
                    "BoundingBoxes": ACTIVE_BBOX,
                    "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
                }
                await ws.send(json.dumps(subscribe_msg))
                print(f"[+] Connected to AisStream! Streaming live {AIS_REGION.upper()} ships...", flush=True)

                msg_count = 0
                async for raw_message in ws:
                    try:
                        msg = json.loads(raw_message)
                        msg_type = msg.get("MessageType")
                        meta = msg.get("MetaData", {})
                        mmsi = meta.get("MMSI")

                        # Skip confirmation messages or packets without valid MMSI
                        if not mmsi:
                            continue

                        ship_name = (meta.get("ShipName") or "Unknown").strip()

                        if msg_type == "PositionReport":
                            pos = msg["Message"]["PositionReport"]
                            lat = float(pos["Latitude"])
                            lon = float(pos["Longitude"])

                            # Clean timestamp for PostgreSQL timestamptz (strip trailing " UTC")
                            ts_raw = meta.get("time_utc", "")
                            if ts_raw:
                                clean_ts = ts_raw.replace(" UTC", "").strip()
                            else:
                                clean_ts = datetime.now(timezone.utc).isoformat()

                            # 1. Register vessel name
                            cur.execute(
                                """
                                INSERT INTO vessels (mmsi, name)
                                VALUES (%s, %s)
                                ON CONFLICT (mmsi) DO UPDATE
                                SET name = EXCLUDED.name
                                WHERE vessels.name IS NULL OR vessels.name = 'Unknown';
                                """,
                                (mmsi, ship_name),
                            )

                            # 2. Record spatial position in PostGIS (EPSG:4326)
                            cur.execute(
                                """
                                INSERT INTO ais_positions (mmsi, geom, ts)
                                VALUES (%s, ST_SetSRID(ST_Point(%s, %s), 4326), %s);
                                """,
                                (mmsi, lon, lat, clean_ts),
                            )

                            msg_count += 1
                            print(
                                f"[AIS #{msg_count}] Ingested: {ship_name} (MMSI: {mmsi}) at [{lat:.4f}°N, {lon:.4f}°E] (time: {clean_ts})",
                                flush=True,
                            )

                        elif msg_type == "ShipStaticData":
                            static = msg["Message"]["ShipStaticData"]
                            ais_type = int(static.get("Type", 0))
                            actual_name = (static.get("Name") or ship_name).strip()

                            cur.execute(
                                """
                                INSERT INTO vessels (mmsi, name, ais_type)
                                VALUES (%s, %s, %s)
                                ON CONFLICT (mmsi) DO UPDATE
                                SET name = EXCLUDED.name, ais_type = EXCLUDED.ais_type;
                                """,
                                (mmsi, actual_name, ais_type),
                            )
                            print(f"[AIS Static] Vessel {actual_name} (MMSI: {mmsi}) updated -> AIS Type: {ais_type}", flush=True)

                    except Exception as e:
                        print(f"[!] Packet parsing error: {e}", flush=True)
                        continue

        except Exception as e:
            print(f"[!] WebSocket disconnected ({e}). Reconnecting in 5 seconds...", flush=True)
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run_ais_ingestion())