import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Frame crashed', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app">
          <section className="collection">
            <div className="empty-state">
              <h3>Something went wrong</h3>
              <p>Frame ran into an unexpected error.</p>
              <div className="onboarding-actions">
                <button className="onboarding-secondary" type="button" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </div>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
