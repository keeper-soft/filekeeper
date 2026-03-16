import {
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  FolderAddRegular,
  ArrowImportRegular,
  DeleteRegular,
  EyeRegular,
  ArrowSyncRegular,
  ArrowDownloadRegular,
} from '@fluentui/react-icons'
import { ACTION_BAR, BREAKPOINTS } from './layoutConstants'

const useStyles = makeStyles({
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    minHeight: `${ACTION_BAR.HEIGHT}px`,
    width: '100%',
    zIndex: ACTION_BAR.Z_INDEX,
    boxSizing: 'border-box',
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalS,
    [`@media (max-width: ${BREAKPOINTS.TABLET}px)`]: {
      justifyContent: 'center',
      gap: tokens.spacingHorizontalS,
    },
  },
  buttonGroup: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    [`@media (max-width: ${BREAKPOINTS.TABLET}px)`]: {
      width: '100%',
      justifyContent: 'center',
    },
    [`@media (max-width: ${BREAKPOINTS.MOBILE}px)`]: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: tokens.spacingVerticalS,
    },
  },
})

type ImportContentType = 'json' | 'xml' | 'pdf' | 'csv'

interface ActionBarProps {
  hasSelection: boolean
  onNewDirectory?: () => void
  disableNewDirectory?: boolean
  onImportContent?: (type: ImportContentType) => void
  onCreateContent?: (type: 'json' | 'xml') => void
  disableImportContent?: boolean
  disableCreateContent?: boolean
  onDeleteContent?: () => void
  onSeeDetails?: () => void
  onRefresh?: () => void
  canDownload?: boolean
  onDownloadContent?: () => void
}

export const ActionBar = ({
  hasSelection,
  onNewDirectory,
  disableNewDirectory,
  onImportContent,
  disableImportContent,
  onDeleteContent,
  onSeeDetails,
  onRefresh,
  canDownload,
  onDownloadContent,
}: ActionBarProps) => {
  const styles = useStyles()

  return (
    <div className={styles.actionBar}>
      <div className={styles.buttonGroup}>
        <Button
          icon={<FolderAddRegular />}
          appearance="primary"
          onClick={onNewDirectory}
          disabled={disableNewDirectory}
        >
          New Directory
        </Button>

        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button
              appearance="primary"
              icon={<ArrowImportRegular />}
              disabled={disableImportContent}
            >
              Import
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={() => onImportContent?.('json')}>JSON</MenuItem>
              <MenuItem onClick={() => onImportContent?.('xml')}>XML</MenuItem>
              <MenuItem onClick={() => onImportContent?.('pdf')}>PDF</MenuItem>
              <MenuItem onClick={() => onImportContent?.('csv')}>CSV</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>

        <Button
          icon={<ArrowSyncRegular />}
          onClick={onRefresh}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.buttonGroup}>
        <Button
          icon={<ArrowDownloadRegular />}
          disabled={!canDownload}
          onClick={onDownloadContent}
        >
          Download
        </Button>

        <Button
          icon={<EyeRegular />}
          disabled={!hasSelection}
          onClick={onSeeDetails}
        >
          See Details
        </Button>

        <Button
          icon={<DeleteRegular />}
          disabled={!hasSelection}
          onClick={onDeleteContent}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
