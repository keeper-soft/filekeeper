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
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
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
import { ArrowLeftRegular, CheckmarkRegular, ArrowImportRegular } from '@fluentui/react-icons';
import JsonView from '@uiw/react-json-view';
import { MainLayout } from '../layout';
import type { ContentItemDetails } from '../types/content';
import { useAuth } from '../contexts';
import customAxios from '../utilities/custom-axios';
import {
  selectDirectoryTreeRoot,
  type ContentItemNode,
  type DirectoryNode,
} from '../store/slices/directoryTree';

const SAMPLE_JSON = {
  title: 'Content Item',
  status: 'draft',
  tags: ['news', 'release'],
  metadata: {
    author: 'CMS Lite',
    createdAt: '2025-01-12T09:45:00.000Z',
    lastEditedBy: 'editor@example.com',
  },
  body: {
    blocks: [
      { type: 'heading', level: 2, text: 'JSON Viewer Page' },
      { type: 'paragraph', text: 'Paste JSON in the panel to inspect the structure.' },
    ],
  },
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
    minHeight: '320px',
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

type JsonViewerRouteState = {
  resourceId?: string
  metadata?: ContentItemDetails | Record<string, unknown>
  json?: Record<string, unknown> | Array<unknown>
  rawJson?: string
  tenantName?: string
  contentType?: string
  fileExtension?: string
  version?: number
  viewer?: 'json'
}

type JsonLike = Record<string, unknown> | Array<unknown>

type PayloadSource = 'provided-json' | 'raw-json' | 'metadata' | 'sample' | 'fetched'

type CmsResourceOption = {
  key: string
  resourceId: string
  label: string
  version: number
  contentType?: string
}

const jsonReplacer = (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value, jsonReplacer, 2) ?? ''
  } catch (error) {
    console.warn('Failed to stringify value; falling back to string conversion.', error)
    return String(value)
  }
}

const ensureJsonLike = (value: unknown): JsonLike => {
  if (Array.isArray(value)) {
    return value
  }
  if (value && typeof value === 'object') {
    return value as JsonLike
  }
  return { value }
}

const normalizePayload = (value: unknown): { parsed: JsonLike; formatted: string } => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      const jsonLike = ensureJsonLike(parsed)
      return { parsed: jsonLike, formatted: safeStringify(jsonLike) }
    } catch {
      return { parsed: { value }, formatted: value }
    }
  }
  const jsonLike = ensureJsonLike(value)
  return { parsed: jsonLike, formatted: safeStringify(jsonLike) }
}

const isJsonContentItem = (item: ContentItemNode): boolean => {
  const contentType = item.contentType?.toLowerCase() ?? ''
  const resource = item.resource.toLowerCase()
  return contentType.includes('json') || resource.endsWith('.json')
}

