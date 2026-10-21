import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({
  replace: vi.fn(),
  getToken: vi.fn(),
  signOut: vi.fn(),
  isLoaded: true,
  isSignedIn: true,
}));
vi.mock('next/navigation', () => {
  const router = { replace: state.replace };
  return { useRouter: () => router };
});
vi.mock('@clerk/nextjs', () => ({ useAuth: () => state, useClerk: () => state }));
vi.mock('@/lib/api', () => ({
  fetchCurrentUser: vi.fn(),
  completeEducatorProfile: vi.fn(),
  dashboardPathForRole: (role) => `/${role}`,
}));

import { completeEducatorProfile, fetchCurrentUser } from '@/lib/api';
import CompleteProfilePage from './page';
import { expectNoAxeViolations } from '@/test/axe';

async function fillProfile() {
  fireEvent.change(await screen.findByLabelText('Full name'), {
    target: { value: ' Teacher Name ' },
  });
  fireEvent.change(screen.getByLabelText('School name'), { target: { value: ' Test School ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
}

describe('Educator profile completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isLoaded = true;
    state.isSignedIn = true;
    state.getToken.mockResolvedValue('clerk-token');
    fetchCurrentUser.mockResolvedValue(null);
    completeEducatorProfile.mockResolvedValue({ id: 'educator-1', role: 'educator' });
  });

  it('saves the verified account profile and continues to the educator dashboard', async () => {
    render(<CompleteProfilePage />);
    await fillProfile();
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/educator'));
    expect(completeEducatorProfile).toHaveBeenCalledWith('clerk-token', {
      name: 'Teacher Name',
      schoolName: 'Test School',
    });
  });

  it('sends existing accounts to their actual dashboard', async () => {
    fetchCurrentUser.mockResolvedValue({ role: 'organiser' });
    render(<CompleteProfilePage />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/organiser'));
    expect(completeEducatorProfile).not.toHaveBeenCalled();
  });

  it('shows a save error and keeps entered details so the user can retry', async () => {
    completeEducatorProfile.mockRejectedValueOnce(new Error('Could not save your profile'));
    render(<CompleteProfilePage />);
    await fillProfile();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your profile');
    expect(screen.getByLabelText('Full name')).toHaveValue(' Teacher Name ');
    expect(state.signOut).not.toHaveBeenCalled();
    expect(state.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/educator'));
  });

  it('does not offer profile creation when the account lookup fails', async () => {
    fetchCurrentUser.mockRejectedValueOnce(new Error('Server unavailable'));
    render(<CompleteProfilePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(screen.queryByRole('button', { name: 'Save and continue' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Full name')).toBeInTheDocument();
  });

  it('requires a signed-in account', async () => {
    state.isSignedIn = false;
    render(<CompleteProfilePage />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/login'));
    expect(completeEducatorProfile).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<CompleteProfilePage />);
    await screen.findByLabelText('Full name');
    await expectNoAxeViolations(container);
  });
});
