import { Button, StyleSheet, View } from 'react-native';

import { useMapaEstado } from '@/hooks/useMapaEstado';
import { ThemedView } from '@/components/themed-view';
import { Mapa2D } from '@/components/Mapa2D';
import { getChunkUrl } from '@/constants/backend';
import { LocationChunkViewer } from '@/components/location-chunk-viewer';

export function MapaContenedor() {
  const {
    coordenada,
    seleccionarCoordenada,
    setVistaActiva,
    vistaActiva,
  } = useMapaEstado();

  const alternarVista = () => {
    setVistaActiva((vistaActual) => (vistaActual === '2d' ? '3d' : '2d'));
  };

  return (
    <View style={styles.containerVista}>
      {vistaActiva === '2d' ? (
        <Mapa2D
          onSeleccionarCoordenada={seleccionarCoordenada}
          initialLat={coordenada.lat}
          initialLon={coordenada.lon}
        />
      ) : (
        <ThemedView style={styles.container3D}>
          <LocationChunkViewer key={`${coordenada.lat}-${coordenada.lon}`} chunkUrl={getChunkUrl(coordenada.lat, coordenada.lon)} />
        </ThemedView>
      )}

      <View style={styles.floatingControls}>
        <Button
          title={`Cambiar a vista ${vistaActiva === '2d' ? '3D' : '2D'}`}
          onPress={alternarVista}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  containerVista: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  container3D: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent', // Por si el fondo blanco/negro tapa algo
  },
  floatingControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
