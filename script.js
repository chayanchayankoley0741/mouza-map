let map = L.map('map', {
  zoom: 16,
  minZoom: 14,
  maxZoom: 22
});

// Base map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let geojsonLayer, mouzaBoundary;
let userMarker, userCircle;

// Load GeoJSON plots
fetch("mouza_plots.geojson")
  .then(res => res.json())
  .then(data => {
    geojsonLayer = L.geoJSON(data, {
      style: {
        color: "#2c3e50",
        weight: 1,
        fillColor: "#f1c40f",
        fillOpacity: 0.4
      },
      onEachFeature: function(feature, layer) {
        layer.on("click", function() {
          layer.bindPopup("Plot No: " + feature.properties.plot_no).openPopup();
        });
      }
    }).addTo(map);

    map.fitBounds(geojsonLayer.getBounds());

    // Create Mouza boundary (union of all plots)
    let features = data.features;
    if (features.length > 0) {
      mouzaBoundary = turf.union(...features);
      L.geoJSON(mouzaBoundary, {
        style: { color: "red", weight: 3, dashArray: "6 4", fill: false }
      }).addTo(map);
    }
  });

// Watch user location
function startTracking() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(success, error, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

function success(e) {
  let latlng = [e.coords.latitude, e.coords.longitude];
  let accuracy = e.coords.accuracy;

  if (userMarker) {
    map.removeLayer(userMarker);
    map.removeLayer(userCircle);
  }

  userMarker = L.marker(latlng).addTo(map);
  userCircle = L.circle(latlng, { radius: accuracy }).addTo(map);

  map.setView(latlng, 18);

  if (geojsonLayer) {
    let point = turf.point([latlng[1], latlng[0]]); // lng, lat

    let inside = mouzaBoundary ? turf.booleanPointInPolygon(point, mouzaBoundary) : false;

    let nearestPlot = null;
    let nearestDist = Infinity;

    geojsonLayer.eachLayer(layer => {
      let poly = layer.toGeoJSON();
      let dist = turf.distance(point, turf.centroid(poly), { units: "meters" });
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPlot = layer;
      }
    });

    if (nearestPlot && inside && nearestDist <= 50) {
      nearestPlot.setStyle({ fillColor: "lightgreen" });
      nearestPlot.bindPopup("📍 You are in Plot No: " + nearestPlot.feature.properties.plot_no).openPopup();
    }
  }
}

function error(err) {
  console.warn("Location error: " + err.message);
}

document.getElementById("locateBtn").addEventListener("click", startTracking);