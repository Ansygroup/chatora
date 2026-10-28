/* ==========================================================================
   CHATORA — interaction & motion engine (vanilla, no dependencies)
   ========================================================================== */
(function () {
  "use strict";
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Header: scroll state + progress ---------------- */
  function initHeader() {
    const header = $(".site-header");
    const bar = $(".scroll-progress");
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      if (header) header.classList.toggle("is-scrolled", y > 12);
      if (bar) {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + "%";
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  /* ---------------- Mobile drawer ---------------- */
  function initMobile() {
    const btn = $(".nav-toggle");
    const drawer = $(".mobile-drawer");
    if (!btn || !drawer) return;
    const close = () => {
      btn.setAttribute("aria-expanded", "false");
      drawer.classList.remove("is-open");
      document.body.style.overflow = "";
    };
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      if (open) return close();
      btn.setAttribute("aria-expanded", "true");
      drawer.classList.add("is-open");
      document.body.style.overflow = "hidden";
    });
    $$("a", drawer).forEach((a) => a.addEventListener("click", close));
    window.addEventListener("keydown", (e) => e.key === "Escape" && close());
    window.addEventListener("resize", () => window.innerWidth > 860 && close());
  }

  /* ---------------- i18n ---------------- */
  const ALL_LANGS = [
    { code: "en", label: "English", native: "English", dir: "ltr" },
    { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
    { code: "es", label: "Spanish", native: "Español", dir: "ltr" },
    { code: "fr", label: "French", native: "Français", dir: "ltr" },
    { code: "de", label: "German", native: "Deutsch", dir: "ltr" },
    { code: "pt", label: "Portuguese", native: "Português", dir: "ltr" },
  ];
  /* _tools/build.py writes langs.js from the real dictionary coverage: a
     language shows up here only when ≥98% of the visible strings exist in it. */
  const AVAILABLE = window.CHATORA_AVAILABLE_LANGS;
  const LANGS = AVAILABLE && AVAILABLE.length
    ? ALL_LANGS.filter((l) => AVAILABLE.indexOf(l.code) !== -1)
    : ALL_LANGS;
  const I18N = (function () {
    const out = {};
    [window.CHATORA_I18N || {}, window.CHATORA_I18N_PAGES || {}].forEach((src) => {
      Object.keys(src).forEach((lang) => {
        out[lang] = Object.assign({}, out[lang] || {}, src[lang]);
      });
    });
    return out;
  })();
  const originals = new WeakMap();

  function remember(el, kind, value) {
    if (!originals.has(el)) originals.set(el, {});
    const store = originals.get(el);
    if (!(kind in store)) store[kind] = value;
    return store[kind];
  }

  function pageFile() {
    const seg = location.pathname.split("/").filter(Boolean);
    const last = seg.length ? seg[seg.length - 1] : "index.html";
    return last.indexOf(".") === -1 ? "index.html" : last;
  }
  function pathLocale() {
    const first = location.pathname.split("/").filter(Boolean)[0] || "";
    return ["ar", "es", "fr", "de", "pt"].indexOf(first.toLowerCase()) !== -1 ? first.toLowerCase() : "";
  }

  function routeForLanguage(code) {
    const current = pathLocale();
    const file = pageFile() === "index.html" ? "" : pageFile();
    const base = current ? "../" : "";
    const route = code === "en" ? base + file : base + code + "/" + file;
    const query = new URLSearchParams(location.search);
    query.delete("lang");
    const tail = query.toString() ? "?" + query.toString() : "";
    location.replace((route || (current ? "../" : "./")) + tail + location.hash);
  }

  function applyLanguage(code, fromUser) {
    const current = pathLocale();
    /* Each published language has a static URL. An explicit selection moves
       to its translated mirror; the URL is authoritative on direct visits. */
    if (fromUser && code !== (current || "en")) {
      routeForLanguage(code);
      return;
    }
    if (current) code = current;

    const meta = LANGS.find((l) => l.code === code) || LANGS[0];
    const dict = I18N[code] || {};
    const isEn = meta.code === "en";

    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;

    $$("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const en = remember(el, "html", el.innerHTML);
      const icons = remember(el, "svgIcons", Array.from(el.querySelectorAll("svg")).map((svg) => svg.outerHTML).join(""));
      const val = isEn ? null : dict[key];
      // Keep decorative inline icons while replacing the translated label.
      el.innerHTML = val != null ? icons + val : en;
    });
    $$("[data-i18n-ph]").forEach((el) => {
      const key = el.getAttribute("data-i18n-ph");
      const en = remember(el, "ph", el.getAttribute("placeholder") || "");
      el.setAttribute("placeholder", !isEn && dict[key] != null ? dict[key] : en);
    });
    $$("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      const en = remember(el, "aria", el.getAttribute("aria-label") || "");
      el.setAttribute("aria-label", !isEn && dict[key] != null ? dict[key] : en);
    });
    $$("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const en = remember(el, "title", el.getAttribute("title") || "");
      el.setAttribute("title", !isEn && dict[key] != null ? dict[key] : en);
    });
    $$("[data-i18n-alt]").forEach((el) => {
      const key = el.getAttribute("data-i18n-alt");
      const en = remember(el, "alt", el.getAttribute("alt") || "");
      el.setAttribute("alt", !isEn && dict[key] != null ? dict[key] : en);
    });

    const titleKey = document.documentElement.getAttribute("data-title-key");
    if (titleKey) {
      const en = remember(document.documentElement, "docTitle", document.title);
      document.title = !isEn && dict[titleKey] ? dict[titleKey] : en;
    }

    // language switch UI
    $$("[data-lang]").forEach((b) => {
      b.setAttribute("aria-selected", b.getAttribute("data-lang") === meta.code ? "true" : "false");
    });
    $$("[data-lang-current]").forEach((el) => (el.textContent = meta.code.toUpperCase()));
    $$("[data-lang-native]").forEach((el) => (el.textContent = meta.native));
    $$("select[data-lang-select]").forEach((s) => (s.value = meta.code));

    document.dispatchEvent(new CustomEvent("chatora:lang", { detail: { lang: meta.code } }));
    try {
      localStorage.setItem("chatora-lang", meta.code);
      const url = new URL(window.location.href);
      /* Static locale paths are canonical; keep query-mode only as a legacy
         fallback when no locale path exists. */
      if (meta.code === "en" || pathLocale()) url.searchParams.delete("lang");
      else url.searchParams.set("lang", meta.code);
      history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
    } catch (e) {}
  }

  function initLang() {
    // build dropdown items
    $$(".lang-menu").forEach((menu) => {
      menu.innerHTML = LANGS.map(
        (l) =>
          `<button type="button" role="option" data-lang="${l.code}" aria-selected="false"><span>${l.native}</span><span class="native">${l.code.toUpperCase()}</span></button>`
      ).join("");
    });

    document.addEventListener("click", (e) => {
      const trigger = e.target.closest(".lang-btn");
      const option = e.target.closest("[data-lang]");
      const wrap = $(".lang");

      if (trigger) {
        e.preventDefault();
        wrap && wrap.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", wrap && wrap.classList.contains("is-open") ? "true" : "false");
        return;
      }
      if (option) {
        e.preventDefault();
        const code = option.getAttribute("data-lang");
        applyLanguage(code, true);
        wrap && wrap.classList.remove("is-open");
        const btn = $(".lang-btn");
        btn && btn.setAttribute("aria-expanded", "false");
        return;
      }
      if (!e.target.closest(".lang")) {
        wrap && wrap.classList.remove("is-open");
        const btn = $(".lang-btn");
        btn && btn.setAttribute("aria-expanded", "false");
      }
    });

    $$("select[data-lang-select]").forEach((sel) => {
      sel.addEventListener("change", () => applyLanguage(sel.value, true));
    });

    // Static locale paths are the source of truth. A legacy ?lang= URL is
    // normalized to its static route; a saved preference never changes the
    // language of an explicitly opened canonical URL.
    let urlLang = null;
    try { urlLang = new URLSearchParams(location.search).get("lang"); } catch (e) {}
    const current = pathLocale();
    const explicit = !current && LANGS.some((l) => l.code === urlLang);
    const initial = current || (explicit ? urlLang : "en");
    applyLanguage(initial, explicit);
  }

  /* ---------------- Scroll reveal ---------------- */
  function initReveal() {
    const items = $$("[data-reveal]");
    if (!items.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ---------------- Counters ---------------- */
  function initCounters() {
    const nums = $$("[data-count]");
    if (!nums.length) return;
    const run = (el) => {
      const target = parseFloat(el.getAttribute("data-count"));
      const dec = parseInt(el.getAttribute("data-dec") || "0", 10);
      const dur = parseInt(el.getAttribute("data-dur") || "1600", 10);
      const prefix = el.getAttribute("data-prefix") || "";
      const suffix = el.getAttribute("data-suffix") || "";
      if (reduce) {
        el.textContent = prefix + target.toFixed(dec) + suffix;
        return;
      }
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = target * eased;
        el.textContent =
          prefix +
          (dec > 0 ? val.toFixed(dec) : Math.round(val).toLocaleString("en-US")) +
          suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) return nums.forEach(run);
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            run(e.target);
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.4 }
    );
    nums.forEach((n) => io.observe(n));
  }

  /* ---------------- Pricing toggle ---------------- */
  function initPricing() {
    const toggle = $("[data-billing-toggle]");
    if (!toggle) return;
    const buttons = $$("button", toggle);
    const update = (mode) => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-billing") === mode ? "true" : "false"));
      $$("[data-price-monthly]").forEach((el) => {
        const v = mode === "annual" ? el.getAttribute("data-price-annual") : el.getAttribute("data-price-monthly");
        animateNumber(el, v);
      });
      const lang = (document.documentElement.lang || "en").slice(0, 2);
      /* billed lines live in both dictionaries: general pricing keys and page keys */
      const dict = Object.assign(
        {},
        (window.CHATORA_I18N || {})[lang] || {},
        (window.CHATORA_I18N_PAGES || {})[lang] || {}
      );
      $$("[data-billed-monthly]").forEach((el) => {
        const key = el.getAttribute(mode === "annual" ? "data-billed-key-annual" : "data-billed-key-monthly");
        const fallback = el.getAttribute(mode === "annual" ? "data-billed-annual" : "data-billed-monthly");
        el.textContent = key && dict[key] ? dict[key] : fallback;
      });
    };
    let mode = "monthly";
    update(mode);                      /* paint the billed line in the active language */
    document.addEventListener("chatora:lang", () => update(mode));
    buttons.forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.getAttribute("data-billing");
        update(mode);
      })
    );
    document.addEventListener("chatora:lang", () => update(mode));
    update("monthly");
  }

  function animateNumber(el, value) {
    // value may be "free" or numeric string
    if (!el || value == null) return;
    const num = parseFloat(value);
    if (isNaN(num)) {
      el.textContent = value;
      return;
    }
    if (reduce) {
      el.textContent = num;
      return;
    }
    const from = parseFloat(el.textContent) || 0;
    const t0 = performance.now();
    const dur = 420;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (num - from) * eased;
      el.textContent = num % 1 === 0 ? Math.round(v) : v.toFixed(2);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- FAQ ---------------- */
  function initFaq() {
    $$(".faq-item").forEach((item) => {
      const btn = $(".faq-q", item);
      const panel = $(".faq-a", item);
      if (!btn || !panel) return;
      btn.addEventListener("click", () => {
        const open = item.classList.contains("is-open");
        $$(".faq-item").forEach((other) => {
          if (other !== item) {
            other.classList.remove("is-open");
            const q = $(".faq-q", other);
            const a = $(".faq-a", other);
            q && q.setAttribute("aria-expanded", "false");
            if (a) a.style.maxHeight = null;
          }
        });
        item.classList.toggle("is-open", !open);
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        panel.style.maxHeight = open ? null : panel.scrollHeight + "px";
      });
    });
  }

  /* ---------------- Pointer spotlight on cards ---------------- */
  function initSpotlight() {
    if (reduce || window.matchMedia("(hover: none)").matches) return;
    const cards = $$(".channel-card, .bento-card");
    cards.forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--cx", ((e.clientX - r.left) / r.width) * 100 + "%");
        card.style.setProperty("--cy", ((e.clientY - r.top) / r.height) * 100 + "%");
      });
    });
    const hero = $(".hero-spot");
    if (hero) {
      window.addEventListener(
        "pointermove",
        (e) => {
          const r = hero.getBoundingClientRect();
          hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
          hero.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
        },
        { passive: true }
      );
    }
  }

  /* ---------------- Hero chat loop ---------------- */
  function initChatLoop() {
    const body = $(".chat-body");
    if (!body || reduce) return;
    setInterval(() => {
      body.classList.remove("replay");
      void body.offsetWidth;
      body.classList.add("replay");
    }, 12000);
  }

  /* ---------------- Section subnav ---------------- */
  function initSubnav() {
    const links = $$(".sticky-subnav a[href^='#']");
    if (!links.length) return;
    const targets = links
      .map((l) => ({ link: l, el: document.getElementById(l.getAttribute("href").slice(1)) }))
      .filter((t) => t.el);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove("is-active"));
            const match = targets.find((t) => t.el === e.target);
            match && match.link.classList.add("is-active");
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    targets.forEach((t) => io.observe(t.el));
  }

  /* ---------------- ROI calculator ---------------- */
  function initCalc() {
    const calc = $("[data-calc]");
    if (!calc) return;
    const contacts = $("#calc-contacts");
    const order = $("#calc-order");
    const rate = $("#calc-rate");
    const outSave = $("#calc-save");
    const outMany = $("#calc-many");
    const outOurs = $("#calc-ours");
    const outRevenue = $("#calc-revenue");
    const outLabelC = $("#calc-contacts-label");
    const outLabelR = $("#calc-rate-label");

    const compute = () => {
      const c = parseInt(contacts.value, 10);
      const aov = parseInt(order.value, 10);
      const r = parseInt(rate.value, 10) / 100;

      // ManyChat-like: Pro 2,500 contacts @ $39, then $0.05 contact; Business 7,500 @ $99, $0.025; Advanced 25,000 @ $199, $0.004
      let many;
      if (c <= 2500) many = 39 + Math.max(0, c - 2500) * 0.05;
      else if (c <= 7500) many = 39 + (c - 2500) * 0.05;
      else if (c <= 25000) many = 99 + (c - 7500) * 0.025;
      else many = 199 + (c - 25000) * 0.004;

      // Chatora: Starter 2,500 @ $9, Growth 10,000 @ $29, Scale 30,000 @ $69, overage $0.02
      let ours;
      if (c <= 2500) ours = 9;
      else if (c <= 10000) ours = 29;
      else if (c <= 30000) ours = 69;
      else ours = 69 + (c - 30000) * 0.02;

      const save = Math.max(0, many - ours);
      // assumed 6% conversation-to-order lift from faster replies, capped realistically
      const extraOrders = Math.round(c * r * 0.06);

      outSave.textContent = "$" + Math.round(save).toLocaleString("en-US");
      outMany.textContent = "$" + Math.round(many).toLocaleString("en-US");
      outOurs.textContent = "$" + Math.round(ours).toLocaleString("en-US");
      outRevenue.textContent = "$" + Math.round(extraOrders * aov * 12).toLocaleString("en-US");
      outLabelC.textContent = c.toLocaleString("en-US");
      outLabelR.textContent = rate.value + "%";
    };

    [contacts, order, rate].forEach((el) => el && el.addEventListener("input", compute));
    compute();
  }



  /* ---------------- Templates gallery ---------------- */
  function initTemplates() {
    const grid = $("[data-tpl-grid]");
    if (!grid) return;
    const cards = $$(".tpl-card", grid);
    const chips = $$(".tpl-chip");
    const search = $("#tpl-search");
    const countEl = $("[data-tpl-count]");
    const empty = $("[data-tpl-empty]");
    let cat = "all";
    let q = "";

    function apply() {
      let visible = 0;
      cards.forEach((card) => {
        const matchCat = cat === "all" || card.dataset.cat === cat;
        const hay = (card.dataset.name + " " + card.dataset.desc + " " + card.dataset.cat).toLowerCase();
        const matchQ = !q || hay.includes(q);
        const show = matchCat && matchQ;
        card.hidden = !show;
        if (show) visible++;
      });
      if (countEl) {
        countEl.textContent =
          visible === cards.length
            ? t("bp.showing", "Showing all ") + cards.length + t("bp.showing2", " templates")
            : "Showing " + visible + " of " + cards.length + " templates";
      }
      if (empty) empty.hidden = visible !== 0;
    }

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        cat = chip.dataset.filter;
        apply();
      });
    });

    if (search) {
      let t;
      search.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          q = search.value.trim().toLowerCase();
          apply();
        }, 120);
      });
    }
    apply();
  }

  /* ---------------- Illustrative demo modal ---------------- */
  function initDemo() {
    const modal = $("[data-demo-modal], #demo-modal");
    if (!modal) return;
    const body = $("#demo-body", modal);
    const script = [
      { t: "in", who: "Example question", text: "How can I check this item?" },
      { t: "out", text: "Draft reply: [approved item information]" },
      { t: "in", who: "Example follow-up", text: "Could you share the delivery details?" },
      { t: "out", text: "Draft reply: [approved shipping policy]" },
      { t: "in", who: "Example response", text: "Thanks — I’ll review it." },
    ];
    let timers = [];
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function play() {
      clearTimers();
      body.innerHTML = "";
      let delay = 350;
      script.forEach((msg) => {
        const typingEl = document.createElement("div");
        typingEl.className = "typing";
        typingEl.innerHTML = "<i></i><i></i><i></i>";
        timers.push(setTimeout(() => {
          body.appendChild(typingEl);
          requestAnimationFrame(() => typingEl.classList.add("show"));
        }, delay - 700 > 0 ? delay - 700 : delay));
        timers.push(setTimeout(() => {
          typingEl.remove();
          const el = document.createElement("div");
          el.className = "m " + msg.t;
          el.innerHTML =
            (msg.who ? `<small style="display:block;font-size:9.5px;opacity:.55;margin-bottom:3px">${msg.who}</small>` : "") +
            msg.text +
            (msg.tag ? `<small>✓ ${msg.tag}</small>` : "");
          body.appendChild(el);
          requestAnimationFrame(() => el.classList.add("show"));
          body.scrollTop = body.scrollHeight;
        }, delay));
        delay += msg.t === "out" || msg.t === "ai" ? 1500 : 1150;
      });
      timers.push(setTimeout(() => {
        const el = document.createElement("div");
        el.className = "m ai";
        el.textContent = "Illustrative draft only · no customer or order data · not sent";
        body.appendChild(el);
        requestAnimationFrame(() => el.classList.add("show"));
      }, delay + 300));
    }

    function open(e) {
      if (e) e.preventDefault();
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      play();
    }
    function close() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      clearTimers();
    }

    document.addEventListener("click", (e) => {
      const opener = e.target.closest("[data-demo-open], a[href='#demo']");
      if (opener) { open(e); return; }
      if (e.target.closest("[data-demo-close]")) close();
    });
    const replay = $("[data-demo-replay]", modal);
    replay && replay.addEventListener("click", play);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });
  }

  /* ---------------- Forms → Supabase ---------------- */
  function t(key, fallback) {
    const code = document.documentElement.lang || "en";
    const dict = I18N[code] || {};
    return dict[key] != null ? dict[key] : fallback;
  }
  /* page scripts (playground, templates) render strings after load — they need
     the same dictionary the rest of the page uses */
  window.chatoraT = t;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function initForms() {
    $$("form[data-demo-form]").forEach((form) => {
      let note = $("[data-form-note]", form.parentElement);
      if (!note) {
        note = document.createElement("p");
        note.setAttribute("data-form-note", "");
        note.setAttribute("role", "status");
        note.setAttribute("aria-live", "polite");
        note.style.cssText = "font-size:12.5px;margin:8px 0 0;color:#8b87ab";
        form.appendChild(note);
      }

      const say = (msg, tone) => {
        note.textContent = msg;
        note.style.color = tone === "ok" ? "#9CF3EA" : tone === "warn" ? "#FFCF7A" : "#8b87ab";
      };

      /* --- anti-spam: honeypot + minimum time on form --- */
      const trap = $('input[name="company_website"]', form);
      const stamp = $("[data-form-ts]", form);
      const resetStamp = () => {
        if (!stamp) return;
        stamp.value = String(Date.now());
        delete stamp.dataset.touched;
      };
      if (stamp && !stamp.value) resetStamp();
      const stampInput = $('input[type="text"]:not([name="company_website"])', form);
      if (stampInput) {
        stampInput.addEventListener("input", () => {
          if (stamp && !stamp.dataset.touched) {
            stamp.dataset.touched = "1";
            stamp.value = String(Date.now());
          }
        });
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const btn = $("button[type=submit]", form);
        if (!btn || btn.dataset.busy === "1") return;

        const note0 = $("[data-form-note]", form.parentElement) || $("[data-form-note]", form);
        if (trap && trap.value.trim() !== "") {
          /* a bot filled the hidden field: pretend success, store nothing */
          if (note0) { note0.textContent = t("form.ok", "Thanks — we'll be in touch."); note0.style.color = "#9CF3EA"; }
          form.reset();
          resetStamp();
          return;
        }
        if (stamp && stamp.value) {
          const waited = Date.now() - parseInt(stamp.value, 10);
          if (waited < 2500) {
            if (note0) { note0.textContent = t("form.fast", "That was quick — take a second and try again."); note0.style.color = "#FFCF7A"; }
            return;
          }
        }

        const emailEl = $('input[type="email"]', form);
        const email = (emailEl && emailEl.value ? emailEl.value : "").trim();
        if (!EMAIL_RE.test(email)) {
          say(t("form.invalid", "That email doesn't look right — mind checking it?"), "warn");
          emailEl && emailEl.focus();
          return;
        }

        const labelEl = btn.querySelector("span[data-i18n]") || btn;
        const original = labelEl.innerHTML;
        btn.dataset.busy = "1";
        btn.disabled = true;
        btn.style.opacity = ".75";
        labelEl.textContent = t("form.sending", "Sending…");
        say(t("form.sending", "Sending…"), "");

        const isContact = form.getAttribute("data-form-variant") === "contact";
        const nameEl = $('input[type="text"]:not([name="company_website"])', form);
        const selEl = $("select", form);
        const msgEl = $("textarea", form);
        const pick = selEl && selEl.value ? selEl.value : "";
        const payload = {
          email: email,
          name: nameEl && nameEl.value ? nameEl.value : "",
          channel: isContact ? "" : pick,
          topic: isContact ? pick : "",
          message: msgEl && msgEl.value ? msgEl.value : "",
          variant: form.getAttribute("data-form-variant") || (form.closest(".cta-form") ? "final-cta" : "")
        };

        const finish = (ok, queued) => {
          btn.disabled = false;
          btn.style.opacity = "";
          delete btn.dataset.busy;
          labelEl.innerHTML = original;
          if (ok) {
            labelEl.textContent = "✓";
            setTimeout(() => {
              labelEl.innerHTML = original;
            }, 2600);
            form.reset();
            resetStamp();
            say(
              queued
                ? t("form.queued", "Saved on this device. Submission will resume when you're back online.")
                : isContact
                  ? t("form.sent", "Thanks — your message was received.")
                  : t("form.ok", "Thanks — your details were received."),
              queued ? "warn" : "ok"
            );
            if (window.ChatoraAPI) window.ChatoraAPI.track("lead_submitted", { page: location.pathname });
          } else if (queued) {
            say(
              t("form.queued", "Saved on this device. Submission will resume when you're back online."),
              "warn"
            );
          } else {
            say(
              t("form.error", "We couldn't reach the server. Please retry in a moment."),
              "warn"
            );
          }
        };
        if (!window.ChatoraAPI || typeof window.ChatoraAPI.submitLead !== "function") {
          finish(false, false);
          return;
        }
        window.ChatoraAPI.submitLead(payload)
          .then((res) => finish(true, !!(res && res.queued)))
          .catch(() => finish(false, false));
      });
    });
  }

  /* ---------------- Announcement dismiss ---------------- */
  function initMisc() {
    const closeBtn = $("[data-dismiss-announce]");
    const bar = $(".announce");
    if (closeBtn && bar) {
      closeBtn.addEventListener("click", () => {
        bar.style.height = bar.offsetHeight + "px";
        requestAnimationFrame(() => {
          bar.style.transition = "height .35s ease, opacity .25s";
          bar.style.height = "0px";
          bar.style.opacity = "0";
          bar.style.overflow = "hidden";
        });
      });
    }
    $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    initHeader();
    initMobile();
    initLang();
    initReveal();
    initCounters();
    initPricing();
    initFaq();
    initSpotlight();
    initChatLoop();
    initSubnav();
    initCalc();
    initTemplates();
    initDemo();
    initForms();
    initMisc();
    if (window.ChatoraAPI && window.ChatoraAPI.pageview) {
      setTimeout(() => window.ChatoraAPI.pageview(), 1200);
    }
    document.documentElement.classList.add("is-ready");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
