let map;
let geojsonLayer;
let userMarker, userCircle;
let watchId;
let infoControl;

// ------------------ Initialize Map ------------------
document.addEventListener("DOMContentLoaded", function () {
    map = L.map("map").setView([22.57, 88.36], 20); // change to your mouza center

    // Add OSM base layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    // Create empty GeoJSON layer (plots)
    geojsonLayer = L.geoJSON(null, {
        style: {
            color: "#2c3e50",
            weight: 1,
            fillColor: "#f1c40f",
            fillOpacity: 0.4
        },
        onEachFeature: function (feature, layer) {
            // Tap any plot to show plot number
            layer.on("click", function () {
                L.popup()
                    .setLatLng(layer.getBounds().getCenter())
                    .setContent("Plot No: " + feature.properties.plot_no)
                    .openOn(map);
            });
        }
    }).addTo(map);

    // Load GeoJSON file
    fetch("mouza_plots.geojson")
        .then(res => res.json())
        .then(data => {
            geojsonLayer.addData(data);
            map.fitBounds(geojsonLayer.getBounds());
        })
        .catch(err => console.error("GeoJSON load error:", err));

    // Locate Me button
    let LocateControl = L.Control.extend({
        onAdd: function () {
            let btn = L.DomUtil.create("button", "locate-btn");
            btn.innerHTML = "📍";
            btn.title = "Locate Me";
            L.DomEvent.on(btn, "click", function () {
                startTracking();
            });
            return btn;
        }
    });
    map.addControl(new LocateControl({ position: "topleft" }));

    // Info panel
    infoControl = L.control({ position: "topright" });
    infoControl.onAdd = function () {
        this._div = L.DomUtil.create("div", "info");
        this.update();
        return this._div;
    };
    infoControl.update = function (props) {
        this._div.innerHTML = `
            <h4>Mouza: Subirchak</h4>
            <b>J.L No: 90</b><br>
            ${props
                ? `📍 Current Plot: <b>${props.plot_no}</b><br>GPS Accuracy: ±${props.accuracy}m`
                : "Press 📍 button to start tracking"
            }`;
    };
    infoControl.addTo(map);
});

// ------------------ GPS Tracking ------------------
function startTracking() {
    if (!navigator.geolocation) {
        alert("Geolocation not supported by your browser.");
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

    // Remove old marker/circle
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);

    // Add marker
    userMarker = L.marker(latlng).addTo(map);

    // Add small accuracy circle (not blocking clicks)
    userCircle = L.circle(latlng, {
        radius: Math.min(20, accuracy),
        color: "blue",
        fillColor: "blue",
        fillOpacity: 0.1,
        interactive: false
    }).addTo(map);

    // Center map on user
    map.setView(latlng, map.getZoom());

    // Find which plot user is in
    let point = turf.point([lng, lat]);
    let insidePlot = null;

    geojsonLayer.eachLayer(layer => {
        if (turf.booleanPointInPolygon(point, layer.toGeoJSON())) {
            insidePlot = layer;
        }
    });

    // Reset styles
    geojsonLayer.resetStyle();

    if (insidePlot) {
        insidePlot.setStyle({
            color: "red",
            weight: 2,
            fillColor: "lightgreen",
            fillOpacity: 0.7
        });

        // Popup at centroid
        let centroid = turf.centroid(insidePlot.toGeoJSON());
        let coords = centroid.geometry.coordinates;

        L.popup()
            .setLatLng([coords[1], coords[0]])
            .setContent("📍 You are in Plot No: " + insidePlot.feature.properties.plot_no)
            .openOn(map);

        infoControl.update({
            plot_no: insidePlot.feature.properties.plot_no,
            accuracy: accuracy
        });
    } else {
        infoControl.update();
    }
}

function error(err) {
    console.warn("Geolocation error:", err);
    alert("Location detection failed: " + err.message);
}


