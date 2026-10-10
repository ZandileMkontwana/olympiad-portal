import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: mocks.getToken }),
}));

vi.mock('@/lib/api', () => ({
  buildActivityStreamUrl: (token) => `http://backend.test/api/activity/stream?token=${token}`,
}));

import ActivityFeed from './ActivityFeed';

// Minimal stand-in for the browser EventSource — records instances so tests can
// drive open/error/history/live frames and verify close() on unmount.
class FakeEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.onopen = null;
    this.onerror = null;
    this.onmessage = null;
    this.listeners = {};
    this.closed = false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type, handler) {
    (this.listeners[type] = this.listeners[type] || []).push(handler);
  }

  open() {
    if (this.onopen) this.onopen();
  }

  fail() {
    if (this.onerror) this.onerror(new Event('error'));
  }

  emit(type, payload) {
    const message = { data: JSON.stringify(payload) };
    (this.listeners[type] || []).forEach((handler) => handler(message));
    if (type === 'message' && this.onmessage) this.onmessage(message);
  }

  close() {
    this.closed = true;
  }
}

function makeEvent(id, message) {
  return { id, type: 'round_opened', message, createdAt: new Date().toISOString() };
}

async function renderFeed() {
  const utils = render(<ActivityFeed />);
  // Flush the async connect() so the EventSource gets constructed.
  await act(async () => {});
  return utils;
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeEventSource.instances = [];
    mocks.getToken.mockResolvedValue('clerk-token');
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects with the Clerk token and flips to Live once the stream opens', async () => {
    await renderFeed();

    const source = FakeEventSource.instances[0];
    expect(source).toBeDefined();
    expect(source.url).toBe('http://backend.test/api/activity/stream?token=clerk-token');
    expect(screen.getByTestId('activity-status')).toHaveTextContent('Connecting…');

    act(() => source.open());
    expect(screen.getByTestId('activity-status')).toHaveTextContent('Live');
  });

  it('renders the catch-up history frame', async () => {
    await renderFeed();

    const source = FakeEventSource.instances[0];
    act(() => {
      source.open();
      source.emit('history', [
        makeEvent('e1', 'Prod Overview is now open'),
        makeEvent('e2', 'Marking completed for Thabo'),
      ]);
    });

    expect(screen.getByTestId('activity-status')).toHaveTextContent('Live');
    expect(screen.getAllByTestId('activity-item')).toHaveLength(2);
    expect(screen.getByText('Prod Overview is now open')).toBeInTheDocument();
    expect(screen.getByText('Marking completed for Thabo')).toBeInTheDocument();
  });

  it('prepends live events on top of history and caps the list at 30', async () => {
    await renderFeed();

    const source = FakeEventSource.instances[0];
    act(() => {
      source.open();
      source.emit('history', [makeEvent('e1', 'history event')]);
      for (let i = 0; i < 35; i += 1) {
        source.emit('message', makeEvent(`live-${i}`, `live event ${i}`));
      }
    });

    expect(screen.getAllByTestId('activity-item')).toHaveLength(30);
    expect(screen.getByText('live event 34')).toBeInTheDocument();
    expect(screen.queryByText('history event')).not.toBeInTheDocument();
  });

  it('shows Reconnecting while the stream is down', async () => {
    await renderFeed();

    const source = FakeEventSource.instances[0];
    act(() => source.open());
    act(() => source.fail());

    expect(screen.getByTestId('activity-status')).toHaveTextContent('Reconnecting…');
  });

  it('closes the stream when the component unmounts', async () => {
    const { unmount } = await renderFeed();

    const source = FakeEventSource.instances[0];
    unmount();

    expect(source.closed).toBe(true);
  });

  it('shows Offline when EventSource is not supported', async () => {
    vi.stubGlobal('EventSource', undefined);
    await renderFeed();

    expect(screen.getByTestId('activity-status')).toHaveTextContent('Offline');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('shows Offline when no token is available', async () => {
    mocks.getToken.mockResolvedValue(null);
    await renderFeed();

    expect(screen.getByTestId('activity-status')).toHaveTextContent('Offline');
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
