"""Database queries for persisted reverse-drift reconstruction runs."""

import json

from app.db import get_connection


def get_latest_reconstruction(spill_id: int) -> dict | None:
    """Returns the latest reconstruction run and its ordered frames for a spill."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                r.id,
                r.spill_id,
                r.model_version,
                r.status,
                r.detected_at,
                r.horizon_hours,
                r.start_at,
                r.end_at,
                r.summary,
                r.uncertainty,
                r.input_provenance,
                r.created_at
            FROM reconstruction_runs r
            WHERE r.spill_id = %(spill_id)s
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT 1;
            """,
            {"spill_id": spill_id},
        )
        row = cur.fetchone()
        if row is None:
            cur.close()
            return None

        columns = [description[0] for description in cur.description]
        run = dict(zip(columns, row))
        cur.execute(
            """
            SELECT frame_data
            FROM reconstruction_frames
            WHERE run_id = %(run_id)s
            ORDER BY frame_index;
            """,
            {"run_id": run["id"]},
        )
        run["frames"] = [
            _decode_json(frame_row[0])
            for frame_row in cur.fetchall()
        ]
        cur.close()
        for field in ("summary", "uncertainty", "input_provenance"):
            run[field] = _decode_json(run[field])
        return run
    finally:
        conn.close()


def _decode_json(value):
    if isinstance(value, str):
        return json.loads(value)
    return value
