import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="w-full h-full flex items-center justify-center rounded-xl bg-secondary/50 border border-border">
            <div className="max-w-sm text-center p-6">
              <h2 className="text-lg font-semibold text-foreground">Map failed to load</h2>
              <p className="text-sm text-muted-foreground mt-2">
                A runtime error occurred while rendering the map. The rest of the app should still work.
              </p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
