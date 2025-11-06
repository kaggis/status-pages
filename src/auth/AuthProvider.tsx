// AuthProvider.tsx
import { AuthContext, type AuthContextType } from './context'
import { keycloak, initKeycloak } from './keycloak'
import { useEffect, useRef, useState } from 'react'

type KeycloakUserInfo = {
  preferred_username: string
  email: string
  name: string
  sub: string
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [initialized, setInitialized] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [token, setToken] = useState<string | undefined>(undefined)
  const [profile, setProfile] = useState<AuthContextType['profile']>(undefined)

  const startedRef = useRef(false)
  const refreshTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    //const redirectBase = import.meta.env.VITE_REDIRECT_URI || window.location.origin;

    initKeycloak({
      onLoad: 'check-sso',
      scope: import.meta.env.VITE_KEYCLOAK_SCOPES,
      pkceMethod: 'S256',
      //silentCheckSsoRedirectUri: `${new URL(redirectBase).origin}/silent-check-sso.html`,
      checkLoginIframe: false,
    })
      .then(async (auth) => {
        setAuthenticated(auth)

        if (auth) {
          setToken(keycloak.token)

          // Load minimal profile
          const userInfo = (await keycloak.loadUserInfo()) as KeycloakUserInfo
          setProfile({
            username: userInfo.preferred_username,
            name: userInfo.name,
            email: userInfo.email,
            sub: userInfo.sub,
          })

          // // Refresh token every 30s; keep at least 60s of validity.
          // refreshTimerRef.current = window.setInterval(async () => {
          //   try {
          //     const refreshed = await keycloak.updateToken(60);
          //     if (refreshed) setToken(keycloak.token);
          //   } catch {
          //     setAuthenticated(false);
          //     setToken(undefined);
          //   }
          // }, 30_000);
        }

        setInitialized(true)
      })
      .catch((e) => {
        console.error('Keycloak init failed', e)
        setInitialized(true) // let the app render a logged-out state
      })

    // Proper cleanup
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [])

  const login = () =>
    keycloak.login({
      redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    })

  const logout = () =>
    keycloak.logout({
      redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    })

  return (
    <AuthContext.Provider
      value={{ initialized, authenticated, token, profile, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}
