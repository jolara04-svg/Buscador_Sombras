import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ShadowTimeline } from '@/components/point-shadow-query';
import {
  formatIntervalDuration,
  formatQueryDate,
  formatSelectedPoint,
  intervalColor,
  intervalLabel,
  type PointShadowSelection,
} from '@/components/point-shadow-view-model';

type PointShadowPanelProps = {
  coordinate: PointShadowSelection;
  date: Date | string;
  timeline: ShadowTimeline;
  onClose?: () => void;
};

export function PointShadowPanel({ coordinate, date, timeline, onClose }: PointShadowPanelProps) {
  return (
    <View style={styles.panel} testID="point-shadow-panel">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Sombra por punto</Text>
          <Text style={styles.subtitle}>Franjas horarias del punto seleccionado</Text>
        </View>
        {onClose && (
          <Pressable
            accessibilityLabel="Cerrar consulta de sombra"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.coordinateBox}>
        <Text style={styles.coordinateLabel}>Coordenada exacta</Text>
        <Text style={styles.coordinateValue}>{formatSelectedPoint(coordinate)}</Text>
        <Text style={styles.dateValue}>Fecha: {formatQueryDate(date)}</Text>
      </View>

      <ScrollView style={styles.intervalList} nestedScrollEnabled>
        {timeline.intervalos.map((interval) => (
          <View key={`${interval.inicio}-${interval.fin}-${interval.estado}`} style={styles.intervalRow}>
            <View style={[styles.stateDot, { backgroundColor: intervalColor(interval.estado) }]} />
            <View style={styles.intervalDescription}>
              <Text style={styles.intervalState}>{intervalLabel(interval)}</Text>
              <Text style={styles.intervalTime}>{interval.inicio} - {interval.fin}</Text>
            </View>
            <Text style={styles.duration}>{formatIntervalDuration(interval.duracionMinutos)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>Sol directo: {formatIntervalDuration(timeline.minutosSol)}</Text>
        <Text style={styles.summaryText}>Sombra: {formatIntervalDuration(timeline.minutosSombra)}</Text>
      </View>
      <Text style={styles.note}>La estimación usa la posición solar del día seleccionado.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 286,
    maxHeight: 310,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  closeButton: {
    padding: 2,
    marginLeft: 8,
  },
  closeText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  coordinateBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  coordinateLabel: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  coordinateValue: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  dateValue: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 3,
  },
  intervalList: {
    maxHeight: 154,
  },
  intervalRow: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 42,
    paddingVertical: 5,
  },
  stateDot: {
    borderRadius: 6,
    height: 12,
    marginRight: 8,
    width: 12,
  },
  intervalDescription: {
    flex: 1,
  },
  intervalState: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '600',
  },
  intervalTime: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  duration: {
    color: '#475569',
    fontSize: 10,
    marginLeft: 6,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  summaryText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '600',
  },
  note: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 6,
  },
});
