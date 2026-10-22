jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __reset } from '../testUtils/supabaseMock';
import { isGuestUser, openGate, requireAccount, useAccountGateStore } from '@/hooks/useAccountGate';
import { useUserStore } from '@/store/userStore';
import type { AuthProvider } from '@/types';

function setUser(provider: AuthProvider | null) {
  useUserStore.setState({
    user: provider ? { id: 'u1', displayName: 'Tester', provider, avatarSeed: 'Tester', createdAt: '', isAdmin: false } : null,
  });
}

describe('account gate', () => {
  beforeEach(() => {
    __reset();
    useAccountGateStore.getState().close();
  });

  it('opens the sheet for a guest and tells the caller to stop', () => {
    setUser('guest');
    expect(isGuestUser()).toBe(true);
    expect(requireAccount('coins')).toBe(false);
    expect(useAccountGateStore.getState().reason).toBe('coins');
  });

  it.each(['google', 'phone', 'apple', 'email'] as const)('lets a %s member through without opening it', (provider) => {
    setUser(provider);
    expect(requireAccount('membership')).toBe(true);
    expect(useAccountGateStore.getState().reason).toBeNull();
  });

  it('remembers why it was opened (the sheet subtitle) and closes', () => {
    setUser('guest');
    requireAccount('mission');
    requireAccount('coins');
    expect(useAccountGateStore.getState().reason).toBe('coins');
    useAccountGateStore.getState().close();
    expect(useAccountGateStore.getState().reason).toBeNull();
  });

  it('openGate opens it regardless — for a server account_required answer', () => {
    setUser('google');
    openGate('rpc');
    expect(useAccountGateStore.getState().reason).toBe('rpc');
  });

  it('treats nobody signed in (no session yet, or it just ended) like a guest', () => {
    setUser(null);
    expect(requireAccount('coins')).toBe(false);
    expect(useAccountGateStore.getState().reason).toBe('coins');
  });
});
