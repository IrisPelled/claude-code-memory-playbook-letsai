/* htmleditor.js — עורך תוכן ועיצוב חי לדף אינטרנט זורם, במיתוג האישי של איריס פלד.
   בוחרים אלמנט -> סרגל צף. עריכת מילים, צבע טקסט/רקע/מסגרת, סגנון מסגרת, גופן,
   גודל פונט, הדגשה, עיגול פינות, צל עדין, יישור. אין הזזה ואין שינוי גודל-קופסה
   (position/width/height) בכוונה - כדי לא לפגוע ברספונסיביות.
   שמירה ישירה לאותו קובץ (File System Access API), עם נפילה להורדה בדפדפנים בלי תמיכה. */
(function () {
  if (window.__HTML_EDITOR__) return;
  window.__HTML_EDITOR__ = true;

  // פלטת המותג - איריס פלד (פלטת 2026 + הצבע הכהה הנוסף D4A5B0)
  var PALETTE = ['#BBD23C', '#FDD3DD', '#D4A5B0', '#FAF8F2', '#8E8B88', '#000000', '#FFFFFF'];
  var FONTS = [
    { label: 'Heebo', value: "'Heebo', Arial, sans-serif" },
    { label: 'Antonio', value: "'Antonio', Arial, sans-serif" },
    { label: 'Kalam', value: "'Kalam', cursive" },
    { label: 'OH Yael Leibushor', value: "'OH Yael Leibushor', cursive" }
  ];

  var editing = false;
  var selectedEl = null;
  var textEl = null;
  var undoStack = [];
  var redoStack = [];
  var root = null;

  function init() {
    root = document.createElement('div');
    root.id = 'he-root';
    while (document.body.firstChild) root.appendChild(document.body.firstChild);
    document.body.appendChild(root);

    injectStyle();
    injectFonts();
    buildTopbar();
    buildFloating();

    document.addEventListener('click', onClick, true);
    document.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('mouseout', onHoverOut, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', positionFloating, true);
    window.addEventListener('resize', positionFloating);
    loadStoredHandle();
  }

  /* ---------- סגנונות העורך - גלאסמורפיזם במיתוג איריס פלד ---------- */
  function injectStyle() {
    var s = document.createElement('style');
    s.id = 'he-style';
    s.textContent = [
      '#he-root{display:contents}',
      "#he-topbar{position:fixed;top:16px;left:16px;z-index:2147483000;display:flex;gap:8px;align-items:center;",
      "  background:rgba(250,248,242,.75);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);",
      "  border:1px solid rgba(0,0,0,.12);border-radius:999px;padding:7px 9px;box-shadow:0 6px 24px rgba(0,0,0,.12);",
      "  font-family:'Heebo',Arial,sans-serif;direction:rtl}",
      '#he-topbar button{font:inherit;font-size:14px;font-weight:700;cursor:pointer;border:0;border-radius:999px;',
      '  padding:8px 16px;background:transparent;color:#000;transition:background .15s,color .15s}',
      '#he-topbar .he-primary{background:#BBD23C;color:#000}',
      '#he-topbar .he-primary:hover{background:#000;color:#BBD23C}',
      '#he-topbar .he-primary.on{background:#000;color:#BBD23C}',
      '#he-topbar .he-soft{background:#FDD3DD;color:#000}',
      '#he-topbar .he-soft:hover{background:#BBD23C;color:#000}',
      '#he-topbar .he-secondary{background:#000;color:#FAF8F2}',
      '#he-topbar .he-secondary:hover{background:#FDD3DD;color:#000}',
      'body.he-on *{cursor:default}',
      'body.he-on .he-hover{outline:2px dashed #2F6FED !important;outline-offset:2px;cursor:pointer}',
      'body.he-on .he-selected{outline:2px solid #2F6FED !important;outline-offset:2px}',
      'body.he-on .he-editing{outline:2px solid #2F6FED !important;background:rgba(47,111,237,.08)}',
      '#he-float{position:fixed;z-index:2147483001;display:none;flex-direction:column;gap:6px;width:max-content;',
      '  background:rgba(250,248,242,.85);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      '  border:1px solid rgba(0,0,0,.12);border-radius:16px;padding:8px;box-shadow:0 8px 26px rgba(0,0,0,.18);',
      "  font-family:'Heebo',Arial,sans-serif;direction:rtl}",
      '#he-float.show{display:flex}',
      '#he-float .he-row{display:flex;align-items:center;gap:5px}',
      '#he-float .he-grp{display:flex;align-items:center;gap:1px;background:rgba(0,0,0,.045);border-radius:10px;padding:2px}',
      '#he-float .he-sep{width:1px;height:24px;background:rgba(0,0,0,.12);margin:0 2px;flex:none}',
      '#he-float .he-glabel{font-size:11px;color:#8E8B88;font-weight:700;padding:0 5px 0 2px;white-space:nowrap}',
      '#he-float button{font:inherit;cursor:pointer;border:0;background:transparent;border-radius:8px;min-width:30px;height:30px;',
      '  padding:0 8px;font-size:13px;font-weight:700;color:#000;white-space:nowrap;display:flex;align-items:center;',
      '  justify-content:center;transition:background .15s}',
      '#he-float button:hover{background:#FDD3DD}',
      '#he-float button.he-active{background:#BBD23C}',
      '#he-float .he-fsize,#he-float .he-rsize{font-size:12px;color:#8E8B88;font-weight:700;min-width:28px;text-align:center}',
      "#he-float select{font:inherit;font-size:12px;border:0;border-radius:8px;",
      "  padding:5px 6px;background:transparent;color:#000;cursor:pointer;max-width:104px}",
      '#he-float .he-swatch{position:relative}',
      '#he-float .he-pop{position:absolute;top:38px;right:0;background:#FAF8F2;border:1px solid rgba(0,0,0,.15);',
      '  border-radius:12px;padding:10px;box-shadow:0 8px 26px rgba(0,0,0,.2);display:none;',
      '  grid-template-columns:repeat(4,24px);gap:9px}',
      '#he-float .he-pop.show{display:grid}',
      '#he-float .he-chip{box-sizing:border-box;width:24px;height:24px;border-radius:6px;',
      '  border:1px solid rgba(0,0,0,.15);cursor:pointer;padding:0}',
      '#he-float .he-pop label{grid-column:1/-1;font-size:12px;color:#8E8B88;display:flex;align-items:center;',
      '  gap:8px;cursor:pointer;font-weight:600;margin-top:2px}',
      '#he-float .he-pop label input{box-sizing:border-box;width:24px;height:24px;padding:0;border:1px solid rgba(0,0,0,.15);',
      '  border-radius:6px;background:none;cursor:pointer}',
      '#he-flash{position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(10px);z-index:2147483002;',
      "  background:#000;color:#FAF8F2;font-family:'Heebo',Arial,sans-serif;font-weight:700;font-size:14px;",
      '  padding:10px 18px;border-radius:999px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;direction:rtl}',
      '#he-flash.show{opacity:1;transform:translateX(-50%) translateY(0)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // טוען את גופני המותג (Heebo/Antonio/Kalam) מ-Google Fonts אם עוד לא נטענו בדף,
  // כדי שהחלפת גופן בסרגל הצף תיראה בפועל ולא רק תוחל בשקט על ה-style.
  function injectFonts() {
    if (document.getElementById('he-fonts')) return;
    var link = document.createElement('link');
    link.id = 'he-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&family=Antonio:wght@400;700&family=Kalam:wght@400;700&display=swap';
    document.head.appendChild(link);

    // OH Yael Leibushor הוא פונט פרטי, לא ב-Google Fonts. נטען אותו רק אם הקובץ
    // הועתק לצד הדף (יחד עם htmleditor.js) - אם הוא לא שם, הכלל פשוט לא תופס בשקט.
    var s = document.createElement('style');
    s.id = 'he-fonts-local';
    s.textContent = "@font-face{font-family:'OH Yael Leibushor';src:url('OHYaelLeibushor1.0-Regular.otf') format('opentype');font-display:swap}";
    document.head.appendChild(s);
  }

  /* ---------- סרגל עליון קבוע (פילה צפה) ---------- */
  function buildTopbar() {
    var bar = document.createElement('div');
    bar.id = 'he-topbar';
    bar.innerHTML =
      '<button class="he-primary" id="he-toggle">הפעל עריכה</button>' +
      '<button class="he-soft" id="he-undo" title="בטל">בטל</button>' +
      '<button class="he-soft" id="he-redo" title="שחזר">שחזר</button>' +
      '<button class="he-secondary" id="he-save">שמור</button>';
    document.body.appendChild(bar);
    document.getElementById('he-toggle').onclick = toggleEdit;
    document.getElementById('he-undo').onclick = undo;
    document.getElementById('he-redo').onclick = redo;
    document.getElementById('he-save').onclick = saveInPlace;
  }

  /* ---------- סרגל צף הקשרי ---------- */
  function buildFloating() {
    var f = document.createElement('div');
    f.id = 'he-float';
    f.innerHTML =
      // שורה 1: טיפוגרפיה - גודל+הדגשה צמודים, אז גופן, אז יישור
      '<div class="he-row">' +
      '<div class="he-grp" title="גודל טקסט"><button id="he-smaller" title="הקטן">-</button>' +
      '<span class="he-fsize" id="he-fsize">--</span>' +
      '<button id="he-bigger" title="הגדל">+</button>' +
      '<button id="he-bold" title="הדגשה" style="font-weight:900">B</button></div>' +
      '<div class="he-sep"></div>' +
      '<select id="he-font" title="גופן"></select>' +
      '<div class="he-sep"></div>' +
      '<div class="he-grp" title="יישור"><button id="he-alr" title="ימין">⇥</button>' +
      '<button id="he-alc" title="מרכז">≡</button>' +
      '<button id="he-all" title="שמאל">⇤</button></div>' +
      '</div>' +
      // שורה 2: צבעים, מסגרת, פינות, צל
      '<div class="he-row">' +
      '<div class="he-grp">' +
      '<div class="he-swatch"><button id="he-textcolor" title="צבע טקסט">A<span style="display:block;height:3px;background:#000;margin-top:-2px;border-radius:2px"></span></button>' +
      swatchPop('he-textpop', 'צבע חופשי') + '</div>' +
      '<div class="he-swatch"><button id="he-bgcolor" title="צבע רקע">רקע</button>' +
      swatchPop('he-bgpop', 'צבע חופשי') + '</div>' +
      '<div class="he-swatch"><button id="he-bordercolor" title="צבע מסגרת">מסגרת</button>' +
      swatchPop('he-borderpop', 'צבע חופשי') + '</div></div>' +
      '<div class="he-sep"></div>' +
      '<button id="he-borderstyle" title="סוג קו - לחיצה מחליפה">סוג קו: רציף</button>' +
      '<div class="he-sep"></div>' +
      '<div class="he-grp" title="עיגול פינות"><span class="he-glabel">פינות</span>' +
      '<button id="he-radiusless" title="הקטן פינות">-</button>' +
      '<span class="he-rsize" id="he-rsize">0px</span>' +
      '<button id="he-radiusmore" title="הגדל פינות">+</button></div>' +
      '<div class="he-sep"></div>' +
      '<button id="he-shadow" title="צל עדין - טוגל">צל</button>' +
      '</div>';
    document.body.appendChild(f);

    f.addEventListener('mousedown', function (e) {
      var t = e.target.tagName;
      if (t === 'SELECT' || t === 'INPUT' || t === 'OPTION') return;
      e.preventDefault();
    });

    var fontSel = document.getElementById('he-font');
    FONTS.forEach(function (fo) {
      var o = document.createElement('option');
      o.value = fo.value; o.textContent = fo.label;
      fontSel.appendChild(o);
    });
    fontSel.onchange = function () { applyFont(this.value); };

    document.getElementById('he-smaller').onclick = function () { bumpSize(-2); };
    document.getElementById('he-bigger').onclick = function () { bumpSize(2); };
    document.getElementById('he-bold').onclick = toggleBold;
    document.getElementById('he-borderstyle').onclick = cycleBorderStyle;
    document.getElementById('he-radiusless').onclick = function () { bumpRadius(-2); };
    document.getElementById('he-radiusmore').onclick = function () { bumpRadius(2); };
    document.getElementById('he-shadow').onclick = toggleShadow;
    document.getElementById('he-alr').onclick = function () { applyAlign('right'); };
    document.getElementById('he-alc').onclick = function () { applyAlign('center'); };
    document.getElementById('he-all').onclick = function () { applyAlign('left'); };

    wireSwatch('he-textcolor', 'he-textpop', function (c) { applyColor(c, 'text'); });
    wireSwatch('he-bgcolor', 'he-bgpop', function (c) { applyColor(c, 'bg'); });
    wireSwatch('he-bordercolor', 'he-borderpop', function (c) { applyColor(c, 'border'); });
  }

  function swatchPop(id, freeLabel) {
    var chips = PALETTE.map(function (c) {
      return '<button class="he-chip" data-c="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="he-pop" id="' + id + '">' + chips +
      '<label>' + freeLabel + '<input type="color" value="#000000"></label></div>';
  }

  function wireSwatch(btnId, popId, cb) {
    var btn = document.getElementById(btnId);
    var pop = document.getElementById(popId);
    btn.onclick = function (e) {
      e.stopPropagation();
      var open = pop.classList.contains('show');
      document.querySelectorAll('#he-float .he-pop').forEach(function (p) { p.classList.remove('show'); });
      if (!open) pop.classList.add('show');
    };
    pop.querySelectorAll('.he-chip').forEach(function (chip) {
      chip.onclick = function () { cb(chip.getAttribute('data-c')); pop.classList.remove('show'); };
    });
    pop.querySelector('input[type=color]').oninput = function () { cb(this.value); };
  }

  /* ---------- מצב עריכה ---------- */
  function toggleEdit() {
    editing = !editing;
    document.body.classList.toggle('he-on', editing);
    var t = document.getElementById('he-toggle');
    t.textContent = editing ? 'עריכה דלוקה' : 'הפעל עריכה';
    t.classList.toggle('on', editing);
    if (!editing) deselect();
  }

  function isUI(el) {
    return !el || el.closest('#he-topbar') || el.closest('#he-float') || el.id === 'he-root';
  }

  function onHover(e) {
    if (!editing || textEl) return;
    var el = e.target;
    if (isUI(el) || el === document.body || el === document.documentElement) return;
    el.classList.add('he-hover');
  }
  function onHoverOut(e) { if (e.target.classList) e.target.classList.remove('he-hover'); }

  function onClick(e) {
    if (!editing) return;
    if (isUI(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (textEl && !textEl.contains(e.target)) endTextEdit();
    if (e.target === document.body || e.target === document.documentElement) { deselect(); return; }
    select(e.target);
  }

  function onDblClick(e) {
    if (!editing || isUI(e.target)) return;
    if (textEl && e.target === textEl) {
      // כבר במצב עריכה על האלמנט הזה - משאירים לדפדפן לבחור מילה כרגיל
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    select(e.target);
    startTextEdit(e.target);
  }

  function select(el) {
    if (selectedEl === el) { positionFloating(); return; }
    deselect(true);
    selectedEl = el;
    el.classList.remove('he-hover');
    el.classList.add('he-selected');
    syncFloating();
    showFloating();
  }

  function deselect() {
    if (textEl) endTextEdit();
    if (selectedEl) selectedEl.classList.remove('he-selected');
    selectedEl = null;
    hideFloating();
  }

  /* ---------- עריכת מילים ---------- */
  function startTextEdit(el) {
    if (textEl === el) return;
    snapshot();
    textEl = el;
    el.classList.add('he-editing');
    try { el.setAttribute('contenteditable', 'plaintext-only'); }
    catch (x) { el.setAttribute('contenteditable', 'true'); }
    el.focus();
    el.addEventListener('paste', pasteClean);
    el.addEventListener('blur', endTextEdit);
  }

  function endTextEdit() {
    if (!textEl) return;
    var el = textEl;
    textEl = null;
    el.removeAttribute('contenteditable');
    el.classList.remove('he-editing');
    el.removeEventListener('paste', pasteClean);
    el.removeEventListener('blur', endTextEdit);
    positionFloating();
  }

  function pasteClean(e) {
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  }

  /* ---------- סרגל צף: מיקום וסנכרון ---------- */
  function showFloating() { document.getElementById('he-float').classList.add('show'); positionFloating(); }
  function hideFloating() {
    var f = document.getElementById('he-float');
    f.classList.remove('show');
    f.querySelectorAll('.he-pop').forEach(function (p) { p.classList.remove('show'); });
  }

  function positionFloating() {
    if (!selectedEl) return;
    var f = document.getElementById('he-float');
    if (!f.classList.contains('show')) return;
    var r = selectedEl.getBoundingClientRect();
    var fw = f.offsetWidth || 380, fh = f.offsetHeight || 46;
    var top = r.top - fh - 10;
    if (top < 8) top = r.bottom + 10;
    top = Math.max(8, Math.min(top, window.innerHeight - fh - 8));
    var left = r.left + r.width / 2 - fw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - fw - 8));
    f.style.top = top + 'px';
    f.style.left = left + 'px';
  }

  function syncFloating() {
    if (!selectedEl) return;
    var cs = getComputedStyle(selectedEl);
    document.getElementById('he-fsize').textContent = Math.round(parseFloat(cs.fontSize)) + 'px';
    document.getElementById('he-rsize').textContent = Math.round(parseFloat(cs.borderTopLeftRadius) || 0) + 'px';
    document.getElementById('he-bold').classList.toggle('he-active', isBold(selectedEl));
    document.getElementById('he-shadow').classList.toggle('he-active', hasShadow(selectedEl));
    setBorderStyleLabel(cs.borderTopStyle);
    var fontSel = document.getElementById('he-font');
    var fam = cs.fontFamily || '';
    var match = FONTS.filter(function (fo) { return fam.indexOf(fo.label) !== -1; })[0];
    fontSel.value = match ? match.value : FONTS[0].value;
  }

  var BORDER_STYLE_LABELS = { solid: 'סוג קו: רציף', dashed: 'סוג קו: מקווקו', dotted: 'סוג קו: מנוקד' };
  function setBorderStyleLabel(style) {
    document.getElementById('he-borderstyle').textContent = BORDER_STYLE_LABELS[style] || BORDER_STYLE_LABELS.solid;
  }

  function isBold(el) {
    var w = el.style.fontWeight || getComputedStyle(el).fontWeight;
    return (w === '700' || w === 'bold' || parseInt(w, 10) >= 600);
  }
  function hasShadow(el) {
    var sh = getComputedStyle(el).boxShadow;
    return !!(sh && sh !== 'none');
  }

  /* ---------- פעולות עיצוב ---------- */
  // כל פעולה עושה snapshot() *לפני* השינוי - כך ה-undo שומר את המצב שקדם לשינוי, לא אחריו.
  function applyColor(color, kind) {
    if (!selectedEl) return;
    snapshot();
    if (kind === 'bg') selectedEl.style.backgroundColor = color;
    else if (kind === 'border') { ensureBorderVisible(selectedEl); selectedEl.style.borderColor = color; }
    else selectedEl.style.color = color;
  }

  function ensureBorderVisible(el) {
    var cs = getComputedStyle(el);
    if (!parseFloat(cs.borderTopWidth)) el.style.borderWidth = '2px';
    if (!cs.borderTopStyle || cs.borderTopStyle === 'none') el.style.borderStyle = 'solid';
  }

  function cycleBorderStyle() {
    if (!selectedEl) return;
    snapshot();
    ensureBorderVisible(selectedEl);
    var order = ['solid', 'dashed', 'dotted'];
    var cur = getComputedStyle(selectedEl).borderTopStyle;
    var idx = order.indexOf(cur);
    var next = order[(idx + 1) % order.length];
    selectedEl.style.borderStyle = next;
    setBorderStyleLabel(next);
  }

  function bumpRadius(delta) {
    if (!selectedEl) return;
    snapshot();
    var cur = parseFloat(getComputedStyle(selectedEl).borderTopLeftRadius) || 0;
    var next = Math.max(0, cur + delta);
    selectedEl.style.borderRadius = next + 'px';
    document.getElementById('he-rsize').textContent = Math.round(next) + 'px';
  }

  function toggleShadow() {
    if (!selectedEl) return;
    snapshot();
    var on = hasShadow(selectedEl);
    selectedEl.style.boxShadow = on ? 'none' : '0 4px 16px rgba(0,0,0,.15)';
    document.getElementById('he-shadow').classList.toggle('he-active', !on);
  }

  function applyFont(family) {
    if (!selectedEl) return;
    snapshot();
    selectedEl.style.fontFamily = family;
  }

  function bumpSize(delta) {
    if (!selectedEl) return;
    snapshot();
    var cur = parseFloat(getComputedStyle(selectedEl).fontSize) || 16;
    var next = Math.max(8, cur + delta);
    selectedEl.style.fontSize = next + 'px';
    document.getElementById('he-fsize').textContent = Math.round(next) + 'px';
  }

  function toggleBold() {
    if (!selectedEl) return;
    snapshot();
    var bold = isBold(selectedEl);
    selectedEl.style.fontWeight = bold ? '400' : '700';
    document.getElementById('he-bold').classList.toggle('he-active', !bold);
  }

  function applyAlign(dir) {
    if (!selectedEl) return;
    snapshot();
    selectedEl.style.textAlign = dir;
  }

  /* ---------- ביטול / שחזור ---------- */
  function snapshot() {
    undoStack.push(root.innerHTML);
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(root.innerHTML);
    root.innerHTML = undoStack.pop();
    afterRestore();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(root.innerHTML);
    root.innerHTML = redoStack.pop();
    afterRestore();
  }
  function afterRestore() {
    selectedEl = null; textEl = null;
    hideFloating();
    document.querySelectorAll('.he-selected,.he-editing,.he-hover').forEach(function (e) {
      e.classList.remove('he-selected', 'he-editing', 'he-hover');
    });
  }

  function onKey(e) {
    if (!editing) return;
    if (textEl && e.key === 'Escape') { e.preventDefault(); endTextEdit(); return; }
    if (textEl) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault(); e.shiftKey ? redo() : undo();
    }
    if (e.key === 'Escape') deselect();
  }

  /* ---------- שמירה ---------- */
  var fileHandle = null;
  var HKEY = 'he:' + location.pathname;

  function idbOpen() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('htmleditor', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('handles'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(k) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var q = db.transaction('handles', 'readonly').objectStore('handles').get(k);
        q.onsuccess = function () { res(q.result || null); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function idbSet(k, v) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var q = db.transaction('handles', 'readwrite').objectStore('handles').put(v, k);
        q.onsuccess = function () { res(); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }

  function loadStoredHandle() {
    try { idbGet(HKEY).then(function (h) { if (h && !fileHandle) fileHandle = h; }).catch(function () {}); }
    catch (e) {}
  }

  function ensurePerm(h) {
    if (!h.queryPermission) return Promise.resolve(true);
    return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
      if (p === 'granted') return true;
      return h.requestPermission({ mode: 'readwrite' }).then(function (p2) { return p2 === 'granted'; });
    });
  }

  function serialize(keepScript) {
    var clone = document.documentElement.cloneNode(true);
    ['he-topbar', 'he-float', 'he-style', 'he-flash'].forEach(function (id) {
      var n = clone.querySelector('#' + id); if (n) n.parentNode.removeChild(n);
    });
    if (!keepScript) {
      var sc = clone.querySelector('script[src*="htmleditor"]'); if (sc) sc.parentNode.removeChild(sc);
    }
    var r = clone.querySelector('#he-root');
    if (r) { var body = r.parentNode; while (r.firstChild) body.insertBefore(r.firstChild, r); body.removeChild(r); }
    clone.querySelectorAll('[contenteditable]').forEach(function (e) { e.removeAttribute('contenteditable'); });
    clone.querySelectorAll('[class]').forEach(function (e) {
      e.classList.remove('he-on', 'he-selected', 'he-editing', 'he-hover');
      if (!e.getAttribute('class')) e.removeAttribute('class');
    });
    return '<!doctype html>\n' + clone.outerHTML;
  }

  function saveInPlace() {
    if (textEl) endTextEdit();
    if (!window.showSaveFilePicker) { fallbackDownload(); return; }
    (async function () {
      try {
        if (!fileHandle) {
          var name = decodeURIComponent((location.pathname.split('/').pop() || 'index.html'));
          if (!/\.html?$/i.test(name)) name = 'index.html';
          fileHandle = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: 'דף HTML', accept: { 'text/html': ['.html', '.htm'] } }]
          });
          try { await idbSet(HKEY, fileHandle); } catch (e2) {}
        }
        if (!(await ensurePerm(fileHandle))) { flash('צריך לאשר גישה לקובץ'); return; }
        var w = await fileHandle.createWritable();
        await w.write(serialize(true));
        await w.close();
        flash('נשמר');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        fileHandle = null;
        fallbackDownload();
      }
    })();
  }

  function fallbackDownload() {
    var blob = new Blob([serialize(false)], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (document.title || 'page').replace(/\s+/g, '-') + '-edited.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    flash('הדפדפן לא תומך בשמירה ישירה - ירד עותק');
  }

  function flash(msg) {
    var d = document.getElementById('he-flash');
    if (!d) { d = document.createElement('div'); d.id = 'he-flash'; document.body.appendChild(d); }
    d.textContent = msg;
    d.classList.add('show');
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { d.classList.remove('show'); }, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
