import { Button, StyleSheet, Text, View } from 'react-native';

import { useMapaEstado } from '@/hooks/useMapaEstado';

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
    <View style={styles.container}>
      <Text style={styles.title}>Estado compartido del mapa</Text>
      <Text>Latitud: {coordenada.lat.toFixed(4)}</Text>
      <Text>Longitud: {coordenada.lon.toFixed(4)}</Text>
      <Text>Vista activa: {vistaActiva}</Text>
      <Text>Chunk URL: {chunkUrl ?? 'sin valor'}</Text>
      <Text>
        Resultado solar:{' '}
        {resultadoSolar
          ? `elevación ${resultadoSolar.elevation.toFixed(2)}°, acimut ${resultadoSolar.azimuth.toFixed(2)}°`
          : 'sin valor'}
      </Text>

      <View style={styles.actions}>
        <Button
          title={`Cambiar a vista ${vistaActiva === '2d' ? '3D' : '2D'}`}
          onPress={alternarVista}
        />
        <Button title="Usar coordenada de prueba" onPress={usarCoordenadaPrueba} />
      </View>
    </View>
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
