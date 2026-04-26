import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';

import { api } from '@convex/_generated/api';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/constants/LanguageContext';

export default function HistoryScreen() {
  const theme = useTheme();
  const { lang, setLang, t } = useLanguage();

  const reports = useQuery(api.reports.listReports, { limit: 100 });
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);

  const resolvedReports = (reports ?? []).filter((r) => r.status === 'resolved');

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {/* Header & Language Switcher */}
        <View style={[styles.headerCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.historyIconBadge}>
                <Ionicons name="checkmark-done-circle" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.screenHeading, { color: theme.text }]}>
                  {t.historyTitle}
                </Text>
                <Text style={[styles.screenSubheading, { color: theme.textSecondary }]}>
                  {t.historySubtitle}
                </Text>
              </View>
            </View>

            {/* Language Switcher */}
            <View style={styles.langPills}>
              {(
                [
                  { code: 'si', label: 'සිං' },
                  { code: 'en', label: 'EN' },
                  { code: 'ta', label: 'த' },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.code}
                  style={[
                    styles.langPill,
                    lang === item.code && styles.langPillActive,
                  ]}
                  onPress={() => setLang(item.code)}>
                  <Text
                    style={[
                      styles.langPillText,
                      lang === item.code ? styles.langPillTextActive : { color: theme.textSecondary },
                    ]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Sri Lanka Municipal Stats Overview */}
          <View style={[styles.statsRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.statCell}>
              <Text style={[styles.statBigNumber, { color: '#059669' }]}>
                {resolvedReports.length}
              </Text>
              <Text style={[styles.statLabelText, { color: theme.textSecondary }]}>
                {t.cleanedSites}
              </Text>
            </View>
            <View style={[styles.cellDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statBigNumber, { color: '#0284c7' }]}>
                {resolvedReports.filter((r) => r.proofImageUrl).length}
              </Text>
              <Text style={[styles.statLabelText, { color: theme.textSecondary }]}>
                {t.photoVerified}
              </Text>
            </View>
            <View style={[styles.cellDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statBigNumber, { color: '#d97706' }]}>100%</Text>
              <Text style={[styles.statLabelText, { color: theme.textSecondary }]}>
                {t.complianceRate}
              </Text>
            </View>
          </View>
        </View>

        {/* Resolved Incident Feed */}
        {reports === undefined ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={[styles.loadingNotice, { color: theme.textSecondary }]}>
              {t.gpsLocating}
            </Text>
          </View>
        ) : resolvedReports.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="clipboard-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyBoxHeading, { color: theme.text }]}>
              {t.noCompletedTasks}
            </Text>
            <Text style={[styles.emptyBoxSubtext, { color: theme.textSecondary }]}>
              {t.noCompletedTasksDesc}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.historyList}
            contentContainerStyle={styles.historyListContent}
            showsVerticalScrollIndicator={false}>
            {resolvedReports.map((report) => {
              const resolvedDate = report.resolvedAt
                ? new Date(report.resolvedAt).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : new Date(report.createdAt).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });
              const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;

              return (
                <View
                  key={report._id}
                  style={[
                    styles.historyCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}>
                  {/* Card Header & Verification Stamp */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.stampBadge}>
                      <Ionicons name="shield-checkmark" size={14} color="#059669" />
                      <Text style={styles.stampBadgeText}>{t.verifiedStamp}</Text>
                    </View>
                    <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                      {resolvedDate}
                    </Text>
                  </View>

                  {/* High-Contrast Before & After Photo Comparison */}
                  <View style={styles.comparisonBox}>
                    {/* Before Photo */}
                    <View style={styles.imageCol}>
                      <View style={styles.badgeBefore}>
                        <Text style={styles.badgeText}>{t.beforeLitter}</Text>
                      </View>
                      {report.imageUrl ? (
                        <Pressable
                          onPress={() =>
                            setSelectedImage({
                              url: report.imageUrl!,
                              title: `${t.beforeLitter} - Reported Litter`,
                            })
                          }>
                          <Image
                            source={{ uri: report.imageUrl }}
                            style={styles.compImg}
                            contentFit="cover"
                            transition={200}
                          />
                        </Pressable>
                      ) : (
                        <View style={[styles.placeholderBox, { backgroundColor: theme.background }]}>
                          <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
                          <Text style={{ color: theme.textSecondary, fontSize: 10 }}>{t.noPhoto}</Text>
                        </View>
                      )}
                    </View>

                    {/* Arrow Divider */}
                    <View style={styles.flowArrowBox}>
                      <Ionicons name="arrow-forward" size={18} color="#059669" />
                    </View>

                    {/* After Proof Photo */}
                    <View style={styles.imageCol}>
                      <View style={styles.badgeAfter}>
                        <Text style={styles.badgeText}>{t.afterCleaned}</Text>
                      </View>
                      {report.proofImageUrl ? (
                        <Pressable
                          onPress={() =>
                            setSelectedImage({
                              url: report.proofImageUrl!,
                              title: `${t.afterCleaned} - Cleaned Proof`,
                            })
                          }>
                          <Image
                            source={{ uri: report.proofImageUrl }}
                            style={styles.compImg}
                            contentFit="cover"
                            transition={200}
                          />
                        </Pressable>
                      ) : (
                        <View style={[styles.placeholderBox, { backgroundColor: theme.background }]}>
                          <Ionicons name="camera-outline" size={24} color={theme.textSecondary} />
                          <Text style={{ color: theme.textSecondary, fontSize: 10 }}>Pending Proof</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Notes & Attributions */}
                  {report.resolutionNotes ? (
                    <View style={[styles.notesRibbon, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Ionicons name="chatbubble-ellipses" size={15} color="#059669" />
                      <Text style={[styles.notesRibbonText, { color: theme.text }]}>
                        &quot;{report.resolutionNotes}&quot;
                      </Text>
                    </View>
                  ) : null}

                  {/* Card Footer */}
                  <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                    <View style={styles.workerMetaBox}>
                      <Ionicons name="person-circle" size={16} color="#0284c7" />
                      <Text style={[styles.workerMetaName, { color: theme.text }]} numberOfLines={1}>
                        {report.resolvedBy ?? 'Municipal Worker'}
                      </Text>
                    </View>

                    <Pressable
                      style={styles.mapLinkBtn}
                      onPress={() => Linking.openURL(mapUrl)}>
                      <Ionicons name="map" size={14} color="#0284c7" />
                      <Text style={styles.mapLinkText}>{t.directions}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Full Image Lightbox */}
        <Modal
          visible={!!selectedImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedImage(null)}>
          <View style={styles.lightboxBackdrop}>
            <View style={styles.lightboxFrame}>
              <View style={styles.lightboxTopBar}>
                <Text style={styles.lightboxHeading}>{selectedImage?.title}</Text>
                <Pressable
                  onPress={() => setSelectedImage(null)}
                  style={styles.lightboxClose}>
                  <Ionicons name="close-circle" size={28} color="#ffffff" />
                </Pressable>
              </View>
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage.url }}
                  style={styles.lightboxImg}
                  contentFit="contain"
                />
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  headerCard: {
    padding: Spacing.three,
    borderRadius: 18,
    borderWidth: 1.5,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 180,
  },
  historyIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  screenSubheading: {
    fontSize: 11,
    fontWeight: '500',
  },
  langPills: {
    flexDirection: 'row',
    flexShrink: 0,
    backgroundColor: '#e2e8f0',
    padding: 4,
    borderRadius: 10,
    gap: 4,
  },
  langPill: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  langPillActive: {
    backgroundColor: '#059669',
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  langPillTextActive: {
    color: '#ffffff',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
  },
  statBigNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabelText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  cellDivider: {
    width: 1,
    height: 32,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingNotice: {
    fontSize: 13,
  },
  emptyBox: {
    padding: Spacing.six,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  emptyBoxHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  emptyBoxSubtext: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  historyCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  stampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  stampBadgeText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  comparisonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  imageCol: {
    flex: 1,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  badgeBefore: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAfter: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.95)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  compImg: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  placeholderBox: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  flowArrowBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  notesRibbonText: {
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: Spacing.two,
    borderTopWidth: 1.5,
  },
  workerMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    minWidth: 120,
  },
  workerMetaName: {
    fontSize: 12,
    fontWeight: '700',
  },
  mapLinkBtn: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  mapLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  lightboxFrame: {
    width: '100%',
    maxWidth: 600,
  },
  lightboxTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  lightboxHeading: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  lightboxClose: {
    padding: 4,
  },
  lightboxImg: {
    width: '100%',
    height: 420,
    borderRadius: 16,
  },
});
