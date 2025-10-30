import {useEffect, useMemo, useState} from 'react'
import {makeStyles, tokens, Text, Spinner} from '@fluentui/react-components'
import {
    FolderRegular,
    FolderOpenRegular,
    ChevronRightRegular,
    ChevronDownRegular,
} from '@fluentui/react-icons'
import {NAV_MENU, ANIMATIONS, BREAKPOINTS, HEADER} from './layoutConstants'
import type {DirectoryNode} from '../types/directories.ts'
import {NavSelector} from "../components/NavSelector.tsx";

const useStyles = makeStyles({
    navMenu: {
        position: 'sticky',
        top: 0,
        backgroundColor: tokens.colorNeutralBackground1,
        borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
        padding: tokens.spacingVerticalM,
        overflowY: 'auto',
        transition: ANIMATIONS.NAV_MENU_TRANSITION,
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        [`@media (max-width: ${BREAKPOINTS.TABLET}px)`]: {
            position: 'fixed',
            top: `${HEADER.HEIGHT}px`,
            bottom: 0,
            height: `calc(100vh - ${HEADER.HEIGHT}px)`,
            maxHeight: 'none',
            borderRight: 'none',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.2)',
            zIndex: NAV_MENU.Z_INDEX,
        },
    },
    inlineExpanded: {
        width: `${NAV_MENU.EXPANDED_WIDTH}px`,
    },
    inlineCollapsed: {
        width: `${NAV_MENU.COLLAPSED_WIDTH}px`,
    },
    overlayBase: {
        width: 'min(85vw, 320px)',
        transform: 'translateX(0)',
        transition: 'transform 0.3s ease, opacity 0.3s ease',
        [`@media (max-width: ${BREAKPOINTS.MOBILE}px)`]: {
            width: 'min(90vw, 320px)',
        },
    },
    overlayHidden: {
        transform: 'translateX(-100%)',
        pointerEvents: 'none',
        opacity: 0,
        visibility: 'hidden',
    },
    overlayVisible: {
        transform: 'translateX(0)',
        pointerEvents: 'auto',
        opacity: 1,
        visibility: 'visible',
    },
    header: {
        padding: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalM,
    },
    treeContainer: {
        width: '100%',
    },
    treeItem: {
        display: 'flex',
        width: '100%',
        textAlign: 'left',
        marginBottom: '2px',
        padding: tokens.spacingVerticalS,
        border: 'none',
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusSmall,
        cursor: 'pointer',
        color: tokens.colorNeutralForeground1,
        '&:hover': {
            backgroundColor: tokens.colorBrandBackground,
            color: tokens.colorNeutralForegroundOnBrand,
        },
    },
    selectedItem: {
        backgroundColor: tokens.colorBrandBackgroundSelected,
        color: tokens.colorNeutralForegroundOnBrand,
        '&:hover': {
            backgroundColor: tokens.colorBrandBackgroundPressed,
            color: tokens.colorNeutralForegroundOnBrand,
        },
    },
    childrenContainer: {
        marginLeft: tokens.spacingHorizontalL,
        borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
        paddingLeft: tokens.spacingHorizontalS,
    },
    itemContent: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    contentExplorerTitle: {
        textAlign: 'center',
        fontSize: '1.25rem',

        marginTop: tokens.spacingVerticalM,
        color: tokens.colorNeutralForeground1,
        [`@media (max-width: ${BREAKPOINTS.TABLET}px)`]: {
            display: 'none',
        },
        [`@media (max-width: ${BREAKPOINTS.MOBILE}px)`]: {
            fontSize: '1rem',
        },
    }
})

interface NavMenuProps {
    root: DirectoryNode | null
    onItemSelect?: (item: DirectoryNode) => void
    selectedItemId?: string | null
    isCollapsed?: boolean
    isOverlay?: boolean
    onDismissOverlay?: () => void
    isLoading?: boolean
    error?: string | null
}

