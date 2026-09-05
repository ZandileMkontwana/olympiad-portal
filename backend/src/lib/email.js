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

//Sends a "round opening soon" notification and logs the attempt
async function sendRoundOpeningNotification({ toEmail, roundId , roundName, opensAt, entrantId }){
  const msg= {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `${roundName} opens soon`,
    text:`${roundName} opens at ${opensAt}. Make sure you're ready to download the paper once it opens.`,
    html: `<p><strong>${roundName}</strong> opens at ${opensAt}. Make sure you're ready to download the paper once it opens.</p>`
  };

  try{
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
  } catch(err){
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

module.exports = { sendSubmissionReceipt, sendRoundOpeningNotification };
