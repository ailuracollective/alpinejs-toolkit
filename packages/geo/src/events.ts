export interface GeoPositionDetail {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
}

export interface GeoErrorDetail {
  message: string;
  code: number;
}

export interface GeoEvents extends Record<string, unknown[]> {
  position: [GeoPositionDetail];
  error: [GeoErrorDetail];
  /**
   * A position request has started. Distinct from `position`/`error`, which
   * both report the *end* of a request: without it a consumer has no way to
   * show a pending state, because the flag is only observable at the far end.
   */
  loading: [undefined];
  watchStart: [undefined];
  watchStop: [undefined];
  update: [undefined];
}
