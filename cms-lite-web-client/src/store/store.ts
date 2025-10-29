import { configureStore } from "@reduxjs/toolkit";
import userSlice from "./slices/user";
import directoryTreeSlice from "./slices/directoryTree";
import dashboardSlice from "./slices/dashboard";
import favoritesSlice from "./slices/favorites";

const store = configureStore({
  reducer: {
    user: userSlice,
    directoryTree: directoryTreeSlice,
    dashboard: dashboardSlice,
    favorites: favoritesSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export default store;
