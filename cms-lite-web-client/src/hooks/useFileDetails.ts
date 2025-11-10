import { useCallback, useState } from 'react';
import customAxios from '../utilities/custom-axios';
import type { ContentItemDetails } from '../types/content';

type FileDetailsState = {
  open: boolean;
  isLoading: boolean;
  error: string | null;
  data: ContentItemDetails | null;
  resourceId: string | null;
};

type UseFileDetailsArgs = {
  tenantName?: string | null;
};

type UseFileDetailsResult = {
  state: FileDetailsState;
  openDetails: (resourceId: string | null) => void;
  closeDetails: () => void;
  retry: () => void;
};

const initialState: FileDetailsState = {
  open: false,
  isLoading: false,
  error: null,
  data: null,
  resourceId: null,
};

export const useFileDetails = ({ tenantName }: UseFileDetailsArgs): UseFileDetailsResult => {
  const [state, setState] = useState<FileDetailsState>(initialState);

  const fetchDetails = useCallback(
    async (resourceId: string) => {
      if (!tenantName) {
        setState((prev) => ({ ...prev, isLoading: false, error: 'Missing tenant context.' }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const { data } = await customAxios.get<ContentItemDetails>(
          `/v1/${tenantName}/${encodeURIComponent(resourceId)}/details`,
        );
        setState((prev) => ({ ...prev, data, isLoading: false }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load file details.';
        setState((prev) => ({ ...prev, error: message, isLoading: false }));
      }
    },
    [tenantName],
  );

  const openDetails = useCallback(
    (resourceId: string | null) => {
      if (!resourceId) {
        return;
      }
      setState({ open: true, isLoading: true, error: null, data: null, resourceId });
      void fetchDetails(resourceId);
    },
    [fetchDetails],
  );

  const closeDetails = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const retry = useCallback(() => {
    if (!state.resourceId) {
      return;
    }
    void fetchDetails(state.resourceId);
  }, [fetchDetails, state.resourceId]);

  return { state, openDetails, closeDetails, retry };
};

export default useFileDetails;
