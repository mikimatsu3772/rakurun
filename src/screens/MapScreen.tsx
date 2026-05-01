import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { totalDistanceMeters } from '../lib/geo';
import {
  detectClosedLoop,
  territoryAreaMeters,
} from '../lib/territory';
import { useRunStore } from '../store/runStore';

const INITIAL_REGION = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export function MapScreen() {
  const { status, points, error, start, stop } = useLocationTracking();
  const territories = useRunStore((s) => s.territories);
  const addTerritory = useRunStore((s) => s.addTerritory);

  const distance = useMemo(() => totalDistanceMeters(points), [points]);

  const tracking = status === 'tracking';

  const handleStop = () => {
    const loop = detectClosedLoop(points);
    if (loop) {
      addTerritory({
        id: `terr_${Date.now()}`,
        ownerId: 'me',
        polygon: loop,
        area: territoryAreaMeters(loop),
        createdAt: Date.now(),
      });
    }
    stop();
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        followsUserLocation={tracking}
      >
        {points.length >= 2 && (
          <Polyline
            coordinates={points}
            strokeColor="#ff5722"
            strokeWidth={4}
          />
        )}
        {territories.map((t) => (
          <Polygon
            key={t.id}
            coordinates={t.polygon}
            strokeColor="#2196f3"
            fillColor="rgba(33, 150, 243, 0.25)"
            strokeWidth={2}
          />
        ))}
      </MapView>

      <View style={styles.hud}>
        <Text style={styles.hudText}>
          距離: {(distance / 1000).toFixed(2)} km
        </Text>
        <Text style={styles.hudText}>陣地: {territories.length}</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <Pressable
        style={[styles.button, tracking && styles.buttonStop]}
        onPress={tracking ? handleStop : start}
      >
        <Text style={styles.buttonText}>
          {tracking ? 'ストップ' : 'ラン開始'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  hud: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 12,
    borderRadius: 12,
  },
  hudText: { fontSize: 16, fontWeight: '600' },
  errorText: { color: '#c62828', marginTop: 4 },
  button: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#ff5722',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  buttonStop: { backgroundColor: '#455a64' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
