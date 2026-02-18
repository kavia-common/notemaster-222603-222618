import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Notemaster header', () => {
  render(<App />);
  const header = screen.getByText(/Notemaster/i);
  expect(header).toBeInTheDocument();
});
