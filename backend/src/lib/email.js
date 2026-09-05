const sgMail = require('@sendgrid/mail');
const prisma = require('./prisma');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendSubmissionReceipt({ toEmail, entrantName, roundName, submittedAt }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `Submission Receipt - ${roundName}`,
    text: `Your submission for ${entrantName} in ${roundName} was received at ${submittedAt}.`,
    html: `<p>Your submission for <strong>${entrantName}</strong> in <strong>${roundName}</strong> was received at ${submittedAt}.</p>`,
  };

  try {
    await sgMail.send(msg);
    console.log(`Receipt email sent to ${toEmail}`);
  } catch (err) {
    console.error('Failed to send email:', err.message);
  }
}

// Sends a "round closing soon" notification and logs the attempt.
async function sendRoundClosingNotification({ toEmail, roundId, roundName, closesAt, entrantId }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `${roundName} closes soon`,
    text: `${roundName} closes at ${closesAt}. Make sure your submission is in before then.`,
    html: `<p><strong>${roundName}</strong> closes at ${closesAt}. Make sure your submission is in before then.</p>`,
  };

  try {
    await sgMail.send(msg);
    await prisma.notificationLog.create({
      data: {
        roundId,
        entrantId: entrantId || null,
        triggerType: 'before_close',
        recipientEmail: toEmail,
        status: 'sent',
      },
    });
    console.log(`Round closing notification sent to ${toEmail}`);
  } catch (err) {
    console.error('Failed to send round closing notification:', err.message);
    await prisma.notificationLog.create({
      data: {
        roundId,
        entrantId: entrantId || null,
        triggerType: 'before_close',
        recipientEmail: toEmail,
        status: 'failed',
        error: err.message,
      },
    });
  }
}

// Sends a "results released" notification and logs the attempt.
async function sendResultsReleasedNotification({ toEmail, roundId, roundName, entrantId }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `Results are out for ${roundName}`,
    text: `Results for ${roundName} have been released. Log in to view them.`,
    html: `<p>Results for <strong>${roundName}</strong> have been released. Log in to view them.</p>`,
  };

  try {
    await sgMail.send(msg);
    await prisma.notificationLog.create({
      data: {
        roundId,
        entrantId: entrantId || null,
        triggerType: 'results_released',
        recipientEmail: toEmail,
        status: 'sent',
      },
    });
    console.log(`Results released notification sent to ${toEmail}`);
  } catch (err) {
    console.error('Failed to send results released notification:', err.message);
    await prisma.notificationLog.create({
      data: {
        roundId,
        entrantId: entrantId || null,
        triggerType: 'results_released',
        recipientEmail: toEmail,
        status: 'failed',
        error: err.message,
      },
    });
  }
}

// Sends a "missing submission" notification and logs the attempt.
async function sendMissingSubmissionNotification({ toEmail, roundId, roundName, entrantName, entrantId }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `Missing submission for ${entrantName} - ${roundName}`,
    text: `${roundName} has closed and no submission was received for ${entrantName}.`,
    html: `<p><strong>${roundName}</strong> has closed and no submission was received for <strong>${entrantName}</strong>.</p>`,
  };

  try {
    await sgMail.send(msg);
    await prisma.notificationLog.create({
      data: { roundId, entrantId, triggerType: 'missing_submission', recipientEmail: toEmail, status: 'sent' },
    });
    console.log(`Missing submission notification sent to ${toEmail}`);
  } catch (err) {
    console.error('Failed to send missing submission notification:', err.message);
    await prisma.notificationLog.create({
      data: { roundId, entrantId, triggerType: 'missing_submission', recipientEmail: toEmail, status: 'failed', error: err.message },
    });
  }
}


module.exports = {
  sendSubmissionReceipt,
  sendRoundClosingNotification,
  sendResultsReleasedNotification,
  sendMissingSubmissionNotification,
};
