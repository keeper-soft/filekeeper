import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { isAxiosError } from 'axios'
import type { RootState } from '../store'
import type { ContentItemNode } from '../../types/directories'
import customAxios from '../../utilities/custom-axios'

interface FavoritesState {
  items: ContentItemNode[]
  loading: boolean
  error: string | null
  removing: boolean
  adding: boolean
}

const initialState: FavoritesState = {
  items: [],
  loading: false,
  error: null,
  removing: false,
  adding: false,
}

interface FavoriteApiItem {
  id: number
  tenantId: string
  directoryId: string
  resource: string
  latestVersion: number
  contentType: string
  byteSize: number
  sha256: string
  eTag: string
  createdAtUtc: string
  updatedAtUtc: string
  isDeleted: boolean
}

const formatFileSize = (bytes: number): string => {
  if (Number.isNaN(bytes) || bytes <= 0) {
    return '0 B'
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const mapFavoriteItem = (item: FavoriteApiItem): ContentItemNode => ({
  id: `${item.directoryId}:${item.resource}`,
  resource: item.resource,
  latestVersion: item.latestVersion,
  contentType: item.contentType,
  isDeleted: item.isDeleted,
  size: formatFileSize(item.byteSize),
  createdAtUtc: item.createdAtUtc,
  updatedAtUtc: item.updatedAtUtc,
})

export const fetchFavorites = createAsyncThunk<
  ContentItemNode[],
  void,
  { state: RootState; rejectValue: string }
>(
  'favorites/fetchFavorites',
  async (_, { rejectWithValue, getState }) => {
    const state = getState()
    const tenantName = state.user.tenant?.name
    const isAuthenticated = state.user.isAuthenticated
    if (!tenantName || !isAuthenticated) {
      return rejectWithValue('Missing tenant information for favorites')
    }

    try {
      const { data } = await customAxios.get<FavoriteApiItem[]>(`/v1/${tenantName}/favorites`)
      return data.map(mapFavoriteItem)
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const apiMessage = (error.response?.data as { message?: string } | undefined)?.message
        return rejectWithValue(apiMessage ?? error.message ?? 'Failed to load favorites')
      }
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }
      return rejectWithValue('Failed to load favorites')
    }
  },
)

export const removeFavorites = createAsyncThunk<
  void,
  string[],
  { state: RootState; rejectValue: string }
>(
  'favorites/removeFavorites',
  async (favoriteIds, { rejectWithValue, dispatch, getState }) => {
    if (favoriteIds.length === 0) {
      return
    }

    const state = getState()
    const tenantName = state.user.tenant?.name
    if (!tenantName) {
      return rejectWithValue('Missing tenant information for favorites')
    }

    try {
      await Promise.all(
        favoriteIds.map((contentId) =>
          customAxios.delete(`/v1/${tenantName}/favorites/${encodeURIComponent(contentId)}`),
        ),
      )
      await dispatch(fetchFavorites())
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const apiMessage = (error.response?.data as { message?: string } | undefined)?.message
        return rejectWithValue(apiMessage ?? error.message ?? 'Failed to remove favorites')
      }
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }
      return rejectWithValue('Failed to remove favorites')
    }
  },
)

export const addFavorite = createAsyncThunk<
  void,
  string,
  { state: RootState; rejectValue: string }
>(
  'favorites/addFavorite',
  async (contentId, { getState, rejectWithValue, dispatch }) => {
    const state = getState()
    const tenantName = state.user.tenant?.name
    const userId = state.user.id

    if (!tenantName || !userId) {
      return rejectWithValue('Missing user information for favorites')
    }

    try {
      await customAxios.post(`/v1/${tenantName}/favorites`, {
        userId,
        contentId,
      })
      await dispatch(fetchFavorites())
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const status = error.response?.status
        if (status === 409) {
          return rejectWithValue('This item is already in your favorites.')
        }
        if (status === 401) {
          return rejectWithValue('Your session for this tenant could not be validated. Please log in again.')
        }
        const apiMessage = (error.response?.data as { message?: string } | undefined)?.message
        return rejectWithValue(apiMessage ?? error.message ?? 'Failed to add favorite')
      }
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }
      return rejectWithValue('Failed to add favorite')
    }
  },
)

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    resetFavoritesState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFavorites.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFavorites.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchFavorites.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload ?? 'Failed to load favorites'
      })
      .addCase(removeFavorites.pending, (state) => {
        state.removing = true
      })
      .addCase(removeFavorites.fulfilled, (state) => {
        state.removing = false
      })
      .addCase(removeFavorites.rejected, (state, action) => {
        state.removing = false
        state.error = action.payload ?? 'Failed to remove favorites'
      })
      .addCase(addFavorite.pending, (state) => {
        state.adding = true
        state.error = null
      })
      .addCase(addFavorite.fulfilled, (state) => {
        state.adding = false
      })
      .addCase(addFavorite.rejected, (state, action) => {
        state.adding = false
        state.error = action.payload ?? 'Failed to add favorite'
      })
  },
})

export const { resetFavoritesState } = favoritesSlice.actions

export const selectFavoritesItems = (state: RootState): ContentItemNode[] => state.favorites.items
export const selectFavoritesLoading = (state: RootState): boolean => state.favorites.loading
export const selectFavoritesError = (state: RootState): string | null => state.favorites.error
export const selectFavoritesRemoving = (state: RootState): boolean => state.favorites.removing
export const selectFavoritesAdding = (state: RootState): boolean => state.favorites.adding

export default favoritesSlice.reducer
