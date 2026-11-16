import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Bootstrap } from './types';

interface Ctx {
  data: Bootstrap | null;
  loading: boolean;
  reload: () => Promise<void>;
}

const BootstrapContext = createContext<Ctx>({ data: null, loading: true, reload: async () => {} });

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await api.get<Bootstrap>('/bootstrap');
    setData(res);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  return <BootstrapContext.Provider value={{ data, loading, reload }}>{children}</BootstrapContext.Provider>;
}

export const useBootstrap = () => useContext(BootstrapContext);

export function flattenCategories(list: any[]): any[] {
  const out: any[] = [];
  const walk = (items: any[]) => {
    items.forEach((item) => {
      out.push(item);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(list || []);
  return out;
}
