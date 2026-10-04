# Urban Waterlogging Risk Prediction

**A machine learning system predicting localized waterlogging risk levels from civic and environmental features, demonstrating how reducing impervious surface area lowers flood risk.**

This is an end-to-end ML project: synthetic data generation, a tuned classification model, a FastAPI backend, and an interactive map-based frontend that lets a user simulate the effect of converting paved surfaces into permeable ("sponge city") infrastructure.

---

## Scope: Urban / Semi-Urban Areas

This project models **urban and semi-urban locations with engineered drainage infrastructure and meaningful paved surface coverage**. It is not designed for rural areas, and that's a deliberate boundary rather than an oversight: two of the six input features are specifically civic-infrastructure concepts that don't map onto rural land —

- `drainage_capacity` assumes engineered stormwater systems (pipes, culverts, municipal drains). Rural waterlogging is governed much more by natural soil infiltration rate and agricultural drainage, a different mechanism entirely.
- `impervious_surface` assumes meaningful paved/sealed ground coverage. Rural areas are, by definition, mostly unpaved, so this feature would carry little information for most rural locations.

Extending this to rural contexts would need a different feature set (soil infiltration rate, natural slope, agricultural drainage presence) rather than reusing these six as-is — see **Possible Extensions** below.

The dataset is not tied to any single city's geography — feature ranges are calibrated to plausible plains/coastal urban terrain in general (see table below), not one specific location.

---

## Live Demo

1. Set rainfall, elevation, drainage, and previous-rainfall values.
2. Submit to get a baseline risk prediction, pinned on the map.
3. Drag the **Impervious Surface** slider, holding everything else fixed, and watch the predicted risk level change in real time.

**Verified demo scenarios:**
- Holding rainfall_intensity=12, rainfall_duration=2, elevation=55, drainage_capacity=35, previous_rainfall=5 fixed: risk flips from **LOW → MODERATE** between impervious_surface = 81% and 82%.
- Holding rainfall_intensity=14, elevation=65, drainage_capacity=40, previous_rainfall=10, impervious_surface=45 fixed: risk flips from **LOW → MODERATE** between rainfall_duration = 2.5 and 3.0 hours.

Both crossings were independently confirmed against the underlying risk-score formula, not just the model's output, so they're demonstrably real decision boundaries rather than coincidence.

---

## Why Synthetic Data

Street-level civic data (drainage capacity, localized elevation, impervious surface percentage) at this granularity is not publicly available for most cities. Rather than skip the project, a **physically-reasoned synthetic data generator** was built: feature distributions chosen to mimic real-world rainfall/terrain patterns (gamma, exponential, normal, and beta distributions, not uniform randomness), and a risk-score formula modeling water load vs. drainage capacity, amplified by elevation and surface permeability.

**This is explicitly a prototype trained on synthetic data, not real measured civic data.** The architecture is designed so real municipal/meteorological data could be substituted in if it becomes available.

---

## Dataset

- 5,000 rows, 6 base features + 1 engineered feature (`net_water_balance`)
- 4-class target (`risk_level`): LOW / MODERATE / HIGH / CRITICAL, balanced via percentile-based thresholds computed from the data, not hardcoded
- Deliberate label noise added to simulate real-world measurement variability, creating an honest, non-zero error floor

### Feature ranges (calibrated to severe-but-plausible single-event conditions for general plains/coastal urban terrain)

| Feature | Range | Notes |
|---|---|---|
| rainfall_intensity | 0–200 mm/hr | Covers severe cyclone/monsoon-driven cloudbursts; below the all-time world record (~305 mm/hr) |
| rainfall_duration | 0.25–48 hrs | Extended to cover full cyclone-length rain bands, not just single storm cells |
| elevation | 15–100 m | Represents low-lying plains/coastal urban terrain. Mountainous or hill-station cities are outside this range and outside the current scope. |
| drainage_capacity | 5–100 mm/hr | Up to a hypothetical best-in-class modern system |
| previous_rainfall | 0–200 mm | Antecedent rainfall over the prior 48 hours |
| impervious_surface | 10–98% | Percentage of paved/sealed ground |

