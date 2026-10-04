'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { buildActivityStreamUrl } from '@/lib/api';

const MAX_EVENTS = 30;

const TYPE_COLORS = {
  round_opened: '#2d8a5e',
  round_closed: '#b07d1e',
  auto_advanced: '#6d3fd1',
  submission_received: '#2563eb',
  sitting_submitted: '#2563eb',
  marking_completed: '#0f766e',
  results_released: '#9333ea',
  access_request_decided: '#b45309',
};

const STATUS_META = {
  connecting: { label: 'Connecting\u2026', color: '#706391', bg: 'rgba(139,127,168,0.12)' },
  live: { label: 'Live', color: '#277751', bg: 'rgba(63,174,122,0.14)' },
  reconnecting: { label: 'Reconnecting\u2026', color: '#8b6318', bg: 'rgba(224,168,62,0.15)' },
  error: { label: 'Offline', color: '#b42318', bg: 'rgba(224,97,95,0.12)' },
};

function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

/**
 * Live activity feed (US-4.1) — connects to the backend's Server-Sent Events
 * stream and renders portal activity as it happens. The backend sends a
 * catch-up history frame on every (re)connect; native EventSource handles
 * reconnection automatically, so this component only tracks the status for
 * the badge.
 */
export default function ActivityFeed() {
  const { getToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('connecting');
  const sourceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (typeof EventSource === 'undefined') {
        setStatus('error');
        return;
      }

      const token = await getToken();
      if (cancelled) return;

      if (!token) {
        setStatus('error');
        return;
      }

      const source = new EventSource(buildActivityStreamUrl(token));
      sourceRef.current = source;

      source.onopen = () => {
        if (!cancelled) setStatus('live');
      };
      source.onerror = () => {
        if (!cancelled) setStatus('reconnecting');
      };

      // Named frame: the server's catch-up history (newest-first array).
      source.addEventListener('history', (message) => {
        if (cancelled) return;
        try {
          setEvents(JSON.parse(message.data));
        } catch {
          // ignore malformed frames
        }
      });

      // Unnamed frames: live events as they are broadcast.
      source.onmessage = (message) => {
        if (cancelled) return;
        try {
          const event = JSON.parse(message.data);
          setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        } catch {
          // ignore malformed frames
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, [getToken]);

  const meta = STATUS_META[status];

  return (
    <div style={{ padding: '18px 22px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '0.78em', color: '#6d667c' }}>Real-time feed</span>
        <span
          data-testid="activity-status"
          style={{
            padding: '2px 10px',
            borderRadius: '999px',
            fontSize: '0.68em',
            fontWeight: 700,
            color: meta.color,
            background: meta.bg,
          }}
        >
          {meta.label}
        </span>
      </div>

      {events.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8em', color: '#6e5fa5' }}>
          No activity yet — new submissions, round changes, and results will appear here the
          moment they happen.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {events.map((event) => (
            <li
              key={event.id}
              style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}
              data-testid="activity-item"
            >
              <i
                aria-hidden="true"
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  marginTop: '6px',
                  flexShrink: 0,
                  background: TYPE_COLORS[event.type] || '#8b7fa8',
                  display: 'inline-block',
                }}
              />
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.82em',
                    fontWeight: 500,
                    color: '#4a4458',
                  }}
                >
                  {event.message}
                </p>
                <small style={{ fontSize: '0.72em', color: '#6e5fa5' }}>
                  {timeAgo(event.createdAt)}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
