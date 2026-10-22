jest.mock('expo-application', () => ({ getAndroidId: jest.fn(), getIosIdForVendorAsync: jest.fn() }));
jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 0,
    __items: items,
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
  };
});

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import {
  getDeviceKey,
  normalizeDeviceKey,
  randomId,
  SECURE_DEVICE_KEY_STORAGE,
  WEB_DEVICE_KEY_STORAGE,
} from '@/utils/deviceKey';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const secureItems = (SecureStore as unknown as { __items: Map<string, string> }).__items;

const realOS = Platform.OS;

function setPlatform(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
}

/** A Storage-like stand-in for window.localStorage. */
function fakeLocalStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    items,
  };
}

const globals = globalThis as { localStorage?: unknown; crypto?: unknown };

describe('normalizeDeviceKey', () => {
  it('keeps letters, digits, ".", "-" and "_" and needs 8 to 128 of them', () => {
    expect(normalizeDeviceKey('a-0123456789abcdef')).toBe('a-0123456789abcdef');
    expect(normalizeDeviceKey('  a:01 23/45#67 ')).toBe('a01234567');
    expect(normalizeDeviceKey('x'.repeat(200))).toBe('x'.repeat(128));
    expect(normalizeDeviceKey('short')).toBeNull();
    expect(normalizeDeviceKey('')).toBeNull();
    expect(normalizeDeviceKey(null)).toBeNull();
    expect(normalizeDeviceKey(42)).toBeNull();
  });
});

describe('randomId', () => {
  const realCrypto = globals.crypto;
  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true, writable: true });
  });

  it('is a v4 UUID, with or without crypto.randomUUID', () => {
    expect(randomId()).toMatch(UUID_V4);
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    const a = randomId();
    expect(a).toMatch(UUID_V4);
    expect(randomId()).not.toBe(a);
  });
});

describe('getDeviceKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureItems.clear();
    delete globals.localStorage;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => setPlatform(realOS));

  describe('android', () => {
    beforeEach(() => setPlatform('android'));

    it('uses ANDROID_ID, which survives a reinstall', async () => {
      (Application.getAndroidId as jest.Mock).mockReturnValue('0123456789abcdef');
      expect(await getDeviceKey()).toBe('a-0123456789abcdef');
      expect(await getDeviceKey()).toBe('a-0123456789abcdef');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('falls back to a stored random id when ANDROID_ID is unavailable', async () => {
      (Application.getAndroidId as jest.Mock).mockImplementation(() => {
        throw new Error('unavailable');
      });
      const key = await getDeviceKey();
      expect(key).toMatch(/^s-/);
      expect(await getDeviceKey()).toBe(key);
    });
  });

  describe('ios', () => {
    beforeEach(() => setPlatform('ios'));

    it('generates a UUID once and keeps it in the Keychain', async () => {
      const key = await getDeviceKey();
      expect(key).toMatch(/^i-/);
      expect(key!.slice(2)).toMatch(UUID_V4);
      expect(secureItems.get(SECURE_DEVICE_KEY_STORAGE)).toBe(key!.slice(2));
      // The next launch (or a reinstall: the Keychain outlives the app) reads it back.
      expect(await getDeviceKey()).toBe(key);
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('uses identifierForVendor when the Keychain is unavailable', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
      (Application.getIosIdForVendorAsync as jest.Mock).mockResolvedValue('68753A44-4D6F-1226-9C60-0050E4C00067');
      expect(await getDeviceKey()).toBe('v-68753A44-4D6F-1226-9C60-0050E4C00067');
    });

    it('gives up when neither is available', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
      (Application.getIosIdForVendorAsync as jest.Mock).mockResolvedValue(null);
      expect(await getDeviceKey()).toBeNull();
    });
  });

  describe('web', () => {
    beforeEach(() => setPlatform('web'));

    it('keeps a generated UUID in localStorage', async () => {
      const storage = fakeLocalStorage();
      globals.localStorage = storage;
      const key = await getDeviceKey();
      expect(key).toMatch(/^w-/);
      expect(storage.items.get(WEB_DEVICE_KEY_STORAGE)).toBe(key!.slice(2));
      expect(await getDeviceKey()).toBe(key);
    });

    it('is null without usable storage', async () => {
      expect(await getDeviceKey()).toBeNull();

      globals.localStorage = {
        getItem: () => {
          throw new Error('SecurityError');
        },
      };
      expect(await getDeviceKey()).toBeNull();

      // Writes silently dropped (e.g. a full or blocked store).
      globals.localStorage = { getItem: () => null, setItem: () => {} };
      expect(await getDeviceKey()).toBeNull();
    });
  });

  it('is null on any other platform', async () => {
    setPlatform('windows');
    expect(await getDeviceKey()).toBeNull();
  });
});
