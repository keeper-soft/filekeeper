export interface ContentItemDirectoryInfo {
  id: string
  name: string
  fullPath: string
  level: number
}

export interface ContentItemVersion {
  version: number
  byteSize: number
  eTag: string
  createdAtUtc: string
}

export interface ContentItemMetadata {
  tenantId: string
  tenantName: string
  hasMultipleVersions: boolean
  totalVersions: number
  fileExtension: string
  readableSize: string
}

export interface ContentItemDetails {
  resource: string
  latestVersion: number
  contentType: string
  size?: string
  eTag: string
  sha256: string
  createdAtUtc: string
  updatedAtUtc: string
  isDeleted: boolean
  directory: ContentItemDirectoryInfo
  versions: ContentItemVersion[]
  metadata: ContentItemMetadata
}

export interface CsvConfig {
  delimiter: string
  hasHeader: boolean
  quoteChar: string
}
