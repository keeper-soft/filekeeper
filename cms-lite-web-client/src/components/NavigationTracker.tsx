import {useEffect} from 'react'
import {useDispatch} from 'react-redux'
import {useLocation} from 'react-router-dom'
import {matchPathToView, setCurrentView} from '../store/slices/navigation'
import type {AppDispatch} from '../store/store'

export const NavigationTracker = () => {
    const location = useLocation()
    const dispatch = useDispatch<AppDispatch>()

    useEffect(() => {
        const view = matchPathToView(location.pathname)
        if (!view) {
            return
        }
        dispatch(setCurrentView(view))
    }, [dispatch, location.pathname])

    return null
}
