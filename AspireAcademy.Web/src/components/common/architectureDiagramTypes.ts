// ─── Types & constants for ArchitectureDiagram ─────────────────────────────────

export interface ServiceNode {
  id: string;
  name: string;
  type: 'api' | 'database' | 'cache' | 'messaging' | 'frontend' | 'worker' | 'container';
  row: number;
  col: number;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
}

export const serviceTypeColors: Record<ServiceNode['type'], { bg: string; border: string; label: string }> = {
  api:       { bg: '#1E3A5F', border: '#3B82F6', label: 'API' },
  database:  { bg: '#1A3A2A', border: '#22C55E', label: 'DB' },
  cache:     { bg: '#3A2A1A', border: '#F59E0B', label: 'Cache' },
  messaging: { bg: '#3A1A2A', border: '#EF4444', label: 'Messaging' },
  frontend:  { bg: '#2A1A3A', border: '#A855F7', label: 'Frontend' },
  worker:    { bg: '#1A2A3A', border: '#06B6D4', label: 'Worker' },
  container: { bg: '#2A2A1A', border: '#84CC16', label: 'Container' },
};
