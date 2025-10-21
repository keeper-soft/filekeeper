import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import { useDispatch, useSelector } from 'react-redux'
import type { AuthContextType, LoginResponseSuccess } from '../../types/auth'
import customAxios from '../../utilities/custom-axios'
import { AuthContext } from './AuthContext'
import { logInUser, logOutUser } from '../../store/slices/user'
import type { AppDispatch, RootState } from '../../store/store'
import { clearDirectoryTree } from '../../store/slices/directoryTree'

interface AuthProviderProps {
    children: ReactNode
}

export const GOOGLE_NONCE_STORAGE_KEY = "pokeeper:google-nonce";
export const GITHUB_STATE_STORAGE_KEY = "pokeeper:github-state";

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [isLoading, setIsLoading] = useState(true)
    const dispatch = useDispatch<AppDispatch>()
    const userState = useSelector((state: RootState) => state.user)
    useEffect(() => {
        setIsLoading(false);
    }, [dispatch])

    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true)
        try {
            const { data } = await customAxios.post<LoginResponseSuccess>('/auth/login', { email, password })
            if (!data?.token || !data?.user) {
                console.error('Login API response missing required fields')
                return false
            }
            localStorage.setItem('jwtToken', data.token);
            const { id, email: userEmail, firstName, lastName, tenant} = data.user
            dispatch(logInUser({
                id,
                email: userEmail,
                firstName,
                lastName,
                tenant,
            }));
            return true;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Unknown login error'
                console.error('Login API error:', message)
            } else {
                console.error('Login error:', error)
            }
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const logout = () => {
        dispatch(logOutUser())
        dispatch(clearDirectoryTree())
        localStorage.removeItem('jwtToken')
        localStorage.removeItem('cms-lite-user')
    }

    const loginWithOAuth = async (provider: string, code: string): Promise<boolean> => {
        setIsLoading(true)
        try {
            // Call backend OAuth endpoint with authorization code
            const { data } = await customAxios.post<LoginResponseSuccess>(`/auth/${provider}/token`, { code })

            if (!data?.token || !data?.user) {
                console.error('OAuth login API response missing required fields')
                return false
            }

            // Store JWT token
            localStorage.setItem('jwtToken', data.token);

            // Update Redux state with user info
            const { id, email: userEmail, firstName, lastName, tenant } = data.user
            dispatch(logInUser({
                id,
                email: userEmail,
                firstName,
                lastName,
                tenant,
            }));

            return true;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Unknown OAuth login error'
                console.error('OAuth login API error:', message)
            } else {
                console.error('OAuth login error:', error)
            }
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const value: AuthContextType = {
        user: userState.isAuthenticated ? userState : null,
        isAuthenticated: userState.isAuthenticated,
        login,
        loginWithOAuth,
        logout,
        isLoading
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
