'use client'

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: "100vh", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          background: "#0b0b0f",
          color: "#fafafa",
          padding: "2rem"
        }}>
          <div style={{ textAlign: "center", maxWidth: "600px" }}>
            <h1 style={{ color: "#ef4444", marginBottom: "1rem" }}>Something went wrong</h1>
            <pre style={{ 
              background: "#1a1a1a", 
              padding: "1rem", 
              borderRadius: "8px",
              overflow: "auto",
              fontSize: "12px"
            }}>
              {this.state.errorMessage}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              style={{
                marginTop: "1rem",
                padding: "0.5rem 1rem",
                background: "#6366f1",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
