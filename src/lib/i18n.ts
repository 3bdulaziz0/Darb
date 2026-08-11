/**
 * OWNER: teammate C (T-18).
 *
 * DONE:  the language store, the RTL switch, and every interface string in
 *        both languages.
 * TODO:  nothing structural. To add a string, add it to BOTH objects below —
 *        TypeScript will not let you add it to one and forget the other.
 *
 * ── The one rule here ──────────────────────────────────────────────────────
 * This file holds INTERFACE text only: labels, buttons, status messages.
 *
 * It must never hold a landmark name, a date, a description, or anything else
 * that makes a claim about a place. Those live in landmarks.json with their
 * sources, and they are not translated by us — a fact we do not have in a
 * language is labelled "translation pending", never invented. See WORKING-AGREEMENT.md.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext } from 'react';
import type { Lang } from './types';

/** Arabic is the product's primary content language, so it is the default. */
export const DEFAULT_LANG: Lang = 'ar';

const KEY = 'darb:lang';

export function readStoredLang(): Lang {
  try {
    const stored = sessionStorage.getItem(KEY);
    return stored === 'ar' || stored === 'en' ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function storeLang(lang: Lang): void {
  try {
    sessionStorage.setItem(KEY, lang);
  } catch {
    // Private browsing. The choice just will not survive a reload.
  }
}

/**
 * Applies the language to the document itself.
 *
 * Setting `dir` here is the whole of RTL support. Every component uses logical
 * properties (ps-/pe-/ms-/me-/start-/end-), so the layout mirrors on its own.
 * If a screen looks wrong in Arabic, it used a physical property somewhere.
 */
export function applyLangToDocument(lang: Lang): void {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

// ── Strings ─────────────────────────────────────────────────────────────────

const en = {
  // Camera
  pointAtLandmark: 'Point at a landmark',
  locating: 'Locating…',
  locationOff: 'Location off',
  noFix: 'No fix',
  capture: 'Capture',
  settings: 'Settings',
  discoverNearby: 'Discover landmarks nearby',
  camera: 'Camera',

  // Camera repair
  cameraBlockedTitle: 'Camera access is blocked',
  cameraBlockedBody:
    'Allow camera access for this site in your browser settings, then reload. You can also pick a photo instead.',
  cameraNoneTitle: 'No camera found',
  cameraNoneBody: 'This device has no camera we can use. Pick a photo instead.',
  cameraInsecureTitle: 'This page is not secure',
  cameraInsecureBody:
    'Cameras only work over HTTPS. Open the preview URL rather than the local network address. You can still pick a photo.',
  cameraErrorTitle: 'The camera could not start',
  cameraErrorBody: 'Something went wrong.',
  choosePhoto: 'Choose a photo',

  // Status
  identifying: 'Identifying…',
  stageLocating: 'Locating you',
  stageMatching: 'Matching landmark',
  stageFetching: 'Fetching the story',
  cancel: 'Cancel',

  // Story
  loading: 'Loading…',
  notInLibrary: 'That landmark is not in our library.',
  backToCamera: 'Back to camera',
  overview: 'Overview',
  voice: 'Voice',
  nearby: 'Nearby',
  askAboutPlace: 'Ask about this place…',
  translationPending: 'Translation pending',
  back: 'Back',
  listen: 'Listen',
  stopListening: 'Stop',
  thinking: 'Reading our sources…',
  notInOurSources:
    'Our sources do not cover that. I will not answer it from anywhere else.',
  askFailed: 'That did not go through. Try again.',
  answerFrom: 'Answered from',
  fromOutsideLibrary: 'Not in our library — found in trusted sources',
  webSourceCaution:
    'We did not curate this. Check the source before you rely on it.',
  searchUnavailable:
    'Our sources do not cover it, and I could not search right now. I would rather say that than guess.',
  preparingAudio: 'Preparing the voice…',
  deviceVoice: 'Device voice',

  // Honest mode
  dontRecogniseTitle: 'I don’t recognise this building',
  dontRecogniseBody: 'It’s not in our verified library, so I won’t guess its story.',
  butICanSee: 'But here’s what I can see',
  explain: 'Explain',
  browseNearby: 'Browse nearby landmarks',
  retakePhoto: 'Retake photo',

  // Discovery
  mapPlaceholder: 'Map placeholder',
  searchRadius: 'Search radius',
  filterByCategory: 'Filter by category',
  all: 'All',
  showMore: 'Show more',
  showAllCategories: 'Show all categories',
  showEveryLandmark: 'Show every landmark',
  noneInLibrary: 'in the library',

  // Settings
  language: 'Language',
  narrationVoice: 'Narration voice',
  readingSpeed: 'Reading speed',
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
  permissions: 'Camera and location permissions',
};

/** Same keys, in Arabic. TypeScript enforces that they match exactly. */
const ar: Record<keyof typeof en, string> = {
  // Camera
  pointAtLandmark: 'وجّه الكاميرا نحو المعلم',
  locating: 'جارٍ تحديد الموقع…',
  locationOff: 'الموقع غير مفعّل',
  noFix: 'تعذّر تحديد الموقع',
  capture: 'التقاط',
  settings: 'الإعدادات',
  discoverNearby: 'استكشف المعالم القريبة',
  camera: 'الكاميرا',

  // Camera repair
  cameraBlockedTitle: 'الوصول إلى الكاميرا محظور',
  cameraBlockedBody:
    'اسمح بالوصول إلى الكاميرا لهذا الموقع من إعدادات المتصفح، ثم أعد تحميل الصفحة. أو اختر صورة من جهازك.',
  cameraNoneTitle: 'لم يتم العثور على كاميرا',
  cameraNoneBody: 'لا توجد كاميرا متاحة على هذا الجهاز. اختر صورة بدلاً من ذلك.',
  cameraInsecureTitle: 'هذه الصفحة غير آمنة',
  cameraInsecureBody:
    'الكاميرا تعمل عبر HTTPS فقط. افتح رابط المعاينة بدل عنوان الشبكة المحلية. ويمكنك اختيار صورة على أي حال.',
  cameraErrorTitle: 'تعذّر تشغيل الكاميرا',
  cameraErrorBody: 'حدث خطأ ما.',
  choosePhoto: 'اختر صورة',

  // Status
  identifying: 'جارٍ التعرّف...',
  stageLocating: 'تحديد موقعك',
  stageMatching: 'مطابقة المعلم',
  stageFetching: 'جلب القصة',
  cancel: 'إلغاء',

  // Story
  loading: 'جارٍ التحميل…',
  notInLibrary: 'هذا المعلم غير موجود في مكتبتنا.',
  backToCamera: 'العودة إلى الكاميرا',
  overview: 'نبذة',
  voice: 'الصوت',
  nearby: 'قريب منك',
  askAboutPlace: 'اسأل عن هذا المكان…',
  translationPending: 'الترجمة قيد الإعداد',
  back: 'رجوع',
  listen: 'استمع',
  stopListening: 'إيقاف',
  thinking: 'أقرأ مصادرنا…',
  notInOurSources: 'مصادرنا لا تغطّي هذا السؤال، ولن أجيب عليه من مكان آخر.',
  askFailed: 'لم تكتمل العملية. حاول مرة أخرى.',
  answerFrom: 'الإجابة مأخوذة من',
  fromOutsideLibrary: 'ليست في مكتبتنا — وجدتها في مصادر موثوقة',
  webSourceCaution: 'هذه لم نراجعها بأنفسنا. تحقّق من المصدر قبل الاعتماد عليها.',
  searchUnavailable:
    'مصادرنا لا تغطّي هذا، وتعذّر عليّ البحث الآن. أفضّل أن أقول ذلك على أن أخمّن.',
  preparingAudio: 'يُجهَّز الصوت…',
  deviceVoice: 'صوت الجهاز',

  // Honest mode
  dontRecogniseTitle: 'لا أعرف هذا المبنى',
  dontRecogniseBody: 'ليس ضمن مكتبتنا الموثّقة، ولن أخمّن قصته.',
  butICanSee: 'لكن هذا ما أستطيع رؤيته',
  explain: 'اشرح',
  browseNearby: 'تصفّح المعالم القريبة',
  retakePhoto: 'إعادة التقاط الصورة',

  // Discovery
  mapPlaceholder: 'خريطة مؤقتة',
  searchRadius: 'نطاق البحث',
  filterByCategory: 'تصفية حسب التصنيف',
  all: 'الكل',
  showMore: 'عرض المزيد',
  showAllCategories: 'عرض كل التصنيفات',
  showEveryLandmark: 'عرض كل المعالم',
  noneInLibrary: 'في المكتبة',

  // Settings
  language: 'اللغة',
  narrationVoice: 'صوت السرد',
  readingSpeed: 'سرعة القراءة',
  slow: 'بطيء',
  normal: 'عادي',
  fast: 'سريع',
  permissions: 'أذونات الكاميرا والموقع',
};

export type UIKey = keyof typeof en;

export const STRINGS: Record<Lang, Record<UIKey, string>> = { ar, en };

// ── Context ─────────────────────────────────────────────────────────────────

export interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Interface string in the active language. */
  t: (key: UIKey) => string;
}

export const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => undefined,
  t: (key) => STRINGS[DEFAULT_LANG][key],
});

/**
 * The active language and its strings.
 *
 *   const { t, lang, setLang } = useLang();
 *   <p>{t('pointAtLandmark')}</p>
 */
export function useLang(): LangContextValue {
  return useContext(LangContext);
}

// ── Numbers ─────────────────────────────────────────────────────────────────

/** "610 م" / "610 M" — the unit follows the interface language. */
export function distanceUnit(km: number, lang: Lang): string {
  if (lang === 'ar') return km < 1 ? 'م' : 'كم';
  return km < 1 ? 'M' : 'KM';
}
