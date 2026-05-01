export type LatLng = {
  latitude: number;
  longitude: number;
};

export type RunPoint = LatLng & {
  timestamp: number;
  accuracy?: number | null;
};

export type Run = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  points: RunPoint[];
  distanceMeters: number;
};

export type Territory = {
  id: string;
  ownerId: string;
  polygon: LatLng[];
  area: number;
  createdAt: number;
};

export type Item = {
  id: string;
  kind: 'wood' | 'stone' | 'crop' | 'coin';
  position: LatLng;
  collected: boolean;
};

export type Monster = {
  id: string;
  species: string;
  level: number;
  hp: number;
  position: LatLng;
};
