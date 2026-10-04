from fastapi import FastAPI
import joblib

app = FastAPI()
model = joblib.load("final_svm_pipeline.joblib")
label_encoder = joblib.load("label_encoder.joblib")
@app.get("/")
def read_root():
    return {"message": "Urban Waterlogging Risk Predictor is running"}

from pydantic import BaseModel

class WaterloggingInput(BaseModel):
    rainfall_intensity: float
    rainfall_duration: float
    elevation: float
    drainage_capacity: float
    previous_rainfall: float
    impervious_surface: float
@app.post("/predict")
def predict_risk(data: WaterloggingInput):
    net_water_balance = (data.rainfall_intensity + data.previous_rainfall) - data.drainage_capacity
    input_data = [[
        data.rainfall_intensity,
        data.rainfall_duration,
        data.elevation,
        data.drainage_capacity,
        data.previous_rainfall,
        data.impervious_surface,
        net_water_balance
    ]]
    prediction_encoded = model.predict(input_data)
    prediction_label = label_encoder.inverse_transform(prediction_encoded)
    return {
        "risk_level": prediction_label[0]
    }
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)