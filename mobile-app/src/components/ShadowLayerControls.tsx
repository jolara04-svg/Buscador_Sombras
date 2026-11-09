import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ShadowLayerSelection, ShadowLayerWeights } from './shadow-settings';

export type ShadowLayerControlsProps = {
  selection: ShadowLayerSelection;
  weights: ShadowLayerWeights;
  onSelectionChange: (selection: ShadowLayerSelection) => void;
  onWeightChange: (layer: 'buildings' | 'trees', value: number) => void;
};

function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.checkRow} onPress={onPress}>
      <Text style={[styles.check, checked && styles.checkActive]}>{checked ? '☑' : '☐'}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export function ShadowLayerControls({ selection, weights, onSelectionChange, onWeightChange }: ShadowLayerControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [buildingText, setBuildingText] = useState(String(weights.buildings));
  const [treeText, setTreeText] = useState(String(weights.trees));

  useEffect(() => setBuildingText(String(weights.buildings)), [weights.buildings]);
  useEffect(() => setTreeText(String(weights.trees)), [weights.trees]);

  const commit = (layer: 'buildings' | 'trees', text: string) => {
    const value = Number(text.replace(',', '.'));
    if (Number.isFinite(value) && value >= 0) onWeightChange(layer, value);
    else if (layer === 'buildings') setBuildingText(String(weights.buildings));
    else setTreeText(String(weights.trees));
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Fuentes de sombra</Text>
      <CheckRow
        label="Edificios"
        checked={selection.buildings}
        onPress={() => onSelectionChange({ ...selection, buildings: !selection.buildings })}
      />
      <CheckRow
        label="Vegetación"
        checked={selection.trees}
        onPress={() => onSelectionChange({ ...selection, trees: !selection.trees })}
      />
      <Pressable accessibilityRole="button" style={styles.settingsButton} onPress={() => setSettingsOpen(open => !open)}>
        <Text style={styles.settingsButtonText}>{settingsOpen ? 'Ocultar ajustes' : 'Ajustes de pesos'}</Text>
      </Pressable>
      {settingsOpen && (
        <View style={styles.settings}>
          <Text style={styles.hint}>Influencia relativa en rutas</Text>
          <View style={styles.weightRow}>
            <Text style={styles.weightLabel}>Edificios</Text>
            <TextInput
              accessibilityLabel="Peso de edificios"
              keyboardType="decimal-pad"
              value={buildingText}
              onChangeText={setBuildingText}
              onEndEditing={() => commit('buildings', buildingText)}
              style={styles.input}
            />
          </View>
          <View style={styles.weightRow}>
            <Text style={styles.weightLabel}>Árboles</Text>
            <TextInput
              accessibilityLabel="Peso de árboles"
              keyboardType="decimal-pad"
              value={treeText}
              onChangeText={setTreeText}
              onEndEditing={() => commit('trees', treeText)}
              style={styles.input}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 154,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 30,
  },
  title: { fontSize: 12, fontWeight: '700', color: '#333', marginBottom: 5 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  check: { width: 22, fontSize: 18, color: '#666' },
  checkActive: { color: '#0066cc' },
  label: { fontSize: 13, color: '#333' },
  settingsButton: { marginTop: 5, paddingVertical: 4 },
  settingsButtonText: { color: '#0066cc', fontSize: 12, fontWeight: '600' },
  settings: { borderTopWidth: 1, borderTopColor: '#e5e5e5', marginTop: 4, paddingTop: 6 },
  hint: { color: '#777', fontSize: 10, marginBottom: 3 },
  weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  weightLabel: { color: '#444', fontSize: 11 },
  input: { width: 54, height: 28, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, paddingHorizontal: 5, fontSize: 12, color: '#222', textAlign: 'right' },
});
