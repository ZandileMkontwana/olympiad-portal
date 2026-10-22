import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const state = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock('@clerk/nextjs', () => ({
  SignUp: (props) => {
    state.signUp(props);
    return <div>Sign up</div>;
  },
}));
vi.mock('@/hooks/useAuthRedirect', () => ({ useRedirectIfAuthenticated: vi.fn() }));
vi.mock('@/components/ThemeProvider', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('@/components/ThemeToggle', () => ({ default: () => null }));

import RegisterPage from './[[...rest]]/page';

describe('Registration redirects', () => {
  it('routes verification and sign-in transfers through the portal account check', () => {
    render(<RegisterPage />);
    expect(state.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        forceRedirectUrl: '/auth/check',
        signInForceRedirectUrl: '/auth/check',
      })
    );
  });
});
