jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __reset, __setSignOutError, supabase } from '../testUtils/supabaseMock';
import { authErrorKey, redirectError, useUserStore } from '@/store/userStore';

const member = { id: 'test-user-1', displayName: 'Ann', provider: 'google' as const, avatarSeed: 'Ann', createdAt: '', isAdmin: false };

describe('userStore', () => {
  beforeEach(() => {
    __reset();
    jest.restoreAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useUserStore.setState({ user: member, signOutRequested: false, authError: null });
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
