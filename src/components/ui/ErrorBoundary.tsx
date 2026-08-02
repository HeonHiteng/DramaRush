import React from 'react';
import { StartupErrorScreen } from './StartupErrorScreen';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches unexpected render-time errors anywhere below it in the tree and
 * shows a legible message instead of a blank screen. Note this cannot catch
 * errors thrown while a *module* is being evaluated (e.g. at the top level
 * of an imported file) — those happen before React starts rendering at all.
 * The missing-Supabase-config case is handled explicitly in app/_layout.tsx
 * instead, precisely because of that limitation.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Unexpected error caught by ErrorBoundary:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <StartupErrorScreen message={this.state.error.message} />;
  }
}
