import {configureStore} from "@reduxjs/toolkit";
import type {Reducer, UnknownAction} from "@reduxjs/toolkit";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import userReducer from "./slices/user";
import directoryTreeReducer from "./slices/directoryTree";
import dashboardReducer from "./slices/dashboard";
import favoritesReducer from "./slices/favorites";
import navigationReducer from "./slices/navigation";
import { userPersistConfig, directoryTreePersistConfig, navigationPersistConfig } from "./persistConfig";
import type { User } from "../types/auth";
import type { DirectoryTreeState } from "../types/directories";
import type { NavigationStateProps } from "../types/navigation";

// redux-persist adds a `_persist` key to each persisted slice's state.  RTK v2's
// `configureStore` generic inference does not accommodate the resulting
// `Reducer<S & PersistPartial, …>` type directly, so we cast back to the plain
// slice types.  This is safe because the runtime behaviour is unchanged.
const persistedUserReducer = persistReducer(userPersistConfig, userReducer) as unknown as Reducer<User, UnknownAction>;
const persistedDirectoryTreeReducer = persistReducer(directoryTreePersistConfig, directoryTreeReducer) as unknown as Reducer<DirectoryTreeState, UnknownAction>;
const persistedNavigationReducer = persistReducer(navigationPersistConfig, navigationReducer) as unknown as Reducer<NavigationStateProps, UnknownAction>;

const store = configureStore({
    reducer: {
        user: persistedUserReducer,
        directoryTree: persistedDirectoryTreeReducer,
        dashboard: dashboardReducer,
        favorites: favoritesReducer,
        navigation: persistedNavigationReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // redux-persist dispatches these action types internally; they carry
                // non-serializable values and must be excluded from the check.
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export default store;
