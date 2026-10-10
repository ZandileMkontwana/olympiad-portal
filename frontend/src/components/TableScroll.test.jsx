import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TableScroll from './TableScroll';

describe('TableScroll', () => {
  it('wraps its table in a labelled, keyboard-focusable scroll region', () => {
    render(
      <TableScroll label="Entrant standings" className="mt-8">
        <table>
          <tbody>
            <tr>
              <td>cell</td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
    );
    const region = screen.getByRole('region', { name: 'Entrant standings' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('table-scroll', 'mt-8');
    expect(region.querySelector('table')).toBeInTheDocument();
  });
});
