import { Button, StyleSheet, View } from 'react-native';

import { useMapaEstado } from '@/hooks/useMapaEstado';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function MapaContenedor() {
  const {
    chunkUrl,
    coordenada,
    resultadoSolar,
    seleccionarCoordenada,
    setVistaActiva,
    vistaActiva,
  } = useMapaEstado();

  const alternarVista = () => {
    setVistaActiva((vistaActual) => (vistaActual === '2d' ? '3d' : '2d'));
  };

  const usarCoordenadaPrueba = () => {
    seleccionarCoordenada(40.42, -3.71);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Estado compartido del mapa</ThemedText>
      <ThemedText>Latitud: {coordenada.lat.toFixed(4)}</ThemedText>
      <ThemedText>Longitud: {coordenada.lon.toFixed(4)}</ThemedText>
      <ThemedText>Vista activa: {vistaActiva}</ThemedText>
      <ThemedText>Chunk URL: {chunkUrl ?? 'sin valor'}</ThemedText>
      <ThemedText>
        Resultado solar:{' '}
        {resultadoSolar
          ? `elevación ${resultadoSolar.elevation.toFixed(2)}°, acimut ${resultadoSolar.azimuth.toFixed(2)}°`
          : 'sin valor'}
      </ThemedText>

      <View style={styles.actions}>
        <Button
          title={`Cambiar a vista ${vistaActiva === '2d' ? '3D' : '2D'}`}
          onPress={alternarVista}
        />
        <Button title="Usar coordenada de prueba" onPress={usarCoordenadaPrueba} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
});
