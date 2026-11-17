// ======================================================
// Mis cirugías (src/screens/SurgeriesScreen.tsx)
// Pantalla del PACIENTE autenticado: lista sus cirugías con
// estado actual y permite desplegar el checklist preoperatorio
// de cada una. Mientras la cirugía está programada, el paciente
// toca cada ítem para marcar "Lo hice" (marca propia); aparte se
// muestra si el personal del hospital ya lo verificó.
// Consume /api/me/*, que garantiza que sólo ve su propia información.
// ======================================================
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { api, getErrorMessage } from '../api';
import { base, colors, statusInfo } from '../theme';
import type { ChecklistItem, OwnSurgery } from '../types';

export default function SurgeriesScreen() {
  const [surgeries, setSurgeries] = useState<OwnSurgery[]>([]);
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSurgeries(await api.get<OwnSurgery[]>('/api/me/surgeries'));
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Despliega/oculta el checklist de una cirugía (carga perezosa). */
  async function toggleChecklist(surgeryId: string) {
    if (expanded === surgeryId) {
      setExpanded(null);
      return;
    }
    setExpanded(surgeryId);
    if (!checklists[surgeryId]) {
      try {
        const items = await api.get<ChecklistItem[]>(`/api/me/surgeries/${surgeryId}/checklist`);
        setChecklists((prev) => ({ ...prev, [surgeryId]: items }));
      } catch (e) {
        setError(getErrorMessage(e));
      }
    }
  }

  const [savingId, setSavingId] = useState<string | null>(null);

  /** Marca/desmarca "Lo hice" en un ítem y reemplaza la fila con la respuesta. */
  async function togglePatientMark(surgeryId: string, item: ChecklistItem) {
    if (savingId) return;
    setSavingId(item.id);
    setError(null);
    try {
      const updated = await api.patch<ChecklistItem>(`/api/me/checklist-items/${item.id}`, {
        checked: !item.patientChecked,
      });
      setChecklists((prev) => ({
        ...prev,
        [surgeryId]: prev[surgeryId].map((i) => (i.id === updated.id ? updated : i)),
      }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingId(null);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    // Refresca también los checklists abiertos (por si el hospital verificó algo).
    if (expanded) {
      try {
        const items = await api.get<ChecklistItem[]>(`/api/me/surgeries/${expanded}/checklist`);
        setChecklists((prev) => ({ ...prev, [expanded]: items }));
      } catch { /* el error de carga ya se muestra arriba */ }
    }
    setRefreshing(false);
  }, [load, expanded]);

  return (
    <ScrollView
      style={base.screen}
      contentContainerStyle={base.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <Text style={base.title}>Mis cirugías</Text>
      {error && <Text style={base.error}>{error}</Text>}
      {surgeries.length === 0 && <Text style={base.empty}>No tenés cirugías registradas.</Text>}

      {surgeries.map((s) => {
        const info = statusInfo(s.status, s.waitingRoom);
        const items = checklists[s.id];
        const isOpen = expanded === s.id;
        const editable = s.status === 'programada';
        const doneCount = items?.filter((i) => i.patientChecked).length ?? 0;
        return (
          <View key={s.id} style={base.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[base.cardTitle, { flex: 1, marginRight: 8 }]}>{s.procedure}</Text>
              <View style={[base.badge, { backgroundColor: info.color }]}>
                <Text style={base.badgeText}>{info.label}</Text>
              </View>
            </View>
            <Text style={[base.meta, { marginTop: 6 }]}>
              {new Date(s.scheduledAt).toLocaleString()}
              {s.operatingRoom ? ` · Quirófano ${s.operatingRoom.code}` : ''}
            </Text>

            {/* Checklist preoperatorio (sólo lectura) */}
            <TouchableOpacity onPress={() => void toggleChecklist(s.id)}>
              <Text style={{ color: colors.brand, marginTop: 10, fontSize: 14, fontWeight: '600' }}>
                {isOpen ? 'Ocultar checklist ▲' : 'Ver checklist preoperatorio ▼'}
              </Text>
            </TouchableOpacity>

            {isOpen && (
              <View style={{ marginTop: 10, gap: 4 }}>
                {!items && <Text style={base.meta}>Cargando…</Text>}
                {items && items.length === 0 && (
                  <Text style={base.meta}>Sin ítems de checklist para esta cirugía.</Text>
                )}
                {items && items.length > 0 && (
                  <Text style={[base.meta, { marginBottom: 4 }]}>
                    {editable
                      ? `Tocá cada ítem cuando lo cumplas · ${doneCount} de ${items.length} hechos`
                      : `${doneCount} de ${items.length} marcados por vos`}
                  </Text>
                )}
                {items?.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    disabled={!editable || savingId === item.id}
                    onPress={() => void togglePatientMark(s.id, item)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 8,
                      opacity: savingId === item.id ? 0.5 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: item.patientChecked ? colors.success : colors.textFaint,
                        backgroundColor: item.patientChecked ? colors.success : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.patientChecked && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: item.patientChecked ? colors.textMuted : colors.text, fontSize: 15 }}>
                        {item.label}
                      </Text>
                      <Text style={{ fontSize: 12, marginTop: 2, color: item.checked ? colors.success : colors.textFaint }}>
                        {item.checked
                          ? '✔ Verificado por el hospital'
                          : item.patientChecked
                            ? 'Pendiente de verificar por el hospital'
                            : editable ? 'Tocá para marcar' : 'Sin marcar'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
