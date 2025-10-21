import {useEffect, useMemo, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {useAuth} from "../index";
import {GOOGLE_NONCE_STORAGE_KEY, GITHUB_STATE_STORAGE_KEY} from "./AuthProvider";
import {
    decodeStatePayload,
    extractParams,
} from "../../utilities/extract-params";
import {
    makeStyles,
    shorthands,
    tokens,
    Spinner,
    Title3,
    Body1,
    MessageBar,
    MessageBarBody,
    MessageBarTitle
} from "@fluentui/react-components";
import {ErrorCircle24Regular, CheckmarkCircle24Regular} from "@fluentui/react-icons";

type Status = "pending" | "success" | "error";
type Provider = "google" | "github" | "atlassian";
type GitHubStatePayload = {
    csrf: string;
    redirect?: string;
};

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.padding(tokens.spacingVerticalXXL),
    },
    content: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        ...shorthands.gap(tokens.spacingVerticalXL),
        maxWidth: "480px",
        textAlign: "center",
    },
});

export function AuthCallback() {
    const location = useLocation();
    const navigate = useNavigate();
    const { loginWithOAuth } = useAuth();
    const styles = useStyles();
    const [status, setStatus] = useState<Status>("pending");
    const [error, setError] = useState<string | null>(null);

    const provider = useMemo<Provider | null>(() => {
        const match = location.pathname.match(/\/auth\/([^/]+)\/callback/i);
        const name = match?.[1]?.toLowerCase();
        if (name === "google" || name === "github" || name === "atlassian") {
            return name;
        }
        return null;
    }, [location.pathname]);

    const searchParams = useMemo(() => {
        return extractParams(location.search, location.hash);
    }, [location.search, location.hash]);

    useEffect(() => {
        const handleOAuthCallback = async () => {
            if (!provider) {
                setError("Invalid provider");
                setStatus("error");
                return;
            }

            try {
                if (provider === "google") {
                    const code = searchParams.get("code");
                    const state = searchParams.get("state");

                    if (!code) {
                        setError("No Google authorization code found");
                        setStatus("error");
                        return;
                    }

                    const storedNonce = sessionStorage.getItem(GOOGLE_NONCE_STORAGE_KEY);
                    if (storedNonce && state !== storedNonce) {
                        sessionStorage.removeItem(GOOGLE_NONCE_STORAGE_KEY);
                        setError("Sign-in validation failed. Please try again.");
                        setStatus("error");
                        return;
                    }

                    // Clean up stored nonce
                    sessionStorage.removeItem(GOOGLE_NONCE_STORAGE_KEY);

                    // Call backend to exchange code for JWT
                    const success = await loginWithOAuth("google", code);

                    if (success) {
                        setStatus("success");
                        setTimeout(() => navigate("/dashboard"), 1000);
                    } else {
                        setError("Failed to authenticate with Google. Please try again.");
                        setStatus("error");
                    }
                }

                if (provider === "github") {
                    const code = searchParams.get("code");
                    const stateParam = searchParams.get("state");

                    if (!code || !stateParam) {
                        setError("Missing GitHub authorization parameters");
                        setStatus("error");
                        return;
                    }

                    const storedStateRaw = sessionStorage.getItem(GITHUB_STATE_STORAGE_KEY);
                    const decodedState = decodeStatePayload<GitHubStatePayload>(stateParam);
                    const storedState: GitHubStatePayload | null = storedStateRaw
                        ? (() => {
                            try {
                                return JSON.parse(storedStateRaw) as GitHubStatePayload;
                            } catch {
                                return null;
                            }
                        })()
                        : null;

                    if (
                        !decodedState?.csrf ||
                        !storedState?.csrf ||
                        decodedState.csrf !== storedState.csrf
                    ) {
                        sessionStorage.removeItem(GITHUB_STATE_STORAGE_KEY);
                        setStatus("error");
                        setError("Sign-in validation failed. Please try again.");
                        return;
                    }

                    // Clean up stored state
                    sessionStorage.removeItem(GITHUB_STATE_STORAGE_KEY);

                    // Call backend to exchange code for JWT
                    const success = await loginWithOAuth("github", code);

                    if (success) {
                        setStatus("success");
                        const redirectPath = decodedState.redirect || "/dashboard";
                        setTimeout(() => navigate(redirectPath), 1000);
                    } else {
                        setError("Failed to authenticate with GitHub. Please try again.");
                        setStatus("error");
                    }
                }
            } catch (err) {
                console.error("OAuth callback error:", err);
                setError("An unexpected error occurred during authentication.");
                setStatus("error");
            }
        };

        handleOAuthCallback();
    }, [provider, searchParams, loginWithOAuth, navigate]);

    return (
        <div className={styles.root}>
            <div className={styles.content}>
                {status === "pending" && (
                    <>
                        <Spinner size="extra-large" />
                        <Title3>Authenticating...</Title3>
                        <Body1>Please wait while we complete your sign-in with {provider}.</Body1>
                    </>
                )}

                {status === "success" && (
                    <>
                        <CheckmarkCircle24Regular
                            style={{ color: tokens.colorPaletteGreenForeground1, fontSize: "64px" }}
                        />
                        <Title3>Success!</Title3>
                        <Body1>You've been successfully authenticated. Redirecting to dashboard...</Body1>
                    </>
                )}

                {status === "error" && (
                    <>
                        <ErrorCircle24Regular
                            style={{ color: tokens.colorPaletteRedForeground1, fontSize: "64px" }}
                        />
                        <Title3>Authentication Failed</Title3>
                        <MessageBar intent="error">
                            <MessageBarBody>
                                <MessageBarTitle>Error</MessageBarTitle>
                                {error || "An unknown error occurred during authentication."}
                            </MessageBarBody>
                        </MessageBar>
                        <Body1>
                            <a href="/login" style={{ color: tokens.colorBrandForeground1 }}>
                                Return to sign-in page
                            </a>
                        </Body1>
                    </>
                )}
            </div>
        </div>
    );
}