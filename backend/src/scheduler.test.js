import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const cron = require('node-cron');
const sgMail = require('@sendgrid/mail');
const prisma = require('./lib/prisma');
const { startScheduler } = require('./scheduler');

describe('startScheduler', () => {
  let scheduledCallback;

  beforeEach(() => {
    vi.spyOn(cron, 'schedule').mockImplementation((expr, fn) => {
      scheduledCallback = fn;
    });
    vi.spyOn(prisma.round, 'updateMany');
    vi.spyOn(prisma.round, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.round, 'update').mockResolvedValue({});
    vi.spyOn(prisma.round, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.roundEntrant, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.roundEntrant, 'create').mockResolvedValue({});
    vi.spyOn(prisma.entrant, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.roundEntrant, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.roundEntrant, 'createMany').mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.notificationLog, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.notificationLog, 'create').mockResolvedValue({ id: 'log-1' });
    vi.spyOn(prisma.notificationRule, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ now: new Date() }]);
    vi.spyOn(sgMail, 'send').mockResolvedValue({});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls cron.schedule with a cron expression and callback', () => {
    startScheduler();
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(typeof cron.schedule.mock.calls[0][1]).toBe('function');
  });

  it('logs a startup message', () => {
    startScheduler();
    expect(console.log).toHaveBeenCalledWith('Round scheduler started — ticking every 30s');
  });

  it('scheduled function opens rounds whose openTime has passed', async () => {
    startScheduler();

    prisma.round.updateMany.mockResolvedValueOnce({ count: 3 }).mockResolvedValueOnce({ count: 0 });

    await scheduledCallback();

    expect(prisma.round.updateMany).toHaveBeenCalledTimes(2);

    expect(prisma.round.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        state: 'scheduled',
        openTime: { lte: expect.any(Date) },
      },
      data: { state: 'open' },
    });
  });

  it('scheduled function closes rounds whose closeTime has passed', async () => {
    startScheduler();

    prisma.round.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 2 });

    await scheduledCallback();

    expect(prisma.round.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        state: 'open',
        closeTime: { lte: expect.any(Date) },
      },
      data: { state: 'closed' },
    });
  });

  it('logs opened count when rounds are opened', async () => {
    startScheduler();

    prisma.round.updateMany.mockResolvedValueOnce({ count: 5 }).mockResolvedValueOnce({ count: 0 });

    await scheduledCallback();

    const openedLogs = console.log.mock.calls.filter((c) => c[0]?.includes?.('Opened'));

    expect(openedLogs).toHaveLength(1);
    expect(openedLogs[0][0]).toContain('5');
  });

  it('logs closed count when rounds are closed', async () => {
    startScheduler();

    prisma.round.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 7 });

    await scheduledCallback();

    const closedLogs = console.log.mock.calls.filter((c) => c[0]?.includes?.('Closed'));

    expect(closedLogs).toHaveLength(1);
    expect(closedLogs[0][0]).toContain('7');
  });

  it('does not log opened/closed when counts are zero', async () => {
    startScheduler();

    prisma.round.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });

    await scheduledCallback();

    const openedLogs = console.log.mock.calls.filter((c) => c[0]?.includes?.('Opened'));

    const closedLogs = console.log.mock.calls.filter((c) => c[0]?.includes?.('Closed'));

    expect(openedLogs).toHaveLength(0);
    expect(closedLogs).toHaveLength(0);
  });

  describe('qualifying threshold auto-advance', () => {
    function closedRound(overrides = {}) {
      return {
        id: 'round-1',
        olympiadId: 'oly-1',
        openTime: new Date('2026-01-01'),
        qualifyingThreshold: 50,
        roundEntrants: [],
        ...overrides,
      };
    }

    function roundEntrantWithScore(score, { entrantId = 'entrant-1', roundId = 'round-1' } = {}) {
      return {
        entrant: {
          id: entrantId,
          submissions:
            score === undefined
              ? []
              : [
                  {
                    roundId,
                    result: score === null ? null : { score },
                  },
                ],
        },
      };
    }

    async function runAutoAdvanceTick(roundsToProcess) {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({ count: 0 });

      prisma.round.findMany
        .mockResolvedValueOnce([]) // before_open
        .mockResolvedValueOnce([]) // before_close
        .mockResolvedValueOnce([]) // results_released
        .mockResolvedValueOnce([]) // missing_submission
        .mockResolvedValueOnce(roundsToProcess); // auto-advance

      await scheduledCallback();
    }

    it('queries only closed, unprocessed rounds with a qualifyingThreshold set', async () => {
      await runAutoAdvanceTick([]);

      expect(prisma.round.findMany).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          where: {
            state: 'closed',
            qualifyingThreshold: { not: null },
            autoAdvanceProcessedAt: null,
          },
        })
      );
    });

    it('advances an entrant who met the threshold into the next round', async () => {
      prisma.round.findFirst.mockResolvedValue({
        id: 'round-2',
        openTime: new Date('2026-02-01'),
      });

      prisma.roundEntrant.findUnique.mockResolvedValue(null);

      await runAutoAdvanceTick([
        closedRound({
          roundEntrants: [roundEntrantWithScore(80)],
        }),
      ]);

      expect(prisma.round.findFirst).toHaveBeenCalledWith({
        where: {
          olympiadId: 'oly-1',
          openTime: { gt: closedRound().openTime },
        },
        orderBy: { openTime: 'asc' },
      });

      expect(prisma.roundEntrant.create).toHaveBeenCalledWith({
        data: {
          roundId: 'round-2',
          entrantId: 'entrant-1',
        },
      });
    });

    it('does not advance an entrant who scored below the threshold', async () => {
      prisma.round.findFirst.mockResolvedValue({
        id: 'round-2',
        openTime: new Date('2026-02-01'),
      });

      await runAutoAdvanceTick([
        closedRound({
          roundEntrants: [roundEntrantWithScore(30)],
        }),
      ]);

      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('does not advance an entrant who has not been marked yet', async () => {
      prisma.round.findFirst.mockResolvedValue({
        id: 'round-2',
        openTime: new Date('2026-02-01'),
      });

      await runAutoAdvanceTick([
        closedRound({
          roundEntrants: [roundEntrantWithScore(null)],
        }),
      ]);

      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('does not duplicate registration for an entrant already registered in the next round', async () => {
      prisma.round.findFirst.mockResolvedValue({
        id: 'round-2',
        openTime: new Date('2026-02-01'),
      });

      prisma.roundEntrant.findUnique.mockResolvedValue({
        id: 'existing-registration',
      });

      await runAutoAdvanceTick([
        closedRound({
          roundEntrants: [roundEntrantWithScore(80)],
        }),
      ]);

      expect(prisma.roundEntrant.findUnique).toHaveBeenCalledWith({
        where: {
          roundId_entrantId: {
            roundId: 'round-2',
            entrantId: 'entrant-1',
          },
        },
      });

      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('does nothing when there is no next round in the olympiad', async () => {
      prisma.round.findFirst.mockResolvedValue(null);

      await runAutoAdvanceTick([
        closedRound({
          roundEntrants: [roundEntrantWithScore(80)],
        }),
      ]);

      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('marks the round as processed so it is not reprocessed on the next tick', async () => {
      prisma.round.findFirst.mockResolvedValue(null);

      await runAutoAdvanceTick([closedRound()]);

      expect(prisma.round.update).toHaveBeenCalledWith({
        where: { id: 'round-1' },
        data: {
          autoAdvanceProcessedAt: expect.any(Date),
        },
      });
    });
  });

  it('registers all existing entrants for newly opened rounds', async () => {
    startScheduler();

    prisma.round.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    prisma.round.findMany.mockResolvedValueOnce([{ id: 'round-1' }]).mockResolvedValueOnce([]);

    prisma.entrant.findMany.mockResolvedValue([{ id: 'entrant-1' }, { id: 'entrant-2' }]);

    // entrant-1 is already registered, entrant-2 is not
    prisma.roundEntrant.findMany.mockResolvedValue([{ entrantId: 'entrant-1' }]);

    prisma.roundEntrant.createMany.mockResolvedValue({
      count: 1,
    });

    await scheduledCallback();

    expect(prisma.roundEntrant.findMany).toHaveBeenCalledWith({
      where: { roundId: 'round-1' },
      select: { entrantId: true },
    });

    expect(prisma.roundEntrant.createMany).toHaveBeenCalledWith({
      data: [
        {
          roundId: 'round-1',
          entrantId: 'entrant-2',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('does not register entrants who have not passed a gated round prerequisite', async () => {
    startScheduler();
    prisma.round.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    prisma.round.findMany
      .mockResolvedValueOnce([
        { id: 'round-2', prerequisiteRoundId: 'round-1', qualifyingThreshold: 50 },
      ])
      .mockResolvedValueOnce([]);
    prisma.entrant.findMany.mockResolvedValue([{ id: 'entrant-1' }]);
    // No qualifying submission in the prerequisite round
    prisma.submission.findMany.mockResolvedValue([]);

    await scheduledCallback();

    expect(prisma.roundEntrant.createMany).not.toHaveBeenCalled();
  });

  it('registers entrants who passed a gated round prerequisite', async () => {
    startScheduler();
    prisma.round.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    prisma.round.findMany
      .mockResolvedValueOnce([
        { id: 'round-2', prerequisiteRoundId: 'round-1', qualifyingThreshold: 50 },
      ])
      .mockResolvedValueOnce([]);
    prisma.entrant.findMany.mockResolvedValue([{ id: 'entrant-1' }]);
    prisma.submission.findMany.mockResolvedValue([{ entrantId: 'entrant-1' }]);

    await scheduledCallback();

    expect(prisma.roundEntrant.createMany).toHaveBeenCalledWith({
      data: [{ roundId: 'round-2', entrantId: 'entrant-1' }],
      skipDuplicates: true,
    });
  });

  describe('before-open reminder emails', () => {
    const upcomingRound = () => ({
      id: 'round-1',
      name: 'Round One',
      openTime: new Date(Date.now() + 30 * 60 * 1000),
      roundEntrants: [
        {
          entrant: {
            school: {
              educators: [
                {
                  user: {
                    email: 'educator@school.com',
                  },
                },
              ],
            },
          },
        },
        {
          entrant: {
            school: {
              educators: [
                {
                  user: {
                    email: 'educator@school.com',
                  },
                },
              ],
            },
          },
        },
      ],
    });

    it('queries rounds opening within the next hour', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      await scheduledCallback();

      expect(prisma.round.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            state: 'scheduled',
            openTime: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          },
        })
      );
    });

    it('sends one reminder per unique educator email and logs it as before_open', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany.mockResolvedValueOnce([upcomingRound()]);

      prisma.notificationLog.findUnique.mockResolvedValue(null);

      await scheduledCallback();

      expect(sgMail.send).toHaveBeenCalledTimes(1);

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'educator@school.com',
          subject: 'Round One opens soon',
        })
      );

      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(1);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          roundId: 'round-1',
          entrantId: null,
          triggerType: 'before_open',
          recipientEmail: 'educator@school.com',
          status: 'sent',
        },
      });
    });

    it('skips educators who were already notified for the round', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany.mockResolvedValueOnce([upcomingRound()]);

      prisma.notificationLog.findUnique.mockResolvedValue({
        id: 'existing-log',
      });

      await scheduledCallback();

      expect(prisma.notificationLog.findUnique).toHaveBeenCalledWith({
        where: {
          roundId_triggerType_recipientEmail: {
            roundId: 'round-1',
            triggerType: 'before_open',
            recipientEmail: 'educator@school.com',
          },
        },
      });

      expect(sgMail.send).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('sends nothing when no rounds are upcoming', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      await scheduledCallback();

      expect(sgMail.send).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('notifies the educator of each school once across multiple schools', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany.mockResolvedValueOnce([
        {
          id: 'round-1',
          name: 'Round One',
          openTime: new Date(Date.now() + 30 * 60 * 1000),
          roundEntrants: [
            {
              entrant: {
                school: {
                  educators: [
                    {
                      user: {
                        email: 'educator@school-a.com',
                      },
                    },
                  ],
                },
              },
            },
            {
              entrant: {
                school: {
                  educators: [
                    {
                      user: {
                        email: 'educator@school-b.com',
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      prisma.notificationLog.findUnique.mockResolvedValue(null);

      await scheduledCallback();

      expect(sgMail.send).toHaveBeenCalledTimes(2);

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'educator@school-a.com',
        })
      );

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'educator@school-b.com',
        })
      );
    });

    it('dispatches for each upcoming round independently', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany.mockResolvedValueOnce([
        {
          id: 'round-1',
          name: 'Round One',
          openTime: new Date(Date.now() + 30 * 60 * 1000),
          roundEntrants: [
            {
              entrant: {
                school: {
                  educators: [
                    {
                      user: {
                        email: 'educator@round-one.com',
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          id: 'round-2',
          name: 'Round Two',
          openTime: new Date(Date.now() + 45 * 60 * 1000),
          roundEntrants: [
            {
              entrant: {
                school: {
                  educators: [
                    {
                      user: {
                        email: 'educator@round-two.com',
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      prisma.notificationLog.findUnique.mockResolvedValue(null);

      await scheduledCallback();

      expect(sgMail.send).toHaveBeenCalledTimes(2);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roundId: 'round-1',
            recipientEmail: 'educator@round-one.com',
          }),
        })
      );

      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roundId: 'round-2',
            recipientEmail: 'educator@round-two.com',
          }),
        })
      );
    });

    it('sends nothing for an upcoming round with no entrants', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany.mockResolvedValueOnce([
        {
          id: 'round-1',
          name: 'Round One',
          openTime: new Date(Date.now() + 30 * 60 * 1000),
          roundEntrants: [],
        },
      ]);

      await scheduledCallback();

      expect(sgMail.send).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });
  });

  describe('before-close reminder emails', () => {
    it('sends one reminder per unique educator for rounds closing within the hour', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'round-1',
            name: 'Round One',
            closeTime: new Date(Date.now() + 30 * 60 * 1000),
            roundEntrants: [
              {
                entrant: {
                  school: {
                    educators: [
                      {
                        user: {
                          email: 'educator@school.com',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await scheduledCallback();

      expect(sgMail.send).toHaveBeenCalledTimes(1);

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Round One closes soon',
        })
      );

      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roundId: 'round-1',
            triggerType: 'before_close',
            recipientEmail: 'educator@school.com',
          }),
        })
      );
    });

    it('queries only open rounds closing within the next hour', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      await scheduledCallback();

      expect(prisma.round.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            state: 'open',
            closeTime: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          },
        })
      );
    });

    it('skips educators who were already notified', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'round-1',
            name: 'Round One',
            closeTime: new Date(Date.now() + 30 * 60 * 1000),
            roundEntrants: [
              {
                entrant: {
                  school: {
                    educators: [
                      {
                        user: {
                          email: 'educator@school.com',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      prisma.notificationLog.findUnique.mockResolvedValue({
        id: 'existing-log',
      });

      await scheduledCallback();

      expect(sgMail.send).not.toHaveBeenCalled();
    });
  });

  describe('results-released notifications', () => {
    it('notifies educators when a closed round has released results', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'round-1',
            name: 'Round One',
            roundEntrants: [
              {
                entrant: {
                  school: {
                    educators: [
                      {
                        user: {
                          email: 'educator@school.com',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ])
        .mockResolvedValueOnce([]);

      await scheduledCallback();

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Results are out for Round One',
        })
      );

      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            triggerType: 'results_released',
            recipientEmail: 'educator@school.com',
          }),
        })
      );
    });

    it('queries closed and released rounds with released results', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      await scheduledCallback();

      expect(prisma.round.findMany).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          where: {
            state: { in: ['closed', 'released'] },
            submissions: { some: { result: { releasedAt: { not: null } } } },
          },
        })
      );
    });
  });

  describe('missing-submission notifications', () => {
    it('notifies educators for entrants who did not submit', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'round-1',
            name: 'Round One',
            roundEntrants: [
              {
                entrant: {
                  id: 'entrant-1',
                  name: 'Alice',
                  school: {
                    educators: [
                      {
                        user: {
                          email: 'educator@school.com',
                        },
                      },
                    ],
                  },
                  submissions: [],
                },
              },
            ],
          },
        ]);

      await scheduledCallback();

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Missing submission for Alice - Round One',
        })
      );

      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            triggerType: 'missing_submission',
            entrantId: 'entrant-1',
            recipientEmail: 'educator@school.com',
          }),
        })
      );
    });

    it('skips entrants who already submitted', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.round.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'round-1',
            name: 'Round One',
            roundEntrants: [
              {
                entrant: {
                  id: 'entrant-1',
                  name: 'Alice',
                  school: {
                    educators: [
                      {
                        user: {
                          email: 'educator@school.com',
                        },
                      },
                    ],
                  },
                  submissions: [
                    {
                      roundId: 'round-1',
                    },
                  ],
                },
              },
            ],
          },
        ]);

      await scheduledCallback();

      expect(sgMail.send).not.toHaveBeenCalled();
    });

    it('queries closed and released rounds', async () => {
      startScheduler();

      prisma.round.updateMany.mockResolvedValue({
        count: 0,
      });

      await scheduledCallback();

      expect(prisma.round.findMany).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ where: { state: { in: ['closed', 'released'] } } })
      );
    });
  });
});
