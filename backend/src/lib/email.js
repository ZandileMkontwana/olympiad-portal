const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendSubmissionReceipt({ toEmail, entrantName, roundName, submittedAt }) {
    const msg = {
        to: toEmail,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: `Submission Receipt - ${roundName}`,
        text: `Your submission for ${entrantName} in ${roundName} was received at ${submittedAt}.`,
        html: `<p>Your submission for <strong>${entrantName}</strong> in <strong>${roundName}</strong> was received at ${submittedAt}.</p>`
    };

    try {
        await sgMail.send(msg);
        console.log(`Receipt email sent to ${toEmail}`);
    } catch (err) {
        console.error('Failed to send email:', err.message);
    }
}

module.exports = { sendSubmissionReceipt };