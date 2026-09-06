import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const sgMail = require('@sendgrid/mail');
const prisma = require('./prisma');
const {
  sendSubmissionReceipt,
  sendRoundOpeningNotification,
  sendRoundClosingNotification,
  sendResultsReleasedNotification,
  sendMissingSubmissionNotification,
} = require('./email');

describe('sendSubmissionReceipt', () => {
  beforeEach(() => {
    vi.spyOn(sgMail, 'send');
    process.env.SENDGRID_API_KEY = 'test-key';
    process.env.SENDGRID_FROM_EMAIL = 'from@test.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends email with correct content', async () => {
    sgMail.send.mockResolvedValue({});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await sendSubmissionReceipt({
      toEmail: 'to@test.com',
      entrantName: 'Alice',
      roundName: 'Round 1',
      submittedAt: '2026-01-01T00:00:00Z',
    });

    expect(sgMail.send).toHaveBeenCalledWith({
      to: 'to@test.com',
      from: 'from@test.com',
      subject: 'Submission Receipt - Round 1',
      text: expect.stringContaining('Alice'),
      html: expect.stringContaining('Alice'),
    });
    logSpy.mockRestore();
  });

  it('includes round name in subject', async () => {
    sgMail.send.mockResolvedValue({});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await sendSubmissionReceipt({
      toEmail: 'to@test.com',
      entrantName: 'Bob',
      roundName: 'Final Round',
      submittedAt: '2026-01-01',
    });

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Submission Receipt - Final Round',
      })
    );
    logSpy.mockRestore();
  });

  it('catches and logs errors without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sgMail.send.mockRejectedValue(new Error('SendGrid failed'));

    await expect(
      sendSubmissionReceipt({
        toEmail: 'to@test.com',
        entrantName: 'Alice',
        roundName: 'Round 1',
        submittedAt: '2026-01-01',
      })
    ).resolves.not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith('Failed to send email:', 'SendGrid failed');
  });

  it('logs success message after sending', async () => {
    sgMail.send.mockResolvedValue({});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await sendSubmissionReceipt({
      toEmail: 'to@test.com',
      entrantName: 'Alice',
      roundName: 'Round 1',
      submittedAt: '2026-01-01',
    });

    expect(logSpy).toHaveBeenCalledWith('Receipt email sent to to@test.com');
  });
});

// Shared setup for notification templates that log to NotificationLog.
function withNotificationLogMocks() {
  beforeEach(() => {
    vi.spyOn(sgMail, 'send').mockResolvedValue({});
    vi.spyOn(prisma.notificationLog, 'create').mockResolvedValue({ id: 'log-1' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.SENDGRID_FROM_EMAIL = 'from@test.com';
  });
  afterEach(() => vi.restoreAllMocks());
}

describe('sendRoundOpeningNotification', () => {
  withNotificationLogMocks();

  it('renders subject and body with the round name and opening time', async () => {
    await sendRoundOpeningNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      opensAt: '2026-01-01T10:00:00.000Z',
    });

    expect(sgMail.send).toHaveBeenCalledWith({
      to: 'educator@school.com',
      from: 'from@test.com',
      subject: 'Round One opens soon',
      text: expect.stringContaining('Round One opens at 2026-01-01T10:00:00.000Z'),
      html: expect.stringContaining('<strong>Round One</strong> opens at 2026-01-01T10:00:00.000Z'),
    });
  });

  it('includes the download-the-paper prompt in the body', async () => {
    await sendRoundOpeningNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      opensAt: '2026-01-01T10:00:00.000Z',
    });

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('ready to download the paper once it opens'),
      })
    );
  });

  it('logs a sent attempt with triggerType before_open', async () => {
    await sendRoundOpeningNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      opensAt: '2026-01-01T10:00:00.000Z',
      entrantId: 'entrant-1',
    });

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        entrantId: 'entrant-1',
        triggerType: 'before_open',
        recipientEmail: 'educator@school.com',
        status: 'sent',
      },
    });
  });

  it('stores a null entrantId when no entrant is provided', async () => {
    await sendRoundOpeningNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      opensAt: '2026-01-01T10:00:00.000Z',
    });

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entrantId: null }),
      })
    );
  });

  it('logs a failed attempt without throwing when SendGrid rejects', async () => {
    sgMail.send.mockRejectedValue(new Error('SendGrid down'));

    await expect(
      sendRoundOpeningNotification({
        toEmail: 'educator@school.com',
        roundId: 'round-1',
        roundName: 'Round One',
        opensAt: '2026-01-01T10:00:00.000Z',
      })
    ).resolves.not.toThrow();

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        entrantId: null,
        triggerType: 'before_open',
        recipientEmail: 'educator@school.com',
        status: 'failed',
        error: 'SendGrid down',
      },
    });
  });
});

