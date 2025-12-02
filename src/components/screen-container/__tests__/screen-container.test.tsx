import React from 'react';
import { Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ScreenContainer } from '../screen-container';

// Mock SafeAreaView to avoid native component issues in unit tests
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: any) => <View style={style}>{children}</View>,
}));

describe('ScreenContainer', () => {
  const TestChild = () => <Text>Test Content</Text>;

  it('renders children correctly', () => {
    render(
      <ScreenContainer>
        <TestChild />
      </ScreenContainer>
    );
    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('does not render ScrollView by default (scrollable=false)', () => {
    render(
      <ScreenContainer>
        <TestChild />
      </ScreenContainer>
    );
    // We expect the ScrollView testID to NOT be present
    const scrollView = screen.queryByTestId('screen-scroll-view');
    expect(scrollView).toBeNull();
    
    // But the content container should be present
    expect(screen.getByTestId('screen-content-container')).toBeTruthy();
  });

  it('renders ScrollView when scrollable is true', () => {
    render(
      <ScreenContainer scrollable>
        <TestChild />
      </ScreenContainer>
    );
    const scrollView = screen.getByTestId('screen-scroll-view');
    expect(scrollView).toBeTruthy();
    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('applies custom style to the content container', () => {
    const customStyle = { backgroundColor: 'red' };
    render(
      <ScreenContainer style={customStyle}>
        <TestChild />
      </ScreenContainer>
    );
    
    const contentContainer = screen.getByTestId('screen-content-container');
    // Check if the style prop is applied. 
    // Note: specific style checking depends on how RNTL/Jest interprets the style array.
    // Often strict equality might fail if flattened, but checking for the property existence works.
    expect(contentContainer.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining(customStyle)])
    );
  });

  it('passes styles when scrollable is true', () => {
    const customStyle = { padding: 20 };
    render(
      <ScreenContainer scrollable style={customStyle}>
        <TestChild />
      </ScreenContainer>
    );

    const contentContainer = screen.getByTestId('screen-content-container');
    expect(contentContainer.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining(customStyle)])
    );
  });
});

