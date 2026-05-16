import { hash, verify } from '@node-rs/bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';

const textEncoder = new TextEncoder();

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return verify(password, passwordHash);
}

export async function signAccessToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(textEncoder.encode(secret));
}

export async function signRefreshToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(textEncoder.encode(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, textEncoder.encode(secret));
  return { sub: payload.sub as string };
}

export function hashRefreshToken(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}
