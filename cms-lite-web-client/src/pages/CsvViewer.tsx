import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
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
  Radio,
  RadioGroup,
  Checkbox,
  Divider,
} from '@fluentui/react-components'
import { ArrowLeftRegular, CheckmarkRegular, ArrowImportRegular } from '@fluentui/react-icons'
import { MainLayout } from '../layout'
import type { ContentItemDetails, CsvConfig } from '../types/content'
import { useAuth } from '../contexts'
import customAxios from '../utilities/custom-axios'
import {
  selectDirectoryTreeRoot,
  type ContentItemNode,
  type DirectoryNode,
} from '../store/slices/directoryTree'

const SAMPLE_CSV = `id,name,email,role,active
1,Alice Johnson,alice@example.com,admin,true
2,Bob Smith,bob@example.com,editor,true
3,Carol White,carol@example.com,viewer,false
4,David Brown,david@example.com,editor,true`

const DEFAULT_CONFIG: CsvConfig = {
  delimiter: ',',
  hasHeader: true,
  quoteChar: '"',
}

const PRESET_DELIMITERS = [
  { label: 'Comma  ( , )', value: ',' },
  { label: 'Semicolon  ( ; )', value: ';' },
  { label: 'Tab  ( \\t )', value: '\t' },
  { label: 'Pipe  ( | )', value: '|' },
  { label: 'Custom', value: '__custom__' },
]

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
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    minHeight: 0,
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: tokens.fontSizeBase200,
  },
  th: {
    textAlign: 'left',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    whiteSpace: 'nowrap',
    maxWidth: '240px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trOdd: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  trEven: {
    backgroundColor: tokens.colorNeutralBackground2,
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
  configSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  configLabel: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
})

type CsvViewerRouteState = {
  resourceId?: string
  metadata?: ContentItemDetails | Record<string, unknown>
  tenantName?: string
  contentType?: string
  fileExtension?: string
  version?: number
  viewer?: 'csv'
}

type PayloadSource = 'raw-csv' | 'sample' | 'fetched'

type CmsResourceOption = {
  key: string
  resourceId: string
  label: string
  version: number
  contentType?: string
}

// ----------------------------------------------------------
// CSV parsing helpers
// ----------------------------------------------------------

