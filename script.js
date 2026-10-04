const form = document.getElementById("prediction-form");
const resultHeading = document.getElementById("result");
const riskColors = {
    low: "#4CAF50",
    moderate: "#D9A62E",
    high: "#E07A3F",
    critical: "#C84B4B"
};

async function predictRisk(dropPermanentMarker) {
    const inputData = {
        rainfall_intensity: parseFloat(document.getElementById("rainfall_intensity").value),
        rainfall_duration: parseFloat(document.getElementById("rainfall_duration").value),
        elevation: parseFloat(document.getElementById("elevation").value),
        drainage_capacity: parseFloat(document.getElementById("drainage_capacity").value),
        previous_rainfall: parseFloat(document.getElementById("previous_rainfall").value),
        impervious_surface: parseFloat(document.getElementById("impervious_surface").value)
    };
    const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputData)
    });
    const data = await response.json();
    const riskKey = data.risk_level.toLowerCase();
    resultHeading.textContent = "Predicted Risk: " + data.risk_level;
    resultHeading.className = riskKey;
    marker.setStyle({ fillColor: riskColors[riskKey] });
    if (dropPermanentMarker) {
        L.circleMarker([selectedLat, selectedLng], {
            radius: 10,
            color: "#333",
            fillColor: riskColors[riskKey],
            fillOpacity: 0.9,
            weight: 2
        }).addTo(map);
    }
}
form.addEventListener("submit", function (event) {
    event.preventDefault();
    predictRisk(true);
});

const map = L.map("map").setView([20.2961, 85.8245], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);
let marker = L.circleMarker([20.2961, 85.8245], {
    radius: 12,
    color: "#333",
    fillColor: "#999",
    fillOpacity: 0.9,
    weight: 2
}).addTo(map);
let selectedLat = 20.2961;
let selectedLng = 85.8245;
map.on("click", function (event) {
    selectedLat = event.latlng.lat;
    selectedLng = event.latlng.lng;
    marker.setLatLng([selectedLat, selectedLng]);
    document.getElementById("coords-display").textContent =
        `Selected location: ${selectedLat.toFixed(4)}, ${selectedLng.toFixed(4)}`;
});

const slider = document.getElementById("imperviousSlider");
const sliderValueDisplay = document.getElementById("sliderValue");
slider.addEventListener("input", function () {
    sliderValueDisplay.textContent = slider.value;
    document.getElementById("impervious_surface").value = slider.value;
    predictRisk(false);
});