export type Language = 'bilingual' | 'si' | 'ta' | 'en';

export interface I18nStrings {
  // App Title & Header
  appTitle: string;
  appSubtitle: string;
  shiftActive: string;
  gpsConnected: string;
  gpsLocating: string;
  gpsOff: string;
  switchWorker: string;

  // Tabs
  tabAvailable: string;
  tabMyTasks: string;
  tabDone: string;

  // Task Card
  aiConfidence: string;
  distanceAway: string;
  directions: string;
  startTask: string;
  submitProof: string;
  viewProof: string;
  noPhoto: string;

  // Detail Modal
  taskDetailTitle: string;
  verificationTitle: string;
  litterLocation: string;
  openInMaps: string;
  reportedLitterPhoto: string;
  fusedTelemetry: string;

  // Proof Flow
  proofSectionTitle: string;
  proofInstructions: string;
  takePhoto: string;
  uploadPhoto: string;
  retakePhoto: string;
  workNotesLabel: string;
  workNotesPlaceholder: string;
  submitAndComplete: string;
  claimTask: string;

  // Preset quick notes
  quickNote1: string;
  quickNote2: string;
  quickNote3: string;

  // History & Verification
  historyTitle: string;
  historySubtitle: string;
  cleanedSites: string;
  photoVerified: string;
  complianceRate: string;
  beforeLitter: string;
  afterCleaned: string;
  cleanedBy: string;

  // Empty states
  noAvailableTasks: string;
  noAvailableTasksDesc: string;
  noMyTasks: string;
  noMyTasksDesc: string;
  noCompletedTasks: string;
  noCompletedTasksDesc: string;

  // Alerts
  successAlertTitle: string;
  successAlertMsg: string;
  photoRequiredTitle: string;
  photoRequiredMsg: string;
}

