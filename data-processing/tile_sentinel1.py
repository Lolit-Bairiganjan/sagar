import argparse
import glob
import math
import os
import shutil
import tempfile

import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.windows import transform


# ============================================================
# DEV 1 CONFIGURATION
# ============================================================

TILE_SIZE = 416

LOWER_PERCENTILE = 2
UPPER_PERCENTILE = 98


# ============================================================
# SAR CONVERSION
# ============================================================

def convert_to_db(data):
    """Convert linear Sigma0 backscatter to dB."""

    valid = data > 0

    db = np.full(data.shape, np.nan, dtype=np.float32)

    db[valid] = 10 * np.log10(data[valid])

    return db


# ============================================================
# NORMALIZATION
# ============================================================

def normalize(data):
    """Normalize data to 0–1 using P2/P98 percentile clipping."""

    valid = np.isfinite(data)

    if not np.any(valid):
        return np.zeros(data.shape, dtype=np.float32)

    p_low = np.percentile(
        data[valid],
        LOWER_PERCENTILE
    )

    p_high = np.percentile(
        data[valid],
        UPPER_PERCENTILE
    )

    if p_high == p_low:
        return np.zeros(data.shape, dtype=np.float32)

    normalized = np.zeros(
        data.shape,
        dtype=np.float32
    )

    normalized[valid] = (
        (data[valid] - p_low)
        / (p_high - p_low)
    )

    normalized[valid] = np.clip(
        normalized[valid],
        0,
        1
    )

    return normalized


# ============================================================
# 3-BAND MODEL INPUT
# ============================================================

def create_composite(vh_linear, vv_linear):
    """
    Create normalized model channels:

    Band 1 = VV dB, normalized 0–1
    Band 2 = VH dB, normalized 0–1
    Band 3 = VV dB - VH dB, normalized 0–1
    """

    print("Converting Sigma0 to dB...")

    vh_db = convert_to_db(vh_linear)
    vv_db = convert_to_db(vv_linear)

    print("Calculating VV - VH...")

    difference_db = vv_db - vh_db

    print("Normalizing VV...")
    vv_norm = normalize(vv_db)

    print("Normalizing VH...")
    vh_norm = normalize(vh_db)

    print("Normalizing VV - VH...")
    difference_norm = normalize(difference_db)

    return (
        vv_norm,
        vh_norm,
        difference_norm
    )


# ============================================================
# TILING
# ============================================================

def create_tiles(vv, vh, difference, src, output_dir):
    """Create 416x416 GeoTIFF tiles."""

    height, width = vv.shape

    rows = math.ceil(
        height / TILE_SIZE
    )

    cols = math.ceil(
        width / TILE_SIZE
    )

    total_tiles = rows * cols

    valid_tiles = 0
    empty_tiles = 0

    os.makedirs(
        output_dir,
        exist_ok=True
    )

    print()
    print("Scene size:")
    print(f"  Width  : {width}")
    print(f"  Height : {height}")

    print()
    print(
        f"Tile size: "
        f"{TILE_SIZE} × {TILE_SIZE}"
    )

    print(
        f"Candidate tiles: "
        f"{rows} rows × {cols} columns"
    )

    print(
        f"Total candidate tiles: "
        f"{total_tiles}"
    )

    print()

    for row in range(rows):

        for col in range(cols):

            x = col * TILE_SIZE
            y = row * TILE_SIZE

            window_width = min(
                TILE_SIZE,
                width - x
            )

            window_height = min(
                TILE_SIZE,
                height - y
            )

            window = Window(
                x,
                y,
                window_width,
                window_height
            )

            # ------------------------------------------------
            # Create padded 416 × 416 arrays
            # ------------------------------------------------

            tile_vv = np.zeros(
                (TILE_SIZE, TILE_SIZE),
                dtype=np.float32
            )

            tile_vh = np.zeros(
                (TILE_SIZE, TILE_SIZE),
                dtype=np.float32
            )

            tile_difference = np.zeros(
                (TILE_SIZE, TILE_SIZE),
                dtype=np.float32
            )

            tile_vv[
                :window_height,
                :window_width
            ] = vv[
                y:y + window_height,
                x:x + window_width
            ]

            tile_vh[
                :window_height,
                :window_width
            ] = vh[
                y:y + window_height,
                x:x + window_width
            ]

            tile_difference[
                :window_height,
                :window_width
            ] = difference[
                y:y + window_height,
                x:x + window_width
            ]

            # ------------------------------------------------
            # Stack model channels
            # ------------------------------------------------

            data = np.stack(
                [
                    tile_vv,
                    tile_vh,
                    tile_difference
                ]
            )

            # ------------------------------------------------
            # Keep tile if ANY pixel has information
            # ------------------------------------------------

            valid_pixels = np.any(
                data != 0,
                axis=0
            )

            if not np.any(valid_pixels):

                empty_tiles += 1

                continue

            # ------------------------------------------------
            # Preserve geographic transform
            # ------------------------------------------------

            tile_transform = transform(
                window,
                src.transform
            )

            # ------------------------------------------------
            # GeoTIFF profile
            # ------------------------------------------------

            profile = src.profile.copy()

            profile.update(
                driver="GTiff",
                width=TILE_SIZE,
                height=TILE_SIZE,
                count=3,
                dtype="float32",
                nodata=0,
                transform=tile_transform,
                compress="lzw"
            )

            tile_name = (
                f"tile_r{row:03d}_c{col:03d}.tif"
            )

            output_file = os.path.join(
                output_dir,
                tile_name
            )

            with rasterio.open(
                output_file,
                "w",
                **profile
            ) as dst:

                dst.write(data)

            valid_tiles += 1

    print()
    print("================================")
    print("DEV 1 PIPELINE COMPLETE")
    print("================================")

    print(
        f"Candidate tiles : "
        f"{total_tiles}"
    )

    print(
        f"Valid tiles     : "
        f"{valid_tiles}"
    )

    print(
        f"Empty skipped   : "
        f"{empty_tiles}"
    )

    print(
        f"Tile size       : "
        f"{TILE_SIZE} × {TILE_SIZE}"
    )

    print("Bands           : 3")

    print(
        f"CRS             : "
        f"{src.crs}"
    )

    print(
        f"Output          : "
        f"{output_dir}"
    )

    print("================================")


