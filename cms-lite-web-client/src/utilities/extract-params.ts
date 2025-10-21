export function extractParams(search: string, hash: string) {
    const params = new URLSearchParams(search);

    if (params.size === 0 && hash.startsWith("#")) {
        return new URLSearchParams(hash.slice(1));
    }

    return params;
}

export function decodeJwtPayload(token: string) {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    try {
        const decoded = atob(padded);
        return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function decodeStatePayload<T>(state: string): T | null {
    try {
        const json = decodeURIComponent(atob(state));
        return JSON.parse(json) as T;
    } catch (error) {
        console.error("Failed to decode OAuth state payload", error);
        return null;
    }
}

export function encodeStatePayload(payload: unknown) {
    return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function base64UrlEncode(buffer: ArrayBuffer) {
    return btoa(
        String.fromCharCode(...new Uint8Array(buffer)),)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}