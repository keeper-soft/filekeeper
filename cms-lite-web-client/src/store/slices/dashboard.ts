//TODO: Check if this is still needed remove if not
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";


interface DashboardStats {
  totalFiles: number;
  totalFolders: number;
  storageUsed: string;
  recentActivity: number;
}

interface RecentFile {
  id: string;
  name: string;
  type: string;
  modifiedDate: string;
  size: string;
}

interface Activity {
  id: string;
  action: string;
  fileName: string;
  timestamp: string;
  user: string;
}

interface DashboardState {
  stats: DashboardStats | null;
  recentFiles: RecentFile[];
  activities: Activity[];
  loading: {
    stats: boolean;
    recentFiles: boolean;
    activities: boolean;
    charts: boolean;
  };
  error: {
    stats: string | null;
    recentFiles: string | null;
    activities: string | null;
    charts: string | null;
  };
}

const initialState: DashboardState = {
  stats: null,
  recentFiles: [],
  activities: [],
  loading: {
    stats: false,
    recentFiles: false,
    activities: false,
    charts: false,
  },
  error: {
    stats: null,
    recentFiles: null,
    activities: null,
    charts: null,
  },
};

// Async thunks for API calls
export const fetchDashboardStats = createAsyncThunk(
  "dashboard/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      // Replace with your actual API call
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);

export const fetchRecentFiles = createAsyncThunk(
  "dashboard/fetchRecentFiles",
  async (_, { rejectWithValue }) => {
    try {
      // Replace with your actual API call
      const response = await fetch("/api/files/recent");
      if (!response.ok) {
        throw new Error("Failed to fetch recent files");
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);

export const fetchActivities = createAsyncThunk(
  "dashboard/fetchActivities",
  async (_, { rejectWithValue }) => {
    try {
      // Replace with your actual API call
      const response = await fetch("/api/activities/recent");
      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    // Synchronous actions
    resetDashboard: () => initialState,
    clearError: (
      state,
      action: PayloadAction<keyof DashboardState["error"]>
    ) => {
      state.error[action.payload] = null;
    },
  },
  extraReducers: (builder) => {
    // Stats
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.loading.stats = true;
        state.error.stats = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.loading.stats = false;
        state.stats = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.loading.stats = false;
        state.error.stats = action.payload as string;
      });

    // Recent Files
    builder
      .addCase(fetchRecentFiles.pending, (state) => {
        state.loading.recentFiles = true;
        state.error.recentFiles = null;
      })
      .addCase(fetchRecentFiles.fulfilled, (state, action) => {
        state.loading.recentFiles = false;
        state.recentFiles = action.payload;
      })
      .addCase(fetchRecentFiles.rejected, (state, action) => {
        state.loading.recentFiles = false;
        state.error.recentFiles = action.payload as string;
      });

    // Activities
    builder
      .addCase(fetchActivities.pending, (state) => {
        state.loading.activities = true;
        state.error.activities = null;
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        state.loading.activities = false;
        state.activities = action.payload;
      })
      .addCase(fetchActivities.rejected, (state, action) => {
        state.loading.activities = false;
        state.error.activities = action.payload as string;
      });
  },
});

export const { resetDashboard, clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;

// Selectors
export const selectDashboardStats = (state: { dashboard: DashboardState }) =>
  state.dashboard.stats;
export const selectRecentFiles = (state: { dashboard: DashboardState }) =>
  state.dashboard.recentFiles;
export const selectActivities = (state: { dashboard: DashboardState }) =>
  state.dashboard.activities;
export const selectDashboardLoading = (state: { dashboard: DashboardState }) =>
  state.dashboard.loading;
export const selectDashboardErrors = (state: { dashboard: DashboardState }) =>
  state.dashboard.error;

// Helper selector to check if any dashboard data is loading
export const selectIsAnyDashboardLoading = (state: {
  dashboard: DashboardState;
}) => {
  const loading = state.dashboard.loading;
  return (
    loading.stats || loading.recentFiles || loading.activities || loading.charts
  );
};
