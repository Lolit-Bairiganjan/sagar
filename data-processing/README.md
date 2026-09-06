# Dev 1 — Sentinel-1 SAR Preprocessing & Tiling Pipeline

This module is responsible for converting raw Sentinel-1 GRD SAR data into
model-ready 3-band GeoTIFF tiles for the downstream AI/ML pipeline.

---

## 1. Role in the Overall Project

The complete project follows this high-level architecture:

```text
                    SENTINEL-1 SAR DATA
                           │
                           ▼
                 ┌───────────────────┐
                 │   DEV 1 PIPELINE  │
                 │                   │
                 │  SAR Preprocessing│
                 │  Normalization    │
                 │  Tiling           │
                 └─────────┬─────────┘
                           │
                           ▼
                 416 × 416 GeoTIFF
                    3-band input
                           │
                           ▼
                 ┌───────────────────┐
                 │   DEV 2 — AI/ML   │
                 │                   │
                 │ YOLOv8-Seg / U-Net│
                 │ Oil-spill         │
                 │ segmentation      │
                 └─────────┬─────────┘
                           │
                           ▼
                    Oil-spill mask
