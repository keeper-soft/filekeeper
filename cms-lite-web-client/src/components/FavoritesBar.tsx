import { makeStyles, tokens, Button, Text } from '@fluentui/react-components';
import { DeleteRegular, EyeRegular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  message: {
    color: tokens.colorNeutralForeground3,
  },
});

interface FavoritesBarProps {
  selectedCount: number;
  onRemoveFavorites: () => void;
  isRemoving?: boolean;
  onSeeDetails?: () => void;
  seeDetailsDisabled?: boolean;
}

export const FavoritesBar = ({
  selectedCount,
  onRemoveFavorites,
  isRemoving = false,
  onSeeDetails,
  seeDetailsDisabled,
}: FavoritesBarProps) => {
  const styles = useStyles();
  const hasSelection = selectedCount > 0;
  const detailsDisabled = seeDetailsDisabled ?? !hasSelection;

  return (
    <div className={styles.container}>
      <Text className={styles.message} size={300}>
        {hasSelection ? `${selectedCount} item${selectedCount === 1 ? '' : 's'} selected` : 'Select an item to manage favorites'}
      </Text>
      <Button
        appearance="secondary"
        icon={<EyeRegular />}
        disabled={detailsDisabled}
        onClick={onSeeDetails}
      >
        See Details
      </Button>
      <Button
        appearance="primary"
        icon={<DeleteRegular />}
        disabled={!hasSelection || isRemoving}
        onClick={onRemoveFavorites}
      >
        Remove
      </Button>
    </div>
  );
};

export default FavoritesBar;
