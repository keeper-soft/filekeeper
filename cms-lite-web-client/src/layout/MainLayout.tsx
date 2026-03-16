import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { makeStyles, tokens, Text } from '@fluentui/react-components'
import { Header } from './Header'
import { Footer } from './Footer'
import { ActionBar } from './ActionBar'
import { NavMenu } from './NavMenu'
import { FileListView } from './FileListView'
import {
  MAIN_CONTENT,
  ANIMATIONS,
  getMainContentMarginLeft,
} from './layoutConstants'
import type { DirectoryNode } from '../store/slices/directoryTree'

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: tokens.colorNeutralBackground1,
        overflowX: 'hidden', // Prevent horizontal scrolling
        width: '100vw',
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    workspaceContainer: {
        flex: 1,
        display: 'flex',
        minHeight: 0,
        overflowX: 'hidden', // Prevent horizontal overflow
    },
    mainContent: {
        flex: 1,
        padding: `${MAIN_CONTENT.PADDING}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
        margin: '0 auto',
        width: '100%',
        overflow: 'auto',
        transition: ANIMATIONS.CONTENT_TRANSITION,
        boxSizing: 'border-box',
    },
    contentArea: {
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusLarge,
        padding: tokens.spacingVerticalL,
        minHeight: '400px',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    emptyState: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: tokens.colorNeutralForeground3,
    },
})

interface MainLayoutProps {
    children?: ReactNode
    variant?: 'explorer' | 'viewer'
}

export const MainLayout = ({ children, variant = 'explorer' }: MainLayoutProps) => {
  const styles = useStyles()
  const [selectedItem, setSelectedItem] = useState<DirectoryNode | null>(null)
  const [isNavMenuCollapsed, setIsNavMenuCollapsed] = useState<boolean>(false)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])

  const placeholderRoot: DirectoryNode = useMemo(
    () => ({
      id: 'placeholder-root',
      name: 'Root Directory',
      level: 0,
      parentId: null,
      subDirectories: [],
      contentItems: [],
    }),
    [],
  )

  const handleItemSelect = (item: DirectoryNode) => {
    setSelectedItem(item)
    setSelectedFiles([])
  }

  const handleFileSelect = (fileIds: string[]) => {
    setSelectedFiles(fileIds)
  }

  const handleNewDirectory = () => {
    console.log('Creating new directory...')
  }

  const handleImportContent = (type: 'json' | 'xml' | 'pdf' | 'csv') => {
    console.log(`Import ${type.toUpperCase()} content...`)
  }

  const handleCreateContent = (type: 'json' | 'xml') => {
    console.log(`Create ${type.toUpperCase()} content...`)
  }

  const handleDeleteContent = () => {
    if (selectedItem) {
      console.log('Deleting content:', selectedItem.name)
    }
  }

  const handleSeeDetails = () => {
    if (selectedItem) {
      console.log('Showing details for:', selectedItem.name)
    }
  }

  const handleDownloadContent = () => {
    if (selectedFiles.length === 1) {
      console.log('Downloading content...')
    }
  }

  const handleRefresh = () => {
    console.log('Refreshing content...')
  }

  const handleToggleNavMenu = () => {
    setIsNavMenuCollapsed((prev) => !prev)
  }

  if (variant === 'viewer') {
    return (
      <div className={styles.container}>
        <Header />

        <div className={styles.content}>
          <main className={styles.mainContent}>{children}</main>
        </div>

        <Footer />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Header onToggleNavMenu={handleToggleNavMenu} />

      <div className={styles.content}>
        <div
          style={{
            marginLeft: `${getMainContentMarginLeft(isNavMenuCollapsed)}px`,
            transition: ANIMATIONS.CONTENT_TRANSITION,
            width: `calc(100vw - ${getMainContentMarginLeft(isNavMenuCollapsed)}px)`,
            boxSizing: 'border-box',
          }}
        >
          <ActionBar
            hasSelection={selectedFiles.length > 0}
            onNewDirectory={handleNewDirectory}
            disableNewDirectory={false}
            onImportContent={handleImportContent}
            onCreateContent={handleCreateContent}
            disableImportContent={false}
            disableCreateContent={false}
            canDownload={selectedFiles.length === 1}
            onDownloadContent={handleDownloadContent}
            onDeleteContent={handleDeleteContent}
            onSeeDetails={handleSeeDetails}
            onRefresh={handleRefresh}
          />
        </div>

        <NavMenu
          root={placeholderRoot}
          onItemSelect={handleItemSelect}
          selectedItemId={selectedItem?.id ?? null}
          isCollapsed={isNavMenuCollapsed}
        />

        <div
          className={styles.workspaceContainer}
          style={{
            marginLeft: `${getMainContentMarginLeft(isNavMenuCollapsed)}px`,
            transition: ANIMATIONS.CONTENT_TRANSITION,
            width: `calc(100vw - ${getMainContentMarginLeft(isNavMenuCollapsed)}px)`,
            boxSizing: 'border-box',
          }}
        >
          <main className={styles.mainContent}>
            {selectedItem ? (
              <FileListView
                directory={selectedItem}
                selectedFiles={selectedFiles}
                onFileSelect={handleFileSelect}
              />
            ) : (
              <div className={styles.contentArea}>
                <div className={styles.emptyState}>
                  <Text size={500}>
                    Select a directory from the Content Explorer to view files
                  </Text>
                </div>
              </div>
            )}

            {children}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}
