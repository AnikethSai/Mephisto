import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { ParticipantSessionPayload, OrganizerSessionPayload } from './types';

export const ORGANIZER_COOKIE_NAME = 'mb_organizer_session';
export const PARTICIPANT_COOKIE_NAME = 'mb_participant_session';

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'dev_secret_mephistos_bargain_festival_2026_fallback';
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);

// -------------------------------------------------------------
// Password & PIN Hashing
// -------------------------------------------------------------

export async function hashSecret(secret: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(secret, salt);
}

export async function verifySecret(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// -------------------------------------------------------------
// JWT Token Generation & Verification (jose)
// -------------------------------------------------------------

export async function createOrganizerToken(payload: OrganizerSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifyOrganizerToken(token: string): Promise<OrganizerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'ORGANIZER') return null;
    return payload as unknown as OrganizerSessionPayload;
  } catch {
    return null;
  }
}

export async function createParticipantToken(payload: ParticipantSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifyParticipantToken(token: string): Promise<ParticipantSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.teamId) return null;
    return payload as unknown as ParticipantSessionPayload;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Server / API Route Context Helpers
// -------------------------------------------------------------

export async function getAuthenticatedOrganizer(
  req?: NextRequest
): Promise<OrganizerSessionPayload | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(ORGANIZER_COOKIE_NAME)?.value;
    const authHeader = req.headers.get('authorization');
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(ORGANIZER_COOKIE_NAME)?.value;
  }

  if (!token) return null;
  return verifyOrganizerToken(token);
}

export async function getAuthenticatedParticipant(
  req?: NextRequest
): Promise<ParticipantSessionPayload | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(PARTICIPANT_COOKIE_NAME)?.value;
    const authHeader = req.headers.get('authorization');
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(PARTICIPANT_COOKIE_NAME)?.value;
  }

  if (!token) return null;
  return verifyParticipantToken(token);
}
