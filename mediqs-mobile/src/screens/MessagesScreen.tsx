// ======================================================
// Mensajes a recepción (src/screens/MessagesScreen.tsx)
// El paciente le escribe a la recepción del lugar y elige la
// urgencia, que define el plazo de respuesta:
//   Urgente → 24 h · Normal → 48 h
// Al enviar el mensaje se muestran las indicaciones pre y
// postoperatorias y los cuidados (GET /api/me/care-guide).
// Vistas: listado · nueva consulta · enviada · indicaciones.
// ======================================================
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, getErrorMessage } from '../api';
import { base, colors } from '../theme';
import CareGuideView from '../components/CareGuideView';
import {
  RESPONSE_HOURS,
  type CareGuide,
  type Inquiry,
  type InquiryCreated,
  type InquiryUrgency,
  type OwnSurgery,
} from '../types';

type View_ = 'list' | 'compose' | 'sent' | 'guide';

const URGENCY_INFO: Record<InquiryUrgency, { label: string; color: string; hint: string }> = {
  urgente: { label: 'Urgente', color: colors.danger, hint: 'Respuesta en 24 h' },
  normal: { label: 'Normal', color: colors.brand, hint: 'Respuesta en 48 h' },
};

function fmt(date: string) {
  return new Date(date).toLocaleString([], {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function MessagesScreen() {
  const [view, setView] = useState<View_>('list');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [surgeries, setSurgeries] = useState<OwnSurgery[]>([]);
  const [guide, setGuide] = useState<CareGuide | null>(null);
  const [sent, setSent] = useState<InquiryCreated | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [urgency, setUrgency] = useState<InquiryUrgency>('normal');
  const [surgeryId, setSurgeryId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, own] = await Promise.all([
        api.get<Inquiry[]>('/api/me/inquiries'),
        api.get<OwnSurgery[]>('/api/me/surgeries'),
      ]);
      setInquiries(list);
      setSurgeries(own.filter((s) => s.status !== 'cancelada'));
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function openCompose() {
    setSubject('');
    setBody('');
    setUrgency('normal');
    setSurgeryId(null);
    setError(null);
    setView('compose');
  }

  async function openGuide() {
    setView('guide');
    if (!guide) {
      try {
        setGuide(await api.get<CareGuide>('/api/me/care-guide'));
      } catch (e) {
        setError(getErrorMessage(e));
      }
    }
  }

  async function send() {
    if (subject.trim().length < 3) return setError('Escribí un asunto (mínimo 3 caracteres).');
    if (body.trim().length < 5) return setError('Contanos tu consulta (mínimo 5 caracteres).');
    setSending(true);
    setError(null);
    try {
      const created = await api.post<InquiryCreated>('/api/me/inquiries', {
        subject: subject.trim(),
        body: body.trim(),
        urgency,
        surgeryId,
      });
      setSent(created);
      setGuide(created.careGuide);
      setInquiries((prev) => [created.inquiry, ...prev]);
      setView('sent');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------
  // Nueva consulta
  // ---------------------------------------------------------------
  if (view === 'compose') {
    return (
      <ScrollView style={base.screen} contentContainerStyle={base.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setView('list')}>
          <Text style={{ color: colors.brand, fontSize: 14 }}>← Volver</Text>
        </TouchableOpacity>
        <Text style={base.title}>Nueva consulta</Text>
        <Text style={base.subtitle}>La recepción te responde según la urgencia que elijas.</Text>

        <Text style={[base.meta, { marginTop: 8 }]}>Urgencia</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['urgente', 'normal'] as const).map((u) => {
            const info = URGENCY_INFO[u];
            const active = urgency === u;
            return (
              <TouchableOpacity
                key={u}
                onPress={() => setUrgency(u)}
                style={[
                  base.card,
                  { flex: 1, borderWidth: 2, borderColor: active ? info.color : colors.border },
                ]}
              >
                <Text style={[base.cardTitle, { color: active ? info.color : colors.text }]}>{info.label}</Text>
                <Text style={[base.meta, { marginTop: 2 }]}>{info.hint}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {surgeries.length > 0 && (
          <>
            <Text style={[base.meta, { marginTop: 8 }]}>¿Sobre qué cirugía? (opcional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[{ id: null, procedure: 'General' }, ...surgeries].map((s) => {
                const active = surgeryId === s.id;
                return (
                  <TouchableOpacity
                    key={s.id ?? 'none'}
                    onPress={() => setSurgeryId(s.id)}
                    style={[base.badge, { backgroundColor: active ? colors.brand : colors.card }]}
                  >
                    <Text style={base.badgeText}>{s.procedure}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={[base.meta, { marginTop: 8 }]}>Asunto</Text>
        <TextInput
          style={base.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="Ej.: Duda sobre el ayuno"
          placeholderTextColor={colors.textFaint}
          maxLength={120}
        />

        <Text style={[base.meta, { marginTop: 8 }]}>Mensaje</Text>
        <TextInput
          style={[base.input, { minHeight: 120, textAlignVertical: 'top' }]}
          value={body}
          onChangeText={setBody}
          placeholder="Escribí tu consulta…"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={2000}
        />

        <Text style={[base.meta, { color: colors.warning }]}>
          ⚠ Si tenés fiebre alta, sangrado o dolor intenso no esperes la respuesta: acudí a la guardia o llamá al 107.
        </Text>

        {error && <Text style={base.error}>{error}</Text>}

        <TouchableOpacity style={[base.button, sending && { opacity: 0.6 }]} onPress={() => void send()} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={base.buttonText}>Enviar a recepción</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------
  // Consulta enviada → confirmación + indicaciones
  // ---------------------------------------------------------------
  if (view === 'sent' && sent) {
    return (
      <ScrollView style={base.screen} contentContainerStyle={base.content}>
        <View style={[base.card, { borderLeftWidth: 4, borderLeftColor: colors.success }]}>
          <Text style={base.cardTitle}>✅ Recibimos tu consulta</Text>
          <Text style={[base.meta, { marginTop: 6, lineHeight: 19 }]}>
            La recepción te va a responder dentro de las próximas {sent.responseHours} h
            (antes del {fmt(sent.inquiry.dueAt)}). Te avisamos por notificación y por email.
          </Text>
        </View>

        <Text style={[base.title, { fontSize: 20, marginTop: 8 }]}>Mientras tanto, tené en cuenta</Text>
        <CareGuideView guide={sent.careGuide} />

        <TouchableOpacity style={[base.button, { marginTop: 8 }]} onPress={() => setView('list')}>
          <Text style={base.buttonText}>Volver a mis mensajes</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------
  // Indicaciones y cuidados
  // ---------------------------------------------------------------
  if (view === 'guide') {
    return (
      <ScrollView style={base.screen} contentContainerStyle={base.content}>
        <TouchableOpacity onPress={() => setView('list')}>
          <Text style={{ color: colors.brand, fontSize: 14 }}>← Volver</Text>
        </TouchableOpacity>
        <Text style={base.title}>Indicaciones y cuidados</Text>
        {error && <Text style={base.error}>{error}</Text>}
        {guide ? <CareGuideView guide={guide} /> : !error && <ActivityIndicator color={colors.brand} />}
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------
  // Listado de consultas
  // ---------------------------------------------------------------
  return (
    <ScrollView
      style={base.screen}
      contentContainerStyle={base.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <Text style={base.title}>Mensajes</Text>
      <Text style={base.subtitle}>
        Consultas a recepción · urgentes en {RESPONSE_HOURS.urgente} h, normales en {RESPONSE_HOURS.normal} h
      </Text>
      {error && <Text style={base.error}>{error}</Text>}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <TouchableOpacity style={[base.button, { flex: 1 }]} onPress={openCompose}>
          <Text style={base.buttonText}>✉️ Nueva consulta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[base.button, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
          onPress={() => void openGuide()}
        >
          <Text style={base.buttonText}>📋 Indicaciones</Text>
        </TouchableOpacity>
      </View>

      {inquiries.length === 0 && (
        <Text style={base.empty}>Todavía no enviaste consultas a recepción.</Text>
      )}

      {inquiries.map((q) => {
        const urg = URGENCY_INFO[q.urgency];
        const answered = q.status === 'respondida';
        const overdue = !answered && new Date(q.dueAt) < new Date();
        return (
          <View key={q.id} style={base.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={[base.cardTitle, { flex: 1 }]}>{q.subject}</Text>
              <View style={[base.badge, { backgroundColor: urg.color }]}>
                <Text style={base.badgeText}>{urg.label}</Text>
              </View>
            </View>
            <Text style={[base.meta, { marginTop: 4 }]}>
              Enviada {fmt(q.createdAt)}{q.surgery ? ` · ${q.surgery.procedure}` : ''}
            </Text>
            <Text style={{ color: colors.text, fontSize: 14, marginTop: 8, lineHeight: 20 }}>{q.body}</Text>

            {answered ? (
              <View style={{ marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: colors.bg }}>
                <Text style={[base.meta, { color: colors.success }]}>
                  Respuesta de {q.answeredBy?.fullName ?? 'Recepción'}
                  {q.answeredAt ? ` · ${fmt(q.answeredAt)}` : ''}
                </Text>
                <Text style={{ color: colors.text, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{q.reply}</Text>
              </View>
            ) : (
              <Text style={[base.meta, { marginTop: 10, color: overdue ? colors.warning : colors.textMuted }]}>
                ⏳ {overdue ? 'Plazo vencido, recepción te responde a la brevedad' : `Pendiente · respuesta antes del ${fmt(q.dueAt)}`}
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
