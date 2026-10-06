import { useState } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SolarScene from '@/components/solar-scene';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { calculateSunPosition, type SolarPosition } from '@/utils/solar-position';

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(dateText: string, timeText: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) {
    return null;
  }

  return parsed;
}

function getSceneMessage(result: SolarPosition | null) {
  if (!result) return 'Calcula una posición para proyectar la sombra.';
  if (!result.isAboveHorizon) return 'El sol está bajo el horizonte; no hay sombra solar.';
  if (result.nearHorizon) return 'Sombra muy larga: se limita a la superficie visible.';
  return 'Sombra proyectada según la posición solar calculada.';
}

export default function SolarCalculatorScreen() {
  const now = new Date();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const theme = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [dateText, setDateText] = useState(formatDate(now));
  const [timeText, setTimeText] = useState(formatTime(now));
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [result, setResult] = useState<SolarPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = () => {
    setError(null);

    const date = parseLocalDateTime(dateText, timeText);
    if (!date) {
      setError('Usa una fecha válida con formato AAAA-MM-DD y una hora HH:MM.');
      return;
    }

    const latitudeValue = Number(latitude.trim().replace(',', '.'));
    const longitudeValue = Number(longitude.trim().replace(',', '.'));
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
      setError('Ingresa coordenadas numéricas válidas.');
      return;
    }
    if (latitudeValue < -90 || latitudeValue > 90) {
      setError('La latitud debe estar entre -90 y 90 grados.');
      return;
    }
    if (longitudeValue < -180 || longitudeValue > 180) {
      setError('La longitud debe estar entre -180 y 180 grados.');
      return;
    }

    setCalculating(true);
    try {
      setResult(calculateSunPosition(date, latitudeValue, longitudeValue));
    } catch (calculationError) {
      setError(
        calculationError instanceof Error
          ? calculationError.message
          : 'No se pudo calcular la posición solar.',
      );
    } finally {
      setCalculating(false);
    }
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          paddingTop: Math.max(insets.top, Spacing.three),
        },
      ]}
      keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Posición solar
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Observa cómo cambia la sombra sobre un cubo 3D.
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.sceneCard}>
          <SolarScene solarPosition={result} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.sceneMessage}>
            {getSceneMessage(result)}
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.form}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Parámetros
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Fecha
            </ThemedText>
            <TextInput
              accessibilityLabel="Fecha"
              autoCorrect={false}
              onChangeText={setDateText}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
              value={dateText}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Hora local
            </ThemedText>
            <TextInput
              accessibilityLabel="Hora local"
              autoCorrect={false}
              onChangeText={setTimeText}
              placeholder="HH:MM"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
              value={timeText}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Latitud (°)
            </ThemedText>
            <TextInput
              accessibilityLabel="Latitud"
              keyboardType="numbers-and-punctuation"
              onChangeText={setLatitude}
              placeholder="-90 a 90"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
              value={latitude}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Longitud (°)
            </ThemedText>
            <TextInput
              accessibilityLabel="Longitud"
              keyboardType="numbers-and-punctuation"
              onChangeText={setLongitude}
              placeholder="-180 a 180"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
              value={longitude}
            />
          </View>

          {error && (
            <ThemedText themeColor="textSecondary" style={styles.error}>
              {error}
            </ThemedText>
          )}

          <Button
            color="#3c87f7"
            disabled={calculating}
            onPress={handleCalculate}
            title={calculating ? 'Calculando...' : 'Calcular posición solar'}
          />
        </ThemedView>

        {result && (
          <ThemedView type="backgroundElement" style={styles.results}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Resultado
            </ThemedText>
            <View style={styles.resultItem}>
              <ThemedText themeColor="textSecondary">Altura solar</ThemedText>
              <ThemedText type="smallBold">{result.elevation.toFixed(2)}°</ThemedText>
            </View>
            <View style={styles.resultItem}>
              <ThemedText themeColor="textSecondary">Acimut solar</ThemedText>
              <ThemedText type="smallBold">{result.azimuth.toFixed(2)}°</ThemedText>
            </View>
            <View style={styles.resultItem}>
              <ThemedText themeColor="textSecondary">Estado</ThemedText>
              <ThemedText type="smallBold">
                {result.isAboveHorizon ? 'Sobre el horizonte' : 'Bajo el horizonte'}
              </ThemedText>
            </View>
          </ThemedView>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  sceneCard: {
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
    overflow: 'hidden',
  },
  sceneMessage: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    textAlign: 'center',
  },
  form: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: Spacing.three,
  },
  inputGroup: {
    marginBottom: Spacing.three,
  },
  label: {
    marginBottom: Spacing.one,
  },
  input: {
    borderRadius: Spacing.one,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: Spacing.two,
  },
  error: {
    marginBottom: Spacing.three,
  },
  results: {
    borderRadius: Spacing.three,
    marginTop: Spacing.four,
    padding: Spacing.three,
  },
  resultItem: {
    alignItems: 'center',
    borderBottomColor: '#77777733',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
});
