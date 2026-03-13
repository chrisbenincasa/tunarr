import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from './utils';

function TestComponent({ message }: { message: string }) {
  return <div data-testid="test-component">{message}</div>;
}

describe('Test utilities', () => {
  test('renderWithProviders renders component with providers', () => {
    renderWithProviders(<TestComponent message="Hello, World!" />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  test('renderWithProviders returns user for interactions', async () => {
    const { user } = renderWithProviders(
      <button onClick={() => console.log('clicked')}>Click me</button>,
    );

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();

    // Verify user is available for interactions
    await user.click(button);
  });
});
