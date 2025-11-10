//TODO: Check if this is still needed remove if not
export interface FileNode {
    id: string
    parentDirectoryId: string
    name: string
    extension: string
    size: number
    isVisible: boolean
}


//TODO: Check if this is still needed remove if not
export interface FileListByDirectoryApiResponse {
    directory: null;
    contentItems: FileNodeV2[];
    totalCount: number;
    nextCursor: string | null;
}

//TODO: Check if this is still needed remove if not
export interface FileNodeV2 {
    id: string;
    name: string;
    latestVersion: number;
    contentType: string;
    byteSize: number;
    eTag: string;
    updatedAtUtc: string;
    createdAtUtc: string;
}

export type PdfViewerRouteState = {
    resourceId?: string;
    tenantName?: string;
    version?: number;
    viewer?: 'pdf';
}

