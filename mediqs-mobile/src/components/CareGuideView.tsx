// ======================================================
// Guía de cuidados (src/components/CareGuideView.tsx)
// Muestra las indicaciones preoperatorias, postoperatorias,
// los cuidados en casa y los signos de alarma. Arriba van
// los datos PERSONALIZADOS del paciente: su próxima cirugía
// y la última medicación/observación de su equipo médico.
// ======================================================
import { Text, View } from 'react-native';
import { base, colors } from '../theme';
import type { CareGuide } from '../types';

function Section({ icon, title, items, accent }: {
  icon: string;
  title: string;
  items: string[];
  accent?: string;
}) {
  return (
    <View style={[base.card, accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null]}>
      <Text style={base.cardTitle}>{icon} {title}</Text>
      <View style={{ marginTop: 8, gap: 6 }}>
        {items.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: accent ?? colors.brand, fontSize: 14 }}>•</Text>
            <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function CareGuideView({ guide }: { guide: CareGuide }) {
  const { nextSurgery, latestIndications } = guide;

  return (
    <View style={{ gap: 12 }}>
      {/* Datos personalizados */}
      {nextSurgery && (
        <View style={[base.card, { borderLeftWidth: 4, borderLeftColor: colors.brand }]}>
          <Text style={base.meta}>Tu próxima cirugía</Text>
          <Text style={[base.cardTitle, { marginTop: 4 }]}>{nextSurgery.procedure}</Text>
          <Text style={[base.meta, { marginTop: 4 }]}>
            {new Date(nextSurgery.scheduledAt).toLocaleString()}
            {nextSurgery.surgeonName ? ` · ${nextSurgery.surgeonName}` : ''}
          </Text>
        </View>
      )}

      {latestIndications && (latestIndications.medication || latestIndications.observations) && (
        <View style={[base.card, { borderLeftWidth: 4, borderLeftColor: colors.success }]}>
          <Text style={base.meta}>
            Indicaciones de tu médico · {new Date(latestIndications.createdAt).toLocaleDateString()}
          </Text>
          <Text style={[base.meta, { marginTop: 2 }]}>{latestIndications.surgery.procedure}</Text>
          {latestIndications.medication && (
            <Text style={{ color: colors.text, fontSize: 14, marginTop: 6 }}>
              💊 Medicación: {latestIndications.medication}
            </Text>
          )}
          {latestIndications.observations && (
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
              {latestIndications.observations}
            </Text>
          )}
        </View>
      )}

      <Section icon="🩺" title="Antes de la cirugía" items={guide.preop} />
      <Section icon="🛏️" title="Después de la cirugía" items={guide.postop} accent={colors.success} />
      <Section icon="🏠" title="Cuidados en casa" items={guide.homeCare} accent="#0284c7" />
      <Section icon="⚠️" title="Signos de alarma" items={guide.warningSigns} accent={colors.danger} />

      <View style={[base.card, { backgroundColor: '#4c0519' }]}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>
          {guide.emergencyNote}
        </Text>
      </View>
    </View>
  );
}