# ============================================================
# FIND PYROSAR OUTPUTS
# ============================================================

def find_sigma0_files(processing_dir):
    """
    Find the Sigma0 VV and VH GeoTIFFs generated by pyroSAR.
    """

    tif_files = glob.glob(
        os.path.join(
            processing_dir,
            "*_sigma0-*.tif"
        )
    )

    vv_file = None
    vh_file = None

    for tif_file in tif_files:

        filename = os.path.basename(
            tif_file
        ).lower()

        if "_vv_sigma0-" in filename:
            vv_file = tif_file

        elif "_vh_sigma0-" in filename:
            vh_file = tif_file

    if vv_file is None:
        raise FileNotFoundError(
            "Could not find Sigma0 VV GeoTIFF "
            "generated by pyroSAR."
        )

    if vh_file is None:
        raise FileNotFoundError(
            "Could not find Sigma0 VH GeoTIFF "
            "generated by pyroSAR."
        )

    return vv_file, vh_file


# ============================================================
# RAW SENTINEL-1 PREPROCESSING
# ============================================================

def preprocess_safe(safe_file, processing_dir):
    """
    Process raw Sentinel-1 GRD SAFE using pyroSAR/SNAP.

    Output:
        Linear Sigma0 VV GeoTIFF
        Linear Sigma0 VH GeoTIFF
    """

    from pyroSAR.snap import geocode

    print()
    print("================================")
    print("SENTINEL-1 SAR PREPROCESSING")
    print("================================")

    print(f"Input SAFE:")
    print(f"  {safe_file}")

    print()
    print("Running pyroSAR + SNAP...")

    os.makedirs(
        processing_dir,
        exist_ok=True
    )

    geocode(
        safe_file,
        processing_dir,

        # Geographic output
        t_srs=4326,
        spacing=10,

        # Both required polarizations
        polarizations=["VV", "VH"],

        # IMPORTANT:
        # Keep linear Sigma0 because the
        # downstream pipeline performs dB conversion.
        scaling="linear",
        refarea="sigma0",

        # SAR geocoding
        geocoding_type="Range-Doppler",

        # Sentinel-1 GRD preprocessing
        removeS1BorderNoise=True,
        removeS1ThermalNoise=True,

        # Match the validated workflow:
        # terrain correction but no additional
        # terrain flattening.
        terrainFlattening=False,

        # Speckle filtering
        speckleFilter="Lee Sigma",

        # Land/sea handling
        nodataValueAtSea=True
    )

    print()
    print("pyroSAR/SNAP processing finished.")

    vv_file, vh_file = find_sigma0_files(
        processing_dir
    )

    print()
    print("Sigma0 outputs found:")

    print(f"  VV: {vv_file}")
    print(f"  VH: {vh_file}")

    return vv_file, vh_file


# ============================================================
# PROCESS SIGMA0 VV + VH
# ============================================================

