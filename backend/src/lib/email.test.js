import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const sgMail = require('@sendgrid/mail');
const { sendSubmissionReceipt } = require('./email');

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
