/* Chatora — workspace dashboard. Real data, RLS-scoped to the signed-in user. */
(function () {
  const A = window.CHATORA_AUTH;
  function resolveLocale() {
    const supported = window.CHATORA_AVAILABLE_LANGS || ["en", "ar"];
    const pathMatch = location.pathname.match(/^\/(ar|es|fr|de|pt)(?:\/|$)/i);
    const pathLang = pathMatch ? pathMatch[1].toLowerCase() : "";
    if (pathLang && supported.indexOf(pathLang) !== -1) return pathLang;
    const urlLang = new URLSearchParams(location.search).get("lang");
    if (urlLang && supported.indexOf(urlLang) !== -1) return urlLang;
    const documentLang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    return supported.indexOf(documentLang) !== -1 ? documentLang : "en";
  }
  const LANG = resolveLocale();
  const AR = LANG === "ar";
  const APP_LOCALE = ({ en: "en-US", ar: "ar-EG", es: "es", fr: "fr", de: "de", pt: "pt" })[LANG] || "en-US";
  const RELATIVE = new Intl.RelativeTimeFormat(APP_LOCALE, { numeric: "auto" });

  const T = {
    en: {
      overview: "Overview", inbox: "Inbox", flows: "Flows", contacts: "Contacts", broadcast: "Broadcast", settings: "Settings",
      metaTitle: "Meta messaging channels", metaSummary: "Connect official WhatsApp Cloud API or linked-Page Instagram Messaging. Tokens are stored encrypted on the server; no message is sent by connecting.",
      channelInstagram: "Instagram", channelWhatsapp: "WhatsApp", channelTiktok: "TikTok", channelMessenger: "Messenger", channelTelegram: "Telegram", channelSms: "SMS", channelEmail: "Email", channelWeb: "Web chat",
      of: "/ {n}", pickConversation: "Pick a conversation from the list", csvFileHint: "CSV file up to 2 MB", dataIsolation: "Your data is fully isolated (RLS)",
      tplDraftMessage: "Draft message for “{name}” — edit this text before use. Nothing is sent from this preview.",
      tplDraftFollowup: "Draft follow-up — review timing, consent and channel rules before any real use.",
      tplDraftCondition: "Placeholder condition — configure for this workflow.", tplSuggestedTag: "Suggested tag: {cat}",
      metaReadiness: "Meta setup readiness", metaAppIdLabel: "Meta App ID", metaWaConfigLabel: "WhatsApp Embedded Signup v4 Config ID", metaIgConfigLabel: "Instagram Facebook Login for Business Config ID",
      metaConfigured: "Ready", metaMissing: "Missing", metaPublicIdsNote: "Add the three public IDs in assets/js/config.js. App Secret and access tokens must stay server-side.",
      metaServerApprovalNote: "This checklist checks browser-visible values only. It cannot verify Meta approval or server-side settings.",
      metaWhatsapp: "WhatsApp Cloud API", metaInstagram: "Instagram Messaging",
      metaWaHelp: "Connect a customer-owned WhatsApp Business Account through Meta Embedded Signup v4. Meta Tech Provider or Solution Partner approval is required for multi-tenant onboarding.",
      metaIgHelp: "Connect an Instagram Professional account already linked to a Facebook Page. The Facebook Login for Business configuration must request the required messaging permissions.",
      metaConnect: "Connect with Meta", metaReconnect: "Reconnect with Meta", metaPinLabel: "Six-digit WhatsApp two-step PIN",
      metaPinHint: "Sent to Meta to register this phone number; Chatora does not save the PIN.", metaCurrency: "Business billing currency",
      metaChooseCurrency: "Choose a currency…", metaTechProvider: "Tech Provider setup", metaSolutionPartner: "Solution Partner setup",
      metaCurrencyHint: "Meta's Solution Partner credit-sharing endpoint lists AUD, EUR, GBP, IDR, INR, and USD. Select the customer's actual business currency; no default is assumed.",
      metaProviderUnselected: "Set the WhatsApp provider type to Tech Provider or Solution Partner before enabling this flow.",
      metaConfigPending: "Meta onboarding is not configured or enabled yet. No connection was started.",
      metaMigrationPending: "Could not read channel setup. Confirm that the local migration is applied and the database is reachable before connecting an account.",
      metaLoad: "Checking channel connections…", metaNone: "Not connected", metaConnected: "Connected",
      metaWorking: "Connecting…", metaSuccess: "Channel connected successfully.", metaNoPages: "No eligible Page with a linked Instagram Professional account was found.",
      metaChoosePage: "Choose the Facebook Page linked to the Instagram account…", metaFinishPage: "Finish Instagram connection",
      metaNeedPin: "Enter a six-digit PIN before continuing.", metaNeedCurrency: "Choose the business currency required for the Solution Partner credit line.",
      metaPhoneRequired: "The signup did not return a business phone number. Add or choose a Cloud API phone number, then try again.",
      metaCancelled: "Meta setup was cancelled. No channel was connected.", metaFailed: "Could not complete Meta setup. Check the app configuration and try again.",
      metaSelectPage: "Choose the Page that owns the Instagram Professional account. No token is shown in the browser.",
      crumb: "Workspace", loading: "Opening your workspace…", error: "Something went wrong loading your workspace.",
      retry: "Try again", signout: "Sign out", build: "Open the builder",
      kContacts: "Active contacts", kFlows: "Live flows", kOpen: "Open conversations", kRuns: "Flow runs this month",
      runsBy: "Runs by flow", channels: "Contacts by channel", recent: "Latest conversations",
      noData: "Nothing here yet.", emptyInbox: "No conversations match this filter.", inboxEmpty: "No conversations yet. Connect a messaging channel to receive messages.",
      channelPending: "Connect an official messaging channel before replying or starting conversations. No outgoing message has been sent.",
      sendNeedsMeta: "Connect this WhatsApp or Instagram channel in Settings before replying.",
      sendFeatureOff: "Replies are not enabled in this workspace yet. No message was sent.",
      sendSuccess: "Message sent.", sendBusy: "Sending…", sendRetry: "Retry safely", sendRetryNotice: "No automatic repeat was made. Retry uses the same idempotency key.", sendUnknown: "Delivery status is uncertain. Do not resend until you verify it in the connected channel.",
      sendWindow: "Meta's 24-hour reply window has expired or cannot be verified; no message was sent.",
      sendError: "Could not send the reply. Check the connection and try again.", sendTooLong: "Message is too long. Maximum 1,000 UTF-8 bytes.",
      sendStatusSending: "Sending", sendStatusSent: "Sent", sendStatusDelivered: "Delivered", sendStatusRead: "Read", sendStatusFailed: "Failed", sendStatusUnknown: "Status unknown",
      flowPending: "Flows stay as drafts until a real messaging channel and automation are connected.",
      send: "Send", typeMsg: "Write a reply…", aiPaused: "Waiting for a channel connection", humanMode: "Assigned to a person",
      takeOver: "Take over", giveBack: "Hand back to AI", close: "Close", reopen: "Reopen",
      newFlow: "New flow", pickTemplate: "Start from a template", cancel: "Cancel",
      live: "Live", paused: "Paused", draft: "Draft", runs: "runs", pause: "Pause", resume: "Resume",
      search: "Search contacts…", tags: "Tags", lastSeen: "Last seen", handle: "Handle", channel: "Channel",
      wsName: "Workspace name", save: "Save", saved: "Saved", plan: "Plan", planLabel: "Preview · no billing", account: "Signed in as",
      session: "Session", signoutLong: "Sign out of this browser",
      planFree: "Preview · no billing", planNote: "No paid subscription plan or checkout is available in this preview.",
      tpl1: "Comment → DM (price request)", tpl2: "Abandoned cart · 3 messages", tpl3: "COD confirmation",
      created: "Flow created", noSession: "Please sign in again.",
      agents: "AI agent", you: "You", customer: "Customer",
      fAll: "All", fOpen: "Open", fMine: "Mine", fClosed: "Closed", sInbox: "Search conversations…",
      edit: "Edit", editor: "Flow editor", back: "Back", steps: "Steps", addStep: "Add a step",
      sMsg: "Message", sDelay: "Delay", sCond: "Condition", sTag: "Tag", sTrigger: "Trigger",
      sMsgPh: "Draft message text", sDelayPh: "Minutes to wait", sCondPh: "e.g. asks about price",
      sTagPh: "tag to add", stepUp: "Move up", stepDown: "Move down", stepDel: "Delete step",
      savedFlow: "Flow saved", deleteFlow: "Delete this flow", confirmDelete: "Delete this flow and its steps?",
      noSteps: "No steps yet — add the first one below.", flowName: "Flow name",
      pwdTitle: "Password", pwNew: "New password", pwSave: "Change password", pwOk: "Password changed.",
      pwShort: "At least 6 characters.", exportTitle: "Your data", exportBtn: "Download a JSON copy",
      emptyWs: "Empty workspace — no demo records are added. Import real contacts or create your first flow.",
      newContact: "New contact", editContact: "Edit contact", contactName: "Name", tagsPh: "vip, reorder", cMore: "Load more", cShowing: "Showing {n} of {total}",
      cExport: "Export CSV", cExported: "CSV downloaded: {n} contacts.", cExportEmpty: "No contacts match this search.",
      deleteContact: "Delete", confirmContact: "Delete this contact and its conversations?",
      emptyContacts: "No contacts yet — import real contacts or add the first one.", message: "Channel not connected",
      obTitle: "Finish setting up", ob1: "Name your workspace", ob2: "Create a flow draft with real steps",
      ob3: "Import your real contacts", obHide: "Hide for now", obDone: "Workspace setup is ready — connect a channel before sending.",
      obGo: "Open",
      bcTitle: "Broadcast", bcNote: "Sending is disabled until an official channel is connected. This audience preview does not send messages or create conversation history.",
      bcName: "Campaign name", bcAll: "All contacts", bcTag: "Only this tag (optional)",
      bcBody: "Message", bcBodyPh: "Write a message to preview it…",
      bcAudience: "recipients", bcSend: "Connect a channel to send", bcPreview: "Preview",
      bcEmpty: "No contacts match this audience yet.", bcHistory: "Sent broadcasts",
      bcNoHist: "No broadcasts have been sent from this workspace yet.",
      bcAll8: "All channels", bcOneEach: "One conversation each",
      testRun: "Test this flow", testTitle: "Test run", testNote: "Nothing is sent to a channel — this only plays the steps.",
      testClose: "Close", testDone: "End of flow", testWait: "wait", testMin: "min", testTyping: "Previewing step…", testRole: "Local preview",
      testReplay: "Replay", testAuto: "Plays automatically · nothing leaves the browser",
      gTitle: "Start from a template", gNote: "45 illustrative workflow ideas. Choosing one creates an editable draft with generic placeholder steps—not a configured version of the card description. No provider is connected and no message is sent.",
      gSearch: "Search 45 templates…", gAll: "All", gUse: "Use template", gNone: "No template matches that search.",
      gSteps: "steps", gAdded: "Added to your flows", gCatInstagram: "Instagram", gCatWhatsapp: "WhatsApp",
      gCatTiktok: "TikTok", gCatCommerce: "Commerce", gCatSupport: "Support", gCatLeads: "Lead generation",
      gCatBooking: "Booking", gStarter: "Placeholder steps only — review the template idea and edit before any real use.",
      cImport: "Import CSV", cImpTitle: "Import contacts",
      cImpSub: "CSV with a header row. Name is required; handle and tags are optional. Channel can be inferred from an @username, email address or phone number. Recognized contact labels: Instagram, WhatsApp, TikTok, Messenger, Telegram, SMS, Email and Web chat. Labels do not connect messaging APIs.",
      cImpPick: "Drop a CSV here, or click to choose", cImpOr: "…or paste CSV rows",
      cImpPh: "name,handle,channel,tags",
      cImpSample: "Download an empty CSV template", cImpPreview: "Preview import", cImpConfirm: "Import {n} new contacts",
      cImpNew: "new", cImpDup: "duplicates", cImpBad: "skipped", cImpNoNew: "No new contacts to import",
      cImpNone: "Nothing to import yet — paste rows or choose a file.",
      cImpNeed: "No name column found. Add a name column, or choose a contacts CSV.",
      cImpMalformed: "The CSV has an unclosed quote. Fix the row and try again.",
      cImpTooBig: "The file or pasted text must be 2 MB or smaller.",
      cImpCsvOnly: "Choose a .csv file.",
      cImpBadRows: "Rows with a missing or overlong value, or an unknown channel, are skipped.",
      cImpDone: "Imported", cImpRows: "rows", cImpNow: "Contacts", cImpBusy: "Importing…", cImpChecking: "Checking CSV…",
      cImpProgress: "{n} of {total}", cImpFinish: "Done — {n} imported; {d} duplicates and {s} invalid rows skipped.",
      cImpMax: "Only the first 2,000 data rows are checked.",
      cImpPartial: "Imported {n} contacts before an error. Check the list before retrying.",
      cImpError: "Could not import contacts. Please try again.", cImpHeads: ["Name", "Handle", "Channel", "Tags"]
    },
    ar: {
      overview: "نظرة عامة", inbox: "الإنبوكس", flows: "السيناريوهات", contacts: "جهات الاتصال", broadcast: "بثّ جماعي", settings: "الإعدادات",
      metaTitle: "قنوات مراسلة Meta", metaSummary: "اربط WhatsApp Cloud API الرسمي أو رسائل إنستجرام المرتبطة بصفحة فيسبوك. التوكن بيتخزن مشفّر على السيرفر؛ الربط لا يرسل أي رسالة.",
      channelInstagram: "إنستجرام", channelWhatsapp: "واتساب", channelTiktok: "تيك توك", channelMessenger: "ماسنجر", channelTelegram: "تيليجرام", channelSms: "SMS", channelEmail: "بريد إلكتروني", channelWeb: "شات الموقع",
      of: "من {n}", pickConversation: "اختار محادثة من القائمة", csvFileHint: "ملف CSV لحد 2 ميجابايت", dataIsolation: "بياناتك معزولة بالكامل (RLS)",
      tplDraftMessage: "مسودة رسالة لقالب «{name}» — عدّل النص قبل الاستخدام. لا تُرسل أي رسالة من هذه المعاينة.",
      tplDraftFollowup: "متابعة مبدئية — راجع التوقيت والموافقة وسياسة القناة قبل أي استخدام فعلي.",
      tplDraftCondition: "شرط مؤقت — اضبطه بما يناسب مسار العمل.", tplSuggestedTag: "وسم مقترح: {cat}",
      metaReadiness: "جاهزية إعداد Meta", metaAppIdLabel: "معرّف تطبيق Meta (App ID)", metaWaConfigLabel: "معرّف إعداد WhatsApp Embedded Signup v4", metaIgConfigLabel: "معرّف إعداد Instagram Facebook Login for Business",
      metaConfigured: "جاهز", metaMissing: "ناقص", metaPublicIdsNote: "أضف الـIDs العامة الثلاثة في assets/js/config.js. يجب أن يبقى App Secret وaccess tokens على السيرفر.",
      metaServerApprovalNote: "القائمة تتحقق من القيم الظاهرة للمتصفح فقط؛ ولا تؤكد موافقة Meta أو إعدادات الخادم.",
      metaWhatsapp: "WhatsApp Cloud API", metaInstagram: "رسائل إنستجرام",
      metaWaHelp: "اربط حساب WhatsApp Business يملكه العميل من خلال Meta Embedded Signup v4. التسجيل متعدد المساحات يتطلب موافقة Meta كمزوّد تقني أو شريك حلول.",
      metaIgHelp: "اربط حساب إنستجرام احترافي متصل بالفعل بصفحة فيسبوك. إعداد Facebook Login for Business لازم يطلب صلاحيات المراسلة المطلوبة.",
      metaConnect: "اربط بحساب Meta", metaReconnect: "أعد الربط بحساب Meta", metaPinLabel: "رقم PIN من 6 أرقام لحماية واتساب بخطوتين",
      metaPinHint: "بيتبعث لـMeta لتسجيل الرقم؛ شاتورا مش بيحفظ رقم الـPIN.", metaCurrency: "عملة الفوترة للنشاط التجاري",
      metaChooseCurrency: "اختار العملة…", metaTechProvider: "إعداد مزوّد تقني", metaSolutionPartner: "إعداد شريك حلول",
      metaCurrencyHint: "قائمة Meta لمشاركة الائتمان تعرض AUD وEUR وGBP وIDR وINR وUSD. اختار العملة الفعلية للنشاط؛ مفيش عملة افتراضية.",
      metaProviderUnselected: "حدّد نوع مزوّد واتساب كمزوّد تقني أو شريك حلول قبل تفعيل المسار.",
      metaConfigPending: "إعداد أو تفعيل Meta لسه مش جاهز. ما بدأناش أي ربط.",
      metaMigrationPending: "مش قادرين نقرأ إعداد القنوات. اتأكد إن الميجريشن المحلي اتطبق وإن قاعدة البيانات متاحة قبل ربط الحساب.",
      metaLoad: "بنتحقق من القنوات…", metaNone: "مش مربوط", metaConnected: "متصل",
      metaWorking: "جاري الربط…", metaSuccess: "القناة اتربطت بنجاح.", metaNoPages: "ملقيناش صفحة مؤهلة مرتبطة بحساب إنستجرام احترافي.",
      metaChoosePage: "اختار صفحة فيسبوك المرتبطة بحساب إنستجرام…", metaFinishPage: "كمّل ربط إنستجرام",
      metaNeedPin: "اكتب رقم PIN من 6 أرقام قبل المتابعة.", metaNeedCurrency: "اختار عملة النشاط المطلوبة لخط ائتمان شريك الحلول.",
      metaPhoneRequired: "التسجيل ما رجّعش رقم نشاط تجاري. أضف أو اختار رقم Cloud API وبعدها جرّب تاني.",
      metaCancelled: "تم إلغاء إعداد Meta. ما اتربطتش أي قناة.", metaFailed: "ما قدرناش نكمّل إعداد Meta. راجع الإعدادات وحاول تاني.",
      metaSelectPage: "اختار الصفحة المالكة لحساب إنستجرام الاحترافي. التوكن مش بيظهر في المتصفح.",
      crumb: "مساحة العمل", loading: "بنجهّز مساحة عملك…", error: "حصلت مشكلة في تحميل مساحة العمل.",
      retry: "جرّب تاني", signout: "تسجيل الخروج", build: "افتح المحرر",
      kContacts: "جهات اتصال نشطة", kFlows: "سيناريوهات شغّالة", kOpen: "محادثات مفتوحة", kRuns: "تشغيلات الشهر",
      runsBy: "التشغيلات حسب السيناريو", channels: "جهات الاتصال حسب القناة", recent: "آخر المحادثات",
      noData: "لسه مفيش حاجة هنا.", emptyInbox: "مفيش محادثات مطابقة للفلتر ده.", inboxEmpty: "مفيش محادثات لسه. اربط قناة مراسلة عشان تستقبل رسائل.",
      channelPending: "اربط قناة مراسلة رسمية قبل الرد أو بدء المحادثات. لم يتم إرسال أي رسالة من مساحة العمل دي.",
      sendNeedsMeta: "اربط قناة واتساب أو إنستجرام دي من الإعدادات قبل الرد.",
      sendFeatureOff: "الردود متوقفة في مساحة العمل دي. ما اتبعتش أي رسالة.",
      sendSuccess: "تم إرسال الرسالة.", sendBusy: "جاري الإرسال…", sendRetry: "أعد المحاولة بأمان", sendRetryNotice: "ما حصلش إعادة إرسال تلقائية. إعادة المحاولة هتستخدم نفس مفتاح منع التكرار.", sendUnknown: "حالة التسليم غير مؤكدة. ما تعيدش الإرسال قبل ما تتأكد من القناة.",
      sendWindow: "انتهت نافذة الرد أو تعذر التحقق منها؛ ما اتبعتش رسالة.",
      sendError: "ماقدرناش نبعت الرد. راجع الاتصال وحاول تاني.", sendTooLong: "الرسالة طويلة. الحد الأقصى 1000 بايت UTF-8.",
      sendStatusSending: "جارٍ الإرسال", sendStatusSent: "أُرسلت", sendStatusDelivered: "تم التسليم", sendStatusRead: "مقروءة", sendStatusFailed: "فشل", sendStatusUnknown: "الحالة غير معروفة",
      flowPending: "السيناريوهات تفضل مسودات لحد ربط قناة مراسلة وتشغيل أتمتة فعلية.",
      send: "إرسال", typeMsg: "اكتب رد…", aiPaused: "في انتظار ربط القناة", humanMode: "محوّلة لموظف",
      takeOver: "خد المحادثة", giveBack: "رجّعها للذكاء الاصطناعي", close: "اقفل", reopen: "افتحها تاني",
      newFlow: "سيناريو جديد", pickTemplate: "ابدأ من قالب", cancel: "إلغاء",
      live: "شغّال", paused: "موقوف", draft: "مسودة", runs: "تشغيل", pause: "وقّف", resume: "شغّل",
      search: "دوّر على جهة اتصال…", tags: "التاجات", lastSeen: "آخر ظهور", handle: "المعرّف", channel: "القناة",
      wsName: "اسم مساحة العمل", save: "حفظ", saved: "اتحفظ", plan: "الباقة", planLabel: "معاينة · بدون فوترة", account: "مسجّل الدخول كـ",
      session: "الجلسة", signoutLong: "تسجيل الخروج من المتصفح ده",
      planFree: "معاينة · بدون فوترة", planNote: "مفيش اشتراك مدفوع أو دفع إلكتروني متاح في المعاينة دي.",
      tpl1: "تعليق ← رسالة خاصة (سؤال سعر)", tpl2: "سلة متروكة · 3 رسائل", tpl3: "تأكيد الدفع عند الاستلام",
      created: "السيناريو اتعمل", noSession: "سجّل الدخول تاني.",
      agents: "وكيل الذكاء", you: "أنت", customer: "العميل",
      fAll: "الكل", fOpen: "مفتوحة", fMine: "معايا", fClosed: "مقفولة", sInbox: "دوّر في المحادثات…",
      edit: "تعديل", editor: "تحرير السيناريو", back: "رجوع", steps: "الخطوات", addStep: "أضف خطوة",
      sMsg: "رسالة", sDelay: "انتظار", sCond: "شرط", sTag: "تاج", sTrigger: "المُشغّل",
      sMsgPh: "نص الرسالة في المسودة", sDelayPh: "دقايق الانتظار", sCondPh: "مثال: بيسأل عن السعر",
      sTagPh: "التاج اللي يتضاف", stepUp: "طلّع خطوة", stepDown: "نزّل خطوة", stepDel: "امسح الخطوة",
      savedFlow: "السيناريو اتحفظ", deleteFlow: "امسح السيناريو", confirmDelete: "تمسح السيناريو وخطواته؟",
      noSteps: "مفيش خطوات لسه — ضيف أول واحدة تحت.", flowName: "اسم السيناريو",
      pwdTitle: "الباسورد", pwNew: "باسورد جديد", pwSave: "تغيير الباسورد", pwOk: "الباسورد اتغيّر.",
      pwShort: "6 حروف على الأقل.", exportTitle: "بياناتك", exportBtn: "نزّل نسخة JSON",
      emptyWs: "مساحة عمل فاضية — مفيش سجلات تجريبية بتتضاف. استورد جهات اتصالك أو اعمل أول سيناريو.",
      newContact: "جهة اتصال جديدة", editContact: "تعديل جهة الاتصال", contactName: "الاسم", tagsPh: "vip, reorder", cMore: "عرض المزيد", cShowing: "معروض {n} من {total}",
      cExport: "تصدير CSV", cExported: "تم تنزيل {n} جهة اتصال بصيغة CSV.", cExportEmpty: "مفيش جهات اتصال مطابقة للبحث.",
      deleteContact: "امسح", confirmContact: "تمسح جهة الاتصال ومحادثاتها؟",
      emptyContacts: "مفيش جهات اتصال — استورد جهات اتصالك أو ضيف أول واحدة.", message: "القناة مش مربوطة",
      obTitle: "خلّص إعداد مساحة عملك", ob1: "سمّي مساحة عملك", ob2: "اعمل مسودة سيناريو بخطوات حقيقية",
      ob3: "استورد جهات اتصالك الحقيقية", obHide: "خبّي دلوقتي", obDone: "إعداد مساحة العمل جاهز — اربط قناة قبل الإرسال.",
      obGo: "افتح",
      bcTitle: "بثّ جماعي", bcNote: "الإرسال متوقف لحد ربط قناة مراسلة رسمية. معاينة الجمهور هنا لا ترسل رسائل ولا تنشئ سجل محادثة.",
      bcName: "اسم الحملة", bcAll: "كل جهات الاتصال", bcTag: "تاج معيّن (اختياري)",
      bcBody: "الرسالة", bcBodyPh: "اكتب رسالة لمعاينتها…",
      bcAudience: "مستلم", bcSend: "اربط قناة للإرسال", bcPreview: "معاينة",
      bcEmpty: "مفيش جهات اتصال مطابقة للفلتر ده.", bcHistory: "الحملات المُرسلة",
      bcNoHist: "لم يتم إرسال أي حملات من مساحة العمل دي حتى الآن.",
      bcAll8: "كل القنوات", bcOneEach: "محادثة لكل واحد",
      testRun: "جرّب السيناريو", testTitle: "تجربة تشغيل", testNote: "مفيش حاجة بتتبعت لقناة — دي معاينة للخطوات بس.",
      testClose: "اقفل", testDone: "نهاية السيناريو", testWait: "انتظار", testMin: "دقيقة", testTyping: "معاينة الخطوة…", testRole: "معاينة محلية",
      testReplay: "شغّله تاني", testAuto: "بيتشغّل تلقائي · مفيش حاجة بتخرج من المتصفح",
      gTitle: "ابدأ من قالب", gNote: "45 فكرة توضيحية لمسارات العمل. اختيار واحدة ينشئ مسودة قابلة للتعديل بخطوات عامة مؤقتة، مش تنفيذًا مهيأً لوصف البطاقة. مفيش مزوّد متصل ومفيش رسالة بتتبعت.",
      gSearch: "دوّر في 45 قالب…", gAll: "الكل", gUse: "استخدم القالب", gNone: "مفيش قالب مطابق للبحث ده.",
      gSteps: "خطوة", gAdded: "اتضاف لسيناريوهاتك", gCatInstagram: "إنستجرام", gCatWhatsapp: "واتساب",
      gCatTiktok: "تيك توك", gCatCommerce: "تجارة", gCatSupport: "دعم", gCatLeads: "جذب عملاء",
      gCatBooking: "حجوزات", gStarter: "خطوات مؤقتة فقط — راجع فكرة القالب وعدّلها قبل أي استخدام فعلي.",
      cImport: "استيراد CSV", cImpTitle: "استيراد جهات الاتصال",
      cImpSub: "ملف CSV فيه سطر عناوين. الاسم مطلوب؛ المعرّف أو الرقم والوسوم اختياريين. القناة ممكن تتحدد من @username أو الإيميل أو رقم التليفون. التصنيفات المقبولة: إنستجرام، واتساب، تيك توك، ماسنجر، تيليجرام، SMS، بريد إلكتروني، وشات الموقع؛ دي تسميات لجهات الاتصال مش وصلات API.",
      cImpPick: "اسحب ملف CSV هنا أو اضغط للاختيار", cImpOr: "…أو الصق صفوف CSV",
      cImpPh: "الاسم,اليوزر,القناة,الوسوم",
      cImpSample: "نزّل قالب CSV فارغ", cImpPreview: "معاينة الاستيراد", cImpConfirm: "استيراد {n} جهة اتصال جديدة",
      cImpNew: "جديد", cImpDup: "مكرر", cImpBad: "اتخطى", cImpNoNew: "مفيش جهات اتصال جديدة للاستيراد",
      cImpNone: "مفيش حاجة للاستيراد لسه — الصق صفوف أو اختار ملف.",
      cImpNeed: "مفيش عمود اسم. ضيف عمود اسم أو اختار ملف جهات اتصال.",
      cImpMalformed: "في علامة اقتباس مفتوحة في الملف. صلّح الصف وحاول تاني.",
      cImpTooBig: "حجم الملف أو النص لازم يكون 2 ميجابايت أو أقل.",
      cImpCsvOnly: "اختار ملف امتداده .csv.",
      cImpBadRows: "الصفوف اللي من غير اسم أو فيها قيمة طويلة زيادة أو قناة مش معروفة هتتخطى.",
      cImpDone: "اتضاف", cImpRows: "صف", cImpNow: "جهة اتصال", cImpBusy: "بيستورد…", cImpChecking: "بيفحص الملف…",
      cImpProgress: "{n} من {total}", cImpFinish: "خلصنا — اتضاف {n}؛ اتخطى {d} مكرر و{s} صف غير صالح.",
      cImpMax: "بيتم فحص أول 2000 صف بيانات بس.",
      cImpPartial: "اتضاف {n} جهة اتصال قبل ما تحصل مشكلة. راجع القائمة قبل إعادة المحاولة.",
      cImpError: "ماقدرناش نستورد جهات الاتصال. حاول تاني.", cImpHeads: ["الاسم", "اليوزر", "القناة", "الوسوم"]
    }
  }[AR ? "ar" : "en"];

  function localeDictionary() {
    const base = window.CHATORA_I18N || {}, pages = window.CHATORA_I18N_PAGES || {};
    return Object.assign({}, base[LANG] || {}, pages[LANG] || {});
  }
  function applyAppTranslations() {
    const dict = localeDictionary();
    Object.keys(T).forEach((key) => {
      const value = dict["app." + key];
      if (value != null) T[key] = value;
    });
  }
  function templateCopy(tpl) {
    if (LANG === "ar") return tpl.ar;
    if (LANG === "en") return tpl.en;
    const all = window.CHATORA_TEMPLATES || [];
    const i = all.indexOf(tpl), dict = localeDictionary();
    return { t: dict["tp.n" + i] || tpl.en.t, d: dict["tp.d" + i] || tpl.en.d };
  }

  // The rest of the site changes languages in place. Reboot this data-heavy
  // dashboard after a locale change so every dynamically rendered panel uses
  // the same dictionary, number format and relative-time rules.
  document.addEventListener("chatora:lang", (event) => {
    const next = ((event && event.detail && event.detail.lang) || document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    if (next !== LANG && document.getElementById("dash")) setTimeout(() => location.reload(), 0);
  });

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n || 0).toLocaleString(APP_LOCALE);

  function when(iso) {
    const d = new Date(iso), m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    if (m < 1) return RELATIVE.format(0, "second");
    if (m < 60) return RELATIVE.format(-m, "minute");
    if (m < 1440) return RELATIVE.format(-Math.round(m / 60), "hour");
    return d.toLocaleDateString(APP_LOCALE, { day: "numeric", month: "short" });
  }

  const state = {
    ws: null, flows: [], contacts: [], convs: [], conv: null, msgs: [],
    view: "overview", templates: false, filter: "all", q: "", edit: null, steps: [], cedit: null,
    broadcasts: [], bc: { name: "", channel: "all", tag: "", body: "" }, gq: "", gcat: "all", cLimit: 50,
    imp: { open: false, text: "", fileName: "", preview: null, status: "", statusError: false, busy: false },
    meta: { connections: null, loaded: false, loading: false, loadFailed: false, pending: "", message: "", messageError: false, pin: "", currency: "", igState: "", igPages: [], igPageId: "", sendDrafts: {} }
  };

  const CH = {
    instagram: { label: "Instagram", color: "#FF5FA2" }, whatsapp: { label: "WhatsApp", color: "#25D366" },
    tiktok: { label: "TikTok", color: "#2CE5D6" }, messenger: { label: "Messenger", color: "#7C5CFF" },
    telegram: { label: "Telegram", color: "#5AA9E6" }, sms: { label: "SMS", color: "#C9FF6B" },
    email: { label: "Email", color: "#A19DC2" }, web: { label: "Web chat", color: "#A78BFA" }
  };
  const CH_T = { instagram: "channelInstagram", whatsapp: "channelWhatsapp", tiktok: "channelTiktok", messenger: "channelMessenger", telegram: "channelTelegram", sms: "channelSms", email: "channelEmail", web: "channelWeb" };
  const chLabel = (k) => T[CH_T[k]] || (CH[k] || { label: k }).label;
  const chColor = (k) => (CH[k] || { color: "#7C5CFF" }).color;

  /* ---------- bootstrap ---------- */
  async function ensureWorkspace(user) {
    const rows = await A.rest("/rest/v1/workspaces?select=id,name,plan,owner&limit=1");
    if (rows && rows.length) return rows[0];
    const name = (user && user.email ? user.email.split("@")[0] : "my") + " · workspace";
    const created = await A.rest("/rest/v1/workspaces", { method: "POST", body: JSON.stringify({ owner: user.id, name: name, plan: "free" }) });
    const ws = Array.isArray(created) ? created[0] : created;
    return ws;
  }

  async function loadContacts() {
    const all = [], size = 1000;
    let offset = 0;
    while (true) {
      const rows = await A.rest("/rest/v1/contacts?select=id,name,handle,channel,tags,last_seen&order=last_seen.desc,id.asc&limit=" + size + "&offset=" + offset);
      const page = rows || [];
      all.push.apply(all, page);
      if (page.length < size) break;
      offset += page.length;
    }
    return all;
  }

  async function loadAll() {
    const res = await Promise.all([
      A.rest("/rest/v1/flows?select=id,name,channel,status,runs,nodes,updated_at&order=status.asc,runs.desc"),
      loadContacts(),
      A.rest("/rest/v1/conversations?select=id,contact_id,channel,status,unread,last_at,contacts(name,handle)&order=last_at.desc&limit=50"),
      A.rest("/rest/v1/broadcasts?select=id,name,channel,body,audience,sent,created_at&order=created_at.desc&limit=20")
    ]);
    state.flows = res[0] || [];
    state.contacts = res[1] || [];
    state.convs = res[2] || [];
    state.broadcasts = res[3] || [];
  }

  /* ---------- views ---------- */
  const kpi = (label, value, sub) =>
    `<div class="kpi"><span class="kpi-l">${esc(label)}</span><b class="kpi-v">${value}</b>${sub ? `<span class="kpi-s">${esc(sub)}</span>` : ""}</div>`;

  function bars(items, colorFn) {
    if (!items.length) return `<p class="dash-empty">${esc(T.noData)}</p>`;
    const top = Math.max.apply(null, items.map((i) => i.v)) || 1;
    return `<div class="dbars">` + items.map((i) => {
      const w = Math.max(4, Math.round((i.v / top) * 100));
      return `<div class="dbar-row"><span class="dbar-k">${esc(i.k)}</span>` +
        `<span class="dbar-t"><i style="width:${w}%;background:${colorFn ? colorFn(i) : "linear-gradient(90deg,#7C5CFF,#2CE5D6)"}"></i></span>` +
        `<b class="dbar-v">${num(i.v)}</b></div>`;
    }).join("") + `</div>`;
  }

  function renderOverview() {
    if (!state.contacts.length && !state.flows.length && !state.convs.length) {
      return `<div class="dash-card dash-empty-card"><h2>${esc(T.emptyWs)}</h2>` +
        `<button type="button" class="btn btn-primary btn-sm" data-new-flow>+ ${esc(T.newFlow)}</button></div>`;
    }
    const live = state.flows.filter((f) => f.status === "live").length;
    const open = state.convs.filter((c) => c.status !== "closed").length;
    const runs = state.flows.reduce((s, f) => s + (f.runs || 0), 0);
    const byFlow = state.flows.slice().sort((a, b) => b.runs - a.runs).slice(0, 5).map((f) => ({ k: f.name, v: f.runs || 0 }));
    const chans = {};
    state.contacts.forEach((c) => { chans[c.channel] = (chans[c.channel] || 0) + 1; });
    const byChan = Object.keys(chans).map((k) => ({ k: chLabel(k), v: chans[k], c: k })).sort((a, b) => b.v - a.v);

    const of = (n) => T.of.replace("{n}", n);
    return onboarding() + `<div class="kpis">${kpi(T.kContacts, num(state.contacts.length), of("1,000"))}${kpi(T.kFlows, num(live), of(num(state.flows.length)))}` +
      `${kpi(T.kOpen, num(open), "")}${kpi(T.kRuns, num(runs), "")}</div>` +
      `<div class="dash-grid"><div class="dash-card"><h2>${esc(T.runsBy)}</h2>${bars(byFlow)}</div>` +
      `<div class="dash-card"><h2>${esc(T.channels)}</h2>${bars(byChan, (i) => chColor(i.c))}</div></div>` +
      `<div class="dash-card"><h2>${esc(T.recent)}</h2>${convList(true)}</div>`;
  }

  function onboardHidden() {
    try { return localStorage.getItem("chatora.onboard.hide") === "1"; } catch (e) { return false; }
  }

  function onboarding() {
    if (onboardHidden()) return "";
    const steps = [
      { done: !/·\s*workspace$/.test(state.ws.name), txt: T.ob1, view: "settings" },
      { done: state.flows.some((f) => (f.nodes || []).length >= 2), txt: T.ob2, view: "flows" },
      { done: state.contacts.length > 0, txt: T.ob3, view: "contacts" }
    ];
    const done = steps.filter((s) => s.done).length;
    if (done === steps.length) {
      return `<div class="dash-card onb is-done"><b>${esc(T.obDone)}</b>` +
        `<button type="button" class="link-btn" id="ob-hide">${esc(T.obHide)}</button></div>`;
    }
    const pct = Math.round((done / steps.length) * 100);
    const rows = steps.map((s, i) =>
      `<li class="${s.done ? "is-done" : ""}"><span class="onb-tick" aria-hidden="true">${s.done ? "✓" : i + 1}</span>` +
      `<span class="onb-txt">${esc(s.txt)}</span>` +
      (s.done ? "" : `<button type="button" class="link-btn" data-goto="${s.view}">${esc(T.obGo)}</button>`) + `</li>`).join("");
    return `<div class="dash-card onb"><div class="onb-head"><div><h2>${esc(T.obTitle)}</h2>` +
      `<div class="onb-bar"><i style="width:${pct}%"></i></div></div>` +
      `<span class="onb-count">${done}/${steps.length}</span></div>` +
      `<ol class="onb-list">${rows}</ol>` +
      `<button type="button" class="link-btn onb-hide" id="ob-hide">${esc(T.obHide)}</button></div>`;
  }

  function setView(v) {
    state.view = v;
    state.edit = null;
    state.cedit = null;
    $$(".dash-link").forEach((x) => x.classList.toggle("is-on", x.getAttribute("data-view") === v));
    paint();
  }

  const STATUS_TXT = () => ({ ai: T.aiPaused, human: T.humanMode, closed: T.fClosed });

  function convList(compact) {
    const rows = state.convs.filter((c) => {
      if (!compact && state.filter === "open" && c.status === "closed") return false;
      if (!compact && state.filter === "mine" && c.status !== "human") return false;
      if (!compact && state.filter === "closed" && c.status !== "closed") return false;
      if (!compact && state.q) {
        const hay = ((c.contacts && c.contacts.name) || "") + " " + ((c.contacts && c.contacts.handle) || "") + " " + chLabel(c.channel);
        if (hay.toLowerCase().indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    }).slice(0, compact ? 3 : 50);

    if (!rows.length) {
      const empty = !state.convs.length ? T.inboxEmpty : (state.q || state.filter !== "all" ? T.emptyInbox : T.noData);
      return `<p class="dash-empty">${esc(empty)}</p>`;
    }
    return `<ul class="conv-list${compact ? " is-compact" : ""}">` + rows.map((c) => {
      const name = (c.contacts && c.contacts.name) || "—";
      const st = c.status === "closed" ? T.fClosed : c.status === "human" ? T.humanMode : T.aiPaused;
      return `<li><button type="button" class="conv-item" data-conv="${c.id}">` +
        `<span class="conv-av" style="--c:${chColor(c.channel)}">${esc(name.slice(0, 1))}</span>` +
        `<span class="conv-mid"><b>${esc(name)}</b><span>${esc(chLabel(c.channel))} · ${esc(st)}</span></span>` +
        `<span class="conv-end">${esc(when(c.last_at))}${c.unread ? `<i class="conv-unread">${c.unread}</i>` : ""}</span></button></li>`;
    }).join("") + `</ul>`;
  }

  function renderInbox() {
    const filters = [["all", T.fAll], ["open", T.fOpen], ["mine", T.fMine], ["closed", T.fClosed]];
    const chips = filters.map(([k, l]) =>
      `<button type="button" class="dchip${state.filter === k ? " is-on" : ""}" data-filter="${k}">${esc(l)}</button>`).join("");
    const thread = state.conv ? renderThread() :
      `<div class="dash-empty dash-empty-tall">${esc(state.convs.length ? T.pickConversation : T.inboxEmpty)}</div>`;
    return `<div class="inbox"><div class="inbox-list">` +
      `<input id="i-search" class="dash-search is-block" type="search" aria-label="${esc(T.sInbox)}" placeholder="${esc(T.sInbox)}" value="${esc(state.q)}">` +
      `<div class="dchips">${chips}</div><div id="conv-box">${convList()}</div></div>` +
      `<div class="inbox-thread" id="thread">${thread}</div></div>`;
  }

  function metaProviderForChannel(channel) {
    return channel === "whatsapp" ? "whatsapp_cloud" : channel === "instagram" ? "instagram_messenger" : "";
  }

  function replyDraftFor(conversationId) {
    if (!state.meta.sendDrafts[conversationId]) {
      state.meta.sendDrafts[conversationId] = { clientMessageId: "", text: "", busy: false, locked: false, notice: "", noticeError: false };
    }
    return state.meta.sendDrafts[conversationId];
  }

  function deliveryStatus(status) {
    const key = {
      sending: "sendStatusSending", sent: "sendStatusSent", delivered: "sendStatusDelivered",
      read: "sendStatusRead", failed: "sendStatusFailed", unknown: "sendStatusUnknown"
    }[String(status || "").toLowerCase()];
    return key ? T[key] : "";
  }

  function renderReplyArea(c, closed) {
    if (closed) return `<div class="thread-closed">${esc(T.fClosed)}</div>`;
    const provider = metaProviderForChannel(c.channel);
    if (!provider) return `<p class="dash-note channel-pending" role="status">${esc(T.channelPending)}</p>`;
    if (!state.meta.loaded) return `<p class="dash-note channel-pending" role="status">${esc(T.metaLoad)}</p>`;
    if (state.meta.loadFailed) return `<p class="dash-note channel-pending is-err" role="status">${esc(T.metaMigrationPending)}</p>`;
    const connection = metaConnectionForConversation(provider, c);
    if (!connection) return `<p class="dash-note channel-pending" role="status">${esc(T.sendNeedsMeta)}</p>`;
    const sender = window.CHATORA_META_SEND;
    if (!sender || !sender.isEnabled()) return `<p class="dash-note channel-pending" role="status">${esc(T.sendFeatureOff)}</p>`;

    const draft = replyDraftFor(c.id);
    const pendingMessage = draft.clientMessageId && state.msgs.filter((message) => message.client_message_id === draft.clientMessageId)[0];
    const pendingStatus = String((pendingMessage && pendingMessage.provider_status) || "").toLowerCase();
    if (draft.locked && ["sent", "delivered", "read", "failed"].includes(pendingStatus)) {
      draft.locked = false;
      draft.clientMessageId = "";
      if (pendingStatus === "failed") {
        draft.notice = T.sendError;
        draft.noticeError = true;
      } else {
        draft.text = "";
        draft.notice = T.sendSuccess;
        draft.noticeError = false;
      }
    }
    const unresolved = state.msgs.some((message) => message.direction === "out" && ["sending", "unknown"].includes(String(message.provider_status || "").toLowerCase()));
    const locked = draft.locked || unresolved;
    const notice = unresolved ? T.sendUnknown : draft.notice;
    const disabled = draft.busy || locked;
    const inputDisabled = disabled || !!draft.clientMessageId;
    return `<form class="thread-form" id="meta-reply-form" autocomplete="off">` +
      `<textarea id="meta-reply-input" rows="2" maxlength="1000" dir="auto" aria-label="${esc(T.typeMsg)}" placeholder="${esc(T.typeMsg)}"${inputDisabled ? " disabled" : ""}>${esc(draft.text)}</textarea>` +
      `<button type="submit" class="btn btn-primary btn-sm" id="meta-reply-submit"${disabled || !draft.text.trim() ? " disabled" : ""}>${esc(draft.busy ? T.sendBusy : (draft.clientMessageId ? T.sendRetry : T.send))}</button>` +
      `<p class="dash-note meta-send-status${draft.noticeError || unresolved ? " is-err" : (notice === T.sendSuccess ? " is-ok" : "")}" id="meta-send-status" role="status" aria-live="polite">${esc(notice)}</p>` +
      `</form>`;
  }

  function renderThread() {
    const c = state.conv;
    const name = (c.contacts && c.contacts.name) || "—";
    const bubbles = state.msgs.map((m) => {
      const mine = m.direction === "out";
      const who = m.author === "ai" ? T.agents : m.author === "human" ? T.you : T.customer;
      const status = mine ? deliveryStatus(m.provider_status) : "";
      return `<div class="bub ${mine ? "is-out" : "is-in"}">${esc(m.body)}<span class="bub-meta">${esc(who)} · ${esc(when(m.created_at))}${status ? " · " + esc(status) : ""}</span></div>`;
    }).join("") || `<p class="dash-empty">${esc(T.noData)}</p>`;

    const closed = c.status === "closed";
    return `<header class="thread-head"><div><b>${esc(name)}</b><span>${esc((c.contacts && c.contacts.handle) || "")} · ${esc(chLabel(c.channel))}</span></div>` +
      `<div class="thread-actions">` +
      (closed ? "" : `<button type="button" class="btn btn-ghost btn-sm" id="toggle-mode">${esc(c.status === "human" ? T.giveBack : T.takeOver)}</button>` +
        `<button type="button" class="btn btn-ghost btn-sm" id="toggle-close">${esc(T.close)}</button>`) +
      (closed ? `<button type="button" class="btn btn-ghost btn-sm" id="toggle-reopen">${esc(T.reopen)}</button>` : "") +
      `</div></header><div class="thread-body" id="thread-body">${bubbles}</div>` + renderReplyArea(c, closed);
  }

  const CATS = ["all", "instagram", "whatsapp", "tiktok", "commerce", "support", "leads", "booking"];
  const catLabel = (c) => (c === "all" ? T.gAll : c === "all channels" ? T.bcAll8 : T["gCat" + c[0].toUpperCase() + c.slice(1)] || c);

  function renderGallery() {
    const all = window.CHATORA_TEMPLATES || [];
    const q = state.gq.toLowerCase();
    const rows = all.filter((x) => {
      const loc = templateCopy(x);
      return (state.gcat === "all" || x.cat === state.gcat) &&
        (!q || (loc.t + " " + loc.d + " " + x.id).toLowerCase().indexOf(q) !== -1);
    });
    const chips = CATS.map((c) =>
      `<button type="button" class="dchip${state.gcat === c ? " is-on" : ""}" data-gcat="${c}">${esc(catLabel(c))}</button>`).join("");
    const cards = rows.map((x) => {
      const loc = templateCopy(x);
      return `<article class="gtpl"><header><span class="pill" style="--c:${chColor(x.ch)}">${esc(chLabel(x.ch))}</span>` +
        `<span class="gtpl-steps">${num(x.steps)} ${esc(T.gSteps)}</span></header>` +
        `<h3>${esc(loc.t)}</h3><p>${esc(loc.d)}</p>` +
        `<button type="button" class="btn btn-ghost btn-sm" data-guse="${esc(x.id)}">${esc(T.gUse)}</button></article>`;
    }).join("");
    return `<div class="dash-head"><button type="button" class="btn btn-ghost btn-sm" id="g-back">← ${esc(T.back)}</button>` +
      `<input id="g-search" class="dash-search" type="search" aria-label="${esc(T.gSearch)}" placeholder="${esc(T.gSearch)}" value="${esc(state.gq)}"></div>` +
      `<div class="dash-card"><h2>${esc(T.gTitle)}</h2><p class="dash-note">${esc(T.gNote)}</p>` +
      `<div class="dchips">${chips}</div>` +
      `<div class="gtpl-grid">${cards || `<p class="dash-empty">${esc(T.gNone)}</p>`}</div>` +
      `<p class="dash-note">${esc(T.gStarter)}</p></div>`;
  }

  function renderFlows() {
    if (state.edit) return renderEditor();
    if (state.templates) return renderGallery();

    const tpl = "";

    const cards = state.flows.map((f) => {
      const st = f.status;
      const steps = (f.nodes || []).length;
      return `<article class="flow-card"><header><span class="flow-ch" style="--c:${chColor(f.channel)}">${esc(chLabel(f.channel))}</span>` +
        `<span class="flow-status is-${st}">${esc(T[st])}</span></header><h3>${esc(f.name)}</h3>` +
        `<p class="flow-meta">${num(f.runs)} ${esc(T.runs)}${steps ? ` · ${num(steps)} ${esc(T.steps)}` : ""} · ${esc(when(f.updated_at))}</p>` +
        `<div class="flow-foot"><button type="button" class="btn btn-ghost btn-sm" data-edit="${f.id}">${esc(T.edit)}</button></div></article>`;
    }).join("");

    return `<div class="dash-head"><span></span><button type="button" class="btn btn-primary btn-sm" data-new-flow>+ ${esc(T.newFlow)}</button></div>` +
      `<p class="dash-note flow-pending" role="status">${esc(T.flowPending)}</p>` +
      tpl + `<div class="flow-grid">${cards || `<p class="dash-empty">${esc(T.noData)}</p>`}</div>`;
  }

  function renderEditor() {
    const f = state.edit;
    const rows = state.steps.map((s, i) => {
      const first = i === 0;
      const body = s.t === "msg" ? `<textarea class="dstep-in" rows="2" data-i="${i}" data-k="text" placeholder="${esc(T.sMsgPh)}">${esc(s.text || "")}</textarea>`
        : s.t === "delay" ? `<input class="dstep-in" data-i="${i}" data-k="v" type="number" min="1" max="1440" value="${esc(s.v || 5)}" aria-label="${esc(T.sDelayPh)}" placeholder="${esc(T.sDelayPh)}">`
          : `<input class="dstep-in" data-i="${i}" data-k="text" value="${esc(s.text || "")}" aria-label="${esc(s.t === "tag" ? T.sTagPh : T.sCondPh)}" placeholder="${esc(s.t === "tag" ? T.sTagPh : T.sCondPh)}">`;
      return `<li class="dstep is-${s.t}"><span class="dstep-n">${i + 1}</span>` +
        `<span class="dstep-type">${esc(T["s" + s.t[0].toUpperCase() + s.t.slice(1)])}</span>` +
        `<div class="dstep-body">${body}</div>` +
        `<div class="dstep-acts">` +
        (i > 1 ? `<button type="button" class="icon-btn" data-move="${i}" data-dir="-1" aria-label="${esc(T.stepUp)}">↑</button>` : "") +
        (i < state.steps.length - 1 && i > 0 ? `<button type="button" class="icon-btn" data-move="${i}" data-dir="1" aria-label="${esc(T.stepDown)}">↓</button>` : "") +
        (first ? "" : `<button type="button" class="icon-btn is-del" data-del="${i}" aria-label="${esc(T.stepDel)}">✕</button>`) +
        `</div></li>`;
    }).join("");

    const adds = ["msg", "delay", "cond", "tag"].map((k) =>
      `<button type="button" class="tpl-btn" data-add="${k}">+ ${esc(T["s" + k[0].toUpperCase() + k.slice(1)])}</button>`).join("");

    return `<div class="dash-head"><button type="button" class="btn btn-ghost btn-sm" id="ed-back">← ${esc(T.back)}</button>` +
      `<div class="ed-actions"><span class="dash-ok" id="ed-ok"></span>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="ed-test">${esc(T.testRun)}</button>` +
      `<button type="button" class="btn btn-primary btn-sm" id="ed-save">${esc(T.save)}</button></div></div>` +
      `<div class="dash-card"><h2>${esc(T.flowName)}</h2>` +
      `<input id="ed-name" class="ed-name" value="${esc(f.name)}" maxlength="70" aria-label="${esc(T.flowName)}">` +
      `<p class="dash-note">${esc(chLabel(f.channel))} · ${esc(T[f.status])}</p></div>` +
      `<div class="dash-card"><h2>${esc(T.steps)}</h2>` +
      `<ol class="dsteps">${rows || `<li class="dash-empty">${esc(T.noSteps)}</li>`}</ol>` +
      `<div class="dstep-add"><span>${esc(T.addStep)}</span>${adds}</div></div>` +
      `<div class="dash-card is-danger"><button type="button" class="btn btn-ghost btn-sm" id="ed-del">${esc(T.deleteFlow)}</button></div>`;
  }

  function renderContactImport() {
    const imp = state.imp, preview = imp.preview;
    const buttonText = preview
      ? (preview.newRows.length ? T.cImpConfirm.replace("{n}", num(preview.newRows.length)) : T.cImpNoNew)
      : T.cImpPreview;
    const disabled = imp.busy || (preview ? !preview.newRows.length : !imp.text.trim());
    const stats = preview ? `<div class="cimp-stats" id="cimp-summary" role="group" aria-label="${esc(T.cImpTitle)}">
      <div><b>${num(preview.newRows.length)}</b><span>${esc(T.cImpNew)}</span></div>
      <div><b>${num(preview.duplicates)}</b><span>${esc(T.cImpDup)}</span></div>
      <div><b>${num(preview.skipped)}</b><span>${esc(T.cImpBad)}</span></div>
    </div><p class="dash-note">${esc(T.cImpBadRows)}${preview.capped ? " " + esc(T.cImpMax) : ""}</p>` : "";
    return `<section class="dash-card cimp" aria-labelledby="cimp-title">
      <header class="cimp-head"><div><h2 id="cimp-title">${esc(T.cImpTitle)}</h2><p class="dash-note">${esc(T.cImpSub)}</p></div>
        <button type="button" class="icon-btn" id="cimp-close" aria-label="${esc(T.cancel)}">✕</button></header>
      <div class="cimp-drop" id="cimp-drop" role="button" tabindex="0" aria-label="${esc(T.cImpPick)}" aria-describedby="cimp-file-name">
        <span class="cimp-icon" aria-hidden="true">⇧</span><b>${esc(T.cImpPick)}</b>
        <small id="cimp-file-name">${esc(imp.fileName || T.csvFileHint)}</small>
      </div>
      <input type="file" id="cimp-file" accept=".csv,text/csv" hidden aria-label="${esc(T.cImpPick)}">
      <label class="cimp-paste" for="cimp-text">${esc(T.cImpOr)}
        <textarea id="cimp-text" rows="5" maxlength="2097152" placeholder="${esc(T.cImpPh)}"${imp.busy ? " disabled" : ""}>${esc(imp.text)}</textarea>
      </label>
      <div class="dash-inline cimp-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="cimp-sample">${esc(T.cImpSample)}</button>
        <button type="button" class="btn btn-primary btn-sm" id="cimp-run"${disabled ? " disabled" : ""}>${esc(buttonText)}</button>
      </div>
      ${stats}
      <p class="dash-note cimp-status${imp.statusError ? " is-err" : ""}" id="cimp-status" role="status" aria-live="polite">${esc(imp.status)}</p>
    </section>`;
  }

  function renderContacts() {
    const ed = state.cedit;
    const opts = Object.keys(CH).map((k) =>
      `<option value="${k}"${ed && ed.channel === k ? " selected" : ""}>${esc(chLabel(k))}</option>`).join("");
    const form = ed ? `<div class="dash-card"><h2>${esc(ed.id ? T.editContact : T.newContact)}</h2>` +
      `<div class="cform">` +
      `<label>${esc(T.contactName)}<input id="cf-name" value="${esc(ed.name || "")}" maxlength="60" required></label>` +
      `<label>${esc(T.handle)}<input id="cf-handle" value="${esc(ed.handle || "")}" maxlength="60"></label>` +
      `<label>${esc(T.channel)}<select id="cf-ch">${opts}</select></label>` +
      `<label>${esc(T.tags)}<input id="cf-tags" value="${esc((ed.tags || []).join(", "))}" placeholder="${esc(T.tagsPh)}" maxlength="120"></label>` +
      `</div><div class="dash-inline cform-acts">` +
      `<button type="button" class="btn btn-primary btn-sm" id="cf-save">${esc(T.save)}</button>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="cf-cancel">${esc(T.cancel)}</button></div></div>` : "";
    return `<div class="dash-head"><input id="c-search" class="dash-search" type="search" aria-label="${esc(T.search)}" placeholder="${esc(T.search)}">` +
      `<button type="button" class="btn btn-ghost btn-sm" id="c-import" aria-expanded="${state.imp.open ? "true" : "false"}">${esc(T.cImport)}</button>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="c-export">${esc(T.cExport)}</button>` +
      `<button type="button" class="btn btn-primary btn-sm" id="c-new">+ ${esc(T.newContact)}</button></div>` +
      `<p class="dash-note c-export-status" id="c-export-status" role="status" aria-live="polite"></p>` +
      (state.imp.open ? renderContactImport() : "") + form +
      `<div class="table-wrap" role="region" tabindex="0" aria-label="${esc(T.contacts)}"><table class="dash-table"><thead><tr><th>${esc(T.contactName)}</th><th>${esc(T.handle)}</th>` +
      `<th>${esc(T.channel)}</th><th>${esc(T.tags)}</th><th>${esc(T.lastSeen)}</th><th class="th-acts"></th></tr></thead>` +
      `<tbody id="c-body"></tbody></table></div>` +
      `<div class="c-more-wrap" id="c-more-wrap" hidden><span id="c-more-count" aria-live="polite"></span>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="c-more">${esc(T.cMore)}</button></div>`;
  }

  function contactMatches(q) {
    q = (q || "").toLowerCase();
    return state.contacts.filter((c) => !q || (c.name + " " + (c.handle || "") + " " + (c.tags || []).join(" ")).toLowerCase().indexOf(q) !== -1);
  }

  function contactRows(q) {
    const matches = contactMatches(q);
    if (!matches.length) return `<tr><td colspan="6" class="dash-empty">${esc(state.contacts.length ? T.noData : T.emptyContacts)}</td></tr>`;
    return matches.slice(0, state.cLimit).map((c) => `<tr><td><b>${esc(c.name)}</b></td><td class="contact-handle" dir="ltr">${esc(c.handle || "—")}</td>` +
      `<td><span class="pill" style="--c:${chColor(c.channel)}">${esc(chLabel(c.channel))}</span></td>` +
      `<td>${(c.tags || []).map((t) => `<span class="tagpill">${esc(t)}</span>`).join(" ") || "—"}</td>` +
      `<td>${esc(when(c.last_seen))}</td>` +
      `<td class="td-acts"><button type="button" class="row-btn" data-msg="${c.id}">${esc(T.message)}</button>` +
      `<button type="button" class="row-btn" data-cedit="${c.id}">${esc(T.edit)}</button>` +
      `<button type="button" class="row-btn is-del" data-cdel="${c.id}">${esc(T.deleteContact)}</button></td></tr>`).join("");
  }

  function csvHeaderKey(value) {
    return String(value == null ? "" : value).trim().toLowerCase()
      .normalize("NFKD").replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
      .replace(/[\s_-]+/g, "");
  }

  function csvDelimiter(text) {
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && (ch === "\r" || ch === "\n")) break;
      else if (!quoted && Object.prototype.hasOwnProperty.call(counts, ch)) counts[ch]++;
    }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ",";
  }

  function parseCsvRows(text) {
    const input = String(text || "").replace(/^\uFEFF/, "");
    if (!input.trim()) return [];
    const delimiter = csvDelimiter(input), rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"' && field === "") quoted = true;
      else if (ch === delimiter) { row.push(field); field = ""; }
      else if (ch === "\r" || ch === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
        if (ch === "\r" && input[i + 1] === "\n") i++;
      } else field += ch;
    }
    if (quoted) throw new Error(T.cImpMalformed);
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
  }

  function importedChannel(value, handle) {
    const key = csvHeaderKey(value);
    const aliases = {
      instagram: "instagram", ig: "instagram", instagramdm: "instagram", instagramdirect: "instagram",
      انستجرام: "instagram", انستغرام: "instagram", انستا: "instagram",
      whatsapp: "whatsapp", wa: "whatsapp", whatsappbusiness: "whatsapp",
      واتساب: "whatsapp", واتساببيزنس: "whatsapp",
      tiktok: "tiktok", tiktokdm: "tiktok", tt: "tiktok", تيكتوك: "tiktok", تيكتوك: "tiktok",
      messenger: "messenger", facebookmessenger: "messenger", fbmessenger: "messenger", ماسنجر: "messenger",
      telegram: "telegram", تلجرام: "telegram", تليجرام: "telegram",
      sms: "sms", text: "sms", textmessage: "sms", رسائلنصية: "sms",
      email: "email", mail: "email", بريدالكتروني: "email", الايميل: "email",
      web: "web", webchat: "web", livechat: "web", website: "web", websitechat: "web",
      شاتالموقع: "web", شاتالويب: "web"
    };
    if (key) return aliases[key] || "";
    const h = String(handle || "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h)) return "email";
    if (h.charAt(0) === "@") return "instagram";
    if (/^[+\d\s().-]+$/.test(h) && h.replace(/\D/g, "").length >= 7) return "whatsapp";
    return "";
  }

  function importHandleKey(channel, handle) {
    const value = String(handle || "").trim();
    if (!value) return "";
    const normalized = channel === "whatsapp" || channel === "sms"
      ? (value.replace(/\D/g, "") || value.toLowerCase())
      : value.toLowerCase().replace(/\s+/g, "");
    return channel + "|" + normalized;
  }

  function parseContactCsv(text) {
    const rows = parseCsvRows(text);
    if (!rows.length) return { records: [], skipped: 0, total: 0, capped: false };
    const headers = rows[0].map(csvHeaderKey);
    const find = (names) => headers.findIndex((h) => names.indexOf(h) !== -1);
    const col = {
      name: find(["name", "fullname", "contactname", "اسم", "الاسم", "الاسمالكامل", "اسم العميل", "اسمالعميل"]),
      handle: find(["handle", "username", "user", "phone", "phonenumber", "mobile", "email", "identifier", "اليوزر", "المعرف", "الهاتف", "رقمالهاتف", "رقمالتليفون", "رقمالموبايل", "البريدااللكتروني", "البريدالالكتروني", "الايميل"]),
      channel: find(["channel", "platform", "network", "القناة", "المنصة"]),
      tags: find(["tags", "tag", "labels", "label", "الوسوم", "وسوم", "العلامات", "تاج"])
    };
    if (col.name < 0) throw new Error(T.cImpNeed);
    const data = rows.slice(1), capped = data.length > 2000, selected = data.slice(0, 2000);
    const records = []; let skipped = 0;
    selected.forEach((r) => {
      const cell = (i) => i < 0 ? "" : String(r[i] == null ? "" : r[i]);
      const clean = (v) => String(v || "").replace(/^(\s*)'([=+@-])/, "$1$2")
        .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
      const name = clean(cell(col.name));
      const handle = clean(cell(col.handle));
      const channel = importedChannel(cell(col.channel), handle);
      if (!name || name.length > 60 || handle.length > 60 || !channel || !CH[channel]) { skipped++; return; }
      let tagText = clean(cell(col.tags)).replace(/^[\[{]\s*|\s*[\]}]$/g, "");
      if (tagText.length > 120) { skipped++; return; }
      const tags = tagText.split(/[;,|]/).map((t) => clean(t).replace(/^['"]|['"]$/g, "").trim()).filter(Boolean).slice(0, 6);
      records.push({ name, handle: handle || null, channel, tags });
    });
    return { records, skipped, total: selected.length, capped };
  }

  function setImportStatus(message, isError) {
    state.imp.status = message || "";
    state.imp.statusError = !!isError;
    const el = $("#cimp-status");
    if (el) {
      el.textContent = state.imp.status;
      el.classList.toggle("is-err", state.imp.statusError);
    }
  }

  function downloadImportSample() {
    const headers = T.cImpHeads.join(",");
    const blob = new Blob(["\uFEFF", headers + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chatora-contacts-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function csvExportField(value) {
    let text = String(value == null ? "" : value);
    const formula = text.match(/^(\s*)([=+@-])/);
    if (formula) text = formula[1] + "'" + text.slice(formula[1].length);
    return "\"" + text.replace(/\"/g, "\"\"") + "\"";
  }

  function exportContactsCsv() {
    const query = $("#c-search");
    const rows = contactMatches(query && query.value);
    const status = $("#c-export-status");
    if (!rows.length) {
      if (status) status.textContent = T.cExportEmpty;
      return;
    }
    const lines = [T.cImpHeads.map(csvExportField).join(",")];
    rows.forEach((c) => lines.push([
      c.name, c.handle || "", c.channel || "", (c.tags || []).join(",")
    ].map(csvExportField).join(",")));
    const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chatora-contacts-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (status) status.textContent = T.cExported.replace("{n}", num(rows.length));
  }

  async function loadImportFile(file) {
    if (!file) return;
    state.imp.preview = null;
    state.imp.fileName = "";
    if (!/\.csv$/i.test(file.name || "")) {
      state.imp.status = T.cImpCsvOnly; state.imp.statusError = true; paint(); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      state.imp.status = T.cImpTooBig; state.imp.statusError = true; paint(); return;
    }
    state.imp.busy = true;
    state.imp.status = T.cImpChecking;
    state.imp.statusError = false;
    paint();
    try {
      const text = await file.text();
      if (new Blob([text]).size > 2 * 1024 * 1024) throw new Error(T.cImpTooBig);
      state.imp.text = text;
      state.imp.fileName = file.name;
      state.imp.preview = null;
      state.imp.status = "";
      state.imp.statusError = false;
    } catch (err) {
      state.imp.status = err && err.message === T.cImpTooBig ? T.cImpTooBig : T.cImpError;
      state.imp.statusError = true;
    }
    state.imp.busy = false;
    paint();
    const textarea = $("#cimp-text");
    if (textarea) textarea.focus();
  }

  async function previewContactImport() {
    if (state.imp.busy) return;
    if (!state.imp.text.trim()) { setImportStatus(T.cImpNone, true); return; }
    if (new Blob([state.imp.text]).size > 2 * 1024 * 1024) {
      setImportStatus(T.cImpTooBig, true); return;
    }
    state.imp.busy = true;
    state.imp.status = T.cImpChecking;
    state.imp.statusError = false;
    paint();
    try {
      const parsed = parseContactCsv(state.imp.text);
      const seen = new Set();
      state.contacts.forEach((c) => {
        const key = importHandleKey(c.channel, c.handle);
        if (key) seen.add(key);
      });
      const newRows = [];
      let duplicates = 0;
      parsed.records.forEach((c) => {
        const key = importHandleKey(c.channel, c.handle);
        if (key && seen.has(key)) { duplicates++; return; }
        if (key) seen.add(key);
        newRows.push(c);
      });
      state.imp.preview = { newRows, duplicates, skipped: parsed.skipped, total: parsed.total, capped: parsed.capped };
      state.imp.status = newRows.length ? "" : T.cImpNoNew;
      state.imp.statusError = false;
    } catch (err) {
      state.imp.preview = null;
      state.imp.status = err && [T.cImpNeed, T.cImpMalformed, T.cImpTooBig].indexOf(err.message) !== -1
        ? err.message : T.cImpError;
      state.imp.statusError = true;
    }
    state.imp.busy = false;
    paint();
    const button = $("#cimp-run");
    if (button) button.focus();
  }

  async function commitContactImport() {
    const plan = state.imp.preview;
    if (!plan || !plan.newRows.length || state.imp.busy) return;
    state.imp.busy = true;
    state.imp.status = T.cImpBusy;
    state.imp.statusError = false;
    paint();
    const inserted = [];
    try {
      for (let i = 0; i < plan.newRows.length; i += 100) {
        const batch = plan.newRows.slice(i, i + 100).map((c) => Object.assign({ workspace_id: state.ws.id }, c));
        const result = await A.rest("/rest/v1/contacts", { method: "POST", body: JSON.stringify(batch) });
        const made = Array.isArray(result) ? result : (result ? [result] : []);
        if (made.length !== batch.length) throw new Error("Incomplete insert");
        inserted.push.apply(inserted, made);
        const status = $("#cimp-status");
        if (status) status.textContent = T.cImpBusy + " " + T.cImpProgress
          .replace("{n}", num(inserted.length)).replace("{total}", num(plan.newRows.length));
      }
      state.contacts = inserted.concat(state.contacts);
      state.imp.preview = null;
      state.imp.status = T.cImpFinish
        .replace("{n}", num(inserted.length)).replace("{d}", num(plan.duplicates)).replace("{s}", num(plan.skipped));
      state.imp.statusError = false;
    } catch (err) {
      if (inserted.length) state.contacts = inserted.concat(state.contacts);
      state.imp.preview = null;
      state.imp.status = inserted.length ? T.cImpPartial.replace("{n}", num(inserted.length)) : T.cImpError;
      state.imp.statusError = true;
    }
    state.imp.busy = false;
    paint();
    const button = $("#cimp-run");
    if (button) button.focus();
  }

  function audience() {
    const b = state.bc;
    return state.contacts.filter((c) => {
      if (b.channel !== "all" && c.channel !== b.channel) return false;
      if (b.tag && (c.tags || []).indexOf(b.tag) === -1) return false;
      return true;
    });
  }

  function renderBroadcast() {
    const b = state.bc;
    const list = audience();
    const chOpts = [`<option value="all"${b.channel === "all" ? " selected" : ""}>${esc(T.bcAll8)}</option>`]
      .concat(Object.keys(CH).map((k) => `<option value="${k}"${b.channel === k ? " selected" : ""}>${esc(chLabel(k))}</option>`)).join("");
    const tags = {};
    state.contacts.forEach((c) => (c.tags || []).forEach((t) => { tags[t] = (tags[t] || 0) + 1; }));
    const tagOpts = [`<option value=""${!b.tag ? " selected" : ""}>${esc(T.bcTag)}</option>`]
      .concat(Object.keys(tags).sort().map((t) => `<option value="${esc(t)}"${b.tag === t ? " selected" : ""}>${esc(t)} (${tags[t]})</option>`)).join("");

    const preview = list.slice(0, 6).map((c) =>
      `<li><span class="conv-av" style="--c:${chColor(c.channel)}">${esc(c.name.slice(0, 1))}</span>` +
      `<span class="bc-who"><b>${esc(c.name)}</b><i>${esc(chLabel(c.channel))}</i></span></li>`).join("");

    const hist = state.broadcasts.length ? `<ul class="bc-hist">` + state.broadcasts.map((h) =>
      `<li><div><b>${esc(h.name)}</b><span>${esc(when(h.created_at))} · ${num(h.sent)}/${num(h.audience)} · ${esc(h.channel ? chLabel(h.channel) : T.bcAll8)}</span>` +
      `<p>${esc(h.body)}</p></div></li>`).join("") + `</ul>` : `<p class="dash-empty">${esc(T.bcNoHist)}</p>`;

    return `<div class="dash-card"><h2>${esc(T.bcTitle)}</h2><p class="dash-note">${esc(T.bcNote)}</p>` +
      `<div class="cform bc-form">` +
      `<label>${esc(T.bcName)}<input id="bc-name" value="${esc(b.name)}" maxlength="60"></label>` +
      `<label>${esc(T.channel)}<select id="bc-channel">${chOpts}</select></label>` +
      `<label>${esc(T.tags)}<select id="bc-tag">${tagOpts}</select></label>` +
      `</div>` +
      `<label class="bc-body">${esc(T.bcBody)}<textarea id="bc-body" rows="3" maxlength="600" placeholder="${esc(T.bcBodyPh)}">${esc(b.body)}</textarea></label>` +
      `<div class="bc-row"><span class="bc-count"><b>${num(list.length)}</b> ${esc(T.bcAudience)}</span>` +
      `<button type="button" class="btn btn-primary btn-sm" id="bc-send" disabled aria-disabled="true">${esc(T.bcSend)}</button></div>` +
      (list.length ? `<ul class="bc-people">${preview}</ul>` : `<p class="dash-empty">${esc(T.bcEmpty)}</p>`) +
      `</div>` +
      `<div class="dash-card"><h2>${esc(T.bcHistory)}</h2>${hist}</div>`;
  }

  async function loadMetaConnections(force) {
    if (!state.ws || state.meta.loading || (state.meta.loaded && !force)) return;
    state.meta.loading = true;
    try {
      const rows = await A.rest("/rest/v1/channel_connections?select=id,provider,external_account_id,external_messaging_account_id,external_page_id,display_name,status,connection_metadata,created_at,updated_at&workspace_id=eq." + encodeURIComponent(state.ws.id) + "&order=created_at.asc");
      state.meta.connections = rows || [];
      state.meta.loadFailed = false;
      state.meta.loaded = true;
    } catch (_) {
      state.meta.connections = [];
      state.meta.loadFailed = true;
      state.meta.loaded = true;
    } finally {
      state.meta.loading = false;
      if (state.view === "settings" || state.view === "inbox") paint();
    }
  }

  function metaFriendlyError(error) {
    const code = String((error && (error.code || error.message)) || "");
    if (["meta_client_not_configured", "meta_onboarding_disabled", "meta_app_not_configured", "whatsapp_provider_not_configured", "instagram_login_not_configured", "solution_partner_credentials_not_configured"].includes(code)) return T.metaConfigPending;
    if (code === "invalid_whatsapp_pin") return T.metaNeedPin;
    if (code === "solution_partner_currency_required") return T.metaNeedCurrency;
    if (code === "whatsapp_phone_number_required") return T.metaPhoneRequired;
    if (code === "whatsapp_signup_cancelled" || code === "meta_login_cancelled_or_missing_code") return T.metaCancelled;
    if (code === "instagram_no_eligible_page") return T.metaNoPages;
    return T.metaFailed;
  }

  function metaConnection(provider) {
    return (state.meta.connections || []).filter((connection) => connection.provider === provider && connection.status === "connected")[0] || null;
  }

  function metaConnectionForConversation(provider, conversation) {
    const externalId = String((conversation && conversation.external_id) || "");
    const accountId = externalId.indexOf(":") > 0 ? externalId.slice(0, externalId.indexOf(":")) : "";
    if (!provider || !accountId) return null;
    return (state.meta.connections || []).filter((connection) =>
      connection.provider === provider && connection.status === "connected" && String(connection.external_account_id || "") === accountId
    )[0] || null;
  }

  function metaStatusText(connection) {
    if (!state.meta.loaded) return T.metaLoad;
    if (state.meta.loadFailed) return T.metaMigrationPending;
    if (!connection) return T.metaNone;
    return T.metaConnected + (connection.display_name ? " · " + connection.display_name : "");
  }

  function renderMetaSettings() {
    const meta = window.CHATORA_META_ONBOARDING;
    const waReady = !!(meta && meta.isConfigured("whatsapp") && state.meta.loaded && !state.meta.loadFailed);
    const igReady = !!(meta && meta.isConfigured("instagram") && state.meta.loaded && !state.meta.loadFailed);
    const providerType = String((window.CHATORA_CONFIG || {}).META_WHATSAPP_PROVIDER_TYPE || "");
    const waConnection = metaConnection("whatsapp_cloud");
    const igConnection = metaConnection("instagram_messenger");
    const waPin = `<label class="meta-input-label">${esc(T.metaPinLabel)}<input id="meta-wa-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" pattern="[0-9]{6}" value="${esc(state.meta.pin)}" aria-describedby="meta-wa-pin-hint"></label>` +
      `<p class="dash-note" id="meta-wa-pin-hint">${esc(T.metaPinHint)}</p>`;
    const currencies = ["AUD", "EUR", "GBP", "IDR", "INR", "USD"];
    const currencySelect = `<label class="meta-input-label">${esc(T.metaCurrency)}<select id="meta-wa-currency"><option value="">${esc(T.metaChooseCurrency)}</option>` + currencies.map((code) => `<option value="${code}"${state.meta.currency === code ? " selected" : ""}>${code}</option>`).join("") + `</select></label><p class="dash-note">${esc(T.metaCurrencyHint)}</p>`;
    const igOptions = [`<option value="">${esc(T.metaChoosePage)}</option>`].concat((state.meta.igPages || []).map((page) => {
      const label = page.name + (page.instagramUsername ? " · @" + page.instagramUsername : "");
      return `<option value="${esc(page.id)}"${state.meta.igPageId === page.id ? " selected" : ""}>${esc(label)}</option>`;
    })).join("");
    const igPicker = state.meta.igPages.length ? `<div class="meta-ig-picker"><label class="meta-input-label" for="meta-ig-page">${esc(T.metaSelectPage)}<select id="meta-ig-page">${igOptions}</select></label>` +
      `<button type="button" class="btn btn-primary btn-sm" id="meta-ig-finish"${state.meta.pending || !state.meta.igPageId ? " disabled" : ""}>${esc(T.metaFinishPage)}</button></div>` : "";
    const status = state.meta.message || (state.meta.loadFailed ? T.metaMigrationPending : (!state.meta.loaded ? "" : (!waReady && !igReady ? T.metaConfigPending : "")));
    const statusClass = state.meta.messageError || state.meta.loadFailed ? "is-err" : (state.meta.message === T.metaSuccess ? "is-ok" : (state.meta.loaded && !waReady && !igReady ? "is-pending" : ""));
    const publicConfig = window.CHATORA_CONFIG || {};
    const publicIdChecks = [
      [T.metaAppIdLabel, /^\d{5,32}$/.test(String(publicConfig.META_APP_ID || ""))],
      [T.metaWaConfigLabel, /^\d{5,32}$/.test(String(publicConfig.META_WHATSAPP_CONFIG_ID || ""))],
      [T.metaIgConfigLabel, /^\d{5,32}$/.test(String(publicConfig.META_INSTAGRAM_CONFIG_ID || ""))]
    ];
    const readiness = `<section class="meta-readiness" aria-labelledby="meta-readiness-title"><h3 id="meta-readiness-title">${esc(T.metaReadiness)}</h3>` +
      `<ul>${publicIdChecks.map(([label, ready]) => `<li><span>${esc(label)}</span><b class="meta-readiness-state ${ready ? "is-ready" : "is-missing"}">${esc(ready ? T.metaConfigured : T.metaMissing)}</b></li>`).join("")}</ul>` +
      `<p class="dash-note">${esc(T.metaPublicIdsNote)}</p><p class="dash-note">${esc(T.metaServerApprovalNote)}</p></section>`;
    return `<div class="dash-card meta-setup-card"><h2>${esc(T.metaTitle)}</h2><p class="dash-note">${esc(T.metaSummary)}</p>` +
      `<p class="dash-note meta-global-status ${statusClass}" id="meta-setup-status" aria-live="polite">${esc(status)}</p>` +
      (state.meta.loadFailed ? `<button type="button" class="link-btn meta-retry" id="meta-retry">${esc(T.retry)}</button>` : "") +
      readiness + `<div class="meta-channels-grid">` +
      `<section class="meta-channel-card" aria-labelledby="meta-wa-title"><div class="meta-channel-head"><div><h3 id="meta-wa-title">${esc(T.metaWhatsapp)}</h3><p class="meta-channel-status">${esc(metaStatusText(waConnection))}</p></div><span class="meta-channel-mark is-wa" aria-hidden="true">W</span></div>` +
      `<p class="dash-note">${esc(T.metaWaHelp)}</p>` +
      (providerType === "solution_partner" ? `<p class="meta-provider-mode">${esc(T.metaSolutionPartner)}</p>${currencySelect}` : providerType === "tech_provider" ? `<p class="meta-provider-mode">${esc(T.metaTechProvider)}</p>` : `<p class="meta-provider-mode">${esc(T.metaProviderUnselected)}</p>`) +
      waPin +
      `<button type="button" class="btn btn-primary btn-sm" id="meta-wa-connect"${waReady && !state.meta.pending ? "" : " disabled"}>${esc(waConnection ? T.metaReconnect : T.metaConnect)}</button></section>` +
      `<section class="meta-channel-card" aria-labelledby="meta-ig-title"><div class="meta-channel-head"><div><h3 id="meta-ig-title">${esc(T.metaInstagram)}</h3><p class="meta-channel-status">${esc(metaStatusText(igConnection))}</p></div><span class="meta-channel-mark is-ig" aria-hidden="true">◎</span></div>` +
      `<p class="dash-note">${esc(T.metaIgHelp)}</p><button type="button" class="btn btn-primary btn-sm" id="meta-ig-connect"${igReady && !state.meta.pending ? "" : " disabled"}>${esc(igConnection ? T.metaReconnect : T.metaConnect)}</button>` +
      igPicker + `</section></div></div>`;
  }

  function renderSettings() {
    return renderMetaSettings() +
      `<div class="dash-card"><h2>${esc(T.wsName)}</h2>` +
      `<form id="ws-form" class="dash-inline"><input id="ws-input" aria-label="${esc(T.wsName)}" value="${esc(state.ws.name)}" maxlength="60">` +
      `<button class="btn btn-primary btn-sm" type="submit">${esc(T.save)}</button></form>` +
      `<p class="dash-note">${esc(T.planNote)}</p></div>` +
      `<div class="dash-card"><h2>${esc(T.pwdTitle)}</h2>` +
      `<form id="pw-form" class="dash-inline"><input id="pw-input" type="password" autocomplete="new-password" minlength="6" aria-label="${esc(T.pwNew)}" placeholder="${esc(T.pwNew)}">` +
      `<button class="btn btn-ghost btn-sm" type="submit">${esc(T.pwSave)}</button></form>` +
      `<p class="dash-note" id="pw-msg"></p></div>` +
      `<div class="dash-card"><h2>${esc(T.plan)}</h2><p class="dash-plan-row"><b>${esc(T.planFree)}</b> — <span>${esc(T.dataIsolation)}</span></p></div>` +
      `<div class="dash-card"><h2>${esc(T.account)}</h2><p>${esc((A.user() && A.user().email) || "")}</p>` +
      `<p class="dash-note">${esc(T.exportTitle)} — <button type="button" class="link-btn" id="export">${esc(T.exportBtn)}</button></p></div>` +
      `<div class="dash-card"><h2>${esc(T.session)}</h2>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="signout2">${esc(T.signoutLong)}</button></div>`;
  }

  const RENDER = { overview: renderOverview, inbox: renderInbox, flows: renderFlows, contacts: renderContacts, broadcast: renderBroadcast, settings: renderSettings };

  function paint() {
    const panel = $("#panel-" + state.view);
    if (!panel) return;
    $$(".dash-link").forEach((x) => x.classList.toggle("is-on", x.getAttribute("data-view") === state.view));
    panel.innerHTML = RENDER[state.view]();
    $$(".dash-view").forEach((v) => { v.hidden = v.getAttribute("data-panel") !== state.view; });
    $("#dash-title").textContent = T[state.view] || T.overview;
    bindPanel();
  }

  function badge() {
    const n = state.convs.reduce((s, c) => s + (c.unread || 0), 0);
    const b = $("#dash-unread");
    if (b) {
      b.hidden = !n;
      b.textContent = n;
    }
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = n ? "(" + n + ") " + base : base;
  }

  // Light polling so the inbox behaves like an inbox: new replies, unread counts
  // and status changes land without a reload. Paused while the tab is hidden.
  let polling = null;
  function startPolling() {
    if (polling) return;
    polling = setInterval(async () => {
      if (document.hidden) return;
      try {
        const rows = await A.rest("/rest/v1/conversations?select=id,contact_id,channel,status,unread,last_at,contacts(name,handle)&order=last_at.desc&limit=50");
        const before = JSON.stringify(state.convs.map((c) => [c.id, c.unread, c.status, c.last_at]));
        const after = JSON.stringify((rows || []).map((c) => [c.id, c.unread, c.status, c.last_at]));
        const conversationsChanged = before !== after;
        if (conversationsChanged) {
          state.convs = rows || [];
          badge();
        }
        if (state.view === "inbox" && state.conv) {
          const fresh = state.convs.filter((c) => c.id === state.conv.id)[0];
          if (fresh) state.conv = Object.assign({}, fresh, { external_id: fresh.external_id || state.conv.external_id || "" });
          const msgs = await loadThreadMessages(state.conv.id);
          const beforeMessages = JSON.stringify(state.msgs.map((m) => [m.id, m.body, m.provider_status, m.provider_message_id]));
          const afterMessages = JSON.stringify((msgs || []).map((m) => [m.id, m.body, m.provider_status, m.provider_message_id]));
          if (beforeMessages !== afterMessages) {
            state.msgs = msgs || [];
            paint();
            return;
          }
        }
        if (conversationsChanged && (state.view === "inbox" || state.view === "overview")) paint();
      } catch (e) { /* offline or token expired: stay quiet, the next tick retries */ }
    }, 15000);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.ws) {
      clearInterval(polling); polling = null; startPolling();
    }
  });

  function newClientMessageId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") throw new Error("secure_id_generation_unavailable");
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  async function loadThreadMessages(conversationId) {
    const filter = "&conversation_id=eq." + encodeURIComponent(conversationId) + "&order=created_at.asc";
    try {
      return await A.rest("/rest/v1/messages?select=id,direction,author,body,created_at,provider_status,provider_message_id,client_message_id" + filter);
    } catch (_) {
      // Keep pre-Meta workspaces readable until the proposed channel migration is applied.
      return A.rest("/rest/v1/messages?select=id,direction,author,body,created_at" + filter);
    }
  }

  async function refreshThreadMessages(conversationId) {
    try {
      const rows = await loadThreadMessages(conversationId);
      if (state.conv && state.conv.id === conversationId) state.msgs = rows || [];
    } catch (_) { /* Keep the send result visible; polling can refill the thread. */ }
  }

  function sendErrorText(error) {
    const code = String((error && (error.code || error.message)) || "");
    if (code === "sending_disabled") return T.sendFeatureOff;
    if (code === "reply_window_expired_or_unknown") return T.sendWindow;
    if (code === "conversation_connection_mismatch") return T.sendNeedsMeta;
    if (code === "provider_result_unknown" || code === "provider_id_missing") return T.sendUnknown;
    if (code === "message_too_long") return T.sendTooLong;
    return T.sendError;
  }

  async function submitMetaReply(event) {
    event.preventDefault();
    const conversation = state.conv;
    if (!conversation) return;
    const draft = replyDraftFor(conversation.id);
    const input = $("#meta-reply-input");
    const text = String((input && input.value) || draft.text || "").trim();
    if (!text || draft.busy || draft.locked) return;
    if (new TextEncoder().encode(text).byteLength > 1000) {
      draft.text = text;
      draft.notice = T.sendTooLong;
      draft.noticeError = true;
      paint();
      return;
    }
    const sender = window.CHATORA_META_SEND;
    if (!sender || !sender.isEnabled()) {
      draft.notice = T.sendFeatureOff;
      draft.noticeError = true;
      paint();
      return;
    }
    try {
      if (!draft.clientMessageId) draft.clientMessageId = newClientMessageId();
    } catch (_) {
      draft.notice = T.sendError;
      draft.noticeError = true;
      paint();
      return;
    }
    draft.text = text;
    draft.busy = true;
    draft.notice = "";
    draft.noticeError = false;
    const messageId = draft.clientMessageId;
    const conversationId = conversation.id;
    const provider = metaProviderForChannel(conversation.channel);
    const connection = metaConnectionForConversation(provider, conversation);
    if (!connection) {
      draft.busy = false;
      draft.notice = T.sendNeedsMeta;
      draft.noticeError = true;
      paint();
      return;
    }
    if (state.view === "inbox" && state.conv && state.conv.id === conversationId) paint();

    try {
      const result = await sender.send({
        workspaceId: state.ws.id,
        conversationId,
        connectionId: connection.id,
        clientMessageId: messageId,
        text
      });
      const status = String(result?.status || result?.message?.provider_status || "").toLowerCase();
      if (["sent", "delivered", "read"].includes(status)) {
        draft.clientMessageId = "";
        draft.text = "";
        draft.locked = false;
        draft.notice = T.sendSuccess;
        draft.noticeError = false;
      } else if (["unknown", "sending"].includes(status) || result?.status === "unknown") {
        draft.locked = true;
        draft.notice = T.sendUnknown;
        draft.noticeError = true;
      } else if (result?.duplicateRequest && status === "failed") {
        draft.clientMessageId = "";
        draft.locked = false;
        draft.notice = T.sendError;
        draft.noticeError = true;
      } else {
        draft.locked = true;
        draft.notice = T.sendUnknown;
        draft.noticeError = true;
      }
      await refreshThreadMessages(conversationId);
    } catch (error) {
      const code = String((error && (error.code || error.message)) || "");
      const knownNoSend = [
        "sending_disabled", "server_not_configured", "no_session", "unauthorized", "invalid_json",
        "invalid_request", "message_too_long", "workspace_not_owned", "conversation_not_found",
        "conversation_closed", "unsupported_channel", "reply_window_expired_or_unknown",
        "contact_not_connected_to_provider", "channel_not_connected", "conversation_connection_mismatch",
        "channel_token_missing", "channel_token_expired", "channel_token_invalid", "provider_not_configured", "provider_rejected"
      ].includes(code);
      if (code === "provider_result_unknown" || code === "provider_id_missing" || error?.status === 202) {
        draft.locked = true;
        draft.notice = T.sendUnknown;
        draft.noticeError = true;
        await refreshThreadMessages(conversationId);
      } else if (knownNoSend) {
        draft.clientMessageId = "";
        draft.notice = sendErrorText(error);
        draft.noticeError = true;
        if (code === "provider_rejected") await refreshThreadMessages(conversationId);
      } else {
        // Keep the same key and exact text after a network/5xx ambiguity. A
        // deliberate retry is idempotent and cannot create a second send.
        draft.notice = T.sendRetryNotice;
        draft.noticeError = true;
      }
    } finally {
      draft.busy = false;
      if (state.view === "inbox" && state.conv && state.conv.id === conversationId) paint();
    }
  }

  /* ---------- interactions ---------- */
  function bindPanel() {
    const p = $("#panel-" + state.view);

    $$("[data-conv]", p).forEach((b) => b.addEventListener("click", () => openConv(b.getAttribute("data-conv"))));
    $$("[data-goto]", p).forEach((b) => b.addEventListener("click", () => setView(b.getAttribute("data-goto"))));
    const obh = $("#ob-hide", p);
    if (obh) obh.addEventListener("click", () => {
      try { localStorage.setItem("chatora.onboard.hide", "1"); } catch (e) {}
      paint();
    });
    const nf = $("[data-new-flow]", p);
    if (nf) nf.addEventListener("click", () => { state.view = "flows"; state.templates = true; paint(); });

    if (state.view === "inbox") {
      const s = $("#i-search", p);
      if (s) s.addEventListener("input", () => {
        state.q = s.value;
        const box = $("#conv-box", p);
        box.innerHTML = convList();
        $$("[data-conv]", box).forEach((b) => b.addEventListener("click", () => openConv(b.getAttribute("data-conv"))));
      });
      bindInboxList();
      const replyForm = $("#meta-reply-form", p);
      const replyInput = $("#meta-reply-input", p);
      if (replyForm && replyInput && state.conv) {
        const draft = replyDraftFor(state.conv.id);
        replyInput.addEventListener("input", () => {
          draft.text = replyInput.value;
          if (!draft.clientMessageId) { draft.notice = ""; draft.noticeError = false; }
          const button = $("#meta-reply-submit", replyForm);
          if (button) button.disabled = !draft.text.trim() || draft.busy || draft.locked;
          const notice = $("#meta-send-status", replyForm);
          if (notice && !draft.clientMessageId) notice.textContent = draft.notice;
        });
        replyForm.addEventListener("submit", submitMetaReply);
      }

      const tc = $("#toggle-close");
      if (tc) tc.addEventListener("click", () => setStatus("closed"));
      const tr = $("#toggle-reopen");
      if (tr) tr.addEventListener("click", () => setStatus("ai"));
    }

    if (state.view === "flows") {
      const tc = $("#tpl-cancel", p);
      if (tc) tc.addEventListener("click", () => { state.templates = false; paint(); });
      $$("[data-guse]", p).forEach((b) => b.addEventListener("click", () => useTemplate(b.getAttribute("data-guse")).catch((e) => alert(e.message))));
      $$("[data-gcat]", p).forEach((b) => b.addEventListener("click", () => { state.gcat = b.getAttribute("data-gcat"); paint(); }));
      const gb = $("#g-back", p);
      if (gb) gb.addEventListener("click", () => { state.templates = false; paint(); });
      const gs = $("#g-search", p);
      if (gs) gs.addEventListener("input", () => {
        state.gq = gs.value;
        const grid = $(".gtpl-grid", p);
        const all = window.CHATORA_TEMPLATES || [];
        const q = state.gq.toLowerCase();
        const rows = all.filter((x) => {
          const loc = templateCopy(x);
          return (state.gcat === "all" || x.cat === state.gcat) &&
            (!q || (loc.t + " " + loc.d + " " + x.id).toLowerCase().indexOf(q) !== -1);
        });
        grid.innerHTML = rows.map((x) => {
          const loc = templateCopy(x);
          return `<article class="gtpl"><header><span class="pill" style="--c:${chColor(x.ch)}">${esc(chLabel(x.ch))}</span>` +
            `<span class="gtpl-steps">${num(x.steps)} ${esc(T.gSteps)}</span></header>` +
            `<h3>${esc(loc.t)}</h3><p>${esc(loc.d)}</p>` +
            `<button type="button" class="btn btn-ghost btn-sm" data-guse="${esc(x.id)}">${esc(T.gUse)}</button></article>`;
        }).join("") || `<p class="dash-empty">${esc(T.gNone)}</p>`;
        $$("[data-guse]", grid).forEach((b) => b.addEventListener("click", () => useTemplate(b.getAttribute("data-guse")).catch((e) => alert(e.message))));
      });
      $$("[data-edit]", p).forEach((b) => b.addEventListener("click", () => openEditor(b.getAttribute("data-edit"))));
      bindEditor(p);
    }

    if (state.view === "contacts") {
      const tb = $("#c-body", p);
      const draw = () => {
        const q = $("#c-search", p).value;
        tb.innerHTML = contactRows(q);
        const matches = contactMatches(q);
        const shown = Math.min(matches.length, state.cLimit);
        const wrap = $("#c-more-wrap", p), count = $("#c-more-count", p);
        if (wrap) wrap.hidden = shown >= matches.length;
        if (count) count.textContent = T.cShowing.replace("{n}", num(shown)).replace("{total}", num(matches.length));
      };
      draw();
      const s = $("#c-search", p);
      if (s) s.addEventListener("input", () => { state.cLimit = 50; draw(); });
      const more = $("#c-more", p);
      if (more) more.addEventListener("click", () => { state.cLimit += 50; draw(); });
      tb.addEventListener("click", (e) => {
        const b = e.target.closest("[data-msg],[data-cedit],[data-cdel]");
        if (!b) return;
        if (b.hasAttribute("data-msg")) startChat(b.getAttribute("data-msg"));
        else if (b.hasAttribute("data-cedit")) {
          const c = state.contacts.filter((x) => x.id === b.getAttribute("data-cedit"))[0];
          state.cedit = { id: c.id, name: c.name, handle: c.handle || "", channel: c.channel, tags: c.tags || [] };
          paint();
        } else deleteContact(b.getAttribute("data-cdel"));
      });
      const impBtn = $("#c-import", p);
      if (impBtn) impBtn.addEventListener("click", () => { state.imp.open = !state.imp.open; paint(); });
      const exportBtn = $("#c-export", p);
      if (exportBtn) exportBtn.addEventListener("click", exportContactsCsv);
      const impClose = $("#cimp-close", p);
      if (impClose) impClose.addEventListener("click", () => { state.imp.open = false; paint(); });
      const csvText = $("#cimp-text", p);
      if (csvText) csvText.addEventListener("input", () => {
        state.imp.text = csvText.value;
        state.imp.fileName = "";
        state.imp.preview = null;
        state.imp.status = "";
        state.imp.statusError = false;
        const summary = $("#cimp-summary", p);
        if (summary) summary.remove();
        const status = $("#cimp-status", p);
        if (status) { status.textContent = ""; status.classList.remove("is-err"); }
        const run = $("#cimp-run", p);
        if (run) { run.textContent = T.cImpPreview; run.disabled = !csvText.value.trim() || state.imp.busy; }
      });
      const fileInput = $("#cimp-file", p);
      const dropZone = $("#cimp-drop", p);
      if (fileInput) fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        if (file) loadImportFile(file).catch(() => setImportStatus(T.cImpError, true));
      });
      if (dropZone && fileInput) {
        dropZone.addEventListener("click", () => { if (!state.imp.busy) fileInput.click(); });
        dropZone.addEventListener("keydown", (e) => {
          if ((e.key === "Enter" || e.key === " ") && !state.imp.busy) { e.preventDefault(); fileInput.click(); }
        });
        dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("is-dragging"); });
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
        dropZone.addEventListener("drop", (e) => {
          e.preventDefault(); dropZone.classList.remove("is-dragging");
          if (!state.imp.busy && e.dataTransfer && e.dataTransfer.files[0]) loadImportFile(e.dataTransfer.files[0]);
        });
      }
      const sample = $("#cimp-sample", p);
      if (sample) sample.addEventListener("click", downloadImportSample);
      const run = $("#cimp-run", p);
      if (run) run.addEventListener("click", () => {
        if (state.imp.preview) commitContactImport();
        else previewContactImport();
      });
      const nw = $("#c-new", p);
      if (nw) nw.addEventListener("click", () => {
        state.imp.open = false;
        state.cedit = { id: null, name: "", handle: "", channel: "instagram", tags: [] };
        paint();
        const f = $("#cf-name"); if (f) f.focus();
      });
      const sv = $("#cf-save", p);
      if (sv) sv.addEventListener("click", saveContact);
      const cn = $("#cf-cancel", p);
      if (cn) cn.addEventListener("click", () => { state.cedit = null; paint(); });
    }

    if (state.view === "broadcast") {
      // text fields only update state — a repaint here would swallow the click
      const nameEl = $("#bc-name", p);
      if (nameEl) nameEl.addEventListener("input", (e) => { state.bc.name = e.target.value; });
      const bodyEl = $("#bc-body", p);
      if (bodyEl) bodyEl.addEventListener("input", (e) => { state.bc.body = e.target.value; });
      // the two selects change the audience, so they do repaint
      ["#bc-channel", "#bc-tag"].forEach((sel) => {
        const el = $(sel, p);
        if (el) el.addEventListener("change", (e) => {
          state.bc[sel === "#bc-channel" ? "channel" : "tag"] = e.target.value;
          paint();
        });
      });
    }

    if (state.view === "settings") {
      const meta = window.CHATORA_META_ONBOARDING;
      const metaRetry = $("#meta-retry", p);
      if (metaRetry) metaRetry.addEventListener("click", () => {
        state.meta.loaded = false;
        state.meta.loadFailed = false;
        loadMetaConnections(true);
      });
      const pinInput = $("#meta-wa-pin", p);
      if (pinInput) pinInput.addEventListener("input", (e) => {
        state.meta.pin = String(e.target.value || "").replace(/\D/g, "").slice(0, 6);
        e.target.value = state.meta.pin;
      });
      const currencyInput = $("#meta-wa-currency", p);
      if (currencyInput) currencyInput.addEventListener("change", (e) => { state.meta.currency = e.target.value; });
      const waConnect = $("#meta-wa-connect", p);
      if (waConnect) waConnect.addEventListener("click", async () => {
        const pin = String((pinInput && pinInput.value) || state.meta.pin || "").trim();
        const currency = String((currencyInput && currencyInput.value) || state.meta.currency || "");
        const providerType = String((window.CHATORA_CONFIG || {}).META_WHATSAPP_PROVIDER_TYPE || "");
        if (!/^\d{6}$/.test(pin)) {
          state.meta.message = T.metaNeedPin;
          state.meta.messageError = true;
          paint();
          return;
        }
        if (providerType === "solution_partner" && !currency) {
          state.meta.message = T.metaNeedCurrency;
          state.meta.messageError = true;
          paint();
          return;
        }
        if (!meta) return;
        state.meta.pending = "whatsapp";
        state.meta.message = T.metaWorking;
        state.meta.messageError = false;
        paint();
        try {
          await meta.connectWhatsApp(state.ws.id, pin, currency);
          state.meta.pin = "";
          state.meta.currency = "";
          state.meta.message = T.metaSuccess;
          state.meta.messageError = false;
          state.meta.pending = "";
          state.meta.loaded = false;
          state.meta.loadFailed = false;
          paint();
          await loadMetaConnections(true);
        } catch (error) {
          state.meta.message = metaFriendlyError(error);
          state.meta.messageError = true;
          state.meta.pending = "";
          paint();
        }
      });
      const igConnect = $("#meta-ig-connect", p);
      if (igConnect) igConnect.addEventListener("click", async () => {
        if (!meta) return;
        state.meta.pending = "instagram";
        state.meta.message = T.metaWorking;
        state.meta.messageError = false;
        paint();
        try {
          const result = await meta.beginInstagram(state.ws.id);
          if (!result.pages || !result.pages.length) throw Object.assign(new Error("instagram_no_eligible_page"), { code: "instagram_no_eligible_page" });
          state.meta.igState = result.state;
          state.meta.igPages = result.pages;
          state.meta.igPageId = result.pages[0].id;
          state.meta.pending = "";
          state.meta.message = T.metaSelectPage;
          state.meta.messageError = false;
          paint();
        } catch (error) {
          state.meta.pending = "";
          state.meta.message = metaFriendlyError(error);
          state.meta.messageError = true;
          paint();
        }
      });
      const pageSelect = $("#meta-ig-page", p);
      if (pageSelect) pageSelect.addEventListener("change", (e) => {
        state.meta.igPageId = e.target.value;
        const finishButton = $("#meta-ig-finish", p);
        if (finishButton) finishButton.disabled = !state.meta.igPageId || !!state.meta.pending;
      });
      const igFinish = $("#meta-ig-finish", p);
      if (igFinish) igFinish.addEventListener("click", async () => {
        if (!meta || !state.meta.igState || !state.meta.igPageId) return;
        state.meta.pending = "instagram_finish";
        state.meta.message = T.metaWorking;
        state.meta.messageError = false;
        paint();
        try {
          await meta.finishInstagram(state.ws.id, state.meta.igState, state.meta.igPageId);
          state.meta.igState = "";
          state.meta.igPages = [];
          state.meta.igPageId = "";
          state.meta.pending = "";
          state.meta.message = T.metaSuccess;
          state.meta.messageError = false;
          state.meta.loaded = false;
          state.meta.loadFailed = false;
          paint();
          await loadMetaConnections(true);
        } catch (error) {
          state.meta.pending = "";
          state.meta.message = metaFriendlyError(error);
          state.meta.messageError = true;
          paint();
        }
      });
      if (!state.meta.loaded && !state.meta.loading) loadMetaConnections(false);
      const wf = $("#ws-form", p);
      if (wf) wf.addEventListener("submit", async (e) => {
        e.preventDefault();
        const v = $("#ws-input").value.trim() || state.ws.name;
        await A.rest("/rest/v1/workspaces?id=eq." + state.ws.id, { method: "PATCH", body: JSON.stringify({ name: v }) });
        state.ws.name = v;
        $("#dash-ws").textContent = v;
        wf.insertAdjacentHTML("beforeend", `<span class="dash-ok">${esc(T.saved)}</span>`);
      });
      const pf = $("#pw-form", p);
      if (pf) pf.addEventListener("submit", async (e) => {
        e.preventDefault();
        const el = $("#pw-input"), out = $("#pw-msg");
        if (el.value.length < 6) { out.textContent = T.pwShort; out.className = "dash-note is-err"; return; }
        try {
          await A.updateUser({ password: el.value });
          el.value = "";
          out.textContent = T.pwOk; out.className = "dash-note is-ok";
        } catch (err) { out.textContent = err.message; out.className = "dash-note is-err"; }
      });
      const ex = $("#export", p);
      if (ex) ex.addEventListener("click", exportData);
      const s2 = $("#signout2", p);
      if (s2) s2.addEventListener("click", () => A.signOut());
    }
  }

  async function saveContact() {
    const name = $("#cf-name").value.trim();
    if (!name) { $("#cf-name").focus(); return; }
    const body = {
      name,
      handle: $("#cf-handle").value.trim() || null,
      channel: $("#cf-ch").value,
      tags: $("#cf-tags").value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
      last_seen: new Date().toISOString()
    };
    if (state.cedit.id) {
      const row = await A.rest("/rest/v1/contacts?id=eq." + state.cedit.id, { method: "PATCH", body: JSON.stringify(body) });
      const i = state.contacts.findIndex((c) => c.id === state.cedit.id);
      if (i > -1) state.contacts[i] = Object.assign({}, state.contacts[i], Array.isArray(row) ? row[0] : body);
    } else {
      const row = await A.rest("/rest/v1/contacts", { method: "POST", body: JSON.stringify(Object.assign({ workspace_id: state.ws.id }, body)) });
      state.contacts.unshift(Array.isArray(row) ? row[0] : row);
    }
    state.cedit = null;
    paint();
  }

  async function deleteContact(id) {
    if (!confirm(T.confirmContact)) return;
    await A.rest("/rest/v1/contacts?id=eq." + id, { method: "DELETE" });
    state.contacts = state.contacts.filter((c) => c.id !== id);
    state.convs = state.convs.filter((c) => c.contact_id !== id);
    if (state.conv && state.conv.contact_id === id) { state.conv = null; state.msgs = []; }
    paint();
  }

  function startChat() {
    alert(T.channelPending);
  }

  function chipsHTML() {
    return [["all", T.fAll], ["open", T.fOpen], ["mine", T.fMine], ["closed", T.fClosed]]
      .map(([k, l]) => `<button type="button" class="dchip${state.filter === k ? " is-on" : ""}" data-filter="${k}">${esc(l)}</button>`).join("");
  }

  function bindInboxList() {
    const p = $("#panel-inbox");
    $$("[data-filter]", p).forEach((b) => b.addEventListener("click", () => {
      state.filter = b.getAttribute("data-filter");
      paint();
    }));
    $$("[data-conv]", p).forEach((b) => b.addEventListener("click", () => openConv(b.getAttribute("data-conv"))));
  }

  async function setStatus(next) {
    state.conv.status = next;
    await A.rest("/rest/v1/conversations?id=eq." + state.conv.id, { method: "PATCH", body: JSON.stringify({ status: next }) });
    paint();
  }

  function starterSteps(tpl, count) {
    const loc = templateCopy(tpl);
    const steps = [{ t: "trigger", text: loc.t }];
    const fillers = [
      { t: "msg", text: T.tplDraftMessage.replace("{name}", loc.t) },
      { t: "delay", v: 15 },
      { t: "msg", text: T.tplDraftFollowup },
      { t: "cond", text: T.tplDraftCondition },
      { t: "tag", text: T.tplSuggestedTag.replace("{cat}", catLabel(tpl.cat)) }
    ];
    let i = 0;
    while (steps.length < Math.max(2, count) && i < 24) {
      steps.push(JSON.parse(JSON.stringify(fillers[i % fillers.length])));
      i++;
    }
    return steps;
  }

  async function useTemplate(id) {
    const tpl = (window.CHATORA_TEMPLATES || []).filter((x) => x.id === id)[0];
    if (!tpl) return;
    const loc = templateCopy(tpl);
    const row = await A.rest("/rest/v1/flows", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: state.ws.id, name: loc.t, channel: tpl.ch === "messenger" ? "instagram" : tpl.ch,
        status: "draft", runs: 0, nodes: starterSteps(tpl, tpl.steps)
      })
    });
    state.flows.unshift(Array.isArray(row) ? row[0] : row);
    state.templates = false;
    state.gq = "";
    paint();
    const ok = document.createElement("div");
    ok.className = "toast";
    ok.textContent = T.gAdded + " · " + loc.t;
    document.body.appendChild(ok);
    setTimeout(() => ok.remove(), 2600);
  }

  function openEditor(id) {
    const f = state.flows.filter((x) => x.id === id)[0];
    if (!f) return;
    state.edit = f;
    state.steps = JSON.parse(JSON.stringify(f.nodes || []));
    paint();
  }

  function bindEditor(p) {
    if (!state.edit) return;
    $("#ed-back", p).addEventListener("click", () => { state.edit = null; state.steps = []; paint(); });
    const nm = $("#ed-name", p);
    if (nm) nm.addEventListener("input", () => { state.edit.name = nm.value; });

    $$(".step-in", p).forEach((el) => el.addEventListener("input", () => {
      const i = +el.getAttribute("data-i"), k = el.getAttribute("data-k");
      state.steps[i][k] = k === "v" ? Math.max(1, parseInt(el.value || "1", 10)) : el.value;
    }));
    $$("[data-move]", p).forEach((b) => b.addEventListener("click", () => {
      const i = +b.getAttribute("data-move"), d = +b.getAttribute("data-dir");
      const j = i + d;
      [state.steps[i], state.steps[j]] = [state.steps[j], state.steps[i]];
      paint();
    }));
    $$("[data-del]", p).forEach((b) => b.addEventListener("click", () => {
      state.steps.splice(+b.getAttribute("data-del"), 1);
      paint();
    }));
    $$("[data-add]", p).forEach((b) => b.addEventListener("click", () => {
      const kind = b.getAttribute("data-add");
      state.steps.push(kind === "delay" ? { t: "delay", v: 10 } : { t: kind, text: "" });
      paint();
    }));
    $("#ed-save", p).addEventListener("click", async () => {
      const name = $("#ed-name").value.trim() || state.edit.name;
      await A.rest("/rest/v1/flows?id=eq." + state.edit.id, {
        method: "PATCH",
        body: JSON.stringify({ name, nodes: state.steps, updated_at: new Date().toISOString() })
      });
      state.edit.name = name;
      state.edit.nodes = state.steps;
      const ok = $("#ed-ok");
      ok.textContent = T.savedFlow;
      setTimeout(() => { ok.textContent = ""; }, 2500);
    });
    const test = $("#ed-test", p);
    if (test) test.addEventListener("click", () => {
      document.body.insertAdjacentHTML("beforeend", testOverlay());
      const close = () => { const m = $("#tmodal"); if (m) m.remove(); };
      $("#tmodal-x").addEventListener("click", close);
      $("#tmodal").addEventListener("click", (e) => { if (e.target.id === "tmodal") close(); });
      document.addEventListener("keydown", function esc(e) {
        if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
      });
      $("#tmodal-play").addEventListener("click", playFlow);
      playFlow();
    });

    $("#ed-del", p).addEventListener("click", async () => {
      if (!confirm(T.confirmDelete)) return;
      await A.rest("/rest/v1/flows?id=eq." + state.edit.id, { method: "DELETE" });
      state.flows = state.flows.filter((f) => f.id !== state.edit.id);
      state.edit = null; state.steps = [];
      paint();
    });
  }

  function testOverlay() {
    return `<div class="tmodal" id="tmodal" role="dialog" aria-modal="true" aria-label="${esc(T.testTitle)}">
      <div class="tmodal-card">
        <header><div><b>${esc(T.testTitle)}</b><span>${esc(state.edit ? state.edit.name : "")}</span></div>
          <button type="button" class="icon-btn" id="tmodal-x" aria-label="${esc(T.testClose)}">✕</button></header>
        <div class="tmodal-body" id="tmodal-body"></div>
        <footer><span class="dash-note">${esc(T.testAuto)}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="tmodal-play">${esc(T.testReplay)}</button></footer>
      </div>
    </div>`;
  }

  function playFlow() {
    const body = $("#tmodal-body");
    const play = $("#tmodal-play");
    if (!body) return;
    body.innerHTML = "";
    if (play) { play.disabled = true; }
    let i = 0;
    const tick = () => {
      if (i >= state.steps.length) {
        body.insertAdjacentHTML("beforeend", `<p class="tmodal-end">${esc(T.testDone)}</p>`);
        if (play) play.disabled = false;
        body.scrollTop = body.scrollHeight;
        return;
      }
      const s = state.steps[i++];
      if (s.t === "delay") {
        body.insertAdjacentHTML("beforeend",
          `<div class="tmodal-sys">⏳ ${esc(T.testWait)} ${num(s.v || 0)} ${esc(T.testMin)}</div>`);
      } else if (s.t === "trigger") {
        body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys is-start">▸ ${esc(s.text || "")}</div>`);
      } else if (s.t === "cond") {
        body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys">❓ ${esc(s.text || "")}</div>`);
      } else if (s.t === "tag") {
        body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys">🏷️ ${esc(s.text || "")}</div>`);
      } else if (s.t === "msg") {
        // A local visual preview only; no AI provider is called and no message is sent.
        body.insertAdjacentHTML("beforeend", `<div class="bub is-out is-typing" id="typing">${esc(T.testTyping)}</div>`);
        body.scrollTop = body.scrollHeight;
        setTimeout(() => {
          const t = $("#typing");
          if (t) t.outerHTML = `<div class="bub is-out">${esc(s.text || "")}<span class="bub-meta">${esc(T.testRole)}</span></div>`;
          body.scrollTop = body.scrollHeight;
          setTimeout(tick, 420);
        }, 620);
        return;
      }
      body.scrollTop = body.scrollHeight;
      setTimeout(tick, s.t === "delay" ? 760 : 560);
    };
    tick();
  }

  async function openConv(id) {
    state.conv = state.convs.filter((c) => c.id === id)[0] || null;
    if (!state.conv) return;
    state.view = "inbox";
    $$(".dash-link").forEach((b) => b.classList.toggle("is-on", b.getAttribute("data-view") === "inbox"));
    try {
      state.msgs = await loadThreadMessages(id);
      if (state.conv.unread) {
        state.conv.unread = 0;
        A.rest("/rest/v1/conversations?id=eq." + id, { method: "PATCH", body: JSON.stringify({ unread: 0 }) }).catch(() => {});
      }
    } catch (e) { state.msgs = []; }
    if (metaProviderForChannel(state.conv.channel)) {
      try {
        const rows = await A.rest("/rest/v1/conversations?select=external_id&id=eq." + encodeURIComponent(id) + "&limit=1");
        if (state.conv && state.conv.id === id) state.conv.external_id = rows && rows[0] ? rows[0].external_id || "" : "";
      } catch (_) {
        if (state.conv && state.conv.id === id) state.conv.external_id = "";
      }
      if (!state.meta.loaded && !state.meta.loading) await loadMetaConnections(false);
    }
    badge();
    paint();
  }

  function exportData() {
    const payload = { exported_at: new Date().toISOString(), workspace: state.ws, flows: state.flows, contacts: state.contacts, conversations: state.convs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chatora-" + (state.ws.name || "workspace").replace(/[^\w-]+/g, "-").toLowerCase() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function wireChrome() {
    $$(".dash-link").forEach((b) => b.addEventListener("click", () => setView(b.getAttribute("data-view"))));
    const build = $("#dash-build");
    if (build) build.addEventListener("click", (e) => { e.preventDefault(); setView("flows"); });
    $("#dash-signout").addEventListener("click", () => A.signOut());
  }

  async function boot() {
    applyAppTranslations();
    const params = new URLSearchParams(location.search);
    const wantsTemplates = params.get("view") === "templates";
    const candidate = params.get("tpl") || "";
    const tplId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(candidate) ? candidate : "";
    const next = wantsTemplates ? "app.html?view=templates" + (tplId ? "&tpl=" + tplId : "") : "app.html";
    const s = await A.ensure();
    if (!s) { location.replace("login.html?next=" + encodeURIComponent(next)); return; }
    if (wantsTemplates) { state.view = "flows"; state.templates = true; state.gq = tplId; }
    try {
      state.ws = await ensureWorkspace(s.user || {});
      await loadAll();
      $("#dash-email").textContent = (s.user && s.user.email) || "";
      $("#dash-ws").textContent = state.ws.name;
      $("#dash-plan").textContent = T.planLabel;
      badge();
      wireChrome();
      startPolling();
      $("#dash-loading").hidden = true;
      $("#dash").hidden = false;
      paint();
    } catch (err) {
      $("#dash-loading").hidden = true;
      $("#dash-error").hidden = false;
      if (err && err.status === 401) $("#dash-error-text").textContent = T.noSession;
      $("#dash-retry").addEventListener("click", () => location.reload());
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
