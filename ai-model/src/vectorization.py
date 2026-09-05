"""
vectorization.py - Geospatial Vectorization & Affine Transformation Engine.

Converts YOLOv8-Seg pixel contour coordinates into real-world WGS84 (EPSG:4326)
GeoJSON polygons using GeoTIFF affine transform matrices from Dev 1's tiles.
"""

from typing import List, Tuple, Dict, Any
import numpy as np
from shapely.geometry import Polygon, mapping
from shapely.ops import transform as shapely_transform
import pyproj
import rasterio
from rasterio.transform import xy


# Geographic coordinate system (WGS84 GPS)
WGS84_CRS = "EPSG:4326"


def pixel_to_geo_coords(
    pixel_polygon: List[Tuple[float, float]],
    geotiff_transform: rasterio.Affine
) -> List[List[float]]:
    """
    Transforms a list of (x, y) pixel coordinates on a tile into geographic [lon, lat] coordinates.
    
    Args:
        pixel_polygon: List of (x, y) pixel coordinates, e.g. [(120.5, 45.2), (130.0, 50.1), ...]
        geotiff_transform: The 3x3 Affine transformation matrix of the tile.
        
    Returns:
        List of [longitude, latitude] coordinate pairs.
    """
    geo_coords = []
    for x, y in pixel_polygon:
        # rasterio.transform.xy handles the affine multiplication (column=x, row=y)
        lon, lat = xy(geotiff_transform, y, x, offset='center')
        geo_coords.append([round(lon, 7), round(lat, 7)])

    # Ensure the polygon ring is explicitly closed
    if geo_coords and geo_coords[0] != geo_coords[-1]:
        geo_coords.append(geo_coords[0])

    return geo_coords


def calculate_polygon_metrics(
    geo_coords: List[List[float]],
    src_crs: str = WGS84_CRS
) -> Tuple[float, float, float]:
    """
    Calculates the centroid (lat, lon) and geodesic surface area in km² of a polygon.
    
    Returns:
        (centroid_lat, centroid_lon, area_sq_km)
    """
    poly = Polygon(geo_coords)
    
    # Geographic centroid
    centroid = poly.centroid
    centroid_lon = round(float(centroid.x), 7)
    centroid_lat = round(float(centroid.y), 7)

    # If coordinates are valid GPS coordinates (-90 <= lat <= 90 and -180 <= lon <= 180)
    if -90.0 <= centroid_lat <= 90.0 and -180.0 <= centroid_lon <= 180.0:
        try:
            # Equal-area azimuthal projection centered at polygon centroid for accurate km²
            proj_str = f"+proj=aeqd +lat_0={centroid_lat} +lon_0={centroid_lon} +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
            transformer = pyproj.Transformer.from_crs("EPSG:4326", proj_str, always_xy=True)
            poly_projected = shapely_transform(transformer.transform, poly)
            area_sq_km = round(poly_projected.area / 1_000_000.0, 4)  # m² to km²
        except Exception:
            area_sq_km = round(poly.area, 4)
    else:
        # Fallback for raw pixel space (e.g. non-georeferenced images)
        area_sq_km = round(poly.area / 10_000.0, 4)

    return centroid_lat, centroid_lon, area_sq_km


def create_spill_payload(
    pixel_polygon: List[Tuple[float, float]],
    geotiff_transform: rasterio.Affine,
    detected_at_iso: str,
    confidence: float = 0.0,
    tile_name: str = ""
) -> Dict[str, Any]:
    """
    Builds the exact JSON payload expected by backend POST /spills (matching SpillInput schema).
    """
    geo_coords = pixel_to_geo_coords(pixel_polygon, geotiff_transform)
    
    if len(geo_coords) < 4:  # Closed polygon needs at least 3 points + 1 closing point
        return {}

    centroid_lat, centroid_lon, area_sq_km = calculate_polygon_metrics(geo_coords)

    # Standard GeoJSON Polygon geometry
    geojson_polygon = {
        "type": "Polygon",
        "coordinates": [geo_coords]
    }

    # Matches backend/app/schemas.py -> SpillInput
    payload = {
        "centroid_lat": centroid_lat,
        "centroid_lon": centroid_lon,
        "detected_at": detected_at_iso,
        "spill_polygon_geojson": geojson_polygon,
        # Additional metadata for reporting / frontend dossier
        "area_km2": area_sq_km,
        "confidence": round(float(confidence), 3),
        "source_tile": tile_name
    }

    return payload

