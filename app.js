const map = L.map("map", { zoomControl: true });

const streets = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 19,
  attribution: "Tiles &copy; Esri",
});
const aerial = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 19,
  attribution: "Imagery &copy; Esri, Maxar",
});
const aerialRoads = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 19,
});
const aerialNames = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 19,
});

function setBasemap(name) {
  [streets, aerial, aerialRoads, aerialNames].forEach((layer) => {
    if (map.hasLayer(layer)) map.removeLayer(layer);
  });
  if (name === "streets") streets.addTo(map);
  else {
    aerial.addTo(map);
    aerialRoads.addTo(map);
    aerialNames.addTo(map);
  }
}

setBasemap("aerial");

const BaseSwitch = L.Control.extend({
  onAdd() {
    const wrap = L.DomUtil.create("div", "base-switch");
    wrap.innerHTML = '<button type="button" data-base="aerial" aria-pressed="true">Aerial</button><button type="button" data-base="streets" aria-pressed="false">Streets</button>';
    L.DomEvent.disableClickPropagation(wrap);
    wrap.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      setBasemap(button.dataset.base);
      wrap.querySelectorAll("button").forEach((item) => {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
    });
    return wrap;
  },
});
new BaseSwitch({ position: "topright" }).addTo(map);

const lookName = document.getElementById("look-name");
const lookLink = document.getElementById("look-link");
let streetOpen = false;

function streetHref(lat, lon) {
  return "https://www.google.com/maps/@"
    + lat.toFixed(6) + "," + lon.toFixed(6)
    + ",3a,75y,0h,90t/data=!3m1!1e1";
}

function showLook(lat, lon, title) {
  lookName.textContent = title;
  lookLink.href = streetHref(lat, lon);
  lookLink.hidden = false;
  if (streetOpen) {
    const opened = window.open(lookLink.href, "round-street");
    if (opened) opened.focus();
  }
}

lookLink.addEventListener("click", () => {
  streetOpen = true;
});

const locateButton = document.getElementById("locate");
let watchId = null;
let meMarker = null;
let meCircle = null;
let jumpToMe = false;

