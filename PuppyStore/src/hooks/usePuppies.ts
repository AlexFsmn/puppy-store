import {useState, useCallback, useEffect, useRef} from 'react';
import {PuppySummary} from '../types';
import {fetchPuppies} from '../services/puppiesApi';

interface UsePuppiesResult {
  puppies: PuppySummary[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
}

export function usePuppies(): UsePuppiesResult {
  const [puppies, setPuppies] = useState<PuppySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);

  const loadPuppies = useCallback(async () => {
    setLoading(true);
    setError(null);
    cursorRef.current = null;

    try {
      const response = await fetchPuppies();
      setPuppies(response.data);
      cursorRef.current = response.nextCursor;
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) {
      return;
    }

    setLoadingMore(true);

    try {
      const response = await fetchPuppies(cursorRef.current);
      setPuppies(prev => [...prev, ...response.data]);
      cursorRef.current = response.nextCursor;
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    loadPuppies();
  }, [loadPuppies]);

  return {
    puppies,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh: loadPuppies,
    loadMore,
  };
}