describe('sendRoundClosingNotification', () => {
  withNotificationLogMocks();

  it('renders subject and body with round name and closing time', async () => {
    await sendRoundClosingNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      closesAt: '2026-02-01T16:00:00.000Z',
    });

    expect(sgMail.send).toHaveBeenCalledWith({
      to: 'educator@school.com',
      from: 'from@test.com',
      subject: 'Round One closes soon',
      text: expect.stringContaining('Round One closes at 2026-02-01T16:00:00.000Z'),
      html: expect.stringContaining('<strong>Round One</strong> closes at 2026-02-01T16:00:00.000Z'),
    });
  });

  it('includes the submission-in prompt in the body', async () => {
    await sendRoundClosingNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      closesAt: '2026-02-01T16:00:00.000Z',
    });

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('submission is in before then') })
    );
  });

  it('logs a sent attempt with triggerType before_close', async () => {
    await sendRoundClosingNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      closesAt: '2026-02-01T16:00:00.000Z',
      entrantId: 'entrant-2',
    });

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        entrantId: 'entrant-2',
        triggerType: 'before_close',
        recipientEmail: 'educator@school.com',
        status: 'sent',
      },
    });
  });

  it('stores a null entrantId when no entrant is provided', async () => {
    await sendRoundClosingNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      closesAt: '2026-02-01T16:00:00.000Z',
    });

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entrantId: null }) })
    );
  });

  it('logs a failed attempt without throwing when SendGrid rejects', async () => {
    sgMail.send.mockRejectedValue(new Error('SendGrid down'));

    await expect(
      sendRoundClosingNotification({
        toEmail: 'educator@school.com',
        roundId: 'round-1',
        roundName: 'Round One',
        closesAt: '2026-02-01T16:00:00.000Z',
      })
    ).resolves.not.toThrow();

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        entrantId: null,
        triggerType: 'before_close',
        recipientEmail: 'educator@school.com',
        status: 'failed',
        error: 'SendGrid down',
      },
    });
  });
});

describe('sendMissingSubmissionNotification', () => {
  withNotificationLogMocks();

  it('renders subject and body with round name and entrant name', async () => {
    await sendMissingSubmissionNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      entrantName: 'Alice',
      entrantId: 'entrant-1',
    });

    expect(sgMail.send).toHaveBeenCalledWith({
      to: 'educator@school.com',
      from: 'from@test.com',
      subject: 'Missing submission for Alice - Round One',
      text: expect.stringContaining('no submission was received for Alice'),
      html: expect.stringContaining('<strong>Alice</strong>'),
    });
  });

  it('states the round has closed', async () => {
    await sendMissingSubmissionNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      entrantName: 'Alice',
      entrantId: 'entrant-1',
    });

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('has closed') })
    );
  });

  it('logs a sent attempt with triggerType missing_submission', async () => {
    await sendMissingSubmissionNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      entrantName: 'Alice',
      entrantId: 'entrant-1',
    });

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        entrantId: 'entrant-1',
        triggerType: 'missing_submission',
        recipientEmail: 'educator@school.com',
        status: 'sent',
      },
    });
  });

  it('passes the entrantId through to the log', async () => {
    await sendMissingSubmissionNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      entrantName: 'Bob',
      entrantId: 'entrant-99',
    });

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entrantId: 'entrant-99' }) })
    );
  });

  it('logs a failed attempt without throwing when SendGrid rejects', async () => {
    sgMail.send.mockRejectedValue(new Error('SendGrid down'));

    await expect(
      sendMissingSubmissionNotification({
        toEmail: 'educator@school.com',
        roundId: 'round-1',
        roundName: 'Round One',
        entrantName: 'Alice',
        entrantId: 'entrant-1',
      })
    ).resolves.not.toThrow();

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        entrantId: 'entrant-1',
        triggerType: 'missing_submission',
        recipientEmail: 'educator@school.com',
        status: 'failed',
        error: 'SendGrid down',
      },
    });
  });
});

describe('sendResultsReleasedNotification', () => {
  withNotificationLogMocks();

  it('renders subject and body with round name', async () => {
    await sendResultsReleasedNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
    });

    expect(sgMail.send).toHaveBeenCalledWith({
      to: 'educator@school.com',
      from: 'from@test.com',
      subject: 'Results are out for Round One',
      text: expect.stringContaining('Results for Round One have been released'),
      html: expect.stringContaining('<strong>Round One</strong>'),
    });
  });

  it('prompts the recipient to log in to view results', async () => {
    await sendResultsReleasedNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
    });

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Log in to view them') })
    );
  });

  it('logs a sent attempt with triggerType results_released', async () => {
    await sendResultsReleasedNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
      entrantId: 'entrant-3',
    });

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        entrantId: 'entrant-3',
        triggerType: 'results_released',
        recipientEmail: 'educator@school.com',
        status: 'sent',
      },
    });
  });

  it('stores a null entrantId when no entrant is provided', async () => {
    await sendResultsReleasedNotification({
      toEmail: 'educator@school.com',
      roundId: 'round-1',
      roundName: 'Round One',
    });

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entrantId: null }) })
    );
  });

  it('logs a failed attempt without throwing when SendGrid rejects', async () => {
    sgMail.send.mockRejectedValue(new Error('SendGrid down'));

    await expect(
      sendResultsReleasedNotification({
        toEmail: 'educator@school.com',
        roundId: 'round-1',
        roundName: 'Round One',
      })
    ).resolves.not.toThrow();

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        entrantId: null,
        triggerType: 'results_released',
        recipientEmail: 'educator@school.com',
        status: 'failed',
        error: 'SendGrid down',
      },
    });
  });
});
