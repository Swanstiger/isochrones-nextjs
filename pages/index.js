// pages/index.js
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef } from 'react';

export default function Home() {
  const mapRef = useRef(null);

  useEffect(() => {
    // Si por alguna razón el ref no está listo, salimos.
    if (!mapRef.current || typeof window === 'undefined' || !window.L) return;

    // === INICIO DE ADAPTACIÓN DE app.js ===
    const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;
    const apiUrl = 'https://api.openrouteservice.org/v2/isochrones/';
    const mapTilerApiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

    // Inicializar el mapa centrado en Valencia
    const map = L.map('map', { zoomControl: false }).setView([39.4699, -0.3763], 12);

    // Capas base
    const openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    });
    const esriWorldImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }
    );
    openStreetMap.addTo(map);
    const baseLayers = {
      OpenStreetMap: openStreetMap,
      'Esri World Imagery': esriWorldImagery
    };
    L.control.layers(baseLayers, null, { position: 'topleft' }).addTo(map);

    // Control de geocodificación MapTiler
    if (L.control.maptilerGeocoding) {
      L.control
        .maptilerGeocoding({
          apiKey: mapTilerApiKey,
          position: 'topright',
          placeholder: 'Buscar ubicación...',
          marker: false
        })
        .addTo(map);
    }

    // Eliminar todas las cookies
    document.cookie.split(';').forEach(function (c) {
      document.cookie = c.trim().replace(/^.+$/, '') + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    });

    // Variables globales de la app
    let isochronesLayer = L.layerGroup().addTo(map);
    let points = [];
    let isochronesData = [];
    let isochroneLayers = [];
    let dataTableInstance;
    let generatedCombinations = new Set();
    let colorMap = {};
    const pointIdentifiers = new Map();
    let isochroneCounter = 1;
    const reservedIdentifiers = new Set();
    let availableIdentifiers = [];
    const iconColors = [
      'red',
      'blue',
      'green',
      'orange',
      'yellow',
      'violet',
      'grey',
      'black'
    ];
    const pointColorMap = new Map();
    let colorIndex = 0;

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Configuración del control de dibujo
    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          shapeOptions: {
            color: 'black',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.2
          }
        },
        polyline: false,
        rectangle: {
          shapeOptions: {
            color: 'black',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.2
          }
        },
        circle: false,
        marker: false,
        circlemarker: false
      }
    });
    map.addControl(drawControl);

    let avoidPolygons = [];
    let isDrawing = false;

    map.on(L.Draw.Event.CREATED, function (event) {
      const layer = event.layer;
      drawnItems.addLayer(layer);
      const latlngs = layer.getLatLngs()[0];
      if (latlngs.length > 0) {
        latlngs.push(latlngs[0]);
      }
      const geojsonCoords = latlngs.map((latlng) => [latlng.lng, latlng.lat]);
      avoidPolygons.push([geojsonCoords]);
      isDrawing = false;
    });

    map.on(L.Draw.Event.DRAWSTART, () => {
      isDrawing = true;
    });

    map.on(L.Draw.Event.EDITED, function (e) {
      e.layers.eachLayer(function (layer) {
        const latlngs = layer.getLatLngs()[0];
        if (latlngs.length > 0) {
          latlngs.push(latlngs[0]);
        }
        const geojsonCoords = latlngs.map((latlng) => [
          parseFloat(latlng.lng.toFixed(6)),
          parseFloat(latlng.lat.toFixed(6))
        ]);
        avoidPolygons = avoidPolygons.map((polygon) => {
          const isMatch = polygon[0].every((coord, index) => {
            return (
              parseFloat(coord[0].toFixed(6)) === geojsonCoords[index][0] &&
              parseFloat(coord[1].toFixed(6)) === geojsonCoords[index][1]
            );
          });
          return isMatch ? [geojsonCoords] : polygon;
        });
      });
    });

    map.on('click', function (e) {
      if (isDrawing) return;
      let identifier;
      if (availableIdentifiers.length > 0) {
        const safeIdentifiers = availableIdentifiers.filter(
          (id) => !isochronesData.some((data) => data.geojson.properties.identifier_simp === id)
        );
        if (safeIdentifiers.length > 0) {
          identifier = safeIdentifiers[0];
          availableIdentifiers = availableIdentifiers.filter((id) => id !== identifier);
        } else {
          identifier = `ISO-${isochroneCounter++}`;
        }
      } else {
        identifier = `ISO-${isochroneCounter++}`;
      }

      if (!pointColorMap.has(identifier)) {
        pointColorMap.set(identifier, iconColors[colorIndex % iconColors.length]);
        colorIndex++;
      }

      const customIcon = L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${pointColorMap.get(
          identifier
        )}.png`,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        shadowSize: [41, 41],
        shadowAnchor: [12, 41]
      });

      const marker = L.marker(e.latlng, { draggable: true, icon: customIcon }).addTo(map);
      points.push(marker);
      pointIdentifiers.set(marker, identifier);
      marker.bindPopup(identifier).openPopup();
      setTimeout(() => {
        marker.closePopup();
      }, 1000);

      marker.on('contextmenu', function () {
        const markerId = pointIdentifiers.get(marker);
        const hasIsochrones = isochronesData.some(
          (data) => data.geojson.properties.identifier_simp === markerId
        );
        if (!hasIsochrones) {
          availableIdentifiers.push(markerId);
        } else {
          reservedIdentifiers.add(markerId);
        }
        map.removeLayer(marker);
        points = points.filter((p) => p !== marker);
        pointIdentifiers.delete(marker);
      });
    });

    // Inicializar DataTable cuando el DOM esté listo
    if (window.$) {
      window.$(document).ready(function () {
        dataTableInstance = window.$('#isochroneTable').DataTable({
          language: {
            url: 'https://cdn.datatables.net/plug-ins/2.1.8/i18n/es-ES.json'
          },
          order: [],
          paging: false,
          searching: true,
          info: false,
          columns: [
            { data: 'identifier_simp' },
            { data: 'timeInMinutes' },
            { data: 'population' },
            { data: 'mode' }
          ]
        });

        window.$('#isochroneTable tbody').on('mouseenter', 'tr', function () {
          const data = dataTableInstance.row(this).data();
          if (data) {
            const matchingLayer = isochroneLayers.find(
              (layer) =>
                layer.feature &&
                layer.feature.properties &&
                layer.feature.properties.identifier === data.identifier
            );
            if (matchingLayer) {
              const originalColor = getRandomColor();
              matchingLayer.setStyle({
                weight: 4,
                color: originalColor,
                opacity: 1,
                fillOpacity: 0.5
              });
              matchingLayer.bringToFront();
            }
          }
        });

        window.$('#isochroneTable tbody').on('mouseleave', 'tr', function () {
          const data = dataTableInstance.row(this).data();
          if (data) {
            const matchingLayer = isochroneLayers.find(
              (layer) =>
                layer.feature &&
                layer.feature.properties &&
                layer.feature.properties.identifier === data.identifier
            );
            if (matchingLayer) {
              matchingLayer.setStyle({
                weight: 2,
                color: getRandomColor(),
                opacity: 1,
                fillOpacity: 0.2
              });
            }
          }
        });
      });
    }

    function cleanAvoidPolygons() {
      avoidPolygons = [];
    }

    function getAvoidPolygonsGeoJSON() {
      return {
        type: 'MultiPolygon',
        coordinates: avoidPolygons
      };
    }

    function translateTransportMode(mode) {
      switch (mode) {
        case 'foot-walking':
          return 'A pie';
        case 'driving-car':
          return 'Coche';
        default:
          return mode;
      }
    }

    function getRandomColor() {
      const hue = Math.floor(Math.random() * 360);
      return `hsl(${hue}, 70%, 50%)`;
    }

    async function generateIsochrones() {
      const input = document.getElementById('isochroneInput').value;
      const transportMode = document.getElementById('transport-mode').value;

      if (!input || points.length === 0) {
        alert('Introduce los tiempos y selecciona al menos un punto.');
        return;
      }
      const trafficFactor = transportMode === 'driving-car' ? 0.55 : 0.8;
      const times = input.split(',').map((t) => parseInt(t.trim()) * 60);
      const adjustedTimes = times.map((t) => t * trafficFactor);
      const coords = points.map((p) => p.getLatLng()).map((latlng) => [latlng.lng, latlng.lat]);

      try {
        const initialDataSize = isochronesData.length;
        const promises = coords.flatMap((coord, pointIndex) => {
          const pointId = pointIdentifiers.get(points[pointIndex]);
          return times.map((time, index) => {
            return fetchIsochrones(
              coord,
              [adjustedTimes[index]],
              pointId,
              transportMode,
              time
            );
          });
        });
        await Promise.all(promises);

        const newData = isochronesData.slice(initialDataSize);
        if (newData.length > 0 && dataTableInstance) {
          newData.forEach((data) => {
            const rowData = {
              identifier: data.geojson.properties.identifier,
              identifier_simp: data.geojson.properties.identifier_simp,
              timeInMinutes: data.timeInMinutes,
              population: data.population,
              mode: data.geojson.properties.mode
            };
            dataTableInstance.row.add(rowData);
          });
          dataTableInstance.draw();
        }
      } catch (error) {
        console.error('Error al generar isocronas:', error);
      }
    }

    async function fetchIsochrones(coord, adjustedTimes, pointId, transportMode, time) {
      try {
        const response = await fetch(`${apiUrl}${transportMode}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: apiKey
          },
          body: JSON.stringify({
            locations: [coord],
            range: adjustedTimes,
            range_type: 'time',
            attributes: ['total_pop'],
            options: {
              avoid_polygons: getAvoidPolygonsGeoJSON()
            }
          })
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();
        if (data?.features?.length) {
          data.features.forEach((feature) => {
            const properties = feature.properties;
            const population = properties.total_pop ?? 0;
            const timeInMinutes = time / 60;
            const identifier = `${pointId}-${timeInMinutes}min-${Date.now()}`;
            const identifier_simp = `${pointId}`;
            const mode = translateTransportMode(transportMode);
            const newProperties = {
              ...properties,
              timeInMinutes: timeInMinutes,
              population: population,
              identifier: identifier,
              identifier_simp: identifier_simp,
              mode: mode
            };
            feature.properties = newProperties;
            const isochroneLayer = L.geoJSON(feature, {
              style: function () {
                const randomColor = getRandomColor();
                return {
                  color: randomColor,
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.2,
                  fillColor: randomColor
                };
              }
            }).addTo(isochronesLayer);
            isochroneLayer.feature = feature;
            isochroneLayers.push(isochroneLayer);
            const isochroneData = {
              timeInMinutes: timeInMinutes,
              population: population,
              geojson: feature
            };
            isochronesData.push(isochroneData);
            isochroneLayer.bindPopup(
              `Iso: ${identifier_simp}<br>Tiempo: ${timeInMinutes} minutos<br>Población: ${population.toLocaleString()} hab.<br>Modo: ${mode}`
            );
          });
        }
      } catch (error) {
        console.error('Error al generar isocronas:', error);
      }
    }

    function resetMap() {
      isochronesLayer.clearLayers();
      points.forEach((p) => map.removeLayer(p));
      points = [];
      if (dataTableInstance) {
        dataTableInstance.clear().draw();
      }
      isochroneCounter = 1;
      availableIdentifiers.length = 0;
      reservedIdentifiers.clear();
      isochronesData = [];
      isochroneLayers = [];
      generatedCombinations.clear();
      pointIdentifiers.clear();
      console.log('Mapa y datos reseteados correctamente.');
    }

    function resetPol() {
      drawnItems.clearLayers();
      avoidPolygons = [];
    }

    function exportData() {
      const geojson = {
        type: 'FeatureCollection',
        features: isochronesData.map((data) => ({
          type: 'Feature',
          properties: {
            id: data.geojson.properties.identifier_simp,
            Tiempo: data.timeInMinutes,
            Población: data.population,
            Modo: data.geojson.properties.mode
          },
          geometry: data.geojson.geometry
        }))
      };
      const geojsonString = JSON.stringify(geojson);
      const blob = new Blob([geojsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'isochrones.geojson';
      a.click();
      URL.revokeObjectURL(url);
    }

    // Asociamos los botones del DOM con las funciones
    const generateBtn = document.getElementById('generateBtn');
    const resetMapBtn = document.getElementById('resetMapBtn');
    const resetPolBtn = document.getElementById('resetPolBtn');
    const exportBtn = document.getElementById('exportBtn');

    if (generateBtn) generateBtn.addEventListener('click', generateIsochrones);
    if (resetMapBtn) resetMapBtn.addEventListener('click', resetMap);
    if (resetPolBtn) resetPolBtn.addEventListener('click', resetPol);
    if (exportBtn) exportBtn.addEventListener('click', exportData);

    // === FIN DE ADAPTACIÓN DE app.js ===

    // Cleanup al desmontar el componente
    return () => {
      map.off();
      map.remove();
    };
  }, []);

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>Generador de Isocronas Mejorado</title>
      </Head>

      {/* Scripts externos: el orden es muy importante */}
      {/* 1) jQuery (para DataTables) */}
      <Script
        src="https://code.jquery.com/jquery-3.6.4.min.js"
        strategy="beforeInteractive"
      />
      {/* 2) DataTables */}
      <Script
        src="https://cdn.datatables.net/2.1.6/js/dataTables.min.js"
        strategy="beforeInteractive"
      />
      {/* 3) Bootstrap JS */}
      <Script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
        strategy="beforeInteractive"
      />
      {/* 4) Leaflet (necesario para L) */}
      <Script
        src="https://unpkg.com/leaflet/dist/leaflet.js"
        strategy="beforeInteractive"
      />
      {/* 5) Leaflet Draw */}
      <Script
        src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"
        strategy="beforeInteractive"
      />
      {/* 6) MapTiler Geocoding (depende de L) */}
      <Script
        src="https://cdn.maptiler.com/maptiler-geocoding-control/v1.3.3/leaflet.umd.js"
        strategy="beforeInteractive"
      />
      {/* 7) Google Maps API (depende para GoogleMutant) */}
      <Script
        src="https://maps.googleapis.com/maps/api/js?key=TU_API_KEY_GOOGLE"
        strategy="beforeInteractive"
      />
      {/* 8) Leaflet.GoogleMutant UMD (depende de L y google.maps) */}
      <Script
        src="https://unpkg.com/leaflet.gridlayer.googlemutant@0.15.0/dist/Leaflet.GoogleMutant.js"
        strategy="beforeInteractive"
      />

       {/* CONTENEDOR PRINCIPAL */}
    <div className="flex h-screen w-screen">
      {/* PANEL IZQUIERDO: MENU (20%) */}
      <div
        id="controls"
        className="w-1/5 min-w-[20%] max-w-[20%] overflow-y-auto p-3 bg-light border-r"
      >
        <div className="mb-3">
          <label htmlFor="isochroneInput" className="form-label">
            Isocronas
          </label>
          <input
            type="text"
            id="isochroneInput"
            className="form-control"
            placeholder="Ej: 5,10,20"
          />
        </div>
        <div className="mb-3">
          <label htmlFor="transport-mode" className="form-label">
            Modo de transporte
          </label>
          <select id="transport-mode" className="form-select">
            <option value="driving-car">Coche</option>
            <option value="foot-walking">A pie</option>
          </select>
        </div>
        <div className="d-grid gap-2">
          <button id="generateBtn" className="btn btn-primary">
            Crear Isocronas
          </button>
          <button id="resetMapBtn" className="btn btn-secondary">
            Restablecer Mapa
          </button>
          <button id="exportBtn" className="btn btn-success">
            Descargar Isocronas
          </button>
          <button id="resetPolBtn" className="btn btn-dark">
            Eliminar Polígonos
          </button>
        </div>
      </div>

      {/* MAPA: 50% */}
      <div
        id="map"
        ref={mapRef}
      className="w-1/2 h-screen"
      ></div>

      {/* PANEL DERECHO: TABLA (30%) */}
      <div
        id="infoPanel"
        className="w-3/10 min-w-[30%] max-w-[30%] overflow-y-auto flex flex-col p-3 bg-white border-l"

      >
        <table
          id="isochroneTable"
          className="table table-hover"
          style={{ width: '100%' }}
        >
          <thead>
            <tr>
              <th id="isochroneHeader">Iso</th>
              <th id="timeHeader">Min</th>
              <th id="populationHeader">Pob</th>
              <th id="modeHeader">Modo</th>
            </tr>
          </thead>
          <tbody id="isochroneTableBody"></tbody>
        </table>
      </div>
    </div>
  </>
);
}