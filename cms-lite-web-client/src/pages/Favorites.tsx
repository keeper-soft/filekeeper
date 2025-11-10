import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  makeStyles,
  tokens,
  Subtitle1,
  Text,
} from '@fluentui/react-components';
import { ArrowLeftRegular, StarRegular } from '@fluentui/react-icons';
import { MainLayout } from '../layout';
import { ContentArea } from '../layout';
import { useAuth } from '../contexts';
import {
  selectDirectoryTreeSelectedFileIds,
  setSelectedFiles,
  type DirectoryNode,
} from '../store/slices/directoryTree';
import type { AppDispatch } from '../store/store';
import {
  fetchFavorites,
  removeFavorites,
  selectFavoritesError,
  selectFavoritesItems,
  selectFavoritesLoading,
  selectFavoritesRemoving,
} from '../store/slices/favorites';
import { FavoritesBar } from '../components';
import { InfoDialog } from '../components/modals/InfoDialog';
import { FileDetailsModal } from '../components/FileDetailsModal';
import type { ContentItemDetails } from '../types/content';
import { useFileDetails } from '../hooks/useFileDetails';

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
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    flex: 1,
    minHeight: 0,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
});

export const Favorites = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useAuth();
  const [dialogState, setDialogState] = useState({
    open: false,
    title: '',
    description: '',
  });

  const selectedFileIds = useSelector(selectDirectoryTreeSelectedFileIds);
  const favorites = useSelector(selectFavoritesItems);
  const isLoading = useSelector(selectFavoritesLoading);
  const error = useSelector(selectFavoritesError);
  const isRemoving = useSelector(selectFavoritesRemoving);
  const tenantName = user?.tenant?.name ?? null;
  const {
    state: detailsState,
    openDetails,
    closeDetails,
    retry,
  } = useFileDetails({ tenantName });

  useEffect(() => {
    dispatch(setSelectedFiles([]));
    void dispatch(fetchFavorites());
  }, [dispatch]);

  const favoritesDirectory: DirectoryNode = useMemo(
    () => ({
      id: 'favorites-root',
      name: 'Favorites',
      level: 0,
      parentId: null,
      subDirectories: [],
      contentItems: favorites,
    }),
    [favorites]
  );

  const handleRemoveFromFavorites = useCallback(() => {
    if (selectedFileIds.length === 0 || isRemoving) {
      return;
    }

    const count = selectedFileIds.length;
    dispatch(removeFavorites(selectedFileIds))
      .unwrap()
      .then(() => {
        setDialogState({
          open: true,
          title: count === 1 ? 'Favorite removed' : 'Favorites removed',
          description: `${count} item${
            count === 1 ? '' : 's'
          } removed from favorites.`,
        });
        dispatch(setSelectedFiles([]));
      })
      .catch((errorMessage: string | undefined) => {
        setDialogState({
          open: true,
          title: 'Unable to remove favorites',
          description:
            errorMessage ??
            'We could not remove those favorites. Please try again.',
        });
      });
  }, [dispatch, isRemoving, selectedFileIds]);

  const handleDismissDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleRefresh = useCallback(() => {
    if (isLoading) {
      return;
    }
    void dispatch(fetchFavorites());
  }, [dispatch, isLoading]);

  const handleSeeDetails = useCallback(() => {
    if (selectedFileIds.length !== 1 || !tenantName) {
      return;
    }

    const targetId = selectedFileIds[0];
    const target = favorites.find((item) => item.id === targetId);
    if (!target) {
      return;
    }

    openDetails(target.resource);
  }, [favorites, openDetails, selectedFileIds, tenantName]);

  const buildViewerState = useCallback(
    (resourceId: string, details: ContentItemDetails | null, viewer: 'json' | 'xml' | 'pdf') => ({
      resourceId,
      metadata: details,
      tenantName,
      contentType: details?.contentType,
      fileExtension: details?.metadata?.fileExtension,
      version: details?.latestVersion,
      viewer,
    }),
    [tenantName],
  );

  const handleOpenJsonViewer = useCallback(
    (resourceId: string, details: ContentItemDetails | null) => {
      if (!resourceId) {
        return;
      }
      closeDetails();
      navigate('/tools/json-viewer', { state: buildViewerState(resourceId, details, 'json') });
    },
    [buildViewerState, closeDetails, navigate],
  );

  const handleOpenXmlViewer = useCallback(
    (resourceId: string, details: ContentItemDetails | null) => {
      if (!resourceId) {
        return;
      }
      closeDetails();
      navigate('/tools/xml-viewer', { state: buildViewerState(resourceId, details, 'xml') });
    },
    [buildViewerState, closeDetails, navigate],
  );

  const handleOpenPdfViewer = useCallback(
    (resourceId: string, details: ContentItemDetails | null) => {
      if (!resourceId) {
        return;
      }
      closeDetails();
      navigate('/tools/pdf-viewer', { state: buildViewerState(resourceId, details, 'pdf') });
    },
    [buildViewerState, closeDetails, navigate],
  );

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
          <Subtitle1>Your favorites</Subtitle1>
        </div>

        <div className={styles.section}>
          <FavoritesBar
            selectedCount={selectedFileIds.length}
            onRemoveFavorites={handleRemoveFromFavorites}
            isRemoving={isRemoving}
            onSeeDetails={handleSeeDetails}
            seeDetailsDisabled={selectedFileIds.length !== 1}
          />

          <ContentArea
            selectedItem={favoritesDirectory}
            selectedFiles={selectedFileIds}
            onFileSelect={(ids) => dispatch(setSelectedFiles(ids))}
            isLoading={isLoading}
            error={error}
          />

          {favorites.length === 0 && !isLoading && !error && (
            <div className={styles.emptyState}>
              <StarRegular />
              <Text size={400}>You have no favorites yet.</Text>
            </div>
          )}

          <div className={styles.actionsRow}>
            <Button
              appearance="secondary"
              onClick={handleRefresh}
              disabled={isLoading || isRemoving}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>
      <InfoDialog
        open={dialogState.open}
        title={dialogState.title}
        description={dialogState.description}
        onDismiss={handleDismissDialog}
      />
      <FileDetailsModal
        open={detailsState.open}
        details={detailsState.data}
        isLoading={detailsState.isLoading}
        error={detailsState.error}
        resourceId={detailsState.resourceId}
        onClose={closeDetails}
        onRetry={detailsState.error ? retry : undefined}
        onOpenJsonViewer={handleOpenJsonViewer}
        onOpenXmlViewer={handleOpenXmlViewer}
        onOpenPdfViewer={handleOpenPdfViewer}
      />
    </MainLayout>
  );
};