const flattenJsonContentItems = (root: DirectoryNode | null): CmsResourceOption[] => {
  if (!root) {
    return []
  }

  const items: CmsResourceOption[] = []

  const traverse = (node: DirectoryNode, parents: string[]) => {
    const pathParts = [...parents, node.name].filter(Boolean)
    const pathPrefix = pathParts.join('/')

    node.contentItems.forEach((item) => {
      if (!isJsonContentItem(item)) {
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

const deriveInitialPayload = (state: JsonViewerRouteState | null) => {
  if (state?.json) {
    const normalized = normalizePayload(state.json)
    return { ...normalized, source: 'provided-json' as PayloadSource }
  }

  if (state?.rawJson) {
    const normalized = normalizePayload(state.rawJson)
    return { ...normalized, source: 'raw-json' as PayloadSource }
  }

  if (state?.metadata) {
    const normalized = normalizePayload(state.metadata)
    return { ...normalized, source: 'metadata' as PayloadSource }
  }

  const normalized = normalizePayload(SAMPLE_JSON)
  return { ...normalized, source: 'sample' as PayloadSource }
}

export const JsonViewer = () => {
  const styles = useStyles()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as JsonViewerRouteState | null
  const sourceResourceId = routeState?.resourceId ?? null
  const { user } = useAuth()
  const directoryRoot = useSelector(selectDirectoryTreeRoot)

  const cmsJsonOptions = useMemo(() => flattenJsonContentItems(directoryRoot), [directoryRoot])
  const cmsOptionsByKey = useMemo(() => {
    const map = new Map<string, CmsResourceOption>()
    cmsJsonOptions.forEach((option) => {
      map.set(option.key, option)
    })
    return map
  }, [cmsJsonOptions])

  const initialPayload = useMemo(() => deriveInitialPayload(routeState), [routeState])

  const [payloadSource, setPayloadSource] = useState<PayloadSource>(initialPayload.source)
  const [input, setInput] = useState(initialPayload.formatted)
  const [parsedJson, setParsedJson] = useState<JsonLike>(initialPayload.parsed)
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const tenantName = routeState?.tenantName ?? user?.tenant?.name ?? null
  const version = routeState?.version
  const viewer = routeState?.viewer ?? 'json'

  useEffect(() => {
    setPayloadSource(initialPayload.source)
    setInput(initialPayload.formatted)
    setParsedJson(initialPayload.parsed)
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
        const message = 'Missing tenant context; cannot load JSON payload.'
        setFetchError(message)
        return { success: false, error: message }
      }

      setIsFetching(true)
      setFetchError(null)

      try {
        const params = options?.version ? { version: options.version } : undefined
        const { data } = await customAxios.get(
          `/v1/${tenantName}/${encodeURIComponent(resourceId)}`,
          {
            params,
          },
        )
        const normalized = normalizePayload(data)
        setParsedJson(normalized.parsed)
        setInput(normalized.formatted)
        setPayloadSource('fetched')
        setParseError(null)
        setSourceDescription(options?.label ?? resourceId)
        return { success: true }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load JSON payload from server.'
        setFetchError(message)
        return { success: false, error: message }
      } finally {
        setIsFetching(false)
      }
    },
    [tenantName],
  )

  useEffect(() => {
    if (viewer !== 'json') {
      return
    }

    if (!sourceResourceId) {
      return
    }

    if (
      payloadSource === 'provided-json' ||
      payloadSource === 'raw-json' ||
      payloadSource === 'fetched'
    ) {
      return
    }

    void loadResourcePayload(sourceResourceId, { version })
  }, [viewer, sourceResourceId, payloadSource, version, loadResourcePayload])

  const isMetadataPayload = payloadSource === 'metadata'

  const handleFormat = () => {
    try {
      const candidate = JSON.parse(input)
      setParsedJson(candidate as JsonLike)
      setParseError(null)
      setPayloadSource('provided-json')
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Unable to parse JSON input')
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
    fileInputRef.current?.click()
  }

  const handleDeviceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setSelectedFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setImportError('Please choose a file with a .json extension.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text =
          typeof reader.result === 'string'
            ? reader.result
            : new TextDecoder().decode(reader.result as ArrayBuffer)
        const parsed = JSON.parse(text)
        const normalized = normalizePayload(parsed)
        setParsedJson(normalized.parsed)
        setInput(normalized.formatted)
        setPayloadSource('raw-json')
        setParseError(null)
        setFetchError(null)
        setSourceDescription(file.name)
        setImportError(null)
        setSelectedFileName(null)
        setIsImportDialogOpen(false)
      } catch (error) {
        setImportError(
          error instanceof Error
            ? error.message
            : 'Unable to read the selected JSON file. Ensure it contains valid JSON.',
        )
      }
    }
    reader.onerror = () => {
      setImportError('Unable to read the selected file. Please try again.')
    }
    reader.readAsText(file)
  }

  const handleImportFromCms = async () => {
    if (!selectedCmsOption) {
      setImportError('Select a JSON file from the CMS');
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
    : 'Inspect JSON payloads without leaving the Fluent UI shell.'

  return (
    <MainLayout variant="viewer">
      <div className={styles.pageRoot}>
        <div className={styles.headerRow}>
          <Button
            icon={<ArrowLeftRegular />}
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
              header={<Text weight="semibold">JSON Input</Text>}
              description="Paste or edit the payload, then format to refresh the viewer."
            />
            <div className={styles.inputCardBody}>
              <Textarea
                className={styles.textarea}
                value={input}
                onChange={(_, data) => setInput(data.value)}
                resize="none"
                appearance="outline"
                style={{ maxHeight: 'inherit' }}
              />
            </div>
            <CardFooter>
              <Button icon={<CheckmarkRegular />} appearance="primary" onClick={handleFormat}>
                Format JSON
              </Button>
              <Button
                icon={<ArrowImportRegular />}
                appearance="secondary"
                onClick={openImportDialog}
              >
                Import JSON
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
                Showing file metadata. Load the JSON payload to inspect the full content.
              </MessageBar>
            )}
            {fetchError && <MessageBar intent="error">{fetchError}</MessageBar>}
            {parseError ? (
              <MessageBar intent="error">{parseError}</MessageBar>
            ) : (
              <div className={styles.viewerContainer}>
                {isFetching ? (
                  <Spinner label="Loading JSON payload" />
                ) : (
                  <JsonView
                    value={parsedJson}
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
            <DialogTitle>Import JSON</DialogTitle>
            <DialogContent>
              {importError && <MessageBar intent="error">{importError}</MessageBar>}
              <div className={styles.importSections}>
                <Card className={styles.importCard}>
                  <Text weight="semibold">From your device</Text>
                  <Caption1>
                    Upload a .json file from your computer. Its contents replace the current viewer
                    payload.
                  </Caption1>
                  <div className={styles.importActions}>
                    <Button icon={<ArrowImportRegular />} onClick={handleBrowseDevice}>
                      Choose file
                    </Button>
                    {selectedFileName && <Caption1>{selectedFileName}</Caption1>}
                  </div>
                </Card>

                <Card className={styles.importCard}>
                  <Text weight="semibold">From CMS</Text>
                  <Caption1>Pick a JSON asset already stored in the content tree.</Caption1>
                  <Label htmlFor="cms-json-combobox">JSON resources</Label>
                  <Combobox
                    id="cms-json-combobox"
                    placeholder={
                      cmsJsonOptions.length > 0
                        ? 'Search JSON files'
                        : 'No JSON files available'
                    }
                    value={cmsComboboxValue}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setCmsComboboxValue(event.target.value)
                      setSelectedCmsOption(null)
                      setImportError(null)
                    }}
                    onOptionSelect={(event: SyntheticEvent<HTMLElement>, data: { optionValue?: string }) => {
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
                    disabled={cmsJsonOptions.length === 0}
                  >
                    {cmsJsonOptions.map((option) => (
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

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className={styles.hiddenInput}
        onChange={handleDeviceFileChange}
      />
    </MainLayout>
  )
};
