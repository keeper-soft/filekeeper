export interface ContentItemNode {
    id: string
    resource: string
    latestVersion: number
    contentType: string
    isDeleted: boolean
    size?: string
    createdAtUtc?: string
    updatedAtUtc?: string
}

export interface DirectoryNode {
    id: string
    name: string
    level: number
    parentId: string | null
    subDirectories: DirectoryNode[]
    contentItems: ContentItemNode[]
}

export interface ApiContentItem {
    resource: string
    latestVersion: number
    contentType: string
    isDeleted: boolean
    size?: string
    createdAtUtc?: string
    updatedAtUtc?: string
}

export interface ApiDirectoryNode {
    id: string
    name: string
    level: number
    subDirectories: ApiDirectoryNode[]
    contentItems: ApiContentItem[]
}

export interface DirectoryTreeApiResponse {
    tenantId: string
    tenantName: string
    rootDirectory: ApiDirectoryNode
    totalDirectories: number
    totalContentItems: number
}

export interface DirectoryTreeState {
    root: DirectoryNode | null
    currentDirectoryId: string | null
    selectedFileIds: string[]
    loading: boolean
    error: string | null
    lastFetchedTenant: string | null
    tenantId: string | null
    totalDirectories: number
    totalContentItems: number
}
