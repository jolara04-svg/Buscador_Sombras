import { Platform } from 'react-native';

const configuredBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

// Android emulators use 10.0.2.2 to reach the host machine. Physical devices
// should set EXPO_PUBLIC_BACKEND_URL to the computer's LAN address.
export const BACKEND_URL = (
  configuredBackendUrl ||
  (Platform.OS === 'android' ? 'http://10.93.60.58:3000' : 'http://localhost:3000')
).replace(/\/$/, '');

export function getChunkUrl(latitude: number, longitude: number) {
  const lat = encodeURIComponent(String(latitude));
  const lon = encodeURIComponent(String(longitude));

  return `${BACKEND_URL}/chunk?lat=${lat}&lon=${lon}`;
}
