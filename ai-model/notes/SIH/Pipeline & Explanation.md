### **1. What is the `.pt` File?**

A `.pt` (or `.pth`) file is a **PyTorch checkpoint file** (short for PyTorch).

  

Inside, it contains the serialized state of the neural network saved via Python's `pickle` utility. Specifically, it stores:

  

- **Model Architecture & Weights (`state_dict`):** The numerical values (floating-point numbers) of all trainable parameters—the convolutional kernels, weights ($W$), and biases ($b$) that the model learned during training.
    
      
    
- **Optimizer State:** The momentum and gradient history (e.g., AdamW/SGD buffers) so you can resume training where you left off.
    
      
    
- **Ultralytics Metadata:** Class names (`0: oil_spill`), hyperparameters, input image dimensions ($512\times 512$), and training epoch history.
    
      
    

When you load `yolov8n-seg.pt` before training, you load **pre-trained weights** (features already trained to recognize basic edges, textures, and shapes). When training finishes, Ultralytics saves `best.pt`—your model configured with parameters specifically tuned to recognize low-backscatter SAR oil slicks.

  

### **2. What Are You Actually Training? (ML vs. DL vs. NN)**

These three terms form a nested hierarchy:

  

$$\text{Artificial Intelligence (AI)} \supset \textbf{Machine Learning (ML)} \supset \textbf{Deep Learning (DL)} \supset \textbf{Neural Networks (NN)}$$

