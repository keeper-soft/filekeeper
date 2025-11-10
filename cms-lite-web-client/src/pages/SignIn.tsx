import {useState} from 'react';
import {Navigate} from 'react-router-dom';
import {
    makeStyles,
    shorthands,
    tokens,
    Button,
    Input,
    Body1,
    Caption1,
    Title3,
    Link,
    Field,
    MessageBar,
    MessageBarBody,
    MessageBarTitle,
    Spinner,
    mergeClasses,
} from '@fluentui/react-components';
import {PersonRegular, LockClosedRegular, EyeRegular, EyeOffRegular} from '@fluentui/react-icons';
import {useAuth} from '../contexts';
//import {FileKeeperIllustration} from '../components/icons/FileKeeperIllustration'
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

export const SignIn = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [error, setError] = useState('');
    const {login, isAuthenticated, isLoading} = useAuth();
    const styles = useStyles();

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace/>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }
        const success = await login(email, password);
        if (!success) {
            setError('Invalid email or password');
        }
    };

    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };

    // TODO: Implement OAuth authentication handlers
    const handleGoogleSignIn = () => {
        console.log('Google OAuth sign-in initiated');
        // OAuth redirect logic will be implemented in backend integration
    };

    const handleMicrosoftSignIn = () => {
        console.log('Microsoft OAuth sign-in initiated');
        // OAuth redirect logic will be implemented in backend integration
    };

    const handleGitHubSignIn = () => {
        console.log('GitHub OAuth sign-in initiated');
        // OAuth redirect logic will be implemented in backend integration
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
                        <Title3 as="h2">Sign In</Title3>
                        <Body1>Enter your details below to access your account.</Body1>
                    </header>
                                        <form onSubmit={handleSubmit} className={styles.form}>
                        {error && (
                            <MessageBar intent="error">
                                <MessageBarBody>
                                    <MessageBarTitle>Error</MessageBarTitle>
                                    {error}
                                </MessageBarBody>
                            </MessageBar>
                        )}

                        <Field label="Email Address" required className={styles.inputField}>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="e.g., name@example.com"
                                contentBefore={<PersonRegular/>}
                                size="large"
                            />
                        </Field>

                        <Field label="Password" required className={styles.inputField}>
                            <Input
                                type={passwordVisible ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                contentBefore={<LockClosedRegular/>}
                                contentAfter={
                                    passwordVisible ?
                                        <EyeOffRegular className={styles.passwordToggle}
                                                       onClick={togglePasswordVisibility}/> :
                                        <EyeRegular className={styles.passwordToggle}
                                                    onClick={togglePasswordVisibility}/>
                                }
                                size="large"
                            />
                        </Field>

                        <Button
                            type="submit"
                            appearance="primary"
                            disabled={isLoading}
                            className={styles.submitButton}
                            size="large"
                        >
                            {isLoading ? <Spinner size="tiny"/> : 'Sign In'}
                        </Button>

                        <div className={styles.credentialsHint}>
                            <Body1><strong>Demo Credentials</strong></Body1>
                            <br/>
                            <Caption1>Email: admin@email.com</Caption1>
                            <br/>
                            <Caption1>Password: biggerThan_6_chars</Caption1>
                        </div>
                    </form>

                    <div className={styles.divider}>
                        <Caption1 className={styles.dividerText}>or</Caption1>
                    </div>

                    <div className={styles.oauthContainer}>
                        <Button
                            appearance="secondary"
                            size="large"
                            className={mergeClasses(styles.oauthButton, styles.googleButton)}
                            onClick={handleGoogleSignIn}
                            icon={<GoogleIcon />}
                        >
                            Continue with Google
                        </Button>

                        <Button
                            appearance="secondary"
                            size="large"
                            className={mergeClasses(styles.oauthButton, styles.microsoftButton)}
                            onClick={handleMicrosoftSignIn}
                            icon={<MicrosoftIcon />}
                        >
                            Continue with Microsoft
                        </Button>

                        <Button
                            appearance="secondary"
                            size="large"
                            className={mergeClasses(styles.oauthButton, styles.githubButton)}
                            onClick={handleGitHubSignIn}
                            icon={<GitHubIcon />}
                        >
                            Continue with GitHub
                        </Button>
                    </div>



                    <footer className={styles.footer}>
                        <Caption1>
                            Don't have an account? <Link>Sign Up</Link>
                        </Caption1>
                    </footer>
                </div>
            </div>
        </div>
    );
};