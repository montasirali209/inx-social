const { z } = require('zod');
const prisma = require('../db/prisma');
const env = require('../config/env');
const { hashPassword, comparePassword, signToken } = require('../utils/auth');
const { createToken, hashToken } = require('../utils/secureTokens');
const emailService = require('../services/emailService');

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  businessName: z.string().max(120).optional().or(z.literal('')),
  email: z.string().email(),
  password: z.string().min(8),
  marketingOptIn: z.boolean().optional().default(false),
  acceptedTerms: z.literal(true)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

async function issueVerification(user) {
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id, usedAt: null }
  });

  const token = createToken();

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: token.hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });

  try {
    await emailService.sendVerification(user, token.raw);
    return { raw: token.raw, emailSent: true, emailError: null };
  } catch (error) {
    console.error('[VERIFY EMAIL DELIVERY FAILED]', error.message);
    return { raw: token.raw, emailSent: false, emailError: error.message };
  }
}

function verificationResponse(user, verification, options = {}) {
  const isDevelopment = env.nodeEnv !== 'production';

  return {
    requiresVerification: true,
    email: user.email,
    accountReused: Boolean(options.accountReused),
    emailSent: verification.emailSent,
    message: verification.emailSent
      ? 'Account saved. Check your email to verify your account.'
      : 'Your account was saved, but the verification email could not be delivered. Correct the SMTP settings and use Resend verification.',
    ...(isDevelopment && verification.emailError
      ? { emailDeliveryError: verification.emailError }
      : {})
  };
}

async function register(req, res, next) {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.trim().toLowerCase();

    let user = await prisma.user.findUnique({ where: { email } });

    if (user && user.emailVerifiedAt) {
      return res.status(409).json({
        error: 'This email is already registered. Sign in or reset your password.'
      });
    }

    if (user && !user.emailVerifiedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: input.name.trim(),
          businessName: input.businessName?.trim() || null,
          passwordHash: await hashPassword(input.password),
          status: 'PENDING_VERIFICATION',
          marketingOptIn: input.marketingOptIn,
          marketingOptInAt: input.marketingOptIn ? (user.marketingOptInAt || new Date()) : null
        }
      });

      const verification = await issueVerification(user);
      return res.status(200).json(
        verificationResponse(user, verification, { accountReused: true })
      );
    }

    user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        businessName: input.businessName?.trim() || null,
        email,
        passwordHash: await hashPassword(input.password),
        status: 'PENDING_VERIFICATION',
        marketingOptIn: input.marketingOptIn,
        marketingOptInAt: input.marketingOptIn ? new Date() : null
      }
    });

    const verification = await issueVerification(user);
    return res.status(verification.emailSent ? 201 : 202).json(
      verificationResponse(user, verification)
    );
  } catch (error) {
    next(error);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const input = z.object({ token: z.string().min(20) }).parse(req.body);
    const found = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
      include: { user: true }
    });

    if (!found || found.usedAt || found.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Verification link is invalid or expired' });
    }

    const trialEndsAt = new Date(Date.now() + env.defaultTrialDays * 86400000);

    const user = await prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: found.id },
        data: { usedAt: new Date() }
      });

      const updatedUser = await tx.user.update({
        where: { id: found.userId },
        data: {
          emailVerifiedAt: new Date(),
          status: 'TRIAL',
          trialEndsAt
        }
      });

      const currentSubscription = await tx.subscription.findFirst({
        where: { userId: updatedUser.id }
      });

      if (!currentSubscription) {
        await tx.subscription.create({
          data: {
            userId: updatedUser.id,
            plan: 'TRIAL',
            status: 'TRIALING',
            provider: 'internal',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt
          }
        });
      }

      return updatedUser;
    });

    try {
      await emailService.sendTrialStarted(user);
    } catch (error) {
      console.error('[TRIAL EMAIL DELIVERY FAILED]', error.message);
    }

    res.json({
      verified: true,
      message: 'Email verified. Your 5-day trial has started.'
    });
  } catch (error) {
    next(error);
  }
}

async function resendVerification(req, res, next) {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user || user.emailVerifiedAt) {
      return res.json({
        message: 'If the account exists and is unverified, a new verification link has been created.'
      });
    }

    const verification = await issueVerification(user);

    res.status(verification.emailSent ? 200 : 202).json({
      message: verification.emailSent
        ? 'A new verification email has been sent.'
        : 'A new verification link was created, but email delivery failed. Correct the SMTP settings and try again.',
      emailSent: verification.emailSent,
      ...(env.nodeEnv !== 'production' && verification.emailError
        ? { emailDeliveryError: verification.emailError }
        : {})
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.emailVerifiedAt && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email
      });
    }

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    let devToken;
    let emailSent = false;

    if (user) {
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null }
      });

      const token = createToken();
      devToken = token.raw;

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: token.hash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        }
      });

      try {
        await emailService.sendPasswordReset(user, token.raw);
        emailSent = true;
      } catch (error) {
        console.error('[PASSWORD RESET EMAIL DELIVERY FAILED]', error.message);
      }
    }

    res.json({
      message: 'If the email is registered, a password reset link has been created.',
      emailSent,
      ...(env.nodeEnv !== 'production' && devToken
        ? { devResetToken: devToken }
        : {})
    });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const input = z.object({
      token: z.string().min(20),
      password: z.string().min(8)
    }).parse(req.body);

    const found = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) }
    });

    if (!found || found.usedAt || found.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset link is invalid or expired' });
    }

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: found.id },
        data: { usedAt: new Date() }
      }),
      prisma.user.update({
        where: { id: found.userId },
        data: { passwordHash: await hashPassword(input.password) }
      })
    ]);

    res.json({ message: 'Password updated. You can now sign in.' });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  res.json({ user: sanitizeUser(req.user) });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    businessName: user.businessName,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    marketingOptIn: user.marketingOptIn,
    trialEndsAt: user.trialEndsAt,
    createdAt: user.createdAt
  };
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  me
};
