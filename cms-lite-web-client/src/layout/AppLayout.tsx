import type {CSSProperties, ReactNode, ChangeEvent} from 'react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {isAxiosError} from 'axios'
import {useNavigate} from 'react-router-dom'
import {useDispatch, useSelector} from 'react-redux'
import {makeStyles} from '@fluentui/react-components'
import {Header} from './Header'
import {Footer} from './Footer'
import {ActionBar} from './ActionBar'
import {NavMenu} from './NavMenu'
import {ContentArea} from './ContentArea'
import {
    ANIMATIONS,
    BREAKPOINTS,
    getNavMenuWidth,
} from './layoutConstants'
import {useAuth} from '../contexts'
import type {AppDispatch} from '../store/store'
import {
    fetchDirectoryTree,
    selectDirectoryTreeRoot,
    selectDirectoryTreeLoading,
    selectDirectoryTreeError,
    selectDirectoryTreeCurrentDirectory,
    selectDirectoryTreeLastFetchedTenant,
    setCurrentDirectory,
    selectDirectoryTreeSelectedFileIds,
    setSelectedFiles,
    type DirectoryNode,
} from '../store/slices/directoryTree'
import {FileDetailsModal} from '../components/FileDetailsModal'
import {CreateDirectoryDialog} from '../components/CreateDirectoryDialog'
import {SoftDeleteDialog, type SoftDeleteItem} from '../components/SoftDeleteDialog'
import {InfoDialog} from '../components/modals/InfoDialog'
import customAxios from '../utilities/custom-axios'
import {sanitizeResourceName} from '../utilities/resource-name'
import type {ContentItemDetails} from '../types/content'

const useStyles = makeStyles({
    appContainer: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'inherit',
    },
    mainContainer: {
        display: 'grid',
        flex: 1,
        minHeight: 0,
        position: 'relative',
        width: '100%',
        gridTemplateColumns: `${getNavMenuWidth(false)}px 1fr`,
        transition: ANIMATIONS.CONTENT_TRANSITION,
        [`@media (max-width: ${BREAKPOINTS.TABLET}px)`]: {
            gridTemplateColumns: '1fr',
        },
    },
    contentWrapper: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: ANIMATIONS.CONTENT_TRANSITION,
        overflow: 'hidden',
        minWidth: 0,
        gridColumn: 2,
        [`@media (max-width: ${BREAKPOINTS.TABLET}px)`]: {
            gridColumn: '1',
        },
    },
    actionBarWrapper: {
        width: '100%',
        zIndex: 1,
    },
    mainContent: {
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
    },
    overlayBackdrop: {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        zIndex: 9,
        opacity: 1,
        transition: 'opacity 0.3s ease',
        [`@media (min-width: ${BREAKPOINTS.TABLET + 1}px)`]: {
            display: 'none',
        },
    },
})

interface AppLayoutProps {
    children?: ReactNode
}

interface FileDetailsState {
    open: boolean
    isLoading: boolean
    error: string | null
    data: ContentItemDetails | null
    resourceId: string | null
}

interface CreateDirectoryState {
    open: boolean
    name: string
    isSubmitting: boolean
    error: string | null
}

interface SoftDeleteState {
    open: boolean
    items: SoftDeleteItem[]
    isSubmitting: boolean
    error: string | null
    successMessage: string | null
}

interface InfoDialogState {
    open: boolean
    title: string
    description: string
    primaryLabel?: string
    isLoading?: boolean
}
const findDirectoryPathSegments = (root: DirectoryNode | null, targetId: string | null): string[] => {
    if (!root || !targetId) {
        return []
    }

    const traverse = (node: DirectoryNode, trail: string[]): string[] | null => {
        const nextTrail = [...trail, node.name]
        if (node.id === targetId) {
            return nextTrail
        }
        for (const child of node.subDirectories) {
            const result = traverse(child, nextTrail)
            if (result) {
                return result
            }
        }
        return null
    }

    return traverse(root, []) ?? []
}