def process_sigma0_files(
    vv_file,
    vh_file,
    output_dir
):
    """
    Read linear Sigma0 VV/VH and create
    normalized 3-band 416x416 GeoTIFF tiles.
    """

    print()
    print("Opening Sigma0 rasters...")

    with rasterio.open(vv_file) as vv_src:

        with rasterio.open(vh_file) as vh_src:

            # ------------------------------------------------
            # Basic validation
            # ------------------------------------------------

            if (
                vv_src.width != vh_src.width
                or
                vv_src.height != vh_src.height
            ):
                raise ValueError(
                    "VV and VH rasters have "
                    "different dimensions."
                )

            if vv_src.crs != vh_src.crs:

                raise ValueError(
                    "VV and VH rasters have "
                    "different CRS."
                )

            print()
            print("Sigma0 validation:")

            print(
                f"  VV size : "
                f"{vv_src.width} × {vv_src.height}"
            )

            print(
                f"  VH size : "
                f"{vh_src.width} × {vh_src.height}"
            )

            print(
                f"  CRS     : "
                f"{vv_src.crs}"
            )

            # ------------------------------------------------
            # Read linear Sigma0
            # ------------------------------------------------

            print()
            print("Reading Sigma0 VV...")
            vv_linear = vv_src.read(1).astype(
                np.float32
            )

            print("Reading Sigma0 VH...")
            vh_linear = vh_src.read(1).astype(
                np.float32
            )

            # ------------------------------------------------
            # Composite
            # ------------------------------------------------

            vv, vh, difference = create_composite(
                vh_linear,
                vv_linear
            )

            # ------------------------------------------------
            # Create tiles
            # ------------------------------------------------

            print()
            print("Creating 416×416 tiles...")

            create_tiles(
                vv,
                vh,
                difference,
                vv_src,
                output_dir
            )


# ============================================================
# PROCESSED GEOTIFF INPUT
# ============================================================

def process_existing_geotiff(
    input_file,
    output_dir
):
    """
    Backward-compatible testing mode.

    Expected:
        Band 1 = VH linear Sigma0
        Band 2 = VV linear Sigma0
    """

    print()
    print("Using existing processed GeoTIFF.")

    with rasterio.open(input_file) as src:

        if src.count < 2:

            raise ValueError(
                "Input GeoTIFF must contain "
                "at least 2 bands."
            )

        print()
        print("Input validation:")

        print(
            f"  Width  : {src.width}"
        )

        print(
            f"  Height : {src.height}"
        )

        print(
            f"  Bands  : {src.count}"
        )

        print(
            f"  CRS    : {src.crs}"
        )

        # Existing SNAP output:
        # Band 1 = VH
        # Band 2 = VV

        vh_linear = src.read(1).astype(
            np.float32
        )

        vv_linear = src.read(2).astype(
            np.float32
        )

        vv, vh, difference = create_composite(
            vh_linear,
            vv_linear
        )

        print()
        print("Creating 416×416 tiles...")

        create_tiles(
            vv,
            vh,
            difference,
            src,
            output_dir
        )


# ============================================================
# MAIN PIPELINE
# ============================================================

def run_pipeline(
    input_file,
    output_dir
):

    print()
    print("================================")
    print("DEV 1 SENTINEL-1 PIPELINE")
    print("================================")

    print(
        f"Input : {input_file}"
    )

    print(
        f"Output: {output_dir}"
    )

    print()

    # --------------------------------------------------------
    # RAW SAFE INPUT
    # --------------------------------------------------------

    if os.path.isdir(input_file) and input_file.upper().endswith(
        ".SAFE"
    ):

        processing_dir = os.path.join(
            output_dir,
            "_sar_processing"
        )

        os.makedirs(
            processing_dir,
            exist_ok=True
        )

        vv_file, vh_file = preprocess_safe(
            input_file,
            processing_dir
        )

        process_sigma0_files(
            vv_file,
            vh_file,
            output_dir
        )

        # ----------------------------------------------------
        # Remove temporary preprocessing directory
        # ----------------------------------------------------

        print()
        print("Cleaning temporary SAR files...")

        shutil.rmtree(
            processing_dir,
            ignore_errors=True
        )

        print("Temporary files removed.")

    # --------------------------------------------------------
    # EXISTING GEOTIFF
    # --------------------------------------------------------

    elif input_file.lower().endswith(
        (".tif", ".tiff")
    ):

        process_existing_geotiff(
            input_file,
            output_dir
        )

    else:

        raise ValueError(
            "Input must be either:\n"
            "  - Sentinel-1 .SAFE directory\n"
            "  - processed .tif/.tiff"
        )


# ============================================================
# COMMAND LINE INTERFACE
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Dev 1 Sentinel-1 raw SAFE "
            "preprocessing and 416x416 "
            "GeoTIFF tiling pipeline."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        help=(
            "Path to Sentinel-1 .SAFE "
            "directory or processed GeoTIFF."
        )
    )

    parser.add_argument(
        "--output",
        required=True,
        help="Directory where final tiles are saved."
    )

    args = parser.parse_args()

    run_pipeline(
        args.input,
        args.output
    )


if __name__ == "__main__":
    main()

"""
Command:

python tile_sentinel1.py
--input "path for extracted folder that has the raw SAR Sentinel-1 file (in .SAFE format)"
--output "path of the folder where we want to store the output tiles (in .tif format)"

"""