import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    Text,
    Spinner,
    makeStyles,
    tokens,
    MessageBar,
} from '@fluentui/react-components';

const useStyles = makeStyles({
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        minWidth: 'min(480px, 90vw)',
    },
    listWrapper: {
        maxHeight: '240px',
        overflowY: 'auto',
        padding: tokens.spacingVerticalS,
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground2,
    },
    successRow: {
        marginTop: tokens.spacingVerticalS,
    },
});

export interface SoftDeleteItem {
    id: string;
    name: string;
    path: string;
    resource: string;
}

export interface SoftDeleteDialogProps {
    open: boolean;
    items: SoftDeleteItem[];
    isSubmitting: boolean;
    errorMessage?: string | null;
    successMessage?: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export const SoftDeleteDialog = ({
                                     open,
                                     items,
                                     isSubmitting,
                                     errorMessage,
                                     successMessage,
                                     onCancel,
                                     onConfirm,
                                 }: SoftDeleteDialogProps) => {
    const styles = useStyles();

    return (
        <Dialog
            open={open}
            modalType="modal"
            onOpenChange={(_, data) => {
                if (isSubmitting) {
                    return
                }
                if (!data.open) {
                    onCancel()
                }
            }}
        >
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Delete selected content?</DialogTitle>
                    <DialogContent className={styles.content}>
                        <Text>
                            You are about to remove {items.length}{' '}
                            {items.length === 1 ? 'item' : 'items'}. This action cannot be undone.
                        </Text>

                        {errorMessage && <MessageBar intent="error">{errorMessage}</MessageBar>}
                        {successMessage && (
                            <MessageBar intent="success" className={styles.successRow}>
                                {successMessage}
                            </MessageBar>
                        )}

                        {items.length > 0 && (
                            <div className={styles.listWrapper}>
                                <List aria-label="Selected resources">
                                    {items.map((item) => (
                                        <ListItem key={item.id}>
                                            <Text weight="semibold">{item.name}</Text>
                                            <Text as="span" role="presentation"
                                                  style={{color: tokens.colorNeutralForeground3}}>
                                                {' '}
                                                ({item.path})
                                            </Text>
                                        </ListItem>
                                    ))}
                                </List>
                            </div>
                        )}

                        {isSubmitting && <Spinner label="Removing items" />}
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={onCancel} disabled={isSubmitting}>
                            {successMessage ? 'Close' : 'Cancel'}
                        </Button>
                        {!successMessage && (
                            <Button appearance="primary" onClick={onConfirm}
                                    disabled={isSubmitting || items.length === 0}>
                                Delete
                            </Button>
                        )}
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}

export default SoftDeleteDialog;
