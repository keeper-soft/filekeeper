import type {FormEvent} from 'react';
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Input,
    Label,
    Caption1,
    Spinner,
    makeStyles,
    tokens,
    MessageBar,
} from '@fluentui/react-components';

const useStyles = makeStyles({
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
    },
    pathHint: {
        color: tokens.colorNeutralForeground3,
    },
    spinnerRow: {
        display: 'flex',
        justifyContent: 'center',
        padding: tokens.spacingVerticalS,
    },
});

export interface CreateDirectoryDialogProps {
    open: boolean;
    directoryName: string;
    parentPath: string;
    isSubmitting: boolean;
    errorMessage?: string | null;
    onNameChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
}

export const CreateDirectoryDialog = ({
                                          open,
                                          directoryName,
                                          parentPath,
                                          isSubmitting,
                                          errorMessage,
                                          onNameChange,
                                          onCancel,
                                          onSubmit,
                                      }: CreateDirectoryDialogProps) => {
    const styles = useStyles();

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isSubmitting) {
            onSubmit();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(_, data) => {
            if (!data.open) onCancel();
        }}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Create new directory</DialogTitle>
                    <DialogContent>
                        <form className={styles.form} onSubmit={handleSubmit}>
                            <div className={styles.inputGroup}>
                                <Label htmlFor="new-directory-name">Directory name</Label>
                                <Input
                                    id="new-directory-name"
                                    value={directoryName}
                                    onChange={(_, data) => onNameChange(data.value)}
                                    placeholder="Enter directory name"
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <Label>Location</Label>
                                <Caption1 className={styles.pathHint}>{parentPath}</Caption1>
                            </div>

                            {errorMessage && <MessageBar intent="error">{errorMessage}</MessageBar>}

                            {isSubmitting && (
                                <div className={styles.spinnerRow}>
                                    <Spinner label="Creating directory"/>
                                </div>
                            )}
                        </form>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={onCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" appearance="primary" disabled={!directoryName.trim() || isSubmitting}
                                onClick={onSubmit}>
                            Create directory
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

export default CreateDirectoryDialog;
