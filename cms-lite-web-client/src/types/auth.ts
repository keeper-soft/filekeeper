export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  tenant: TenantInfo | null;
  isAuthenticated: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  loginWithOAuth: (provider: string, code: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

export interface LoginResponseSuccess {
  token: string
  user: User
}
