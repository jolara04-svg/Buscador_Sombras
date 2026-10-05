import { StyleSheet, Text, View, TextInput, Button, Switch } from 'react-native';
import { useState } from 'react';

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
  const alpha = Math.atan2(Math.cos(toRad(epsilon)) * Math.sin(toRad(lambda)), Math.cos(toRad(lambda)));
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
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

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
      const combinedDate = new Date(date);
      combinedDate.setHours(time.getHours(), time.getMinutes(), 0, 0);

      setCalculating(true);
      const position = calculateSunPosition(combinedDate, lat, lon);
      setResult(position);
      setCalculating(false);
    } catch (error) {
      alert('Error en el cálculo: ' + error.message);
      setCalculating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calculadora de Posición Solar</Text>
        <Text style={styles.subtitle}>Ingrese fecha, hora y ubicación</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fecha:</Text>
          <TextInput
            style={styles.input}
            value={date.toISOString().split('T')[0]}
            onChangeText={(text) => {
              const newDate = new Date(text);
              if (!isNaN(newDate.getTime())) setDate(newDate);
            }}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hora:</Text>
          <TextInput
            style={styles.input}
            value={time.toTimeString().slice(0, 5)}
            onChangeText={(text) => {
              const [hours, minutes] = text.split(':');
              const newDate = new Date(time);
              newDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
              if (!isNaN(newDate.getTime())) setTime(newDate);
            }}
            placeholder="HH:MM"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Latitud (°):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={latitude}
            onChangeText={setLatitude}
            placeholder="-90 a 90"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Longitud (°):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={longitude}
            onChangeText={setLongitude}
            placeholder="-180 a 180"
          />
        </View>

        <Button
          title={calculating ? 'Calculando...' : 'Calcular Posición Solar'}
          onPress={handleCalculate}
          disabled={calculating}
          color="#0066cc"
        />
      </View>

      {result && (
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
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
});