const buildPathString = (segments: string[]): string => {
    if (segments.length === 0) {
        return '/'
    }
    return `/${segments.join('/')}`
}

const extractFilenameFromContentDisposition = (header?: string | null): string | null => {
    if (!header) {
        return null
    }

    const filenameStarMatch = /filename\*=UTF-8''([^;]+)/i.exec(header)
    if (filenameStarMatch?.[1]) {
        try {
            return decodeURIComponent(filenameStarMatch[1])
        } catch (error) {
            console.warn('Failed to decode filename from content-disposition.', error)
        }
    }

    const quotedMatch = /filename="?([^";]+)"?/i.exec(header)
    if (quotedMatch?.[1]) {
        return quotedMatch[1]
    }

    return null
}

const appendPathSegment = (basePath: string, segment: string): string => {
    const trimmedSegment = segment.trim()
    if (!trimmedSegment) {
        return basePath === '/' ? '/' : `${basePath}/`
    }
    if (basePath === '/' || basePath.length === 0) {
        return `/${trimmedSegment}`
    }
    return `${basePath}/${trimmedSegment}`
}

const delay = (ms: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
});
export const AppLayout = ({children}: AppLayoutProps) => {
    const styles = useStyles()
    const dispatch = useDispatch<AppDispatch>()
    const navigate = useNavigate()
    const {user, isAuthenticated} = useAuth()
    const rootDirectory = useSelector(selectDirectoryTreeRoot)
    const directoryLoading = useSelector(selectDirectoryTreeLoading)
    const directoryError = useSelector(selectDirectoryTreeError)
    const currentDirectory = useSelector(selectDirectoryTreeCurrentDirectory)
    const lastFetchedTenant = useSelector(selectDirectoryTreeLastFetchedTenant)
    const selectedFiles = useSelector(selectDirectoryTreeSelectedFileIds)
    const [viewportWidth, setViewportWidth] = useState(() =>
        typeof window === 'undefined' ? BREAKPOINTS.DESKTOP : window.innerWidth,
    )
    const [isNavMenuCollapsed, setIsNavMenuCollapsed] = useState<boolean>(() =>
        typeof window === 'undefined' ? false : window.innerWidth < BREAKPOINTS.TABLET,
    )
    const [detailsState, setDetailsState] = useState<FileDetailsState>({
        open: false,
        isLoading: false,
        error: null,
        data: null,
        resourceId: null,
    })
    const [createDirectoryState, setCreateDirectoryState] = useState<CreateDirectoryState>({
        open: false,
        name: '',
        isSubmitting: false,
        error: null,
    })
    const [softDeleteState, setSoftDeleteState] = useState<SoftDeleteState>({
        open: false,
        items: [],
        isSubmitting: false,
        error: null,
        successMessage: null,
    })
    const importFileInputRef = useRef<HTMLInputElement | null>(null)
    const [pendingImportType, setPendingImportType] = useState<'json' | 'xml' | 'pdf' | null>(null)
    const [importAccept, setImportAccept] = useState('')
    const [isImporting, setIsImporting] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [infoDialogState, setInfoDialogState] = useState<InfoDialogState>({
        open: false,
        title: 'Coming soon',
        description: 'This feature is under construction. Check back again shortly.',
        primaryLabel: 'Close',
        isLoading: false,
    })
    useEffect(() => {
        const tenantName = user?.tenant?.name
        if (!isAuthenticated || !tenantName) {
            return
        }
        const alreadyFetchedForTenant = lastFetchedTenant === tenantName
        if (alreadyFetchedForTenant || directoryLoading) {
            return
        }
        void dispatch(fetchDirectoryTree(tenantName));
    }, [dispatch, directoryLoading, isAuthenticated, lastFetchedTenant, user?.tenant?.name])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined
        }

        let rAFId: number | null = null

        const handleResize = () => {
            if (rAFId !== null) {
                return
            }
            rAFId = window.requestAnimationFrame(() => {
                setViewportWidth(window.innerWidth)
                rAFId = null
            })
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('resize', handleResize)
            if (rAFId !== null) {
                window.cancelAnimationFrame(rAFId)
            }
        }
    }, [])

    const isOverlayNav = viewportWidth < BREAKPOINTS.TABLET
    const navWidth = isOverlayNav ? 0 : getNavMenuWidth(isNavMenuCollapsed)
    const mainContainerStyle: CSSProperties = {
        gridTemplateColumns: isOverlayNav ? '1fr' : `${navWidth}px 1fr`,
    }

    const handleItemSelect = (item: DirectoryNode) => {
        dispatch(setCurrentDirectory(item.id))
        if (isOverlayNav) {
            setIsNavMenuCollapsed(true)
        }
    }

    const handleFileSelect = (fileIds: string[]) => {
        dispatch(setSelectedFiles(fileIds))
    }

    const handleNewDirectory = () => {
        setCreateDirectoryState({
            open: true,
            name: '',
            isSubmitting: false,
            error: null,
        })
    }

    const handleImportContent = (type: 'json' | 'xml' | 'pdf') => {
        if (!effectiveDirectory || !user?.tenant?.name) {
            return
        }

        const accept =
            type === 'json'
                ? 'application/json,.json'
                : type === 'xml'
                    ? 'application/xml,text/xml,.xml'
                    : 'application/pdf,.pdf'
        setPendingImportType(type)
        setImportAccept(accept)
        window.setTimeout(() => {
            importFileInputRef.current?.click()
        }, 0)
    }

    const handleCreateContent = (type: 'json' | 'xml') => {
        setInfoDialogState({
            open: true,
            title: `${type.toUpperCase()} creation coming soon`,
            description: 'Authoring new content directly from the dashboard is on the roadmap.',
            primaryLabel: 'Close',
            isLoading: false,
        })
    }

    const handleDownloadContent = async () => {
        if (selectedFiles.length !== 1 || !effectiveDirectory || !user?.tenant?.name || isDownloading) {
            return
        }

        const fileId = selectedFiles[0]
        const contentItem = effectiveDirectory.contentItems.find((item) => item.id === fileId)

        if (!contentItem) {
            return
        }

        const tenantName = user.tenant.name
        const resourcePath = contentItem.resource

        setIsDownloading(true)
        setInfoDialogState({
            open: true,
            title: 'Downloading file',
            description: `Preparing download for "${resourcePath}"...`,
            primaryLabel: 'Close',
            isLoading: true,
        })

        try {
            const response = await customAxios.get(`/v1/${tenantName}/${encodeURIComponent(resourcePath)}`, {
                responseType: 'blob',
            })

            const contentType = response.headers['content-type'] as string | undefined
            const contentDisposition = response.headers['content-disposition'] as string | undefined
            const fallbackName = resourcePath.split('/').pop() ?? resourcePath
            const downloadName =
                extractFilenameFromContentDisposition(contentDisposition) ?? fallbackName

            if (contentType?.includes('application/json')) {
                const payloadText = await response.data.text()
                const jsonDownloadName = downloadName.endsWith('.json')
                    ? downloadName
                    : `${downloadName}.json`
                try {
                    const payload = JSON.parse(payloadText) as { downloadUrl?: string; message?: string }
                    if (payload?.downloadUrl) {
                        const link = document.createElement('a')
                        link.href = payload.downloadUrl
                        link.target = '_blank'
                        link.rel = 'noopener'
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)

                        setInfoDialogState({
                            open: true,
                            title: 'Download ready',
                            description: 'The file is downloading in a new tab.',
                            primaryLabel: 'Close',
                            isLoading: false,
                        })
                        return
                    }

                    // Treat as a JSON file payload when metadata is not provided.
                    const blob = new Blob([payloadText], {
                        type: contentType ?? 'application/json',
                    })
                    const blobUrl = window.URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = blobUrl
                    link.download = jsonDownloadName
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    window.URL.revokeObjectURL(blobUrl)

                    setInfoDialogState({
                        open: true,
                        title: 'Download complete',
                        description: `File "${jsonDownloadName}" downloaded successfully.`,
                        primaryLabel: 'Close',
                        isLoading: false,
                    })
                    return
                } catch {
                    const blob = new Blob([payloadText], {
                        type: contentType ?? 'application/json',
                    })
                    const blobUrl = window.URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = blobUrl
                    link.download = jsonDownloadName
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    window.URL.revokeObjectURL(blobUrl)

                    setInfoDialogState({
                        open: true,
                        title: 'Download complete',
                        description: `File "${jsonDownloadName}" downloaded successfully.`,
                        primaryLabel: 'Close',
                        isLoading: false,
                    })
                    return
                }
            }

            const blob = response.data as Blob
            const blobUrl = window.URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = blobUrl
            link.download = downloadName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(blobUrl)

            setInfoDialogState({
                open: true,
                title: 'Download complete',
                description: `File "${downloadName}" downloaded successfully.`,
                primaryLabel: 'Close',
                isLoading: false,
            })
        } catch (error) {
            console.error('Failed to download file', error)
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to download the selected file. Please try again.'

            setInfoDialogState({
                open: true,
                title: 'Download failed',
                description: `Download failed. ${message}`,
                primaryLabel: 'Close',
                isLoading: false,
            })
        } finally {
            setIsDownloading(false)
        }
    }

    const handleDeleteContent = () => {
        if (!effectiveDirectory || selectedFiles.length === 0) {
            return
        }

        const parentPath = parentPathDisplay
        const items: SoftDeleteItem[] = selectedFiles
            .map((fileId) => effectiveDirectory.contentItems.find((item) => item.id === fileId))
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .map((item) => ({
                id: item.id,
                name: item.resource,
                path: appendPathSegment(parentPath, item.resource),
                resource: item.resource,
            }))

        if (items.length === 0) {
            return
        }

        setSoftDeleteState({
            open: true,
            items,
            isSubmitting: false,
            error: null,
            successMessage: null,
        })
    }

    const loadFileDetails = useCallback(async (tenantName: string, resourceId: string) => {
        setDetailsState(prev => ({...prev, isLoading: true, error: null}))
        try {
            const {data} = await customAxios.get<ContentItemDetails>(`/v1/${tenantName}/${encodeURIComponent(resourceId)}/details`)
            setDetailsState(prev => ({...prev, isLoading: false, data}))
        } catch (error) {
            let message = 'Failed to load file details'
            if (error instanceof Error) {
                message = error.message
            }
            setDetailsState(prev => ({...prev, isLoading: false, error: message}))
        }
    }, [])

    const effectiveDirectory = useMemo(() => currentDirectory ?? rootDirectory ?? null, [currentDirectory, rootDirectory])
    const parentPathSegments = useMemo(
        () => findDirectoryPathSegments(rootDirectory, effectiveDirectory?.id ?? null),
        [rootDirectory, effectiveDirectory?.id],
    )
    const parentPathDisplay = useMemo(() => buildPathString(parentPathSegments), [parentPathSegments])
    const proposedDirectoryPath = useMemo(
        () => appendPathSegment(parentPathDisplay, createDirectoryState.name.trim() || '(directory-name)'),
        [parentPathDisplay, createDirectoryState.name],
    )

    const handleSeeDetails = () => {
        const tenantName = user?.tenant?.name
        if (selectedFiles.length === 0 || !effectiveDirectory || !tenantName) {
            return
        }

        const fileId = selectedFiles[0]
        const file = effectiveDirectory.contentItems.find(item => item.id === fileId)
        if (!file) {
            return
        }

        setDetailsState({
            open: true,
            isLoading: true,
            error: null,
            data: null,
            resourceId: file.resource,
        })

        void loadFileDetails(tenantName, file.resource)
    }

    const handleCloseDetails = () => {
        setDetailsState(prev => ({...prev, open: false}))
    }

    const handleRetryDetails = () => {
        const tenantName = user?.tenant?.name
        if (!detailsState.resourceId || !tenantName) {
            return
        }
        setDetailsState(prev => ({...prev, isLoading: true, error: null}))
        void loadFileDetails(tenantName, detailsState.resourceId)
    }

    const handleDirectoryNameChange = (value: string) => {
        setCreateDirectoryState(prev => ({
            ...prev,
            name: value,
            error: null,
        }))
    }

    const handleCancelCreateDirectory = () => {
        if (createDirectoryState.isSubmitting) {
            return
        }
        setCreateDirectoryState({
            open: false,
            name: '',
            isSubmitting: false,
            error: null,
        })
    }

    const handleSubmitCreateDirectory = async () => {
        const tenantName = user?.tenant?.name
        const parentDirectory = effectiveDirectory

        if (!tenantName || !parentDirectory) {
            setCreateDirectoryState(prev => ({
                ...prev,
                error: 'Missing tenant or directory context. Please try again.',
            }))
            return
        }

        const trimmedName = createDirectoryState.name.trim()
        if (!trimmedName) {
            setCreateDirectoryState(prev => ({
                ...prev,
                error: 'Directory name is required.',
            }))
            return
        }

        const hasDuplicate = parentDirectory.subDirectories.some(
            (directory) => directory.name.toLowerCase() === trimmedName.toLowerCase(),
        )

        if (hasDuplicate) {
            setCreateDirectoryState(prev => ({
                ...prev,
                error: `A directory named "${trimmedName}" already exists here.`,
            }))
            return
        }

        setCreateDirectoryState(prev => ({
            ...prev,
            isSubmitting: true,
            error: null,
        }))

        try {
            await customAxios.post(`/v1/${tenantName}/directories`, {
                name: trimmedName,
                parentId: parentDirectory.id,
            })

            setCreateDirectoryState({
                open: false,
                name: '',
                isSubmitting: false,
                error: null,
            })

            await dispatch(fetchDirectoryTree(tenantName))
        } catch (error: unknown) {
            let message = 'Failed to create directory.'
            if (isAxiosError(error)) {
                if (error.response?.status === 409) {
                    message = `A directory named "${trimmedName}" already exists here.`
                } else if (error.response?.data && typeof error.response.data === 'object') {
                    const dataMessage = (error.response.data as { message?: string }).message
                    if (dataMessage) {
                        message = dataMessage
                    }
                } else if (error.message) {
                    message = error.message
                }
            } else if (error instanceof Error) {
                message = error.message
            }

            setCreateDirectoryState(prev => ({
                ...prev,
                isSubmitting: false,
                error: message,
            }))
        }
    }

    const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''

        if (!pendingImportType || !file) {
            setPendingImportType(null)
            return
        }

        if (!effectiveDirectory || !user?.tenant?.name) {
            setPendingImportType(null)
            return
        }

        const tenantName = user.tenant.name

        const sanitizedResourceName = sanitizeResourceName(file.name)
        const targetPath = appendPathSegment(parentPathDisplay, sanitizedResourceName)

        if (pendingImportType === 'json') {
            const reader = new FileReader()
            reader.onload = () => {
                void (async () => {
                    try {
                        const text =
                            typeof reader.result === 'string'
                                ? reader.result
                                : new TextDecoder().decode(reader.result as ArrayBuffer)

                        JSON.parse(text)
                        const resourceName = sanitizedResourceName

                        await customAxios.put(`/v1/${tenantName}/${encodeURIComponent(resourceName)}`, text, {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Directory-Id': effectiveDirectory.id,
                            },
                        })

                        await dispatch(fetchDirectoryTree(tenantName))

                        setInfoDialogState({
                            open: true,
                            title: 'Import complete',
                            description: `File "${file.name}" imported successfully to ${targetPath}.`,
                            primaryLabel: 'Close',
                            isLoading: false,
                        })
                    } catch (error) {
                        console.error('Failed to import JSON file', error)
                        setInfoDialogState({
                            open: true,
                            title: 'JSON upload failed',
                            description: 'There was a problem uploading the file. Please verify the contents and try again.',
                            primaryLabel: 'Close',
                        })
                        setInfoDialogState(prev => ({
                            ...prev,
                            isLoading: false,
                        }))
                    } finally {
                        setIsImporting(false)
                        setPendingImportType(null)
                    }
                })()
            }
            reader.onerror = () => {
                console.error('Failed to read JSON file', reader.error)
                setInfoDialogState({
                    open: true,
                    title: 'File read error',
                    description: 'Unable to read the selected JSON file. Please try again.',
                    primaryLabel: 'Close',
                    isLoading: false,
                })
                setIsImporting(false)
                setPendingImportType(null)
            }
            setIsImporting(true)
            setInfoDialogState({
                open: true,
                title: 'Importing JSON',
                description: `Uploading "${file.name}"...`,
                primaryLabel: 'Close',
                isLoading: true,
            })
            reader.readAsText(file)
            return
        }

        if (pendingImportType === 'xml') {
            const reader = new FileReader()
            reader.onload = () => {
                void (async () => {
                    try {
                        const text =
                            typeof reader.result === 'string'
                                ? reader.result
                                : new TextDecoder().decode(reader.result as ArrayBuffer)

                        const parser = new DOMParser()
                        const parsedDoc = parser.parseFromString(text, 'application/xml')
                        if (parsedDoc.getElementsByTagName('parsererror').length > 0) {
                            throw new Error('Invalid XML format')
                        }

                        const resourceName = sanitizedResourceName

                        await customAxios.put(`/v1/${tenantName}/${encodeURIComponent(resourceName)}`, text, {
                            headers: {
                                'Content-Type': 'application/xml',
                                'X-Directory-Id': effectiveDirectory.id,
                            },
                        })

                        await dispatch(fetchDirectoryTree(tenantName))

                        setInfoDialogState({
                            open: true,
                            title: 'Import complete',
                            description: `File "${file.name}" imported successfully to ${targetPath}.`,
                            primaryLabel: 'Close',
                            isLoading: false,
                        })
                    } catch (error) {
                        console.error('Failed to import XML file', error)
                        setInfoDialogState({
                            open: true,
                            title: 'XML upload failed',
                            description: 'There was a problem uploading the XML file. Please verify the contents and try again.',
                            primaryLabel: 'Close',
                            isLoading: false,
                        })
                    } finally {
                        setIsImporting(false)
                        setPendingImportType(null)
                    }
                })()
            }
            reader.onerror = () => {
                console.error('Failed to read XML file', reader.error)
                setInfoDialogState({
                    open: true,
                    title: 'File read error',
                    description: 'Unable to read the selected XML file. Please try again.',
                    primaryLabel: 'Close',
                    isLoading: false,
                })
                setIsImporting(false)
                setPendingImportType(null)
            }
            setIsImporting(true)
            setInfoDialogState({
                open: true,
                title: 'Importing XML',
                description: `Uploading "${file.name}"...`,
                primaryLabel: 'Close',
                isLoading: true,
            })
            reader.readAsText(file)
            return
        }

        if (pendingImportType === 'pdf') {
            setIsImporting(true)
            setInfoDialogState({
                open: true,
                title: 'Importing PDF',
                description: `Uploading "${file.name}"...`,
                primaryLabel: 'Close',
                isLoading: true,
            })

            void (async () => {
                try {
                    const resourceName = sanitizedResourceName

                    await customAxios.put(
                        `/v1/${tenantName}/${encodeURIComponent(resourceName)}`,
                        file,
                        {
                            headers: {
                                'Content-Type': file.type || 'application/pdf',
                                'X-Directory-Id': effectiveDirectory.id,
                            },
                        },
                    )

                    await dispatch(fetchDirectoryTree(tenantName))

                    setInfoDialogState({
                        open: true,
                        title: 'Import complete',
                        description: `File "${file.name}" imported successfully to ${targetPath}.`,
                        primaryLabel: 'Close',
                        isLoading: false,
                    })
                } catch {
                    setInfoDialogState({
                        open: true,
                        title: 'PDF upload failed',
                        description: 'There was a problem uploading the PDF file. Please try again.',
                        primaryLabel: 'Close',
                        isLoading: false,
                    })
                } finally {
                    setIsImporting(false)
                    setPendingImportType(null)
                }
            })()

            return
        }

        setPendingImportType(null)
    }

    const handleCancelSoftDelete = () => {
        if (softDeleteState.isSubmitting) {
            return
        }
        setSoftDeleteState({
            open: false,
            items: [],
            isSubmitting: false,
            error: null,
            successMessage: null,
        })
    }

    const handleConfirmSoftDelete = async () => {
        const tenantName = user?.tenant?.name
        if (!tenantName || softDeleteState.items.length === 0) {
            return
        }

        setSoftDeleteState(prev => ({
            ...prev,
            isSubmitting: true,
            error: null,
        }))

        try {
            await delay(2000)

            const resources = softDeleteState.items.map((item) => item.resource)
            await customAxios.delete(`/v1/${tenantName}/bulk-delete`, {
                data: {
                    resources,
                },
            })

            const removedCount = resources.length

            setSoftDeleteState({
                open: true,
                items: [],
                isSubmitting: false,
                error: null,
                successMessage: `${removedCount} file${removedCount === 1 ? '' : 's'} successfully removed.`,
            })

            dispatch(setSelectedFiles([]))

            if (rootDirectory?.id) {
                dispatch(setCurrentDirectory(rootDirectory.id))
            }

            await dispatch(fetchDirectoryTree(tenantName))
        } catch (error: unknown) {
            let message = 'Failed to delete selected items.'
            if (isAxiosError(error)) {
                const apiMessage = (error.response?.data as { message?: string } | undefined)?.message
                if (apiMessage) {
                    message = apiMessage
                } else if (error.message) {
                    message = error.message
                }
            } else if (error instanceof Error) {
                message = error.message
            }

            setSoftDeleteState(prev => ({
                ...prev,
                isSubmitting: false,
                error: message,
                successMessage: null,
            }))
        }
    }

    const handleDismissInfoDialog = () => {
        setInfoDialogState(prev => ({ ...prev, open: false, isLoading: false }))
    }

    const handleOpenJsonViewer = (resourceId: string, details: ContentItemDetails | null) => {
        if (!resourceId) {
            return
        }

        const tenantName = user?.tenant?.name

        setDetailsState(prev => ({...prev, open: false}))
        navigate('/tools/json-viewer', {
            state: {
                resourceId,
                metadata: details,
                tenantName,
                contentType: details?.contentType,
                fileExtension: details?.metadata?.fileExtension,
                version: details?.latestVersion,
                viewer: 'json' as const,
            },
        })
    }

    const handleOpenXmlViewer = (resourceId: string, details: ContentItemDetails | null) => {
        if (!resourceId) {
            return
        }

        const tenantName = user?.tenant?.name

        setDetailsState(prev => ({ ...prev, open: false }))
        navigate('/tools/xml-viewer', {
            state: {
                resourceId,
                metadata: details,
                tenantName,
                contentType: details?.contentType,
                fileExtension: details?.metadata?.fileExtension,
                version: details?.latestVersion,
                viewer: 'xml' as const,
            },
        })
    }

    const handleRefresh = () => {
        const tenantName = user?.tenant?.name
        if (tenantName) {
            void dispatch(fetchDirectoryTree(tenantName))
        }
    }

    const handleToggleNavMenu = () => {
        setIsNavMenuCollapsed(prev => !prev)
    }

    return (
        <div className={styles.appContainer}>
            {/* Header spans full width */}
            <Header onToggleNavMenu={handleToggleNavMenu}/>

            {isOverlayNav && !isNavMenuCollapsed && (
                <div
                    className={styles.overlayBackdrop}
                    onClick={() => setIsNavMenuCollapsed(true)}
                    role="presentation"
                    aria-hidden="true"
                />
            )}

            <div className={styles.mainContainer} style={mainContainerStyle}>
                {/* Fixed sidebar */}
                <NavMenu
                    root={rootDirectory}
                    onItemSelect={handleItemSelect}
                    selectedItemId={effectiveDirectory?.id ?? null}
                    isCollapsed={isNavMenuCollapsed}
                    isOverlay={isOverlayNav}
                    onDismissOverlay={() => setIsNavMenuCollapsed(true)}
                    isLoading={directoryLoading}
                    error={directoryError}
                />

                {/* Main content area */}
                <div className={styles.contentWrapper}>
                    {/* ActionBar */}
                    <div className={styles.actionBarWrapper}>
                        <ActionBar
                            hasSelection={selectedFiles.length > 0}
                            selectedFilesCount={selectedFiles.length}
                            onToggleFavorite={() => console.log('Toggle favorite (AppLayout) for:', selectedFiles)}
                            onNewDirectory={handleNewDirectory}
                            disableNewDirectory={!effectiveDirectory || !user?.tenant?.name}
                            onImportContent={handleImportContent}
                            onCreateContent={handleCreateContent}
                            disableImportContent={!effectiveDirectory || !user?.tenant?.name || isImporting}
                            canDownload={selectedFiles.length === 1 && !isDownloading}
                            onDownloadContent={handleDownloadContent}
                            disableCreateContent={!user?.tenant?.name}
                            onDeleteContent={handleDeleteContent}
                            onSeeDetails={handleSeeDetails}
                            onRefresh={handleRefresh}
                        />
                    </div>

                    {/* Main content */}
                    <div className={styles.mainContent}>
                        <ContentArea
                            selectedItem={effectiveDirectory}
                            selectedFiles={selectedFiles}
                            onFileSelect={handleFileSelect}
                            isLoading={directoryLoading}
                            error={directoryError}
                        />
                        {children}
                    </div>
                </div>
            </div>

            {/* Footer spans full width */}
            <Footer/>

            <CreateDirectoryDialog
                open={createDirectoryState.open}
                directoryName={createDirectoryState.name}
                parentPath={proposedDirectoryPath}
                isSubmitting={createDirectoryState.isSubmitting}
                errorMessage={createDirectoryState.error}
                onNameChange={handleDirectoryNameChange}
                onCancel={handleCancelCreateDirectory}
                onSubmit={handleSubmitCreateDirectory}
            />
            <SoftDeleteDialog
                open={softDeleteState.open}
                items={softDeleteState.items}
                isSubmitting={softDeleteState.isSubmitting}
                errorMessage={softDeleteState.error}
                successMessage={softDeleteState.successMessage}
                onCancel={handleCancelSoftDelete}
                onConfirm={handleConfirmSoftDelete}
            />
            <InfoDialog
                open={infoDialogState.open}
                title={infoDialogState.title}
                description={infoDialogState.description}
                primaryLabel={infoDialogState.primaryLabel}
                isLoading={infoDialogState.isLoading}
                onDismiss={handleDismissInfoDialog}
            />
            <input
                type="file"
                ref={importFileInputRef}
                accept={importAccept}
                style={{ display: 'none' }}
                onChange={handleImportFileChange}
                disabled={isImporting}
                aria-label='Import file input'
            />
            <FileDetailsModal
                open={detailsState.open}
                details={detailsState.data}
                isLoading={detailsState.isLoading}
                error={detailsState.error}
                resourceId={detailsState.resourceId}
                onClose={handleCloseDetails}
                onRetry={detailsState.error ? handleRetryDetails : undefined}
                onOpenJsonViewer={handleOpenJsonViewer}
                onOpenXmlViewer={handleOpenXmlViewer}
            />
        </div>
    )
}

// Context will be added later if needed for sharing state between components
