import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type SyntheticEvent,
} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {useSelector} from 'react-redux';
import {
    Button,
    Textarea,
    makeStyles,
    tokens,
    Subtitle1,
    Text,
    MessageBar,
    Card,
    CardHeader,
    CardFooter,
    Spinner,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Combobox,
    Option,
    Label,
    Caption1,
} from '@fluentui/react-components';
import {ArrowLeftRegular, CheckmarkRegular, ArrowImportRegular} from '@fluentui/react-icons';
import JsonView from '@uiw/react-json-view';
import XMLReader from '@uiw/react-xml-reader';
import {XMLBuilder, XMLParser} from 'fast-xml-parser';
import {MainLayout} from '../layout';
import type {ContentItemDetails} from '../types/content';
import {useAuth} from '../contexts';
import customAxios from '../utilities/custom-axios';
import {
    selectDirectoryTreeRoot,
    type ContentItemNode,
    type DirectoryNode,
} from '../store/slices/directoryTree';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<contentItem>
  <title>XML Payload</title>
  <status>draft</status>
  <tags>
    <tag>news</tag>
    <tag>release</tag>
  </tags>
  <metadata>
    <author>CMS Lite</author>
    <createdAt>2025-01-12T09:45:00.000Z</createdAt>
    <lastEditedBy>editor@example.com</lastEditedBy>
  </metadata>
  <body>
    <section heading="XML Viewer Page">
      <paragraph>Paste XML in the panel to inspect the structure.</paragraph>
    </section>
  </body>
</contentItem>`;

const xmlParserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: false,
} as const;

const xmlBuilderOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    suppressEmptyNode: true,
    format: true,
    indentBy: '  ',
};

const useStyles = makeStyles({
    pageRoot: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXL,
        flex: 1,
        minHeight: 0,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalM,
    },
    editorsWrapper: {
        display: 'grid',
        gap: tokens.spacingHorizontalXL,
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        alignItems: 'stretch',
        gridAutoRows: '1fr',
        flex: 1,
        minHeight: 0,
    },
    inputCard: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: tokens.colorNeutralBackground2,
        gap: tokens.spacingVerticalM,
        minHeight: '320px',
        overflow: 'hidden',
    },
    inputCardBody: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
    },
    textarea: {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        overflow: 'hidden',
        '& textarea': {
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
        },
    },
    viewerCard: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: tokens.colorNeutralBackground2,
        //minHeight: '320px',
        overflow: 'hidden',
    },
    viewerContainer: {
        flex: 1,
        overflow: 'auto',
        padding: tokens.spacingHorizontalL,
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke3}`,
        minHeight: 0,
    },
    importSections: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
    },
    importCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    importActions: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        flexWrap: 'wrap',
    },
    hiddenInput: {
        position: 'absolute',
        opacity: 0,
        pointerEvents: 'none',
        width: 0,
        height: 0,
    },
});

const viewerTheme: Record<string, string> = {
    base00: tokens.colorNeutralBackground1,
    base01: tokens.colorNeutralBackground2,
    base02: tokens.colorNeutralBackground3,
    base03: tokens.colorNeutralForeground2,
    base04: tokens.colorNeutralForeground3,
    base05: tokens.colorNeutralForeground1,
    base06: tokens.colorNeutralForegroundDisabled,
    base07: tokens.colorNeutralForeground2,
    string: tokens.colorPaletteGreenForeground2,
    number: tokens.colorPaletteBlueForeground2,
    boolean: tokens.colorPaletteTealForeground2,
    null: tokens.colorPaletteMarigoldForeground2,
    backgroundColor: tokens.colorNeutralBackground1,
};

type XmlViewerRouteState = {
    resourceId?: string
    metadata?: ContentItemDetails | Record<string, unknown>
    xml?: string
    rawXml?: string
    tenantName?: string
    contentType?: string
    fileExtension?: string
    version?: number
    viewer?: 'xml'
}

type XmlDisplayValue = Record<string, unknown> | Array<unknown>

