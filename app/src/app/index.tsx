import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  Colors,
  Spacing,
  MaxContentWidth,
  BottomTabInset,
  TouchTarget,
  MunicipalPresets,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateDistance, formatDistance } from '@/utils/distance';
import { getI18n, Language } from '@/constants/i18n';

type FilterTab = 'available' | 'my_tasks' | 'resolved';

export default function WorkerHomeScreen() {
  const theme = useTheme();

  // Language state: defaults to bilingual (English + Sinhala) as requested
  const [lang, setLang] = useState<Language>('bilingual');
  const t = getI18n(lang);

  // Convex Data Queries and Mutations
  const reports = useQuery(api.reports.listReports, { limit: 100 });
  const assignReport = useMutation(api.reports.assignReport);
  const resolveReport = useMutation(api.reports.resolveReport);
  const generateUploadUrl = useMutation(api.reports.generateUploadUrl);

  // Worker & Municipal Truck State (Sri Lankan presets)
  const [workerName, setWorkerName] = useState<string>(MunicipalPresets[0].label);
  const [workerId, setWorkerId] = useState<string>(MunicipalPresets[0].id);
  const [isEditingWorker, setIsEditingWorker] = useState(false);
  const [customWorkerInput, setCustomWorkerInput] = useState('');

  // Active Filter Tab
  const [activeTab, setActiveTab] = useState<FilterTab>('available');

  // Worker Location & Telemetry
  const [workerCoords, setWorkerCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationStatus, setLocationStatus] = useState<'locating' | 'ready' | 'denied'>('locating');

  // Selected Task for Detail & Proof Flow
  const [selectedTaskId, setSelectedTaskId] = useState<Id<'reports'> | null>(null);

  // Proof Flow State
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);
  const [proofNotes, setProofNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Request worker GPS location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationStatus('denied');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setWorkerCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        setLocationStatus('ready');
      } catch (err) {
        console.warn('GPS location fetch error:', err);
        setLocationStatus('denied');
      }
    })();
  }, []);

  const selectedTask = reports?.find((r) => r._id === selectedTaskId);

  // Filter tasks
  const myTasks = (reports ?? []).filter(
    (r) =>
      r.status === 'in_progress' &&
      (r.assignedWorkerId === workerId || !r.assignedWorkerId)
  );

  const availableTasks = (reports ?? []).filter((r) => r.status === 'pending');
  const resolvedTasks = (reports ?? []).filter((r) => r.status === 'resolved');

  // Distance helper
  const getDistanceToReport = (lat: number, lon: number): number | null => {
    if (!workerCoords) return null;
    return calculateDistance(workerCoords.latitude, workerCoords.longitude, lat, lon);
  };

  const currentList =
    activeTab === 'available'
      ? availableTasks
      : activeTab === 'my_tasks'
      ? myTasks
      : resolvedTasks;

  // Camera & Image Picker Handlers (Outdoor glove-friendly)
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t.photoRequiredTitle, t.photoRequiredMsg);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProofImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Failed to take photo:', err);
      Alert.alert('Camera Error', 'Could not access device camera.');
    }
  };

  const handleUploadPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t.photoRequiredTitle, t.photoRequiredMsg);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProofImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Failed to select photo:', err);
      Alert.alert('Upload Error', 'Could not open photo library.');
    }
  };

  // Submit Proof Flow
  const handleSubmitProof = async () => {
    if (!selectedTask) return;
    if (!proofImageUri) {
      Alert.alert(t.photoRequiredTitle, t.photoRequiredMsg);
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(proofImageUri);
      const blob = await response.blob();

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload photo: ${uploadRes.statusText}`);
      }

      const { storageId } = await uploadRes.json();

      await resolveReport({
        reportId: selectedTask._id,
        proofPhotoStorageId: storageId,
        workerName: workerName,
        notes: proofNotes.trim() ? proofNotes.trim() : 'Litter collected and area cleaned.',
      });

      Alert.alert(t.successAlertTitle, t.successAlertMsg);
      setProofImageUri(null);
      setProofNotes('');
      setSelectedTaskId(null);
      setActiveTab('resolved');
    } catch (err) {
      console.error('Proof submission error:', err);
      Alert.alert('Submission Error', 'Failed to submit proof. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign Task to Current Worker
  const handleStartTask = async (task: (typeof currentList)[0]) => {
    try {
      await assignReport({
        reportId: task._id,
        workerId: workerId,
        workerName: workerName,
      });
      setSelectedTaskId(task._id);
      setActiveTab('my_tasks');
    } catch (err) {
      console.error('Assignment failed:', err);
      Alert.alert('Error', 'Could not assign task.');
    }
  };

  const openNavigation = (lat: number, lon: number) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lon}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    });
    Linking.openURL(url);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {/* Top Operational Header */}
        <View style={[styles.topHeaderCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.headerTopRow}>
            {/* Municipal Badge */}
            <View style={styles.municipalBadge}>
              <View style={styles.slFlagEmblem}>
                <Ionicons name="shield-checkmark" size={16} color="#059669" />
              </View>
              <View>
                <Text style={[styles.councilTitle, { color: theme.text }]}>{t.appTitle}</Text>
                <Text style={[styles.councilSubtitle, { color: theme.textSecondary }]}>
                  {t.appSubtitle}
                </Text>
              </View>
            </View>

            {/* Trilingual Switcher Pills */}
            <View style={styles.langSwitchGroup}>
              {(
                [
                  { code: 'bilingual', label: 'සිං/EN' },
                  { code: 'si', label: 'සිං' },
                  { code: 'ta', label: 'த' },
                  { code: 'en', label: 'EN' },
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

          {/* Worker & Truck Banner */}
          <Pressable
            style={[styles.workerTagRow, { backgroundColor: theme.background }]}
            onPress={() => setIsEditingWorker(true)}>
            <View style={styles.truckIconBadge}>
              <Ionicons name="bus-outline" size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.workerTagTitle, { color: theme.text }]} numberOfLines={1}>
                {workerName}
              </Text>
              <View style={styles.workerStatusRow}>
                <View style={styles.activePulse} />
                <Text style={styles.activeText}>{t.shiftActive}</Text>
                <Text style={styles.dotSeparator}>•</Text>
                <Ionicons
                  name={locationStatus === 'ready' ? 'location' : 'location-outline'}
                  size={12}
                  color={locationStatus === 'ready' ? '#059669' : '#94a3b8'}
                />
                <Text style={styles.gpsStatusText}>
                  {locationStatus === 'ready'
                    ? t.gpsConnected
                    : locationStatus === 'locating'
                    ? t.gpsLocating
                    : t.gpsOff}
                </Text>
              </View>
            </View>
            <View style={styles.switchUnitButton}>
              <Text style={styles.switchUnitText}>{t.switchWorker}</Text>
              <Ionicons name="chevron-forward" size={14} color="#0284c7" />
            </View>
          </Pressable>
        </View>

        {/* Tab Filters (High-contrast large touch targets) */}
        <View style={[styles.filterBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Pressable
            style={[styles.filterTab, activeTab === 'available' && styles.filterTabActive]}
            onPress={() => setActiveTab('available')}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={activeTab === 'available' ? '#ffffff' : '#d97706'}
            />
            <Text
              style={[
                styles.filterTabText,
                { color: activeTab === 'available' ? '#ffffff' : theme.text },
              ]}>
              {t.tabAvailable} ({availableTasks.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterTab, activeTab === 'my_tasks' && styles.filterTabActive]}
            onPress={() => setActiveTab('my_tasks')}>
            <Ionicons
              name="construct"
              size={18}
              color={activeTab === 'my_tasks' ? '#ffffff' : '#0284c7'}
            />
            <Text
              style={[
                styles.filterTabText,
                { color: activeTab === 'my_tasks' ? '#ffffff' : theme.text },
              ]}>
              {t.tabMyTasks} ({myTasks.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterTab, activeTab === 'resolved' && styles.filterTabActive]}
            onPress={() => setActiveTab('resolved')}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={activeTab === 'resolved' ? '#ffffff' : '#059669'}
            />
            <Text
              style={[
                styles.filterTabText,
                { color: activeTab === 'resolved' ? '#ffffff' : theme.text },
              ]}>
              {t.tabDone} ({resolvedTasks.length})
            </Text>
          </Pressable>
        </View>

        {/* Task Feed */}
        {reports === undefined ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={[styles.loadingNotice, { color: theme.textSecondary }]}>
              {t.gpsLocating}
            </Text>
          </View>
        ) : currentList.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name={
                  activeTab === 'available'
                    ? 'sparkles'
                    : activeTab === 'my_tasks'
                    ? 'clipboard-outline'
                    : 'ribbon-outline'
                }
                size={40}
                color="#059669"
              />
            </View>
            <Text style={[styles.emptyHeader, { color: theme.text }]}>
              {activeTab === 'available'
                ? t.noAvailableTasks
                : activeTab === 'my_tasks'
                ? t.noMyTasks
                : t.noCompletedTasks}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              {activeTab === 'available'
                ? t.noAvailableTasksDesc
                : activeTab === 'my_tasks'
                ? t.noMyTasksDesc
                : t.noCompletedTasksDesc}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.taskScroll}
            contentContainerStyle={styles.taskScrollContent}
            showsVerticalScrollIndicator={false}>
            {currentList.map((task) => {
              const distanceMeters = getDistanceToReport(task.latitude, task.longitude);
              const confidencePct = task.confidence
                ? `${(task.confidence * 100).toFixed(0)}%`
                : null;
              const dateStr = new Date(task.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View
                  key={task._id}
                  style={[
                    styles.outdoorCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}>
                  {/* Photo Preview & Overlaid Badges */}
                  <View style={styles.cardMediaBox}>
                    {task.imageUrl ? (
                      <Image
                        source={{ uri: task.imageUrl }}
                        style={styles.cardImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.cardImagePlaceholder, { backgroundColor: theme.backgroundSelected }]}>
                        <Ionicons name="image-outline" size={36} color={theme.textSecondary} />
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                          {t.noPhoto}
                        </Text>
                      </View>
                    )}

                    {/* AI Confidence Badge */}
                    {confidencePct && (
                      <View style={styles.cardAiBadge}>
                        <Ionicons name="hardware-chip" size={13} color="#ffffff" />
                        <Text style={styles.cardAiBadgeText}>
                          {t.aiConfidence}: {confidencePct}
                        </Text>
                      </View>
                    )}

                    {/* Proximity Distance */}
                    {distanceMeters !== null && (
                      <View style={styles.cardDistanceBadge}>
                        <Ionicons name="navigate-circle" size={14} color="#ffffff" />
                        <Text style={styles.cardDistanceText}>
                          {formatDistance(distanceMeters)} {t.distanceAway}
                        </Text>
                      </View>
                    )}

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.cardStatusPill,
                        task.status === 'pending'
                          ? styles.statusPillPending
                          : task.status === 'in_progress'
                          ? styles.statusPillProgress
                          : styles.statusPillResolved,
                      ]}>
                      <Text
                        style={[
                          styles.cardStatusText,
                          task.status === 'pending'
                            ? styles.statusTextPending
                            : task.status === 'in_progress'
                            ? styles.statusTextProgress
                            : styles.statusTextResolved,
                        ]}>
                        {task.status === 'pending'
                          ? 'පොරොත්තු • Pending'
                          : task.status === 'in_progress'
                          ? 'ක්‍රියාත්මකයි • In Progress'
                          : 'පිරිසිදු කළා • Done'}
                      </Text>
                    </View>
                  </View>

                  {/* Card Description & Location */}
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardCaptionText, { color: theme.text }]}>
                      {task.caption ? `"${task.caption}"` : 'කසළ වාර්තාව • Roadside Litter Report'}
                    </Text>

                    <View style={styles.cardLocationMeta}>
                      <View style={styles.metaLocationItem}>
                        <Ionicons name="location-sharp" size={16} color="#dc2626" />
                        <Text style={[styles.coordNumbers, { color: theme.text }]}>
                          {task.latitude.toFixed(5)}, {task.longitude.toFixed(5)}
                        </Text>
                      </View>
                      <View style={styles.metaTimeItem}>
                        <Ionicons name="time-outline" size={15} color={theme.textSecondary} />
                        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                          {dateStr}
                        </Text>
                      </View>
                    </View>

                    {/* High-Contrast Glove-Friendly Action Buttons */}
                    <View style={[styles.cardButtonsRow, { borderTopColor: theme.border }]}>
                      {/* Directions Button */}
                      <Pressable
                        style={styles.directionsBigButton}
                        onPress={() => openNavigation(task.latitude, task.longitude)}>
                        <Ionicons name="compass" size={20} color="#0284c7" />
                        <Text style={styles.directionsButtonText}>{t.directions}</Text>
                      </Pressable>

                      {/* Primary Operation Action */}
                      {task.status === 'pending' ? (
                        <Pressable
                          style={styles.primaryActionButton}
                          onPress={() => handleStartTask(task)}>
                          <Ionicons name="play" size={20} color="#ffffff" />
                          <Text style={styles.primaryActionText}>{t.startTask}</Text>
                        </Pressable>
                      ) : task.status === 'in_progress' ? (
                        <Pressable
                          style={[styles.primaryActionButton, styles.proofActionButton]}
                          onPress={() => {
                            setSelectedTaskId(task._id);
                            setProofImageUri(null);
                            setProofNotes('');
                          }}>
                          <Ionicons name="camera" size={22} color="#ffffff" />
                          <Text style={styles.primaryActionText}>{t.submitProof}</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.viewProofButton}
                          onPress={() => setSelectedTaskId(task._id)}>
                          <Ionicons name="checkmark-done" size={20} color="#059669" />
                          <Text style={styles.viewProofText}>{t.viewProof}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Task Detail & Proof Modal (Designed for outdoor field use) */}
        <Modal
          visible={!!selectedTask}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedTaskId(null)}>
          <View style={styles.modalShade}>
            <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElement }]}>
              {/* Modal Header */}
              <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: theme.text }]}>
                    {selectedTask?.status === 'resolved'
                      ? t.verificationTitle
                      : t.taskDetailTitle}
                  </Text>
                  <Text style={[styles.sheetId, { color: theme.textSecondary }]}>
                    ID: {selectedTask?._id.slice(0, 12)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedTaskId(null)}
                  style={styles.sheetCloseBtn}>
                  <Ionicons name="close-circle" size={32} color={theme.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={false}>
                {selectedTask && (
                  <>
                    {/* Location & Navigation Card */}
                    <View style={[styles.modalLocationCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <View style={styles.modalLocHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="location" size={18} color="#dc2626" />
                          <Text style={[styles.modalLocTitle, { color: theme.text }]}>
                            {t.litterLocation}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.openMapsLargePill}
                          onPress={() =>
                            openNavigation(selectedTask.latitude, selectedTask.longitude)
                          }>
                          <Ionicons name="navigate" size={14} color="#0284c7" />
                          <Text style={styles.openMapsPillText}>{t.openInMaps}</Text>
                        </Pressable>
                      </View>
                      <Text style={[styles.modalLocCoords, { color: theme.text }]}>
                        {selectedTask.latitude.toFixed(6)}, {selectedTask.longitude.toFixed(6)}
                      </Text>
                      {selectedTask.offsetMeters !== undefined && (
                        <Text style={[styles.modalTelemetry, { color: theme.textSecondary }]}>
                          {t.fusedTelemetry}: +{selectedTask.offsetMeters.toFixed(1)}m @ {selectedTask.heading ?? 0}°
                        </Text>
                      )}
                    </View>

                    {/* Reported Litter (Before) Photo */}
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="trash" size={18} color="#d97706" />
                      <Text style={[styles.sectionHeading, { color: theme.text }]}>
                        {t.reportedLitterPhoto}
                      </Text>
                    </View>
                    {selectedTask.imageUrl ? (
                      <Image
                        source={{ uri: selectedTask.imageUrl }}
                        style={styles.modalLitterImg}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.modalImgPlaceholder, { backgroundColor: theme.background }]}>
                        <Text style={{ color: theme.textSecondary }}>{t.noPhoto}</Text>
                      </View>
                    )}

                    {/* Proof Submission Flow (for in-progress tasks) */}
                    {selectedTask.status === 'in_progress' ? (
                      <View style={styles.proofFlowContainer}>
                        <View style={styles.sectionHeaderRow}>
                          <Ionicons name="shield-checkmark" size={20} color="#059669" />
                          <Text style={[styles.sectionHeading, { color: theme.text }]}>
                            {t.proofSectionTitle}
                          </Text>
                        </View>
                        <Text style={[styles.proofInstructionsText, { color: theme.textSecondary }]}>
                          {t.proofInstructions}
                        </Text>

                        {/* Glove-Sized Photo Actions */}
                        <View style={styles.cameraActionButtonsRow}>
                          <Pressable
                            style={[styles.bigPhotoButton, styles.takePhotoGreenBtn]}
                            onPress={handleTakePhoto}>
                            <Ionicons name="camera" size={26} color="#ffffff" />
                            <Text style={styles.bigPhotoBtnText}>{t.takePhoto}</Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.bigPhotoButton,
                              styles.uploadPhotoBlueBtn,
                              { borderColor: theme.border },
                            ]}
                            onPress={handleUploadPhoto}>
                            <Ionicons name="images-outline" size={24} color="#0284c7" />
                            <Text style={styles.uploadPhotoBtnText}>{t.uploadPhoto}</Text>
                          </Pressable>
                        </View>

                        {/* Captured Photo Preview */}
                        {proofImageUri ? (
                          <View style={styles.previewBox}>
                            <Image
                              source={{ uri: proofImageUri }}
                              style={styles.previewImg}
                              contentFit="cover"
                            />
                            <Pressable
                              style={styles.retakeFloatingBadge}
                              onPress={() => setProofImageUri(null)}>
                              <Ionicons name="refresh" size={16} color="#ffffff" />
                              <Text style={styles.retakeBadgeText}>{t.retakePhoto}</Text>
                            </Pressable>
                          </View>
                        ) : null}

                        {/* Quick Preset Work Notes */}
                        <Text style={[styles.presetNotesTitle, { color: theme.textSecondary }]}>
                          {t.workNotesLabel}
                        </Text>
                        <View style={styles.quickChipsGroup}>
                          {[t.quickNote1, t.quickNote2, t.quickNote3].map((chip) => (
                            <Pressable
                              key={chip}
                              style={[styles.quickChip, { backgroundColor: theme.background, borderColor: theme.border }]}
                              onPress={() => setProofNotes(chip)}>
                              <Text style={[styles.quickChipText, { color: theme.text }]}>{chip}</Text>
                            </Pressable>
                          ))}
                        </View>

                        <TextInput
                          style={[
                            styles.notesField,
                            {
                              backgroundColor: theme.background,
                              borderColor: theme.border,
                              color: theme.text,
                            },
                          ]}
                          placeholder={t.workNotesPlaceholder}
                          placeholderTextColor={theme.textSecondary}
                          value={proofNotes}
                          onChangeText={setProofNotes}
                          multiline
                        />

                        {/* Huge 62px Glove-Friendly Submit Button */}
                        <Pressable
                          style={[
                            styles.finalSubmitButton,
                            (!proofImageUri || isSubmitting) && styles.finalSubmitDisabled,
                          ]}
                          disabled={!proofImageUri || isSubmitting}
                          onPress={handleSubmitProof}>
                          {isSubmitting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-done-circle" size={24} color="#ffffff" />
                              <Text style={styles.finalSubmitText}>{t.submitAndComplete}</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    ) : selectedTask.status === 'resolved' ? (
                      /* Resolved Before & After Card */
                      <View style={styles.resolvedAuditBox}>
                        <View style={styles.sectionHeaderRow}>
                          <Ionicons name="checkmark-done-circle" size={20} color="#059669" />
                          <Text style={[styles.sectionHeading, { color: theme.text }]}>
                            {t.afterCleaned}
                          </Text>
                        </View>
                        {selectedTask.proofImageUrl ? (
                          <Image
                            source={{ uri: selectedTask.proofImageUrl }}
                            style={styles.modalLitterImg}
                            contentFit="cover"
                          />
                        ) : (
                          <Text style={{ color: theme.textSecondary }}>No proof photo stored</Text>
                        )}
                        {selectedTask.resolutionNotes && (
                          <View style={[styles.verifiedNotesCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <Text style={[styles.verifiedNotesText, { color: theme.text }]}>
                              &quot;{selectedTask.resolutionNotes}&quot;
                            </Text>
                            <Text style={[styles.verifiedNotesMeta, { color: theme.textSecondary }]}>
                              {t.cleanedBy}: {selectedTask.resolvedBy ?? 'Worker'}
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      /* Available Task Claim Action */
                      <View style={{ marginTop: Spacing.four }}>
                        <Pressable
                          style={styles.claimJobBigButton}
                          onPress={() => handleStartTask(selectedTask)}>
                          <Ionicons name="play" size={22} color="#ffffff" />
                          <Text style={styles.claimJobText}>{t.claimTask}</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Sri Lankan Municipal Unit Switcher Modal */}
        <Modal
          visible={isEditingWorker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsEditingWorker(false)}>
          <View style={styles.modalShade}>
            <View style={[styles.workerModalCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.modalIconTop}>
                <Ionicons name="bus" size={28} color="#059669" />
              </View>
              <Text style={[styles.workerModalHeading, { color: theme.text }]}>
                {t.switchWorker}
              </Text>
              <Text style={[styles.workerModalSubtext, { color: theme.textSecondary }]}>
                Select municipal truck unit or enter worker ID for collection logs:
              </Text>

              {/* Sri Lankan Council Presets */}
              <View style={styles.presetListGroup}>
                {MunicipalPresets.map((preset) => (
                  <Pressable
                    key={preset.id}
                    style={[
                      styles.presetItemBtn,
                      workerId === preset.id && styles.presetItemActive,
                      { borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                    onPress={() => {
                      setWorkerId(preset.id);
                      setWorkerName(preset.label);
                      setIsEditingWorker(false);
                    }}>
                    <Ionicons
                      name={workerId === preset.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={workerId === preset.id ? '#059669' : '#94a3b8'}
                    />
                    <Text
                      style={[
                        styles.presetItemText,
                        { color: workerId === preset.id ? '#059669' : theme.text },
                      ]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Custom Input */}
              <TextInput
                style={[
                  styles.customWorkerField,
                  { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="Or custom: e.g. CMC Truck 15 - Borella"
                placeholderTextColor={theme.textSecondary}
                value={customWorkerInput}
                onChangeText={setCustomWorkerInput}
              />

              <View style={styles.workerModalActionsRow}>
                <Pressable
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setIsEditingWorker(false)}>
                  <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalSaveBtn}
                  onPress={() => {
                    if (customWorkerInput.trim()) {
                      setWorkerName(customWorkerInput.trim());
                      setWorkerId(`worker-${customWorkerInput.trim().toLowerCase().replace(/\s+/g, '-')}`);
                    }
                    setIsEditingWorker(false);
                  }}>
                  <Text style={{ color: '#ffffff', fontWeight: '800' }}>Confirm Unit</Text>
                </Pressable>
              </View>
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
  topHeaderCard: {
    padding: Spacing.three,
    borderRadius: 18,
    borderWidth: 1.5,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  municipalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  slFlagEmblem: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  councilTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  councilSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  langSwitchGroup: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 3,
    borderRadius: 10,
    gap: 2,
  },
  langPill: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  langPillActive: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  langPillTextActive: {
    color: '#ffffff',
  },
  workerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
  },
  truckIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerTagTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  workerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  activeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  dotSeparator: {
    fontSize: 10,
    color: '#94a3b8',
  },
  gpsStatusText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  switchUnitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#e0f2fe',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  switchUnitText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: Spacing.two,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingNotice: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCard: {
    padding: Spacing.six,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeader: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 340,
  },
  taskScroll: {
    flex: 1,
  },
  taskScrollContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  outdoorCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardMediaBox: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardAiBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.95)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  cardAiBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  cardDistanceBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  cardDistanceText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardStatusPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillPending: {
    backgroundColor: '#fef3c7',
  },
  statusPillProgress: {
    backgroundColor: '#e0f2fe',
  },
  statusPillResolved: {
    backgroundColor: '#ecfdf5',
  },
  cardStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextPending: {
    color: '#b45309',
  },
  statusTextProgress: {
    color: '#0369a1',
  },
  statusTextResolved: {
    color: '#047857',
  },
  cardContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardCaptionText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  cardLocationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  coordNumbers: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  metaTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: 1.5,
  },
  directionsBigButton: {
    flex: 1,
    height: TouchTarget.standard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
  },
  directionsButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
  },
  primaryActionButton: {
    flex: 1.2,
    height: TouchTarget.standard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  proofActionButton: {
    backgroundColor: '#0284c7',
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  viewProofButton: {
    flex: 1.2,
    height: TouchTarget.standard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  viewProofText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  modalShade: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    height: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.two,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1.5,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetId: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  sheetCloseBtn: {
    padding: 2,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  modalLocationCard: {
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 6,
  },
  modalLocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalLocTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  openMapsLargePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  openMapsPillText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '800',
  },
  modalLocCoords: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  modalTelemetry: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.one,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalLitterImg: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  modalImgPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofFlowContainer: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  proofInstructionsText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  cameraActionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: 4,
  },
  bigPhotoButton: {
    flex: 1,
    height: TouchTarget.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
  },
  takePhotoGreenBtn: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  bigPhotoBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  uploadPhotoBlueBtn: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
  },
  uploadPhotoBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '800',
  },
  previewBox: {
    position: 'relative',
    marginTop: Spacing.two,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImg: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  retakeFloatingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  presetNotesTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickChipsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesField: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  finalSubmitButton: {
    height: TouchTarget.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 16,
    shadowColor: '#059669',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  finalSubmitDisabled: {
    opacity: 0.45,
  },
  finalSubmitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  resolvedAuditBox: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  verifiedNotesCard: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  verifiedNotesText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  verifiedNotesMeta: {
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '600',
  },
  claimJobBigButton: {
    height: TouchTarget.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 16,
  },
  claimJobText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  workerModalCard: {
    margin: Spacing.four,
    padding: Spacing.four,
    borderRadius: 22,
    borderWidth: 1.5,
    gap: Spacing.two,
  },
  modalIconTop: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  workerModalHeading: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  workerModalSubtext: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  presetListGroup: {
    gap: 8,
    marginVertical: 4,
  },
  presetItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  presetItemActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  presetItemText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  customWorkerField: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
  },
  workerModalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
});
