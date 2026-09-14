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

// Message template for the "round opening soon" notification. Kept separate
// from the send + log logic so the dry-run route can preview the exact
// email the scheduler would send.
function buildRoundOpeningMessage({ roundName, opensAt }) {
  return {
    subject: `${roundName} opens soon`,
    text: `${roundName} opens at ${opensAt}. Make sure you're ready to download the paper once it opens.`,
    html: `<p><strong>${roundName}</strong> opens at ${opensAt}. Make sure you're ready to download the paper once it opens.</p>`,
  };
}

// Sends a "round opening soon" notification and logs the attempt.
async function sendRoundOpeningNotification({ toEmail, roundId, roundName, opensAt, entrantId }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    ...buildRoundOpeningMessage({ roundName, opensAt }),
  };

  try {
    await sgMail.send(msg);
    await prisma.notificationLog.create({
      data: {
        roundId,
        entrantId: entrantId || null,
        triggerType: 'before_open',
        recipientEmail: toEmail,
        status: 'sent',
      },
    });
    console.log(`Round opening notification sent to ${toEmail}`);
  } catch (err) {
    console.error('Failed to send round opening notification:', err.message);
    await prisma.notificationLog.create({
      data: {
        roundId,
        entrantId: entrantId || null,
        triggerType: 'before_open',
        recipientEmail: toEmail,
        status: 'failed',
        error: err.message,
      },
    });
  }
}

// Message template for the "round closing soon" notification. Kept separate
// from the send + log logic so the dry-run route can preview the exact
// email the scheduler would send.
function buildRoundClosingMessage({ roundName, closesAt }) {
  return {
    subject: `${roundName} closes soon`,
    text: `${roundName} closes at ${closesAt}. Make sure your submission is in before then.`,
    html: `<p><strong>${roundName}</strong> closes at ${closesAt}. Make sure your submission is in before then.</p>`,
  };
}

// Sends a "round closing soon" notification and logs the attempt.
async function sendRoundClosingNotification({ toEmail, roundId, roundName, closesAt, entrantId }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    ...buildRoundClosingMessage({ roundName, closesAt }),
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

// Message template for the "results released" notification. Kept separate
// from the send + log logic so the dry-run route can preview the exact
// email the scheduler would send.
function buildResultsReleasedMessage({ roundName }) {
  return {
    subject: `Results are out for ${roundName}`,
    text: `Results for ${roundName} have been released. Log in to view them.`,
    html: `<p>Results for <strong>${roundName}</strong> have been released. Log in to view them.</p>`,
  };
}

// Sends a "results released" notification and logs the attempt.
async function sendResultsReleasedNotification({ toEmail, roundId, roundName, entrantId }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    ...buildResultsReleasedMessage({ roundName }),
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

// Message template for the "missing submission" notification. Kept separate
// from the send + log logic so the dry-run route can preview the exact
// email the scheduler would send.
function buildMissingSubmissionMessage({ roundName, entrantName }) {
  return {
    subject: `Missing submission for ${entrantName} - ${roundName}`,
    text: `${roundName} has closed and no submission was received for ${entrantName}.`,
    html: `<p><strong>${roundName}</strong> has closed and no submission was received for <strong>${entrantName}</strong>.</p>`,
  };
}

// Sends a "missing submission" notification and logs the attempt.
async function sendMissingSubmissionNotification({ toEmail, roundId, roundName, entrantName, entrantId }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    ...buildMissingSubmissionMessage({ roundName, entrantName }),
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

// Sends a student their invitation to set a password and activate the
// account their educator created. Unlike the round notifications this is
// not round-scoped, so nothing is logged to NotificationLog; the caller
// uses the return value to report whether the invitation went out.
async function sendStudentInvitation({ toEmail, studentName, schoolName, invitationUrl }) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Set up your Olympiad Portal account',
    text:
      `Hi ${studentName},\n\n` +
      `Your educator at ${schoolName} has registered you for the Olympiad Portal.\n` +
      `Set a password to activate your account:\n\n${invitationUrl}\n\n` +
      `This link expires in 48 hours — after that, ask your educator to resend the invitation.\n\n` +
      `If you were not expecting this email, you can ignore it.`,
    html:
      `<p>Hi <strong>${studentName}</strong>,</p>` +
      `<p>Your educator at <strong>${schoolName}</strong> has registered you for the Olympiad Portal. ` +
      `Set a password to activate your account:</p>` +
      `<p><a href="${invitationUrl}">Set my password</a></p>` +
      `<p>This link expires in 48 hours — after that, ask your educator to resend the invitation.</p>` +
      `<p>If you were not expecting this email, you can ignore it.</p>`,
  };

  try {
    await sgMail.send(msg);
    console.log(`Student invitation sent to ${toEmail}`);
    return true;
  } catch (err) {
    console.error('Failed to send student invitation:', err.message);
    return false;
  }
}

module.exports = {
  sendSubmissionReceipt,
  sendRoundOpeningNotification,
  sendRoundClosingNotification,
  sendResultsReleasedNotification,
  sendMissingSubmissionNotification,
  sendStudentInvitation,
  buildRoundOpeningMessage,
  buildRoundClosingMessage,
  buildResultsReleasedMessage,
  buildMissingSubmissionMessage,
};
