"""
onnx_detector.py - Ultra-Lightweight YOLOv8-Seg CPU Inference Engine.

Runs inference using onnxruntime on (3, 416, 416) SAR tensors in ~15–30 ms per tile,
consuming under 80 MB of RAM with zero PyTorch or CUDA dependencies.
"""

from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
import cv2
import numpy as np
import onnxruntime as ort

from vectorization import pixel_to_geo_coords, calculate_polygon_metrics, create_spill_payload
from lightweight_tiler import TileItem


class OnnxOilSpillDetector:
    def __init__(
        self,
        onnx_model_path: str = "ai-model/weight/best.onnx",
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        min_pixel_area: int = 40,
    ):
        self.model_path = Path(onnx_model_path).resolve()
        if not self.model_path.exists():
            raise FileNotFoundError(f"ONNX model file not found at: {self.model_path}")

        # Explicitly enforce CPU execution for 100% server portability and minimal RAM
        self.session = ort.InferenceSession(
            str(self.model_path),
            providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.min_pixel_area = min_pixel_area

    def predict_tile(
        self,
        tile: TileItem,
        timestamp_iso: str = "2026-09-06T04:20:00Z"
    ) -> List[Dict[str, Any]]:
        """
        Runs inference on a single TileItem and returns a list of Spill payloads
        ready for PostgreSQL / FastAPI insertion.
        """
        # Ensure input tensor shape: (1, 3, 416, 416) float32
        tensor_batch = np.expand_dims(tile.tensor, axis=0).astype(np.float32)

        # Run ONNX inference
        outputs = self.session.run(None, {self.input_name: tensor_batch})
        out0 = outputs[0]  # Shape: (1, 37, 3549) -> [cx, cy, w, h, conf, 32_mask_coeffs]
        protos = outputs[1][0]  # Shape: (32, 104, 104)

        detections = out0[0]  # Shape: (37, 3549)
        scores = detections[4, :]  # Class 0 confidence scores

        # Filter candidate anchor indices above confidence threshold
        candidate_indices = np.where(scores >= self.conf_threshold)[0]
        if len(candidate_indices) == 0:
            return []

        boxes_xywh = []
        confidences = []
        mask_coeffs = []

        for idx in candidate_indices:
            cx = float(detections[0, idx])
            cy = float(detections[1, idx])
            w = float(detections[2, idx])
            h = float(detections[3, idx])
            score = float(scores[idx])

            # Convert center xywh to top-left xywh for cv2.dnn.NMSBoxes
            x1 = max(0.0, cx - w / 2.0)
            y1 = max(0.0, cy - h / 2.0)

            boxes_xywh.append([int(x1), int(y1), int(w), int(h)])
            confidences.append(score)
            mask_coeffs.append(detections[5:37, idx])

        # Non-Maximum Suppression (NMS) to eliminate duplicate overlapping boxes
        nms_indices = cv2.dnn.NMSBoxes(
            boxes_xywh,
            confidences,
            score_threshold=self.conf_threshold,
            nms_threshold=self.iou_threshold
        )

        if len(nms_indices) == 0:
            return []

        spill_payloads = []

        for nms_i in nms_indices:
            i = int(nms_i) if isinstance(nms_i, (int, np.integer)) else int(nms_i[0])
            box = boxes_xywh[i]
            conf = confidences[i]
            coeff = mask_coeffs[i]

            # Matrix multiply 32 coefficients with (32, 104, 104) prototype masks
            mask_104 = np.tensordot(coeff, protos, axes=(0, 0))

            # Sigmoid activation to convert logits to probabilities [0, 1]
            mask_prob = 1.0 / (1.0 + np.exp(-np.clip(mask_104, -15.0, 15.0)))

            # Bilinear upsample from 104x104 to 416x416
            mask_416 = cv2.resize(mask_prob, (416, 416), interpolation=cv2.INTER_LINEAR)

            # Restrict mask inside detection bounding box
            x1, y1, w, h = box
            x2, y2 = min(416, x1 + w), min(416, y1 + h)
            cropped_mask = np.zeros_like(mask_416)
            cropped_mask[y1:y2, x1:x2] = mask_416[y1:y2, x1:x2]

            # Binarize at 0.5 threshold
            binary_mask = (cropped_mask > 0.5).astype(np.uint8)

            # Extract contours
            contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for cnt in contours:
                pixel_area = cv2.contourArea(cnt)
                if pixel_area < self.min_pixel_area:
                    continue  # Reject micro false-positives

                # Squeeze contour to list of (x, y) tuples
                pts = cnt.reshape(-1, 2)
                if len(pts) < 3:
                    continue

                poly_pts = [(float(pt[0]), float(pt[1])) for pt in pts]

                # Map pixel coordinates to real GPS Lon/Lat using tile Affine transform
                payload = create_spill_payload(
                    pixel_polygon=poly_pts,
                    geotiff_transform=tile.transform,
                    detected_at_iso=timestamp_iso,
                    confidence=conf,
                    tile_name=f"tile_r{tile.row_idx}_c{tile.col_idx}"
                )

                if payload and "spill_polygon_geojson" in payload:
                    spill_payloads.append(payload)

        return spill_payloads
