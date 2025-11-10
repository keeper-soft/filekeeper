import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button, Text, Link, makeStyles, tokens, Spinner } from '@fluentui/react-components';
import { formatFileDate } from '../utilities/file-formatters';
import type { ContentItemDetails } from '../types/content';

interface FileDetailsModalProps {
  open: boolean
  details: ContentItemDetails | null
  isLoading: boolean
  error: string | null
  resourceId: string | null
  onClose: () => void
  onRetry?: () => void
  onOpenJsonViewer?: (resourceId: string, details: ContentItemDetails | null) => void
  onOpenXmlViewer?: (resourceId: string, details: ContentItemDetails | null) => void
  onOpenPdfViewer?: (resourceId: string, details: ContentItemDetails | null) => void
}

const useStyles = makeStyles({
  content: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    minWidth: 'min(460px, 90vw)',
    [`@media (max-width: 480px)`]: {
      minWidth: '90vw',
    },
  },
  grid: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  label: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase200,
    letterSpacing: '0.04rem',
  },
  sectionTitle: {
    marginTop: tokens.spacingVerticalS,
  },
  twoColumn: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  },
  versionsList: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  versionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: tokens.fontSizeBase200,
  },
  errorBox: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
  },
  actionLink: {
    alignSelf: 'center',
  },
})

export const FileDetailsModal = ({
  open,
  details,
  isLoading,
  error,
  resourceId,
  onClose,
  onRetry,
  onOpenJsonViewer,
  onOpenXmlViewer,
  onOpenPdfViewer,
}: FileDetailsModalProps) => {
  const styles = useStyles();

  const name = details?.resource ?? resourceId ?? 'Unknown'
  const size = details?.size || "N/A";
  const extension = details?.metadata?.fileExtension
  const type = extension && extension.trim().length > 0 ? extension : details?.contentType ?? 'Unknown'
  const version = details ? `v${details.latestVersion}` : 'Unknown'
  const createdAt = formatFileDate(details?.createdAtUtc)
  const updatedAt = formatFileDate(details?.updatedAtUtc)
  const status = details?.isDeleted ? 'Deleted' : 'Active'
  const directory = details?.directory
  const totalVersions = details?.metadata?.totalVersions ?? details?.versions?.length ?? 0
  const versions = details?.versions ?? []
  const showVersions = versions.length > 0
  const canOpenJsonViewer = Boolean(
    resourceId &&
      details &&
      (details.contentType?.toLowerCase().includes('json') ||
        details.metadata?.fileExtension?.toLowerCase() === 'json'),
  )
  const canOpenXmlViewer = Boolean(
    resourceId &&
      details &&
      (details.contentType?.toLowerCase().includes('xml') ||
        details.metadata?.fileExtension?.toLowerCase() === 'xml'),
  )
  const canOpenPdfViewer = Boolean(
    resourceId &&
      details &&
      (details.contentType?.toLowerCase().includes('pdf') ||
        details.metadata?.fileExtension?.toLowerCase() === 'pdf'),
  )

  return (
    <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) onClose() }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>File Details</DialogTitle>
          <DialogContent className={styles.content}>
            {isLoading ? (
              <Spinner label={resourceId ? `Loading ${resourceId}` : 'Loading file details'} />
            ) : error ? (
              <div className={styles.errorBox}>
                <Text weight="semibold">{error}</Text>
              </div>
            ) : details ? (
              <div className={styles.grid}>
                <div className={styles.twoColumn}>
                  <div className={styles.row}>
                    <span className={styles.label}>Name</span>
                    <Text weight="semibold">{name}</Text>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Type</span>
                    <Text>{type}</Text>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Size</span>
                    <Text>{size}</Text>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Latest Version</span>
                    <Text>{version}</Text>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Created At</span>
                    <Text>{createdAt}</Text>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Updated At</span>
                    <Text>{updatedAt}</Text>
                  </div>
                </div>

                <div className={styles.twoColumn}>
                  <div className={styles.row}>
                    <span className={styles.label}>Status</span>
                    <Text>{status}</Text>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Total Versions</span>
                    <Text>{totalVersions}</Text>
                  </div>
                </div>

                {directory && (
                  <div className={styles.twoColumn}>
                    <div className={styles.row}>
                      <span className={styles.label}>Directory</span>
                      <Text>{directory.fullPath || directory.name}</Text>
                    </div>
                    <div className={styles.row}>
                      <span className={styles.label}>Directory Level</span>
                      <Text>{directory.level}</Text>
                    </div>
                  </div>
                )}

                {showVersions && (
                  <div>
                    <Text weight="semibold" className={styles.sectionTitle}>Version History</Text>
                    <div className={styles.versionsList}>
                      {versions.map((versionInfo) => (
                        <div key={versionInfo.version} className={styles.versionRow}>
                          <span>v{versionInfo.version}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Text>No details available.</Text>
            )}
          </DialogContent>
          <DialogActions>
            {error && onRetry && (
              <Button appearance="secondary" onClick={onRetry} disabled={isLoading}>
                Retry
              </Button>
            )}
            {canOpenJsonViewer && onOpenJsonViewer && resourceId && (
              <Link
                className={styles.actionLink}
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenJsonViewer(resourceId, details);
                }}
              >
                See in JSON viewer
              </Link>
            )}
            {canOpenXmlViewer && onOpenXmlViewer && resourceId && (
              <Link
                className={styles.actionLink}
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenXmlViewer(resourceId, details);
                }}
              >
                See in XML viewer
              </Link>
            )}
            {canOpenPdfViewer && onOpenPdfViewer && resourceId && (
              <Link
                className={styles.actionLink}
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenPdfViewer(resourceId, details);
                }}
              >
                See in PDF viewer
              </Link>
            )}
            <Button appearance="primary" onClick={onClose} disabled={isLoading}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default FileDetailsModal;
