import React from 'react';
import {render} from '@testing-library/react-native';
import {ErrorBoundary} from '../src/components/ErrorBoundary';
import {Text} from 'react-native';

// Component that throws an error
const ThrowError = () => {
  throw new Error('Test error');
};

// Component that works normally
const WorkingComponent = () => <Text>Working!</Text>;

describe('ErrorBoundary', () => {
  // Suppress console.error for this test since we expect errors
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('should render children when there is no error', () => {
    const {getByText} = render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>,
    );

    expect(getByText('Working!')).toBeTruthy();
  });

  it('should render error UI when child component throws', () => {
    const {getByText} = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(getByText('Oops! Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = (error: Error) => <Text>Custom: {error.message}</Text>;

    const {getByText} = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(getByText('Custom: Test error')).toBeTruthy();
  });
});
