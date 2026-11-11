import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearAllPrototypeStorage, keyboxStorage, STORAGE_KEYS } from '@/store/storage';

describe('keyboxStorage', () => {
  beforeEach(() => AsyncStorage.clear());

  it('moves a value saved under the old dramarush/ key on first read', async () => {
    await AsyncStorage.setItem('dramarush/settings', '{"state":{"x":1}}');
    expect(await keyboxStorage.getItem(STORAGE_KEYS.settings)).toBe('{"state":{"x":1}}');
    expect(await AsyncStorage.getItem('keybox/settings')).toBe('{"state":{"x":1}}');
    expect(await AsyncStorage.getItem('dramarush/settings')).toBeNull();
  });

  it('prefers the new key and leaves an unknown key empty', async () => {
    await AsyncStorage.setItem('keybox/user', 'new');
    await AsyncStorage.setItem('dramarush/user', 'old');
    expect(await keyboxStorage.getItem(STORAGE_KEYS.user)).toBe('new');
    expect(await keyboxStorage.getItem(STORAGE_KEYS.oauthLink)).toBeNull();
  });

  it('reset clears both old and new keys', async () => {
    await AsyncStorage.setItem('keybox/user', 'new');
    await AsyncStorage.setItem('dramarush/settings', 'old');
    await clearAllPrototypeStorage();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
