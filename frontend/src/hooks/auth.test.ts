import { describe, expect, it } from 'vitest';
import { authErrorMessage, isLockedOut, isReadOnlyView } from '../hooks/useAuth';

const OFF = { auth_enabled: false, allow_signup: true };
const ON = { auth_enabled: true, allow_signup: true };
const USER = {
  id: 'u1', email: 'a@b.com', display_name: 'A',
  is_active: true, is_admin: false,
};

describe('isLockedOut', () => {
  it('locks only when auth is enabled and there is no user', () => {
    expect(isLockedOut(ON, null)).toBe(true);
    expect(isLockedOut(ON, USER)).toBe(false);
    expect(isLockedOut(OFF, null)).toBe(false);
    expect(isLockedOut(null, null)).toBe(false);
  });
});

describe('isReadOnlyView', () => {
  it('hides write affordances only for logged-out users when auth is on', () => {
    expect(isReadOnlyView(false, ON, null)).toBe(true);
    expect(isReadOnlyView(false, ON, USER)).toBe(false);
    expect(isReadOnlyView(false, OFF, null)).toBe(false);
    expect(isReadOnlyView(false, null, null)).toBe(false);
  });
  it('never hides while auth state is still loading', () => {
    expect(isReadOnlyView(true, ON, null)).toBe(false);
  });
});

describe('authErrorMessage', () => {
  it('handles network failure', () => {
    expect(authErrorMessage(new Error('boom'))).toBe('Backend unreachable');
    expect(authErrorMessage(undefined)).toBe('Backend unreachable');
  });
  it('maps status codes', () => {
    const r = (status: number, detail?: unknown) => ({ response: { status, data: { detail } } });
    expect(authErrorMessage(r(401))).toBe('Invalid email or password');
    expect(authErrorMessage(r(409))).toBe('Email already registered');
    expect(authErrorMessage(r(403, 'Registration is closed'))).toBe('Registration is closed');
    expect(authErrorMessage(r(500))).toBe('Something went wrong');
  });
  it('prefers server detail strings', () => {
    const e = { response: { status: 401, data: { detail: 'Account deactivated' } } };
    expect(authErrorMessage(e)).toBe('Account deactivated');
  });
});