export const NavMenu = ({
                            root,
                            onItemSelect,
                            selectedItemId,
                            isCollapsed = false,
                            isOverlay = false,
                            onDismissOverlay,
                            isLoading = false,
                            error = null,
                        }: NavMenuProps) => {
    const styles = useStyles()
    const initialExpanded = useMemo(() => {
        const ids = new Set<string>()
        if (root) {
            ids.add(root.id)
        }
        return ids
    }, [root])
    const [expandedItems, setExpandedItems] = useState<Set<string>>(initialExpanded)

    useEffect(() => {
        setExpandedItems(initialExpanded)
    }, [initialExpanded]);

    const handleItemClick = (item: DirectoryNode) => {
        const canToggle = item.subDirectories.length > 0
        if (canToggle) {
            setExpandedItems(prev => {
                const next = new Set(prev)
                if (next.has(item.id)) {
                    next.delete(item.id)
                } else {
                    next.add(item.id)
                }
                return next
            });
        }
        onItemSelect?.(item)
        if (isOverlay) {
            onDismissOverlay?.()
        }
    };

    const renderTreeItem = (item: DirectoryNode, level: number = 0) => {
        const isExpanded = expandedItems.has(item.id) && !isCollapsed
        const hasChildren = item.subDirectories.length > 0
        const isSelected = selectedItemId === item.id
        const displayName = item.parentId === null ? 'Root Directory' : item.name
        return (
            <div key={item.id}>
                <button
                    className={`${styles.treeItem} ${isSelected ? styles.selectedItem : ''}`}
                    onClick={() => !isCollapsed && handleItemClick(item)}
                    style={{
                        marginLeft: isCollapsed ? '0' : `${level * 16}px`,
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        alignItems: 'center',
                    }}
                    title={isCollapsed ? displayName : undefined}
                >
                    <div className={styles.itemContent}>
                        {!isCollapsed && hasChildren && (isExpanded ? <ChevronDownRegular/> : <ChevronRightRegular/>)}
                        {isExpanded ? <FolderOpenRegular/> : <FolderRegular/>}
                        {!isCollapsed && (
                            <Text size={300}>
                                {displayName}
                            </Text>
                        )}
                    </div>
                </button>

                {hasChildren && isExpanded && !isCollapsed && (
                    <div className={styles.childrenContainer}>
                        {item.subDirectories.map(child => renderTreeItem(child, level + 1))}
                    </div>
                )}
            </div>
        )
    }

    const navClassName = [
        styles.navMenu,
        isOverlay ? styles.overlayBase : (isCollapsed ? styles.inlineCollapsed : styles.inlineExpanded),
        isOverlay ? (isCollapsed ? styles.overlayHidden : styles.overlayVisible) : undefined,
    ]
        .filter(Boolean)
        .join(' ');

    const topLevelItems = useMemo(() => {
        return root ? [root] : []
    }, [root]);

    return (
        <nav className={navClassName} aria-label="Content explorer" aria-hidden={isOverlay && isCollapsed}>
            {!isCollapsed && (
                <div className={styles.header}>
                    <NavSelector/>
                    <div className={styles.contentExplorerTitle}>
                        <Text weight="semibold">
                            Content Explorer
                        </Text>
                    </div>
                </div>
            )}

            <div className={styles.treeContainer}>
                {isLoading ? (
                    <div style={{display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXL}}>
                        <Spinner label="Loading directories"/>
                    </div>
                ) : error ? (
                    <Text size={300} style={{color: tokens.colorPaletteRedForeground1}}>
                        {error}
                    </Text>
                ) : topLevelItems.length > 0 ? (
                    topLevelItems.map(item => renderTreeItem(item))
                ) : (
                    <Text size={300} style={{color: tokens.colorNeutralForeground3}}>
                        No directories available
                    </Text>
                )}
            </div>
        </nav>
    )
}
