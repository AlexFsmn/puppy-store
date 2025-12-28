import React from 'react';
import {render, screen, userEvent} from '@testing-library/react-native';
import {PrimaryButton} from '../src/components/buttons/PrimaryButton';

describe('PrimaryButton', () => {
  it('renders the title', () => {
    render(<PrimaryButton title="Submit" onPress={() => {}} />);
    expect(screen.getByText('Submit')).toBeOnTheScreen();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    render(<PrimaryButton title="Submit" onPress={onPress} />);

    await user.press(screen.getByText('Submit'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    render(<PrimaryButton title="Submit" onPress={onPress} disabled />);

    await user.press(screen.getByText('Submit'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    render(<PrimaryButton title="Submit" onPress={() => {}} loading />);
    expect(screen.queryByText('Submit')).not.toBeOnTheScreen();
  });

  it('is disabled when loading', () => {
    const onPress = jest.fn();
    render(<PrimaryButton title="Submit" onPress={onPress} loading />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
