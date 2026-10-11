import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';
import { expectNoAxeViolations } from '@/test/axe';

function setup(onClose = vi.fn()) {
  const utils = render(
    <>
      <button type="button">Opener</button>
      <Modal title="Settings" onClose={onClose}>
        <button type="button">Save</button>
      </Modal>
    </>
  );
  return { onClose, ...utils };
}

describe('Modal', () => {
  it('is a labelled modal dialog', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the dialog on open', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('closes on Escape, on the close button and on a backdrop click', () => {
    const { onClose, container } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(container.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not close when the dialog panel itself is clicked', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps Tab and Shift+Tab inside the dialog', () => {
    setup();
    const close = screen.getByRole('button', { name: 'Close dialog' });
    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
  });

  it('returns focus to the opener when it unmounts', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <Modal title="Calendar" onClose={() => {}}>
        <p>Nothing here</p>
      </Modal>
    );
    // Scroll is prevented via event interception, not body.style.overflow
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = setup();
    await expectNoAxeViolations(container);
  });
});
