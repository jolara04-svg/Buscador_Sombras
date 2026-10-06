import { Canvas } from '@react-three/fiber/native';
import { StyleSheet, View } from 'react-native';

import { SolarSceneContent } from './solar-scene-content';
import type { SolarSceneProps } from './solar-scene.shared';

export default function SolarScene({ solarPosition, style }: SolarSceneProps) {
  return (
    <View style={[styles.container, style]}>
      <Canvas
        camera={{ fov: 42, position: [3.4, 2.6, 4.2] }}
        shadows
        style={StyleSheet.absoluteFillObject}>
        <SolarSceneContent solarPosition={solarPosition} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 320,
    overflow: 'hidden',
    width: '100%',
  },
});
