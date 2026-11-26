import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {routeOverlayScript} from './route-map-overlay';
import type {MapRoutes} from './route-api';

interface Mapa2DProps {
  onSeleccionarCoordenada: (lat: number, lon: number) => void;
  initialLat?: number;
  initialLon?: number;
  origen?: { lat: number; lon: number } | null;
  destino?: { lat: number; lon: number } | null;
  modoSeleccion?: 'solar' | 'origen' | 'destino';
  modoBusqueda?: 'lugar' | 'ruta';
  rutas?: MapRoutes | null;
  parkings?: Array<{
    id: string | number;
    lat: number;
    lon: number;
    nombre: string;
    probabilidad: number | string;
    franjaHoraria?: string;
  }>;
}

export function Mapa2D({ onSeleccionarCoordenada, initialLat = 40.4168, initialLon = -3.7038, origen, destino, modoSeleccion = 'solar', modoBusqueda = 'lugar', rutas, parkings }: Mapa2DProps) {
  // Depuración: registrar en consola las props recibidas por el mapa
  console.log('Props del mapa:', { origen, destino, modoSeleccion, modoBusqueda });

  const webViewRef = useRef<WebView>(null);

  // const htmlContent = `
  const sendParkingsToWebView = () => {
    const serializedParkings = JSON.stringify(parkings || [])
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    webViewRef.current?.injectJavaScript(`
      if (typeof window.updateParkings === 'function') {
        window.updateParkings(${serializedParkings});
      }
      true;
    `);
  };
  useEffect(() => {
    sendParkingsToWebView();
  }, [parkings]);

  const htmlContent = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
      <style>
        html, body, #map {
          height: 100%;
          margin: 0;
          padding: 0;
          background-color: #e5e5e5;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
      <script>
        // Inicializar el mapa de Leaflet con opciones de zoom optimizadas y fluidas
        var map = L.map('map', {
          zoomSnap: 1,          // Fuerza niveles de zoom enteros para evitar saltos extraños
          zoomDelta: 1,         // Incremento/decremento de zoom de 1 en 1 por clic o pellizco
          scrollWheelZoom: true,// Habilitar zoom con la rueda del ratón con total fluidez
          maxZoom: 19,          // Nivel máximo de zoom para ver detalles de edificios
          minZoom: 3            // Nivel mínimo de zoom global
        }).setView([${initialLat}, ${initialLon}], 16);

        // Usamos CartoDB (más rápido y fiable que OSM público)
        //L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          //maxZoom: 19,
          //attribution: '&copy; OpenStreetMap &copy; CartoDB'
        //}).addTo(map);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // El marcador normal (L.marker) solo se pinta si modoBusqueda === 'lugar'
        ${modoBusqueda === 'lugar' ? `var marker = L.marker([${initialLat}, ${initialLon}]).addTo(map);` : 'var marker = null;'}

        // El círculo verde (origen) solo se pinta si origen no es nulo Y modoBusqueda === 'ruta'
        ${origen && modoBusqueda === 'ruta' ? `L.circleMarker([${origen.lat}, ${origen.lon}], { color: '#28a745', radius: 8, fillOpacity: 1 }).addTo(map).bindTooltip('Origen', { permanent: true, direction: 'top' });` : ''}

        // El círculo rojo (destino) solo se pinta si destino no es nulo Y modoBusqueda === 'ruta'
        ${destino && modoBusqueda === 'ruta' ? `L.circleMarker([${destino.lat}, ${destino.lon}], { color: '#dc3545', radius: 8, fillOpacity: 1 }).addTo(map).bindTooltip('Destino', { permanent: true, direction: 'top' });` : ''}

        ${modoBusqueda === 'ruta' && origen && destino ? `map.fitBounds([[${origen.lat}, ${origen.lon}], [${destino.lat}, ${destino.lon}]], { padding: [45, 45], maxZoom: 16, animate: false });` :
          modoBusqueda === 'ruta' && origen ? `map.setView([${origen.lat}, ${origen.lon}], 16);` : ''}

        ${modoBusqueda === 'ruta' ? routeOverlayScript(rutas,origen,destino) : ''}

        // Capa dedicada a los parkings para limpiar y repintar dinámicamente sin recargar el mapa
        // if (!map.getPane('parkingsPane')) {
        //   var parkingsPane = map.createPane('parkingsPane');
        //   parkingsPane.style.zIndex = 650;
        //   parkingsPane.style.pointerEvents = 'auto';
        // }
        var parkingsLayer = L.layerGroup().addTo(map);

        function escapeHtml(value) {
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        window.updateParkings = function(parkingsData) {
          parkingsLayer.clearLayers();
          if (!Array.isArray(parkingsData)) return;
          parkingsData.forEach(function(p) {
            var latNum = Number(p.lat);
            var lonNum = Number(p.lon);
            if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return;

            var parkingMarker = L.circleMarker([latNum, lonNum], {
              // pane: 'parkingsPane',
              // color: '#ffffff',
              // weight: 2,
              color: '#0056b3',
              fillColor: '#007bff',
              fillOpacity: 0.,
              radius: 8
            });

            var franjaTexto = p.franjaHoraria
              ? '<br/>Franja horaria: ' + escapeHtml(p.franjaHoraria)
              : '';
            var mensaje = escapeHtml(p.nombre) + ': ' + escapeHtml(p.probabilidad) + '% libre' + franjaTexto;
            // parkingMarker.bindPopup(mensaje);

            // Al hacer clic en un marcador de parking en móvil, enviar postMessage con la información
            parkingMarker.on('click', function(e) {
              L.DomEvent.stopPropagation(e);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PARKING_CLICK', mensaje: mensaje, parking: p }));
              }
            });

            parkingsLayer.addLayer(parkingMarker);
          });
        };

        map.on('click', function(e) {
          var lat = e.latlng.lat;
          var lon = e.latlng.lng;
          if (marker) {
            marker.setLatLng([lat, lon]);
          }
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lon: lon }));
          }
        });
      </script>
    </body>
    </html>
  `, [initialLat, initialLon, origen, destino, modoBusqueda, rutas]);

  const webViewSource = useMemo(() => ({ html: htmlContent }), [htmlContent]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.lat === 'number' && typeof data.lon === 'number') {
        onSeleccionarCoordenada(data.lat, data.lon);
      }
    } catch (error) {
      console.error('Error parsing message from webview:', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={webViewSource}
        style={styles.webview}
        onMessage={handleMessage}
        onLoadEnd={sendParkingsToWebView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#0066cc" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: '#e5e5e5',
  },
  loading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
