import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

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
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary', 'Caught error', { error, errorInfo });
    console.error('🔴 ErrorBoundary caught error:', error);
    console.error('🔴 Error stack:', error.stack);
    console.error('🔴 Component stack:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>⚠️ שגיאה באפליקציה</Text>
            <Text style={styles.message}>
              {this.state.error?.message || 'שגיאה לא ידועה'}
            </Text>
            
            <ScrollView style={styles.stackContainer}>
              <Text style={styles.stackTitle}>Stack Trace:</Text>
              <Text style={styles.stackText}>
                {this.state.error?.stack || 'No stack trace'}
              </Text>
              
              {this.state.errorInfo && (
                <>
                  <Text style={styles.stackTitle}>Component Stack:</Text>
                  <Text style={styles.stackText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
              }}
            >
              <Text style={styles.buttonText}>נסה שוב</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 600,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  stackContainer: {
    maxHeight: 400,
    backgroundColor: '#1A1E1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  stackTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00C805',
    marginTop: 12,
    marginBottom: 8,
  },
  stackText: {
    fontSize: 12,
    color: '#AAAAAA',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#00C805',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
