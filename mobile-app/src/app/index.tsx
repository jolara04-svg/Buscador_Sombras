import { StyleSheet, Text, View, TextInput, Button, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';

import { getChunkUrl } from '@/constants/backend';
import { LocationChunkViewer } from '@/components/location-chunk-viewer';
import { Mapa2D } from '@/components/Mapa2D';
import { ShadowMap } from "@/components/ShadowMap";

type SolarPosition = {
  elevation: number;
  azimuth: number;
};

// Simplified solar position calculation
function calculateSunPosition(date: Date, latitude: number, longitude: number) {
  // Convert to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  // Julian date calculation
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-11 to 1-12
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();

  // Calculate Julian Date
  const JulianDate =
    367 * year
    - Math.floor((7 * (year + Math.floor((month + 9) / 12))) / 4)
    + Math.floor((275 * month) / 9)
    + day
    + 1721013.5
    + ((hour + minute / 60) / 24)
    - 0.5 * Math.sign(100 * year + month - 190002.5)
    + 0.5;

  // Days since J2000.0
  const n = JulianDate - 2451545.0;

  // Mean longitude of the sun
  const L = 280.460 + 0.9856474 * n;
  const L_norm = L % 360;

  // Mean anomaly of the sun
  const g = 357.528 + 0.9856003 * n;
  const g_rad = toRad(g % 360);

  // Ecliptic longitude of the sun
  const lambda = L_norm + 1.915 * Math.sin(g_rad) + 0.020 * Math.sin(2 * g_rad);

  // Obliquity of the ecliptic
  const epsilon = 23.439 - 0.0000004 * n;

  // Right ascension and declination
  const delta = Math.asin(Math.sin(toRad(epsilon)) * Math.sin(toRad(lambda)));

  // Greenwich mean sidereal time
  const GMST = 6.697375 + 0.0657098242 * n + hour;
  const GMST_deg = (GMST % 24) * 15;

  // Local hour angle
  const LHA = (GMST_deg + longitude - L_norm) % 360;
  const LHA_rad = toRad(LHA);

  // Latitude in radians
  const lat_rad = toRad(latitude);

  // Solar elevation (altitude)
  const elevation_rad = Math.asin(
    Math.sin(delta) * Math.sin(lat_rad) +
    Math.cos(delta) * Math.cos(lat_rad) * Math.cos(LHA_rad)
  );

  // Solar azimuth
  const azimuth_rad = Math.acos(
    (Math.sin(delta) - Math.sin(elevation_rad) * Math.sin(lat_rad)) /
    (Math.cos(elevation_rad) * Math.cos(lat_rad))
  );

  // Adjust azimuth based on hour angle
  const azimuth = LHA_rad > 0 ? toDeg(azimuth_rad) : 360 - toDeg(azimuth_rad);

  return {
    elevation: toDeg(elevation_rad),
    azimuth: azimuth
  };
}

export default function SolarCalculatorScreen() {
  // const [date, setDate] = useState(new Date());
  // const [time, setTime] = useState(new Date());
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [result, setResult] = useState<SolarPosition | null>(null);
  const [chunkUrl, setChunkUrl] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  // Estado para controlar la vista activa del mapa: '2d', '3d' o '2d-sombras'
  const [vistaActiva, setVistaActiva] = useState<'2d' | '3d' | '2d-sombras'>('2d');
    // Estados para la barra superior
  const [busqueda, setBusqueda] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState<'lugar' | 'ruta'>('lugar'); // Nuevo estado para el botón
  // Valores truncados (solo para mostrar en el input)
  const [latitudeDisplay, setLatitudeDisplay] = useState('');
  const [longitudeDisplay, setLongitudeDisplay] = useState('');

  // Estados para la selección de Origen y Destino en el mapa
  const [origen, setOrigen] = useState<{ lat: number, lon: number } | null>(null);
  const [destino, setDestino] = useState<{ lat: number, lon: number } | null>(null);
  const [modoSeleccion, setModoSeleccion] = useState<'solar' | 'origen' | 'destino'>('solar');


  // Formateo de la fecha (YYYY-MM-DD)
  const [fechaOperacion, setFechaOperacion] = useState(
    new Date().toISOString().split('T')[0]
  );
  // Formateo de la hora a 24h (HH:MM)
  const [horaOperacion, setHoraOperacion] = useState(
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
  );

  

  const handleCalculate = () => {
    try {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lon)) {
        alert('Por favor ingrese coordenadas válidas');
        return;
      }

      if (lat < -90 || lat > 90) {
        alert('La latitud debe estar entre -90 y 90 grados');
        return;
      }

      if (lon < -180 || lon > 180) {
        alert('La longitud debe estar entre -180 y 180 grados');
        return;
      }

      // Combine date and time
      // const combinedDate = new Date(date);
      // combinedDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
      // 1. Convertimos los textos de la barra superior a un objeto Date
      // El formato "YYYY-MM-DDTHH:MM:00" es el que entiende JavaScript
      const fechaHoraString = `${fechaOperacion}T${horaOperacion}:00`;
      const combinedDate = new Date(fechaHoraString);

      // 2. Validamos que la fecha no sea inválida
      if (isNaN(combinedDate.getTime())) {
        alert('Formato de fecha u hora inválido. Usa AAAA-MM-DD y HH:MM');
        return;
      }

      setCalculating(true);
      const position = calculateSunPosition(combinedDate, lat, lon);
      setResult(position);
      setChunkUrl(getChunkUrl(lat, lon));
      setCalculating(false);
    } catch (error) {
      alert('Error en el cálculo: ' + (error instanceof Error ? error.message : 'desconocido'));
      setCalculating(false);
    }
  };

  // Función para truncar un número a 6 decimales sin redondear
  const truncarA6Decimales = (valor: string | number) => {
    const str = String(valor);
    if (!str.includes('.')) return str; // Si no tiene decimales, lo devolvemos tal cual
    const [entero, decimales] = str.split('.');
    return `${entero}.${decimales.slice(0, 6)}`; // Cortamos los decimales a 6
  };

  return (

    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
      style={styles.scrollView}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Calculadora de Posición Solar</Text>
        <Text style={styles.subtitle}>Ingrese fecha, hora y ubicación</Text>
      </View>

                {/* BARRA SUPERIOR TIPO GOOGLE MAPS */}
                    <View style={styles.topBarContainer}>
                      
                      {/* 1. Buscador con botones integrados */}
                      <View style={styles.searchBar}>
                        <TextInput
                          style={styles.searchInput}
                          placeholder={modoBusqueda === 'lugar' ? "Buscar lugar..." : "¿A dónde quieres ir?"}
                          value={busqueda}
                          onChangeText={setBusqueda}
                        />
                        
                        {/* Botones de modo dentro del buscador */}
                        <View style={styles.searchModeButtons}>
                          <Pressable 
                            style={[styles.modeButton, modoBusqueda === 'lugar' && styles.modeButtonActive]}
                            onPress={() => {
                              // Sincronizamos con el modo de búsqueda 'lugar' y el modo solar en el mapa
                              setModoBusqueda('lugar');
                              setModoSeleccion('solar');
                            }}
                          >
                            <Text style={styles.modeButtonText}>🔍</Text>
                          </Pressable>
                          <Pressable 
                            style={[styles.modeButton, modoBusqueda === 'ruta' && styles.modeButtonActive]}
                            onPress={() => {
                              // Sincronizamos con el modo de búsqueda 'ruta' y aseguramos que el primer clic sea el origen
                              setModoBusqueda('ruta');
                              setModoSeleccion('origen');
                            }}
                          >
                            <Text style={styles.modeButtonText}>🧭</Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* 2. Fecha y Hora unificadas */}
                      <View style={styles.datetimeBox}>
                        {/* Fecha (izquierda) */}
                        <TextInput
                          style={styles.datetimeInput}
                          value={fechaOperacion}
                          onChangeText={setFechaOperacion}
                          placeholder="AAAA-MM-DD"
                        />
                        
                        {/* Línea divisoria vertical */}
                        <View style={styles.verticalDivider} />
                        
                        {/* Hora (derecha) */}
                        <TextInput
                          style={styles.datetimeInput}
                          value={horaOperacion}
                          onChangeText={setHoraOperacion}
                          placeholder="HH:MM"
                        />
                      </View>

      </View>   

      {/* CONTENEDOR PRINCIPAL DEL VISOR DE MAPA (Altura fija y ancho completo) */}
      <View style={styles.mapContainer}>
        {/* Renderizado condicional: Vista 2D y 2D con sombras */}
        {(vistaActiva === '2d' /*|| vistaActiva === '2d-sombras'*/) && (
          <Mapa2D
            initialLat={parseFloat(latitude) || 40.4168}
            initialLon={parseFloat(longitude) || -3.7038}
            // Pasamos el origen, destino, modo de selección y el modo de búsqueda al mapa
            origen={origen}
            destino={destino}
            modoSeleccion={modoSeleccion}
            modoBusqueda={modoBusqueda}
            onSeleccionarCoordenada={(lat, lon) => {
              // Depuración: registrar coordenada seleccionada y el modo actual en consola
              console.log('Coordenada seleccionada:', { lat, lon, modoBusqueda, modoSeleccion });

              // Si estamos en modo lugar, actualizamos el formulario de cálculo solar
              if (modoBusqueda === 'lugar') {
                setLatitude(lat.toString());
                setLongitude(lon.toString());
                setLatitudeDisplay(truncarA6Decimales(lat.toString()));
                setLongitudeDisplay(truncarA6Decimales(lon.toString()));
              } else if (modoBusqueda === 'ruta') {
                // Si estamos en modo ruta, alternamos continuamente entre origen y destino
                if (modoSeleccion === 'origen') {
                  // Establecemos el punto de origen y pasamos automáticamente a elegir destino
                  setOrigen({ lat, lon });
                  setModoSeleccion('destino');
                } else if (modoSeleccion === 'destino') {
                  // Establecemos el punto de destino y volvemos a origen para alternar continuamente
                  setDestino({ lat, lon });
                  setModoSeleccion('origen');
                }
              }
            }}
          />
        )}
        {/* Randerizado condicional: Vista 2D con sombras provisional */}
          {vistaActiva==="2d-sombras" && (
            <ShadowMap
              chunkURL={getChunkUrl(
                isNaN(parseFloat(latitude)) ? 40.4168 : parseFloat(latitude),
                isNaN(parseFloat(longitude)) ? -3.7038 : parseFloat(longitude)
              )}
              azimuth={0}
              elevation={90}
            />
          )}
        {/* Renderizado condicional: Vista 3D con visor de fragmentos de modelo */}
        {vistaActiva === '3d' && (
          <LocationChunkViewer
            chunkUrl={getChunkUrl(
              isNaN(parseFloat(latitude)) ? 40.4168 : parseFloat(latitude),
              isNaN(parseFloat(longitude)) ? -3.7038 : parseFloat(longitude)
            )}
          />
        )}

        {/* 1. Cuadro flotante compacto de resultados ubicado encima del botón de calcular */}
        {result && (
          <View style={styles.floatingResultsContainer}>
            <Text style={styles.floatingResultsTitle}>Resultados:</Text>
            <View style={styles.floatingResultItem}>
              <Text style={styles.floatingResultLabel}>Altura solar: </Text>
              <Text style={styles.floatingResultValue}>{result.elevation.toFixed(2)}°</Text>
            </View>
            <View style={styles.floatingResultItem}>
              <Text style={styles.floatingResultLabel}>Acimut solar: </Text>
              <Text style={styles.floatingResultValue}>{result.azimuth.toFixed(2)}°</Text>
            </View>
          </View>
        )}

        {/* 2. Botón flotante estilo píldora para calcular posición solar en la esquina inferior izquierda */}
        <View style={styles.floatingCalculateButtonContainer}>
          <Pressable
            style={styles.floatingCalculateButton}
            onPress={handleCalculate}
            disabled={calculating}
          >
            <Text style={styles.floatingCalculateButtonText}>
              {calculating ? 'Calculando...' : 'Calcular Posición Solar'}
            </Text>
          </Pressable>
        </View>

        {/* 3. Contenedor centrado para el indicador de coordenadas sobre el mapa */}
        <View style={styles.coordsBadgeWrapper} pointerEvents="box-none">
          {/* Indicador de coordenadas flotante editable centrado */}
          <View style={styles.coordsBadge}>
            <Text style={styles.coordsText}>{/*lat*/}</Text>
            <TextInput
              style={styles.coordsInput}
              keyboardType="numeric"
              value={latitudeDisplay}
              onChangeText={(text) => {
                const regex = /^-?\d*\.?\d{0,6}$/;
                if (regex.test(text) || text === '') {
                  setLatitude(text);        // Guardamos el valor completo (ya limitado a 6)
                  setLatitudeDisplay(text); // Mostramos lo que escribe
                }
              }}
              placeholder="40.4168"
            />
            <Text style={styles.coordsText}>,</Text>
            <Text style={styles.coordsText}>{/*long*/}</Text>
            <TextInput
              style={styles.coordsInput}
              keyboardType="numeric"
              value={longitudeDisplay}
              onChangeText={(text) => {
                const regex = /^-?\d*\.?\d{0,6}$/;
                if (regex.test(text) || text === '') {
                  setLongitude(text);
                  setLongitudeDisplay(text);
                }
              }}
              placeholder="-3.7038"
            />
          </View>
        </View>

        {/* 4. CONTROL SEGMENTADO FLOTANTE: En la esquina inferior derecha */}
        <View style={styles.segmentedControlContainer}>
          {/* Botón para activar vista 2D */}
          <Pressable
            style={[
              styles.segmentButton,
              vistaActiva === '2d' && styles.segmentButtonActive,
            ]}
            onPress={() => setVistaActiva('2d')}
          >
            <Text
              style={[
                styles.segmentButtonText,
                vistaActiva === '2d' && styles.segmentButtonTextActive,
              ]}
            >
              2D
            </Text>
          </Pressable>

          {/* Línea divisoria vertical */}
          <View style={styles.segmentDivider} />

          {/* Botón para activar vista 3D */}
          <Pressable
            style={[
              styles.segmentButton,
              vistaActiva === '3d' && styles.segmentButtonActive,
            ]}
            onPress={() => setVistaActiva('3d')}
          >
            <Text
              style={[
                styles.segmentButtonText,
                vistaActiva === '3d' && styles.segmentButtonTextActive,
              ]}
            >
              3D
            </Text>
          </Pressable>

          {/* Línea divisoria vertical */}
          <View style={styles.segmentDivider} />

          {/* Botón para activar vista 2D con sombras */}
          <Pressable
            style={[
              styles.segmentButton,
              vistaActiva === '2d-sombras' && styles.segmentButtonActive,
            ]}
            onPress={() => setVistaActiva('2d-sombras')}
          >
            <Text
              style={[
                styles.segmentButtonText,
                vistaActiva === '2d-sombras' && styles.segmentButtonTextActive,
              ]}
            >
              2D con sombras
            </Text>
          </Pressable>
        </View>
      </View>

      {/*<View style={styles.form}>*/}
        {/* 
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fecha:</Text>
          <TextInput
            style={styles.input}
            value={fechaOperacion}
            onChangeText={(text) => {
              const newDate = new Date(text);
              if (!isNaN(newDate.getTime())) setDate(newDate);
            }}
            placeholder="YYYY-MM-DD"
          />
        </View> */}

        {/* <View style={styles.inputGroup}>
          <Text style={styles.label}>Hora:</Text>
          <TextInput
            style={styles.input}
            value={horaOperacion}
            onChangeText={(text) => {
              const [hours, minutes] = text.split(':');
              const newDate = new Date(time);
              newDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
              if (!isNaN(newDate.getTime())) setTime(newDate);
            }}
            placeholder="HH:MM"
          />
        </View>*/}

        {/*<View style={styles.inputGroup}>
          <Text style={styles.label}>Latitud (°):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={latitude}
            onChangeText={setLatitude}
            placeholder="40.4168"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Longitud (°):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={longitude}
            onChangeText={setLongitude}
            placeholder="-3.7038"
          />
        </View>*/}

        {/* INDICADOR DE COORDENADAS FLOTANTE EDITABLE */}
        {/*<View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>lat</Text>
          <TextInput
            style={styles.coordsInput}
            keyboardType="numeric"
            value={latitudeDisplay}
            onChangeText={(text) => {
              const regex = /^-?\d*\.?\d{0,6}$/;
              if (regex.test(text) || text === '') {
                setLatitude(text);        // Guardamos el valor completo (ya limitado a 6)
                setLatitudeDisplay(text); // Mostramos lo que escribe
              }
            }}
            placeholder="40.4168"
          />
          <Text style={styles.coordsText}>,</Text>
          <Text style={styles.coordsText}>{long</Text>
          <TextInput
            style={styles.coordsInput}
            keyboardType="numeric"
            value={longitudeDisplay}
            onChangeText={(text) => {
              const regex = /^-?\d*\.?\d{0,6}$/;
              if (regex.test(text) || text === '') {
                setLongitude(text);
                setLongitudeDisplay(text);
              }
            }}
            placeholder="-3.7038"
          />
        </View>*/}

        {/*<Button
          title={calculating ? 'Calculando...' : 'Calcular Posición Solar'}
          onPress={handleCalculate}
          disabled={calculating}
          color="#0066cc"
        />*/}
      {/*</View>*/}

      {/*{result && (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Resultados:</Text>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Altura solar:</Text>
            <Text style={styles.resultValue}>{result.elevation.toFixed(2)}°</Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Acimut solar:</Text>
            <Text style={styles.resultValue}>{result.azimuth.toFixed(2)}°</Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Posición:</Text>
            <Text style={styles.resultValue}>
              {result.elevation >= 0 ? 'Por encima del horizonte' : 'Por debajo del horizonte'}
            </Text>
          </View>

          {chunkUrl && <LocationChunkViewer key={chunkUrl} chunkUrl={chunkUrl} />}
        </View>
      )}*/}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  results: {
    marginTop: 30,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  resultLabel: {
    fontSize: 16,
    color: '#666',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  topBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    zIndex: 10,
    gap: 10,
  },
  searchBar: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchModeButtons: {
    flexDirection: 'row',
    gap: 5,
  },
  modeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  modeButtonActive: {
    backgroundColor: '#e0e0e0',
  },
  modeButtonText: {
    fontSize: 16,
  },
  datetimeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  datetimeInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  verticalDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#ccc',
  },
  coordsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
    flexDirection: 'row', // <--- Añadido para poner todo en una línea
    alignItems: 'center',
    width: 180, // Reducido de 220 a 170 (ajusta este número a tu gusto)
  },
  coordsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  coordsInput: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    padding: 0,
    margin: 0,
    marginHorizontal: 0,
    minWidth: 45,    // Ancho mínimo para números cortos
    maxWidth: 70,    // Ancho máximo para números largos (6 decimales)
    flexShrink: 0,   // Evita que el input se encoja
    textAlign: 'left',
  },
  // Contenedor para centrar el badge de coordenadas en el ancho de la pantalla del mapa
  coordsBadgeWrapper: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  // Contenedor del botón flotante para calcular en la esquina inferior izquierda
  floatingCalculateButtonContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    zIndex: 10,
  },
  // Estilo visual del botón flotante de cálculo personalizado
  floatingCalculateButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  // Texto del botón flotante de cálculo
  floatingCalculateButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Contenedor compacto de resultados flotantes sobre el mapa
  floatingResultsContainer: {
    position: 'absolute',
    bottom: 60,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 160,
  },
  // Título de los resultados flotantes
  floatingResultsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  // Fila de cada resultado flotante
  floatingResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  // Etiqueta de cada resultado flotante
  floatingResultLabel: {
    fontSize: 12,
    color: '#666',
  },
  // Valor numérico de cada resultado flotante
  floatingResultValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  // Contenedor principal del mapa y visor 3D con altura fija y ancho completo
  mapContainer: {
    height: 450,
    width: '100%',
    position: 'relative',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e5e5',
  },
  // Contenedor del control segmentado flotante ubicado en la esquina inferior derecha
  segmentedControlContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  // Botón individual de cada segmento
  segmentButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  // Estilo visual del segmento cuando está activo
  segmentButtonActive: {
    backgroundColor: '#0066cc',
  },
  // Estilo del texto normal del segmento
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  // Estilo del texto del segmento activo
  segmentButtonTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  // Divisor vertical entre cada opción del control segmentado
  segmentDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#ccc',
  },
});
