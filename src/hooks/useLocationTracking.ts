import { useCallback, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { RunPoint } from '../types';

type Status = 'idle' | 'requesting' | 'tracking' | 'denied' | 'error';

export function useLocationTracking() {
  const [status, setStatus] = useState<Status>('idle');
  const [points, setPoints] = useState<RunPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const start = useCallback(async () => {
    setStatus('requesting');
    setError(null);

    const { status: permission } =
      await Location.requestForegroundPermissionsAsync();
    if (permission !== 'granted') {
      setStatus('denied');
      setError('位置情報の許可が必要です');
      return;
    }

    setPoints([]);
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        setPoints((prev) => [
          ...prev,
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: loc.timestamp,
            accuracy: loc.coords.accuracy,
          },
        ]);
      },
    );
    setStatus('tracking');
  }, []);

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setStatus('idle');
  }, []);

  return { status, points, error, start, stop };
}