### A bug found and fixed during development

An early version of the risk-score formula multiplied `(water_load - coping_capacity)` by amplification factors for elevation and impervious surface. This worked correctly when water load exceeded capacity, but **inverted** when capacity exceeded load: multiplying an already-negative "safe" score by a larger factor made it *more* negative, which read as *safer* — the opposite of the intended effect. This was caught by sweeping `impervious_surface` against fixed inputs and noticing predicted risk moved the wrong direction for certain combinations. The fix: amplify `water_load` directly, before subtracting capacity, so amplification always increases risk regardless of the base score's sign. Verified by re-running the sweep and confirming monotonic behavior across the full range.

---

## Modeling

Two classifiers were trained and fairly compared using identical stratified 5-fold cross-validation and GridSearchCV hyperparameter tuning:

| Model | CV Macro F1 | Test Accuracy |
|---|---|---|
| **SVM (RBF kernel, tuned)** | **0.902** | **0.911** |
| Random Forest (tuned) | 0.839 | 0.835 |

**SVM was selected for deployment.** This gap has held up consistently across multiple dataset versions (before and after the formula bugfix, at different noise levels, and after widening the feature ranges), suggesting it's a genuine effect: the risk relationships involve smooth, multiplicative interactions between features (e.g., elevation and impervious surface compounding together), which an RBF kernel models more naturally than Random Forest's axis-aligned splits.

Across every tested configuration, both models have never confused LOW and CRITICAL in either direction — the most safety-relevant failure mode for a risk-warning system — even in configurations where overall accuracy was lower.

*Note: the comparison table above reflects the dataset version with previous_rainfall capped at 250mm. If re-run against the current 200mm cap, re-validate before citing these exact numbers.*

---

## Architecture

```
generate_dataset.py   → synthetic data generation (Pandas, NumPy)
train_model.py        → SVM + Random Forest training, CV, GridSearchCV, evaluation
main.py                → FastAPI backend serving the tuned SVM pipeline
index.html / style.css / script.js → frontend: form, Leaflet map, sponge-city slider
```

The trained model is saved as a single scikit-learn `Pipeline` (scaler + classifier bundled together) via `joblib`, so the backend loads one file and never needs to re-scale manually or risk a train/test scaling mismatch.

---

## Tech Stack

- **Data & ML:** Python, Pandas, NumPy, scikit-learn (SVM, Random Forest, GridSearchCV, StratifiedKFold)
- **Backend:** FastAPI, Pydantic (input validation), Uvicorn
- **Frontend:** HTML, CSS, JavaScript, Leaflet.js

---

## Running It

**Backend:**
```bash
pip install fastapi uvicorn scikit-learn joblib pandas numpy
uvicorn main:app --reload
```
Visit `http://127.0.0.1:8000/docs` for interactive API docs.

**Frontend:**
Open `index.html` directly in a browser (not through a Jupyter file viewer — it must run as a standalone file or via a local server, since sandboxed previews block JavaScript).

---

## Honest Limitations

- Trained entirely on synthetic data; real-world validation against actual flooding records has not been done.
- Scoped to urban/semi-urban areas with engineered drainage and paved surfaces — not designed for rural land (see **Scope** above).
- Formula weights (e.g., why rainfall duration matters more than intensity) are domain-reasoned design choices, not calibrated against measured data.
- Predictions on inputs outside the trained feature ranges (see table above) are unreliable extrapolations; the frontend enforces input bounds to prevent this.
- The frontend map's click-to-select location is currently cosmetic — it is not yet linked to location-specific elevation/drainage lookups.
- CORS is fully open (`allow_origins=["*"]`) for local development; a production deployment would restrict this.

## Possible Extensions

- Replace synthetic features with real meteorological and municipal open data, where available
- Add a rural-area variant with different features (soil infiltration rate, natural slope, agricultural drainage presence) rather than reusing the urban feature set
- Add a lookup table mapping clicked map locations to typical elevation/drainage values for that zone
- Expand beyond SVM/Random Forest to gradient boosting methods for comparison
