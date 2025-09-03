// ------------------ Global Variables ------------------
let map;
let geojsonLayer;
let userMarker, userCircle;
let watchId;
let currentPlotLayer;

// ------------------ Initialize Map ------------------
document.addEventListener("DOMContentLoaded", function () {
  map = L.map("map").setView([22.57, 88.36], 16); // Change to your mouza center

  // Add OpenStreetMap baselayer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Load Mouza GeoJSON
  geojsonLayer = L.geoJSON(null, {
    style: {
      color: "#2c3e50",
      weight: 1,
      fillColor: "#f1c40f",
      fillOpacity: 0.4
    },
    onEachFeature: function (feature, layer) {
      // Click to show plot number
      layer.on("click", function () {
        L.popup()
          .setLatLng(layer.getBounds().getCenter())
          .setContent("Plot No: " + feature.properties.plot_no)
          .openOn(map);
      });
    }
  }).addTo(map);

  fetch("mouza_plots.geojson")
    .then(res => res.json())
    .then(data => {
      geojsonLayer.addData(data);
      map.fitBounds(geojsonLayer.getBounds());
    });

  // Add Locate Me Button
  L.control.locateMe = function (opts) {
    let control = L.control({ position: "topleft" });
    control.onAdd = function () {
      let button = L.DomUtil.create("button", "locate-btn");
      button.innerHTML = "📍";
      button.title = "Locate Me";
      L.DomEvent.on(button, "click", function () {
        startTracking();
      });
      return button;
    };
    return control;
  };
  L.control.locateMe().addTo(map);

  // Info Panel
  let info = L.control({ position: "topright" });
  info.onAdd = function () {
    this._div = L.DomUtil.create("div", "info");
    this.update();
    return this._div;
  };
  info.update = function (props) {
    this._div.innerHTML =
      <h4>Mouza: Subirchak</h4> +
      <b>J.L No: 90</b><br> +
      (props
        ? 📍 Current Plot: <b>${props.plot_no}</b><br> +
          GPS Accuracy: ±${props.accuracy}m
        : "Move or tap Locate Me");
  };
  info.addTo(map);
  window.infoControl = info;
});

// ------------------ GPS Tracking ------------------
function startTracking() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  if (watchId) navigator.geolocation.clearWatch(watchId);

  watchId = navigator.geolocation.watchPosition(success, error, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000
  });
}

function success(e) {
  let lat = e.coords.latitude;
  let lng = e.coords.longitude;
  let accuracy = Math.round(e.coords.accuracy);
  let latlng = [lat, lng];

  // Remove old marker & circle
  if (userMarker) map.removeLayer(userMarker);
  if (userCircle) map.removeLayer(userCircle);

  // Add marker
  userMarker = L.marker(latlng).addTo(map);

  // Add smaller, transparent circle
  userCircle = L.circle(latlng, {
    radius: Math.min(20, accuracy), // cap radius
    color: "blue",
    fillColor: "blue",
    fillOpacity: 0.1,
    interactive: false // allow clicks through
  }).addTo(map);

  map.setView(latlng, map.getZoom());

  // Find which plot the user is in
  let point = turf.point([lng, lat]);
  let nearestPlot = null;
  geojsonLayer.eachLayer(layer => {
    let poly = layer.toGeoJSON();
    if (turf.booleanPointInPolygon(point, poly)) {
      nearestPlot = layer;
    }
  });

  // Reset previous highlight
  geojsonLayer.resetStyle();
  if (currentPlotLayer) currentPlotLayer = null;

  if (nearestPlot) {
    nearestPlot.setStyle({
      color: "red",
      weight: 2,
      fillColor: "lightgreen",
      fillOpacity: 0.7
    });
    currentPlotLayer = nearestPlot;

    // Popup at centroid
    let centroid = turf.centroid(nearestPlot.toGeoJSON());
    let coords = centroid.geometry.coordinates;

    L.popup()
      .setLatLng([coords[1], coords[0]])
      .setContent("📍 You are in Plot No: " + nearestPlot.feature.properties.plot_no)
      .openOn(map);

    // Update info panel
    infoControl.update({
      plot_no: nearestPlot.feature.properties.plot_no,
      accuracy: accuracy
    });
  } else {
    infoControl.update();
  }
}

function error(err) {
  console.warn(ERROR(${err.code}): ${err.message});
  alert("Location detection failed: " + err.message);
}