function meIcon() {
  return L.divIcon({
    className: "me",
    html: "<span></span>",
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

function setLocate(text, on) {
  locateButton.textContent = text;
  locateButton.setAttribute("aria-pressed", on ? "true" : "false");
}

function showMe(lat, lon, accuracy) {
  const latlng = [lat, lon];
  const radius = Math.max(accuracy || 30, 8);
  if (!meMarker) {
    meCircle = L.circle(latlng, {
      radius: radius,
      color: "#e3b423",
      weight: 2,
      fillColor: "#e3b423",
      fillOpacity: 0.16,
      interactive: false,
    }).addTo(map);
    meMarker = L.marker(latlng, {
      icon: meIcon(),
      zIndexOffset: 900,
      interactive: false,
      keyboard: false,
    }).addTo(map);
  } else {
    meCircle.setLatLng(latlng);
    meCircle.setRadius(radius);
    meMarker.setLatLng(latlng);
  }
  if (jumpToMe) {
    map.setView(latlng, Math.max(map.getZoom(), accuracy > 80 ? 16 : 18));
    jumpToMe = false;
  }
}

function startLocate(jump) {
  if (!navigator.geolocation) {
    setLocate("No location", false);
    return;
  }
  jumpToMe = jump;
  if (watchId != null) {
    if (jump && meMarker) {
      map.setView(meMarker.getLatLng(), Math.max(map.getZoom(), 17));
      jumpToMe = false;
    }
    return;
  }
  setLocate("Finding you", false);
  watchId = navigator.geolocation.watchPosition((pos) => {
    showMe(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    setLocate("You are here", true);
  }, (err) => {
    if (err.code === 1) {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      jumpToMe = false;
      setLocate("Allow location", false);
      return;
    }
    if (!meMarker) setLocate("Try again", false);
  }, {
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 20000,
  });
}

locateButton.addEventListener("click", () => startLocate(true));

function resumeLocate() {
  if (!navigator.geolocation) return;
  if (!navigator.permissions || !navigator.permissions.query) {
    startLocate(false);
    return;
  }
  navigator.permissions.query({ name: "geolocation" }).then((result) => {
    if (result.state === "granted") startLocate(false);
  }).catch(() => startLocate(false));
}

const layers = {
  boxes: L.layerGroup().addTo(map),
  roads: L.layerGroup().addTo(map),
  taps: L.layerGroup().addTo(map),
  mapped: L.layerGroup().addTo(map),
  track: L.layerGroup().addTo(map),
};

const byId = new Map();

function streetLink(lat, lon) {
  return `<p><a class="street-link" href="${streetHref(lat, lon)}" target="round-street" rel="noopener">Open street view</a></p>`;
}

function popup(title, body, lat, lon) {
  const street = lat == null ? "" : streetLink(lat, lon);
  return `<strong>${title}</strong><p>${body}</p>${street}`;
}

function tagIcon(text, unsure) {
  const width = Math.max(28, text.length * 12 + 8);
  return L.divIcon({
    className: unsure ? "tag unsure" : "tag",
    html: `<span>${text}</span>`,
    iconSize: [width, 28],
    iconAnchor: [10, 14],
    popupAnchor: [8, -12],
  });
}

function turnIcon(text) {
  const width = Math.max(28, text.length * 7 + 12);
  return L.divIcon({
    className: "turn",
    html: `<span>${text}</span>`,
    iconSize: [width, 28],
    iconAnchor: [width / 2, 14],
    popupAnchor: [0, -12],
  });
}

function dotIcon() {
  return L.divIcon({
    className: "dot",
    html: "<span></span>",
    iconSize: [19, 19],
    iconAnchor: [10, 10],
  });
}

function ringIcon() {
  return L.divIcon({
    className: "ring",
    html: "<span></span>",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function selectRow(id) {
  document.querySelectorAll(".row").forEach((row) => {
    row.classList.toggle("is-on", row.dataset.id === id);
  });
  const row = document.querySelector(`.row[data-id="${id}"]`);
  if (row) row.scrollIntoView({ block: "nearest" });
}

let pendingPopup = null;

function openMarker(id) {
  if (pendingPopup) {
    map.off("moveend", pendingPopup);
    pendingPopup = null;
  }
  selectRow(id);
  const marker = byId.get(id);
  const row = document.querySelector(`.row[data-id="${id}"] .name`);
  const title = row ? row.textContent : "This stop";
  if (!marker) {
    map.closePopup();
    lookName.textContent = title + " has no GPS on the list.";
    lookLink.hidden = true;
    return;
  }
  const ll = marker.getLatLng();
  showLook(ll.lat, ll.lng, title);
  const show = () => {
    pendingPopup = null;
    marker.openPopup();
  };
  pendingPopup = show;
  map.once("moveend", show);
  map.setView(marker.getLatLng(), 18, { animate: true });
}

function addRow(list, item, id) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.className = "row" + (item.unplaced ? " is-open" : "");
  button.dataset.id = id;
  button.type = "button";
  const key = item.key ? `<span class="key">Key ${item.key}</span>` : "";
  const hint = item.hint ? `<span class="hint">${item.hint}</span>` : "";
  button.innerHTML = `<span class="num">${item.n}</span><span><span class="name">${item.name}</span>${key}${hint}</span>`;
  button.addEventListener("click", () => openMarker(id));
  li.appendChild(button);
  list.appendChild(li);
}

function draw(data) {
    const track = data.track || [];
    if (track.length > 1) {
      const casing = L.polyline(track, { color: "#f4f7f2", weight: 7, opacity: 0.9 });
      const line = L.polyline(track, {
        color: "#1e4d6b",
        weight: 4,
        opacity: 0.95,
      });
      line.bindPopup(popup("Thursday drive", "The road from your phone, 15:33 to 18:25. This is the path, not the boxes."));
      layers.track.addLayer(casing);
      layers.track.addLayer(line);
    }

    const boxList = document.getElementById("box-list");
    const groups = [];
    data.boxes.forEach((box) => {
      const hit = groups.find((group) => {
        const dlat = (group.lat - box.lat) * 111000;
        const dlon = (group.lon - box.lon) * 70000;
        return Math.hypot(dlat, dlon) < 30;
      });
      if (hit) hit.items.push(box);
      else groups.push({ lat: box.lat, lon: box.lon, items: [box] });
    });

    groups.forEach((group) => {
      const id = "box-" + group.items[0].n;
      const label = group.items.map((box) => box.n).join("·");
      const unsure = group.items.every((box) => !box.sure);
      const marker = L.marker([group.lat, group.lon], {
        icon: tagIcon(label, unsure),
        zIndexOffset: 500,
      });
      const body = group.items
        .map((box) => {
          const keyLine = box.key ? `Key ${box.key}. ` : "";
          const sure = box.sure ? "" : " This match is likely, and the tag is hollow.";
          const when = box.time ? ` Tapped at ${box.time}.` : "";
          return `<p><strong>${box.n}  ${box.name}</strong>${keyLine}${box.detail}${when}${sure}</p>`;
        })
        .join("");
      marker.bindPopup(`<div>${body}${streetLink(group.lat, group.lon)}</div>`, { maxWidth: 260, autoPanPadding: [16, 16] });
      marker.on("click", () => {
        selectRow(id);
        showLook(group.lat, group.lon, group.items.map((box) => box.name).join(", "));
      });
      layers.boxes.addLayer(marker);
      group.items.forEach((box) => {
        byId.set("box-" + box.n, marker);
        addRow(boxList, box, "box-" + box.n);
      });
    });

    data.roads.forEach((road) => {
      const marker = L.marker([road.lat, road.lon], { icon: turnIcon(road.note), zIndexOffset: 400 });
      marker.bindPopup(popup(road.note, `${road.detail} Tapped at ${road.time}.`, road.lat, road.lon));
      marker.on("click", () => showLook(road.lat, road.lon, road.note));
      layers.roads.addLayer(marker);
    });

    data.taps.forEach((tap) => {
      const where = tap.place && tap.place !== tap.street ? `${tap.street}, ${tap.place}` : (tap.street || tap.place || "Tap");
      const marker = L.marker([tap.lat, tap.lon], { icon: dotIcon(), zIndexOffset: 200 });
      const note = tap.note ? ` You wrote “${tap.note}”.` : "";
      marker.bindPopup(popup(tap.time + "  " + where, `This tap is not a placed box. It may be another box, or another mark on the road.${note}`, tap.lat, tap.lon));
      marker.on("click", () => showLook(tap.lat, tap.lon, where));
      layers.taps.addLayer(marker);
    });

    data.mapped.forEach((item) => {
      const marker = L.marker([item.lat, item.lon], { icon: ringIcon(), zIndexOffset: 100 });
      const kind = item.kind === "post_office" ? "Mapped post office" : "Mapped post box";
      marker.bindPopup(popup(kind, item.label + ". This comes from the map, not from a tap.", item.lat, item.lon));
      marker.on("click", () => showLook(item.lat, item.lon, item.label));
      layers.mapped.addLayer(marker);
    });

    const openList = document.getElementById("open-list");
    const openSection = openList.closest("section");
    if (!data.unplaced || !data.unplaced.length) openSection.hidden = true;
    (data.unplaced || []).forEach((item) => {
      const id = "open-" + item.n;
      item.unplaced = true;
      if (item.lat != null && item.lon != null) {
        const marker = L.marker([item.lat, item.lon], {
          icon: dotIcon(),
          opacity: 0,
          interactive: false,
        });
        marker.bindPopup(popup(item.n + "  " + item.name, item.hint + " This name is not pinned as a box.", item.lat, item.lon));
        layers.taps.addLayer(marker);
        byId.set(id, marker);
      }
      addRow(openList, item, id);
    });

    const points = (data.boxes || [])
      .filter((box) => box.lat != null && box.lon != null)
      .map((box) => [box.lat, box.lon]);
    if (points.length) map.fitBounds(points, { padding: [28, 28] });
    requestAnimationFrame(() => map.invalidateSize());
}

draw(window.ROUTE);

window.addEventListener("resize", () => map.invalidateSize());

map.on("click", (event) => {
  showLook(event.latlng.lat, event.latlng.lng, "This spot on the map");
});

map.on("popupopen", (event) => {
  const link = event.popup.getElement().querySelector(".street-link");
  if (!link) return;
  link.addEventListener("click", () => {
    streetOpen = true;
  });
});

resumeLocate();

document.querySelectorAll(".filters input").forEach((input) => {
  input.addEventListener("change", () => {
    const layer = layers[input.dataset.layer];
    if (input.checked) layer.addTo(map);
    else map.removeLayer(layer);
  });
});
