"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { MaterialIcon } from "./MaterialIcon";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Client-side error boundary. Catches render errors in its subtree and shows
 * a themed fallback instead of a blank screen. Nest it around critical
 * sections (marketplace catalog, carrito, feeds) so one failing component
 * doesn't take down the whole page.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="glass-card rounded-xl p-10 text-center max-w-lg mx-auto">
        <MaterialIcon
          name="error"
          className="text-5xl text-error mb-3 block mx-auto"
        />
        <h2 className="font-display text-headline-lg text-on-surface mb-2">
          Algo salió mal
        </h2>
        <p className="text-body-md text-on-surface-variant mb-6">
          Ocurrio un error inesperado al mostrar esta seccion.
          {process.env.NODE_ENV !== "production" &&
            this.state.error.message && (
              <span className="block mt-2 text-label-sm text-error">
                {this.state.error.message}
              </span>
            )}
        </p>
        <button
          onClick={this.reset}
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-full font-medium text-label-sm hover:opacity-90 transition-all active:scale-95"
        >
          <MaterialIcon name="refresh" className="text-base" />
          Reintentar
        </button>
      </div>
    );
  }
}
