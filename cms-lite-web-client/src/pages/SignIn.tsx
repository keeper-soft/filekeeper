import {Navigate} from 'react-router-dom'
import {
    makeStyles,
    shorthands,
    tokens,
    Button,
    Body1,
    Caption1,
    Title3,
    mergeClasses,
} from '@fluentui/react-components'
import {useAuth} from '../contexts'
import {FileKeeper} from "../components/icons/FileKeeper";
import {GoogleIcon} from "../components/icons/GoogleIcon";
import {MicrosoftIcon} from "../components/icons/MicrosoftIcon";
import {GitHubIcon} from "../components/icons/GitHubIcon";

const useStyles = makeStyles({
    root: {
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.padding(tokens.spacingHorizontalXXL, tokens.spacingHorizontalS),
    },

    card: {
        display: 'flex',
        width: '100%',
        maxWidth: '960px',
        backgroundColor: tokens.colorNeutralBackground1,
        boxShadow: tokens.shadow16,
        ...shorthands.borderRadius(tokens.borderRadiusXLarge),
        ...shorthands.overflow('hidden'),
        '@media (max-width: 768px)': {
            flexDirection: 'column',
        },
    },

    panel: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...shorthands.padding('48px'),
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        '@media (max-width: 768px)': {
            display: 'none',
        },
    },
    panelImage: {
        maxWidth: '280px',
        marginBottom: tokens.spacingVerticalXXL,
    },
    panelTitle: {
        marginBottom: tokens.spacingVerticalL,
        color: tokens.colorNeutralForegroundOnBrand,
    },
    panelText: {
        textAlign: 'center',
        maxWidth: '320px',
        color: tokens.colorNeutralForegroundOnBrand,
    },

    formContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...shorthands.padding('48px', '64px'),
        '@media (max-width: 768px)': {
            ...shorthands.padding(tokens.spacingHorizontalXXL, tokens.spacingHorizontalL),
        },
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingVerticalXS),
        marginBottom: tokens.spacingVerticalXXL,
    },
    title: {
        marginBottom: tokens.spacingVerticalS,
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingVerticalL),
    },
    inputField: {
        width: '100%',
    },
    passwordToggle: {
        cursor: 'pointer',
    },
    submitButton: {
        marginTop: tokens.spacingVerticalM,
        width: '100%',
    },
    footer: {
        marginTop: tokens.spacingVerticalXXL,
        textAlign: 'center',
    },

    credentialsHint: {
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.padding(tokens.spacingVerticalM),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
        marginTop: tokens.spacingVerticalL,
        textAlign: 'center',
    },

    divider: {
        display: 'flex',
        alignItems: 'center',
        textAlign: 'center',
        ...shorthands.margin(tokens.spacingVerticalL, 0),
        '::before': {
            content: '""',
            flex: 1,
            ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
        },
        '::after': {
            content: '""',
            flex: 1,
            ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
        },
    },
    dividerText: {
        ...shorthands.padding(0, tokens.spacingHorizontalM),
        color: tokens.colorNeutralForeground3,
    },

    oauthContainer: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingVerticalM),
    },

    oauthButton: {
        width: '100%',
        justifyContent: 'flex-start',
        ...shorthands.gap(tokens.spacingHorizontalM),
    },

    googleButton: {
        backgroundColor: '#ffffff',
        color: '#3c4043',
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
        ':hover': {
            backgroundColor: tokens.colorBrandBackground,
            color: '#ffffff',
            ...shorthands.border('1px', 'solid', tokens.colorBrandBackground),
            boxShadow: '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)',
        },
        ':active': {
            backgroundColor: '#f1f3f4',
        },
    },

    microsoftButton: {
        backgroundColor: '#ffffff',
        color: '#5e5e5e',
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
        ':hover': {
            backgroundColor: tokens.colorBrandBackground,
            color: '#ffffff',
            ...shorthands.border('1px', 'solid', tokens.colorBrandBackground),
        },
        ':active': {
            backgroundColor: '#edebe9',
        },
    },

    githubButton: {
        backgroundColor: '#24292e',
        color: '#ffffff',
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
        ':hover': {
            backgroundColor: tokens.colorBrandBackground,
            color: '#ffffff',
            ...shorthands.border('1px', 'solid', tokens.colorBrandBackground),
        },
        ':active': {
            backgroundColor: '#1b1f23',
        },
    },
});

