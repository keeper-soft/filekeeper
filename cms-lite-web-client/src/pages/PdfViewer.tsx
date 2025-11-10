import {
  useCallback,
  useEffect,
  useState,
  type SyntheticEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardFooter,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  Spinner,
  Subtitle1,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type {PdfViewerRouteState} from "../types/files.ts";
import {
  ArrowLeftRegular,
  ArrowNextRegular,
  ArrowPreviousRegular,
  ArrowSyncRegular,
  ZoomInRegular,
  ZoomOutRegular,
} from '@fluentui/react-icons';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { MainLayout } from '../layout';
import { useAuth } from '../contexts';
import customAxios from '../utilities/custom-axios';

const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const useStyles = makeStyles({
  pageRoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    flex: 1,
    width: '100%',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  viewerCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  viewerContainer: {
    minHeight: '420px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalL,
    display: 'flex',
    justifyContent: 'center',
  },
  documentFrame: {
    width: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actionsRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  viewerControls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  controlLabel: {
    minWidth: '120px',
  },
});

export const PdfViewer = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as PdfViewerRouteState | null;
  const { user } = useAuth();

  const tenantName = routeState?.tenantName ?? user?.tenant?.name ?? '';
  const resourceId = routeState?.resourceId ?? '';
  const version = routeState?.version;
  const viewer = routeState?.viewer ?? 'pdf';

  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFailureDialogOpen, setIsFailureDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);

  const fetchPdf = useCallback(async () => {
    if (viewer !== 'pdf' || !tenantName || !resourceId) {
      setDocumentBytes(null);
      const message = 'Missing tenant or resource information. Cannot load PDF.';
      setErrorMessage(message);
      setIsFailureDialogOpen(true);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setNumPages(0);
    setCurrentPage(1);
    setScale(1);

    try {
      const params = version ? { version } : undefined;
      const response = await customAxios.get<ArrayBuffer>(
        `/v1/${tenantName}/${encodeURIComponent(resourceId)}`,
        { responseType: 'arraybuffer', params },
      );
      const bufferCopy = response.data.slice(0);
      setDocumentBytes(new Uint8Array(bufferCopy));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download PDF.';
      setDocumentBytes(null);
      setErrorMessage(message);
      setIsFailureDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [tenantName, resourceId, version, viewer]);

  useEffect(() => {
    void fetchPdf();
  }, [fetchPdf]);

  const handleDialogDismiss = () => {
    setIsFailureDialogOpen(false);
  };

  const renderStatusMessage = () => {
    if (!tenantName || !resourceId) {
      return <MessageBar intent="warning">Provide a tenant and resource to preview a PDF.</MessageBar>;
    }
    if (errorMessage) {
      return <MessageBar intent="error">{errorMessage}</MessageBar>;
    }
    return null;
  };

  const viewerBytes = documentBytes ? documentBytes.slice(0) : null;
  const totalPages = numPages || 0;
  const canGoPrev = currentPage > 1;
  const canGoNext = totalPages ? currentPage < totalPages : false;
  const canZoomOut = scale > 0.5;
  const canZoomIn = scale < 3;

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    if (!totalPages) {
      return;
    }
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <MainLayout variant="viewer">
      <div className={styles.pageRoot}>
        <div className={styles.headerRow}>
          <Button icon={<ArrowLeftRegular />} appearance="secondary" onClick={() => navigate('/dashboard')}>
            Back to Content Explorer
          </Button>
          <Subtitle1>{resourceId ? `Viewing ${resourceId}` : 'PDF Viewer'}</Subtitle1>
          <div className={styles.actionsRow}>
            <Button
              icon={<ArrowSyncRegular />}
              appearance="primary"
              onClick={() => {
                void fetchPdf();
              }}
              disabled={isLoading}
            >
              Reload PDF
            </Button>
          </div>
        </div>

        <Card className={styles.viewerCard}>
          <CardHeader
            header={<Text weight="semibold">PDF Preview</Text>}
            description="The PDF is fetched as raw bytes and streamed directly into the viewer."
          />
          {renderStatusMessage()}
          {isLoading && <Spinner label="Fetching PDF bytes..." />}
          {viewerBytes && (
            <div className={styles.viewerControls}>
              <Text weight="semibold" className={styles.controlLabel}>
                Controls
              </Text>
              <Button icon={<ZoomOutRegular />} onClick={handleZoomOut} disabled={!canZoomOut}>
                Zoom out
              </Button>
              <Text>{Math.round(scale * 100)}%</Text>
              <Button icon={<ZoomInRegular />} onClick={handleZoomIn} disabled={!canZoomIn}>
                Zoom in
              </Button>
              <Button onClick={handleResetZoom}>Reset zoom</Button>
              <Button
                icon={<ArrowPreviousRegular />}
                onClick={handlePreviousPage}
                disabled={!canGoPrev}
              >
                Prev page
              </Button>
              <Text>
                Page {totalPages ? Math.min(currentPage, totalPages) : currentPage}
                {totalPages ? ` of ${totalPages}` : ''}
              </Text>
              <Button icon={<ArrowNextRegular />} onClick={handleNextPage} disabled={!canGoNext}>
                Next page
              </Button>
            </div>
          )}
          <div className={styles.viewerContainer}>
            {viewerBytes ? (
              <div className={styles.documentFrame}>
                <Document
                  file={{ data: viewerBytes }}
                  loading={<Spinner label="Preparing PDF" />}
                  onLoadSuccess={(info) => {
                    setNumPages(info.numPages);
                    setCurrentPage((prev) => Math.min(prev, info.numPages) || 1);
                  }}
                  onLoadError={(error) => {
                    const message =
                      error instanceof Error ? error.message : 'Failed to render PDF document.';
                    setErrorMessage(message);
                    setIsFailureDialogOpen(true);
                  }}
                >
                  <Page
                    key={`page-${currentPage}`}
                    pageNumber={currentPage}
                    scale={scale}
                    loading={<Spinner label="Rendering page" />}
                  />
                </Document>
              </div>
            ) : (
              <MessageBar intent="info">Load a PDF to preview its pages.</MessageBar>
            )}
          </div>
          {viewerBytes && totalPages > 0 && (
            <CardFooter>
              <Text size={200} weight="semibold">
                Page {currentPage} of {totalPages} — zoom {Math.round(scale * 100)}%
              </Text>
            </CardFooter>
          )}
        </Card>
      </div>

      <Dialog
        open={isFailureDialogOpen}
        onOpenChange={(_event: SyntheticEvent<HTMLElement>, data) => {
          if (!data.open) {
            handleDialogDismiss();
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Unable to load PDF</DialogTitle>
            <DialogContent>
              <Text>{errorMessage ?? 'An unexpected error occurred while rendering the PDF.'}</Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={handleDialogDismiss}>
                Dismiss
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </MainLayout>
  );
};
