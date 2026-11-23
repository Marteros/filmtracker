import { useCallback, useState } from 'react';

export type AppTab = 'history' | 'watchlist' | 'discover' | 'insights';

export function useAppNavigation() {
  const [activeTab, setActiveTab] = useState<AppTab>('history');
  const [discoverMounted, setDiscoverMounted] = useState(false);

  const switchTab = useCallback((tab: AppTab) => {
    if (tab === 'discover') setDiscoverMounted(true);
    setActiveTab(tab);
    window.scrollTo(0, 0);
  }, []);

  return { activeTab, discoverMounted, switchTab };
}
