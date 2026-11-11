jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));
jest.mock('@/utils/deviceKey', () => ({ getDeviceKey: jest.fn(async () => null) }));

import {
  __deviceGuests,
  __getTable,
  __reset,
  __setGuestSessionLimit,
  __setInvokeHandler,
  __setSignOutError,
  supabase,
} from '../testUtils/supabaseMock';
import { getDeviceKey } from '@/utils/deviceKey';
import { authErrorKey, redirectError, useUserStore } from '@/store/userStore';

const member = { id: 'test-user-1', displayName: 'Ann', provider: 'google' as const, avatarSeed: 'Ann', createdAt: '', isAdmin: false };
const DEVICE_KEY = 'a-0123456789abcdef';

async function signedInUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

describe('userStore', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    __reset();
    jest.restoreAllMocks();
    (getDeviceKey as jest.Mock).mockResolvedValue(null);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    useUserStore.setState({ user: member, signOutRequested: false, authError: null, isAuthenticating: false });
  });

  describe('signInAsGuest', () => {
    it("signs in as the device's own guest when there is a device key", async () => {
      (getDeviceKey as jest.Mock).mockResolvedValue(DEVICE_KEY);
      const invoke = jest.spyOn(supabase.functions, 'invoke');
      const setSession = jest.spyOn(supabase.auth, 'setSession');
      const anonymous = jest.spyOn(supabase.auth, 'signInAnonymously');

      expect(await useUserStore.getState().signInAsGuest()).toBe(true);

      expect(invoke).toHaveBeenCalledWith('guest-session', expect.objectContaining({ body: { device_key: DEVICE_KEY } }));
      expect(setSession).toHaveBeenCalledWith({ access_token: 'token-device-guest-1', refresh_token: expect.any(String) });
      expect(anonymous).not.toHaveBeenCalled();
      expect(await signedInUserId()).toBe('device-guest-1');
      expect(useUserStore.getState()).toMatchObject({ isAuthenticating: false, authError: null });
      // A new guest starts with 0 coins, like every account.
      expect(__getTable('wallets').find((w) => w.user_id === 'device-guest-1')?.balance).toBe(0);
    });

    it('gets the same guest account back for the same device key', async () => {
      (getDeviceKey as jest.Mock).mockResolvedValue(DEVICE_KEY);
      await useUserStore.getState().signInAsGuest();
      await supabase.auth.signOut();
      await useUserStore.getState().signInAsGuest();
      expect(await signedInUserId()).toBe('device-guest-1');
      expect(__deviceGuests().size).toBe(1);

      (getDeviceKey as jest.Mock).mockResolvedValue('i-another-device-key');
      await useUserStore.getState().signInAsGuest();
      expect(await signedInUserId()).toBe('device-guest-2');
    });

    it('falls back to an anonymous guest without a device key', async () => {
      const invoke = jest.spyOn(supabase.functions, 'invoke');
      const anonymous = jest.spyOn(supabase.auth, 'signInAnonymously');

      expect(await useUserStore.getState().signInAsGuest()).toBe(true);

      expect(invoke).not.toHaveBeenCalled();
      expect(anonymous).toHaveBeenCalledWith({ options: { data: { provider: 'guest', display_name: 'Guest Viewer' } } });
      expect(await signedInUserId()).toBe('guest-1');
    });

    it('falls back to an anonymous guest when the new-guest limit is reached', async () => {
      (getDeviceKey as jest.Mock).mockResolvedValue(DEVICE_KEY);
      __setGuestSessionLimit(0);

      expect(await useUserStore.getState().signInAsGuest()).toBe(true);

      expect(await signedInUserId()).toBe('guest-1');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('limit'));
      expect(useUserStore.getState().authError).toBeNull();
    });

    it.each([
      ['the function is unreachable', async () => ({ data: null, error: new Error('Failed to fetch') })],
      ['the function throws', async () => Promise.reject(new Error('boom'))],
      ['the function returns no session', async () => ({ data: {}, error: null })],
      ['the session is refused', async () => ({ data: { access_token: 'x', refresh_token: 'not-issued' }, error: null })],
    ])('falls back to an anonymous guest when %s', async (_label, handler) => {
      (getDeviceKey as jest.Mock).mockResolvedValue(DEVICE_KEY);
      __setInvokeHandler(handler);

      expect(await useUserStore.getState().signInAsGuest()).toBe(true);

      expect(await signedInUserId()).toBe('guest-1');
      expect(useUserStore.getState()).toMatchObject({ isAuthenticating: false, authError: null });
    });

    it('reports an error only when the anonymous fallback fails too', async () => {
      jest
        .spyOn(supabase.auth, 'signInAnonymously')
        .mockResolvedValue({ data: null, error: { message: 'Anonymous sign-ins are disabled' } } as never);

      expect(await useUserStore.getState().signInAsGuest()).toBe(false);
      expect(useUserStore.getState()).toMatchObject({ isAuthenticating: false, authError: 'auth.genericError' });
    });
  });

  describe('updateDisplayName', () => {
    it('saves and patches the in-memory user when the row was updated', async () => {
      await supabase.from('profiles').insert({ user_id: 'test-user-1', display_name: 'Ann' });
      expect(await useUserStore.getState().updateDisplayName('  Annie ')).toBeNull();
      expect(useUserStore.getState().user?.displayName).toBe('Annie');
    });

    it('treats an update that matched no row as a failure', async () => {
      expect(await useUserStore.getState().updateDisplayName('Annie')).toBe('profile.nameSaveFailed');
      expect(useUserStore.getState().user?.displayName).toBe('Ann');
    });

    it('validates the length and the session first', async () => {
      expect(await useUserStore.getState().updateDisplayName('   ')).toBe('profile.nameLength');
      expect(await useUserStore.getState().updateDisplayName('x'.repeat(41))).toBe('profile.nameLength');
      useUserStore.setState({ user: null });
      expect(await useUserStore.getState().updateDisplayName('Annie')).toBe('profile.notSignedIn');
    });
  });

  describe('signOut', () => {
    it('signs out this device only and marks it as requested', async () => {
      const spy = jest.spyOn(supabase.auth, 'signOut');
      await useUserStore.getState().signOut();
      expect(spy).toHaveBeenCalledWith({ scope: 'local' });
      expect(useUserStore.getState().user).toBeNull();
      // No AuthListener here to consume it.
      expect(useUserStore.getState().signOutRequested).toBe(true);
    });

    it("clears the request flag when the sign-out didn't happen", async () => {
      __setSignOutError({ message: 'network' });
      await useUserStore.getState().signOut();
      expect(useUserStore.getState().signOutRequested).toBe(false);
    });
  });

  describe('authErrorKey', () => {
    it.each([
      [{ code: 'identity_already_exists', message: 'Identity is already linked to another user' }, 'auth.alreadyLinked'],
      [{ code: 'phone_exists', message: 'A user with this phone number has already been registered' }, 'auth.alreadyLinked'],
      [{ message: 'Identity is already linked' }, 'auth.alreadyLinked'],
      [{ status: 429, message: 'Too many requests' }, 'auth.tooManyAttempts'],
      [{ code: 'over_sms_send_rate_limit', message: 'x' }, 'auth.tooManyAttempts'],
      [{ message: 'Email rate limit exceeded' }, 'auth.tooManyAttempts'],
      [{ code: 'otp_expired', message: 'Token has expired or is invalid' }, 'auth.invalidCode'],
      [{ message: 'Invalid phone number format (E.164 required)' }, 'auth.invalidPhone'],
      [{ message: '{}' }, 'auth.genericError'],
      [new Error('Failed to fetch'), 'auth.genericError'],
    ])('maps %j to %s', (error, key) => {
      expect(authErrorKey(error)).toBe(key);
    });
  });

  it('reads provider errors from either the query string or the fragment', () => {
    expect(redirectError('keybox://auth/callback?code=abc')).toBeNull();
    expect(redirectError('keybox://auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked')).toEqual({
      code: 'identity_already_exists',
      message: 'Identity is already linked',
    });
    expect(redirectError('https://app.example/auth/callback#error=access_denied&error_description=Denied')).toEqual({
      code: undefined,
      message: 'Denied',
    });
  });
});
