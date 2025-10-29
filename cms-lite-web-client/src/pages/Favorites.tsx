import { useCallback, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  makeStyles,
  tokens,
  Subtitle1,
  Text,
} from '@fluentui/react-components'
import { ArrowLeftRegular, StarRegular } from '@fluentui/react-icons'
import { MainLayout } from '../layout'
import { ContentArea } from '../layout'
import {
  selectDirectoryTreeSelectedFileIds,
  setSelectedFiles,
  type DirectoryNode,
} from '../store/slices/directoryTree'
import type { AppDispatch } from '../store/store'
import {
  fetchFavorites,
  removeFavorites,
  selectFavoritesError,
  selectFavoritesItems,
  selectFavoritesLoading,
  selectFavoritesRemoving,
} from '../store/slices/favorites'
import { FavoritesBar } from '../components'

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
})

export const Favorites = () => {
  const styles = useStyles()
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()

  const selectedFileIds = useSelector(selectDirectoryTreeSelectedFileIds)
  const favorites = useSelector(selectFavoritesItems)
  const isLoading = useSelector(selectFavoritesLoading)
  const error = useSelector(selectFavoritesError)
  const isRemoving = useSelector(selectFavoritesRemoving)

  useEffect(() => {
    dispatch(setSelectedFiles([]))
    void dispatch(fetchFavorites())
  }, [dispatch])

  const favoritesDirectory: DirectoryNode = useMemo(() => ({
    id: 'favorites-root',
    name: 'Favorites',
    level: 0,
    parentId: null,
    subDirectories: [],
    contentItems: favorites,
  }), [favorites])

  const handleRemoveFromFavorites = useCallback(() => {
    if (selectedFileIds.length === 0 || isRemoving) {
      return
    }

    void dispatch(removeFavorites(selectedFileIds))
    dispatch(setSelectedFiles([]))
  }, [dispatch, isRemoving, selectedFileIds])

  const handleRefresh = useCallback(() => {
    if (isLoading) {
      return
    }
    void dispatch(fetchFavorites())
  }, [dispatch, isLoading])

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
          <Subtitle1>
            Curate frequently used items without leaving the content workspace.
          </Subtitle1>
        </div>

        <div className={styles.section}>
          <FavoritesBar
            selectedCount={selectedFileIds.length}
            onRemoveFavorites={handleRemoveFromFavorites}
            isRemoving={isRemoving}
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
    </MainLayout>
  )
}