// OAuth configuration - these will be environment variables in production
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID';

// Generate cryptographically secure random string for CSRF protection
const generateSecureRandom = async (length: number = 32): Promise<string> => {
    const buffer = new Uint8Array(length);
    crypto.getRandomValues(buffer);
    return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const SignIn = () => {
    const {isAuthenticated} = useAuth();
    const styles = useStyles();

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace/>;
    }

    const handleGoogleSignIn = async () => {
        try {
            // Generate nonce for CSRF protection
            const nonce = await generateSecureRandom(32);
            sessionStorage.setItem('pokeeper:google-nonce', nonce);

            // Build Google OAuth URL
            const redirectUri = `${window.location.origin}/auth/google/callback`;
            const params = new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: 'openid email profile',
                nonce: nonce,
                state: nonce, // Also use as state for additional security
                access_type: 'offline',
                prompt: 'consent'
            });

            // Redirect to Google OAuth
            window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        } catch (error) {
            console.error('Failed to initiate Google sign-in:', error);
        }
    };

    const handleMicrosoftSignIn = () => {
        console.log('Microsoft OAuth sign-in initiated');
        // TODO: Implement Microsoft OAuth when needed
    };

    const handleGitHubSignIn = async () => {
        try {
            // Generate state with CSRF token
            const csrf = await generateSecureRandom(32);
            const statePayload = {
                csrf,
                redirect: '/dashboard'
            };

            // Store state in sessionStorage
            sessionStorage.setItem('pokeeper:github-state', JSON.stringify(statePayload));

            // Encode state for URL
            const state = btoa(JSON.stringify(statePayload));

            // Build GitHub OAuth URL
            const redirectUri = `${window.location.origin}/auth/github/callback`;
            const params = new URLSearchParams({
                client_id: GITHUB_CLIENT_ID,
                redirect_uri: redirectUri,
                scope: 'read:user user:email',
                state: state
            });

            // Redirect to GitHub OAuth
            window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
        } catch (error) {
            console.error('Failed to initiate GitHub sign-in:', error);
        }
    };

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                <div className={styles.panel}>
                    <div className={styles.panelImage}><FileKeeper/></div>
                    <Title3 as="h1" className={styles.panelTitle}>Welcome to FileKeeper</Title3>
                    <Body1 className={styles.panelText}>
                        Your secure and reliable solution for file management. Access your world, simplified.
                    </Body1>
                </div>
                <div className={styles.formContainer}>
                    <header className={styles.header}>
                        <Title3 as="h2">Welcome</Title3>
                        <Body1>Continue (Sig In or Sign Up) with one of your following accounts.</Body1>
                    </header>
                    <div className={styles.divider}>
                        <Caption1 className={styles.dividerText}></Caption1>
                    </div>
                    <div className={styles.oauthContainer}>
                        <Button
                            appearance="secondary"
                            size="large"
                            className={mergeClasses(styles.oauthButton, styles.googleButton)}
                            onClick={handleGoogleSignIn}
                            icon={<GoogleIcon/>}
                        >
                            Continue with Google
                        </Button>
                        <Button
                            appearance="secondary"
                            size="large"
                            className={mergeClasses(styles.oauthButton, styles.microsoftButton)}
                            onClick={handleMicrosoftSignIn}
                            icon={<MicrosoftIcon/>}
                        >
                            Continue with Microsoft
                        </Button>

                        <Button
                            appearance="secondary"
                            size="large"
                            className={mergeClasses(styles.oauthButton, styles.githubButton)}
                            onClick={handleGitHubSignIn}
                            icon={<GitHubIcon/>}
                        >
                            Continue with GitHub
                        </Button>
                    </div>
                    <footer className={styles.footer}>
                        {/*<Caption1>*/}
                        {/*    Don't have an account? <Link>Sign Up</Link>*/}
                        {/*</Caption1>*/}
                    </footer>
                </div>
            </div>
        </div>
    );
};