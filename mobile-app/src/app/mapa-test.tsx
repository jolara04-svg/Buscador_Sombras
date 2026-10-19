import { StyleSheet, Text, View } from 'react-native';

import { MapaContenedor } from '@/components/MapaContenedor';

export default function MapaTestScreen() {
  return (
    <View style={styles.container}>
      <MapaContenedor />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
  },
  notice: {
    fontSize: 12,
    paddingHorizontal: 20,
  },
});