const strings: Record<Language, I18nStrings> = {
  bilingual: {
    appTitle: 'CLEO • කසළ මෙහෙයුම්',
    appSubtitle: 'Municipal Waste Operations • නගර සභා කසළ කළමනාකරණය',
    shiftActive: 'සේවයේ නියුතුයි • Active Shift',
    gpsConnected: 'GPS සක්‍රියයි • GPS Connected',
    gpsLocating: 'ස්ථානය සොයමින්... • Locating...',
    gpsOff: 'GPS අක්‍රියයි • GPS Off',
    switchWorker: 'සේවක මාරුව • Switch Worker',

    tabAvailable: 'පවතින කසළ (Available)',
    tabMyTasks: 'මගේ කාර්යයන් (My Tasks)',
    tabDone: 'අවසන් කළ (Done)',

    aiConfidence: 'AI හඳුනාගැනීම',
    distanceAway: 'දුරින්',
    directions: 'මඟ පෙන්වීම • Directions',
    startTask: 'භාරගන්න • Start',
    submitProof: 'සාක්ෂි එවන්න • Submit Proof',
    viewProof: 'සාක්ෂි බලන්න • View Proof',
    noPhoto: 'ඡායාරූපයක් නැත • No Photo',

    taskDetailTitle: 'කසළ එකතු කිරීමේ කාර්යය • Litter Task',
    verificationTitle: 'පිරිසිදු කිරීම තහවුරු කිරීම • Verification',
    litterLocation: 'කසළ ඇති ස්ථානය • Location',
    openInMaps: 'සිතියම බලන්න • Open Maps ↗',
    reportedLitterPhoto: 'වාර්තා වූ කසළ ඡායාරූපය • Reported Litter Photo',
    fusedTelemetry: 'GPS+IMU නිවැරදි කළ පිහිටුම',

    proofSectionTitle: 'පිරිසිදු කළ බවට සාක්ෂි • Proof of Cleaning',
    proofInstructions:
      'කසළ එකතු කර ප්‍රදේශය පිරිසිදු කළ බව තහවුරු කිරීමට ඡායාරූපයක් එවන්න. (Please capture a photo proving the area is clean).',
    takePhoto: '📷 ඡායාරූපය ගන්න • Take Photo',
    uploadPhoto: '🖼️ ගැලරියෙන් • Upload Photo',
    retakePhoto: 'නැවත ගන්න • Retake',
    workNotesLabel: 'කෙටි සටහන (විකල්ප) • Notes (Optional):',
    workNotesPlaceholder: 'උදා: ප්ලාස්ටික් බෑග් 2ක් ඉවත් කර ලොරියට පැටවුවා...',
    submitAndComplete: '✓ සාක්ෂි යවා අවසන් කරන්න • Submit & Complete',
    claimTask: 'භාරගෙන ආරම්භ කරන්න • Accept & Start',

    quickNote1: 'ප්ලාස්ටික් කසළ ඉවත් කළා • Plastics removed',
    quickNote2: 'කසළ ලොරියට පැටවුවා • Loaded to truck',
    quickNote3: 'ප්‍රදේශය සම්පූර්ණයෙන් පිරිසිදුයි • Fully cleaned',

    historyTitle: 'පිරිසිදු කිරීම් ඉතිහාසය • Collection History',
    historySubtitle: 'ඡායාරූප සාක්ෂි සහිත වාර්තා • Verified cleanups with proof',
    cleanedSites: 'පිරිසිදු කළ ස්ථාන • Cleaned',
    photoVerified: 'තහවුරු කළ • Verified',
    complianceRate: 'සාර්ථකත්වය • Rate',
    beforeLitter: 'පෙර (Before)',
    afterCleaned: 'පසු (After Proof)',
    cleanedBy: 'එකතු කළේ • Cleaned by',

    noAvailableTasks: 'පවතින කසළ ස්ථාන නැත',
    noAvailableTasksDesc: 'ඔබගේ කලාපයේ සියලු කසළ එකතු කර අවසන් කර ඇත.',
    noMyTasks: 'ඔබට පැවරුණු කාර්යයන් නැත',
    noMyTasksDesc: '"පවතින කසළ" ටැබ් එකෙන් නව ස්ථානයක් භාරගන්න.',
    noCompletedTasks: 'අද දින අවසන් කළ කාර්යයන් නැත',
    noCompletedTasksDesc: 'කසළ ඉවත් කර සාක්ෂි එවූ පසු ඒවා මෙහි දිස්වනු ඇත.',

    successAlertTitle: 'කාර්යය සාර්ථකයි! 🎉',
    successAlertMsg: 'ඡායාරූප සාක්ෂිය සාර්ථකව උඩුගත විය. ස්ථානය පිරිසිදු ලෙස සටහන් විය.',
    photoRequiredTitle: 'ඡායාරූපයක් අවශ්‍යයි',
    photoRequiredMsg: 'කරුණාකර පිරිසිදු කළ ප්‍රදේශයේ ඡායාරූපයක් ගන්න හෝ උඩුගත කරන්න.',
  },

  si: {
    appTitle: 'CLEO • කසළ මෙහෙයුම්',
    appSubtitle: 'නගර සභා කසළ කළමනාකරණ පද්ධතිය',
    shiftActive: 'සේවයේ නියුතුයි',
    gpsConnected: 'GPS සක්‍රියයි',
    gpsLocating: 'ස්ථානය සොයමින්...',
    gpsOff: 'GPS අක්‍රියයි',
    switchWorker: 'සේවක මාරුව',

    tabAvailable: 'පවතින කසළ',
    tabMyTasks: 'මගේ කාර්යයන්',
    tabDone: 'අවසන් කළ',

    aiConfidence: 'AI හඳුනාගැනීම',
    distanceAway: 'දුරින්',
    directions: 'මඟ පෙන්වීම',
    startTask: 'භාරගන්න',
    submitProof: 'සාක්ෂි එවන්න',
    viewProof: 'සාක්ෂි බලන්න',
    noPhoto: 'ඡායාරූපයක් නැත',

    taskDetailTitle: 'කසළ එකතු කිරීමේ කාර්යය',
    verificationTitle: 'පිරිසිදු කිරීම තහවුරු කිරීම',
    litterLocation: 'කසළ ඇති ස්ථානය',
    openInMaps: 'සිතියම බලන්න ↗',
    reportedLitterPhoto: 'වාර්තා වූ කසළ ඡායාරූපය',
    fusedTelemetry: 'GPS+IMU නිවැරදි කළ පිහිටුම',

    proofSectionTitle: 'පිරිසිදු කළ බවට සාක්ෂි',
    proofInstructions:
      'කසළ එකතු කර ප්‍රදේශය පිරිසිදු කළ බව තහවුරු කිරීමට ඡායාරූපයක් එවන්න.',
    takePhoto: '📷 ඡායාරූපය ගන්න',
    uploadPhoto: '🖼️ ගැලරියෙන් තෝරන්න',
    retakePhoto: 'නැවත ගන්න',
    workNotesLabel: 'කෙටි සටහන (විකල්ප):',
    workNotesPlaceholder: 'උදා: ප්ලාස්ටික් බෑග් 2ක් ඉවත් කර ලොරියට පැටවුවා...',
    submitAndComplete: '✓ සාක්ෂි යවා අවසන් කරන්න',
    claimTask: 'භාරගෙන ආරම්භ කරන්න',

    quickNote1: 'ප්ලාස්ටික් කසළ ඉවත් කළා',
    quickNote2: 'කසළ ලොරියට පැටවුවා',
    quickNote3: 'ප්‍රදේශය සම්පූර්ණයෙන් පිරිසිදුයි',

    historyTitle: 'පිරිසිදු කිරීම් ඉතිහාසය',
    historySubtitle: 'ඡායාරූප සාක්ෂි සහිත තහවුරු කළ වාර්තා',
    cleanedSites: 'පිරිසිදු කළ ස්ථාන',
    photoVerified: 'තහවුරු කළ',
    complianceRate: 'සාර්ථකත්වය',
    beforeLitter: 'පෙර (කසළ)',
    afterCleaned: 'පසු (පිරිසිදු)',
    cleanedBy: 'එකතු කළේ',

    noAvailableTasks: 'පවතින කසළ ස්ථාන නැත',
    noAvailableTasksDesc: 'ඔබගේ කලාපයේ සියලු කසළ එකතු කර අවසන් කර ඇත.',
    noMyTasks: 'ඔබට පැවරුණු කාර්යයන් නැත',
    noMyTasksDesc: '"පවතින කසළ" ටැබ් එකෙන් නව ස්ථානයක් භාරගන්න.',
    noCompletedTasks: 'අද දින අවසන් කළ කාර්යයන් නැත',
    noCompletedTasksDesc: 'කසළ ඉවත් කර සාක්ෂි එවූ පසු ඒවා මෙහි දිස්වනු ඇත.',

    successAlertTitle: 'කාර්යය සාර්ථකයි! 🎉',
    successAlertMsg: 'ඡායාරූප සාක්ෂිය සාර්ථකව උඩුගත විය. ස්ථානය පිරිසිදු ලෙස සටහන් විය.',
    photoRequiredTitle: 'ඡායාරූපයක් අවශ්‍යයි',
    photoRequiredMsg: 'කරුණාකර පිරිසිදු කළ ප්‍රදේශයේ ඡායාරූපයක් ගන්න හෝ උඩුගත කරන්න.',
  },

  ta: {
    appTitle: 'CLEO • கழிவு மேலாண்மை',
    appSubtitle: 'நகராட்சி கழிவு சேகரிப்பு அமைப்பு',
    shiftActive: 'பணியில் உள்ளார்',
    gpsConnected: 'GPS இணைக்கப்பட்டது',
    gpsLocating: 'இடத்தைக் கண்டறிகிறது...',
    gpsOff: 'GPS முடக்கப்பட்டது',
    switchWorker: 'பணியாளர் மாற்றம்',

    tabAvailable: 'கிடைக்கும் கழிவுகள்',
    tabMyTasks: 'எனது பணிகள்',
    tabDone: 'முடிக்கப்பட்டது',

    aiConfidence: 'AI கண்டறிதல்',
    distanceAway: 'தொலைவில்',
    directions: 'வழிகாட்டுதல்',
    startTask: 'தொடங்கு',
    submitProof: 'சான்று அனுப்பு',
    viewProof: 'சான்று பார்',
    noPhoto: 'படம் இல்லை',

    taskDetailTitle: 'கழிவு சேகரிப்பு பணி',
    verificationTitle: 'சுத்தம் செய்தல் சரிபார்ப்பு',
    litterLocation: 'கழிவு இருக்கும் இடம்',
    openInMaps: 'வரைபடத்தில் பார் ↗',
    reportedLitterPhoto: 'புகாரளிக்கப்பட்ட கழிவு படம்',
    fusedTelemetry: 'GPS+IMU திருத்தப்பட்ட இருப்பிடம்',

    proofSectionTitle: 'சுத்தம் செய்ததற்கான சான்று',
    proofInstructions:
      'கழிவுகள் சேகரிக்கப்பட்டு பகுதி சுத்தம் செய்யப்பட்டுள்ளதை நிரூபிக்க புகைப்படத்தை அனுப்பவும்.',
    takePhoto: '📷 படம் எடு',
    uploadPhoto: '🖼️ கேலரியில் இருந்து',
    retakePhoto: 'மீண்டும் எடு',
    workNotesLabel: 'குறிப்புகள் (விருப்பத்தேர்வு):',
    workNotesPlaceholder: 'எ.கா: பிளாஸ்டிக் அகற்றப்பட்டு லாரியில் ஏற்றப்பட்டது...',
    submitAndComplete: '✓ சான்று சமர்ப்பித்து முடிக்க',
    claimTask: 'ஏற்றுக்கொண்டு தொடங்கவும்',

    quickNote1: 'பிளாஸ்டிக் கழிவுகள் அகற்றப்பட்டன',
    quickNote2: 'கழிவு லாரியில் ஏற்றப்பட்டது',
    quickNote3: 'பகுதி முழுமையாக சுத்தம் செய்யப்பட்டது',

    historyTitle: 'சுத்தம் செய்த வரலாறு',
    historySubtitle: 'புகைப்பட சான்றுடன் சரிபார்க்கப்பட்ட பதிவுகள்',
    cleanedSites: 'சுத்தம் செய்த இடங்கள்',
    photoVerified: 'சரிபார்க்கப்பட்டது',
    complianceRate: 'சதவீதம்',
    beforeLitter: 'முன்பு (கழிவு)',
    afterCleaned: 'பின்பு (சுத்தம்)',
    cleanedBy: 'சுத்தம் செய்தவர்',

    noAvailableTasks: 'கழிவுகள் எதுவும் இல்லை',
    noAvailableTasksDesc: 'உங்கள் பகுதியில் உள்ள அனைத்து கழிவுகளும் சேகரிக்கப்பட்டுள்ளன.',
    noMyTasks: 'ஒதுக்கப்பட்ட பணிகள் எதுவும் இல்லை',
    noMyTasksDesc: '"கிடைக்கும் கழிவுகள்" தாவலில் இருந்து புதிய பணியை ஏற்கவும்.',
    noCompletedTasks: 'இன்று முடிக்கப்பட்ட பணிகள் இல்லை',
    noCompletedTasksDesc: 'நீங்கள் சான்றுகளை அனுப்பியதும் அவை இங்கே தோன்றும்.',

    successAlertTitle: 'பணி முடிந்தது! 🎉',
    successAlertMsg: 'புகைப்பட சான்று வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது.',
    photoRequiredTitle: 'புகைப்படம் தேவை',
    photoRequiredMsg: 'சுத்தம் செய்யப்பட்ட பகுதியின் புகைப்படத்தை எடுக்கவும் அல்லது பதிவேற்றவும்.',
  },

  en: {
    appTitle: 'CLEO Field Ops',
    appSubtitle: 'Sri Lanka Municipal Solid Waste Management',
    shiftActive: 'Active Shift',
    gpsConnected: 'GPS Connected',
    gpsLocating: 'Locating GPS...',
    gpsOff: 'GPS Disabled',
    switchWorker: 'Switch Worker / Unit',

    tabAvailable: 'Available Litter',
    tabMyTasks: 'My Active Tasks',
    tabDone: 'Completed Today',

    aiConfidence: 'AI Trash Match',
    distanceAway: 'away',
    directions: 'Directions',
    startTask: 'Start Task',
    submitProof: 'Submit Proof',
    viewProof: 'View Proof',
    noPhoto: 'No Photo Available',

    taskDetailTitle: 'Litter Collection Job',
    verificationTitle: 'Clean-up Verification',
    litterLocation: 'Litter Coordinates',
    openInMaps: 'Open in Maps ↗',
    reportedLitterPhoto: 'Reported Incident Photo',
    fusedTelemetry: 'GPS + IMU Geodesic Corrected Location',

    proofSectionTitle: 'Proof of Cleaning',
    proofInstructions:
      'Prove that the litter has been collected by capturing or uploading a photo of the cleared area.',
    takePhoto: '📷 Take Photo On-Site',
    uploadPhoto: '🖼️ Upload from Gallery',
    retakePhoto: 'Retake Photo',
    workNotesLabel: 'Work Notes (Optional):',
    workNotesPlaceholder: 'e.g. Collected 2 bags of plastic bottles, loaded onto truck...',
    submitAndComplete: '✓ Submit Proof & Finish Task',
    claimTask: 'Accept & Start Collection',

    quickNote1: 'Plastics & bottles cleared',
    quickNote2: 'Loaded into compactor truck',
    quickNote3: 'Pavement & drain swept clean',

    historyTitle: 'Collection History',
    historySubtitle: 'Municipal audited collections with photo proof',
    cleanedSites: 'Cleaned Sites',
    photoVerified: 'Verified Proof',
    complianceRate: 'Audit Rate',
    beforeLitter: 'Before (Reported)',
    afterCleaned: 'After (Cleaned)',
    cleanedBy: 'Collected by',

    noAvailableTasks: 'No Pending Litter in Area',
    noAvailableTasksDesc: 'All reported roadside incidents have been assigned or cleaned.',
    noMyTasks: 'No Active Tasks Assigned',
    noMyTasksDesc: 'Switch to the "Available" tab to pick up and start a new collection.',
    noCompletedTasks: 'No Collections Finished Today',
    noCompletedTasksDesc: 'Completed tasks with submitted proof photos will appear here.',

    successAlertTitle: 'Task Completed! 🎉',
    successAlertMsg: 'Proof photo uploaded and task verified in municipal database.',
    photoRequiredTitle: 'Photo Proof Required',
    photoRequiredMsg: 'Please take or upload a photo showing that the litter has been cleaned.',
  },
};

export function getI18n(lang: Language): I18nStrings {
  return strings[lang] || strings.bilingual;
}
