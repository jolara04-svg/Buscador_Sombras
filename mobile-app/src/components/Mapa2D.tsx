import React, { useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Mapa2DProps {
  onSeleccionarCoordenada: (lat: number, lon: number) => void;
  initialLat?: number;
  initialLon?: number;
  origen?: { lat: number; lon: number } | null;
  destino?: { lat: number; lon: number } | null;
  modoSeleccion?: 'solar' | 'origen' | 'destino';
  modoBusqueda?: 'lugar' | 'ruta';
}

export function Mapa2D({ onSeleccionarCoordenada, initialLat = 40.4168, initialLon = -3.7038, origen, destino, modoSeleccion = 'solar', modoBusqueda = 'lugar' }: Mapa2DProps) {
  // Depuración: registrar en consola las props recibidas por el mapa
  console.log('Props del mapa:', { origen, destino, modoSeleccion, modoBusqueda });

  const webViewRef = useRef<WebView>(null);

  const htmlContent = `
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
        var map = L.map('map').setView([${initialLat}, ${initialLon}], 16);

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
        ${origen && modoBusqueda === 'ruta' ? `L.circleMarker([${origen.lat}, ${origen.lon}], { color: '#28a745', radius: 8, fillOpacity: 1 }).addTo(map);` : ''}

        // El círculo rojo (destino) solo se pinta si destino no es nulo Y modoBusqueda === 'ruta'
        ${destino && modoBusqueda === 'ruta' ? `L.circleMarker([${destino.lat}, ${destino.lon}], { color: '#dc3545', radius: 8, fillOpacity: 1 }).addTo(map);` : ''}

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
  `;

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
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
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