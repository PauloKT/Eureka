import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
export const colors = { bg: '#050706', card: '#121713', raised: '#1A211D', line: '#29342D', text: '#F2F5F2', muted: '#AAB8AE', green: '#69C895', darkGreen: '#1D6744', error: '#F2A18D' };
export function Button({ label, onPress, disabled = false, secondary = false }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, disabled && { opacity: 0.45 }, pressed && { opacity: 0.75 }]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}
export function Notice({ children, error = false }) {
  return <View style={s.notice} accessibilityLiveRegion="polite"><Text style={[s.body, error && { color: colors.error }]}>{children}</Text></View>;
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, page: { padding: 20, paddingBottom: 48, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  brand: { color: colors.green, fontSize: 28, fontWeight: '800' }, title: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 20, fontWeight: '700' }, body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  text: { color: colors.text, fontSize: 16, lineHeight: 24 }, caption: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 18, gap: 12 },
  notice: { backgroundColor: colors.raised, borderRadius: 12, padding: 14 },
  button: { backgroundColor: colors.darkGreen, borderRadius: 12, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }, buttonText: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  input: { backgroundColor: colors.raised, color: colors.text, fontSize: 17, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, minHeight: 50 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }, themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  theme: { width: '47%', minHeight: 72, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 12, padding: 14, justifyContent: 'center' },
  selected: { borderColor: colors.green, backgroundColor: '#10251A' }, link: { color: colors.green, fontSize: 15, lineHeight: 23, textDecorationLine: 'underline' },
  progress: { height: 6, backgroundColor: colors.line, borderRadius: 4, overflow: 'hidden' },
});