type PayloadSource = 'provided-xml' | 'raw-xml' | 'metadata' | 'sample' | 'fetched'

type CmsResourceOption = {
    key: string
    resourceId: string
    label: string
    version: number
    contentType?: string
}

const ensureDisplayValue = (value: unknown): XmlDisplayValue => {
    if (Array.isArray(value)) {
        return value
    }

    if (value && typeof value === 'object') {
        return value as XmlDisplayValue
    }

    return {value}
}

const parserFromString = (value: string) => {
    const parser = new XMLParser(xmlParserOptions)
    return parser.parse(value)
}

const builderFromObject = (value: unknown) => {
    const builder = new XMLBuilder(xmlBuilderOptions)
    return builder.build(value)
}

const sanitizeXmlText = (value: string): string => {
    const lines = value.split(/\r?\n/)
    const sanitized: string[] = []
    let previousBlank = false

    lines.forEach((line) => {
        const lineWithoutTrailing = line.replace(/\s+$/u, '')
        const isBlank = lineWithoutTrailing.trim().length === 0
        if (isBlank) {
            if (!previousBlank && sanitized.length > 0) {
                sanitized.push('')
            }
            previousBlank = true
        } else {
            sanitized.push(lineWithoutTrailing)
            previousBlank = false
        }
    })

    return sanitized.join('\n').trim()
}

const normalizeXmlPayload = (
    value: unknown,
    options?: { wrapRootName?: string },
): { parsed: XmlDisplayValue; formatted: string } => {
    if (typeof value === 'string') {
        try {
            const parsed = parserFromString(value)
            const displayValue = ensureDisplayValue(parsed)
            const formatted = sanitizeXmlText(builderFromObject(parsed))
            return {parsed: displayValue, formatted}
        } catch (error) {
            console.warn('Failed to parse XML string; falling back to raw text.', error)
            return {parsed: {value}, formatted: sanitizeXmlText(value)}
        }
    }

    if (value && typeof value === 'object') {
        const displayValue = ensureDisplayValue(value)
        try {
            const formatted = builderFromObject(
                options?.wrapRootName ? {[options.wrapRootName]: value} : value,
            )
            return {parsed: displayValue, formatted: sanitizeXmlText(formatted)}
        } catch (error) {
            console.warn('Failed to convert object to XML; falling back to string representation.', error)
            return {parsed: displayValue, formatted: JSON.stringify(value, null, 2)}
        }
    }

    return normalizeXmlPayload({value})
}

const isXmlContentItem = (item: ContentItemNode): boolean => {
    const contentType = item.contentType?.toLowerCase() ?? ''
    const resource = item.resource.toLowerCase()
    return contentType.includes('xml') || resource.endsWith('.xml')
}

const flattenXmlContentItems = (root: DirectoryNode | null): CmsResourceOption[] => {
    if (!root) {
        return []
    }

    const items: CmsResourceOption[] = []

    const traverse = (node: DirectoryNode, parents: string[]) => {
        const pathParts = [...parents, node.name].filter(Boolean)
        const pathPrefix = pathParts.join('/')

        node.contentItems.forEach((item) => {
            if (!isXmlContentItem(item)) {
                return
            }

            const label = pathPrefix ? `${pathPrefix}/${item.resource}` : item.resource
            items.push({
                key: item.id,
                resourceId: item.resource,
                label,
                version: item.latestVersion,
                contentType: item.contentType,
            })
        })

        node.subDirectories.forEach((child) => traverse(child, pathParts))
    }

    traverse(root, [])
    return items.sort((a, b) => a.label.localeCompare(b.label))
}

