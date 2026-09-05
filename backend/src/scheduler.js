const cron = require('node-cron');
const prisma = require('./lib/prisma');
const { sendRoundOpeningNotification } = require('./lib/email');

const NOTIFY_BEFORE_OPEN_MS = 60 * 60 * 1000; // 1 hour

function startScheduler() {
  cron.schedule('*/30 * * * * *', async () => {
    const now = new Date();

    const opened = await prisma.round.updateMany({
      where: { state: 'scheduled', openTime: { lte: now } },
      data: { state: 'open' },
    });
    if (opened.count > 0) {
      console.log(`Opened ${opened.count} round(s) at ${now.toISOString()}`);
    }

    const closed = await prisma.round.updateMany({
      where: { state: 'open', closeTime: { lte: now } },
      data: { state: 'closed' },
    });
    if (closed.count > 0) {
      console.log(`Closed ${closed.count} round(s) at ${now.toISOString()}`);
    }

    await sendBeforeOpenNotifications(now);
  });
  console.log('Round scheduler started — ticking every 30s');
}

async function sendBeforeOpenNotifications(now) {
  const windowEnd = new Date(now.getTime() + NOTIFY_BEFORE_OPEN_MS);

  const upcomingRounds = await prisma.round.findMany({
    where: {
      state: 'scheduled',
      openTime: { gte: now, lte: windowEnd },
    },
    include: {
      roundEntrants: {
        include: {
          entrant: {
            include: {
              school: {
                include: {
                  educators: { include: { user: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  for (const round of upcomingRounds) {
    const recipientEmails = new Set();

    for (const roundEntrant of round.roundEntrants) {
      for (const educator of roundEntrant.entrant.school.educators) {
        recipientEmails.add(educator.user.email);
      }
    }

    for (const email of recipientEmails) {
      const alreadyNotified = await prisma.notificationLog.findUnique({
        where: {
          roundId_triggerType_recipientEmail: {
            roundId: round.id,
            triggerType: 'before_open',
            recipientEmail: email,
          },
        },
      });

      if (!alreadyNotified) {
        await sendRoundOpeningNotification({
          toEmail: email,
          roundId: round.id,
          roundName: round.name,
          opensAt: round.openTime.toISOString(),
        });
      }
    }
  }
}

module.exports = { startScheduler };
