"""
lightweight_tiler.py - Fast In-Memory Normalization and Tiling Engine.

Adapts Dev 1's P2/P98 percentile normalization formula for 3-band calibrated GeoTIFFs,
producing in-memory (3, 416, 416) candidate tensors without writing hundreds of intermediate files.
"""

import math
from typing import List, Tuple, Dict, Any
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.windows import transform as window_transform


TILE_SIZE = 416
LOWER_PERCENTILE = 2
UPPER_PERCENTILE = 98


def normalize_percentiles(data: np.ndarray, lower: int = LOWER_PERCENTILE, upper: int = UPPER_PERCENTILE) -> np.ndarray:
    """Normalizes an array to 0–1 using P2/P98 percentile clipping, matching tile_sentinel1.py."""
    valid = np.isfinite(data)
    if not np.any(valid):
        return np.zeros(data.shape, dtype=np.float32)

    p_low = np.percentile(data[valid], lower)
    p_high = np.percentile(data[valid], upper)

    if p_high == p_low:
        return np.zeros(data.shape, dtype=np.float32)

    clipped = np.clip(data, p_low, p_high)
    norm = (clipped - p_low) / (p_high - p_low)
    return norm.astype(np.float32)


class TileItem:
    def __init__(
        self,
        tensor: np.ndarray,        # Shape: (3, 416, 416), float32 in [0, 1]
        tile_transform: rasterio.Affine,
        window: Window,
        row_idx: int,
        col_idx: int
    ):
        self.tensor = tensor
        self.transform = tile_transform
        self.window = window
        self.row_idx = row_idx
        self.col_idx = col_idx


def slice_geotiff_into_tiles(geotiff_path: str, tile_size: int = TILE_SIZE) -> List[TileItem]:
    """
    Opens a 3-band calibrated GeoTIFF (VV, VH, VV-VH) and returns a list of normalized
    TileItem objects ready for direct YOLOv8-Seg inference.
    """
    tiles = []

    with rasterio.open(geotiff_path) as src:
        width = src.width
        height = src.height
        src_transform = src.transform

        # Read bands
        vv_raw = src.read(1).astype(np.float32)
        vh_raw = src.read(2).astype(np.float32)
        diff_raw = src.read(3).astype(np.float32) if src.count >= 3 else (vv_raw - vh_raw)

        # Apply P2/P98 percentile normalization matching Dev 1 training contract
        vv_norm = normalize_percentiles(vv_raw)
        vh_norm = normalize_percentiles(vh_raw)
        diff_norm = normalize_percentiles(diff_raw)

        rows = math.ceil(height / tile_size)
        cols = math.ceil(width / tile_size)

        for r in range(rows):
            for c in range(cols):
                x = c * tile_size
                y = r * tile_size

                w_width = min(tile_size, width - x)
                w_height = min(tile_size, height - y)

                win = Window(x, y, w_width, w_height)
                tile_affine = window_transform(win, src_transform)

                # Initialize padded (3, 416, 416) tensor
                tile_tensor = np.zeros((3, tile_size, tile_size), dtype=np.float32)
                tile_tensor[0, :w_height, :w_width] = vv_norm[y:y + w_height, x:x + w_width]
                tile_tensor[1, :w_height, :w_width] = vh_norm[y:y + w_height, x:x + w_width]
                tile_tensor[2, :w_height, :w_width] = diff_norm[y:y + w_height, x:x + w_width]

                tiles.append(TileItem(
                    tensor=tile_tensor,
                    tile_transform=tile_affine,
                    window=win,
                    row_idx=r,
                    col_idx=c
                ))

    return tiles
