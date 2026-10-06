import type { StyleProp, ViewStyle } from 'react-native';

import type { SolarPosition } from '@/utils/solar-position';

export type SolarSceneProps = {
  solarPosition: SolarPosition | null;
  style?: StyleProp<ViewStyle>;
};
