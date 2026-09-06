"""
cdse_client.py - Copernicus Data Space Ecosystem (CDSE) Process API Client.

Requests pre-calibrated Sentinel-1 SAR Sigma0 dual-pol (VV, VH, VV-VH) in dB directly
from ESA's cloud GPUs, eliminating the need for 1.5 GB .SAFE downloads and ESA SNAP.
"""

import os
import json
import requests
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from typing import List, Tuple, Optional
from dotenv import load_dotenv

# Automatically load environment variables from ai-model/.env
load_dotenv()
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))


CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CDSE_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"

# JavaScript Evalscript executed inside ESA's cloud servers
EVALSCRIPT_SIGMA0_DB = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH"] }],
    output: { bands: 3, sampleType: "FLOAT32" }
  };
}

function evaluatePixel(sample) {
  // 1. Convert linear Sigma0 to dB (floor at 0.0001 to prevent log of 0)
  var vv_db = 10.0 * Math.log10(Math.max(sample.VV, 0.0001));
  var vh_db = 10.0 * Math.log10(Math.max(sample.VH, 0.0001));
  
  // 2. Compute Band 3: VV - VH difference (polarization ratio)
  var diff_db = vv_db - vh_db;

  return [vv_db, vh_db, diff_db];
}
"""


class CopernicusCDSEClient:
    def __init__(self, client_id: Optional[str] = None, client_secret: Optional[str] = None):
        self.client_id = client_id or os.getenv("CDSE_CLIENT_ID", "")
        self.client_secret = client_secret or os.getenv("CDSE_CLIENT_SECRET", "")
        self._access_token: Optional[str] = None

    def authenticate(self) -> str:
        """Obtains an OAuth2 bearer token from Copernicus CDSE."""
        if not self.client_id or not self.client_secret:
            raise ValueError(
                "CDSE credentials not found. Please set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET environment variables."
            )

        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        response = requests.post(CDSE_TOKEN_URL, data=data, headers=headers, timeout=15)
        response.raise_for_status()
        self._access_token = response.json()["access_token"]
        return self._access_token

    def fetch_calibrated_geotiff(
        self,
        bbox: Tuple[float, float, float, float],
        output_path: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        width: int = 832,
        height: int = 832,
    ) -> str:
        """
        Fetches an ortho-calibrated 3-band GeoTIFF (VV, VH, VV-VH) from Copernicus Process API.
        
        Args:
            bbox: (min_lon, min_lat, max_lon, max_lat) in EPSG:4326 WGS84
            output_path: Local filepath to save the .tif
            from_date: ISO 8601 start timestamp (defaults to 30 days before to_date)
            to_date: ISO 8601 end timestamp (defaults to current UTC time)
            width: Image width in pixels (multiple of 416 recommended)
            height: Image height in pixels (multiple of 416 recommended)
        """
        from datetime import datetime, timezone, timedelta

        if not to_date:
            to_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if not from_date:
            # Default to 30 days prior
            from_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")

        if not self._access_token:
            self.authenticate()

        min_lon, min_lat, max_lon, max_lat = bbox

        payload = {
            "input": {
                "bounds": {
                    "bbox": [min_lon, min_lat, max_lon, max_lat],
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [
                    {
                        "type": "sentinel-1-grd",
                        "dataFilter": {
                            "timeRange": {"from": from_date, "to": to_date},
                            "acquisitionMode": "IW",
                            "polarization": "DV",
                        },
                        "processing": {
                            "backscatterCoefficient": "SIGMA0_ELLIPSOID",
                            "orthorectify": False,
                        },
                    }
                ],
            },
            "output": {
                "responses": [{"format": {"type": "image/tiff"}}],
                "width": width,
                "height": height,
            },
            "evalscript": EVALSCRIPT_SIGMA0_DB,
        }

        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
            "Accept": "image/tiff",
        }

        response = requests.post(CDSE_PROCESS_URL, json=payload, headers=headers, timeout=45)
        response.raise_for_status()

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(response.content)

        return output_path


def create_synthetic_test_geotiff(
    output_path: str,
    bbox: Tuple[float, float, float, float] = (71.20, 19.30, 71.60, 19.70),
    width: int = 832,
    height: int = 832,
    inject_spill: bool = True,
) -> str:
    """
    Generates a synthetic 3-band calibrated SAR GeoTIFF for testing Option 3 offline
    without requiring active internet or CDSE credentials.
    
    Band 1: VV (dB) ~ -18 to -10 dB with water texture
    Band 2: VH (dB) ~ -26 to -20 dB
    Band 3: VV - VH difference ~ 6 to 10 dB
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)

    # Base sea clutter backscatter
    np.random.seed(42)
    vv = np.random.normal(loc=-14.0, scale=1.5, size=(height, width)).astype(np.float32)
    vh = np.random.normal(loc=-23.0, scale=1.2, size=(height, width)).astype(np.float32)

    if inject_spill:
        # Inject an oil slick anomaly (smooth surface dampens backscatter by 6-10 dB)
        cy, cx = height // 2, width // 2
        y, x = np.ogrid[:height, :width]
        # Irregular slick shape
        dist = ((x - cx) ** 2) / (70 ** 2) + ((y - cy) ** 2) / (35 ** 2)
        slick_mask = dist <= 1.0
        vv[slick_mask] -= 8.5  # Heavy damping
        vh[slick_mask] -= 4.0

    diff = vv - vh

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with rasterio.open(
        output_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=3,
        dtype=rasterio.float32,
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(vv, 1)
        dst.write(vh, 2)
        dst.write(diff, 3)

    return output_path
