import { useSelector } from 'react-redux';
import {
  makeStyles, 
  tokens, 
  Card, 
  CardPreview,
  Body1,
  Title2,
} from '@fluentui/react-components';
import type { RootState } from '../store/store';
import {
  selectDashboardStats,
  selectDashboardErrors,
} from '../store/slices/dashboard';

const useDashboardStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    height: '100%',
    overflow: 'auto',
  },
  
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
  },
  
  statCard: {
    padding: tokens.spacingVerticalM,
    textAlign: 'center',
  },
  
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  
  sectionTitle: {
    marginBottom: tokens.spacingVerticalM,
  },
  
  listItem: {
    padding: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  errorMessage: {
    color: tokens.colorPaletteRedForeground1,
    padding: tokens.spacingVerticalM,
    textAlign: 'center',
  },
});

/**
 * Dashboard Content Component
 * 
 * Displays the actual dashboard content when data is loaded.
 * Shows stats, recent files, activities, and handles error states.
 */
export const DashboardContent = () => {
  const styles = useDashboardStyles();

  // Redux selectors
  const stats = useSelector((state: RootState) => selectDashboardStats(state));
  const errors = useSelector((state: RootState) => selectDashboardErrors(state));

  return (
    <div className={styles.container}>
      {/* Stats Section */}
      {stats && (
        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <CardPreview>
              <Title2>{stats.totalFiles}</Title2>
              <Body1>Total Files</Body1>
            </CardPreview>
          </Card>
          <Card className={styles.statCard}>
            <CardPreview>
              <Title2>{stats.totalFolders}</Title2>
              <Body1>Total Folders</Body1>
            </CardPreview>
          </Card>
          <Card className={styles.statCard}>
            <CardPreview>
              <Title2>{stats.storageUsed}</Title2>
              <Body1>Storage Used</Body1>
            </CardPreview>
          </Card>
          <Card className={styles.statCard}>
            <CardPreview>
              <Title2>{stats.recentActivity}</Title2>
              <Body1>Recent Activity</Body1>
            </CardPreview>
          </Card>
        </div>
      )}
      
      {/* Error display for stats */}
      {errors.stats && (
        <div className={styles.errorMessage}>
          <Body1>Error loading stats: {errors.stats}</Body1>
        </div>
      )}
    </div>
  );
};
