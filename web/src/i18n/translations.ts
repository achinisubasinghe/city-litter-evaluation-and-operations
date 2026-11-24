import type { ZoneId } from "../constants/zones";

export type Language = "en" | "ta" | "si";

export interface LanguageOption {
  code: Language;
  label: string;
  nativeName: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "EN", nativeName: "English" },
  { code: "ta", label: "தமிழ்", nativeName: "Tamil" },
  { code: "si", label: "සිංහල", nativeName: "Sinhala" },
];

export interface DashboardTranslations {
  htmlLang: string;
  documentTitle: string;
  skipToContent: string;
  authorityBanner: string;
  liveTelemetry: string;
  residentBotLabel: string;
  brandSubtitle: string;
  heroSummary: string;
  languageSwitchLabel: string;

  navOverview: string;
  navAssignWorkers: string;
  backToOverview: string;

  zoneLabel: string;
  zones: Record<ZoneId, string>;

  kpiCleanedTitle: string;
  kpiCleanedRatioSuffix: string;
  kpiCleanedFoot: string;
  kpiTotalTitle: string;
  kpiTotalFoot: string;
  kpiPendingTitle: string;
  kpiPendingFoot: string;
  kpiInFieldTitle: string;
  kpiInFieldFoot: string;

  tabAll: string;
  tabPending: string;
  tabInProgress: string;
  tabResolved: string;
  tabRejected: string;

  searchPlaceholder: string;
  searchClear: string;

  confidenceMatchSuffix: string;
  statusPending: string;
  statusInField: string;
  statusCleaned: string;
  statusRejected: string;

  beforeLabel: string;
  afterProofLabel: string;
  noImage: string;
  noPhotoStored: string;
  noPhotoShort: string;

  gpsLocationLabel: string;
  imuCorrectedBadge: string;
  openMaps: string;
  telemetryDetailsToggle: string;
  offsetCorrectedLabel: string;
  vehicleSpeedLabel: string;
  reportSourceLabel: string;
  timestampLabel: string;
  assignedWorkerLabel: string;
  cleanedByLabel: string;

  setStatusLabel: string;
  actionAssignWorker: string;
  actionReassign: string;
  actionInField: string;
  actionApprove: string;
  actionReject: string;
  actionReset: string;

  emptyGlobalTitle: string;
  emptyGlobalDesc: string;
  emptyGlobalCta: string;
  emptyFilteredTitle: string;
  emptyFilteredDesc: string;
  emptyFilteredReset: string;

  assignTitle: string;
  assignSubtitle: string;
  assignTabPending: string;
  assignTabInProgress: string;
  assignTabActive: string;
  assignEmptyTitle: string;
  assignEmptyDesc: string;
  assignDefaultCaption: string;
  assignAssignedPrefix: string;
  assignSelectUnitAria: string;
  assignCustomOption: string;
  assignCustomIdPlaceholder: string;
  assignCustomNamePlaceholder: string;
  assignButtonAssign: string;
  assignButtonReassign: string;
  assignButtonBusy: string;
  assignBannerMissingName: string;
  assignBannerSuccess: string;
  assignBannerError: string;

  workerPresetUnitLabel: Record<string, string>;

  modalBeforeTitle: string;
  modalAfterTitle: string;
  modalReportedTitle: string;
  modalClose: string;
  modalCoordinatesPrefix: string;
  modalConfidencePrefix: string;
  modalResolvedByPrefix: string;
  modalFallbackWorker: string;
  modalBeforeAlt: string;
  modalAfterAlt: string;
  modalIncidentAlt: string;

  footerAuthority: string;
  footerTelemetry: string;
  footerIntake: string;
}

