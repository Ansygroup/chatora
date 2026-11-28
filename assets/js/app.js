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
      of: "/ {n}", pickConversation: "Pick a conversation from the list", csvFileHint: "CSV file up to 2 MB", dataIsolation: "Your data is fully isolated",
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
      noData: "Nothing here yet.", emptyInbox: "No conversations match this filter.", inboxEmpty: "No conversations yet. Add the website widget or connect a messaging channel to receive messages.",
      channelPending: "Connect an official messaging channel before replying or starting conversations. No outgoing message has been sent.",
      sendNeedsMeta: "Connect this WhatsApp or Instagram channel in Settings before replying.",
      sendFeatureOff: "Replies are not enabled in this workspace yet. No message was sent.",
      sendSuccess: "Message sent.", sendBusy: "Sending…", sendRetry: "Retry safely", sendRetryNotice: "No automatic repeat was made. Retry uses the same idempotency key.", sendUnknown: "Delivery status is uncertain. Do not resend until you verify it in the connected channel.",
      sendWindow: "Meta's 24-hour reply window has expired or cannot be verified; no message was sent.",
      sendError: "Could not send the reply. Check the connection and try again.", sendTooLong: "Message is too long. Maximum 1,000 UTF-8 bytes.",
      sendStatusSending: "Sending", sendStatusSent: "Sent", sendStatusDelivered: "Delivered", sendStatusRead: "Read", sendStatusFailed: "Failed", sendStatusUnknown: "Status unknown",
      flowPending: "Flows stay as drafts until a real messaging channel and automation are connected.",
      guideTitle: "Two steps to a ready flow", guide1: "Replace the [bracketed] parts with your own details (offer, link, price)", guide2: "Press Save", guideReadyTitle: "Your flow draft is saved", guideReadyText: "Next step: connect WhatsApp or Instagram so it can reply to real messages. Self-connect is coming soon, so our team sets it up for you (the next page has the link). Until then this stays a draft.", connectCta: "Connect WhatsApp / Instagram", tryOptional: "Try it first (optional)",
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
      sAutoSaving: "Saving\u2026", sAutoSaved: "Saved automatically", sAutoFix: "Not saved yet, fix the invalid link", sAutoErr: "Couldn't save automatically, press Save",
      sCondElse: "If the condition is not met", sCondStop: "Stop the flow", sCondSkipN: "Skip next {n} step(s)", sCondStopped: "Flow stopped (condition not met)",
      savedFlow: "Flow saved", deleteFlow: "Delete this flow", confirmDelete: "Delete this flow and its steps?",
      noSteps: "No steps yet — add the first one below.", flowName: "Flow name",
      pwdTitle: "Password", pwNew: "New password", pwSave: "Change password", pwOk: "Password changed.",
      delTitle: "Delete account", delNote: "Permanently deletes your account, workspace, contacts, conversations and flow drafts. This cannot be undone.",
      delPass: "Current password", delBtn: "Delete my account", delConfirm: "Delete your account and all workspace data permanently?",
      delWrong: "That password is not correct.", delFailed: "The account could not be deleted. Nothing was removed — try again later.",
      delGoogle: "Continue with Google", delGoogleNote: "This account uses Google sign-in. Confirm with the same Google account to delete it.", delWrongAcct: "That Google account does not match this login. Try again with the Google account you signed up with.",
      metaDisconnect: "Disconnect", metaDisconnectConfirm: "Disconnect this channel? Chatora deletes the stored access token and stops receiving its messages.",
      pwShort: "At least 10 characters, with letters and numbers.", exportTitle: "Your data", exportBtn: "Download a JSON copy",
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
      of: "من {n}", pickConversation: "اختار محادثة من القائمة", csvFileHint: "ملف CSV لحد 2 ميجابايت", dataIsolation: "بياناتك معزولة بالكامل",
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
      noData: "لسه مفيش حاجة هنا.", emptyInbox: "مفيش محادثات مطابقة للفلتر ده.", inboxEmpty: "مفيش محادثات لسه. ضيف ودجت الموقع أو اربط قناة مراسلة عشان تستقبل رسائل.",
      channelPending: "اربط قناة مراسلة رسمية قبل الرد أو بدء المحادثات. لم يتم إرسال أي رسالة من مساحة العمل دي.",
      sendNeedsMeta: "اربط قناة واتساب أو إنستجرام دي من الإعدادات قبل الرد.",
      sendFeatureOff: "الردود متوقفة في مساحة العمل دي. ما اتبعتش أي رسالة.",
      sendSuccess: "تم إرسال الرسالة.", sendBusy: "جاري الإرسال…", sendRetry: "أعد المحاولة بأمان", sendRetryNotice: "ما حصلش إعادة إرسال تلقائية. إعادة المحاولة هتستخدم نفس مفتاح منع التكرار.", sendUnknown: "حالة التسليم غير مؤكدة. ما تعيدش الإرسال قبل ما تتأكد من القناة.",
      sendWindow: "انتهت نافذة الرد أو تعذر التحقق منها؛ ما اتبعتش رسالة.",
      sendError: "ماقدرناش نبعت الرد. راجع الاتصال وحاول تاني.", sendTooLong: "الرسالة طويلة. الحد الأقصى 1000 بايت UTF-8.",
      sendStatusSending: "جارٍ الإرسال", sendStatusSent: "أُرسلت", sendStatusDelivered: "تم التسليم", sendStatusRead: "مقروءة", sendStatusFailed: "فشل", sendStatusUnknown: "الحالة غير معروفة",
      flowPending: "السيناريوهات تفضل مسودات لحد ربط قناة مراسلة وتشغيل أتمتة فعلية.",
      guideTitle: "خطوتين وسيناريوك جاهز", guide1: "بدّل الأجزاء اللي بين [أقواس] ببياناتك (العرض، اللينك، السعر)", guide2: "اضغط حفظ", guideReadyTitle: "السيناريو اتحفظ وجاهز", guideReadyText: "الخطوة الجاية: اربط واتساب أو إنستجرام عشان يرد على رسايل حقيقية. الربط الذاتي قريب، فريقنا بيظبطهالك دلوقتي (اللينك في الصفحة الجاية). وطول ما مفيش ربط بيفضل مسودة.", connectCta: "اربط واتساب / إنستجرام", tryOptional: "جرّبه الأول (اختياري)",
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
      sAutoSaving: "بيحفظ\u2026", sAutoSaved: "اتحفظ تلقائي", sAutoFix: "مش اتحفظ، ظبط اللينك الغلط", sAutoErr: "مش قادر يحفظ تلقائي، دوس حفظ",
      sCondElse: "لو الشرط مش متحقق", sCondStop: "أوقف السيناريو", sCondSkipN: "تخطَّ {n} خطوة", sCondStopped: "السيناريو اتوقف (الشرط مش متحقق)",
      savedFlow: "السيناريو اتحفظ", deleteFlow: "امسح السيناريو", confirmDelete: "تمسح السيناريو وخطواته؟",
      noSteps: "مفيش خطوات لسه — ضيف أول واحدة تحت.", flowName: "اسم السيناريو",
      pwdTitle: "الباسورد", pwNew: "باسورد جديد", pwSave: "تغيير الباسورد", pwOk: "الباسورد اتغيّر.",
      delTitle: "حذف الحساب", delNote: "بيحذف حسابك ومساحة العمل وجهات الاتصال والمحادثات ومسودات السيناريوهات نهائيًا. مفيش رجوع بعد كده.",
      delPass: "كلمة السر الحالية", delBtn: "احذف حسابي", delConfirm: "تحذف حسابك وكل بيانات مساحة العمل نهائيًا؟",
      delWrong: "كلمة السر مش صحيحة.", delFailed: "ماقدرناش نحذف الحساب. مفيش حاجة اتحذفت — حاول تاني بعدين.",
      delGoogle: "المتابعة بحساب جوجل", delGoogleNote: "الحساب ده بيستخدم تسجيل الدخول بجوجل. أكّد بنفس حساب جوجل عشان تحذفه.", delWrongAcct: "حساب جوجل ده مش هو حساب الدخول. جرّب بحساب جوجل اللي سجّلت بيه.",
      metaDisconnect: "افصل القناة", metaDisconnectConfirm: "تفصل القناة دي؟ شاتورا هيحذف رمز الوصول المحفوظ وهيوقف استقبال رسايلها.",
      pwShort: "10 حروف على الأقل مع أحرف وأرقام.", exportTitle: "بياناتك", exportBtn: "نزّل نسخة JSON",
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
    view: "overview", templates: false, filter: "all", q: "", edit: null, steps: [], cedit: null, channels: [], chanView: null, gtrig: "all",
    broadcasts: [], bc: { name: "", channel: "all", tag: "", body: "" }, gq: "", gcat: "all", cLimit: 50,
    imp: { open: false, text: "", fileName: "", preview: null, status: "", statusError: false, busy: false },
    meta: { connections: null, loaded: false, loading: false, loadFailed: false, pending: "", message: "", messageError: false, pin: "", currency: "", igState: "", igPages: [], igPageId: "", sendDrafts: {} },
    auto: { timer: 0, busy: false, dirty: false }, pendingStatus: ""
  };

  const CH = {
    instagram: { label: "Instagram", color: "#FF5FA2" }, whatsapp: { label: "WhatsApp", color: "#25D366" },
    tiktok: { label: "TikTok", color: "#2CE5D6" }, messenger: { label: "Messenger", color: "#7C5CFF" },
    telegram: { label: "Telegram", color: "#5AA9E6" }, sms: { label: "SMS", color: "#C9FF6B" },
    email: { label: "Email", color: "#A19DC2" }, web: { label: "Web chat", color: "#A78BFA" }
  };
  const CH_T = { instagram: "channelInstagram", whatsapp: "channelWhatsapp", tiktok: "channelTiktok", messenger: "channelMessenger", telegram: "channelTelegram", sms: "channelSms", email: "channelEmail", web: "channelWeb" };
  const chLabel = (k) => T[CH_T[k]] || (CH[k] || { label: k }).label;
  const STEP_KINDS = ["trigger", "msg", "delay", "cond", "tag", "buy", "webhook"];
  const HOOK_OK = (u) => { try { const x = new URL(u); const h = x.hostname.toLowerCase(); return x.protocol === "https:" && !x.port && !x.username && u.length <= 300 && /^[a-z0-9.-]+$/.test(h) && h.indexOf(".") > 0 && !/^\d+(\.\d+)*$/.test(h) && !/\.(local|internal|localhost|lan|home|corp|arpa)$/.test(h); } catch (e) { return false; } };
  const BUY_RE = /^https:\/\/(buy|donate)\.stripe\.com\/[A-Za-z0-9_\-\/?=&%.]{4,300}$/;
  const chColor = (k) => (CH[k] || { color: "#7C5CFF" }).color;

  /* ---------- channels (Phase 1: Telegram + Web chat; Meta gated) ---------- */
  const CHS_EN = {
    chTitle: "Channels", chSub: "Connect the places your customers message you.",
    tgLine: "Your own Telegram bot, live in two clicks.",
    webLine: "The chat bubble for your website. Paste one snippet, done.",
    soon: "Coming soon", connect: "Connect", manage: "Manage", openDetail: "Open",
    connected: "Connected", disabledSt: "Disabled", connErr: "Connection problem",
    refresh: "Refresh", disable: "Disable", enable: "Enable", remove: "Remove", back2: "Back to channels",
    removeWarn: "Remove this channel? Messages stop arriving and past chats stay in the inbox. This cannot be undone.",
    tgTitle: "Connect Telegram",
    tgHow1: "In Telegram, open @BotFather and send /newbot to create your bot.",
    tgHow2: "Copy the token it gives you and paste it here.",
    tgPh: "123456789:AAEx\u2026", tgGo: "Validate and connect", tgBusy: "Checking\u2026",
    tgBad: "That token did not work. Check it and try again.",
    tgFail: "Connection failed. Please try again.",
    tgDone: "Telegram connected",
    emLine: "\u0639\u0646\u0648\u0627\u0646 \u0628\u0631\u064a\u062f \u062e\u0627\u0635 \u0628\u0643 \u0644\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621. \u062a\u0635\u0644 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0625\u0644\u0649 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0648\u0627\u0631\u062f \u0648\u064a\u0645\u0643\u0646 \u0644\u0644\u0633\u064a\u0646\u0627\u0631\u064a\u0648\u0647\u0627\u062a \u0623\u0646 \u062a\u062a\u0641\u0627\u0639\u0644. \u0627\u0644\u0631\u062f\u0648\u062f \u0628\u0627\u0644\u0628\u0631\u064a\u062f \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u0628\u0639\u062f.",
    emAddr: "\u0639\u0646\u0648\u0627\u0646\u0643", emCopy: "\u0646\u0633\u062e", emCopied: "\u062a\u0645 \u0627\u0644\u0646\u0633\u062e",
    emNote: "\u0623\u0631\u0633\u0644 \u0623\u0648 \u062d\u0648\u0651\u0644 \u0628\u0631\u064a\u062f\u064b\u0627 \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0648\u0633\u064a\u0638\u0647\u0631 \u0641\u064a \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0648\u0627\u0631\u062f. \u0627\u0644\u0631\u062f\u0648\u062f \u0627\u0644\u0622\u0644\u064a\u0629 \u0628\u0627\u0644\u0628\u0631\u064a\u062f \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u0628\u0639\u062f.",
    emFail: "\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0639\u0646\u0648\u0627\u0646. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.",
    emLine: "Your own email address for customer mail. Messages land in the Inbox and flows can react. Replies by email are not sent yet.",
    emAddr: "Your address", emCopy: "Copy", emCopied: "Copied",
    emNote: "Send or forward mail to this address and it appears in your Inbox. Auto-replies by email are not available yet.",
    emFail: "Could not create the address. Please try again.",
    status: "Status", handle: "Handle", hookOk: "Webhook active",
    popular: "Popular", trigAll: "All triggers", trig_comment: "Comments", trig_story: "Stories & mentions", trig_dm: "DM & keywords", trig_cart: "Cart & checkout", trig_other: "Other",
    obChan: "Connect your first channel",
    bpTitle: "Basic pack", bpNote: "One click adds a welcome message, an FAQ starter and a main menu as editable drafts. Review them, then set each to Live.", bpBtn: "Add the basic pack", bpDone: "Basic pack added as drafts. Open Flows to review and publish.", bpHave: "Basic pack already added.",
  };
  const CHS_AR = {
    chTitle: "\u0627\u0644\u0642\u0646\u0648\u0627\u062a", chSub: "\u0627\u0631\u0628\u0637 \u0627\u0644\u0623\u0645\u0627\u0643\u0646 \u0627\u0644\u062a\u064a \u064a\u0631\u0627\u0633\u0644\u0643 \u0645\u0646\u0647\u0627 \u0639\u0645\u0644\u0627\u0624\u0643.",
    tgLine: "\u0628\u0648\u062a \u062a\u064a\u0644\u064a\u062c\u0631\u0627\u0645 \u0627\u0644\u062e\u0627\u0635 \u0628\u0643 \u064a\u0639\u0645\u0644 \u0628\u062e\u0637\u0648\u062a\u064a\u0646.",
    webLine: "\u0641\u0642\u0627\u0639\u0629 \u0627\u0644\u062f\u0631\u062f\u0634\u0629 \u0644\u0645\u0648\u0642\u0639\u0643. \u0627\u0644\u0635\u0642 \u0643\u0648\u062f\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0648\u0627\u0646\u062a\u0647\u0649.",
    soon: "\u0642\u0631\u064a\u0628\u064b\u0627", connect: "\u0631\u0628\u0637", manage: "\u0625\u062f\u0627\u0631\u0629", openDetail: "\u0641\u062a\u062d",
    connected: "\u0645\u062a\u0635\u0644", disabledSt: "\u0645\u0639\u0637\u0651\u0644", connErr: "\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u0627\u062a\u0635\u0627\u0644",
    refresh: "\u062a\u062d\u062f\u064a\u062b", disable: "\u062a\u0639\u0637\u064a\u0644", enable: "\u062a\u0641\u0639\u064a\u0644", remove: "\u0625\u0632\u0627\u0644\u0629", back2: "\u0631\u062c\u0648\u0639 \u0644\u0644\u0642\u0646\u0648\u0627\u062a",
    removeWarn: "\u0625\u0632\u0627\u0644\u0629 \u0647\u0630\u0647 \u0627\u0644\u0642\u0646\u0627\u0629\u061f \u0633\u062a\u062a\u0648\u0642\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0639\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0648\u064a\u0628\u0642\u0649 \u0633\u062c\u0644\u0647\u0627 \u0641\u064a \u0627\u0644\u0628\u0631\u064a\u062f. \u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u062a\u0631\u0627\u062c\u0639.",
    tgTitle: "\u0631\u0628\u0637 \u062a\u064a\u0644\u064a\u062c\u0631\u0627\u0645",
    tgHow1: "\u0641\u064a \u062a\u064a\u0644\u064a\u062c\u0631\u0627\u0645 \u0627\u0641\u062a\u062d @BotFather \u0648\u0623\u0631\u0633\u0644 /newbot \u0644\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0628\u0648\u062a.",
    tgHow2: "\u0627\u0646\u0633\u062e \u0627\u0644\u062a\u0648\u0643\u0646 \u0648\u0627\u0644\u0635\u0642\u0647 \u0647\u0646\u0627.",
    tgPh: "123456789:AAEx\u2026", tgGo: "\u062a\u062d\u0642\u0642 \u0648\u0627\u0631\u0628\u0637", tgBusy: "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0642\u0642\u2026",
    tgBad: "\u0627\u0644\u062a\u0648\u0643\u0646 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d. \u062a\u0623\u0643\u062f \u0645\u0646\u0647 \u0648\u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u064b\u0627.",
    tgFail: "\u0641\u0634\u0644 \u0627\u0644\u0631\u0628\u0637. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.",
    tgDone: "\u062a\u0645 \u0631\u0628\u0637 \u062a\u064a\u0644\u064a\u062c\u0631\u0627\u0645",
    status: "\u0627\u0644\u062d\u0627\u0644\u0629", handle: "\u0627\u0644\u0645\u0639\u0631\u0651\u0641", hookOk: "\u0627\u0644\u0648\u064a\u0628 \u0647\u0648\u0643 \u064a\u0639\u0645\u0644",
    popular: "\u0634\u0627\u0626\u0639", trigAll: "\u0643\u0644 \u0627\u0644\u0645\u0634\u063a\u0644\u0627\u062a", trig_comment: "\u0627\u0644\u062a\u0639\u0644\u064a\u0642\u0627\u062a", trig_story: "\u0627\u0644\u0642\u0635\u0635 \u0648\u0627\u0644\u0625\u0634\u0627\u0631\u0627\u062a", trig_dm: "\u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0648\u0627\u0644\u0643\u0644\u0645\u0627\u062a", trig_cart: "\u0627\u0644\u0633\u0644\u0629 \u0648\u0627\u0644\u062f\u0641\u0639", trig_other: "\u0623\u062e\u0631\u0649",
    obChan: "\u0627\u0631\u0628\u0637 \u0623\u0648\u0644 \u0642\u0646\u0627\u0629",
    bpTitle: "الباقة الأساسية", bpNote: "بضغطة واحدة تُضاف رسالة ترحيب وأسئلة شائعة وقائمة رئيسية كمسودات قابلة للتعديل. راجعها ثم فعّل كل واحدة.", bpBtn: "أضف الباقة الأساسية", bpDone: "أُضيفت الباقة الأساسية كمسودات. افتح السيناريوهات للمراجعة والنشر.", bpHave: "الباقة الأساسية مضافة بالفعل.",
  };
  const CHS = Object.assign({}, CHS_EN, ({ ar: CHS_AR })[LANG] || {});
  const TK_EN = {
    fieldsTitle: "Custom fields", fieldKeyPh: "Key (e.g. city)", fieldValPh: "Value",
    addField: "Add field",
    tokensHint: "Tokens: {name} · {handle} · {tags} · {field:key}",
    unit: "Unit", uMin: "minutes", uHour: "hours", uDay: "days",
    seqTitle: "Sequence", seqPick: "Choose a live flow", enroll: "Enroll", stopSeq: "Stop", enrolledOk: "Enrolled. The first step runs now.", stoppedOk: "Stopped.",
    tgNoConn: "Connect Telegram in Settings, Channels, to reply here.",
    trigEvents: "Contact events: event:tag-applied vip · event:tag-removed vip · event:field-changed city · event:schedule field:renewal_at. Live flows fire on these; messages send on Telegram and web chat."
  };
  const TK_AR = {
    fieldsTitle: "حقول مخصصة", fieldKeyPh: "المفتاح (مثال: المدينة)", fieldValPh: "القيمة",
    addField: "إضافة حقل",
    tokensHint: "متغيرات: {name} · {handle} · {tags} · {field:key}",
    unit: "الوحدة", uMin: "دقائق", uHour: "ساعات", uDay: "أيام",
    seqTitle: "سلسلة رسائل", seqPick: "اختر سيناريو مباشر", enroll: "اشترك", stopSeq: "أوقف", enrolledOk: "تم الاشتراك. أول خطوة تعمل الآن.", stoppedOk: "تم الإيقاف.",
    tgNoConn: "اربط تيليجرام من الإعدادات، القنوات، لتتمكن من الرد هنا.",
    trigEvents: "أحداث جهات الاتصال: event:tag-applied vip · event:tag-removed vip · event:field-changed city · event:schedule field:renewal_at. تعمل السيناريوهات المباشرة مع هذه الأحداث؛ تُرسل الرسائل عبر تيليجرام والدردشة."
  };
  const TK = Object.assign({}, TK_EN, ({ ar: TK_AR })[LANG] || {});
  const tgConn = () => (state.channels || []).filter((c) => c.provider === "telegram")[0] || null;
  const emConn = () => (state.channels || []).filter((c) => c.provider === "email")[0] || null;
  function chanStatusChip(c) {
    if (!c) return "";
    const st = c.status === "connected" ? ["is-on", CHS.connected] : c.status === "disconnected" ? ["is-off", CHS.disabledSt] : ["is-err", CHS.connErr];
    return `<span class="chan-status ${st[0]}">${esc(st[1])}</span>`;
  }
  function renderChannelsBlock() {
    if (state.chanView) return renderChannelDetail();
    const tg = tgConn();
    const tgCard = `<section class="chan-card" aria-label="Telegram"><div class="chan-head"><span class="chan-name">Telegram</span><span class="chan-mark is-tg" aria-hidden="true">\u2708</span></div>` +
      `<p class="chan-line">${esc(CHS.tgLine)}</p><div class="chan-foot">${chanStatusChip(tg)}` +
      (tg ? `<button type="button" class="btn btn-ghost btn-sm" id="ch-open">${esc(CHS.manage)}</button>`
          : `<button type="button" class="btn btn-primary btn-sm" id="ch-tg-connect">${esc(CHS.connect)}</button>`) + `</div></section>`;
    const webCard = `<section class="chan-card" aria-label="${esc(chLabel("web"))}"><div class="chan-head"><span class="chan-name">${esc(chLabel("web"))}</span><span class="chan-mark is-web" aria-hidden="true">\u25c9</span></div>` +
      `<p class="chan-line">${esc(CHS.webLine)}</p><div class="chan-foot"><button type="button" class="btn btn-ghost btn-sm" id="ch-web-manage">${esc(CHS.manage)}</button></div></section>`;
    const gated = [["whatsapp", "is-wa", "W"], ["instagram", "is-ig", "\u25ce"], ["messenger", "is-ms", "M"]].map(([k, cls, mark]) =>
      `<section class="chan-card" aria-label="${esc(chLabel(k))}"><div class="chan-head"><span class="chan-name">${esc(chLabel(k))}</span><span class="chan-mark ${cls}" aria-hidden="true">${mark}</span></div>` +
      `<div class="chan-foot"><span class="chan-badge">${esc(CHS.soon)}</span></div></section>`).join("");
    const em = emConn();
    const emailCard = `<section class="chan-card" aria-label="${esc(chLabel("email"))}"><div class="chan-head"><span class="chan-name">${esc(chLabel("email"))}</span><span class="chan-mark is-em" aria-hidden="true">@</span></div>` +
      `<p class="chan-line">${esc(CHS.emLine)}</p>` +
      (em ? `<div class="chan-kv" style="margin-bottom:10px"><span>${esc(CHS.emAddr)}</span><b dir="ltr">${esc(em.id)}@chatora.us.ci</b></div><p class="dash-note">${esc(CHS.emNote)}</p><div class="chan-foot">${chanStatusChip(em)}` +
            `<button type="button" class="btn btn-ghost btn-sm" id="ch-em-copy">${esc(CHS.emCopy)}</button>` +
            `<button type="button" class="btn btn-ghost btn-sm btn-danger" id="ch-em-remove">${esc(CHS.remove)}</button></div>`
          : `<div class="chan-foot"><button type="button" class="btn btn-primary btn-sm" id="ch-em-connect">${esc(CHS.connect)}</button></div>`) + `</section>`;
    return `<div class="dash-card"><h2>${esc(CHS.chTitle)}</h2><p class="dash-note">${esc(CHS.chSub)}</p>` +
      `<div class="chan-grid">${tgCard}${webCard}${emailCard}${gated}</div></div>`;
  }
  function renderChannelDetail() {
    const c = tgConn();
    if (!c) { state.chanView = null; return renderChannelsBlock(); }
    return `<div class="dash-card"><h2>Telegram</h2>` +
      `<div class="chan-kv"><span>${esc(CHS.status)}</span><b>${chanStatusChip(c)}</b>` +
      `<span>${esc(CHS.handle)}</span><b>${esc(c.display_name || "\u2014")}</b>` +
      `<span>Webhook</span><b>${c.status === "connected" ? esc(CHS.hookOk) : "\u2014"}</b></div>` +
      `<div class="dash-inline" style="flex-wrap:wrap">` +
      `<button type="button" class="btn btn-ghost btn-sm" id="ch-refresh">${esc(CHS.refresh)}</button>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="ch-toggle">${esc(c.status === "disconnected" ? CHS.enable : CHS.disable)}</button>` +
      `<button type="button" class="btn btn-ghost btn-sm btn-danger" id="ch-remove">${esc(CHS.remove)}</button>` +
      `<button type="button" class="link-btn" id="ch-back">${esc(CHS.back2)}</button></div>` +
      `<p class="dash-note" id="ch-msg" role="status"></p></div>`;
  }
  async function loadChannels() {
    try { state.channels = (await A.rest("/rest/v1/channel_connections?select=id,provider,display_name,status,created_at&order=created_at.asc")) || []; }
    catch (e) { state.channels = []; }
  }
  async function tgApi(path, body) {
    const s = await A.ensure();
    if (!s || !s.access_token) throw new Error("no_session");
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + s.access_token }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw Object.assign(new Error((j && j.error) || "failed"), { code: (j && j.error) || "failed" });
    return j;
  }
  function closeTgModal() { const m = document.getElementById("tgmodal"); if (m) m.remove(); }
  function openTgModal() {
    closeTgModal();
    const wrap = document.createElement("div");
    wrap.innerHTML = `<div class="tmodal" id="tgmodal" role="dialog" aria-modal="true" aria-label="${esc(CHS.tgTitle)}">` +
      `<div class="tmodal-card"><header style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line)"><b>${esc(CHS.tgTitle)}</b>` +
      `<button type="button" class="icon-btn" id="tgmodal-x" aria-label="${esc(CHS.tgCancel || "Close")}">\u2715</button></header>` +
      `<div class="tmodal-body" style="padding:16px"><ol class="tg-steps"><li>${esc(CHS.tgHow1)}</li><li>${esc(CHS.tgHow2)}</li></ol>` +
      `<form id="tg-form"><input id="tg-token" class="dstep-in" style="width:100%" dir="ltr" autocomplete="off" spellcheck="false" placeholder="${esc(CHS.tgPh)}" aria-label="Bot token">` +
      `<div class="dash-inline" style="margin-top:12px"><button type="submit" class="btn btn-primary btn-sm" id="tg-go">${esc(CHS.tgGo)}</button>` +
      `<span class="dash-note" id="tg-msg" role="status"></span></div></form></div></div></div>`;
    document.body.appendChild(wrap.firstChild);
    const m = document.getElementById("tgmodal");
    m.addEventListener("click", (e) => { if (e.target.id === "tgmodal") closeTgModal(); });
    document.getElementById("tgmodal-x").addEventListener("click", closeTgModal);
    const inp = document.getElementById("tg-token");
    if (inp) inp.focus();
    document.getElementById("tg-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("tg-msg"), go = document.getElementById("tg-go");
      const token = inp.value.trim();
      go.disabled = true; msg.textContent = CHS.tgBusy; msg.className = "dash-note";
      try {
        const r = await tgApi("/api/channels/telegram/connect", { token: token, workspace: state.ws.id });
        closeTgModal();
        await loadChannels();
        state.chanView = r.id;
        paint();
        const ok = document.createElement("div");
        ok.className = "toast";
        ok.textContent = CHS.tgDone + (r.handle ? " \u00b7 " + r.handle : "");
        document.body.appendChild(ok);
        setTimeout(() => ok.remove(), 2600);
      } catch (err) {
        msg.textContent = (err && (err.code === "invalid token" || err.code === "bad token")) ? CHS.tgBad : CHS.tgFail;
        msg.className = "dash-note is-err";
        go.disabled = false;
      }
    });
  }
  function chanWire(p) {
    const open = $("#ch-tg-connect", p);
    if (open) open.addEventListener("click", openTgModal);
    const od = $("#ch-open", p);
    if (od) od.addEventListener("click", () => { const c = tgConn(); state.chanView = c ? c.id : null; paint(); });
    const wm = $("#ch-web-manage", p);
    if (wm) wm.addEventListener("click", () => { const el = document.getElementById("wk-card"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
    const back = $("#ch-back", p);
    if (back) back.addEventListener("click", () => { state.chanView = null; paint(); });
    const msg = () => $("#ch-msg", p);
    const rf = $("#ch-refresh", p);
    if (rf) rf.addEventListener("click", async () => {
      const c = tgConn(); if (!c) return;
      rf.disabled = true; const m = msg(); if (m) m.textContent = CHS.tgBusy;
      try { await tgApi("/api/channels/telegram/action", { id: c.id, action: "refresh" }); await loadChannels(); paint(); }
      catch (e) { if (m) { m.textContent = CHS.tgFail; m.className = "dash-note is-err"; } rf.disabled = false; }
    });
    const tg = $("#ch-toggle", p);
    if (tg) tg.addEventListener("click", async () => {
      const c = tgConn(); if (!c) return;
      const next = c.status === "disconnected" ? "connected" : "disconnected";
      tg.disabled = true;
      try {
        await A.rest("/rest/v1/channel_connections?id=eq." + encodeURIComponent(c.id), { method: "PATCH", body: JSON.stringify({ status: next, updated_at: new Date().toISOString() }) });
        await loadChannels(); paint();
      } catch (e) { const m = msg(); if (m) { m.textContent = CHS.tgFail; m.className = "dash-note is-err"; } tg.disabled = false; }
    });
    const emc = $("#ch-em-connect", p);
    if (emc) emc.addEventListener("click", async () => {
      emc.disabled = true;
      try {
        const emid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2));
        await A.rest("/rest/v1/channel_connections", { method: "POST", body: JSON.stringify({ id: emid, workspace_id: state.ws.id, provider: "email", display_name: "Email", external_account_id: emid + "@chatora.us.ci", status: "connected" }) });
        await loadChannels(); paint();
      } catch (e) {
        emc.disabled = false;
        const tt = document.createElement("div"); tt.className = "toast"; tt.textContent = CHS.emFail; document.body.appendChild(tt); setTimeout(() => tt.remove(), 2600);
      }
    });
    const emcopy = $("#ch-em-copy", p);
    if (emcopy) emcopy.addEventListener("click", async () => {
      const c = emConn(); if (!c) return;
      try { await navigator.clipboard.writeText(c.id + "@chatora.us.ci"); emcopy.textContent = CHS.emCopied; setTimeout(() => { emcopy.textContent = CHS.emCopy; }, 1600); } catch (e) {}
    });
    const emrm = $("#ch-em-remove", p);
    if (emrm) emrm.addEventListener("click", async () => {
      const c = emConn(); if (!c) return;
      if (!window.confirm(CHS.removeWarn)) return;
      emrm.disabled = true;
      try { await A.rest("/rest/v1/channel_connections?id=eq." + encodeURIComponent(c.id), { method: "DELETE" }); await loadChannels(); paint(); }
      catch (e) { emrm.disabled = false; }
    });
    const rm = $("#ch-remove", p);
    if (rm) rm.addEventListener("click", async () => {
      const c = tgConn(); if (!c) return;
      if (!window.confirm(CHS.removeWarn)) return;
      rm.disabled = true;
      try {
        await tgApi("/api/channels/telegram/action", { id: c.id, action: "remove" });
        state.chanView = null;
        await loadChannels(); paint();
      } catch (e) { const m = msg(); if (m) { m.textContent = CHS.tgFail; m.className = "dash-note is-err"; } rm.disabled = false; }
    });
  }

  /* ---------- template trigger kinds + popularity ---------- */
  const TRIG_KINDS = ["all", "comment", "story", "dm", "cart", "other"];
  const POPULAR_TPLS = { "comment-to-dm-starter": 1, "reel-virality-guard": 1, "story-mention-thank-you": 1, "dm-price-answer": 1, "follower-only-drop": 1, "abandoned-dm-recovery": 1 };
  function tplTrig(id) {
    const f = (window.CHATORA_TEMPLATE_FLOWS || {})[id];
    const t = f && f.en && f.en[0] ? String(f.en[0].text || "") : "";
    if (/comment/i.test(t)) return "comment";
    if (/story|mention/i.test(t)) return "story";
    if (/cart|checkout|abandon/i.test(t)) return "cart";
    if (/\bDM\b|direct message|keyword/i.test(t)) return "dm";
    return "other";
  }
  function galleryCards(rows) {
    return rows.map((x) => {
      const loc = templateCopy(x);
      return `<article class="gtpl"><header><span class="pill" style="--c:${chColor(x.ch)}">${esc(chLabel(x.ch))}</span>` +
        (POPULAR_TPLS[x.id] ? `<span class="gtpl-pop">${esc(CHS.popular)}</span>` : "") +
        `<span class="gtpl-steps">${num(x.steps)} ${esc(T.gSteps)}</span></header>` +
        `<h3>${esc(loc.t)}</h3><p>${esc(loc.d)}</p>` +
        `<button type="button" class="btn btn-ghost btn-sm" data-guse="${esc(x.id)}">${esc(T.gUse)}</button></article>`;
    }).join("");
  }
  function galleryFiltered() {
    const all = window.CHATORA_TEMPLATES || [];
    const q = state.gq.toLowerCase();
    return all.filter((x) => {
      const loc = templateCopy(x);
      return (state.gcat === "all" || x.cat === state.gcat) &&
        (state.gtrig === "all" || tplTrig(x.id) === state.gtrig) &&
        (!q || (loc.t + " " + loc.d + " " + x.id).toLowerCase().indexOf(q) !== -1);
    }).sort((a, b) => ((POPULAR_TPLS[b.id] || 0) - (POPULAR_TPLS[a.id] || 0)));
  }

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
      const rows = await A.rest("/rest/v1/contacts?select=id,name,handle,channel,tags,fields,last_seen&order=last_seen.desc,id.asc&limit=" + size + "&offset=" + offset);
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
      A.rest("/rest/v1/broadcasts?select=id,name,channel,body,audience,sent,created_at&order=created_at.desc&limit=20"),
      A.rest("/rest/v1/short_links?select=flow_id,clicks&limit=1000").catch(() => [])
    ]);
    state.clicks = {};
    (res[4] || []).forEach((l) => { state.clicks[l.flow_id] = (state.clicks[l.flow_id] || 0) + (l.clicks || 0); });
    state.flows = res[0] || [];
    state.contacts = res[1] || [];
    state.convs = res[2] || [];
    state.broadcasts = res[3] || [];
    await loadChannels();
    wkLoad();
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
      return onboarding() + bpCard() + `<div class="dash-card dash-empty-card"><h2>${esc(T.emptyWs)}</h2>` +
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
    return onboarding() + bpCard() + `<div class="kpis">${kpi(T.kContacts, num(state.contacts.length), of("100"))}${kpi(T.kFlows, num(live), of(num(state.flows.length)))}` +
      `${kpi(T.kOpen, num(open), "")}${kpi(T.kRuns, num(runs), "")}</div>` +
      `<div class="dash-grid"><div class="dash-card"><h2>${esc(T.runsBy)}</h2>${bars(byFlow)}</div>` +
      `<div class="dash-card"><h2>${esc(T.channels)}</h2>${bars(byChan, (i) => chColor(i.c))}</div></div>` +
      `<div class="dash-card"><h2>${esc(T.recent)}</h2>${convList(true)}</div>`;
  }

  function onboardHidden() {
    try { return localStorage.getItem("chatora.onboard.hide") === "1"; } catch (e) { return false; }
  }

  function bpCard() {
    if (basicPackHave()) return "";
    return `<div class="dash-card"><h2>${esc(CHS.bpTitle)}</h2><p class="muted">${esc(CHS.bpNote)}</p>` +
      `<button type="button" class="btn btn-primary btn-sm" data-basic-pack>${esc(CHS.bpBtn)}</button></div>`;
  }

  function onboarding() {
    if (onboardHidden()) return "";
    const steps = [
      { done: !/·\s*workspace$/.test(state.ws.name), txt: T.ob1, view: "settings" },
      { done: state.flows.some((f) => (f.nodes || []).length >= 2), txt: T.ob2, view: "flows" },
      { done: state.contacts.length > 0, txt: T.ob3, view: "contacts" },
      { done: !!tgConn() || WK.keys.length > 0, txt: CHS.obChan, view: "settings" }
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

  const BIDI = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C\u200B-\u200D\uFEFF]/g;
  const tidy = (s, n) => String(s == null ? "" : s).replace(BIDI, "").slice(0, n);
  const VIEWS = ["overview", "inbox", "flows", "contacts", "broadcast", "settings"];
  function strongPw(v) { return v.length >= 10 && /\d/.test(v) && /[^\d\s]/.test(v); }
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
      return `<li><button type="button" class="conv-item" data-conv="${esc(c.id)}">` +
        `<span class="conv-av" style="--c:${chColor(c.channel)}">${esc(name.slice(0, 1))}</span>` +
        `<span class="conv-mid"><b>${esc(name)}</b><span>${esc(chLabel(c.channel))} · ${esc(st)}</span></span>` +
        `<span class="conv-end">${esc(when(c.last_at))}${c.unread ? `<i class="conv-unread">${num(Number(c.unread) || 0)}</i>` : ""}</span></button></li>`;
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
    if (String(c.channel) === "web" || String(c.channel) === "telegram") return renderWebReplyArea(c);
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

  function renderWebReplyArea(c) {
    const draft = replyDraftFor(c.id);
    return `<form class="thread-form" id="meta-reply-form" autocomplete="off">` +
      `<textarea id="meta-reply-input" rows="2" maxlength="1000" dir="auto" aria-label="${esc(T.typeMsg)}" placeholder="${esc(T.typeMsg)}"${draft.busy ? " disabled" : ""}>${esc(draft.text)}</textarea>` +
      `<p class="dash-note tokens-hint">${esc(TK.tokensHint)}</p>` +
      `<button type="submit" class="btn btn-primary btn-sm" id="meta-reply-submit"${draft.busy || !draft.text.trim() ? " disabled" : ""}>${esc(draft.busy ? T.sendBusy : T.send)}</button>` +
      `<p class="dash-note meta-send-status${draft.noticeError ? " is-err" : (draft.notice === T.sendSuccess ? " is-ok" : "")}" id="meta-send-status" role="status" aria-live="polite">${esc(draft.notice)}</p>` +
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
    const rows = galleryFiltered();
    const chips = CATS.map((c) =>
      `<button type="button" class="dchip${state.gcat === c ? " is-on" : ""}" data-gcat="${c}">${esc(catLabel(c))}</button>`).join("");
    const tchips = TRIG_KINDS.map((k) =>
      `<button type="button" class="dchip${state.gtrig === k ? " is-on" : ""}" data-gtrig="${k}">${esc(k === "all" ? CHS.trigAll : CHS["trig_" + k])}</button>`).join("");
    const cards = galleryCards(rows);
    return `<div class="dash-head"><button type="button" class="btn btn-ghost btn-sm" id="g-back">← ${esc(T.back)}</button>` +
      `<input id="g-search" class="dash-search" type="search" aria-label="${esc(T.gSearch)}" placeholder="${esc(T.gSearch)}" value="${esc(state.gq)}"><button type="button" class="btn btn-primary btn-sm" id="g-blank">${esc(BLANK.b)}</button></div>` +
      `<div class="dash-card"><h2>${esc(T.gTitle)}</h2><p class="dash-note">${esc(T.gNote)}</p>` +
      `<div class="dchips">${chips}</div>` +
      `<div class="dchips" style="margin-top:6px">${tchips}</div>` +
      `<div class="gtpl-grid">${cards || `<p class="dash-empty">${esc(T.gNone)}</p>`}</div>` +
      `<p class="dash-note">${esc(T.gStarter)}</p></div>`;
  }

  const DUP = { en: ["Duplicate", "copy"], ar: ["نسخ", "نسخة"], es: ["Duplicar", "copia"], fr: ["Dupliquer", "copie"], de: ["Duplizieren", "Kopie"], pt: ["Duplicar", "cópia"] }[LANG] || ["Duplicate", "copy"];
  async function duplicateFlow(id) {
    const f = state.flows.filter((x) => x.id === id)[0];
    if (!f) return;
    const row = await A.rest("/rest/v1/flows", { method: "POST", body: JSON.stringify({ workspace_id: state.ws.id, name: (f.name + " (" + DUP[1] + ")").slice(0, 120), channel: f.channel, status: "draft", runs: 0, nodes: JSON.parse(JSON.stringify(f.nodes || [])) }) });
    const made = Array.isArray(row) ? row[0] : row;
    if (made) { state.flows.unshift(made); paint(); }
  }
  function renderFlows() {
    if (state.edit) return renderEditor();
    if (state.templates) return renderGallery();

    const tpl = "";

    if (!T.fTrack) { T.fTrack = AR ? "تتبّع الروابط (كل رابط https في الرسائل يتحوّل لرابط قصير ونعد النقرات)" : "Track links (https links in messages become short links and clicks are counted)"; T.fFolder = AR ? "المجلد" : "Folder"; T.fFolderPh = AR ? "مثلاً: مبيعات" : "e.g. Sales"; T.fAll = AR ? "الكل" : "All"; T.fClicks = AR ? "نقرة" : "clicks"; T.fCtr = AR ? "نسبة النقر" : "CTR"; }
    const folderOf = (f) => String((f.nodes && f.nodes[0] && f.nodes[0].folder) || "").slice(0, 30);
    const folders = Array.from(new Set(state.flows.map(folderOf).filter(Boolean))).sort();
    if (state.folder && folders.indexOf(state.folder) === -1) state.folder = "";
    const chips = folders.length ? `<div class="flow-folders" role="group" style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px">` +
      [""].concat(folders).map((n) => `<button type="button" class="btn btn-sm ${(state.folder || "") === n ? "btn-primary" : "btn-ghost"}" data-folder="${esc(n)}" aria-pressed="${(state.folder || "") === n ? "true" : "false"}">${esc(n || T.fAll)}</button>`).join("") + `</div>` : "";
    const cards = state.flows.filter((f) => !state.folder || folderOf(f) === state.folder).map((f) => {
      /* Values from the database are whitelisted before they reach markup. */
      const st = ["live", "paused", "draft"].indexOf(f.status) !== -1 ? f.status : "draft";
      const steps = (f.nodes || []).length;
      return `<article class="flow-card"><header><span class="flow-ch" style="--c:${chColor(f.channel)}">${esc(chLabel(f.channel))}</span>` +
        `<span class="flow-status is-${st}">${esc(T[st])}</span></header><h3>${esc(f.name)}</h3>` +
        `<p class="flow-meta">${num(f.runs)} ${esc(T.runs)}${(f.nodes && f.nodes[0] && f.nodes[0].track === true) || (state.clicks && state.clicks[f.id]) ? ` · ${num((state.clicks && state.clicks[f.id]) || 0)} ${esc(T.fClicks)}${f.runs > 0 ? " · " + esc(T.fCtr) + " " + Math.min(100, Math.round((((state.clicks && state.clicks[f.id]) || 0) / f.runs) * 100)) + "%" : ""}` : ""}${folderOf(f) ? ` · 📁 ${esc(folderOf(f))}` : ""}${steps ? ` · ${num(steps)} ${esc(T.steps)}` : ""} · ${esc(when(f.updated_at))}</p>` +
        `<div class="flow-foot"><button type="button" class="btn btn-ghost btn-sm" data-edit="${esc(f.id)}">${esc(T.edit)}</button> <button type="button" class="btn btn-ghost btn-sm" data-dup="${esc(f.id)}">${esc(DUP[0])}</button></div></article>`;
    }).join("");

    return `<div class="dash-head"><span></span><button type="button" class="btn btn-primary btn-sm" data-new-flow>+ ${esc(T.newFlow)}</button></div>` +
      `<p class="dash-note flow-pending" role="status">${esc(T.flowPending)}</p>` +
      tpl + chips + `<div class="flow-grid">${cards || `<p class="dash-empty">${esc(T.noData)}</p>`}</div>`;
  }

  function renderEditor() {
    const f = state.edit;
    if (!T.sWebhook) { T.sWebhook = AR ? "ويب هوك" : "Webhook"; T.sHookUrlPh = AR ? "رابط https (Google Apps Script أو Zapier أو Make أو n8n)" : "https URL (Google Apps Script, Zapier, Make, n8n)"; T.sHookBad = AR ? "رابط الويب هوك لازم يكون https عام (مش IP ولا localhost)" : "Webhook URL must be a public https address (no IP or localhost)"; }
  if (!T.sBuy) { T.sBuy = AR ? "رابط شراء" : "Buy link"; T.sBuyLabelPh = AR ? "نص الزر (مثلاً: اشتري الآن)" : "Button text (e.g. Buy now)"; T.sBuyUrlPh = AR ? "رابط دفع Stripe: https://buy.stripe.com/..." : "Stripe payment link: https://buy.stripe.com/..."; T.sBuyBad = AR ? "رابط الشراء لازم يبدأ بـ https://buy.stripe.com/ أو https://donate.stripe.com/" : "Buy link must start with https://buy.stripe.com/ or https://donate.stripe.com/"; }
    const rows = state.steps.map((s, i) => {
      const first = i === 0;
      const kind = STEP_KINDS.indexOf(s.t) !== -1 ? s.t : "msg";
      const body = s.t === "msg" ? `<textarea class="dstep-in" rows="2" data-i="${i}" data-k="text" placeholder="${esc(T.sMsgPh)}">${esc(s.text || "")}</textarea>`
        : s.t === "webhook" ? `<input class="dstep-in" data-i="${i}" data-k="url" type="url" inputmode="url" value="${esc(s.url || "")}" aria-label="${esc(T.sHookUrlPh)}" placeholder="${esc(T.sHookUrlPh)}">`
        : s.t === "buy" ? `<input class="dstep-in" data-i="${i}" data-k="text" maxlength="60" value="${esc(s.text || "")}" aria-label="${esc(T.sBuyLabelPh)}" placeholder="${esc(T.sBuyLabelPh)}"><input class="dstep-in" data-i="${i}" data-k="url" type="url" inputmode="url" value="${esc(s.url || "")}" aria-label="${esc(T.sBuyUrlPh)}" placeholder="${esc(T.sBuyUrlPh)}">`
        : s.t === "delay" ? `<input class="dstep-in" data-i="${i}" data-k="v" type="number" min="1" max="999" value="${esc(s.v || 5)}" aria-label="${esc(T.sDelayPh)}" placeholder="${esc(T.sDelayPh)}"><select class="dstep-in dstep-unit" data-i="${i}" data-k="u" aria-label="${esc(TK.unit)}">` + [["m", TK.uMin], ["h", TK.uHour], ["d", TK.uDay]].map((u) => `<option value="${u[0]}"${(s.u || "m") === u[0] ? " selected" : ""}>${esc(u[1])}</option>`).join("") + `</select>`
          : s.t === "cond" ? `<input class="dstep-in" data-i="${i}" data-k="text" value="${esc(s.text || "")}" aria-label="${esc(T.sCondPh)}" placeholder="${esc(T.sCondPh)}"><select class="dstep-in dstep-unit" data-i="${i}" data-k="elseSkip" aria-label="${esc(T.sCondElse)}">` + [0, 1, 2, 3].map((n) => `<option value="${n}"${(parseInt(s.elseSkip, 10) || 0) === n ? " selected" : ""}>${esc(n === 0 ? T.sCondStop : T.sCondSkipN.replace("{n}", n))}</option>`).join("") + `</select>`
          : `<input class="dstep-in" data-i="${i}" data-k="text" value="${esc(s.text || "")}" aria-label="${esc(T.sTagPh)}" placeholder="${esc(T.sTagPh)}">`;
      return `<li class="dstep is-${kind}"><span class="dstep-n">${i + 1}</span>` +
        `<span class="dstep-type">${esc(T["s" + kind[0].toUpperCase() + kind.slice(1)])}</span>` +
        `<div class="dstep-body">${body}</div>` +
        `<div class="dstep-acts">` +
        (i > 1 ? `<button type="button" class="icon-btn" data-move="${i}" data-dir="-1" aria-label="${esc(T.stepUp)}">↑</button>` : "") +
        (i < state.steps.length - 1 && i > 0 ? `<button type="button" class="icon-btn" data-move="${i}" data-dir="1" aria-label="${esc(T.stepDown)}">↓</button>` : "") +
        (first ? "" : `<button type="button" class="icon-btn is-del" data-del="${i}" aria-label="${esc(T.stepDel)}">✕</button>`) +
        `</div></li>`;
    }).join("");

    const adds = ["msg", "delay", "cond", "tag", "buy", "webhook"].map((k) =>
      `<button type="button" class="tpl-btn" data-add="${k}">+ ${esc(T["s" + k[0].toUpperCase() + k.slice(1)])}</button>`).join("");

    return `<div class="dash-head"><button type="button" class="btn btn-ghost btn-sm" id="ed-back">← ${esc(T.back)}</button>` +
      `<div class="ed-actions"><span class="dash-ok" id="ed-ok"></span>` +
      `<select id="ed-status" class="ed-status" aria-label="${esc(T.status || 'Status')}">` + ["draft", "live", "paused"].map((s) => `<option value="${s}"${(state.pendingStatus || f.status) === s ? " selected" : ""}>${esc(T[s] || s)}</option>`).join("") + `</select>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="ed-test">${esc(T.testRun)}</button>` +
      `<button type="button" class="btn btn-primary btn-sm" id="ed-save">${esc(T.save)}</button></div></div>` +
      guideHtml() + `<div class="dash-card"><h2>${esc(T.flowName)}</h2>` +
      `<input id="ed-name" class="ed-name" value="${esc(f.name)}" maxlength="70" aria-label="${esc(T.flowName)}">` +
      `<p class="dash-note">${esc(chLabel(f.channel))} · ${esc(T[["live", "paused", "draft"].includes(f.status) ? f.status : "draft"] || "")}</p>` +
      (state.steps[0] && state.steps[0].t === "trigger" ? `<label style="display:block;margin-top:10px">${esc(T.fFolder)} <input id="ed-folder" maxlength="30" value="${esc(state.steps[0].folder || "")}" placeholder="${esc(T.fFolderPh)}"></label>` +
        `<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="ed-track"${state.steps[0].track === true ? " checked" : ""}> <span>${esc(T.fTrack)}</span></label>` : "") + `</div>` +
      `<div class="dash-card"><h2>${esc(T.steps)}</h2>` +
      `<ol class="dsteps">${rows || `<li class="dash-empty">${esc(T.noSteps)}</li>`}</ol>` +
      `<div class="dstep-add"><span>${esc(T.addStep)}</span>${adds}</div>` +
      (state.steps[0] && state.steps[0].t === "trigger" ? `<p class="dash-note trig-hint">${esc(TK.trigEvents)}</p>` : "") + `</div>` +
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
      `<div class="cfields"><span class="cfields-label">${esc(TK.fieldsTitle)}</span><div class="cfields-list" id="cf-fields">` +
      Object.keys(ed.fields || {}).map((k) => `<div class="cfield-row"><code class="cfield-key">${esc(k)}</code><span class="cfield-val" dir="auto">${esc(String(ed.fields[k]))}</span><button type="button" class="row-btn is-del" data-cfdel="${esc(k)}" aria-label="×">×</button></div>`).join("") +
      `</div><div class="cfield-new"><input id="cf-fkey" value="" placeholder="${esc(TK.fieldKeyPh)}" maxlength="30"><input id="cf-fval" value="" placeholder="${esc(TK.fieldValPh)}" maxlength="120">` +
      `<button type="button" class="btn btn-ghost btn-sm" id="cf-fadd">${esc(TK.addField)}</button></div></div>` +
      (ed.id ? `<div class="cfields"><span class="cfields-label">${esc(TK.seqTitle)}</span><div class="cfield-new"><select id="cf-seq"><option value="">${esc(TK.seqPick)}</option>` +
        state.flows.filter((f) => f.status === "live").map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("") +
        `</select><button type="button" class="btn btn-ghost btn-sm" id="cf-enroll">${esc(TK.enroll)}</button><button type="button" class="btn btn-ghost btn-sm" id="cf-unenroll">${esc(TK.stopSeq)}</button></div><p class="dash-note" id="cf-seq-msg" role="status"></p></div>` : "") +
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
    return state.contacts.filter((c) => !q || (c.name + " " + (c.handle || "") + " " + (c.tags || []).join(" ") + " " + Object.keys(c.fields || {}).map((k) => k + " " + String(c.fields[k])).join(" ")).toLowerCase().indexOf(q) !== -1);
  }

  function contactFor(conversation) {
    return state.contacts.filter((c) => c.id === (conversation && conversation.contact_id))[0] || null;
  }

  function sampleContact() { return state.contacts[0] || null; }

  // Replaces {name}, {handle}, {tags} and {field:key} with live contact data.
  function applyTokens(text, contact) {
    const c = contact || {};
    const fields = (c.fields && typeof c.fields === "object") ? c.fields : {};
    return String(text || "").replace(/\{\s*(name|handle|tags)\s*\}|\{\s*field\s*:\s*([\w.\-]{1,30})\s*\}/gi, (m, simple, key) => {
      if (simple) {
        const k = simple.toLowerCase();
        if (k === "name") return c.name || "";
        if (k === "handle") return c.handle || "";
        if (k === "tags") return (c.tags || []).join(", ");
      }
      if (key) {
        const hit = Object.keys(fields).filter((k2) => k2.toLowerCase() === key.toLowerCase())[0];
        return hit != null ? String(fields[hit]) : "";
      }
      return m;
    });
  }

  // Trigger conditions: "tag:X" checks a tag, "field:k" a non-empty field, "field:k=v" an exact value.
  // Returns true/false, or null when the syntax is not a contact condition.
  function contactMatchesCond(cond, contact) {
    const text = String(cond || "").trim();
    const c = contact || {};
    const tagM = /^tag\s*:\s*(.{1,40})$/i.exec(text);
    if (tagM) {
      const want = tagM[1].trim().toLowerCase();
      return (c.tags || []).some((t) => String(t).toLowerCase() === want);
    }
    const fM = /^field\s*:\s*([\w.\-]{1,30})\s*(?:=\s*(.{1,60}))?$/i.exec(text);
    if (fM) {
      const fields = (c.fields && typeof c.fields === "object") ? c.fields : {};
      const hit = Object.keys(fields).filter((k) => k.toLowerCase() === fM[1].toLowerCase())[0];
      const val = hit != null ? String(fields[hit]) : "";
      if (fM[2] == null) return hit != null && val !== "";
      return val.toLowerCase() === fM[2].trim().toLowerCase();
    }
    return null;
  }

  function contactRows(q) {
    const matches = contactMatches(q);
    if (!matches.length) return `<tr><td colspan="6" class="dash-empty">${esc(state.contacts.length ? T.noData : T.emptyContacts)}</td></tr>`;
    return matches.slice(0, state.cLimit).map((c) => `<tr><td><b>${esc(c.name)}</b></td><td class="contact-handle" dir="ltr">${esc(c.handle || "—")}</td>` +
      `<td><span class="pill" style="--c:${chColor(c.channel)}">${esc(chLabel(c.channel))}</span></td>` +
      `<td>${(c.tags || []).map((t) => `<span class="tagpill">${esc(t)}</span>`).join(" ") || "—"}</td>` +
      `<td>${esc(when(c.last_seen))}</td>` +
      `<td class="td-acts"><button type="button" class="row-btn" data-msg="${esc(c.id)}">${esc(T.message)}</button>` +
      `<button type="button" class="row-btn" data-cedit="${esc(c.id)}">${esc(T.edit)}</button>` +
      `<button type="button" class="row-btn is-del" data-cdel="${esc(c.id)}">${esc(T.deleteContact)}</button></td></tr>`).join("");
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
      if (c.channel !== "telegram" && c.channel !== "web") return false;
      if ((c.tags || []).some((t) => String(t).toLowerCase() === "unsubscribed")) return false;
      if (b.channel !== "all" && c.channel !== b.channel) return false;
      if (b.tag && (c.tags || []).indexOf(b.tag) === -1) return false;
      return true;
    });
  }

  function renderBroadcast() {
    const b = state.bc;
    const list = audience();
    T.bcNote = AR ? "الإرسال متاح لجهات اتصال تيليجرام والويب فقط (اللي راسلتك قبل كده). الحد: بثّ واحد كل ساعة، و30 مستلم كحد أقصى. كل رسالة تنتهي بـ «Reply STOP to unsubscribe» ومن يرد STOP يتشال تلقائياً. ابعت بس لناس وافقوا يستقبلوا منك."
      : "Sends to Telegram and website-chat contacts who already wrote to you. Limits: one broadcast per hour, up to 30 recipients. Every message ends with \"Reply STOP to unsubscribe\" and anyone who replies STOP is skipped from then on. Only message people who agreed to hear from you.";
    T.bcSend = AR ? "إرسال الآن" : "Send now";
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
      `<button type="button" class="btn btn-primary btn-sm" id="bc-send"${state.bcBusy ? " disabled" : ""}>${esc(T.bcSend)}</button></div>` +
      `<p class="dash-note${state.bcNoticeErr ? " is-err" : ""}" id="bc-status" role="status">${esc(state.bcNotice || "")}</p>` +
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

  function metaDisconnectButton(connection) {
    const id = String((connection && connection.id) || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return "";
    return ` <button type="button" class="btn btn-ghost btn-sm" data-meta-disconnect="${id}"${state.meta.pending ? " disabled" : ""}>${esc(T.metaDisconnect)}</button>`;
  }

  function metaStatusText(connection) {
    if (!state.meta.loaded) return T.metaLoad;
    if (state.meta.loadFailed) return T.metaMigrationPending;
    if (!connection) return T.metaNone;
    return T.metaConnected + (connection.display_name ? " · " + connection.display_name : "");
  }

  function renderMetaSettings() {
    /* Meta channels are not live yet: show a calm note instead of a setup error. Re-enables itself once a Meta App ID is configured. */
    if (!/^\d{5,32}$/.test(String((window.CHATORA_CONFIG || {}).META_APP_ID || ""))) {
      const ar = (document.documentElement.lang || "").indexOf("ar") === 0;
      return `<div class="dash-card meta-setup-card"><h2>${ar ? "قنوات واتساب وإنستجرام" : "WhatsApp and Instagram channels"}</h2><p class="dash-note">${ar ? "قريبًا: ربط القنوات الرسمية. حاليًا فريقنا بيجهّز لك القنوات، كلّمنا على واتساب لو عايز تبدأ." : "Coming soon: connecting official channels yourself. For now our team sets channels up for you. Message us on WhatsApp to get started."}</p></div>`;
    }
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
      `<button type="button" class="btn btn-primary btn-sm" id="meta-wa-connect"${waReady && !state.meta.pending ? "" : " disabled"}>${esc(waConnection ? T.metaReconnect : T.metaConnect)}</button>${metaDisconnectButton(waConnection)}</section>` +
      `<section class="meta-channel-card" aria-labelledby="meta-ig-title"><div class="meta-channel-head"><div><h3 id="meta-ig-title">${esc(T.metaInstagram)}</h3><p class="meta-channel-status">${esc(metaStatusText(igConnection))}</p></div><span class="meta-channel-mark is-ig" aria-hidden="true">◎</span></div>` +
      `<p class="dash-note">${esc(T.metaIgHelp)}</p><button type="button" class="btn btn-primary btn-sm" id="meta-ig-connect"${igReady && !state.meta.pending ? "" : " disabled"}>${esc(igConnection ? T.metaReconnect : T.metaConnect)}</button>${metaDisconnectButton(igConnection)}` +
      igPicker + `</section></div></div>`;
  }

  function meterHtml() {
    const lim = 100, n = state.contacts.length, pct = Math.min(100, Math.round(n / lim * 100)), warn = pct >= 80;
    const col = pct >= 100 ? "#f87171" : warn ? "#fbbf24" : "#7dd3fc";
    const lbl = AR ? num(n) + " من " + num(lim) + " جهة اتصال مستخدمة (الخطة المجانية)" : num(n) + " of " + num(lim) + " contacts used (Free plan)";
    const note = warn ? (AR ? "اقتربت من الحد. لا يوجد حظر في المعاينة، والخطط المدفوعة غير متاحة بعد." : "You are close to the Free limit. Nothing is blocked in this preview, and paid plans are not open yet.") : "";
    return `<div class="meter" style="margin-top:12px"><div style="font-size:13px;margin-bottom:6px">${esc(lbl)}</div>` +
      `<div role="progressbar" aria-valuemin="0" aria-valuemax="${lim}" aria-valuenow="${Math.min(n, lim)}" style="height:8px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden"><div style="height:100%;width:${pct}%;background:${col}"></div></div>` +
      (note ? `<p class="dash-note" style="margin-top:8px">${esc(note)}</p>` : "") + `</div>`;
  }
  function renderSettings() {
    const sec = (id, title, open, html) => `<details class="set-sec" data-sec="${id}"${state.setOpen && state.setOpen[id] !== undefined ? (state.setOpen[id] ? " open" : "") : (open ? " open" : "")} style="margin:0 0 14px"><summary style="cursor:pointer;font-weight:700;font-size:1.05rem;padding:8px 2px">${esc(title)}</summary>${html}</details>`;
    if (!T.setCh) { T.setCh = AR ? "القنوات" : "Channels"; T.setAi = AR ? "الموقع والذكاء الاصطناعي" : "Website chat and AI"; T.setAcct = AR ? "الحساب والخطة" : "Account and plan"; }
    return sec("ch", T.setCh, true, renderChannelsBlock() + renderMetaSettings()) + sec("ai", T.setAi, true, widgetCard() + knowledgeCard()) + sec("tpl", AR ? "قوالب ووضع العملاء" : "Templates and client mode", false, tplCard()) + sec("api", AR ? "المطوّرون و API" : "Developers and API", false, apiCard() + hooksCard()) + sec("acct", T.setAcct, true,
      `<div class="dash-card"><h2>${esc(T.wsName)}</h2>` +
      `<form id="ws-form" class="dash-inline"><input id="ws-input" aria-label="${esc(T.wsName)}" value="${esc(state.ws.name)}" maxlength="60">` +
      `<button class="btn btn-primary btn-sm" type="submit">${esc(T.save)}</button></form>` +
      `<p class="dash-note">${esc(T.planNote)}</p></div>` +
      `<div class="dash-card"><h2>${esc(T.pwdTitle)}</h2>` +
      `<form id="pw-form" class="dash-inline"><input id="pw-input" type="password" autocomplete="new-password" minlength="8" aria-label="${esc(T.pwNew)}" placeholder="${esc(T.pwNew)}">` +
      `<button class="btn btn-ghost btn-sm" type="submit">${esc(T.pwSave)}</button></form>` +
      `<p class="dash-note" id="pw-msg"></p></div>` +
      `<div class="dash-card"><h2>${esc(T.plan)}</h2><p class="dash-plan-row"><b>${esc(T.planFree)}</b> — <span>${esc(T.dataIsolation)}</span></p>${meterHtml()}</div>` +
      `<div class="dash-card"><h2>${esc(T.account)}</h2><p>${esc((A.user() && A.user().email) || "")}</p>` +
      `<p class="dash-note">${esc(T.exportTitle)} — <button type="button" class="link-btn" id="export">${esc(T.exportBtn)}</button></p></div>` +
      `<div class="dash-card"><h2>${esc(T.session)}</h2>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="signout2">${esc(T.signoutLong)}</button></div>` +
      `<div class="dash-card dash-danger"><h2>${esc(T.delTitle)}</h2><p class="dash-note">${esc(T.delNote)}</p>` +
      (signInProvider() === "password"
        ? `<form id="del-form" class="dash-inline"><input id="del-pass" type="password" autocomplete="current-password" required aria-label="${esc(T.delPass)}" placeholder="${esc(T.delPass)}">` +
          `<button class="btn btn-ghost btn-sm btn-danger" type="submit">${esc(T.delBtn)}</button></form>`
        : `<p class="dash-note">${esc(T.delGoogleNote)}</p>` +
          `<button class="btn btn-ghost btn-sm btn-danger" type="button" id="del-google">${esc(T.delGoogle)}</button>`) +
      `<p class="dash-note" id="del-msg" role="status"></p></div>`);
  }

  function signInProvider() {
    const s = A.session && A.session();
    const t = s && s.access_token;
    if (!t) return "password";
    try {
      const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return (p.firebase && p.firebase.sign_in_provider) || "password";
    } catch (e) { return "password"; }
  }

  async function deleteWorkspaceAndAccount(fresh, uid) {
    const cfg = window.CHATORA_CONFIG || {};
    const del = await fetch(cfg.SUPABASE_URL + "/rest/v1/workspaces?owner=eq." + encodeURIComponent(uid), {
      method: "DELETE", headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + fresh }
    });
    if (!del.ok) throw new Error("delete_failed");
    const fk = encodeURIComponent(cfg.FIREBASE_API_KEY || "");
    const fin = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete?key=" + fk, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: fresh })
    });
    if (!fin.ok) throw new Error("delete_failed");
  }

  const RENDER = { overview: renderOverview, inbox: renderInbox, flows: renderFlows, contacts: renderContacts, broadcast: renderBroadcast, settings: renderSettings };

  const WK = { loaded: false, loading: false, keys: [], err: "" };
  const WKT = ({
    en: { t: "Website chat widget", n: "Add an AI chat bubble to any website. Paste the snippet before </body>. It answers from your flows when they cover the question; otherwise it says the team will follow up. Each chat is saved in your Inbox.", c: "Create key", d: "Delete", s: "Save", g: "Greeting", o: "Allowed website (optional, e.g. https://example.com)", on: "Active", cp: "Copy snippet", cd: "Copied", lim: "Limit: 5 keys.", cf: "Delete this key? The widget stops working." },
    ar: { t: "ودجت الدردشة للموقع", n: "أضف فقاعة دردشة بالذكاء الاصطناعي لأي موقع. الصق الكود قبل </body>. بيرد من سيناريوهاتك لو السؤال متغطي فيها، ولو لأ بيقول إن الفريق هيتابع. كل محادثة بتتحفظ في الإنبوكس.", c: "إنشاء مفتاح", d: "حذف", s: "حفظ", g: "رسالة الترحيب", o: "الموقع المسموح (اختياري، مثل https://example.com)", on: "مفعّل", cp: "نسخ الكود", cd: "تم النسخ", lim: "الحد: 5 مفاتيح.", cf: "حذف هذا المفتاح؟ سيتوقف الودجت." }
  })[LANG] || null;
  const WKE = WKT || null;
  function wkT() { return Object.assign({}, WKX_EN, WKT || {}); }
  const WKX_EN = { t: "Website chat widget", n: "Add an AI chat bubble to any website. Paste the snippet before </body>. It answers from your flows and saves each chat in your Inbox.", c: "Create key", d: "Delete", s: "Save", g: "Greeting", o: "Allowed website (optional, e.g. https://example.com)", on: "Active", cp: "Copy snippet", cd: "Copied", lim: "Limit: 5 keys.", cf: "Delete this key? The widget stops working." };
  function widgetCard() {
    const W = wkT();
    const snip = (k) => '<script src="https://chatora.us.ci/assets/widget.js" data-key="' + k + '" defer></' + 'script>';
    const rows = WK.keys.map((k) => `<div class="dash-card" style="margin:10px 0;padding:12px"><textarea readonly rows="2" style="width:100%;font-family:monospace;font-size:12px" data-wk-snip="${esc(k.id)}">${esc(snip(k.key))}</textarea>` +
      `<div class="dash-inline" style="margin-top:8px;flex-wrap:wrap"><input data-wk-greet="${esc(k.id)}" maxlength="300" value="${esc(k.greeting)}" aria-label="${esc(W.g)}" placeholder="${esc(W.g)}">` +
      `<input data-wk-origin="${esc(k.id)}" maxlength="200" value="${esc(k.allowed_origin || "")}" aria-label="${esc(W.o)}" placeholder="${esc(W.o)}">` +
      `<label><input type="checkbox" data-wk-active="${esc(k.id)}"${k.active ? " checked" : ""}> ${esc(W.on)}</label>` +
      `<button type="button" class="btn btn-primary btn-sm" data-wk-save="${esc(k.id)}">${esc(W.s)}</button>` +
      `<button type="button" class="btn btn-ghost btn-sm" data-wk-copy="${esc(k.id)}">${esc(W.cp)}</button>` +
      `<button type="button" class="btn btn-ghost btn-sm btn-danger" data-wk-del="${esc(k.id)}">${esc(W.d)}</button></div></div>`).join("");
    return `<div class="dash-card" id="wk-card"><h2>${esc(W.t)}</h2><p class="dash-note">${esc(W.n)}</p>${rows}` +
      `<button type="button" class="btn btn-ghost btn-sm" id="wk-create"${WK.keys.length >= 5 ? " disabled" : ""}>${esc(W.c)}</button> <span class="dash-note">${esc(W.lim)}</span>` +
      `<p class="dash-note is-err" id="wk-msg" role="status">${esc(WK.err)}</p></div>`;
  }
  async function wkLoad() {
    if (WK.loaded || WK.loading) return;
    WK.loading = true;
    try { WK.keys = (await A.rest("/rest/v1/widget_keys?select=id,key,name,greeting,allowed_origin,active&order=created_at.asc")) || []; WK.err = ""; }
    catch (e) { WK.err = String(e.message || e); }
    WK.loading = false; WK.loaded = true;
    if (state.view === "settings") paint();
  }
  function wkWire(p) {
    wkLoad();
    const W = wkT();
    const fail = (e) => { WK.err = String(e.message || e); const m = $("#wk-msg", p); if (m) m.textContent = WK.err; };
    const cb = $("#wk-create", p);
    if (cb) cb.addEventListener("click", async () => {
      try {
        const row = await A.rest("/rest/v1/widget_keys", { method: "POST", body: JSON.stringify({ workspace_id: state.ws.id }) });
        const made = Array.isArray(row) ? row[0] : row;
        WK.keys.push(made); WK.err = ""; paint();
      } catch (e) { fail(e); }
    });
    $$("[data-wk-save]", p).forEach((b) => b.addEventListener("click", async () => {
      const id = b.getAttribute("data-wk-save");
      const q = (a) => p.querySelector("[" + a + '="' + id + '"]');
      const body = { greeting: q("data-wk-greet").value.trim() || "Hi! How can we help?", allowed_origin: q("data-wk-origin").value.trim() || null, active: q("data-wk-active").checked };
      try {
        await A.rest("/rest/v1/widget_keys?id=eq." + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) });
        const k = WK.keys.find((x) => x.id === id); if (k) Object.assign(k, body);
        WK.err = ""; paint();
      } catch (e) { fail(e); }
    }));
    $$("[data-wk-copy]", p).forEach((b) => b.addEventListener("click", () => {
      const ta = p.querySelector('[data-wk-snip="' + b.getAttribute("data-wk-copy") + '"]');
      ta.select();
      try { navigator.clipboard.writeText(ta.value); } catch (_) { document.execCommand("copy"); }
      b.textContent = W.cd;
    }));
    $$("[data-wk-del]", p).forEach((b) => b.addEventListener("click", async () => {
      if (!window.confirm(W.cf)) return;
      const id = b.getAttribute("data-wk-del");
      try {
        await A.rest("/rest/v1/widget_keys?id=eq." + encodeURIComponent(id), { method: "DELETE" });
        WK.keys = WK.keys.filter((x) => x.id !== id); WK.err = ""; paint();
      } catch (e) { fail(e); }
    }));
  }
  /* ---- Phase 2 item 12: API keys (scoped, hashed) ---- */
  const AK = { loaded: false, loading: false, keys: [], err: "", fresh: "" };
  const AKT = AR ? {
    t: "مفاتيح API (للمطوّرين)", n: "اربط Chatora بأدواتك أو بمساعد ذكاء اصطناعي (MCP). كل مفتاح له صلاحيات محددة، ويظهر مرة واحدة فقط بعد إنشائه. مجاني، حتى 120 طلب كل 10 دقائق لكل مفتاح.",
    nm: "اسم المفتاح", c: "إنشاء مفتاح", d: "حذف", cf: "تحذف المفتاح ده؟ أي تطبيق بيستخدمه هيتوقف.", lim: "حتى 5 مفاتيح.",
    sc: { "contacts:read": "قراءة جهات الاتصال", "contacts:write": "إضافة جهات اتصال", "flows:read": "قراءة السيناريوهات", "conversations:read": "قراءة المحادثات", "events:write": "إرسال أحداث (زابير/ميك)", "hooks:write": "إدارة الويب هوك", "messages:write": "إرسال رسائل تيليجرام" },
    once: "انسخ المفتاح الآن، مش هيظهر تاني:", cp: "نسخ", cd: "تم النسخ", last: "آخر استخدام", never: "لم يُستخدم", docs: "التوثيق", spec: "OpenAPI", mcp: "رابط MCP"
  } : {
    t: "API keys (developers)", n: "Connect Chatora to your tools or an AI assistant (MCP). Each key has limited scopes and is shown only once, right after you create it. Free, up to 120 requests per 10 minutes per key.",
    nm: "Key name", c: "Create key", d: "Delete", cf: "Delete this key? Any app using it will stop working.", lim: "Up to 5 keys.",
    sc: { "contacts:read": "Read contacts", "contacts:write": "Create contacts", "flows:read": "Read flows", "conversations:read": "Read conversations", "events:write": "Send events (Zapier/Make)", "hooks:write": "Manage webhooks", "messages:write": "Send Telegram messages" },
    once: "Copy the key now. It will not be shown again:", cp: "Copy", cd: "Copied", last: "Last used", never: "never used", docs: "Docs", spec: "OpenAPI", mcp: "MCP endpoint"
  };
  function apiCard() {
    const rows = AK.keys.map((k) => `<div class="dash-card" style="margin:10px 0;padding:12px"><b>${esc(k.name)}</b> <code>${esc(k.prefix)}…</code>` +
      `<p class="dash-note" style="margin:6px 0">${esc((k.scopes || []).map((x) => AKT.sc[x] || x).join(" · "))} — ${esc(AKT.last)}: ${esc(k.last_used_at ? String(k.last_used_at).slice(0, 16).replace("T", " ") : AKT.never)}</p>` +
      `<button type="button" class="btn btn-ghost btn-sm btn-danger" data-ak-del="${esc(k.id)}">${esc(AKT.d)}</button></div>`).join("");
    const fresh = AK.fresh ? `<div class="dash-card" style="margin:10px 0;padding:12px"><p class="dash-note"><b>${esc(AKT.once)}</b></p><textarea readonly rows="2" id="ak-fresh" style="width:100%;font-family:monospace;font-size:12px">${esc(AK.fresh)}</textarea><button type="button" class="btn btn-primary btn-sm" id="ak-copy">${esc(AKT.cp)}</button></div>` : "";
    const boxes = Object.keys(AKT.sc).map((x) => `<label style="display:block;margin:2px 0"><input type="checkbox" data-ak-scope="${x}"${x.endsWith(":read") ? " checked" : ""}> ${esc(AKT.sc[x])}</label>`).join("");
    return `<div class="dash-card" id="ak-card"><h2>${esc(AKT.t)}</h2><p class="dash-note">${esc(AKT.n)}</p>${fresh}${rows}` +
      `<input id="ak-name" maxlength="80" placeholder="${esc(AKT.nm)}" aria-label="${esc(AKT.nm)}" style="width:100%;margin-top:8px"><div style="margin:8px 0">${boxes}</div>` +
      `<button type="button" class="btn btn-primary btn-sm" id="ak-create"${AK.keys.length >= 5 ? " disabled" : ""}>${esc(AKT.c)}</button> <span class="dash-note">${esc(AKT.lim)}</span>` +
      `<p class="dash-note"><a href="/docs/api.html" target="_blank" rel="noopener">${esc(AKT.docs)}</a> · <a href="/api/v1/openapi.json" target="_blank" rel="noopener">${esc(AKT.spec)}</a> · ${esc(AKT.mcp)}: <code>https://chatora.us.ci/mcp</code></p>` +
      `<p class="dash-note is-err" id="ak-msg" role="status">${esc(AK.err)}</p></div>`;
  }
  async function akLoad() {
    if (AK.loaded || AK.loading) return;
    AK.loading = true;
    try { AK.keys = (await A.rest("/rest/v1/api_keys?select=id,name,prefix,scopes,last_used_at&order=created_at.asc")) || []; AK.err = ""; }
    catch (e) { AK.err = String(e.message || e); }
    AK.loading = false; AK.loaded = true;
    if (state.view === "settings") paint();
  }
  function akWire(p) {
    akLoad();
    const fail = (e) => { AK.err = String(e.message || e); const m = $("#ak-msg", p); if (m) m.textContent = AK.err; };
    const cb = $("#ak-create", p);
    if (cb) cb.addEventListener("click", async () => {
      try {
        const scopes = $$("[data-ak-scope]", p).filter((x) => x.checked).map((x) => x.getAttribute("data-ak-scope"));
        if (!scopes.length) return;
        const raw = crypto.getRandomValues(new Uint8Array(20));
        const key = "chk_live_" + Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
        const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
        const hash = Array.from(new Uint8Array(dig)).map((b) => b.toString(16).padStart(2, "0")).join("");
        const name = (($("#ak-name", p) || {}).value || "").trim().slice(0, 80) || "API key";
        const row = await A.rest("/rest/v1/api_keys", { method: "POST", body: JSON.stringify({ workspace_id: state.ws.id, name: name, prefix: key.slice(0, 13), key_hash: hash, scopes: scopes }) });
        const made = Array.isArray(row) ? row[0] : row;
        AK.keys.push({ id: made.id, name: name, prefix: key.slice(0, 13), scopes: scopes, last_used_at: null });
        AK.fresh = key; AK.err = ""; paint();
      } catch (e) { fail(e); }
    });
    const cp = $("#ak-copy", p);
    if (cp) cp.addEventListener("click", () => {
      const ta = $("#ak-fresh", p); ta.select();
      try { navigator.clipboard.writeText(ta.value); } catch (_) { document.execCommand("copy"); }
      cp.textContent = AKT.cd;
    });
    $$("[data-ak-del]", p).forEach((b) => b.addEventListener("click", async () => {
      if (!window.confirm(AKT.cf)) return;
      const id = b.getAttribute("data-ak-del");
      try {
        await A.rest("/rest/v1/api_keys?id=eq." + encodeURIComponent(id), { method: "DELETE" });
        AK.keys = AK.keys.filter((x) => x.id !== id); AK.err = ""; AK.fresh = ""; paint();
      } catch (e) { fail(e); }
    }));
  }
  /* ---- Phase 3: outbound webhooks (Zapier / Make / n8n) ---- */
  const HK = { loaded: false, loading: false, hooks: [], err: "" };
  const HKT = AR ? {
    t: "الويب هوك (Zapier و Make و n8n)", n: "ابعت أحداث مساحتك لأي رابط HTTPS: Catch Hook في Zapier، أو custom webhook في Make، أو Webhook node في n8n، أو سيرفر عندك. اختر الحدث والصق الرابط، وChatora هيبعت JSON كل ما الحدث يحصل.",
    ev: { "contact.created": "جهة اتصال جديدة", "message.received": "رسالة واردة جديدة", "event.received": "حدث وصل من الـ API", "flow.finished": "سيناريو اكتمل" },
    url: "الرابط (https://\u2026)", c: "إضافة ويب هوك", d: "حذف", cf: "تحذف الويب هوك ده؟", lim: "حتى 10 ويب هوك.", last: "آخر إرسال", never: "لم يُرسل بعد", docs: "دليل الإعداد", badurl: "الرابط لازم يبدأ بـ https://"
  } : {
    t: "Webhooks (Zapier, Make, n8n)", n: "Send workspace events to any HTTPS URL: a Zapier Catch Hook, a Make custom webhook, an n8n Webhook node, or your own server. Pick an event, paste the URL, and Chatora POSTs JSON every time it happens.",
    ev: { "contact.created": "New contact", "message.received": "New incoming message", "event.received": "API event received", "flow.finished": "Flow finished" },
    url: "Target URL (https://\u2026)", c: "Add webhook", d: "Delete", cf: "Delete this webhook?", lim: "Up to 10 webhooks.", last: "Last delivery", never: "never delivered", docs: "Setup guide", badurl: "The URL must be a valid https:// address."
  };
  function hooksCard() {
    const rows = HK.hooks.map((k) => `<div class="dash-card" style="margin:10px 0;padding:12px"><b>${esc(HKT.ev[k.event] || k.event)}</b><br><code style="word-break:break-all">${esc(k.target_url)}</code>` +
      `<p class="dash-note" style="margin:6px 0">${esc(HKT.last)}: ${esc(k.last_at ? String(k.last_at).slice(0, 16).replace("T", " ") + " · HTTP " + (k.last_status || "?") : HKT.never)}</p>` +
      `<button type="button" class="btn btn-ghost btn-sm btn-danger" data-hk-del="${esc(k.id)}">${esc(HKT.d)}</button></div>`).join("");
    const opts = Object.keys(HKT.ev).map((x) => `<option value="${x}">${esc(HKT.ev[x])}</option>`).join("");
    return `<div class="dash-card" id="hk-card"><h2>${esc(HKT.t)}</h2><p class="dash-note">${esc(HKT.n)}</p>${rows}` +
      `<select id="hk-event" aria-label="Event" style="width:100%;margin-top:8px">${opts}</select>` +
      `<input id="hk-url" maxlength="300" placeholder="${esc(HKT.url)}" aria-label="${esc(HKT.url)}" style="width:100%;margin-top:6px">` +
      `<button type="button" class="btn btn-primary btn-sm" id="hk-create" style="margin-top:8px"${HK.hooks.length >= 10 ? " disabled" : ""}>${esc(HKT.c)}</button> <span class="dash-note">${esc(HKT.lim)}</span>` +
      `<p class="dash-note"><a href="/docs/integrations.html" target="_blank" rel="noopener">${esc(HKT.docs)}</a></p>` +
      `<p class="dash-note is-err" id="hk-msg" role="status">${esc(HK.err)}</p></div>`;
  }
  async function hkLoad() {
    if (HK.loaded || HK.loading) return;
    HK.loading = true;
    try { HK.hooks = (await A.rest("/rest/v1/hook_subscriptions?select=id,event,target_url,last_status,last_at&order=created_at.asc")) || []; HK.err = ""; }
    catch (e) { HK.err = String(e.message || e); }
    HK.loading = false; HK.loaded = true;
    if (state.view === "settings") paint();
  }
  function hkWire(p) {
    hkLoad();
    const fail = (e) => { HK.err = String(e.message || e); const m = $("#hk-msg", p); if (m) m.textContent = HK.err; };
    const cb = $("#hk-create", p);
    if (cb) cb.addEventListener("click", async () => {
      try {
        const event = (($("#hk-event", p) || {}).value || "contact.created");
        const url = ((($("#hk-url", p) || {}).value || "").trim());
        if (!/^https:\/\/[^ /]+\.[^ /]+\S*$/.test(url) || url.length > 300) throw new Error(HKT.badurl);
        const row = await A.rest("/rest/v1/hook_subscriptions", { method: "POST", body: JSON.stringify({ workspace_id: state.ws.id, event: event, target_url: url }) });
        const made = Array.isArray(row) ? row[0] : row;
        HK.hooks.push(made); HK.err = ""; paint();
      } catch (e) { fail(e); }
    });
    $$("[data-hk-del]", p).forEach((b) => b.addEventListener("click", async () => {
      if (!window.confirm(HKT.cf)) return;
      const id = b.getAttribute("data-hk-del");
      try {
        await A.rest("/rest/v1/hook_subscriptions?id=eq." + encodeURIComponent(id), { method: "DELETE" });
        HK.hooks = HK.hooks.filter((x) => x.id !== id); HK.err = ""; paint();
      } catch (e) { fail(e); }
    }));
  }
  /* ---- Phase 2 item 5: knowledge box (answers for the AI on web chat and Telegram) ---- */
  const KN = { loaded: false, loading: false, items: [], err: "" };
  const KNT = AR ? {
    t: "صندوق المعرفة", n: "اكتب معلومات عن نشاطك (أسعار، مواعيد، سياسات). الذكاء الاصطناعي بيرد منها على الويب وتيليجرام، ولو السؤال مش مغطى بيقول إن الفريق هيتابع.",
    ti: "العنوان (اختياري)", b: "المعلومة", a: "إضافة", d: "حذف", cf: "تحذف المعلومة دي؟", lim: "حتى 30 معلومة، كل واحدة حتى 1200 حرف مقروءة للذكاء الاصطناعي."
  } : {
    t: "Knowledge box", n: "Write facts about your business (prices, hours, policies). The AI answers from them on web chat and Telegram. If a question isn't covered it says the team will follow up.",
    ti: "Title (optional)", b: "Fact or answer", a: "Add", d: "Delete", cf: "Delete this item?", lim: "Up to 30 items; the AI reads the first 1200 characters of each."
  };
  function knowledgeCard() {
    const rows = KN.items.map((k) => `<div class="dash-card" style="margin:10px 0;padding:12px"><b>${esc(k.title || "")}</b><p style="white-space:pre-wrap;margin:6px 0">${esc(k.body)}</p>` +
      `<button type="button" class="btn btn-ghost btn-sm btn-danger" data-kn-del="${esc(k.id)}">${esc(KNT.d)}</button></div>`).join("");
    return `<div class="dash-card" id="kn-card"><h2>${esc(KNT.t)}</h2><p class="dash-note">${esc(KNT.n)}</p>${rows}` +
      `<input id="kn-title" maxlength="120" placeholder="${esc(KNT.ti)}" aria-label="${esc(KNT.ti)}" style="width:100%;margin-top:8px">` +
      `<textarea id="kn-body" rows="3" maxlength="2000" placeholder="${esc(KNT.b)}" aria-label="${esc(KNT.b)}" style="width:100%;margin-top:6px"></textarea>` +
      `<button type="button" class="btn btn-primary btn-sm" id="kn-add"${KN.items.length >= 30 ? " disabled" : ""}>${esc(KNT.a)}</button> <span class="dash-note">${esc(KNT.lim)}</span>` +
      `<p class="dash-note is-err" id="kn-msg" role="status">${esc(KN.err)}</p></div>`;
  }
  async function knLoad() {
    if (KN.loaded || KN.loading) return;
    KN.loading = true;
    try { KN.items = (await A.rest("/rest/v1/knowledge_items?select=id,title,body&order=created_at.asc")) || []; KN.err = ""; }
    catch (e) { KN.err = String(e.message || e); }
    KN.loading = false; KN.loaded = true;
    if (state.view === "settings") paint();
  }

  /* ---- Phase 2 item 10: clone a setup as a template (client mode) ---- */
  const TPL = { msg: "", err: false, busy: false };
  const TPT = AR ? {
    t: "نسخ الإعداد كقالب (وضع العملاء)", n: "صدّر سيناريوهاتك وقاعدة المعرفة كملف JSON، ثم الصقه في حساب عميل ليتكوّن له إعداد جاهز. جهات الاتصال والمحادثات والرسائل الجماعية والمفاتيح ما بتتنقلش.",
    ex: "تصدير القالب", im: "استيراد قالب", ph: "الصق ملف القالب هنا", pick: "أو اختر ملف", ap: "تطبيق القالب",
    bad: "ملف القالب مش صالح.", big: "القالب كبير (الحد 200KB و50 سيناريو).", done: "تم: {f} سيناريو (مسودات) و{k} عنصر معرفة. روابط الويب هوك اتشالت. راجع كل سيناريو قبل التفعيل (خصوصاً روابط الشراء).", fail: "فشل الاستيراد."
  } : {
    t: "Clone a setup as a template (client mode)", n: "Export your flows and knowledge box as a JSON file, then paste it into a client's account to give them a ready setup. Contacts, conversations, broadcasts and keys are never copied.",
    ex: "Export template", im: "Import a template", ph: "Paste the template JSON here", pick: "or choose a file", ap: "Apply template",
    bad: "That template file is not valid.", big: "Template is too big (limit 200KB and 50 flows).", done: "Done: {f} flows (as drafts) and {k} knowledge items. Webhook steps were removed. Review each flow before going live, especially Buy links.", fail: "Import failed."
  };
  function tplClean(raw) {
    let o; try { o = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { return null; }
    if (!o || o.chatora_template !== 1 || !Array.isArray(o.flows)) return null;
    const flows = o.flows.slice(0, 50).map((f) => {
      const nodes = (Array.isArray(f && f.nodes) ? f.nodes : []).slice(0, 40).map((n, i) => {
        if (!n || STEP_KINDS.indexOf(n.t) === -1 || n.t === "webhook") return null;
        const out = { t: n.t };
        if (n.t === "delay") { out.v = Math.max(1, Math.min(999, parseInt(n.v, 10) || 5)); if (n.u === "h" || n.u === "d") out.u = n.u; return out; }
        out.text = tidy(n.text, 1000);
        if (n.t === "buy") { out.url = String(n.url || "").trim(); if (!BUY_RE.test(out.url)) return null; out.text = tidy(n.text, 60); }
        if (i === 0 && n.t === "trigger") { const fo = tidy(n.folder, 30).trim(); if (fo) out.folder = fo; }
        return out;
      }).filter(Boolean);
      if (!nodes.length || nodes[0].t !== "trigger") return null;
      return { name: tidy(f && f.name, 70).trim() || "Imported flow", channel: CH[f.channel] ? f.channel : "web", nodes };
    }).filter(Boolean);
    const knowledge = (Array.isArray(o.knowledge) ? o.knowledge : []).slice(0, 30).map((k) => ({ title: tidy(k && k.title, 120), body: tidy(k && k.body, 2000).trim() })).filter((k) => k.body);
    if (!flows.length && !knowledge.length) return null;
    return { flows, knowledge };
  }
  function tplCard() {
    return `<div class="dash-card" id="tpl-card"><h2>${esc(TPT.t)}</h2><p class="dash-note">${esc(TPT.n)}</p>` +
      `<button type="button" class="btn btn-ghost btn-sm" id="tpl-export">${esc(TPT.ex)}</button>` +
      `<h3 style="margin:14px 0 6px;font-size:1rem">${esc(TPT.im)}</h3>` +
      `<textarea id="tpl-text" rows="4" maxlength="204800" placeholder="${esc(TPT.ph)}" aria-label="${esc(TPT.ph)}" style="width:100%"></textarea>` +
      `<div style="margin-top:6px"><label class="dash-note">${esc(TPT.pick)} <input type="file" id="tpl-file" accept=".json,application/json"></label></div>` +
      `<button type="button" class="btn btn-primary btn-sm" id="tpl-apply" style="margin-top:8px"${TPL.busy ? " disabled" : ""}>${esc(TPT.ap)}</button>` +
      `<p class="dash-note${TPL.err ? " is-err" : ""}" id="tpl-msg" role="status">${esc(TPL.msg)}</p></div>`;
  }
  function tplWire(p) {
    const msg = (m, err) => { TPL.msg = m; TPL.err = !!err; const e = $("#tpl-msg", p); if (e) { e.textContent = m; e.classList.toggle("is-err", !!err); } };
    const ex = $("#tpl-export", p);
    if (ex) ex.addEventListener("click", async () => {
      await knLoad();
      const out = { chatora_template: 1, name: state.ws.name, flows: state.flows.map((f) => ({ name: f.name, channel: f.channel, nodes: (f.nodes || []).filter((n) => n && n.t !== "webhook").map((n, i) => { const c = Object.assign({}, n); if (i === 0) delete c.track; return c; }) })), knowledge: KN.items.map((k) => ({ title: k.title, body: k.body })) };
      const blob = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "chatora-template.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
    const file = $("#tpl-file", p);
    if (file) file.addEventListener("change", () => {
      const f = file.files && file.files[0]; if (!f) return;
      if (f.size > 204800) { msg(TPT.big, true); return; }
      const rd = new FileReader(); rd.onload = () => { const t = $("#tpl-text", p); if (t) t.value = String(rd.result || ""); }; rd.readAsText(f);
    });
    const ap = $("#tpl-apply", p);
    if (ap) ap.addEventListener("click", async () => {
      const raw = ($("#tpl-text", p).value || "").trim();
      if (raw.length > 204800) { msg(TPT.big, true); return; }
      const t = tplClean(raw);
      if (!t) { msg(TPT.bad, true); return; }
      if (!window.confirm((AR ? "هيتضاف " : "This adds ") + t.flows.length + (AR ? " سيناريو (مسودات) و" : " draft flows and ") + t.knowledge.length + (AR ? " عنصر معرفة. متأكد؟" : " knowledge items. Continue?"))) return;
      TPL.busy = true; ap.disabled = true;
      try {
        await knLoad();
        let fn = 0, kn = 0;
        if (t.flows.length) { const res = await A.rest("/rest/v1/flows", { method: "POST", body: JSON.stringify(t.flows.map((f) => ({ workspace_id: state.ws.id, name: f.name, channel: f.channel, status: "draft", runs: 0, nodes: f.nodes }))) }); fn = Array.isArray(res) ? res.length : 1; }
        const room = Math.max(0, 30 - KN.items.length);
        const ks = t.knowledge.slice(0, room);
        if (ks.length) { const res = await A.rest("/rest/v1/knowledge_items", { method: "POST", body: JSON.stringify(ks.map((k) => ({ workspace_id: state.ws.id, title: k.title, body: k.body }))) }); kn = Array.isArray(res) ? res.length : 1; KN.items = KN.items.concat(Array.isArray(res) ? res : [res]); }
        await loadAll();
        TPL.msg = TPT.done.replace("{f}", fn).replace("{k}", kn); TPL.err = false;
      } catch (e) { TPL.msg = TPT.fail; TPL.err = true; }
      TPL.busy = false; paint();
    });
  }
  function knWire(p) {
    knLoad();
    const fail = (e) => { KN.err = String(e.message || e); const m = $("#kn-msg", p); if (m) m.textContent = KN.err; };
    const add = $("#kn-add", p);
    if (add) add.addEventListener("click", async () => {
      const body = $("#kn-body", p).value.trim();
      if (!body) return;
      try {
        const row = await A.rest("/rest/v1/knowledge_items", { method: "POST", body: JSON.stringify({ workspace_id: state.ws.id, title: $("#kn-title", p).value.trim().slice(0, 120), body: body.slice(0, 2000) }) });
        KN.items.push(Array.isArray(row) ? row[0] : row); KN.err = ""; paint();
      } catch (e) { fail(e); }
    });
    $$("[data-kn-del]", p).forEach((b) => b.addEventListener("click", async () => {
      if (!window.confirm(KNT.cf)) return;
      const id = b.getAttribute("data-kn-del");
      try {
        await A.rest("/rest/v1/knowledge_items?id=eq." + encodeURIComponent(id), { method: "DELETE" });
        KN.items = KN.items.filter((x) => x.id !== id); KN.err = ""; paint();
      } catch (e) { fail(e); }
    }));
  }
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
    if (String(conversation.channel) === "web") return submitWebReply(conversation, draft);
    if (String(conversation.channel) === "telegram") return submitTgReply(conversation, draft);
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

  async function submitWebReply(conversation, draft) {
    const input = $("#meta-reply-input");
    const text = String((input && input.value) || draft.text || "").trim();
    if (!text || draft.busy) return;
    if (new TextEncoder().encode(text).byteLength > 1000) {
      draft.text = text; draft.notice = T.sendTooLong; draft.noticeError = true; paint(); return;
    }
    draft.busy = true; draft.notice = ""; draft.noticeError = false;
    try {
      await A.rest("/rest/v1/messages", { method: "POST", body: JSON.stringify({ conversation_id: conversation.id, direction: "out", author: "human", body: applyTokens(text, contactFor(conversation)).slice(0, 1200) }) });
      await A.rest("/rest/v1/conversations?id=eq." + conversation.id, { method: "PATCH", body: JSON.stringify({ last_at: new Date().toISOString(), status: conversation.status === "ai" ? "human" : conversation.status }) });
      if (conversation.status === "ai") conversation.status = "human";
      draft.text = ""; draft.notice = T.sendSuccess; draft.noticeError = false;
      await refreshThreadMessages(conversation.id);
    } catch (e) {
      draft.notice = T.sendError; draft.noticeError = true;
    } finally {
      draft.busy = false;
      if (state.view === "inbox" && state.conv && state.conv.id === conversation.id) paint();
    }
  }

  async function submitTgReply(conversation, draft) {
    const input = $("#meta-reply-input");
    const raw = String((input && input.value) || draft.text || "").trim();
    if (!raw || draft.busy) return;
    if (new TextEncoder().encode(raw).byteLength > 1000) {
      draft.text = raw; draft.notice = T.sendTooLong; draft.noticeError = true; paint(); return;
    }
    const contact = contactFor(conversation);
    const chatId = String((contact && contact.handle) || "").replace(/^tg:/, "").trim();
    if (!/^-?\d{1,20}$/.test(chatId)) {
      draft.notice = T.sendError; draft.noticeError = true; paint(); return;
    }
    const text = applyTokens(raw, contact);
    draft.busy = true; draft.notice = ""; draft.noticeError = false; paint();
    try {
      await tgApi("/api/channels/telegram/send", { workspace: state.ws.id, chat: chatId, text: text });
      await A.rest("/rest/v1/messages", { method: "POST", body: JSON.stringify({ conversation_id: conversation.id, direction: "out", author: "human", body: text.slice(0, 1200) }) });
      await A.rest("/rest/v1/conversations?id=eq." + conversation.id, { method: "PATCH", body: JSON.stringify({ last_at: new Date().toISOString(), status: conversation.status === "ai" ? "human" : conversation.status }) });
      if (conversation.status === "ai") conversation.status = "human";
      draft.text = ""; draft.notice = T.sendSuccess; draft.noticeError = false;
      await refreshThreadMessages(conversation.id);
    } catch (e) {
      draft.notice = e && e.code === "not connected" ? TK.tgNoConn : T.sendError;
      draft.noticeError = true;
    } finally {
      draft.busy = false;
      if (state.view === "inbox" && state.conv && state.conv.id === conversation.id) paint();
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
    const bp = $("[data-basic-pack]", p);
    if (bp) bp.addEventListener("click", () => { bp.disabled = true; addBasicPack().catch((e) => { bp.disabled = false; alert(e.message || e); }); });
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
      const tm = $("#toggle-mode");
      if (tm) tm.addEventListener("click", () => setStatus(state.conv.status === "human" ? "ai" : "human"));
    }

    if (state.view === "flows") {
      $$("[data-folder]", p).forEach((b) => b.addEventListener("click", () => { state.folder = b.getAttribute("data-folder") || ""; paint(); }));
      const tc = $("#tpl-cancel", p);
      if (tc) tc.addEventListener("click", () => { state.templates = false; paint(); });
      { const gb = $("#g-blank", p); if (gb) gb.addEventListener("click", () => useBlank().catch((e) => alert(e.message))); }
      $$("[data-guse]", p).forEach((b) => b.addEventListener("click", () => useTemplate(b.getAttribute("data-guse")).catch((e) => alert(e.message))));
      $$("[data-gcat]", p).forEach((b) => b.addEventListener("click", () => { state.gcat = b.getAttribute("data-gcat"); paint(); }));
      const gb = $("#g-back", p);
      if (gb) gb.addEventListener("click", () => { state.templates = false; paint(); });
      const gs = $("#g-search", p);
      if (gs) gs.addEventListener("input", () => {
        state.gq = gs.value;
        const grid = $(".gtpl-grid", p);
        grid.innerHTML = galleryCards(galleryFiltered()) || `<p class="dash-empty">${esc(T.gNone)}</p>`;
        $$("[data-guse]", grid).forEach((b) => b.addEventListener("click", () => useTemplate(b.getAttribute("data-guse")).catch((e) => alert(e.message))));
      });
      $$("[data-gtrig]", p).forEach((b) => b.addEventListener("click", () => { state.gtrig = b.getAttribute("data-gtrig"); paint(); }));
      $$("[data-dup]", p).forEach((b) => b.addEventListener("click", () => duplicateFlow(b.getAttribute("data-dup")).catch((e) => alert(e.message))));
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
          state.cedit = { id: c.id, name: c.name, handle: c.handle || "", channel: c.channel, tags: c.tags || [], fields: Object.assign({}, c.fields || {}) };
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
        state.cedit = { id: null, name: "", handle: "", channel: "instagram", tags: [], fields: {} };
        paint();
        const f = $("#cf-name"); if (f) f.focus();
      });
      [["#cf-enroll", "enroll", "enrolledOk"], ["#cf-unenroll", "unenroll", "stoppedOk"]].forEach((cfg) => {
        const b = $(cfg[0], p);
        if (!b) return;
        b.addEventListener("click", async () => {
          const sel = $("#cf-seq", p), msg = $("#cf-seq-msg", p);
          if (!sel || !sel.value || !state.cedit || !state.cedit.id) return;
          try {
            await tgApi("/api/automation/event", { workspace: state.ws.id, contact_id: state.cedit.id, kind: cfg[1], key: sel.value });
            if (msg) msg.textContent = TK[cfg[2]];
          } catch (e) { if (msg) msg.textContent = T.sendError; }
        });
      });
      const fadd = $("#cf-fadd", p);
      if (fadd) fadd.addEventListener("click", () => {
        syncCeditFromDom();
        const kEl = $("#cf-fkey", p), vEl = $("#cf-fval", p);
        const k = tidy(kEl && kEl.value, 30).trim();
        if (!k) { if (kEl) kEl.focus(); return; }
        const f = state.cedit.fields || (state.cedit.fields = {});
        const existing = Object.keys(f).filter((k2) => k2.toLowerCase() === k.toLowerCase())[0];
        if (existing == null && Object.keys(f).length >= 20) return;
        f[existing != null ? existing : k] = tidy(vEl && vEl.value, 120).trim();
        paint();
      });
      $$("[data-cfdel]", p).forEach((b) => b.addEventListener("click", () => {
        syncCeditFromDom();
        if (state.cedit && state.cedit.fields) delete state.cedit.fields[b.getAttribute("data-cfdel")];
        paint();
      }));
      // Infer the channel from the handle pattern (same rules as CSV import)
      // until the user picks a channel themselves.
      const hEl = $("#cf-handle", p), chEl = $("#cf-ch", p);
      if (hEl && chEl) {
        chEl.addEventListener("change", () => { chEl.dataset.picked = "1"; });
        hEl.addEventListener("input", () => {
          if (chEl.dataset.picked) return;
          const g = importedChannel("", hEl.value);
          if (g && CH[g]) chEl.value = g;
        });
      }
      const sv = $("#cf-save", p);
      if (sv) sv.addEventListener("click", saveContact);
      const cn = $("#cf-cancel", p);
      if (cn) cn.addEventListener("click", () => { state.cedit = null; paint(); });
    }

    function showArmBar(afterEl, text, yesLabel, onYes) {
      if (!afterEl) return;
      const host = afterEl.parentNode;
      if (!host) return;
      const old = host.querySelector(".arm-bar");
      if (old) old.remove();
      const bar = document.createElement("div");
      bar.className = "dash-inline arm-bar";
      bar.setAttribute("role", "alertdialog");
      const span = document.createElement("span");
      span.className = "dash-note";
      span.textContent = text;
      const yes = document.createElement("button");
      yes.type = "button"; yes.className = "btn btn-ghost btn-sm btn-danger"; yes.textContent = yesLabel;
      const no = document.createElement("button");
      no.type = "button"; no.className = "btn btn-ghost btn-sm"; no.textContent = T.cancel;
      yes.addEventListener("click", () => { bar.remove(); onYes(); });
      no.addEventListener("click", () => bar.remove());
      bar.appendChild(span); bar.appendChild(yes); bar.appendChild(no);
      afterEl.insertAdjacentElement("afterend", bar);
    }

    if (state.view === "broadcast") {
      // text fields only update state — a repaint here would swallow the click
      const nameEl = $("#bc-name", p);
      if (nameEl) nameEl.addEventListener("input", (e) => { state.bc.name = e.target.value; });
      const bodyEl = $("#bc-body", p);
      if (bodyEl) bodyEl.addEventListener("input", (e) => { state.bc.body = e.target.value; });
      const sendEl = $("#bc-send", p);
      if (sendEl) sendEl.addEventListener("click", async () => {
        const n = audience().length, body = String(state.bc.body || "").trim();
        const bcOut = $("#bc-status", p);
        const bcSay = (t, err) => {
          state.bcNotice = t; state.bcNoticeErr = !!err;
          if (bcOut) { bcOut.textContent = t; bcOut.className = "dash-note" + (err ? " is-err" : ""); }
        };
        if (!body) { bcSay(AR ? "اكتب الرسالة الأول" : "Write the message first", true); return; }
        if (!n) { bcSay(T.bcEmpty, true); return; }
        if (n > 30) { bcSay(AR ? "الحد الأقصى 30 مستلم في البثّ. ضيّق الجمهور بتاج أو قناة." : "Max 30 recipients per broadcast. Narrow the audience with a tag or channel.", true); return; }
        if (!sendEl.dataset.armed) {
          showArmBar(sendEl.closest(".bc-row") || sendEl, AR ? "هتتبعت الرسالة لـ " + n + " شخص وافقوا يستقبلوا منك. متأكد؟" : "Send this message to " + n + " people who agreed to hear from you?", T.bcSend, () => { sendEl.dataset.armed = "1"; sendEl.click(); });
          return;
        }
        delete sendEl.dataset.armed;
        state.bcBusy = true; sendEl.disabled = true;
        try {
          const res = await tgApi("/api/broadcast/send", { workspace: state.ws.id, name: state.bc.name, channel: state.bc.channel, tag: state.bc.tag, body: body });
          state.bc.body = "";
          const hist = await A.rest("/rest/v1/broadcasts?select=id,name,channel,body,audience,sent,created_at&order=created_at.desc&limit=20").catch(() => null);
          if (hist) state.broadcasts = hist;
          bcSay((AR ? "اتبعتت لـ " : "Sent to ") + res.sent + (AR ? " من " : " of ") + res.audience, false);
        } catch (e) {
          const c = e && e.code;
          bcSay(c === "too_soon" ? (AR ? "بثّ واحد كل ساعة. حاول بعد شوية." : "One broadcast per hour. Try again a bit later.") : c === "too_many" ? (AR ? "الجمهور أكبر من 30. ضيّقه." : "Audience is over 30. Narrow it.") : (T.sendError || "Failed"), true);
        }
        state.bcBusy = false; paint();
      });
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
      $$("details.set-sec", p).forEach((d) => d.addEventListener("toggle", () => { state.setOpen = state.setOpen || {}; state.setOpen[d.getAttribute("data-sec")] = d.open; }));
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
        if (!strongPw(el.value)) { out.textContent = T.pwShort; out.className = "dash-note is-err"; return; }
        try {
          await A.updateUser({ password: el.value });
          el.value = "";
          out.textContent = T.pwOk; out.className = "dash-note is-ok";
        } catch (err) { out.textContent = err.message; out.className = "dash-note is-err"; }
      });
      wkWire(p);
      akWire(p);
      hkWire(p);
      knWire(p);
      tplWire(p);
      chanWire(p);
      const ex = $("#export", p);
      if (ex) ex.addEventListener("click", exportData);
      const s2 = $("#signout2", p);
      if (s2) s2.addEventListener("click", () => A.signOut());
      const dg = $("#del-google", p);
      if (dg) dg.addEventListener("click", async () => {
        const out = $("#del-msg", p);
        if (!dg.dataset.armed) { showArmBar(dg, T.delConfirm, T.delGoogle, () => { dg.dataset.armed = "1"; dg.click(); }); return; }
        delete dg.dataset.armed;
        dg.disabled = true; out.textContent = ""; out.className = "dash-note";
        try {
          const cfg = window.CHATORA_CONFIG || {};
          const me = A.session && A.session();
          const uid = me && me.user && me.user.id, mail = String((me && me.user && me.user.email) || "").toLowerCase();
          await new Promise((res, rej) => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) return res();
            const sc = document.createElement("script");
            sc.src = "https://accounts.google.com/gsi/client"; sc.async = true;
            sc.onload = () => res(); sc.onerror = () => rej(new Error("network"));
            document.head.appendChild(sc);
          });
          const gt = await new Promise((res, rej) => {
            const client = window.google.accounts.oauth2.initTokenClient({
              client_id: cfg.GOOGLE_CLIENT_ID,
              scope: "openid email profile",
              callback: (r) => (r && r.access_token ? res(r.access_token) : rej(new Error("cancelled"))),
              error_callback: () => rej(new Error("cancelled"))
            });
            client.requestAccessToken({ prompt: "select_account" });
          });
          const IT = "https://identitytoolkit.googleapis.com/v1/";
          const fk = encodeURIComponent(cfg.FIREBASE_API_KEY || "");
          const gi = await fetch(IT + "accounts:signInWithIdp?key=" + fk, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postBody: "access_token=" + encodeURIComponent(gt) + "&providerId=google.com", requestUri: location.origin, returnSecureToken: true })
          });
          if (!gi.ok) throw new Error("delete_failed");
          const gd = await gi.json();
          if (String(gd.email || "").toLowerCase() !== mail) throw new Error("wrong_account");
          await deleteWorkspaceAndAccount(gd.idToken, uid);
          await A.signOut();
        } catch (err) {
          const em = err && err.message;
          out.textContent = em === "cancelled" ? "" : (em === "wrong_account" ? T.delWrongAcct : T.delFailed);
          out.className = em === "cancelled" ? "dash-note" : "dash-note is-err";
          dg.disabled = false;
        }
      });
      const df = $("#del-form", p);
      if (df) df.addEventListener("submit", async (e) => {
        e.preventDefault();
        const el = $("#del-pass"), out = $("#del-msg"), btn = df.querySelector("button");
        if (!el.value) { out.textContent = T.delPass; out.className = "dash-note is-err"; return; }
        if (!df.dataset.armed) { showArmBar(df, T.delConfirm, T.delBtn, () => { df.dataset.armed = "1"; df.requestSubmit(); }); return; }
        delete df.dataset.armed;
        btn.disabled = true;
        out.textContent = ""; out.className = "dash-note";
        try {
          const cfg = window.CHATORA_CONFIG || {};
          const me = A.session && A.session();
          const uid = me && me.user && me.user.id, mail = me && me.user && me.user.email;
          const IT = "https://identitytoolkit.googleapis.com/v1/";
          const fk = encodeURIComponent(cfg.FIREBASE_API_KEY || "");
          const re = await fetch(IT + "accounts:signInWithPassword?key=" + fk, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: mail, password: el.value, returnSecureToken: true })
          });
          if (!re.ok) { const bad = new Error("wrong_password"); bad.data = { error: "wrong_password" }; throw bad; }
          const fresh = (await re.json()).idToken;
          const del = await fetch(cfg.SUPABASE_URL + "/rest/v1/workspaces?owner=eq." + encodeURIComponent(uid), {
            method: "DELETE", headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + fresh }
          });
          if (!del.ok) throw new Error("delete_failed");
          const fin = await fetch(IT + "accounts:delete?key=" + fk, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: fresh })
          });
          if (!fin.ok) throw new Error("delete_failed");
          await A.signOut();
        } catch (err) {
          const code = err && err.data && err.data.error;
          out.textContent = code === "wrong_password" ? T.delWrong : T.delFailed;
          out.className = "dash-note is-err";
          btn.disabled = false;
        }
      });
      $$("[data-meta-disconnect]", p).forEach((b) => b.addEventListener("click", async () => {
        if (state.meta.pending || !window.confirm(T.metaDisconnectConfirm)) return;
        state.meta.pending = true; paint();
        try {
          await A.rest("/functions/v1/meta-connect", { method: "POST", body: JSON.stringify({ action: "disconnect", workspaceId: state.ws.id, connectionId: b.getAttribute("data-meta-disconnect") }) });
          state.meta.message = ""; state.meta.messageError = false;
        } catch (error) {
          state.meta.message = T.metaFailed; state.meta.messageError = true;
        } finally {
          state.meta.pending = false;
          state.meta.loaded = false;
          loadMetaConnections(true);
          paint();
        }
      }));
    }
  }

  // Fires contact-event triggers (tag applied/removed, field changed) for live flows.
  function fireContactEvents(contactId, before, after) {
    const evs = [];
    const bt = (before.tags || []).map((t) => String(t).toLowerCase());
    const at = (after.tags || []).map((t) => String(t).toLowerCase());
    (after.tags || []).forEach((t, i) => { if (bt.indexOf(at[i]) === -1) evs.push({ kind: "tag-applied", key: String(t) }); });
    (before.tags || []).forEach((t) => { if (at.indexOf(String(t).toLowerCase()) === -1) evs.push({ kind: "tag-removed", key: String(t) }); });
    const bf = before.fields || {}, af = after.fields || {};
    Object.keys(af).forEach((k) => { if (String(bf[k]) !== String(af[k])) evs.push({ kind: "field-changed", key: k }); });
    Object.keys(bf).forEach((k) => { if (!(k in af)) evs.push({ kind: "field-changed", key: k }); });
    evs.slice(0, 10).forEach((e) => {
      tgApi("/api/automation/event", { workspace: state.ws.id, contact_id: contactId, kind: e.kind, key: e.key }).catch(() => {});
    });
  }

  function syncCeditFromDom() {
    const ed = state.cedit;
    if (!ed) return;
    const n = $("#cf-name"), h = $("#cf-handle"), ch = $("#cf-ch"), tg = $("#cf-tags");
    if (n) ed.name = n.value;
    if (h) ed.handle = h.value;
    if (ch) ed.channel = ch.value;
    if (tg) ed.tags = tg.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 6);
  }

  async function saveContact() {
    const before = state.cedit.id ? (state.contacts.filter((c) => c.id === state.cedit.id)[0] || {}) : {};
    const name = tidy($("#cf-name").value, 80).trim();
    if (!name) { $("#cf-name").focus(); return; }
    const body = {
      name,
      handle: tidy($("#cf-handle").value, 80).trim() || null,
      channel: $("#cf-ch").value,
      tags: $("#cf-tags").value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
      fields: state.cedit.fields || {},
      last_seen: new Date().toISOString()
    };
    if (state.cedit.id) {
      const row = await A.rest("/rest/v1/contacts?id=eq." + state.cedit.id, { method: "PATCH", body: JSON.stringify(body) });
      const i = state.contacts.findIndex((c) => c.id === state.cedit.id);
      if (i > -1) state.contacts[i] = Object.assign({}, state.contacts[i], Array.isArray(row) ? row[0] : body);
      fireContactEvents(state.cedit.id, before, body);
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
    const tf = window.CHATORA_TEMPLATE_FLOWS && window.CHATORA_TEMPLATE_FLOWS[tpl.id];
    const own = tf && (tf[LANG] || tf.en);
    if (own && own.length) return JSON.parse(JSON.stringify(own));
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

  const BLANK = ({ en: { b: "Start blank", n: "New flow", t: "Describe what starts this flow (e.g. a customer sends \"price\")", m: "Write the first reply here" },
    ar: { b: "ابدأ من الصفر", n: "سيناريو جديد", t: "اكتب ما الذي يبدأ السيناريو (مثلاً: العميل يرسل \"السعر\")", m: "اكتب الرد الأول هنا" },
    es: { b: "Empezar en blanco", n: "Flujo nuevo", t: "Describe qué inicia este flujo (p. ej. un cliente escribe \"precio\")", m: "Escribe aquí la primera respuesta" },
    fr: { b: "Partir de zéro", n: "Nouveau flux", t: "Décrivez ce qui déclenche ce flux (ex. un client écrit \"prix\")", m: "Écrivez ici la première réponse" },
    de: { b: "Leer starten", n: "Neuer Ablauf", t: "Beschreiben Sie den Auslöser (z. B. Kunde schreibt \"Preis\")", m: "Erste Antwort hier schreiben" },
    pt: { b: "Começar em branco", n: "Novo fluxo", t: "Descreva o que inicia este fluxo (ex.: cliente envia \"preço\")", m: "Escreva aqui a primeira resposta" } })[LANG] || {};
  const BASIC_PACK = {
    en: [
      { n: "Welcome message", t: "/start", m: ["Hi {name}! Thanks for reaching out. How can we help today?", "Type MENU any time to see what I can do."] },
      { n: "FAQ starter", t: "faq", m: ["Here are quick answers:\n1. Prices: type PRICE\n2. Hours: type HOURS\n3. Talk to a person: type HUMAN", "Edit these answers in this flow to match your business."] },
      { n: "Main menu", t: "menu", m: ["Main menu:\n1. Prices\n2. Opening hours\n3. Our location\n4. Talk to a person\nReply with a number."] }
    ],
    ar: [
      { n: "رسالة الترحيب", t: "/start", m: ["أهلاً {name}! شكراً لتواصلك. كيف نقدر نساعدك اليوم؟", "اكتب «القائمة» في أي وقت لعرض الخيارات."] },
      { n: "الأسئلة الشائعة", t: "faq", m: ["إجابات سريعة:\n١. الأسعار: اكتب السعر\n٢. المواعيد: اكتب المواعيد\n٣. التحدث مع موظف: اكتب موظف", "عدّل هذه الإجابات في هذا السيناريو لتناسب نشاطك."] },
      { n: "القائمة الرئيسية", t: "القائمة", m: ["القائمة الرئيسية:\n١. الأسعار\n٢. مواعيد العمل\n٣. موقعنا\n٤. التحدث مع موظف\nرد برقم."] }
    ]
  };
  function basicPackHave() {
    const set = (BASIC_PACK[LANG] || BASIC_PACK.en)[0].n;
    return state.flows.some((f) => f.name === set);
  }
  async function addBasicPack() {
    if (basicPackHave()) { alert(CHS.bpHave); return; }
    const pack = BASIC_PACK[LANG] || BASIC_PACK.en;
    for (const x of pack) {
      const nodes = [{ t: "trigger", text: x.t }].concat(x.m.map((m) => ({ t: "msg", text: m })));
      const row = await A.rest("/rest/v1/flows", { method: "POST", body: JSON.stringify({ workspace_id: state.ws.id, name: x.n, channel: "instagram", status: "draft", runs: 0, nodes: nodes }) });
      state.flows.unshift(Array.isArray(row) ? row[0] : row);
    }
    state.view = "flows"; state.templates = false;
    paint();
    const ok = document.createElement("div");
    ok.className = "toast"; ok.textContent = CHS.bpDone;
    document.body.appendChild(ok); setTimeout(() => ok.remove(), 5000);
  }

  async function useBlank() {
    const row = await A.rest("/rest/v1/flows", {
      method: "POST",
      body: JSON.stringify({ workspace_id: state.ws.id, name: BLANK.n, channel: "instagram", status: "draft", runs: 0,
        nodes: [{ t: "trigger", text: BLANK.t }, { t: "message", text: BLANK.m }] })
    });
    const made = Array.isArray(row) ? row[0] : row;
    state.flows.unshift(made);
    state.templates = false; state.gq = ""; state.edit = made;
    state.steps = JSON.parse(JSON.stringify(made.nodes || []));
    state.guide = false; state.ready = false;
    paint();
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
    const made = Array.isArray(row) ? row[0] : row;
    state.flows.unshift(made);
    state.templates = false;
    state.gq = "";
    state.edit = made;
    state.steps = JSON.parse(JSON.stringify(made.nodes || []));
    state.guide = true;
    state.ready = false;
    paint();
    const ok = document.createElement("div");
    ok.className = "toast";
    ok.textContent = T.gAdded + " · " + loc.t;
    document.body.appendChild(ok);
    setTimeout(() => ok.remove(), 2600);
  }

  function guideHtml() {
    if (!state.guide) return "";
    if (state.ready) return `<div class="dash-card"><h2>\u2713 ${esc(T.guideReadyTitle)}</h2><p class="dash-note">${esc(T.guideReadyText)}</p><div class="dash-inline"><button type="button" class="btn btn-primary btn-sm" id="ed-connect">${esc(T.connectCta)}</button><button type="button" class="btn btn-ghost btn-sm" id="ed-try">${esc(T.tryOptional)}</button></div></div>`;
    const left = (state.steps || []).reduce((n, s) => n + ((String(s.text || "").match(/\[[^\]]+\]/g) || []).length), 0);
    return `<div class="dash-card"><h2>${esc(T.guideTitle)}</h2><ol class="dash-note"><li>${esc(T.guide1)}${left ? " (" + left + ")" : ""}</li><li>${esc(T.guide2)}</li></ol></div>`;
  }

  function openEditor(id) {
    const f = state.flows.filter((x) => x.id === id)[0];
    if (!f) return;
    state.guide = false;
    state.ready = false;
    state.edit = f;
    state.steps = JSON.parse(JSON.stringify(f.nodes || []));
    paint();
  }

  function bindEditor(p) {
    if (!state.edit) return;
    $("#ed-back", p).addEventListener("click", () => { flushEditor(); state.edit = null; state.steps = []; state.guide = false; state.ready = false; paint(); });
    const goConnect = $("#ed-connect", p);
    if (goConnect) goConnect.addEventListener("click", () => { flushEditor(); state.edit = null; state.steps = []; state.guide = false; state.ready = false; setView("settings"); });
    const tryIt = $("#ed-try", p);
    if (tryIt) tryIt.addEventListener("click", () => { const t = $("#ed-test"); if (t) t.click(); });
    const nm = $("#ed-name", p);
    if (nm) nm.addEventListener("input", () => { state.edit.name = nm.value; markDirty(); });

    $$(".dstep-in, .step-in", p).forEach((el) => el.addEventListener("input", () => {
      const i = +el.getAttribute("data-i"), k = el.getAttribute("data-k");
      if (k === "v") state.steps[i][k] = Math.max(1, parseInt(el.value || "1", 10));
      else if (k === "elseSkip") { const n = parseInt(el.value, 10) || 0; if (n > 0) state.steps[i][k] = n; else delete state.steps[i][k]; }
      else state.steps[i][k] = el.value;
      markDirty();
    }));
    $$("[data-move]", p).forEach((b) => b.addEventListener("click", () => {
      const i = +b.getAttribute("data-move"), d = +b.getAttribute("data-dir");
      const j = i + d;
      [state.steps[i], state.steps[j]] = [state.steps[j], state.steps[i]];
      markDirty();
      paint();
    }));
    $$("[data-del]", p).forEach((b) => b.addEventListener("click", () => {
      state.steps.splice(+b.getAttribute("data-del"), 1);
      markDirty();
      paint();
    }));
    $$("[data-add]", p).forEach((b) => b.addEventListener("click", () => {
      const kind = b.getAttribute("data-add");
      state.steps.push(kind === "delay" ? { t: "delay", v: 10 } : kind === "buy" ? { t: "buy", text: "", url: "" } : kind === "webhook" ? { t: "webhook", url: "" } : { t: kind, text: "" });
      markDirty();
      paint();
    }));
    const edFolder = $("#ed-folder", p), edTrack = $("#ed-track", p);
    if (edFolder) edFolder.addEventListener("input", () => { const v = tidy(edFolder.value, 30).trim(); if (v) state.steps[0].folder = v; else delete state.steps[0].folder; markDirty(); });
    if (edTrack) edTrack.addEventListener("change", () => { if (edTrack.checked) state.steps[0].track = true; else delete state.steps[0].track; markDirty(); });
    const edStatus = $("#ed-status", p);
    if (edStatus) edStatus.addEventListener("change", () => { state.pendingStatus = edStatus.value; markDirty(); });
    $("#ed-save", p).addEventListener("click", async () => {
      clearTimeout(state.auto.timer);
      state.auto.dirty = false;
      const done = await persistFlow(true);
      if (!done) return;
      if (state.guide) { state.ready = true; paint(); return; }
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
      clearTimeout(state.auto.timer);
      state.auto.dirty = false;
      if (!confirm(T.confirmDelete)) return;
      await A.rest("/rest/v1/flows?id=eq." + state.edit.id, { method: "DELETE" });
      state.flows = state.flows.filter((f) => f.id !== state.edit.id);
      state.edit = null; state.steps = [];
      paint();
    });
  }

  function persistFlow(loud) {
    const name = tidy(($("#ed-name") ? $("#ed-name").value : state.edit.name), 70).trim() || state.edit.name;
    const stEl = $("#ed-status");
    const fstatus = state.pendingStatus || (stEl && ["draft", "live", "paused"].indexOf(stEl.value) !== -1 ? stEl.value : state.edit.status);
    state.steps.forEach((s) => { if (typeof s.text === "string") s.text = tidy(s.text, 1000); if (s.t === "buy" || s.t === "webhook") s.url = String(s.url || "").trim(); });
    if (state.steps.some((s) => s.t === "webhook" && !HOOK_OK(s.url))) { if (loud) window.alert(T.sHookBad); return Promise.resolve(false); }
    if (state.steps.some((s) => s.t === "buy" && !BUY_RE.test(s.url))) { if (loud) { const okEl = $("#ed-ok"); if (okEl) { okEl.textContent = T.sBuyBad; } window.alert(T.sBuyBad); } return Promise.resolve(false); }
    return A.rest("/rest/v1/flows?id=eq." + state.edit.id, {
      method: "PATCH",
      body: JSON.stringify({ name: name, status: fstatus, nodes: state.steps, updated_at: new Date().toISOString() })
    }).then(() => {
      state.edit.name = name;
      state.edit.status = fstatus;
      state.edit.nodes = state.steps;
      state.pendingStatus = "";
      return true;
    });
  }

  function markDirty() {
    if (!state.edit) return;
    state.auto.dirty = true;
    clearTimeout(state.auto.timer);
    state.auto.timer = setTimeout(autoSave, 1600);
  }

  function autoSave() {
    if (!state.edit || state.auto.busy) return;
    state.auto.busy = true;
    state.auto.dirty = false;
    const ok = $("#ed-ok");
    if (ok) ok.textContent = T.sAutoSaving;
    Promise.resolve(persistFlow(false)).then((saved) => {
      state.auto.busy = false;
      if (ok && state.edit) ok.textContent = saved ? T.sAutoSaved : T.sAutoFix;
      if (state.auto.dirty) markDirty();
    }).catch(() => {
      state.auto.busy = false;
      state.auto.dirty = true;
      if (ok && state.edit) ok.textContent = T.sAutoErr;
    });
  }

  function flushEditor() {
    clearTimeout(state.auto.timer);
    if (state.auto.dirty && state.edit) { state.auto.dirty = false; persistFlow(false).catch(() => {}); }
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
          `<div class="tmodal-sys">⏳ ${esc(T.testWait)} ${num(s.v || 0)} ${esc(({ m: TK.uMin, h: TK.uHour, d: TK.uDay })[s.u || "m"])}</div>`);
      } else if (s.t === "trigger") {
        body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys is-start">▸ ${esc(s.text || "")}</div>`);
      } else if (s.t === "cond") {
        const verdict = contactMatchesCond(s.text, sampleContact());
        const mark = verdict == null ? "" : verdict ? " ✓" : " ✗";
        body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys">❓ ${esc(s.text || "")}${mark}</div>`);
        if (verdict === false) {
          const sk = Math.max(0, Math.min(20, parseInt(s.elseSkip, 10) || 0));
          if (sk > 0 && i + sk < state.steps.length) {
            body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys">↷ ${esc(T.sCondSkipN.replace("{n}", sk))}</div>`);
            i += sk;
          } else {
            body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys">■ ${esc(T.sCondStopped)}</div>`);
            i = state.steps.length;
          }
        }
      } else if (s.t === "webhook") {
        body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys">🔗 ${esc(s.url || "")}</div>`);
      } else if (s.t === "buy") {
        body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys">💳 ${esc(s.text || "")} — ${esc(s.url || "")}</div>`);
      } else if (s.t === "tag") {
        const verdict = contactMatchesCond("tag:" + String(s.text || "").trim(), sampleContact());
        const mark = verdict == null ? "" : verdict ? " ✓" : " ✗";
        body.insertAdjacentHTML("beforeend", `<div class="tmodal-sys">🏷️ ${esc(s.text || "")}${mark}</div>`);
      } else if (s.t === "msg") {
        // A local visual preview only; no AI provider is called and no message is sent.
        body.insertAdjacentHTML("beforeend", `<div class="bub is-out is-typing" id="typing">${esc(T.testTyping)}</div>`);
        body.scrollTop = body.scrollHeight;
        setTimeout(() => {
          const t = $("#typing");
          if (t) t.outerHTML = `<div class="bub is-out">${esc(applyTokens(s.text || "", sampleContact()))}<span class="bub-meta">${esc(T.testRole)}</span></div>`;
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
    const wantView = VIEWS.indexOf(params.get("view") || "") >= 0 ? params.get("view") : "";
    const candidate = params.get("tpl") || "";
    const tplId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(candidate) ? candidate : "";
    const next = wantsTemplates ? "app.html?view=templates" + (tplId ? "&tpl=" + tplId : "") : wantView ? "app.html?view=" + wantView : "app.html";
    const s = await A.ensure();
    if (!s) { location.replace("login.html?next=" + encodeURIComponent(next)); return; }
    if (wantsTemplates) { state.view = "flows"; state.templates = true; state.gq = tplId; } else if (wantView) state.view = wantView;
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
