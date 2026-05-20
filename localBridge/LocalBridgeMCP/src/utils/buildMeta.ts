export interface ToolMeta {
  source: string;
  toolVersion: string;
  usedDefaultRouting: boolean;
  instanceId: string | null;
  tabId: string | null;
}

const defaultMeta: ToolMeta = {
  source: 'localbridge-rest',
  toolVersion: 'v1',
  usedDefaultRouting: false,
  instanceId: null,
  tabId: null,
};

export function buildMeta(partial?: Partial<ToolMeta>): ToolMeta {
  return {
    ...defaultMeta,
    ...partial,
  };
}
