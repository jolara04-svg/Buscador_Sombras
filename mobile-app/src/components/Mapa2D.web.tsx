import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

export interface MapViewport {
  centerLat: number;
  centerLon: number;
  zoom: number;
  width: number;
  height: number;
}

export interface Mapa2DProps {
  onViewportChange?: (viewport: MapViewport) => void;
  onSeleccionarCoordenada?: (lat: number, lon: number) => void;
  initialLat?: number;
  initialLon?: number;
  origen?: { lat: number; lon: number } | null;
  destino?: { lat: number; lon: number } | null;
  modoSeleccion?: 'solar' | 'origen' | 'destino';
  modoBusqueda?: 'lugar' | 'ruta';
}

export const Mapa2D: React.FC<Mapa2DProps> = ({
  onViewportChange,
  onSeleccionarCoordenada,
  initialLat = 40.4168,
  initialLon = -3.7038,
  origen,
  destino,
  modoBusqueda = 'lugar',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (data?.type === 'MAP_VIEWPORT' &&
          ['centerLat', 'centerLon', 'zoom', 'width', 'height'].every(key => Number.isFinite(data[key]))) {
        onViewportChange?.(data);
      } else if (
        data &&
        data.type === 'SELECCIONAR_COORDENADA' &&
        typeof data.lat === 'number' &&
        typeof data.lon === 'number'
      ) {
        // Aquí está la corrección: pasamos lat y lon por separado
        onSeleccionarCoordenada?.(data.lat, data.lon);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => { window.removeEventListener('message', handleMessage); };
  }, [onSeleccionarCoordenada, onViewportChange]);

  const leafletHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var lat = ${initialLat};
      var lon = ${initialLon};
      var map = L.map('map', { zoomAnimation: false }).setView([lat, lon], 16);
      function reportViewport() {
        var center = map.getCenter(), size = map.getSize();
        window.parent.postMessage({ type: 'MAP_VIEWPORT', centerLat: center.lat,
          centerLon: center.lng, zoom: map.getZoom(), width: size.x, height: size.y }, '*');
      }
      map.on('move zoom resize', reportViewport);
      new ResizeObserver(function() { map.invalidateSize(); reportViewport(); }).observe(document.getElementById('map'));
      map.whenReady(reportViewport);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
      }).addTo(map);

      // El marcador normal (L.marker) solo se pinta si modoBusqueda === 'lugar'
      ${modoBusqueda === 'lugar' ? `var marker = L.marker([lat, lon]).addTo(map);` : 'var marker = null;'}

      // El círculo verde (origen) solo se pinta si origen no es nulo Y modoBusqueda === 'ruta'
      ${origen && modoBusqueda === 'ruta' ? `L.circleMarker([${origen.lat}, ${origen.lon}], { color: '#28a745', radius: 8, fillOpacity: 1 }).addTo(map);` : ''}

      // El círculo rojo (destino) solo se pinta si destino no es nulo Y modoBusqueda === 'ruta'
      ${destino && modoBusqueda === 'ruta' ? `L.circleMarker([${destino.lat}, ${destino.lon}], { color: '#dc3545', radius: 8, fillOpacity: 1 }).addTo(map);` : ''}

      map.on('click', function(e) {
        var clickedLat = e.latlng.lat;
        var clickedLon = e.latlng.lng;
        if (marker) {
          marker.setLatLng(e.latlng);
        }
        if (window.parent) {
          window.parent.postMessage({ type: 'SELECCIONAR_COORDENADA', lat: clickedLat, lon: clickedLon }, '*');
        }
      });
    })();
  </script>
</body>
</html>`;
  }, [initialLat, initialLon, origen, destino, modoBusqueda]);

  return (
    <View style={styles.container}>
      <iframe
        ref={iframeRef}
        title="Mapa Leaflet 2D"
        srcDoc={leafletHtml}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </View>
  );
};

export default Mapa2D;

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' },
});