const deriveInitialPayload = (state: XmlViewerRouteState | null) => {
    if (state?.xml) {
        const normalized = normalizeXmlPayload(state.xml)
        return {...normalized, source: 'provided-xml' as PayloadSource}
    }

    if (state?.rawXml) {
        const normalized = normalizeXmlPayload(state.rawXml)
        return {...normalized, source: 'raw-xml' as PayloadSource}
    }

    if (state?.metadata) {
        const normalized = normalizeXmlPayload(state.metadata, {wrapRootName: 'metadata'})
        return {...normalized, source: 'metadata' as PayloadSource}
    }

    const normalized = normalizeXmlPayload(SAMPLE_XML)
    return {...normalized, source: 'sample' as PayloadSource}
}

export const XmlViewer = () => {
    const styles = useStyles()
    const navigate = useNavigate()
    const location = useLocation()
    const routeState = location.state as XmlViewerRouteState | null
    const sourceResourceId = routeState?.resourceId ?? null
    const {user} = useAuth()
    const directoryRoot = useSelector(selectDirectoryTreeRoot)
    const cmsXmlOptions = useMemo(() => flattenXmlContentItems(directoryRoot), [directoryRoot])
    const cmsOptionsByKey = useMemo(() => {
        const map = new Map<string, CmsResourceOption>()
        cmsXmlOptions.forEach((option) => {
            map.set(option.key, option)
        });
        return map;
    }, [cmsXmlOptions]);
    const initialPayload = useMemo(() => deriveInitialPayload(routeState), [routeState])
    const [payloadSource, setPayloadSource] = useState<PayloadSource>(initialPayload.source)
    const [input, setInput] = useState(initialPayload.formatted)
    const [parsedXml, setParsedXml] = useState<XmlDisplayValue>(initialPayload.parsed)
    const [parseError, setParseError] = useState<string | null>(null)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [isFetching, setIsFetching] = useState(false)
    const [sourceDescription, setSourceDescription] = useState<string | null>(sourceResourceId)

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)
    const [selectedCmsOption, setSelectedCmsOption] = useState<CmsResourceOption | null>(null)
    const [cmsComboboxValue, setCmsComboboxValue] = useState('')
    const [isImportingCms, setIsImportingCms] = useState(false)
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

    const xmlReaderRef = useRef<HTMLInputElement | null>(null)

    const tenantName = routeState?.tenantName ?? user?.tenant?.name ?? null
    const version = routeState?.version
    const viewer = routeState?.viewer ?? 'xml'

    useEffect(() => {
        setPayloadSource(initialPayload.source)
        setInput(initialPayload.formatted)
        setParsedXml(initialPayload.parsed)
        setParseError(null)
        setFetchError(null)

        if (sourceResourceId) {
            setSourceDescription(sourceResourceId)
        } else if (initialPayload.source === 'sample') {
            setSourceDescription(null)
        }
    }, [initialPayload, sourceResourceId])

    const loadResourcePayload = useCallback(
        async (
            resourceId: string,
            options?: { version?: number; label?: string },
        ): Promise<{ success: boolean; error?: string }> => {
            if (!tenantName) {
                const message = 'Missing tenant context; cannot load XML payload.'
                setFetchError(message)
                return {success: false, error: message}
            }

            setIsFetching(true)
            setFetchError(null)

            try {
                const params = options?.version ? {version: options.version} : undefined
                const {data} = await customAxios.get<string>(
                    `/v1/${tenantName}/${encodeURIComponent(resourceId)}`,
                    {
                        params,
                        responseType: 'text',
                        transformResponse: [(data) => data],
                    },
                )
                const normalized = normalizeXmlPayload(data ?? '')
                setParsedXml(normalized.parsed)
                setInput(normalized.formatted)
                setPayloadSource('fetched')
                setParseError(null)
                setSourceDescription(options?.label ?? resourceId)
                return {success: true}
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load XML payload from server.'
                setFetchError(message)
                return {success: false, error: message}
            } finally {
                setIsFetching(false)
            }
        },
        [tenantName],
    )

    useEffect(() => {
        if (viewer !== 'xml') {
            return
        }

        if (!sourceResourceId) {
            return
        }

        if (
            payloadSource === 'provided-xml' ||
            payloadSource === 'raw-xml' ||
            payloadSource === 'fetched'
        ) {
            return
        }

        void loadResourcePayload(sourceResourceId, {version})
    }, [viewer, sourceResourceId, payloadSource, version, loadResourcePayload])

    const isMetadataPayload = payloadSource === 'metadata'

    const handleFormat = () => {
        try {
            const normalized = normalizeXmlPayload(input)
            setParsedXml(normalized.parsed)
            setInput(normalized.formatted)
            setParseError(null)
            setPayloadSource('provided-xml')
        } catch (error) {
            setParseError(error instanceof Error ? error.message : 'Unable to parse XML input')
        }
    }

    const openImportDialog = () => {
        setImportError(null)
        setSelectedCmsOption(null)
        setCmsComboboxValue('')
        setSelectedFileName(null)
        setIsImportDialogOpen(true)
    }

    const closeImportDialog = () => {
        if (isImportingCms) {
            return
        }
        setIsImportDialogOpen(false)
        setImportError(null)
        setSelectedCmsOption(null)
        setCmsComboboxValue('')
        setSelectedFileName(null)
    }

    const handleBrowseDevice = () => {
        setImportError(null)
        xmlReaderRef.current?.click()
    }

    const handleDeviceFileLoaded = (
        data: unknown,
        fileInfo: { name: string },
        _original: File,
        text: string,
    ) => {
        try {
            const normalized = normalizeXmlPayload(text || data)
            setParsedXml(normalized.parsed)
            setInput(normalized.formatted)
            setParseError(null)
            setPayloadSource('raw-xml')
            setSelectedFileName(fileInfo.name)
            setImportError(null)
            setSourceDescription(fileInfo.name)
            setIsImportDialogOpen(false)
        } catch (error) {
            setImportError(
                error instanceof Error ? error.message : 'Unable to parse the selected XML file.',
            )
        }
    }

    const handleDeviceFileError = (error: Error) => {
        setImportError(error.message)
    }

    const handleImportFromCms = async () => {
        if (!selectedCmsOption) {
            return
        }

        setIsImportingCms(true)
        const result = await loadResourcePayload(selectedCmsOption.resourceId, {
            version: selectedCmsOption.version,
            label: selectedCmsOption.label,
        })
        setIsImportingCms(false)

        if (result.success) {
            setImportError(null)
            setSelectedCmsOption(null)
            setCmsComboboxValue('')
            setIsImportDialogOpen(false)
        } else if (result.error) {
            setImportError(result.error)
        }
    }

    const subtitle = sourceDescription
        ? `Inspect payload for ${sourceDescription}`
        : 'Inspect XML payloads without leaving the Fluent UI shell.'

    return (
        <MainLayout variant="viewer">
            <div className={styles.pageRoot}>
                <div className={styles.headerRow}>
                    <Button
                        icon={<ArrowLeftRegular/>}
                        appearance="secondary"
                        onClick={() => navigate('/dashboard')}
                    >
                        Back to Content Explorer
                    </Button>
                    <Subtitle1>{subtitle}</Subtitle1>
                </div>

                <div className={styles.editorsWrapper}>
                    <Card className={styles.inputCard}>
                        <CardHeader
                            header={<Text weight="semibold">XML Input</Text>}
                            description="Paste or edit the payload, then format to refresh the viewer."
                        />
                        <div className={styles.inputCardBody}>
                            <Textarea
                                className={styles.textarea}
                                value={input}
                                onChange={(_, data) => setInput(data.value)}
                                resize="none"
                                appearance="outline"
                            />
                        </div>
                        <CardFooter>
                            <Button icon={<CheckmarkRegular/>} appearance="primary" onClick={handleFormat}>
                                Format XML
                            </Button>
                            <Button
                                icon={<ArrowImportRegular/>}
                                appearance="secondary"
                                onClick={openImportDialog}
                            >
                                Import XML
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className={styles.viewerCard}>
                        <CardHeader
                            header={<Text weight="semibold">Viewer</Text>}
                            description="Expand the tree to inspect deeply nested structures."
                        />
                        {isMetadataPayload && (
                            <MessageBar intent="info">
                                Showing file metadata. Load the XML payload to inspect the full content.
                            </MessageBar>
                        )}
                        {fetchError && <MessageBar intent="error">{fetchError}</MessageBar>}
                        {parseError ? (
                            <MessageBar intent="error">{parseError}</MessageBar>
                        ) : (
                            <div className={styles.viewerContainer}>
                                {isFetching ? (
                                    <Spinner label="Loading XML payload"/>
                                ) : (
                                    <JsonView
                                        value={parsedXml}
                                        displayDataTypes={false}
                                        collapsed={2}
                                        enableClipboard={false}
                                        style={{
                                            ...viewerTheme,
                                            fontFamily: '"Segoe UI", sans-serif',
                                            fontSize: '14px',
                                            lineHeight: '1.5',
                                        } as CSSProperties}
                                    />
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            <Dialog
                open={isImportDialogOpen}
                onOpenChange={(_event: SyntheticEvent<HTMLElement>, data: { open: boolean }) => {
                    if (!data.open) {
                        closeImportDialog()
                    }
                }}
            >
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Import XML</DialogTitle>
                        <DialogContent>
                            {importError && <MessageBar intent="error">{importError}</MessageBar>}
                            <div className={styles.importSections}>
                                <Card className={styles.importCard}>
                                    <Text weight="semibold">From your device</Text>
                                    <Caption1>
                                        Upload an .xml file from your computer. Its contents replace the current viewer
                                        payload.
                                    </Caption1>
                                    <div className={styles.importActions}>
                                        <Button icon={<ArrowImportRegular/>} onClick={handleBrowseDevice}>
                                            Choose file
                                        </Button>
                                        {selectedFileName && <Caption1>{selectedFileName}</Caption1>}
                                    </div>
                                </Card>

                                <Card className={styles.importCard}>
                                    <Text weight="semibold">From CMS</Text>
                                    <Caption1>Pick an XML asset already stored in the content tree.</Caption1>
                                    <Label htmlFor="cms-xml-combobox">XML resources</Label>
                                    <Combobox
                                        id="cms-xml-combobox"
                                        placeholder={
                                            cmsXmlOptions.length > 0
                                                ? 'Search XML files'
                                                : 'No XML files available'
                                        }
                                        value={cmsComboboxValue}
                                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                            setCmsComboboxValue(event.target.value)
                                            setSelectedCmsOption(null)
                                            setImportError(null)
                                        }}
                                        onOptionSelect={(event: SyntheticEvent<HTMLElement>, data: {
                                            optionValue?: string
                                        }) => {
                                            void event
                                            if (!data.optionValue) {
                                                return
                                            }
                                            const option = cmsOptionsByKey.get(data.optionValue)
                                            if (option) {
                                                setSelectedCmsOption(option)
                                                setCmsComboboxValue(option.label)
                                                setImportError(null)
                                            }
                                        }}
                                        disabled={cmsXmlOptions.length === 0}
                                    >
                                        {cmsXmlOptions.map((option) => (
                                            <Option key={option.key} value={option.key} text={option.label}>
                                                {option.label}
                                            </Option>
                                        ))}
                                    </Combobox>
                                    <div className={styles.importActions}>
                                        <Button
                                            appearance="primary"
                                            disabled={!selectedCmsOption || isImportingCms}
                                            onClick={handleImportFromCms}
                                        >
                                            {isImportingCms ? 'Loading...' : 'Load selection'}
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={closeImportDialog} disabled={isImportingCms}>
                                Cancel
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            <XMLReader
                ref={xmlReaderRef}
                accept="application/xml,text/xml,.xml"
                className={styles.hiddenInput}
                onFileLoaded={handleDeviceFileLoaded}
                onError={handleDeviceFileError}
                parserOptions={xmlParserOptions}
            />
        </MainLayout>
    )
};

export default XmlViewer;
