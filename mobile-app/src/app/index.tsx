import { StyleSheet, Text, View, TextInput, Button, ScrollView, Pressable, Platform } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';

import { getChunkUrl, BACKEND_URL } from '@/constants/backend';
import { LocationChunkViewer } from '@/components/location-chunk-viewer';
import { Mapa2D } from '@/components/Mapa2D';
import { ShadowMap } from "@/components/ShadowMap";

type SolarPosition = {
  elevation: number;
  azimuth: number;
};

const MADRID_LAT = 40.4168;
const MADRID_LON = -3.7038;

/**
 * Trunca un número o string numérico a un máximo de 6 decimales para la visualización en los inputs.
 * @param {string|number} valor - Valor a truncar.
 * @returns {string} Valor truncado a 6 decimales.
 */
function truncarA6Decimales(valor: string | number) {
  const str = String(valor);
  if (!str.includes('.')) return str;
  const [entero, decimales] = str.split('.');
  return `${entero}.${decimales.slice(0, 6)}`;
}

/**
 * Calcula la posición solar simplificada (elevación y acimut) para una fecha y ubicación dadas.
 * @param {Date} date - Fecha y hora del cálculo.
 * @param {number} latitude - Latitud geográfica.
 * @param {number} longitude - Longitud geográfica.
 * @returns {{elevation: number, azimuth: number}} Objeto con la elevación y acimut solar en grados.
 */
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
  
  // Estados para la barra superior y modos de búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState<'lugar' | 'ruta'>('lugar');
  
  // Estados adicionales para el buscador de rutas (Destino y Origen)
  const [busquedaDestino, setBusquedaDestino] = useState('');
  const [busquedaOrigen, setBusquedaOrigen] = useState('');
  const [tipoBusquedaRuta, setTipoBusquedaRuta] = useState<'origen' | 'destino' | null>(null);

  // Estados para el buscador de lugares y debounce
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado para la navegación con teclado en los resultados de búsqueda (versión web)
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Referencia para el ScrollView de resultados de búsqueda (permite auto-scroll al navegar con teclado)
  const searchScrollRef = useRef<ScrollView>(null);

  // Valores truncados (solo para mostrar en el input)
  const [latitudeDisplay, setLatitudeDisplay] = useState('');
  const [longitudeDisplay, setLongitudeDisplay] = useState('');
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    let cancelled = false;

    const applyLocation = (lat: number, lon: number) => {
      if (cancelled || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
      setLatitude(String(lat));
      setLongitude(String(lon));
      setLatitudeDisplay(truncarA6Decimales(lat));
      setLongitudeDisplay(truncarA6Decimales(lon));
      setLocationStatus('ready');
    };

    const applyFallback = () => {
      if (!cancelled) setLocationStatus('fallback');
    };

    const requestLocation = async () => {
      try {
        if (Platform.OS === 'web') {
          if (!navigator.geolocation) {
            applyFallback();
            return;
          }
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => applyLocation(coords.latitude, coords.longitude),
            applyFallback,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
          );
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          applyFallback();
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        applyLocation(position.coords.latitude, position.coords.longitude);
      } catch (error) {
        console.warn('No se pudo obtener la ubicación inicial:', error);
        applyFallback();
      }
    };

    requestLocation();
    return () => { cancelled = true; };
  }, []);

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

      // Normalización flexible de la hora (ej: convierte "8:30" en "08:30" añadiendo un cero inicial)
      let horaNormalizada = horaOperacion.trim();
      const horaRegex = /^(\d):(\d{2})$/;
      if (horaRegex.test(horaNormalizada)) {
        horaNormalizada = horaNormalizada.replace(horaRegex, '0$1:$2');
      }

      // Normalización flexible de la fecha admitiendo formatos con barras o guiones
      let fechaNormalizada = fechaOperacion.trim();
      const currentYear = new Date().getFullYear();

      // Caso 1: Formato con año (ej: 20/10/2026 o 20-10-2026) -> convierte a AAAA-MM-DD
      const fechaConAnioRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
      if (fechaConAnioRegex.test(fechaNormalizada)) {
        fechaNormalizada = fechaNormalizada.replace(fechaConAnioRegex, (_, d, m, y) => {
          const dia = d.padStart(2, '0');
          const mes = m.padStart(2, '0');
          return `${y}-${mes}-${dia}`;
        });
      } else {
        // Caso 2: Formato sin año (ej: 20/10 o 20-10) -> asume el año actual
        const fechaSinAnioRegex = /^(\d{1,2})[\/\-](\d{1,2})$/;
        if (fechaSinAnioRegex.test(fechaNormalizada)) {
          fechaNormalizada = fechaNormalizada.replace(fechaSinAnioRegex, (_, d, m) => {
            const dia = d.padStart(2, '0');
            const mes = m.padStart(2, '0');
            return `${currentYear}-${mes}-${dia}`;
          });
        }
      }

      // Combinar fecha y hora normalizadas en formato ISO para el objeto Date
      const fechaHoraString = `${fechaNormalizada}T${horaNormalizada}:00`;
      const combinedDate = new Date(fechaHoraString);

      // Validamos que la fecha resultante no sea inválida tras la normalización
      if (isNaN(combinedDate.getTime())) {
        alert('Formato de fecha u hora no reconocido. Usa AAAA-MM-DD y HH:MM');
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

  // Función para realizar la petición de búsqueda al backend
  const handleSearch = async (text: string) => {
    if (!text || text.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(text.trim())}`);
      if (!response.ok) {
        throw new Error('Error en la búsqueda');
      }
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error buscando lugares:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Manejador de cambio de texto en el buscador con debounce de 300ms
  const handleTextChange = (text: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(text);
    }, 300);
  };

  // Función auxiliar para manejar la selección de un resultado de búsqueda (clic o Enter)
  const handleSelectResult = (item: any) => {
    // Actualizar coordenadas principales para la calculadora solar y vista
    setLatitude(String(item.lat));
    setLongitude(String(item.lon));
    setLatitudeDisplay(truncarA6Decimales(item.lat));
    setLongitudeDisplay(truncarA6Decimales(item.lon));

    if (modoBusqueda === 'lugar') {
      setBusqueda(item.nombre);
    } else if (modoBusqueda === 'ruta') {
      if (tipoBusquedaRuta === 'destino') {
        setDestino({ lat: item.lat, lon: item.lon });
        setBusquedaDestino(item.nombre);
        // Al fijar destino, pasamos a buscar origen automáticamente
        setTipoBusquedaRuta('origen');
      } else if (tipoBusquedaRuta === 'origen') {
        setOrigen({ lat: item.lat, lon: item.lon });
        setBusquedaOrigen(item.nombre);
      }
    }
    // Limpiar resultados y reiniciar índice seleccionado para cerrar el panel inmediatamente
    setSearchResults([]);
    setSelectedIndex(-1);
  };

  // Manejador de eventos de teclado (Flechas Arriba/Abajo y Enter) para la lista de resultados
  const handleKeyPress = (e: any) => {
    const key = e.nativeEvent.key;
    if (key === 'ArrowDown') {
      setSelectedIndex((prev) => {
        // Incrementar índice seleccionado sin exceder la cantidad de resultados
        const newIndex = prev < searchResults.length - 1 ? prev + 1 : prev;
        // Desplazar automáticamente el contenedor de resultados de búsqueda tras el renderizado
        setTimeout(() => {
          const itemHeight = 60; // Altura estimada de cada elemento de resultado en píxeles
          if (newIndex >= 0) {
            searchScrollRef.current?.scrollTo({ y: newIndex * itemHeight, animated: true });
          }
        }, 50);
        return newIndex;
      });
    } else if (key === 'ArrowUp') {
      setSelectedIndex((prev) => {
        // Decrementar índice seleccionado sin bajar de -1
        const newIndex = prev > -1 ? prev - 1 : -1;
        // Desplazar automáticamente el contenedor de resultados (vuelve al inicio si es -1)
        setTimeout(() => {
          const itemHeight = 60;
          if (newIndex >= 0) {
            searchScrollRef.current?.scrollTo({ y: newIndex * itemHeight, animated: true });
          } else {
            searchScrollRef.current?.scrollTo({ y: 0, animated: true });
          }
        }, 50);
        return newIndex;
      });
    } else if (key === 'Enter' && selectedIndex >= 0 && selectedIndex < searchResults.length) {
      e.preventDefault?.();
      handleSelectResult(searchResults[selectedIndex]);
    }
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
        {locationStatus === 'loading' && <Text style={styles.locationStatus}>Obteniendo ubicación...</Text>}
        {locationStatus === 'fallback' && <Text style={styles.locationStatus}>No se pudo obtener tu ubicación. Se muestra Madrid.</Text>}
      </View>

                {/* BARRA SUPERIOR TIPO GOOGLE MAPS */}
                    <View style={styles.topBarContainer}>
                      
                      {/* 1. Buscador o Inputs de Ruta con botones integrados */}
                      <View style={styles.searchBar}>
                        {modoBusqueda === 'lugar' ? (
                          <View style={styles.searchLugarRow}>
                            <TextInput
                              style={styles.searchInput}
                              placeholder="Buscar lugar..."
                              value={busqueda}
                              onChangeText={(text) => {
                                setBusqueda(text);
                                setSelectedIndex(-1); // Reiniciar selección al teclear
                                handleTextChange(text);
                              }}
                              onKeyPress={handleKeyPress}
                            />
                            {/* Botón para limpiar la búsqueda de lugar (visible solo si hay texto escrito) */}
                            {busqueda.length > 0 && (
                              <Pressable
                                style={styles.clearLugarButton}
                                onPress={() => {
                                  // Limpiar el estado de búsqueda
                                  setBusqueda('');
                                  // Limpiar los resultados de búsqueda para cerrar el desplegable
                                  setSearchResults([]);
                                }}
                              >
                                <Text style={styles.clearLugarButtonText}>✕</Text>
                              </Pressable>
                            )}
                          </View>
                        ) : (
                          <View style={styles.routeSearchWrapper}>
                            {/* Input de Destino (siempre visible en modo ruta) y botón de limpiar ruta */}
                            <View style={styles.routeDestinationRow}>
                              <TextInput
                                style={styles.searchInput}
                                placeholder="¿A dónde quieres ir?"
                                value={busquedaDestino}
                                onChangeText={(text) => {
                                  setBusquedaDestino(text);
                                  setTipoBusquedaRuta('destino');
                                  setSelectedIndex(-1); // Reiniciar selección al teclear
                                  handleTextChange(text);
                                }}
                                onKeyPress={handleKeyPress}
                              />
                              {/* Botón para limpiar la ruta (visible exclusivamente en modo ruta, al lado del destino) */}
                              <Pressable
                                style={styles.clearRouteButton}
                                onPress={() => {
                                  // Limpiar estados de origen y destino a null
                                  setOrigen(null);
                                  setDestino(null);
                                  // Limpiar textos de búsqueda de origen y destino
                                  setBusquedaDestino('');
                                  setBusquedaOrigen('');
                                  // Volver a poner el modo de selección en 'origen'
                                  setModoSeleccion('origen');
                                  // Cerrar el desplegable de resultados de búsqueda
                                  setSearchResults([]);
                                }}
                              >
                                <Text style={styles.clearRouteButtonText}>✕</Text>
                              </Pressable>
                            </View>
                            {/* Input de Origen (solo se muestra si ya se ha seleccionado un destino) */}
                            {destino !== null && (
                              <View style={styles.originInputRow}>
                                <TextInput
                                  style={styles.searchInput}
                                  placeholder="¿Desde dónde sales?"
                                  value={busquedaOrigen}
                                  onChangeText={(text) => {
                                    setBusquedaOrigen(text);
                                    setTipoBusquedaRuta('origen');
                                    setSelectedIndex(-1); // Reiniciar selección al teclear
                                    handleTextChange(text);
                                  }}
                                  onKeyPress={handleKeyPress}
                                />
                                <Pressable
                                  style={styles.myLocationButton}
                                  onPress={() => console.log('Usar mi ubicación')}
                                >
                                  <Text style={styles.myLocationButtonText}>📍 Mi ubicación</Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        )}
                        
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
                              setModoSeleccion('destino'); // Por defecto comenzamos buscando el destino
                              setTipoBusquedaRuta('destino');
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

      {/* Panel desplegable con resultados de búsqueda clicables (solo se muestra si hay búsqueda activa y resultados/carga) */}
      {(((modoBusqueda === 'lugar' && busqueda.trim().length >= 2) || (modoBusqueda === 'ruta' && ((tipoBusquedaRuta === 'destino' && busquedaDestino.trim().length >= 2) || (tipoBusquedaRuta === 'origen' && busquedaOrigen.trim().length >= 2)))) && (isSearching || searchResults.length > 0)) && (
        <View style={styles.searchResultsContainer}>
          <ScrollView ref={searchScrollRef} style={styles.searchResultsScroll} nestedScrollEnabled>
            {isSearching ? (
              <Text style={styles.searchStatusText}>Buscando...</Text>
            ) : (
              searchResults.map((item, index) => (
                <Pressable
                  key={item.id || index}
                  style={[
                    styles.searchResultItem,
                    index === selectedIndex && { backgroundColor: '#e0e0e0' } // Resaltar opción seleccionada con teclado
                  ]}
                  onPress={() => handleSelectResult(item)}
                >
                  <Text style={styles.searchResultName}>{item.nombre}</Text>
                  <Text style={styles.searchResultType}>{item.tipo}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* CONTENEDOR PRINCIPAL DEL VISOR DE MAPA (Altura fija y ancho completo) */}
      <View style={styles.mapContainer}>
        {/* Renderizado condicional: Vista 2D y 2D con sombras */}
        {(vistaActiva === '2d' /*|| vistaActiva === '2d-sombras'*/) && (
          <Mapa2D
            initialLat={parseFloat(latitude) || MADRID_LAT}
            initialLon={parseFloat(longitude) || MADRID_LON}
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
        {/* Renderizado condicional: Vista 2D con sombras provisional */}
          {vistaActiva==="2d-sombras" && (
            <ShadowMap
              //Foreground shadow overlay properties
              chunkURL={getChunkUrl(
                isNaN(parseFloat(latitude)) ? 40.4168 : parseFloat(latitude),
                isNaN(parseFloat(longitude)) ? -3.7038 : parseFloat(longitude)
              )}
              azimuth={result?result.azimuth:0}
              elevation={result?result.elevation:90}

              //Background map properties. Copied them.
              initialLat={parseFloat(latitude) || MADRID_LAT}
              initialLon={parseFloat(longitude) || MADRID_LON}
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
  locationStatus: {
    fontSize: 12,
    color: '#777',
    marginTop: 6,
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
    paddingVertical: 8,
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    height: 38,
  },
  routeSearchWrapper: {
    flex: 1,
    gap: 8,
  },
  /* Estilos para la fila del buscador de lugar y su botón de borrado */
  searchLugarRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearLugarButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  clearLugarButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  /* Estilos para la fila del input de destino y el botón de limpiar ruta */
  routeDestinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearRouteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ffeeee',
  },
  clearRouteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#cc0000',
  },
  originInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 6,
    gap: 8,
  },
  myLocationButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  myLocationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066cc',
  },
  searchModeButtons: {
    flexDirection: 'row',
    gap: 5,
    marginLeft: 5,
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
  // Estilos para el contenedor desplegable de resultados de búsqueda
  searchResultsContainer: {
    marginHorizontal: 15,
    marginTop: -5,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  searchResultsScroll: {
    padding: 10,
  },
  searchStatusText: {
    padding: 10,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  searchResultItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  searchResultType: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    width: 180,
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
    minWidth: 45,
    maxWidth: 70,
    flexShrink: 0,
    textAlign: 'left',
  },
  coordsBadgeWrapper: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  floatingCalculateButtonContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    zIndex: 10,
  },
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
  floatingCalculateButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
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
  floatingResultsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  floatingResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  floatingResultLabel: {
    fontSize: 12,
    color: '#666',
  },
  floatingResultValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  mapContainer: {
    height: 450,
    width: '100%',
    position: 'relative',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e5e5',
  },
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
  segmentButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  segmentButtonActive: {
    backgroundColor: '#0066cc',
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  segmentButtonTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  segmentDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#ccc',
  },
});
