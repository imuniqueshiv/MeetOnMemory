import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibleDialog } from './AccessibleDialog';

describe('AccessibleDialog', () => {
  const mockOnClose = jest.fn();

  const renderDialog = (isOpen = true) => {
    return render(
      <div>
        <button id="trigger">Open</button>
        <AccessibleDialog isOpen={isOpen} onClose={mockOnClose} title="Test Dialog">
          <input type="text" placeholder="Input 1" />
          <button>Submit</button>
        </AccessibleDialog>
      </div>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides correct dialog semantics', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
    expect(screen.getByText('Test Dialog')).toHaveAttribute('id', 'dialog-title');
  });

  it('moves focus into the dialog when opened', () => {
    renderDialog();
    // The first focusable element is the Close button
    const closeButton = screen.getByRole('button', { name: /close dialog/i });
    expect(document.activeElement).toBe(closeButton);
  });

  it('traps focus within the dialog', async () => {
    renderDialog();
    const user = userEvent.setup();
    
    const closeButton = screen.getByRole('button', { name: /close dialog/i });
    const input = screen.getByPlaceholderText('Input 1');
    const submitBtn = screen.getByRole('button', { name: /submit/i });

    // Initial focus is on close button
    expect(document.activeElement).toBe(closeButton);

    // Tab to input
    await user.tab();
    expect(document.activeElement).toBe(input);

    // Tab to submit button (last element)
    await user.tab();
    expect(document.activeElement).toBe(submitBtn);

    // Tab again should loop back to the first element (close button)
    await user.tab();
    expect(document.activeElement).toBe(closeButton);

    // Shift+Tab should loop backwards to the last element
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(submitBtn);
  });

  it('closes when Escape key is pressed', () => {
    renderDialog();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger element after closing', () => {
    const { rerender } = renderDialog(false);
    
    // Focus the trigger button manually before opening
    const trigger = screen.getByText('Open');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open the dialog
    rerender(
      <div>
        <button id="trigger">Open</button>
        <AccessibleDialog isOpen={true} onClose={mockOnClose} title="Test Dialog">
          <button>Inside</button>
        </AccessibleDialog>
      </div>
    );
    
    // Verify focus moved inside
    expect(document.activeElement).not.toBe(trigger);

    // Close the dialog
    rerender(
      <div>
        <button id="trigger">Open</button>
        <AccessibleDialog isOpen={false} onClose={mockOnClose} title="Test Dialog">
          <button>Inside</button>
        </AccessibleDialog>
      </div>
    );

    // Verify focus returned to trigger
    expect(document.activeElement).toBe(trigger);
  });
});
