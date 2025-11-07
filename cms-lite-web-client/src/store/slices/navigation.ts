import {createSlice} from '@reduxjs/toolkit'
import type {NavigationStateProps} from '../../types/navigation.ts'

export const viewPagesOptions: [string, string][] = [
    ['/dashboard', 'Dashboard'],
    ['/favorites', 'Favorites'],
    ['/login', 'Login']
]

const validViewPaths = new Set(viewPagesOptions.map(([path]) => path))

const normalizePath = (path: string) => {
    if (path.length > 1 && path.endsWith('/')) {
        return path.slice(0, -1)
    }
    return path
}

const resolveViewPath = (value: unknown) => {
    if (typeof value !== 'string' || value.length === 0) {
        return null
    }
    const normalized = normalizePath(value)
    if (validViewPaths.has(normalized)) {
        return normalized
    }
    const labelMatch = viewPagesOptions.find(([, label]) => label.toLowerCase() === value.toLowerCase())
    return labelMatch ? labelMatch[0] : null
}

export const matchPathToView = (pathname: string) => {
    const normalized = normalizePath(pathname)
    if (normalized === '/') {
        return '/dashboard'
    }
    return validViewPaths.has(normalized) ? normalized : null
}

const initialState: NavigationStateProps = {
    currentView: null,
    prevView: null
}

const navigationSlice = createSlice({
    name: 'navigation',
    initialState,
    reducers: {
        setCurrentView(state, action) {
            const viewPath = resolveViewPath(action.payload)
            if (!viewPath) {
                return
            }
            state.prevView = state.currentView
            state.currentView = viewPath
        }
    }
});

export const {setCurrentView} = navigationSlice.actions

export default navigationSlice.reducer;
export const selectCurrentView = (state: { navigation: NavigationStateProps }) => state.navigation.currentView;
