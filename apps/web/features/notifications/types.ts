export type DevicePlatform = 'ios_pwa' | 'android' | 'desktop';

export interface RegisterDeviceTokenPayload {
  token: string;
  platform: DevicePlatform;
}
