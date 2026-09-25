You are helping build a free-tier validation set for a maritime spill-suspect attribution project.

Your task is to create a benchmark dataset that deliberately exposes weaknesses in the model, not to hide them.

Goal:
- collect a set of synthetic and/or public subset cases where the actual culprit vessel is known
- include both clean cases and adversarial cases
- ensure the benchmark is honest and transparent about missing AIS, ambiguous decoys, port activity, dark targets, and poor origin estimation
- do not fabricate good results; make the benchmark useful for improving the model

Required benchmark CSV columns:
incident_id,incident_name,detected_at,actual_culprit_mmsi,actual_culprit_name,actual_origin_lat,actual_origin_lon,observed_area_km2,candidate_mmsis

Requirements:
- Prefer realistic times and coordinates for maritime spill scenarios.
- Include at least these challenge types:
  - clean case
  - nearby decoy vessel
  - port/harbour vessel confusion
  - dark vessel or AIS gap
  - missing AIS coverage
  - poor origin estimate leading to wrong search window
  - low-coverage area or sparse vessel density
- Keep the dataset honest: if AIS is missing, mark that in the case description or benchmark notes.
- Do not add only easy cases; include difficult cases where the project may fail.
- The purpose is to improve the model, not to present a polished demo.

Output format:
- CSV rows only, clearly separated
- Include realistic but synthetic values if needed, with the explicit intent of robustness testing
- When using public incidents, label the source clearly

Evaluation target:
- Hit@1
- Hit@3
- Hit@5
- average true culprit rank
- miss rate

Important:
- do not overfit to easy examples
- do not hide failure modes
- include failure cases and explain the reason they fail
