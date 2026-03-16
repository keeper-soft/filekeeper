import {useState, useEffect, useRef} from 'react'
import type {ReactNode} from 'react'
import axios from 'axios'
import {useDispatch, useSelector} from 'react-redux'
import type {AuthContextType, LoginResponseSuccess} from '../../types/auth'
import customAxios from '../../utilities/custom-axios'
import {AuthContext} from './AuthContext'
import {logInUser, logOutUser} from '../../store/slices/user'
import type {AppDispatch, RootState} from '../../store/store'
import {persistor} from '../../store/store'
import {clearDirectoryTree} from '../../store/slices/directoryTree'

interface AuthProviderProps {
    children: ReactNode
}

export const AuthProvider = ({children}: AuthProviderProps) => {
    const [isLoading, setIsLoading] = useState(true)
    const dispatch = useDispatch<AppDispatch>();
    const userState = useSelector((state: RootState) => state.user);
    const directoryTenantId = useSelector((state: RootState) => state.directoryTree.tenantId);
    // Ensure the cross-tenant check runs exactly once after the initial rehydration.
    const tenantValidationDone = useRef(false);

    useEffect(() => {
        if (tenantValidationDone.current) return;
        tenantValidationDone.current = true;

        // Validate that the persisted directoryTree belongs to the same tenant as
        // the persisted user.  If they diverge (a different tenant was active
        // previously), clear the stale tree to prevent cross-tenant data leakage.
        const userTenantId = userState.tenant?.id;
        if (directoryTenantId && userTenantId && directoryTenantId !== userTenantId) {
            dispatch(clearDirectoryTree());
        }

        setIsLoading(false);
    }, [dispatch, directoryTenantId, userState.tenant?.id])

    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true)
        try {
            const {data} = await customAxios.post<LoginResponseSuccess>('/auth/login', {email, password})
            if (!data?.token || !data?.user) {
                console.error('Login API response missing required fields')
                return false
            }
            localStorage.setItem('jwtToken', data.token);
            const {id, email: userEmail, firstName, lastName, tenant} = data.user
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
        persistor.purge()
    }

    const value: AuthContextType = {
        user: userState.isAuthenticated ? userState : null,
        isAuthenticated: userState.isAuthenticated,
        login,
        logout,
        isLoading
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