const TRANSLATIONS: Record<Language, DashboardTranslations> = {
  en: {
    htmlLang: "en",
    documentTitle: "CLEO — Sri Lanka Municipal Operations Hub",
    skipToContent: "Skip to main content",
    authorityBanner: "Democratic Socialist Republic of Sri Lanka — Solid Waste Operations",
    liveTelemetry: "Live telemetry",
    residentBotLabel: "Resident bot @fyp_qwerty_bot",
    brandSubtitle: "Municipal Operations Hub",
    heroSummary:
      "Roadside litter detection, edge telemetry, and sanitation dispatch across Sri Lanka.",
    languageSwitchLabel: "Select dashboard language",

    navOverview: "Operations overview",
    navAssignWorkers: "Assign workers",
    backToOverview: "Back to overview",

    zoneLabel: "Municipal council",
    zones: {
      all: "All municipal councils",
      "cmc-north": "Colombo MC — Fort & Colombo North",
      "cmc-cinnamon": "Colombo MC — Cinnamon Gardens & Borella",
      "cmc-south": "Colombo MC — Kollupitiya & Bambalapitiya",
      dmmc: "Dehiwala-Mount Lavinia MC",
      kmc: "Kaduwela Municipal Council",
      kandy: "Kandy Municipal Council",
      galle: "Galle Municipal Council",
    },

    kpiCleanedTitle: "Verified cleanups",
    kpiCleanedRatioSuffix: "cleared",
    kpiCleanedFoot: "Resolved with worker photo proof",
    kpiTotalTitle: "Incident streams",
    kpiTotalFoot: "Edge detections and citizen reports",
    kpiPendingTitle: "Pending collection",
    kpiPendingFoot: "Awaiting field truck dispatch",
    kpiInFieldTitle: "In field",
    kpiInFieldFoot: "Assigned to sanitation crews",

    tabAll: "All incidents",
    tabPending: "Pending",
    tabInProgress: "In progress",
    tabResolved: "Verified cleaned",
    tabRejected: "Rejected",

    searchPlaceholder: "Search incidents, worker, or ID...",
    searchClear: "Clear search",

    confidenceMatchSuffix: "% trash match",
    statusPending: "Pending",
    statusInField: "In field",
    statusCleaned: "Cleaned",
    statusRejected: "Rejected",

    beforeLabel: "Before",
    afterProofLabel: "After proof",
    noImage: "No image",
    noPhotoStored: "No photo stored",
    noPhotoShort: "No photo",

    gpsLocationLabel: "Ground coordinates",
    imuCorrectedBadge: "Fused IMU",
    openMaps: "Open maps",
    telemetryDetailsToggle: "IMU telemetry",
    offsetCorrectedLabel: "Offset corrected",
    vehicleSpeedLabel: "Vehicle speed",
    reportSourceLabel: "Report source",
    timestampLabel: "Logged",
    assignedWorkerLabel: "Assigned unit",
    cleanedByLabel: "Cleaned by",

    setStatusLabel: "Status",
    actionAssignWorker: "Assign",
    actionReassign: "Reassign",
    actionInField: "In field",
    actionApprove: "Approve",
    actionReject: "Reject",
    actionReset: "Reset",

    emptyGlobalTitle: "No incidents recorded yet",
    emptyGlobalDesc:
      "Incidents stream in automatically from edge camera trucks and resident submissions on Telegram.",
    emptyGlobalCta: "Open Resident Bot",
    emptyFilteredTitle: "No matching incidents",
    emptyFilteredDesc:
      "Try clearing the search term, switching status tabs, or selecting all municipal councils.",
    emptyFilteredReset: "Reset filters",

    assignTitle: "Worker dispatch & task assignment",
    assignSubtitle:
      "Assign roadside litter reports to municipal truck units or field teams. Assigned jobs sync directly to the worker mobile app.",
    assignTabPending: "Unassigned pending",
    assignTabInProgress: "In progress",
    assignTabActive: "All active",
    assignEmptyTitle: "No tasks in this dispatch queue",
    assignEmptyDesc: "All pending incidents in this view have been assigned or resolved.",
    assignDefaultCaption: "Roadside litter report",
    assignAssignedPrefix: "Assigned",
    assignSelectUnitAria: "Select worker unit for report",
    assignCustomOption: "+ Custom worker or unit...",
    assignCustomIdPlaceholder: "Worker ID (e.g. cmc-15)",
    assignCustomNamePlaceholder: "Worker or truck name",
    assignButtonAssign: "Assign task",
    assignButtonReassign: "Reassign",
    assignButtonBusy: "Assigning...",
    assignBannerMissingName: "Enter a worker or truck unit name before assigning.",
    assignBannerSuccess: "Task #{id} assigned to {worker}.",
    assignBannerError: "Unable to assign task. Please try again.",

    workerPresetUnitLabel: {
      "cmc-04": "CMC Unit 04 — Colombo North",
      "cmc-11": "CMC Unit 11 — Cinnamon Gardens",
      "kmc-02": "Kaduwela MC Unit 02",
      "dmmc-01": "Dehiwala-Mount Lavinia Unit 01",
      "gmc-01": "Kandy Municipal Council",
    },

    modalBeforeTitle: "Reported litter (before)",
    modalAfterTitle: "Verified cleanup proof (after)",
    modalReportedTitle: "Reported incident photo",
    modalClose: "Close preview",
    modalCoordinatesPrefix: "Coordinates",
    modalConfidencePrefix: "Confidence",
    modalResolvedByPrefix: "Resolved by",
    modalFallbackWorker: "Field worker",
    modalBeforeAlt: "Reported roadside litter before cleanup",
    modalAfterAlt: "Verified site photo after cleanup",
    modalIncidentAlt: "Reported waste incident",

    footerAuthority: "CLEO Municipal Waste Operations",
    footerTelemetry: "Live Convex telemetry sync",
    footerIntake: "Telegram & Edge IoT intake",
  },

  ta: {
    htmlLang: "ta",
    documentTitle: "CLEO — இலங்கை நகராட்சி செயல்பாட்டு மையம்",
    skipToContent: "முதன்மை உள்ளடக்கத்திற்குச் செல்லவும்",
    authorityBanner: "இலங்கை ஜனநாயக சோசலிச குடியரசு — திண்மக் கழிவு மேலாண்மை",
    liveTelemetry: "நேரடி தொலை அளவீடு",
    residentBotLabel: "குடியிருப்பாளர் பாட் @fyp_qwerty_bot",
    brandSubtitle: "நகராட்சி செயல்பாட்டு மையம்",
    heroSummary:
      "இலங்கை முழுவதும் சாலையோரக் கழிவு கண்டறிதல், சென்சார் தொலை அளவீடு மற்றும் சுகாதாரப் பணி ஒதுக்கீடு.",
    languageSwitchLabel: "முகப்பு மொழியைத் தேர்ந்தெடுக்கவும்",

    navOverview: "செயல்பாட்டு மேலோட்டம்",
    navAssignWorkers: "பணியாளர் ஒதுக்கீடு",
    backToOverview: "மேலோட்டத்திற்குத் திரும்புக",

    zoneLabel: "நகராட்சி சபை",
    zones: {
      all: "அனைத்து நகராட்சி சபைகள்",
      "cmc-north": "கொழும்பு மா.ச. — கோட்டை மற்றும் வடகொழும்பு",
      "cmc-cinnamon": "கொழும்பு மா.ச. — கறுவாத்தோட்டம் மற்றும் பொரளை",
      "cmc-south": "கொழும்பு மா.ச. — கொள்ளுப்பிட்டி மற்றும் பம்பலப்பிட்டி",
      dmmc: "தெஹிவளை-கல்கிசை மாநகர சபை",
      kmc: "கடுவெல மாநகர சபை",
      kandy: "கண்டி மாநகர சபை",
      galle: "காலி மாநகர சபை",
    },

    kpiCleanedTitle: "சரிபார்க்கப்பட்ட சுத்தம்",
    kpiCleanedRatioSuffix: "முடிக்கப்பட்டது",
    kpiCleanedFoot: "பணியாளர் புகைப்படச் சான்றுடன்",
    kpiTotalTitle: "மொத்த புகார் ஓடைகள்",
    kpiTotalFoot: "வாகனக் கேமரா மற்றும் குடியிருப்பாளர் புகார்கள்",
    kpiPendingTitle: "சேகரிப்பு நிலுவையில்",
    kpiPendingFoot: "கள வாகனம் அனுப்பக் காத்திருக்கிறது",
    kpiInFieldTitle: "களத்தில் உள்ளது",
    kpiInFieldFoot: "சுகாதாரக் குழுக்களுக்கு ஒதுக்கப்பட்டது",

    tabAll: "அனைத்து புகார்கள்",
    tabPending: "நிலுவையில்",
    tabInProgress: "செயல்பாட்டில்",
    tabResolved: "சுத்தம் செய்யப்பட்டது",
    tabRejected: "நிராகரிக்கப்பட்டது",

    searchPlaceholder: "புகார், பணியாளர், ID தேடுக...",
    searchClear: "தேடலை அழி",

    confidenceMatchSuffix: "% கழிவு பொருத்தம்",
    statusPending: "நிலுவையில்",
    statusInField: "களத்தில்",
    statusCleaned: "சுத்தம் செய்யப்பட்டது",
    statusRejected: "நிராகரிக்கப்பட்டது",

    beforeLabel: "முன்பு",
    afterProofLabel: "பின்பு சான்று",
    noImage: "படம் இல்லை",
    noPhotoStored: "புகைப்படம் சேமிக்கப்படவில்லை",
    noPhotoShort: "படம் இல்லை",

    gpsLocationLabel: "GPS இடம்",
    imuCorrectedBadge: "IMU திருத்தப்பட்டது",
    openMaps: "வரைபடத்தில் திற",
    telemetryDetailsToggle: "IMU அளவீட்டு விவரம்",
    offsetCorrectedLabel: "இடப்பெயர்ச்சி திருத்தம்",
    vehicleSpeedLabel: "வாகன வேகம்",
    reportSourceLabel: "புகார் மூலம்",
    timestampLabel: "பதிவான நேரம்",
    assignedWorkerLabel: "ஒதுக்கப்பட்ட பிரிவு",
    cleanedByLabel: "சுத்தம் செய்தவர்",

    setStatusLabel: "நிலை",
    actionAssignWorker: "ஒதுக்கு",
    actionReassign: "மறுஒதுக்கு",
    actionInField: "களத்தில்",
    actionApprove: "அங்கீகரி",
    actionReject: "நிராகரி",
    actionReset: "மீட்டமை",

    emptyGlobalTitle: "இதுவரை புகார்கள் எதுவும் பதிவாகவில்லை",
    emptyGlobalDesc:
      "எட்ஜ் கேமரா வாகனங்கள் மற்றும் Telegram வழியான குடியிருப்பாளர் புகார்கள் இங்கே தானாகத் தோன்றும்.",
    emptyGlobalCta: "குடியிருப்பாளர் பாட்டைத் திறக்கவும்",
    emptyFilteredTitle: "பொருந்தும் புகார்கள் இல்லை",
    emptyFilteredDesc:
      "தேடல் சொல்லை நீக்கவும், நிலைத் தாவலை மாற்றவும் அல்லது அனைத்து நகராட்சி சபைகளையும் தேர்ந்தெடுக்கவும்.",
    emptyFilteredReset: "வடிப்பான்களை மீட்டமை",

    assignTitle: "பணியாளர் மற்றும் வாகனப் பணி ஒதுக்கீடு",
    assignSubtitle:
      "நிலுவையில் உள்ள சாலையோரக் கழிவு புகார்களை நகராட்சி வாகனங்கள் அல்லது களக் குழுக்களுக்கு ஒதுக்கவும். ஒதுக்கப்பட்ட பணிகள் உடனடியாக பணியாளர் செயலியில் தோன்றும்.",
    assignTabPending: "ஒதுக்கப்படாதவை",
    assignTabInProgress: "செயல்பாட்டில் உள்ளவை",
    assignTabActive: "அனைத்து செயல் பணிகள்",
    assignEmptyTitle: "இந்த வரிசையில் பணிகள் எதுவும் இல்லை",
    assignEmptyDesc: "இந்தப் பிரிவில் உள்ள அனைத்துப் புகார்களும் ஒதுக்கப்பட்டு அல்லது முடிக்கப்பட்டுவிட்டன.",
    assignDefaultCaption: "சாலையோரக் கழிவு புகார்",
    assignAssignedPrefix: "ஒதுக்கப்பட்டது",
    assignSelectUnitAria: "புகாருக்கான பணியாளர் பிரிவைத் தேர்ந்தெடுக்கவும்",
    assignCustomOption: "+ தனிப்பயன் பணியாளர் / வாகனம்...",
    assignCustomIdPlaceholder: "பணியாளர் ID (எ.கா. cmc-15)",
    assignCustomNamePlaceholder: "பணியாளர் அல்லது வாகனப் பெயர்",
    assignButtonAssign: "பணி ஒதுக்கு",
    assignButtonReassign: "மறுஒதுக்கு",
    assignButtonBusy: "ஒதுக்குகிறது...",
    assignBannerMissingName: "ஒதுக்குவதற்கு முன் பணியாளர் அல்லது வாகனப் பெயரை உள்ளிடவும்.",
    assignBannerSuccess: "பணி #{id} வெற்றிகரமாக {worker} பிரிவிற்கு ஒதுக்கப்பட்டது.",
    assignBannerError: "பணியை ஒதுக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",

    workerPresetUnitLabel: {
      "cmc-04": "கொழும்பு மா.ச. பிரிவு 04 — வடகொழும்பு",
      "cmc-11": "கொழும்பு மா.ச. பிரிவு 11 — கறுவாத்தோட்டம்",
      "kmc-02": "கடுவெல மா.ச. பிரிவு 02",
      "dmmc-01": "தெஹிவளை-கல்கிசை பிரிவு 01",
      "gmc-01": "கண்டி மாநகர சபை",
    },

    modalBeforeTitle: "புகாரளிக்கப்பட்ட கழிவு (முன்பு)",
    modalAfterTitle: "சரிபார்க்கப்பட்ட சுத்தம் (பின்பு)",
    modalReportedTitle: "புகாரளிக்கப்பட்ட சம்பவப் படம்",
    modalClose: "முன்னோட்டத்தை மூடு",
    modalCoordinatesPrefix: "ஆயத்தொலைவுகள்",
    modalConfidencePrefix: "நம்பகத்தன்மை",
    modalResolvedByPrefix: "சுத்தம் செய்தவர்",
    modalFallbackWorker: "களப் பணியாளர்",
    modalBeforeAlt: "சுத்தம் செய்வதற்கு முன் சாலையோரக் கழிவு",
    modalAfterAlt: "சுத்தம் செய்த பிறகு சரிபார்க்கப்பட்ட இடம்",
    modalIncidentAlt: "புகாரளிக்கப்பட்ட கழிவு சம்பவம்",

    footerAuthority: "CLEO நகராட்சி திண்மக் கழிவு மேலாண்மை",
    footerTelemetry: "நேரடி Convex தொலை அளவீடு",
    footerIntake: "Telegram மற்றும் Edge IoT இணைப்பு",
  },

  si: {
    htmlLang: "si",
    documentTitle: "CLEO — ශ්‍රී ලංකා නගර සභා මෙහෙයුම් මධ්‍යස්ථානය",
    skipToContent: "ප්‍රධාන අන්තර්ගතයට යන්න",
    authorityBanner: "ශ්‍රී ලංකා ප්‍රජාතාන්ත්‍රික සමාජවාදී ජනරජය — ඝන අපද්‍රව්‍ය මෙහෙයුම්",
    liveTelemetry: "සජීවී දත්ත සම්බන්ධයි",
    residentBotLabel: "පුරවැසි බොට් @fyp_qwerty_bot",
    brandSubtitle: "නගර සභා මෙහෙයුම් මධ්‍යස්ථානය",
    heroSummary:
      "ශ්‍රී ලංකාව පුරා මාර්ග අසල කසළ හඳුනාගැනීම, දුරස්ථ දත්ත නිරීක්ෂණය සහ පවිත්‍රතා කණ්ඩායම් යෙදවීම.",
    languageSwitchLabel: "පුවරු භාෂාව තෝරන්න",

    navOverview: "සමස්ත දැක්ම",
    navAssignWorkers: "සේවකයින් යොදවන්න",
    backToOverview: "සමස්ත දැක්මට ආපසු",

    zoneLabel: "පළාත් පාලන ආයතනය",
    zones: {
      all: "සියලු පළාත් පාලන ආයතන",
      "cmc-north": "කොළඹ ම.න.ස. — කොටුව සහ උතුර",
      "cmc-cinnamon": "කොළඹ ම.න.ස. — කුරුඳු වත්ත සහ බොරැල්ල",
      "cmc-south": "කොළඹ ම.න.ස. — කොල්ලුපිටිය සහ බම්බලපිටිය",
      dmmc: "දෙහිවල-ගල්කිස්ස මහ නගර සභාව",
      kmc: "කඩුවෙල මහ නගර සභාව",
      kandy: "මහනුවර මහ නගර සභාව",
      galle: "ගාල්ල මහ නගර සභාව",
    },

    kpiCleanedTitle: "තහවුරු කළ පිරිසිදු කිරීම්",
    kpiCleanedRatioSuffix: "සම්පූර්ණයි",
    kpiCleanedFoot: "සේවක ඡායාරූප සාක්ෂි සහිතව",
    kpiTotalTitle: "මුළු සිදුවීම් ප්‍රවාහය",
    kpiTotalFoot: "ලොරි කැමරා සහ පුරවැසි වාර්තා",
    kpiPendingTitle: "එකතු කිරීමට පොරොත්තු",
    kpiPendingFoot: "ක්ෂේත්‍ර රථ යෙදවීමට අපේක්ෂිතයි",
    kpiInFieldTitle: "ක්ෂේත්‍රයේ ක්‍රියාත්මක",
    kpiInFieldFoot: "පවිත්‍රතා කණ්ඩායම් වෙත පවරා ඇත",

    tabAll: "සියලු සිදුවීම්",
    tabPending: "පොරොත්තු",
    tabInProgress: "ක්‍රියාත්මක",
    tabResolved: "පිරිසිදු කළ",
    tabRejected: "ප්‍රතික්ෂේප කළ",

    searchPlaceholder: "සිදුවීම්, සේවක හෝ ID සොයන්න...",
    searchClear: "සෙවුම මකන්න",

    confidenceMatchSuffix: "% කසළ ගැළපීම",
    statusPending: "පොරොත්තු",
    statusInField: "ක්ෂේත්‍රයේ",
    statusCleaned: "පිරිසිදු කළා",
    statusRejected: "ප්‍රතික්ෂේප කළා",

    beforeLabel: "පෙර",
    afterProofLabel: "පසු සාක්ෂිය",
    noImage: "රූපයක් නැත",
    noPhotoStored: "ඡායාරූපයක් ගබඩා කර නැත",
    noPhotoShort: "ඡායාරූප නැත",

    gpsLocationLabel: "භූමි GPS ඛණ්ඩාංක",
    imuCorrectedBadge: "IMU නිවැරදි කළ",
    openMaps: "සිතියමේ බලන්න",
    telemetryDetailsToggle: "IMU දත්ත විස්තර",
    offsetCorrectedLabel: "දුරස්ථ නිවැරදි කිරීම",
    vehicleSpeedLabel: "වාහන වේගය",
    reportSourceLabel: "වාර්තා මූලාශ්‍රය",
    timestampLabel: "වාර්තා වූ වේලාව",
    assignedWorkerLabel: "පැවරූ ඒකකය",
    cleanedByLabel: "පිරිසිදු කළේ",

    setStatusLabel: "තත්ත්වය",
    actionAssignWorker: "පවරන්න",
    actionReassign: "නැවත පවරන්න",
    actionInField: "ක්ෂේත්‍රයේ",
    actionApprove: "අනුමත කරන්න",
    actionReject: "ප්‍රතික්ෂේප කරන්න",
    actionReset: "මුල් තත්ත්වයට",

    emptyGlobalTitle: "තවමත් සිදුවීම් වාර්තා වී නැත",
    emptyGlobalDesc:
      "කැමරා රථවලින් සහ Telegram ඔස්සේ ලැබෙන පුරවැසි වාර්තා මෙහි ස්වයංක්‍රීයව දිස්වේ.",
    emptyGlobalCta: "පුරවැසි බොට් විවෘත කරන්න",
    emptyFilteredTitle: "ගැළපෙන සිදුවීම් නොමැත",
    emptyFilteredDesc:
      "සෙවුම් පදය ඉවත් කරන්න, තත්ත්ව පටිත්ත මාරු කරන්න, නැතහොත් සියලු පළාත් පාලන ආයතන තෝරන්න.",
    emptyFilteredReset: "පෙරහන් යළි සකසන්න",

    assignTitle: "සේවකයින් යෙදවීම සහ කාර්ය පැවරීම",
    assignSubtitle:
      "මාර්ග අසල කසළ වාර්තා නගර සභා රථ ඒකක හෝ ක්ෂේත්‍ර කණ්ඩායම් වෙත පවරන්න. පවරන ලද කාර්යයන් සේවක ජංගම යෙදුමේ ක්ෂණිකව දිස්වේ.",
    assignTabPending: "නොපැවරූ පොරොත්තු",
    assignTabInProgress: "ක්‍රියාත්මක කාර්යයන්",
    assignTabActive: "සියලු සක්‍රීය කාර්යයන්",
    assignEmptyTitle: "මෙම පෝලිමේ කාර්යයන් නොමැත",
    assignEmptyDesc: "මෙම දර්ශනයේ සියලු පොරොත්තු සිදුවීම් පවරා හෝ විසඳා ඇත.",
    assignDefaultCaption: "මාර්ග අසල කසළ වාර්තාව",
    assignAssignedPrefix: "පවරා ඇත",
    assignSelectUnitAria: "වාර්තාව සඳහා සේවක ඒකකය තෝරන්න",
    assignCustomOption: "+ වෙනත් සේවකයෙකු හෝ ඒකකයක්...",
    assignCustomIdPlaceholder: "සේවක ID (උදා. cmc-15)",
    assignCustomNamePlaceholder: "සේවක හෝ රථ නාමය",
    assignButtonAssign: "කාර්යය පවරන්න",
    assignButtonReassign: "නැවත පවරන්න",
    assignButtonBusy: "පවරමින්...",
    assignBannerMissingName: "පැවරීමට පෙර සේවකයෙකුගේ හෝ රථ ඒකකයක නමක් ඇතුළත් කරන්න.",
    assignBannerSuccess: "කාර්යය #{id} {worker} වෙත පවරන ලදී.",
    assignBannerError: "කාර්යය පැවරීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.",

    workerPresetUnitLabel: {
      "cmc-04": "කොළඹ ම.න.ස. ඒකක 04 — කොළඹ උතුර",
      "cmc-11": "කොළඹ ම.න.ස. ඒකක 11 — කුරුඳු වත්ත",
      "kmc-02": "කඩුවෙල ම.න.ස. ඒකක 02",
      "dmmc-01": "දෙහිවල-ගල්කිස්ස ඒකක 01",
      "gmc-01": "මහනුවර මහ නගර සභාව",
    },

    modalBeforeTitle: "වාර්තා වූ කසළ (පෙර)",
    modalAfterTitle: "තහවුරු කළ පිරිසිදු කිරීම (පසු)",
    modalReportedTitle: "වාර්තා වූ සිදුවීම් ඡායාරූපය",
    modalClose: "පෙරදසුන වසන්න",
    modalCoordinatesPrefix: "ඛණ්ඩාංක",
    modalConfidencePrefix: "විශ්වසනීයත්වය",
    modalResolvedByPrefix: "පිරිසිදු කළේ",
    modalFallbackWorker: "ක්ෂේත්‍ර සේවකයා",
    modalBeforeAlt: "පිරිසිදු කිරීමට පෙර මාර්ග අසල කසළ",
    modalAfterAlt: "පිරිසිදු කිරීමෙන් පසු තහවුරු කළ ස්ථානය",
    modalIncidentAlt: "වාර්තා වූ අපද්‍රව්‍ය සිදුවීම",

    footerAuthority: "CLEO නගර සභා ඝන අපද්‍රව්‍ය මෙහෙයුම්",
    footerTelemetry: "සජීවී Convex දත්ත සමමුහුර්තකරණය",
    footerIntake: "Telegram සහ Edge IoT සම්බන්ධතාවය",
  },
};

const DATE_LOCALE_MAP: Record<Language, string> = {
  en: "en-LK",
  ta: "ta-LK",
  si: "si-LK",
};

export function getTranslations(lang: Language): DashboardTranslations {
  return TRANSLATIONS[lang] ?? TRANSLATIONS.en;
}

export function formatReportTimestamp(timestamp: number, lang: Language): string {
  try {
    return new Date(timestamp).toLocaleString(DATE_LOCALE_MAP[lang], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(timestamp).toLocaleString("en-LK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
}

export function formatTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    template
  );
}
