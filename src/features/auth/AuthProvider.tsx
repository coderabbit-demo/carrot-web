import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { resetClientState, setOrganizationId, setUnauthorizedHandler } from '../../lib/api/client';
import { getMe, login, logout } from '../../lib/api/endpoints';
import type { Membership, OrganizationContext, User } from '../../lib/api/types';

type AuthStatus = 'loading' | 'signed_out' | 'needs_org' | 'ready';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  organization: OrganizationContext | null;
  memberships: Membership[];
  sessionExpired: boolean;
}

interface AuthContextValue extends AuthState {
  signIn(email: string, password: string): Promise<void>;
  selectOrganization(organizationId: string): Promise<void>;
  signOut(): Promise<void>;
}

// Only the selected organization id is remembered across reloads. The session itself is an
// HttpOnly cookie managed by the gateway; no tokens are kept in browser storage.
const ORG_KEY = 'carrot.organization';
const LAST_USER_KEY = 'carrot_last_user';

function readStoredOrg(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrg(id: string | null): void {
  try {
    if (id) localStorage.setItem(ORG_KEY, id);
    else localStorage.removeItem(ORG_KEY);
  } catch {
    // Storage unavailable: the app still works, the choice is just not remembered.
  }
}

// Lets the sign-in page greet a returning user by name before they sign in again.
function writeLastUser(user: User): void {
  try {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify({ name: user.name, email: user.email }));
  } catch {
    // Storage unavailable: the greeting just won't show next time.
  }
}

const SIGNED_OUT: AuthState = {
  status: 'signed_out',
  user: null,
  organization: null,
  memberships: [],
  sessionExpired: false,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...SIGNED_OUT, status: 'loading' });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setOrganizationId(null);
      writeStoredOrg(null);
      setState({ ...SIGNED_OUT, sessionExpired: true });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredOrg();
    if (stored) setOrganizationId(stored);
    getMe().then(
      (me) => {
        if (cancelled) return;
        writeLastUser(me.user);
        setState({
          status: 'ready',
          user: me.user,
          organization: me.organization,
          memberships: me.memberships,
          sessionExpired: false,
        });
      },
      () => {
        if (cancelled) return;
        setOrganizationId(null);
        writeStoredOrg(null);
        setState(SIGNED_OUT);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setOrganizationId(null);
    const res = await login(email, password);
    if (res.organization) {
      setOrganizationId(res.organization.id);
      writeStoredOrg(res.organization.id);
    }
    writeLastUser(res.user);
    setState({
      status: res.organization ? 'ready' : 'needs_org',
      user: res.user,
      organization: res.organization,
      memberships: res.memberships,
      sessionExpired: false,
    });
  }, []);

  const selectOrganization = useCallback(async (organizationId: string) => {
    setOrganizationId(organizationId);
    try {
      const me = await getMe();
      writeStoredOrg(organizationId);
      setState({
        status: 'ready',
        user: me.user,
        organization: me.organization,
        memberships: me.memberships,
        sessionExpired: false,
      });
    } catch (error) {
      setOrganizationId(null);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // The gateway revokes best effort; the local state is cleared either way.
    }
    resetClientState();
    writeStoredOrg(null);
    setState(SIGNED_OUT);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, selectOrganization, signOut }),
    [state, signIn, selectOrganization, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
