# Backend

FastAPI service for spill records, drift estimates, AIS correlation, and
satellite surveillance.

## Reverse-drift reconstructions

Each successful stepwise drift calculation stores the existing summary estimate
and, in the same database transaction, a reconstruction run plus its ordered
timestamped frames. Run metadata includes the model version, detection time,
horizon, input provenance, summary, and uncertainty/limitation metadata. Each
frame includes its estimated position and the hourly forcing values used for
that step.

Retrieve the latest stored run and frames with:

```text
GET /api/spills/{spill_id}/reconstruction
```

The endpoint returns `404` if the spill does not exist or has no persisted
reconstruction yet. The same routes are also mounted without the `/api` prefix.

New deployments can use `sql/init_schema.sql`. Existing databases should apply
`sql/migrations/002_add_drift_reconstructions.sql`; application startup also
creates the two reconstruction tables if they are absent.

The frontend requests persisted frames for database-backed spills and uses
them to drive the investigator timeline and reconstructed position marker.
Frames are point estimates; no frame-level slick area or calibrated position
bounds are available. When a spill has no persisted run, the timeline reports
that explicitly rather than substituting synthetic reconstruction frames.

Coastline interaction is unsupported: reconstructed positions are not checked
against or clipped to a shoreline, so a path may cross land. The model also
does not represent slick breakup/patchiness, emulsification, or frame-level
area change. These limitations are exposed as structured reconstruction
uncertainty metadata and in the investigator timeline. No coastal or
fragmentation correction is inferred from missing observations.

## Surveillance scan integration

Scan responses keep persisted spill IDs aligned with their original detection
indexes, including `null` entries for detections that could not be saved. Each
detection also carries its own AIS candidate list and lookup status, so the
frontend can load the selected spill's detail and persisted reconstruction.
Candidates are returned only from the connected AIS database; an empty or
unavailable AIS search is reported as such and is not replaced with demo
vessels. A missing stored drift estimate does not create a default confidence,
release time, or forecast.

## AIS origin-corridor matching

Suspect ranking searches AIS pings in an initial ±1-hour window around the
estimated discharge time, ending no later than satellite detection. Positions
must also fall within an origin-centered radius selected from the existing
spill-area tiers (5, 10, or 25 km). These are operational search heuristics,
not calibrated uncertainty bounds; sparse or missing AIS can still omit a
relevant vessel.

When adjacent AIS pings are no more than two hours apart, course is derived
from the ping trajectory and compared with the axis from the estimated origin
to the observed spill centroid. This contributes ranking evidence only; it
does not prove a discharge or establish alignment with the slick's shape.
Candidates without usable adjacent pings are scored without this factor. The
resulting final score is a ranking score, not an attribution probability.

## Validation status and release gates

The automated backend suite includes controlled synthetic drift cases
(direction, known constant-current origin, ordered hourly frames, missing
timestamps/values, and declared coastline/oil-model limitations) and unit
checks for AIS time-window/corridor selection. These validate implementation
behavior under those inputs; they do not establish real-world reconstruction
accuracy.

The repository does not currently contain a source-verified incident dataset
with independently established discharge times/origins and AIS tracks that
can be rerun through the current model. CSVs labeled as examples or public
incidents have prefilled candidate lists and/or lack source and label
provenance, so they are not used as model-accuracy results. The synthetic
suspect benchmark is a simplified robustness illustration, not the PostGIS
ranking implementation; its scores must not be used as production performance
claims. Its scorer does not receive the culprit label.

Before treating results as operationally validated, build a documented,
independently labeled incident set; replay historical hourly forcing and AIS
with the same production code and coverage rules; report misses and errors
including data gaps, origin shifts, coastlines, sparse AIS, and decoys; and
verify the migration/API against a non-production Postgres/PostGIS database.
Keep origin uncertainty and suspect ranking uncalibrated until a suitable
validation design supports calibration.