const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

//POST/auth/signup
router.post('/auth/signup', async(req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'email, password , and role are required' });
    }

    if (!['organiser', 'educator', 'student'].includes(role)) {
        return res.status(400).json({ error: 'role must be organiser, educator, student' });
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


//POST/auth/signin
router.post('/auth/signin', async(req, res) => {
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

module.exports = router;