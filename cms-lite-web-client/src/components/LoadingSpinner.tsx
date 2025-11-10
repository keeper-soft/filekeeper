import { Spinner } from '@fluentui/react-components';

interface LoadingSpinnerProps {
  message?: string
}

export const LoadingSpinner = ({ message = 'Loading...' }: LoadingSpinnerProps) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '200px',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <Spinner size="large" />
      <span>{message}</span>
    </div>
  )
};
