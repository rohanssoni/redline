import { describe, expect, it } from 'vitest';
import {
  PASSWORD_TOO_LONG,
  passwordProblem,
  signUpProblem,
} from './sign-up-messages';

describe('passwordProblem', () => {
  it('accepts a plain password between 8 and 72 characters', () => {
    expect(passwordProblem('a'.repeat(8))).toBeNull();
    expect(passwordProblem('a'.repeat(72))).toBeNull();
  });

  it('refuses a password under eight characters', () => {
    expect(passwordProblem('a'.repeat(7))).toBe(
      'Use a password of at least eight characters.',
    );
  });

  it('refuses a plain password over 72 characters', () => {
    expect(passwordProblem('a'.repeat(73))).toBe(PASSWORD_TOO_LONG);
  });

  // Supabase counts the limit in bytes. Forty accented letters are 80 bytes,
  // and Supabase refuses them although they are well under 72 characters.
  it('refuses a short password that is over 72 bytes', () => {
    expect(passwordProblem('é'.repeat(40))).toBe(PASSWORD_TOO_LONG);
    expect(passwordProblem('🔒'.repeat(20))).toBe(PASSWORD_TOO_LONG);
  });

  it('accepts accented letters while the total stays within 72 bytes', () => {
    expect(passwordProblem('é'.repeat(36))).toBeNull();
  });
});

describe('signUpProblem', () => {
  it('names the password when Supabase says it is too long', () => {
    expect(signUpProblem('Password cannot be longer than 72 characters')).toBe(
      PASSWORD_TOO_LONG,
    );
  });

  it('keeps the existing answers for a taken address and for rate limits', () => {
    expect(signUpProblem('User already registered')).toMatch(/already an account/);
    expect(signUpProblem('email rate limit exceeded')).toMatch(/Wait a minute/);
  });
});
