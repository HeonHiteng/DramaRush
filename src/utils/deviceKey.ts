import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

/** Web: localStorage key for the generated id (clearing site data = a new guest, which is fine). */
export const WEB_DEVICE_KEY_STORAGE = 'keybox/device-key';
/** iOS: the same id in the Keychain, which survives a reinstall. SecureStore
 * keys may only use letters, digits, ".", "-" and "_" — no "/". */
export const SECURE_DEVICE_KEY_STORAGE = 'keybox.device-key';

const DEVICE_KEY = /^[A-Za-z0-9._-]{8,128}$/;

/** Strips anything the guest-session function wouldn't accept; null when too little is left. */
export function normalizeDeviceKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, 128);
  return DEVICE_KEY.test(cleaned) ? cleaned : null;
}

/** A v4 UUID. Hermes has no crypto.randomUUID (and may lack getRandomValues),
 * so this falls back to Math.random — the key only picks which 0-coin guest
 * account the device gets, it guards nothing of value. */
export function randomId(): string {
  const cryptoApi = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A random id kept in the Keychain / Keystore; null when SecureStore can't hold it. */
async function storedKey(prefix: string): Promise<string | null> {
  const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
  const existing = normalizeDeviceKey(await SecureStore.getItemAsync(SECURE_DEVICE_KEY_STORAGE, options));
  if (existing) return normalizeDeviceKey(prefix + existing);
  const fresh = randomId();
  await SecureStore.setItemAsync(SECURE_DEVICE_KEY_STORAGE, fresh, options);
  return normalizeDeviceKey(prefix + fresh);
}

async function androidKey(): Promise<string | null> {
  // ANDROID_ID survives a reinstall (it only changes on a factory reset or
  // a new signing key), which is the point: same phone, same guest.
  try {
    const id = normalizeDeviceKey(Application.getAndroidId());
    if (id) return normalizeDeviceKey(`a-${id}`);
  } catch (error) {
    console.warn('getAndroidId failed', error);
  }
  return storedKey('s-');
}

async function iosKey(): Promise<string | null> {
  try {
    return await storedKey('i-');
  } catch (error) {
    // Keychain unavailable (e.g. before first unlock): identifierForVendor
    // also outlives a reinstall as long as another app of ours stays.
    console.warn('device key: SecureStore failed', error);
    const idfv = normalizeDeviceKey(await Application.getIosIdForVendorAsync());
    return idfv ? normalizeDeviceKey(`v-${idfv}`) : null;
  }
}

function webKey(): string | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage) return null;
    const existing = normalizeDeviceKey(storage.getItem(WEB_DEVICE_KEY_STORAGE));
    if (existing) return normalizeDeviceKey(`w-${existing}`);
    const fresh = randomId();
    storage.setItem(WEB_DEVICE_KEY_STORAGE, fresh);
    // A key that didn't stick (storage full / blocked) would mean a new guest
    // on every launch — no better than the anonymous fallback.
    return storage.getItem(WEB_DEVICE_KEY_STORAGE) === fresh ? normalizeDeviceKey(`w-${fresh}`) : null;
  } catch {
    return null;
  }
}

/**
 * Identifies this device to the guest-session Edge Function, which turns it
 * into the same guest account every time — so a reinstall (or a sign-out)
 * comes back to the guest's favourites and history instead of a new empty
 * guest. Null when nothing usable is available; the caller then falls back to
 * an anonymous guest.
 */
export async function getDeviceKey(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') return await androidKey();
    if (Platform.OS === 'ios') return await iosKey();
    if (Platform.OS === 'web') return webKey();
  } catch (error) {
    console.warn('getDeviceKey failed', error);
  }
  return null;
}
