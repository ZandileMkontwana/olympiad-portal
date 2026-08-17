const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

//POST/auth/register
router.post('/auth/register', async(req, res) => {
    const { email, password } = req.body;
    const role = 'educator';

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'email, password , and role are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
        data: { email, passwordHash, role }
    });

    const token = jwt.sign({ userId: user.id, role: user.role },
        JWT_SECRET, { expiresIn: '7d' }
    );

    res.status(201).json({
        user: { id: user.id, email: user.email, role: user.role },
        token
    });

});


//POST/auth/login
router.post('/auth/login', async(req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid email or password ' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role },
        JWT_SECRET, { expiresIn: '7d' }
    );

    res.status(200).json({
        user: { id: user.id, email: user.email, role: user.role },
        token
    });
});

//POST /auth/reset-password
router.post('/auth/reset-password', requireAuth, async(req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!passwordMatches) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash }
    });

    res.status(200).json({ message: 'Password updated successfully' });
});

// DELETE /auth/account
router.delete('/auth/account', requireAuth, async(req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id: user.id } });

    res.status(200).json({ message: 'Account deleted successfully' });
});

module.exports = router;