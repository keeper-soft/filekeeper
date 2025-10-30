import {createSlice} from '@reduxjs/toolkit'
import type {NavigationStateProps} from '../../types/navigation.ts'

const initialState: NavigationStateProps = {
    currentView: '',
    prevView: ''
};

const navigationSlice = createSlice({
    name: 'navigationState',
    initialState,
    reducers: {
        setCurrentView(state, action) {
            const match = viewPagesOptions.find(option => option[1] === action.payload);
            if (!match) {
                //TODO: Handle invalid view gracefully instead of silently failing
                return;
            }
            state.prevView = state.currentView;
            state.currentView = action.payload;
        }
    }
});

export const viewPagesOptions: [string, string][] = [
    ['dashboard', 'Dashboard'],
    ['favorites', 'Favorites'],
    ['/', 'Login']
];

export default navigationSlice.reducer;
export const selectCurrentView = (state: { navigation: NavigationStateProps }) => state.navigation.currentView;

