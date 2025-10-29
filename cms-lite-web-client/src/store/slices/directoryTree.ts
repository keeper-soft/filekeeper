import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'
import type {
  DirectoryTreeState,
  DirectoryTreeApiResponse,
  DirectoryNode,
  ApiDirectoryNode,
  ApiContentItem,
  ContentItemNode,
} from '../../types/directories.ts'
import customAxios from '../../utilities/custom-axios'

const initialState: DirectoryTreeState = {
  root: null,
  currentDirectoryId: null,
  selectedFileIds: [],
  loading: false,
  error: null,
  lastFetchedTenant: null,
  tenantId: null,
  totalDirectories: 0,
  totalContentItems: 0,
}

const mapContentItems = (items: ApiContentItem[], directoryId: string): ContentItemNode[] =>
  items.map((item) => ({
    id: `${directoryId}:${item.resource}`,
    resource: item.resource,
    latestVersion: item.latestVersion,
    contentType: item.contentType,
    isDeleted: item.isDeleted,
    size: item.size,
    createdAtUtc: item.createdAtUtc,
    updatedAtUtc: item.updatedAtUtc,
  }))

const mapDirectoryTree = (node: ApiDirectoryNode, parentId: string | null = null): DirectoryNode => ({
  id: node.id,
  name: node.name,
  level: node.level,
  parentId,
  contentItems: mapContentItems(node.contentItems, node.id),
  subDirectories: node.subDirectories.map((child) => mapDirectoryTree(child, node.id)),
})

const findDirectoryById = (root: DirectoryNode | null, id: string): DirectoryNode | null => {
  if (!root) {
    return null
  }

  if (root.id === id) {
    return root
  }

  for (const child of root.subDirectories) {
    const found = findDirectoryById(child, id)
    if (found) {
      return found
    }
  }

  return null
}

export const fetchDirectoryTree = createAsyncThunk<
  DirectoryTreeApiResponse,
  string,
  { rejectValue: string }
>('directoryTree/fetchDirectoryTree', async (tenantName, { rejectWithValue }) => {
  try {
    const { data } = await customAxios.get<DirectoryTreeApiResponse>(`/v1/${tenantName}/directories/tree`)
    return data
  } catch (error: unknown) {
    if (error instanceof Error) {
      return rejectWithValue(error.message)
    }
    return rejectWithValue('Unknown error fetching directory tree')
  }
})

const directoryTreeSlice = createSlice({
  name: 'directoryTree',
  initialState,
  reducers: {
    setRoot: (state, action: PayloadAction<DirectoryNode | null>) => {
      state.root = action.payload
      state.currentDirectoryId = action.payload?.id ?? null
      state.selectedFileIds = []
    },
    setCurrentDirectory: (state, action: PayloadAction<string | null>) => {
      state.currentDirectoryId = action.payload
      state.selectedFileIds = []
    },
    setSelectedFiles: (state, action: PayloadAction<string[]>) => {
      state.selectedFileIds = action.payload
    },
    moveBackToParent: (state) => {
      if (!state.root || !state.currentDirectoryId) {
        return
      }

      const current = findDirectoryById(state.root, state.currentDirectoryId)
      if (current?.parentId) {
        state.currentDirectoryId = current.parentId
        state.selectedFileIds = []
      }
    },
    clearDirectoryTree: (state) => {
      state.root = null
      state.currentDirectoryId = null
      state.selectedFileIds = []
      state.loading = false
      state.error = null
      state.lastFetchedTenant = null
      state.tenantId = null
      state.totalDirectories = 0
      state.totalContentItems = 0
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDirectoryTree.pending, (state) => {
        state.loading = true
        state.error = null
        state.selectedFileIds = []
      })
      .addCase(fetchDirectoryTree.fulfilled, (state, action) => {
        const root = mapDirectoryTree(action.payload.rootDirectory)
        state.root = root
        state.currentDirectoryId = root?.id ?? null
        state.selectedFileIds = []
        state.loading = false
        state.error = null
        state.lastFetchedTenant = action.payload.tenantName
        state.tenantId = action.payload.tenantId
        state.totalDirectories = action.payload.totalDirectories
        state.totalContentItems = action.payload.totalContentItems
      })
      .addCase(fetchDirectoryTree.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload ?? 'Failed to fetch directory tree'
      })
  },
})

export const { setRoot, setCurrentDirectory, setSelectedFiles, moveBackToParent, clearDirectoryTree } = directoryTreeSlice.actions

export const selectDirectoryTreeRoot = (state: RootState) => state.directoryTree.root
export const selectDirectoryTreeLoading = (state: RootState) => state.directoryTree.loading
export const selectDirectoryTreeError = (state: RootState) => state.directoryTree.error
export const selectDirectoryTreeCurrentDirectory = (state: RootState) =>
  state.directoryTree.currentDirectoryId && state.directoryTree.root
    ? findDirectoryById(state.directoryTree.root, state.directoryTree.currentDirectoryId)
    : null
export const selectDirectoryTreeLastFetchedTenant = (state: RootState) => state.directoryTree.lastFetchedTenant
export const selectDirectoryTreeTotals = (state: RootState) => ({
  totalDirectories: state.directoryTree.totalDirectories,
  totalContentItems: state.directoryTree.totalContentItems,
})
export const selectDirectoryTreeSelectedFileIds = (state: RootState): string[] => state.directoryTree.selectedFileIds
export const selectDirectoryTreeSelectedContentItems = (state: RootState): ContentItemNode[] => {
  const directory = selectDirectoryTreeCurrentDirectory(state)
  if (!directory || state.directoryTree.selectedFileIds.length === 0) {
    return []
  }

  return directory.contentItems.filter((item) =>
    state.directoryTree.selectedFileIds.includes(item.id),
  )
}

export type { DirectoryNode, ContentItemNode } from '../../types/directories.ts'

export default directoryTreeSlice.reducer
