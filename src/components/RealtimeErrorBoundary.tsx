import React, { Component, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class RealtimeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to your error reporting service
    console.error('Realtime Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="w-full max-w-md mx-auto my-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || 'Failed to establish realtime connection'}
            </p>
            <div className="flex justify-end">
              <Button
                onClick={this.handleRetry}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
} 