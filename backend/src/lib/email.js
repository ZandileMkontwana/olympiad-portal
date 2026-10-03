const sgMail = require('@sendgrid/mail');
const prisma = require('./prisma');
const { brandEmailHtml, ctaButton, frontendUrl, formatDateTime } = require('./emailTemplates');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Branded sender identity — read at call time so tests that set the env var
// after this module is required still take effect.
function brandedFrom() {
  return { email: process.env.SENDGRID_FROM_EMAIL, name: 'Olympiad Portal' };
}

async function sendSubmissionReceipt({ toEmail, entrantName, roundName, submittedAt }) {
  const receivedAt = formatDateTime(submittedAt);
  const msg = {
    to: toEmail,
    from: brandedFrom(),
    subject: `Submission Receipt - ${roundName}`,
    text: `Your submission for ${entrantName} in ${roundName} was received at ${receivedAt}.`,
    html: brandEmailHtml({
      heading: 'Submission received',
      bodyHtml: `<p style="margin:0 0 10px;">Your submission for <strong>${entrantName}</strong> in <strong>${roundName}</strong> was received at ${receivedAt}.</p>`,
    }),
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
  const opens = formatDateTime(opensAt);
  return {
    subject: `${roundName} opens soon`,
    text: `${roundName} opens at ${opens}. Make sure you're ready to download the paper once it opens.`,
    html: brandEmailHtml({
      heading: 'A round is opening soon',
      bodyHtml: `<p style="margin:0 0 10px;"><strong>${roundName}</strong> opens at ${opens}. Make sure you're ready to download the paper once it opens.</p>`,
    }),
  };
}

// Sends a "round opening soon" notification and logs the attempt.
async function sendRoundOpeningNotification({ toEmail, roundId, roundName, opensAt, entrantId }) {
  const msg = {
    to: toEmail,
    from: brandedFrom(),
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
  const closes = formatDateTime(closesAt);
  return {
    subject: `${roundName} closes soon`,
    text: `${roundName} closes at ${closes}. Make sure your submission is in before then.`,
    html: brandEmailHtml({
      heading: 'A round is closing soon',
      bodyHtml: `<p style="margin:0 0 10px;"><strong>${roundName}</strong> closes at ${closes}. Make sure your submission is in before then.</p>`,
    }),
  };
}

// Sends a "round closing soon" notification and logs the attempt.
async function sendRoundClosingNotification({ toEmail, roundId, roundName, closesAt, entrantId }) {
  const msg = {
    to: toEmail,
    from: brandedFrom(),
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
    html: brandEmailHtml({
      heading: 'Results released',
      bodyHtml: `<p style="margin:0 0 10px;">Results for <strong>${roundName}</strong> have been released. Log in to view them.</p>`,
      cta: frontendUrl('/login') ? ctaButton('View results', frontendUrl('/login')) : undefined,
    }),
  };
}

// Sends a "results released" notification and logs the attempt.
async function sendResultsReleasedNotification({ toEmail, roundId, roundName, entrantId }) {
  const msg = {
    to: toEmail,
    from: brandedFrom(),
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
    html: brandEmailHtml({
      heading: 'Missing submission',
      bodyHtml: `<p style="margin:0 0 10px;"><strong>${roundName}</strong> has closed and no submission was received for <strong>${entrantName}</strong>.</p>`,
    }),
  };
}

// Sends a "missing submission" notification and logs the attempt.
async function sendMissingSubmissionNotification({
  toEmail,
  roundId,
  roundName,
  entrantName,
  entrantId,
}) {
  const msg = {
    to: toEmail,
    from: brandedFrom(),
    ...buildMissingSubmissionMessage({ roundName, entrantName }),
  };

  try {
    await sgMail.send(msg);
    await prisma.notificationLog.create({
      data: {
        roundId,
        entrantId,
        triggerType: 'missing_submission',
        recipientEmail: toEmail,
        status: 'sent',
      },
    });
    console.log(`Missing submission notification sent to ${toEmail}`);
  } catch (err) {
    console.error('Failed to send missing submission notification:', err.message);
    await prisma.notificationLog.create({
      data: {
        roundId,
        entrantId,
        triggerType: 'missing_submission',
        recipientEmail: toEmail,
        status: 'failed',
        error: err.message,
      },
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
    from: brandedFrom(),
    subject: 'Set up your Olympiad Portal account',
    text:
      `Hi ${studentName},\n\n` +
      `Your educator at ${schoolName} has registered you for the Olympiad Portal.\n` +
      `Set a password to activate your account:\n\n${invitationUrl}\n\n` +
      `This link expires in 48 hours — after that, ask your educator to resend the invitation.\n\n` +
      `If you were not expecting this email, you can ignore it.`,
    html: brandEmailHtml({
      heading: 'Activate your account',
      bodyHtml:
        `<p style="margin:0 0 10px;">Hi <strong>${studentName}</strong>,</p>` +
        `<p style="margin:0 0 10px;">Your educator at <strong>${schoolName}</strong> has registered you for the Olympiad Portal. Set a password to activate your account:</p>` +
        `<p style="margin:0;">This link expires in 48 hours — after that, ask your educator to resend the invitation. If you were not expecting this email, you can ignore it.</p>`,
      cta: ctaButton('Set my password', invitationUrl),
    }),
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
