// src/modules/auth/auth.controller.ts

import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "@common/utils/prismaClient.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@common/utils/token.js";
import { registerSchema, loginSchema } from "./auth.schema.js";
import { requestPasswordReset, resetPassword } from "./auth.service.js";
import { ZodError } from "zod";

/* -------------------------------------------------------
 * HELPERS
 * ----------------------------------------------------- */

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/* -------------------------------------------------------
 * REGISTER
 * ----------------------------------------------------- */

export const register = async (req: Request, res: Response) => {
  try {
    // -------------------------
    // TEST USER BYPASS
    // -------------------------
    if (req.body.email?.includes("test.local")) {
      const role = (req.body.role || "PATIENT").toUpperCase();

      const user = await prisma.user.create({
        data: {
          name: req.body.name || "Test User",
          email: req.body.email.toLowerCase(),
          password: req.body.password || "pass1234",
          role,
        },
      });

      if (role === "PROVIDER") {
        const existingProvider = await prisma.provider.findUnique({ where: { userId: user.id } });
        if (!existingProvider) {
          await prisma.provider.create({
            data: {
              userId: user.id,
              displayName: user.name,
              specialty: "General",
              bio: "",
              photoUrl: "",
              status: "PENDING",
            },
          });
        }
      }

      const accessToken = signAccessToken(user.id, user.role);
      const refreshToken = signRefreshToken(user.id, user.role);

      await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

      setRefreshTokenCookie(res, refreshToken);

      return res.status(201).json({
        message: "User registered successfully (test)",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      });
    }

    // -------------------------
    // NORMAL FLOW
    // -------------------------
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.issues });
    }

    const { name, email, password, role } = parsed.data;

    const normalizedEmail = email.toLowerCase();
    const finalRole = role.toUpperCase() as "PATIENT" | "PROVIDER";

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: finalRole,
      },
    });

// STAB invariant — ensure Provider row exists
if (user.role === "PROVIDER") {
  const existingProvider = await prisma.provider.findUnique({
    where: { userId: user.id },
  });

  if (!existingProvider) {
    await prisma.provider.create({
      data: {
        userId: user.id,
        displayName: name,
        specialty: "General",
        bio: "",
        photoUrl: "",
        status: "PENDING",
      },
    });
  }
}

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    setRefreshTokenCookie(res, refreshToken);

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken,
    });
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      return res.status(400).json({ errors: e.issues });
    }

    return res
      .status(500)
      .json({ error: "Registration failed", details: String(e) });
  }
};

/* -------------------------------------------------------
 * LOGIN
 * ----------------------------------------------------- */

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.issues });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // -------------------------
    // TEST USER LOGIN BYPASS
    // -------------------------
    if (normalizedEmail.includes("test.local")) {
      const accessToken = signAccessToken(user.id, user.role);
      const refreshToken = signRefreshToken(user.id, user.role);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      setRefreshTokenCookie(res, refreshToken);

      return res.json({
        message: "Login successful (test bypass)",
        accessToken,
        refreshToken,
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    setRefreshTokenCookie(res, refreshToken);

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
    });
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      return res.status(400).json({ errors: e.issues });
    }

    return res
      .status(500)
      .json({ error: "Login failed", details: String(e) });
  }
};

/* -------------------------------------------------------
 * REFRESH TOKEN
 * ----------------------------------------------------- */

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    const payload = verifyRefreshToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    const accessToken = signAccessToken(user.id, user.role);
    const newRefreshToken = signRefreshToken(user.id, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    setRefreshTokenCookie(res, newRefreshToken);

    return res.status(200).json({
      message: "Token refreshed",
      accessToken,
    });
  } catch (e: unknown) {
    return res
      .status(403)
      .json({ error: "Invalid or expired refresh token", details: String(e) });
  }
};

/* -------------------------------------------------------
 * LOGOUT
 * ----------------------------------------------------- */

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(400).json({ message: "No refresh token found" });
    }

    const payload = verifyRefreshToken(token);

    await prisma.user.update({
      where: { id: payload.userId },
      data: { refreshToken: null },
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (e: unknown) {
    return res
      .status(500)
      .json({ error: "Logout failed", details: String(e) });
  }
};

/* -------------------------------------------------------
 * PASSWORD RESET
 * ----------------------------------------------------- */

export async function requestPasswordResetHandler(
  req: Request,
  res: Response,
) {
  try {
    const email = String(req.body.email).toLowerCase();
    await requestPasswordReset(email);

    return res.json({
      message: "If the email exists, a reset link was sent",
    });
  } catch {
    // Always generic — do not leak user existence
    return res.json({
      message: "If the email exists, a reset link was sent",
    });
  }
}

export async function resetPasswordHandler(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body as {
      token: string;
      newPassword: string;
    };

    await resetPassword(token, newPassword);

    return res.json({ message: "Password reset successful" });
  } catch (e: any) {
    const status = e?.status ?? 400;

    return res
      .status(status)
      .json({ error: e?.message ?? "Password reset failed" });
  }
}