const splitCsvLine = (line: string, delimiter: string, quoteChar: string): string[] => {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoteChar && char === quoteChar) {
      if (inQuotes && line[i + 1] === quoteChar) {
        current += quoteChar
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

const parseCsvText = (text: string, config: CsvConfig): { headers: string[]; rows: string[][] } => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const allRows = lines.map((l) => splitCsvLine(l, config.delimiter, config.quoteChar))

  if (config.hasHeader && allRows.length > 0) {
    const [headerRow, ...dataRows] = allRows
    return { headers: headerRow, rows: dataRows }
  }

  const colCount = allRows[0]?.length ?? 0
  const headers = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`)
  return { headers, rows: allRows }
}

const isCsvContentItem = (item: ContentItemNode): boolean => {
  const contentType = item.contentType?.toLowerCase() ?? ''
  const resource = item.resource.toLowerCase()
  return contentType.includes('csv') || resource.endsWith('.csv')
}

const flattenCsvContentItems = (root: DirectoryNode | null): CmsResourceOption[] => {
  if (!root) return []

  const items: CmsResourceOption[] = []

  const traverse = (node: DirectoryNode, parents: string[]) => {
    const pathParts = [...parents, node.name].filter(Boolean)
    const pathPrefix = pathParts.join('/')

    node.contentItems.forEach((item) => {
      if (!isCsvContentItem(item)) return
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

// ----------------------------------------------------------
// CsvViewer component
// ----------------------------------------------------------

export const CsvViewer = () => {
  const styles = useStyles()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as CsvViewerRouteState | null
  const sourceResourceId = routeState?.resourceId ?? null
  const { user } = useAuth()
  const directoryRoot = useSelector(selectDirectoryTreeRoot)

  const csvOptions = useMemo(() => flattenCsvContentItems(directoryRoot), [directoryRoot])
  const csvOptionsByKey = useMemo(() => {
    const map = new Map<string, CmsResourceOption>()
    csvOptions.forEach((o) => map.set(o.key, o))
    return map
  }, [csvOptions])

  const [payloadSource, setPayloadSource] = useState<PayloadSource>('sample')
  const [rawInput, setRawInput] = useState(SAMPLE_CSV)
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: string[][] }>(
    () => parseCsvText(SAMPLE_CSV, DEFAULT_CONFIG),
  )
  const [config, setConfig] = useState<CsvConfig>(DEFAULT_CONFIG)
  const [delimiterOption, setDelimiterOption] = useState(',')
  const [customDelimiter, setCustomDelimiter] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [sourceDescription, setSourceDescription] = useState<string | null>(sourceResourceId)

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedCmsOption, setSelectedCmsOption] = useState<CmsResourceOption | null>(null)
  const [cmsComboboxValue, setCmsComboboxValue] = useState('')
  const [isImportingCms, setIsImportingCms] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const tenantName = routeState?.tenantName ?? user?.tenant?.name ?? null
  const version = routeState?.version

  const effectiveDelimiter = delimiterOption === '__custom__' ? customDelimiter : delimiterOption
  const effectiveConfig: CsvConfig = { ...config, delimiter: effectiveDelimiter || ',' }

  const loadResourcePayload = useCallback(
    async (
      resourceId: string,
      opts?: { version?: number; label?: string },
    ): Promise<{ success: boolean; error?: string }> => {
      if (!tenantName) {
        const msg = 'Missing tenant context; cannot load CSV payload.'
        setFetchError(msg)
        return { success: false, error: msg }
      }
      setIsFetching(true)
      setFetchError(null)
      try {
        const params = opts?.version ? { version: opts.version } : undefined
        const { data } = await customAxios.get<string>(
          `/v1/${tenantName}/${encodeURIComponent(resourceId)}`,
          { params, responseType: 'text', transformResponse: [(d) => d] },
        )
        const text = data ?? ''
        const parsed = parseCsvText(text, effectiveConfig)
        setRawInput(text)
        setParsedData(parsed)
        setPayloadSource('fetched')
        setParseError(null)
        setSourceDescription(opts?.label ?? resourceId)
        return { success: true }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load CSV from server.'
        setFetchError(msg)
        return { success: false, error: msg }
      } finally {
        setIsFetching(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantName],
  )

  // Auto-load when navigated from FileDetails
  useEffect(() => {
    if (!sourceResourceId) return
    if (payloadSource === 'raw-csv' || payloadSource === 'fetched') return
    void loadResourcePayload(sourceResourceId, { version })
  }, [sourceResourceId, version, loadResourcePayload, payloadSource])

  const handleParse = () => {
    try {
      const parsed = parseCsvText(rawInput, effectiveConfig)
      if (parsed.headers.length === 0 && parsed.rows.length === 0) {
        throw new Error('No data found. Check that the delimiter matches your file.')
      }
      setParsedData(parsed)
      setParseError(null)
      setPayloadSource('raw-csv')
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Unable to parse CSV input.')
    }
  }

  const openImportDialog = () => {
    setImportError(null)
    setSelectedCmsOption(null)
    setCmsComboboxValue('')
    setIsImportDialogOpen(true)
  }

  const closeImportDialog = () => {
    if (isImportingCms) return
    setIsImportDialogOpen(false)
    setImportError(null)
    setSelectedCmsOption(null)
    setCmsComboboxValue('')
  }

  const handleBrowseDevice = () => {
    setImportError(null)
    fileInputRef.current?.click()
  }

  const handleDeviceFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text =
          typeof reader.result === 'string'
            ? reader.result
            : new TextDecoder().decode(reader.result as ArrayBuffer)
        const parsed = parseCsvText(text, effectiveConfig)
        setRawInput(text)
        setParsedData(parsed)
        setParseError(null)
        setPayloadSource('raw-csv')
        setSourceDescription(file.name)
        setImportError(null)
        setIsImportDialogOpen(false)
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : 'Unable to parse the selected CSV file.',
        )
      }
    }
    reader.onerror = () => {
      setImportError('Failed to read the selected file.')
    }
    reader.readAsText(file)
  }

  const handleImportFromCms = async () => {
    if (!selectedCmsOption) return
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
    : 'Inspect CSV files in a structured table view.'

  const { headers, rows } = parsedData

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
          {/* Left panel: raw input + config */}
          <Card className={styles.inputCard}>
            <CardHeader
              header={<Text weight="semibold">CSV Input</Text>}
              description="Paste CSV text, configure the delimiter, then click Parse to refresh the table."
            />
            <div className={styles.inputCardBody}>
              <Textarea
                className={styles.textarea}
                value={rawInput}
                onChange={(_, data) => setRawInput(data.value)}
                resize="none"
                appearance="outline"
              />
            </div>
            {parseError && (
              <MessageBar intent="error">
                <Text>{parseError}</Text>
              </MessageBar>
            )}
            <CardFooter>
              <Button icon={<CheckmarkRegular />} appearance="primary" onClick={handleParse}>
                Parse CSV
              </Button>
              <Button
                icon={<ArrowImportRegular />}
                appearance="secondary"
                onClick={openImportDialog}
              >
                Import
              </Button>
            </CardFooter>
          </Card>

          {/* Right panel: table view */}
          <Card className={styles.viewerCard}>
            <CardHeader
              header={<Text weight="semibold">Table View</Text>}
              description={
                headers.length > 0
                  ? `${rows.length} row${rows.length !== 1 ? 's' : ''} · ${headers.length} column${headers.length !== 1 ? 's' : ''}`
                  : 'No data loaded yet.'
              }
            />
            <div className={styles.viewerContainer}>
              {isFetching ? (
                <Spinner label="Loading CSV…" />
              ) : fetchError ? (
                <MessageBar intent="error">
                  <Text>{fetchError}</Text>
                </MessageBar>
              ) : headers.length > 0 ? (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className={styles.th}>
                          {h || `(empty)`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? styles.trOdd : styles.trEven}>
                        {headers.map((_, colIdx) => (
                          <td key={colIdx} className={styles.td} title={row[colIdx] ?? ''}>
                            {row[colIdx] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Text>Paste CSV text in the input panel and click Parse to see data here.</Text>
              )}
            </div>
          </Card>
        </div>

        {/* Delimiter/config controls below editors */}
        <Card>
          <CardHeader header={<Text weight="semibold">Parse Settings</Text>} />
          <div style={{ padding: tokens.spacingHorizontalL, display: 'flex', gap: tokens.spacingHorizontalXL, flexWrap: 'wrap' }}>
            <div className={styles.configSection}>
              <Text className={styles.configLabel}>Delimiter</Text>
              <RadioGroup
                className={styles.radioGroup}
                layout="horizontal"
                value={delimiterOption}
                onChange={(_, data) => setDelimiterOption(data.value)}
              >
                {PRESET_DELIMITERS.map((d) => (
                  <Radio key={d.value} value={d.value} label={d.label} />
                ))}
              </RadioGroup>
              {delimiterOption === '__custom__' && (
                <div>
                  <Label>Custom character</Label>
                  <input
                    style={{ width: '60px', marginLeft: tokens.spacingHorizontalS }}
                    maxLength={1}
                    value={customDelimiter}
                    onChange={(e) => setCustomDelimiter(e.target.value)}
                    placeholder="e.g. :"
                  />
                </div>
              )}
            </div>
            <Divider vertical />
            <div className={styles.configSection}>
              <Text className={styles.configLabel}>Options</Text>
              <Checkbox
                label="First row is header"
                checked={config.hasHeader}
                onChange={(_, data) => setConfig((c) => ({ ...c, hasHeader: Boolean(data.checked) }))}
              />
            </div>
            <Divider vertical />
            <div className={styles.configSection}>
              <Text className={styles.configLabel}>Quote Character</Text>
              <RadioGroup
                className={styles.radioGroup}
                layout="horizontal"
                value={config.quoteChar}
                onChange={(_, data) => setConfig((c) => ({ ...c, quoteChar: data.value }))}
              >
                <Radio value={'"'} label={'Double quote  ( " )'} />
                <Radio value={"'"} label={"Single quote  ( ' )"} />
                <Radio value={''} label={'None'} />
              </RadioGroup>
            </div>
          </div>
        </Card>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="text/csv,.csv"
        className={styles.hiddenInput}
        onChange={handleDeviceFileChange}
      />

      {/* Import dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(_, data) => { if (!data.open) closeImportDialog() }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Import CSV</DialogTitle>
            <DialogContent>
              <div className={styles.importSections}>
                {importError && (
                  <MessageBar intent="error">
                    <Text>{importError}</Text>
                  </MessageBar>
                )}

                <div className={styles.importCard}>
                  <Text weight="semibold">From your device</Text>
                  <Caption1>Select a .csv file from your computer.</Caption1>
                  <div className={styles.importActions}>
                    <Button
                      appearance="secondary"
                      icon={<ArrowImportRegular />}
                      onClick={handleBrowseDevice}
                    >
                      Browse…
                    </Button>
                  </div>
                </div>

                <Divider />

                <div className={styles.importCard}>
                  <Text weight="semibold">From FileKeeper</Text>
                  <Caption1>Load a CSV resource stored in your tenant.</Caption1>
                  <div className={styles.importActions}>
                    <Combobox
                      placeholder="Search CSV files…"
                      value={cmsComboboxValue}
                      onInput={(e) => setCmsComboboxValue((e.target as HTMLInputElement).value)}
                      onOptionSelect={(_, data) => {
                        const opt = csvOptionsByKey.get(data.optionValue ?? '')
                        setSelectedCmsOption(opt ?? null)
                        setCmsComboboxValue(data.optionText ?? '')
                      }}
                    >
                      {csvOptions
                        .filter((o) =>
                          !cmsComboboxValue ||
                          o.label.toLowerCase().includes(cmsComboboxValue.toLowerCase()),
                        )
                        .map((o) => (
                          <Option key={o.key} value={o.key} text={o.label}>
                            {o.label}
                          </Option>
                        ))}
                    </Combobox>
                    <Button
                      appearance="primary"
                      disabled={!selectedCmsOption || isImportingCms}
                      onClick={handleImportFromCms}
                    >
                      {isImportingCms ? <Spinner size="tiny" /> : 'Load'}
                    </Button>
                  </div>
                </div>
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
    </MainLayout>
  )
}

export default CsvViewer
