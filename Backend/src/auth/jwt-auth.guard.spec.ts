import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService, type AuthenticatedUser } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JWT authorization header and session validation', () => {
  const jwt = { verify: vi.fn() };
  const auth = { validateSession: vi.fn() };
  const payload = { sub: 'user-id', jti: 'session-id', exp: 2_000_000_000 };
  const user = { id: 'user-id', sessionId: 'session-id' };
  let guard: JwtAuthGuard;

  const contextFor = (authorization?: string) => {
    const request = {
      headers: { authorization },
    } as Request & { user?: AuthenticatedUser };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    jwt.verify.mockReturnValue(payload);
    auth.validateSession.mockResolvedValue(user);
    guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      auth as unknown as AuthService,
    );
  });

  it.each([
    undefined,
    '',
    'Basic signed-token',
    'Bearer',
    'Bearer ',
    'Bearer  signed-token',
    'Bearer\tsigned-token',
    'Bearer signed-token extra-token',
    ' Bearer signed-token',
    'Bearer signed-token ',
    'Bearer signed-token\t',
    'Bearer signed-token, Bearer second-token',
  ])('rejects malformed or missing authorization: %j', async (header) => {
    const { context, request } = contextFor(header);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(auth.validateSession).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it.each(['Bearer', 'bearer', 'BEARER', 'bEaReR'])(
    'accepts the case-insensitive %s scheme and attaches the validated session',
    async (scheme) => {
      const { context, request } = contextFor(`${scheme} signed-token`);
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(jwt.verify).toHaveBeenCalledExactlyOnceWith('signed-token', {
        algorithms: ['HS256'],
      });
      expect(auth.validateSession).toHaveBeenCalledExactlyOnceWith(payload);
      expect(request.user).toEqual(user);
    },
  );

  it('rejects a token with an invalid signature before looking up its session', async () => {
    jwt.verify.mockImplementationOnce(() => {
      throw new Error('invalid signature');
    });
    const { context, request } = contextFor('Bearer tampered-token');
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      message: 'Invalid or expired token.',
    });
    expect(auth.validateSession).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('rejects a signed token whose persisted session was revoked', async () => {
    const failure = new UnauthorizedException('Invalid or expired token.');
    auth.validateSession.mockRejectedValueOnce(failure);
    const { context, request } = contextFor('Bearer revoked-token');
    await expect(guard.canActivate(context)).rejects.toBe(failure);
    expect(request.user).toBeUndefined();
  });

  it('preserves session-store errors so an outage is not reported as invalid credentials', async () => {
    const failure = new Error('Database connection unavailable');
    auth.validateSession.mockRejectedValueOnce(failure);
    const { context, request } = contextFor('Bearer signed-token');
    await expect(guard.canActivate(context)).rejects.toBe(failure);
    expect(request.user).toBeUndefined();
  });
});
