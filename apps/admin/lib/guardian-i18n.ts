export type GuardianLocale = "en" | "ur";

const ur: Record<string, string> = {
  Welcome: "خوش آمدید",
  Approved: "منظور شدہ",
  Device: "آلہ",
  Connectivity: "رابطہ",
  Access: "رسائی",
  Other: "دیگر",
  Online: "آن لائن",
  Offline: "آف لائن",
  "Needs attention": "توجہ درکار",
  Lost: "گمشدہ",
  "Not assigned": "تفویض نہیں کیا گیا",
  "Class mode": "کلاس موڈ",
  "After school": "اسکول کے بعد",
  "School and class modes always take precedence":
    "اسکول اور کلاس موڈ ہمیشہ مقدم رہتے ہیں",
  "Lost-device mode always takes precedence":
    "گمشدہ آلہ موڈ ہمیشہ مقدم رہتا ہے",
  "After-school control is off": "اسکول کے بعد کا کنٹرول بند ہے",
  "Guardian view": "سرپرست کا منظر",
  "Your family learning view": "آپ کے خاندان کی تعلیمی جھلک",
  "Linked-child information will appear after your school connects your account.":
    "اسکول کی جانب سے اکاؤنٹ منسلک ہونے کے بعد بچے کی معلومات یہاں ظاہر ہوں گی۔",
  "Guardian profile unavailable": "سرپرست کا پروفائل دستیاب نہیں",
  "Confirm that your sign-in email is linked to a student by your school.":
    "تصدیق کریں کہ اسکول نے آپ کا سائن اِن ای میل طالب علم سے منسلک کیا ہے۔",
  "No linked children": "کوئی منسلک بچہ نہیں",
  "Ask the school roster administrator to review your guardian link.":
    "اسکول کے روسٹر منتظم سے اپنے سرپرست لنک کا جائزہ لینے کو کہیں۔",
  "Family preferences": "خاندانی ترجیحات",
  "Consent and notifications": "رضامندی اور اطلاعات",
  Language: "زبان",
  "Save language": "زبان محفوظ کریں",
  "Required forms": "ضروری فارم",
  Accepted: "قبول شدہ",
  "Accept this version": "یہ ورژن قبول کریں",
  "No guardian forms are currently awaiting review.":
    "فی الحال سرپرست کے کسی فارم پر نظرِ ثانی باقی نہیں۔",
  "Notification channels": "اطلاع کے ذرائع",
  "Only contact methods registered with the school are available.":
    "صرف اسکول میں رجسٹرڈ رابطے کے ذرائع دستیاب ہیں۔",
  "Save notification channels": "اطلاع کے ذرائع محفوظ کریں",
  "Device availability": "آلے کی دستیابی",
  "Expected mode": "متوقع موڈ",
  "Based on school schedule and active class mode":
    "اسکول کے شیڈول اور فعال کلاس موڈ کی بنیاد پر",
  "School hours": "اسکول کے اوقات",
  "Scheduled blocks this week": "اس ہفتے کے مقررہ اوقات",
  "After-school learning choices": "اسکول کے بعد تعلیم کے انتخاب",
  "Enable after-school choices": "اسکول کے بعد کے انتخاب فعال کریں",
  "Daily limit (minutes)": "روزانہ حد (منٹ)",
  "School-approved apps": "اسکول سے منظور شدہ ایپس",
  "Save choices": "انتخاب محفوظ کریں",
  "Report a missing device": "گمشدہ آلے کی اطلاع دیں",
  "What happened?": "کیا ہوا؟",
  "Ask the school to start guarded lost-device mode now":
    "اسکول سے محفوظ گمشدہ آلہ موڈ شروع کرنے کو کہیں",
  "A high-priority school alert is always created. School and exam restrictions remain in control.":
    "اسکول کے لیے ہمیشہ اعلیٰ ترجیحی اطلاع بنائی جاتی ہے۔ اسکول اور امتحان کی پابندیاں برقرار رہتی ہیں۔",
  "Send report": "رپورٹ بھیجیں",
  "Recently approved learning access": "حال ہی میں منظور شدہ تعلیمی رسائی",
  "No recent approved access": "کوئی حالیہ منظور شدہ رسائی نہیں",
  "Teacher-approved resources and temporary websites will appear here without exposing browsing history.":
    "براؤزنگ ہسٹری ظاہر کیے بغیر استاد کے منظور شدہ وسائل اور عارضی ویب سائٹس یہاں نظر آئیں گی۔",
  "Request device support": "آلے کے لیے مدد طلب کریں",
  "Issue type": "مسئلے کی قسم",
  Subject: "عنوان",
  "What help is needed?": "کس مدد کی ضرورت ہے؟",
  "Open support request": "مدد کی درخواست کھولیں",
  "Active now during after-school mode.": "اسکول کے بعد کے موڈ میں اب فعال ہے۔",
  "Last seen": "آخری بار دیکھا گیا",
  "No check-in shared": "کوئی چیک اِن شیئر نہیں کیا گیا",
  "Scheduled blocks": "مقررہ اوقات",
};

export function guardianText(locale: GuardianLocale, english: string): string {
  return locale === "ur" ? (ur[english] ?? english) : english;
}
