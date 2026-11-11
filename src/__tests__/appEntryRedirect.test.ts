jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) } }));
jest.mock('@/utils/autoGuestSignIn', () => ({ autoGuestSignIn: jest.fn(), recoverGuestSession: jest.fn() }));

import React, { useEffect } from 'react';
import renderer, { act } from 'react-test-renderer';
import { __emitAuthEvent, __makeSession, __reset, __setUserId, supabase } from '../testUtils/supabaseMock';
import { autoGuestSignIn } from '@/utils/autoGuestSignIn';
import { useAppEntryRedirect, type AppEntryRedirect } from '@/hooks/useAppEntryRedirect';
import { startAuthListener } from '@/store/AuthListener';
import { useUserStore } from '@/store/userStore';

let latest: AppEntryRedirect = null;

function Probe({ ready, onResult }: { ready: boolean; onResult: (r: AppEntryRedirect) => void }) {
  const result = useAppEntryRedirect(ready);
  useEffect(() => {
    onResult(result);
  });
  return null;
}

async function mount(ready = true) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(React.createElement(Probe, { ready, onResult: (r) => (latest = r) }));
  });
  return tree;
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useAppEntryRedirect', () => {
  beforeEach(() => {
    __reset();
    jest.restoreAllMocks();
    (autoGuestSignIn as jest.Mock).mockClear();
    latest = null;
    useUserStore.setState({ user: null, hasOnboarded: true, sessionChecked: false, signOutRequested: false, authError: null });
  });

  it('does not create a guest before the session has been checked', async () => {
    const tree = await mount();
    expect(autoGuestSignIn).not.toHaveBeenCalled();
    expect(latest).toBeNull();

    await act(async () => {
      useUserStore.setState({ sessionChecked: true });
    });
    expect(autoGuestSignIn).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('goes straight to the tabs for a restored session, without a guest', async () => {
    const tree = await mount();
    await act(async () => {
      useUserStore.setState({
        sessionChecked: true,
        user: { id: 'u1', displayName: 'Ann', avatarSeed: 'Ann', provider: 'google', createdAt: '', isAdmin: false },
      });
    });
    expect(latest).toBe('/(tabs)');
    expect(autoGuestSignIn).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('keeps an existing session even when its profile loads slower than the splash', async () => {
    // Hold the profiles query: on a slow network the restored session is
    // known long before its profile row arrives.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const realFrom = supabase.from;
    jest.spyOn(supabase, 'from').mockImplementation((table: string) => {
      const builder = realFrom(table);
      if (table === 'profiles') {
        const realThen = builder.then.bind(builder);
        builder.then = ((onFulfilled, onRejected) => gate.then(() => realThen(onFulfilled, onRejected))) as typeof builder.then;
      }
      return builder;
    });

    const stop = startAuthListener();
    const tree = await mount();
    __setUserId('member-1');
    await act(async () => {
      __emitAuthEvent('INITIAL_SESSION', __makeSession('member-1'));
    });
    await settle();

    expect(autoGuestSignIn).not.toHaveBeenCalled();
    expect(latest).toBe('/(tabs)');
    expect(useUserStore.getState().user?.id).toBe('member-1');

    release();
    await settle();
    expect(autoGuestSignIn).not.toHaveBeenCalled();
    expect(useUserStore.getState().sessionChecked).toBe(true);
    act(() => tree.unmount());
    stop();
  });

  it('creates a guest once the listener reports there is no session', async () => {
    const stop = startAuthListener();
    const tree = await mount();
    __setUserId(null);
    await act(async () => {
      __emitAuthEvent('INITIAL_SESSION', null);
    });
    await settle();
    expect(autoGuestSignIn).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    stop();
  });

  it('sends a first launch to onboarding', async () => {
    useUserStore.setState({ hasOnboarded: false, sessionChecked: true });
    const tree = await mount();
    expect(latest).toBe('/onboarding');
    expect(autoGuestSignIn).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
