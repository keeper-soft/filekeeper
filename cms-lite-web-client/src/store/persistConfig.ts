import storage from 'redux-persist/lib/storage';
import { createTransform } from 'redux-persist';
import type { PersistConfig } from 'redux-persist';
import type { DirectoryTreeState } from '../types/directories';
import type { User } from '../types/auth';
import type { NavigationStateProps } from '../types/navigation';

/** Increment this when any whitelisted slice shape changes to invalidate old persisted data. */
export const PERSIST_VERSION = 1;

/** Persisted state is discarded after 24 hours. */
const TTL_MS = 24 * 60 * 60 * 1000;

interface PersistedMeta<T> {
    _v: number;
    _ts: number;
    _data: T;
}

/**
 * A redux-persist transform that:
 *   - Wraps the outgoing state with a version stamp and a save-time timestamp.
 *   - On load, rejects (throws) if the version has changed or the TTL has expired,
 *     which causes redux-persist to fall back to the reducer's initial state.
 */
function createValidationTransform<T extends object>() {
    return createTransform<T, PersistedMeta<T>>(
        // inbound: state → storage
        (inboundState): PersistedMeta<T> => ({
            _v: PERSIST_VERSION,
            _ts: Date.now(),
            _data: inboundState,
        }),
        // outbound: storage → state
        (outboundState: unknown): T => {
            const meta = outboundState as PersistedMeta<T>;
            if (!meta?._data) {
                throw new Error('redux-persist: invalid persisted state shape – using initial state');
            }
            if (meta._v !== PERSIST_VERSION) {
                throw new Error(`redux-persist: persisted state version ${meta._v} does not match expected ${PERSIST_VERSION} – using initial state`);
            }
            if (Date.now() - meta._ts >= TTL_MS) {
                throw new Error('redux-persist: persisted state has expired (TTL exceeded) – using initial state');
            }
            return meta._data;
        },
    );
}

export const userPersistConfig: PersistConfig<User> = {
    key: 'user',
    version: PERSIST_VERSION,
    storage,
    transforms: [createValidationTransform<User>()],
};

export const directoryTreePersistConfig: PersistConfig<DirectoryTreeState> = {
    key: 'directoryTree',
    version: PERSIST_VERSION,
    storage,
    // Persist UI-relevant state only; skip transient loading/error flags
    whitelist: ['root', 'currentDirectoryId', 'selectedFileIds', 'tenantId', 'lastFetchedTenant', 'totalDirectories', 'totalContentItems'],
    transforms: [createValidationTransform<DirectoryTreeState>()],
};

export const navigationPersistConfig: PersistConfig<NavigationStateProps> = {
    key: 'navigation',
    version: PERSIST_VERSION,
    storage,
    transforms: [createValidationTransform<NavigationStateProps>()],
};
