import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EDUCATOR_TOUR,
  ORGANISER_TOUR,
  clearReplayRequest,
  clearTourState,
  getTourState,
  isReplayRequested,
  requestReplay,
  saveTourState,
  shouldAutoStartTour,
  tourStorageKey,
} from './tour';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('tour state storage (#342)', () => {
  it('is empty for a new user and the tour should auto-start', () => {
    expect(getTourState('educator', 'u1')).toBeNull();
    expect(shouldAutoStartTour('educator', 'u1')).toBe(true);
  });

  it('never auto-starts without a user id', () => {
    expect(shouldAutoStartTour('educator', undefined)).toBe(false);
    expect(shouldAutoStartTour('educator', '')).toBe(false);
  });

  it('remembers completion and dismissal and stops auto-starting', () => {
    saveTourState('educator', 'u1', 'completed');
    expect(getTourState('educator', 'u1').status).toBe('completed');
    expect(shouldAutoStartTour('educator', 'u1')).toBe(false);

    saveTourState('organiser', 'u2', 'dismissed');
    expect(getTourState('organiser', 'u2').status).toBe('dismissed');
    expect(shouldAutoStartTour('organiser', 'u2')).toBe(false);
  });

  it('keeps users and roles separate', () => {
    saveTourState('educator', 'u1', 'dismissed');
    expect(shouldAutoStartTour('educator', 'u2')).toBe(true);
    expect(shouldAutoStartTour('organiser', 'u1')).toBe(true);
  });

  it('ignores corrupt stored values', () => {
    window.localStorage.setItem(tourStorageKey('educator', 'u1'), '{nope');
    expect(getTourState('educator', 'u1')).toBeNull();
    window.localStorage.setItem(tourStorageKey('educator', 'u1'), JSON.stringify({ status: 'x' }));
    expect(getTourState('educator', 'u1')).toBeNull();
  });

  it('can clear the state', () => {
    saveTourState('educator', 'u1', 'completed');
    clearTourState('educator', 'u1');
    expect(getTourState('educator', 'u1')).toBeNull();
  });

  it('survives blocked storage', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getTourState('educator', 'u1')).toBeNull();
    expect(() => saveTourState('educator', 'u1', 'completed')).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});

describe('replay request', () => {
  it('is remembered per role until cleared', () => {
    expect(isReplayRequested('educator')).toBe(false);
    requestReplay('educator');
    expect(isReplayRequested('educator')).toBe(true);
    expect(isReplayRequested('organiser')).toBe(false);
    clearReplayRequest();
    expect(isReplayRequested('educator')).toBe(false);
  });
});

describe('tour definitions (#339, #340)', () => {
  it.each([
    ['educator', EDUCATOR_TOUR, '/educator'],
    ['organiser', ORGANISER_TOUR, '/organiser'],
  ])('%s tour has 3-5 complete steps and a home route', (role, tour, home) => {
    expect(tour.role).toBe(role);
    expect(tour.home).toBe(home);
    expect(tour.steps.length).toBeGreaterThanOrEqual(3);
    expect(tour.steps.length).toBeLessThanOrEqual(5);
    const ids = new Set(tour.steps.map((s) => s.id));
    expect(ids.size).toBe(tour.steps.length);
    for (const step of tour.steps) {
      expect(step.title).toBeTruthy();
      expect(step.body).toBeTruthy();
      expect(step.target).toMatch(/^\[data-tour="[a-z-]+"\]$/);
    }
  });

  it('educator tour covers register students, rounds, submit results, standings', () => {
    expect(EDUCATOR_TOUR.steps.map((s) => s.id)).toEqual([
      'register-students',
      'view-rounds',
      'submit-results',
      'check-standings',
    ]);
  });

  it('organiser tour covers create olympiad, rounds, papers, dashboard', () => {
    expect(ORGANISER_TOUR.steps.map((s) => s.id).slice(0, 4)).toEqual([
      'create-olympiad',
      'add-rounds',
      'upload-papers',
      'view-dashboard',
    ]);
  });
});
