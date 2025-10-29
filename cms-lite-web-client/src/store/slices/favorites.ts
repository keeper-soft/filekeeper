import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { RootState } from '../store'
import type { ContentItemNode } from '../../types/directories'

const simulateDelay = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms)
})

let mockFavoritesData: ContentItemNode[] = [
  {
    id: 'favorites:content/landing-hero.json',
    resource: 'content/landing-hero.json',
    latestVersion: 7,
    contentType: 'application/json',
    isDeleted: false,
    size: '24 KB',
    createdAtUtc: '2024-11-01T15:24:00.000Z',
    updatedAtUtc: '2024-12-12T10:40:00.000Z',
  },
  {
    id: 'favorites:content/footer-links.json',
    resource: 'content/footer-links.json',
    latestVersion: 3,
    contentType: 'application/json',
    isDeleted: false,
    size: '12 KB',
    createdAtUtc: '2024-09-09T09:12:00.000Z',
    updatedAtUtc: '2024-12-02T08:05:00.000Z',
  },
  {
    id: 'favorites:content/marketing/email-template.xml',
    resource: 'content/marketing/email-template.xml',
    latestVersion: 5,
    contentType: 'application/xml',
    isDeleted: false,
    size: '18 KB',
    createdAtUtc: '2024-08-20T19:45:00.000Z',
    updatedAtUtc: '2024-12-18T07:30:00.000Z',
  },
]

const fetchFavoritesFromApi = async (): Promise<ContentItemNode[]> => {
  await simulateDelay(400)
  return mockFavoritesData.map((item) => ({ ...item }))
}

const removeFavoritesFromApi = async (ids: string[]): Promise<void> => {
  await simulateDelay(250)
  mockFavoritesData = mockFavoritesData.filter((item) => !ids.includes(item.id))
}

interface FavoritesState {
  items: ContentItemNode[]
  loading: boolean
  error: string | null
  removing: boolean
}

const initialState: FavoritesState = {
  items: [],
  loading: false,
  error: null,
  removing: false,
}

export const fetchFavorites = createAsyncThunk<ContentItemNode[], void, { rejectValue: string }>(
  'favorites/fetchFavorites',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchFavoritesFromApi()
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }
      return rejectWithValue('Failed to load favorites')
    }
  },
)

export const removeFavorites = createAsyncThunk<void, string[], { rejectValue: string }>(
  'favorites/removeFavorites',
  async (favoriteIds, { rejectWithValue, dispatch }) => {
    if (favoriteIds.length === 0) {
      return
    }

    try {
      await removeFavoritesFromApi(favoriteIds)
      await dispatch(fetchFavorites())
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }
      return rejectWithValue('Failed to remove favorites')
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
  },
})

export const { resetFavoritesState } = favoritesSlice.actions

export const selectFavoritesItems = (state: RootState): ContentItemNode[] => state.favorites.items
export const selectFavoritesLoading = (state: RootState): boolean => state.favorites.loading
export const selectFavoritesError = (state: RootState): string | null => state.favorites.error
export const selectFavoritesRemoving = (state: RootState): boolean => state.favorites.removing

export default favoritesSlice.reducer
