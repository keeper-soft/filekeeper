# OAuth Third-Party Authentication - Frontend Implementation

## Overview
This document describes the complete OAuth authentication flow implementation for Google and GitHub sign-in.

## Files Modified

### 1. **SignIn.tsx** (`src/pages/SignIn.tsx`)
- **Added OAuth redirect handlers** for Google and GitHub
- **CSRF Protection**: Generates cryptographically secure random tokens (nonce/state)
- **Session Storage**: Stores CSRF tokens for validation on callback
- **OAuth URLs**: Redirects users to provider OAuth endpoints with proper parameters

**Key Features:**
- Google: Uses `nonce` parameter for CSRF protection
- GitHub: Uses `state` parameter with JSON payload (csrf + redirect path)
- Environment variables: `VITE_GOOGLE_CLIENT_ID` and `VITE_GITHUB_CLIENT_ID`

**Flow:**
```
User clicks button → Generate CSRF token → Store in sessionStorage → Redirect to provider
```

### 2. **AuthProvider.tsx** (`src/contexts/auth/AuthProvider.tsx`)
- **Added `loginWithOAuth` method** to handle third-party authentication
- **Backend Integration**: Calls `POST /auth/{provider}/token` with authorization code
- **Token Exchange**: Receives your JWT token from backend
- **State Management**: Updates Redux store with user information
- **Same Flow as Regular Login**: Stores JWT, updates context, sets authenticated state

**API Endpoint Called:**
```typescript
POST /auth/google/token  // For Google OAuth
POST /auth/github/token  // For GitHub OAuth

Request: { code: "authorization_code_from_provider" }
Response: { token: "your_jwt_token", user: { ...userInfo } }
```

### 3. **AuthCallback.tsx** (`src/contexts/auth/AuthCallback.tsx`)
- **Complete OAuth callback handler** with UI feedback
- **CSRF Validation**: Validates nonce/state from sessionStorage
- **Backend Token Exchange**: Calls `loginWithOAuth` to exchange code for JWT
- **Navigation**: Redirects to dashboard on success
- **Error Handling**: User-friendly error messages and retry options

**UI States:**
- **Pending**: Shows spinner with "Authenticating..." message
- **Success**: Shows checkmark with success message, auto-redirects to dashboard
- **Error**: Shows error icon with detailed error message and link back to sign-in

### 4. **auth.ts** (`src/types/auth.ts`)
- **Updated AuthContextType** to include `loginWithOAuth` method signature

### 5. **App.tsx** (already had routes)
- Routes already configured:
  - `/auth/google/callback`
  - `/auth/github/callback`

## Complete OAuth Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND OAUTH FLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. USER CLICKS "CONTINUE WITH GOOGLE/GITHUB"
   ↓
   SignIn.tsx: handleGoogleSignIn() / handleGitHubSignIn()
   - Generate CSRF token (nonce/state)
   - Store in sessionStorage
   - Redirect to provider OAuth URL

2. USER AUTHENTICATES WITH PROVIDER
   ↓
   Google/GitHub OAuth pages
   - User logs in
   - User grants permissions

3. PROVIDER REDIRECTS TO CALLBACK URL
   ↓
   URL: /auth/{provider}/callback?code=xxx&state=yyy
   AuthCallback.tsx renders

4. FRONTEND VALIDATES CSRF
   ↓
   AuthCallback.tsx: handleOAuthCallback()
   - Extract code and state from URL
   - Validate state/nonce matches sessionStorage
   - Clean up sessionStorage

5. FRONTEND CALLS YOUR BACKEND
   ↓
   POST /auth/{provider}/token { code: "xxx" }
   AuthProvider.tsx: loginWithOAuth()

6. BACKEND EXCHANGES TOKEN (TO BE IMPLEMENTED)
   ↓
   Your .NET Backend:
   - Receives authorization code
   - Calls provider API to exchange code for user info
   - Validates user info
   - Creates/finds user in database
   - Generates YOUR JWT token
   - Returns: { token: "your_jwt", user: {...} }

7. FRONTEND STORES JWT AND UPDATES STATE
   ↓
   AuthProvider.tsx: loginWithOAuth()
   - Store JWT in localStorage
   - Update Redux user state
   - Set isAuthenticated = true

8. REDIRECT TO DASHBOARD
   ↓
   AuthCallback.tsx: navigate("/dashboard")
   - User is now authenticated
   - Same state as email/password login
```

## Environment Variables Required

Create a `.env` file in `cms-lite-web-client/`:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
```

## Backend Endpoints to Implement

You need to create these endpoints in your .NET backend:

### Google OAuth Endpoint
```csharp
POST /auth/google/token
Request: { "code": "authorization_code_from_google" }

Response: {
  "token": "your_jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "tenant": { "id": "tenant_id", "name": "tenant_name" }
  }
}
```

**Backend Implementation Steps:**
1. Receive authorization code from frontend
2. Exchange code with Google Token API
3. Get user info from Google
4. Find or create user in your database
5. Generate your JWT token
6. Return JWT + user info

### GitHub OAuth Endpoint
```csharp
POST /auth/github/token
Request: { "code": "authorization_code_from_github" }

Response: {
  "token": "your_jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "tenant": { "id": "tenant_id", "name": "tenant_name" }
  }
}
```

## Testing the Implementation

### Prerequisites
1. Set up OAuth applications in Google Cloud Console and GitHub
2. Configure redirect URIs:
   - Google: `http://localhost:5174/auth/google/callback`
   - GitHub: `http://localhost:5174/auth/github/callback`
3. Add client IDs to `.env` file

### Test Flow
1. Start React app: `npm run dev`
2. Navigate to `/login`
3. Click "Continue with Google" or "Continue with GitHub"
4. Should redirect to provider OAuth page
5. After authentication, redirects to `/auth/{provider}/callback`
6. AuthCallback validates CSRF and shows "Authenticating..." spinner
7. (Once backend is ready) Exchanges token and redirects to dashboard

### Expected Behavior
- **Before Backend Implementation**: Will show error "Failed to authenticate with Google/GitHub"
- **After Backend Implementation**: Should authenticate successfully and redirect to dashboard
- **Same State as Email/Password**: User is fully authenticated with JWT stored

## Security Features Implemented

1. **CSRF Protection**: Nonce/state validation prevents cross-site request forgery
2. **Session Storage**: Tokens only stored in sessionStorage (cleared after use)
3. **State Validation**: Ensures callback originated from our app
4. **Secure Random Generation**: Uses crypto.getRandomValues() for token generation
5. **Token Cleanup**: CSRF tokens removed after successful/failed validation

## Next Steps

1. **Backend Implementation**: Create `/auth/google/token` and `/auth/github/token` endpoints
2. **OAuth App Setup**: Register applications with Google and GitHub
3. **Environment Configuration**: Add client IDs to `.env` and backend config
4. **Testing**: Test complete flow end-to-end
5. **Error Handling**: Add specific error messages for different failure scenarios
6. **Rate Limiting**: Add rate limiting to OAuth endpoints in backend

## Notes

- Frontend is **100% complete** and ready to integrate with backend
- Authentication context matches existing email/password flow
- User experience identical after OAuth vs traditional login
- CSRF protection implemented following OAuth 2.0 best practices
- UI provides clear feedback during authentication process