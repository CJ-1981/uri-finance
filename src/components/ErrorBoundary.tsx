import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const DefaultErrorFallback = ({ 
  error, 
  errorInfo, 
  onReset 
}: { 
  error: Error | null; 
  errorInfo: ErrorInfo | null; 
  onReset: () => void;
}) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-full">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">
              {t("error.title")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("error.message")}
          </p>

          {import.meta.env.DEV && error && (
            <details className="mt-4 p-4 bg-muted rounded-lg">
              <summary className="cursor-pointer font-medium text-sm">
                {t("error.details")}
              </summary>
              <pre className="mt-2 text-xs overflow-auto max-h-40">
                {error.toString()}
                {errorInfo && errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-2">
            <Button onClick={onReset} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("error.tryAgain")}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              {t("error.reload")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree,
 * logs those errors, and displays a fallback UI instead of
 * crashing the entire application.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error("Error Boundary caught an error:", error, errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <DefaultErrorFallback 
          error={this.state.error} 
          errorInfo={this.state.errorInfo} 
          onReset={this.handleReset} 
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;