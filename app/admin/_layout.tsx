import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useUserStore } from '@/store';
import { colors } from '@/theme';

/** Route guard for every /admin/* screen — RLS is the real security boundary
 * (see profiles.is_admin + is_admin() policies), this just avoids rendering
 * admin UI at all for non-admins. */
export default function AdminLayout() {
  const user = useUserStore((s) => s.user);

  if (!user?.isAdmin) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