```
┌────────────────────────────────────────────────────────┐
│ Machine Learning (ML)                                  │
│   ┌──────────────────────────────────────────────────┐ │
│   │ Deep Learning (DL)                               │ │
│   │   ┌────────────────────────────────────────────┐ │ │
│   │   │ Neural Networks (CNNs / Backbone / Heads)  │ │ │
│   │   │ ──► You are training YOLOv8-Seg here       │ │ │
│   │   └────────────────────────────────────────────┘ │ │
│   └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

- **Machine Learning (ML):** The broad paradigm where algorithms learn patterns from data rather than following hand-coded rules.
    
      
    
- **Deep Learning (DL):** A specialized subset of ML that uses multi-layered architectures (deep networks) capable of automatic feature extraction directly from raw spatial data (pixels) without manual feature engineering.
    
      
    
- **Neural Network (NN):** The underlying mathematical computational graph composed of interconnected artificial neurons organized in layers.
    
      
    
- **What you are running:** You are training a **Deep Learning Convolutional Neural Network (CNN)** for **Supervised Instance Segmentation**.
    
      
    

#### **What Happens Numerically During Training?**

You are not "teaching" the computer in English. You are optimizing a mathematical function:

  

1. **Forward Pass:** A $512\times 512$ pixel grid passes through dozens of convolutional filter layers. The network outputs a predicted mask.
    
      
    
2. **Loss Calculation:** The network compares its predicted mask to the ground truth mask (`.txt` polygon) using a **Loss Function** (combining Box Loss, Mask Loss / BCE, and Class Loss).
    
      
    
3. **Backpropagation:** The algorithm calculates the gradient of the error with respect to each weight ($\frac{\partial \text{Loss}}{\partial W}$) across all layers.
    
      
    
4. **Weight Update:** The optimizer updates the weights in the direction that minimizes error:
    
      
    
    $$W_{\text{new}} = W_{\text{old}} - \eta \cdot \nabla \text{Loss}$$
    
    By repeating this thousands of times across your batches, the weights in `best.pt` shift until the network reliably isolates dark capillary wave dampening against rough ocean clutter.
    

### **3. End-to-End Pipeline: Step-by-Step Breakdown**


[Sentinel-1 Radar] ──► (Step 1) ──► Raw GeoTIFF
                             │
                             ▼
                    (Step 2: Preprocess) ──► Clean dB Array + Affine Matrix
                             │
                             ▼
                    (Step 3: YOLOv8-Seg) ──► Pixel Masks (Row, Col)
                             │
                             ▼
                 (Step 4: Vectorization) ──► GeoJSON Polygons (Lat, Lon)
                             │
                             ▼
                 (Step 5: PostGIS + AIS) ──► Ranked Suspect Vessels

---

#### **Step 1: Satellite Ingestion (Copernicus Sentinel-1)**
* **What Happens:** The system queries the Copernicus Data Space Ecosystem (CDSE) API for Sentinel-1 Ground Range Detected (GRD) C-band SAR scenes over designated maritime surveillance zones[cite: 1, 2].
* **Input Files:**
  * Bounding box coordinates $[Lon_{\min}, Lat_{\min}, Lon_{\max}, Lat_{\max}]$ and acquisition datetime filters[cite: 2].
* **Output Files:**
  * Raw Sentinel-1 Level-1 GRD package: `.SAFE` directory containing calibrated measurement rasters (`measurement/s1a-iw-grd-vv-*.tiff`)[cite: 1, 2].

---

#### **Step 2: Preprocessing Pipeline (`src/preprocessing.py`)**
* **What Happens:** 
  1. `rasterio` opens the raw 16-bit GeoTIFF and reads the VV band matrix alongside its Affine geotransform matrix[cite: 1, 4].
  2. Converts raw Digital Numbers (DN) to radar backscatter in decibels:
     $$\sigma^0\text{ (dB)} = 10 \cdot \log_{10}(\text{DN}^2 + \epsilon)$$
[cite: 1, 2]
  3. Applies a speckle noise filter (Lee or local-variance median filter via `scipy.ndimage`) to remove radar graininess without degrading edge boundaries[cite: 1, 2].
  4. Slices the large scene into $512\times 512$ normalized NumPy arrays $[0.0, 1.0]$[cite: 1, 4].
* **Input Files:**
  * Raw Sentinel-1 GeoTIFF (`.tiff` / `.SAFE`)[cite: 1, 2].
* **Output Files:**
  * Cleaned image tiles (`patch_001.png` or `.npy` matrices)[cite: 1, 2].
  * Geospatial metadata file / dictionary storing each patch's specific Affine transform matrix (`transform.json` or preserved inside individual patch GeoTIFFs)[cite: 1, 4].

---

#### **Step 3: AI Segmentation Model (`src/inference.py`)**
* **What Happens:** The trained neural network (`best.pt`) evaluates the preprocessed $512\times 512$ tile. It identifies low-backscatter dark spots, determines if their morphology represents petroleum, and outputs polygon outlines in pixel coordinates.
* **Input Files:**
  * Normalized image tile (`patch_001.png` or NumPy array).
  * Model weights file (`best.pt`).
* **Output Files:**
  * Ultralytics prediction results object containing pixel contour coordinates:
    $$\text{results}[0].\text{masks}.\text{xy} = [[(x_1, y_1), (x_2, y_2), \dots, (x_n, y_n)]]$$

---

#### **Step 4: Geospatial Vectorization & Area Calculation**
* **What Happens:** The system maps pixel-space coordinates into real-world geographic coordinates using the stored Affine transform matrix:
  $$\begin{bmatrix} \text{Lon} \\ \text{Lat} \end{bmatrix} = \begin{bmatrix} a & b & c \\ d & e & f \end{bmatrix} \begin{bmatrix} x_{\text{pixel}} \\ y_{\text{pixel}} \\ 1 \end{bmatrix}$$
  Shapely simplifies the jagged contour vertices and calculates the slick's surface area in $\text{km}^2$.
* **Input Files:**
  * Pixel contours (`results[0].masks.xy`).
  * Affine matrix from Step 2.
* **Output Files:**
  * Standard **WGS84 (EPSG:4326) GeoJSON FeatureCollection** (`spill_detection.geojson`):

    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[72.821, 18.912], [72.825, 18.915], ...]]
      },
      "properties": {
        "spill_id": "spill_049a",
        "confidence": 0.94,
        "area_km2": 4.12,
        "timestamp": "2026-09-03T08:14:00Z"
      }
    }

---

#### **Step 5: PostGIS Correlation Engine & Suspect Ranking**
* **What Happens:**
  1. The backend applies hydrodynamic drift back-propagation using wind and surface ocean currents to calculate where the oil slick originated:
     $$\vec{X}_{\text{origin}} = \vec{X}_{\text{spill}}(t) - \int (\alpha \vec{V}_{\text{wind}} + \beta \vec{V}_{\text{current}}) \, dt$$

  2. Executes an indexed spatio-temporal query (`ST_DWithin`) against the historical AIS ship table over the preceding hours.
  3. Computes a multi-factor score ($0\text{--}100\%$) based on proximity, steady cruising speed, and transponder blackout gaps.
* **Input Files:**
  * Spill vector (`spill_detection.geojson`).
  * Raw AIS broadcast stream / historical table (`ais_vessel_positions` table in PostgreSQL).
* **Output Files / Responses:**
  * JSON payload served via FastAPI to the Leaflet UI:

    {
      "spill_id": "spill_049a",
      "suspect_leaderboard": [
        {
          "rank": 1,
          "vessel_name": "Pacific Voyager",
          "mmsi": 563092000,
          "flag": "Singapore",
          "match_score": 0.94,
          "anomaly_detected": "AIS transponder disabled for 42 mins"
        }
      ]
    }
    
  * Downloadable PDF evidence dossier for maritime authorities.

---
