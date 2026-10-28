/* Birthday Reminder — app logic */
(function () {
  "use strict";
  const LS = {
    custom: "br_custom_v1",      // added contacts
    edits: "br_edits_v1",        // edits to base contacts {id:{...}}
    deleted: "br_deleted_v1",    // hidden base ids
    settings: "br_settings_v1",
  };
  const VERSION = "1.0.0";
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  /* ---------- storage ---------- */
  const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let settings = Object.assign({ leader: "Rakesh Kaka", cc: "91", template: "rakesh", notify: true }, load(LS.settings, {}));

  /* ---------- data ---------- */
  function allPeople() {
    const edits = load(LS.edits, {});
    const deleted = load(LS.deleted, []);
    const base = (window.BIRTHDAY_DATA || [])
      .filter(p => !deleted.includes(p.id))
      .map(p => Object.assign({}, p, edits[p.id] || {}, { _src: "base" }));
    const custom = load(LS.custom, []).map(p => Object.assign({}, p, { _src: "custom" }));
    return base.concat(custom).filter(p => p.bmonth && p.bday);
  }

  /* ---------- date helpers ---------- */
  const today = new Date(); today.setHours(0,0,0,0);
  function nextOccurrence(p) {
    let y = today.getFullYear();
    let d = new Date(y, p.bmonth - 1, p.bday);
    d.setHours(0,0,0,0);
    if (d < today) d = new Date(y + 1, p.bmonth - 1, p.bday);
    return d;
  }
  const daysUntil = p => Math.round((nextOccurrence(p) - today) / 86400000);
  function ageTurning(p) {
    if (!p.byear) return null;
    return nextOccurrence(p).getFullYear() - p.byear;
  }
  const isToday = p => p.bmonth === today.getMonth() + 1 && p.bday === today.getDate();

  /* ---------- phone helpers ---------- */
  function waNumber(m) {
    let d = (m || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length === 10) d = settings.cc + d;
    return d;
  }
  const telNumber = m => (m || "").replace(/[^\d+]/g, "");

  /* ---------- message templates ---------- */
  function buildMessage(style, people) {
    const lines = people.map(p => `P. B. ${p.name}${p.mobile ? " - " + p.mobile : ""}`);
    const plain = people.map(p => `${p.name}${p.mobile ? " - " + p.mobile : ""}`);
    const dateStr = `${DOW[today.getDay()]}, ${today.getDate()} ${MONTHS[today.getMonth()]}`;
    if (style === "gujarati") {
      return `જય સ્વામિનારાયણ 🙏\n\nઆજે (${today.getDate()}/${today.getMonth()+1}) આપણા નિષ્ઠાવાન વડીલ મુક્તરાજ —\n\n${lines.join(",\n")}\n\nનો જન્મદિવસ છે. 🎂🎉\n\nસર્વે ભૂલકુઓને વિનંતી છે કે ફોન પર શુભેચ્છા પાઠવે.\nઆભાર`;
    }
    if (style === "english") {
      return `🎂 Happy Birthday! 🎉\n\nToday (${dateStr}) we celebrate the birthday of —\n\n${lines.join(",\n")}\n\nPlease call and wish them. 🙏\nJay Swaminarayan`;
    }
    if (style === "list") {
      return plain.join("\n");
    }
    // rakesh (default) — faithful to his WhatsApp style
    return `Jay Swaminarayan Das na Das,\n\nToday our Nishthavan and dedicated Vadil Muktraj —\n\n${lines.join(",\n")}\n\nbirthday. 🎂🎉\n\nAll bhoolkus are requested to wish them on phone.\nThanks 🙏`;
  }
  function personalWish(p) {
    return `Jay Swaminarayan P. B. ${p.name} 🙏\n\nWishing you a very happy birthday! 🎂🎉\nMay Maharaj and Swami shower blessings on you and your family. Stay healthy and blessed always. 🙏`;
  }

  /* ---------- UI helpers ---------- */
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => (s || "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const initials = n => (n || "?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 1900);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast("Copied ✔")).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = el("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Copied ✔"); } catch { toast("Press & hold to copy"); }
    document.body.removeChild(ta);
  }

  /* ---------- action buttons ---------- */
  function actionButtons(p, personal) {
    const row = el("div", "actions");
    if (p.mobile) {
      const wa = el("button", "act wa", "💬 WhatsApp");
      wa.onclick = e => { e.stopPropagation(); const n = waNumber(p.mobile);
        window.open(`https://wa.me/${n}?text=${encodeURIComponent(personalWish(p))}`, "_blank"); };
      row.appendChild(wa);
      const call = el("button", "act call", "📞 Call");
      call.onclick = e => { e.stopPropagation(); location.href = `tel:${telNumber(p.mobile)}`; };
      row.appendChild(call);
      const sms = el("button", "act sms", "✉️ SMS");
      sms.onclick = e => { e.stopPropagation();
        location.href = `sms:${telNumber(p.mobile)}?&body=${encodeURIComponent(personalWish(p))}`; };
      row.appendChild(sms);
    }
    if (p.email) {
      const mail = el("button", "act mail", "📧 Email");
      mail.onclick = e => { e.stopPropagation();
        const sub = encodeURIComponent("Happy Birthday! 🎂");
        location.href = `mailto:${p.email}?subject=${sub}&body=${encodeURIComponent(personalWish(p))}`; };
      row.appendChild(mail);
    }
    const more = el("button", "act more", "ⓘ Details");
    more.onclick = e => { e.stopPropagation(); openPerson(p); };
    row.appendChild(more);
    return row;
  }

  /* ---------- person card ---------- */
  function personCard(p, opts = {}) {
    const card = el("div", "card");
    const top = el("div", "person");
    top.appendChild(el("div", "avatar", initials(p.name)));
    const info = el("div", "p-info");
    info.appendChild(el("div", "p-name", esc(p.name)));
    const meta = el("div", "p-meta");
    const age = ageTurning(p);
    const dOrd = `${p.bday} ${MONTHS[p.bmonth-1].slice(0,3)}`;
    if (opts.showToday) meta.appendChild(el("span", "tag badge-today", "🎉 Today!"));
    meta.appendChild(el("span", "tag", "🎂 " + dOrd));
    if (age != null) meta.appendChild(el("span", "tag", (opts.showToday ? "turns " : "") + age + " yrs"));
    if (p._src === "custom") meta.appendChild(el("span", "tag badge-custom", "added"));
    if (p.kkName) meta.appendChild(el("span", "tag", "KK: " + esc(p.kkName.split(/\s+/)[0])));
    info.appendChild(meta);
    top.appendChild(info);
    if (opts.countdown != null) {
      const cd = opts.countdown === 0 ? "Today" : opts.countdown === 1 ? "Tomorrow" : "in " + opts.countdown + "d";
      top.appendChild(el("div", "countdown", cd));
    }
    card.appendChild(top);
    card.appendChild(actionButtons(p));
    card.onclick = () => openPerson(p);
    top.style.cursor = "pointer";
    return card;
  }

  function emptyState(icon, text) {
    const e = el("div", "empty");
    e.innerHTML = `<span class="big">${icon}</span>${esc(text)}`;
    return e;
  }

  /* ---------- views ---------- */
  let currentView = "today";
  const main = () => $("#main");

  function render() {
    renderStats();
    const m = main(); m.innerHTML = "";
    if (currentView === "today") viewToday(m);
    else if (currentView === "week") viewRange(m, 7, "Next 7 days");
    else if (currentView === "month") viewMonth(m);
    else if (currentView === "all") viewAll(m);
    else if (currentView === "add") viewAdd(m);
    m.scrollTop = 0; window.scrollTo(0, 0);
  }

  function renderStats() {
    const ppl = allPeople();
    const t = ppl.filter(isToday).length;
    const w = ppl.filter(p => { const d = daysUntil(p); return d >= 0 && d <= 7; }).length;
    const mth = ppl.filter(p => p.bmonth === today.getMonth() + 1).length;
    $("#stats").innerHTML =
      `<div class="stat"><b>${t}</b><span>TODAY</span></div>
       <div class="stat"><b>${w}</b><span>THIS WEEK</span></div>
       <div class="stat"><b>${mth}</b><span>THIS MONTH</span></div>
       <div class="stat"><b>${ppl.length}</b><span>TOTAL</span></div>`;
  }

  function viewToday(m) {
    const list = allPeople().filter(isToday).sort((a,b)=>a.name.localeCompare(b.name));
    if (!list.length) {
      m.appendChild(emptyState("🗓️", "No birthdays today.\nCheck the Week tab for upcoming ones."));
      // show tomorrow preview
      const tm = allPeople().filter(p => daysUntil(p) === 1);
      if (tm.length) {
        m.appendChild(el("div", "section-title", `Tomorrow <span class="pill">${tm.length}</span>`));
        tm.forEach(p => m.appendChild(personCard(p, { countdown: 1 })));
      }
      return;
    }
    m.appendChild(messageGenerator(list));
    m.appendChild(el("div", "section-title", `Today's birthdays <span class="pill">${list.length}</span>`));
    list.forEach(p => m.appendChild(personCard(p, { showToday: true })));
  }

  function viewRange(m, days, title) {
    const list = allPeople().map(p => ({ p, d: daysUntil(p) }))
      .filter(x => x.d >= 0 && x.d <= days).sort((a,b)=>a.d-b.d || a.p.name.localeCompare(b.p.name));
    if (!list.length) { m.appendChild(emptyState("📅", "No birthdays in the " + title.toLowerCase() + ".")); return; }
    let lastDay = null;
    list.forEach(x => {
      if (x.d !== lastDay) {
        lastDay = x.d;
        const occ = nextOccurrence(x.p);
        const label = x.d === 0 ? "Today" : x.d === 1 ? "Tomorrow" : `${DOW[occ.getDay()]}, ${occ.getDate()} ${MONTHS[occ.getMonth()].slice(0,3)}`;
        const cnt = list.filter(y=>y.d===x.d).length;
        m.appendChild(el("div", "section-title", `${label} <span class="pill">${cnt}</span>`));
      }
      m.appendChild(personCard(x.p, { countdown: x.d, showToday: x.d === 0 }));
    });
  }

  function viewMonth(m) {
    const sel = el("div", "filter-row");
    const dd = el("select");
    MONTHS.forEach((mn,i) => { const o = el("option"); o.value = i+1; o.textContent = mn; dd.appendChild(o); });
    dd.value = today.getMonth() + 1;
    sel.appendChild(dd);
    m.appendChild(sel);
    const holder = el("div"); m.appendChild(holder);
    const draw = () => {
      holder.innerHTML = "";
      const mm = +dd.value;
      const list = allPeople().filter(p => p.bmonth === mm).sort((a,b)=>a.bday-b.bday || a.name.localeCompare(b.name));
      if (!list.length) { holder.appendChild(emptyState("🎈","No birthdays in " + MONTHS[mm-1] + ".")); return; }
      holder.appendChild(el("div","section-title",`${MONTHS[mm-1]} <span class="pill">${list.length}</span>`));
      list.forEach(p => holder.appendChild(personCard(p, { showToday: isToday(p) })));
    };
    dd.onchange = draw; draw();
  }

  function viewAll(m) {
    const wrap = el("div", "search-wrap");
    const inp = el("input"); inp.type = "search"; inp.placeholder = "Search name or mobile…";
    wrap.appendChild(inp); m.appendChild(wrap);

    const fr = el("div", "filter-row");
    const kkSel = el("select");
    kkSel.appendChild(new Option("All karyakarta", ""));
    const kks = [...new Set(allPeople().map(p=>p.kkName).filter(Boolean))].sort();
    kks.forEach(k => kkSel.appendChild(new Option(k, k)));
    const sortSel = el("select");
    ["Name (A–Z)","Upcoming birthday","Month/Day"].forEach((s,i)=>sortSel.appendChild(new Option(s, ["name","soon","date"][i])));
    fr.appendChild(sortSel); fr.appendChild(kkSel);
    m.appendChild(fr);

    const holder = el("div"); m.appendChild(holder);
    const draw = () => {
      holder.innerHTML = "";
      const q = inp.value.trim().toLowerCase();
      let list = allPeople();
      if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.mobile||"").includes(q) || (p.kkName||"").toLowerCase().includes(q));
      if (kkSel.value) list = list.filter(p => p.kkName === kkSel.value);
      if (sortSel.value === "soon") list.sort((a,b)=>daysUntil(a)-daysUntil(b));
      else if (sortSel.value === "date") list.sort((a,b)=>a.bmonth-b.bmonth || a.bday-b.bday);
      else list.sort((a,b)=>a.name.localeCompare(b.name));
      holder.appendChild(el("div","section-title",`${list.length} contact${list.length!==1?"s":""}`));
      if (!list.length) { holder.appendChild(emptyState("🔍","No matches.")); return; }
      list.slice(0, 300).forEach(p => holder.appendChild(personCard(p, { countdown: daysUntil(p), showToday: isToday(p) })));
      if (list.length > 300) holder.appendChild(el("p","muted small",`Showing first 300 of ${list.length}. Refine your search.`));
    };
    inp.oninput = debounce(draw, 150); kkSel.onchange = draw; sortSel.onchange = draw;
    draw();
  }

  function viewAdd(m) {
    m.appendChild(el("div","section-title","Add a birthday"));
    const f = el("div","card");
    f.innerHTML = `
      <label class="field"><span>Full name *</span><input id="aName" placeholder="e.g. Dinesh N Pandey"></label>
      <label class="field"><span>Mobile number</span><input id="aMobile" inputmode="numeric" placeholder="10-digit mobile"></label>
      <div class="form-grid">
        <label class="field"><span>Birth month *</span><select id="aMonth"></select></label>
        <label class="field"><span>Birth day *</span><select id="aDay"></select></label>
      </div>
      <label class="field"><span>Birth year (optional)</span><input id="aYear" inputmode="numeric" placeholder="e.g. 1980"></label>
      <label class="field"><span>Email (optional)</span><input id="aEmail" type="email" placeholder="name@example.com"></label>
      <label class="field"><span>Karyakarta / note (optional)</span><input id="aNote" placeholder="e.g. Adajan mandal"></label>
      <button class="btn primary" id="aSave" style="width:100%">Save birthday</button>`;
    m.appendChild(f);
    const mo = f.querySelector("#aMonth"), da = f.querySelector("#aDay");
    MONTHS.forEach((mn,i)=>mo.appendChild(new Option(mn, i+1)));
    for (let i=1;i<=31;i++) da.appendChild(new Option(i, i));
    f.querySelector("#aSave").onclick = () => {
      const name = f.querySelector("#aName").value.trim();
      if (!name) { toast("Name is required"); return; }
      const rec = {
        id: "c" + Date.now(),
        name,
        mobile: f.querySelector("#aMobile").value.replace(/\D/g,""),
        bmonth: +mo.value, bday: +da.value,
        byear: +f.querySelector("#aYear").value || null,
        email: f.querySelector("#aEmail").value.trim(),
        kkName: f.querySelector("#aNote").value.trim(),
        mandal: "", remark: "", address: ""
      };
      const custom = load(LS.custom, []); custom.push(rec); save(LS.custom, custom);
      toast("Birthday added ✔");
      currentView = "all"; setActiveTab(); render();
    };

    // list of custom entries to manage
    const custom = load(LS.custom, []);
    if (custom.length) {
      m.appendChild(el("div","section-title",`Your added contacts <span class="pill">${custom.length}</span>`));
      custom.forEach(p => m.appendChild(personCard(p)));
    }
  }

  /* ---------- message generator ---------- */
  function messageGenerator(todayList) {
    const box = el("div", "msg-box");
    box.appendChild(el("h3", null, "📣 Broadcast message"));

    // include checkboxes
    const incl = el("div", "incl-list");
    const state = new Map(todayList.map(p => [p.id, true]));
    todayList.forEach(p => {
      const row = el("label", "incl-row");
      const cb = el("input"); cb.type = "checkbox"; cb.checked = true;
      cb.onchange = () => { state.set(p.id, cb.checked); update(); };
      row.appendChild(cb);
      row.appendChild(el("span", null, `${esc(p.name)}${p.mobile ? " – " + p.mobile : ""}`));
      incl.appendChild(row);
    });
    if (todayList.length > 1) box.appendChild(incl);

    // template chips
    const chips = el("div", "chips");
    const styles = [["rakesh","Rakesh Kaka"],["gujarati","ગુજરાતી"],["english","English"],["list","List only"]];
    let style = settings.template;
    styles.forEach(([v,label]) => {
      const c = el("button", "chip" + (v===style?" active":""), label);
      c.onclick = () => { style = v; [...chips.children].forEach(x=>x.classList.remove("active")); c.classList.add("active"); update(); };
      chips.appendChild(c);
    });
    box.appendChild(chips);

    const ta = el("textarea");
    box.appendChild(ta);

    const acts = el("div", "msg-actions");
    const copyBtn = el("button", "btn primary", "📋 Copy");
    copyBtn.onclick = () => copyText(ta.value);
    const waBtn = el("button", "btn wa", "💬 WhatsApp");
    waBtn.onclick = () => { copyText(ta.value);
      window.open(`https://wa.me/?text=${encodeURIComponent(ta.value)}`, "_blank"); };
    const shareBtn = el("button", "btn ghost", "🔗 Share");
    shareBtn.onclick = () => {
      if (navigator.share) navigator.share({ text: ta.value }).catch(()=>{});
      else copyText(ta.value);
    };
    acts.appendChild(copyBtn); acts.appendChild(waBtn); acts.appendChild(shareBtn);
    box.appendChild(acts);

    function update() {
      const chosen = todayList.filter(p => state.get(p.id));
      ta.value = buildMessage(style, chosen.length ? chosen : todayList);
    }
    update();
    return box;
  }

  /* ---------- person modal ---------- */
  function openPerson(p) {
    const modal = $("#personModal");
    const age = ageTurning(p);
    const rows = [
      ["Birthday", `${p.bday} ${MONTHS[p.bmonth-1]}${p.byear ? " " + p.byear : ""}`],
      age != null ? ["Age", isToday(p) ? `Turns ${age} today 🎉` : `Turns ${age} in ${daysUntil(p)} day(s)`] : null,
      p.mobile ? ["Mobile", p.mobile] : null,
      p.email ? ["Email", p.email] : null,
      p.kkName ? ["Karyakarta", p.kkName + (p.kkMobile ? " ("+p.kkMobile+")" : "")] : null,
      p.mandal ? ["Mandal", p.mandal] : null,
      p.gender ? ["Gender", p.gender] : null,
      p.remark ? ["Remark", p.remark] : null,
      p.address ? ["Address", p.address] : null,
    ].filter(Boolean);
    modal.innerHTML = `
      <div class="modal-head">
        <div class="avatar">${initials(p.name)}</div>
        <div style="flex:1"><h2>${esc(p.name)}</h2>
          <div class="muted small">${isToday(p) ? "🎂 Birthday today!" : "Next birthday in " + daysUntil(p) + " day(s)"}</div></div>
        <button class="icon-btn" id="closeModal" style="background:var(--line);color:var(--text)">✕</button>
      </div>`;
    rows.forEach(([k,v]) => {
      const r = el("div","detail-row");
      r.innerHTML = `<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>`;
      modal.appendChild(r);
    });
    modal.appendChild(actionButtons(p));
    // personal wish quick copy
    const extra = el("div","msg-actions");
    const pw = el("button","btn ghost","📋 Copy personal wish");
    pw.onclick = () => copyText(personalWish(p));
    extra.appendChild(pw);
    if (p.mobile) {
      const copyNum = el("button","btn ghost","📞 Copy number");
      copyNum.onclick = () => copyText(p.mobile);
      extra.appendChild(copyNum);
    }
    modal.appendChild(extra);
    // delete for custom / edited
    const del = el("div","msg-actions");
    const delBtn = el("button","btn danger ghost", p._src === "custom" ? "🗑 Delete contact" : "🙈 Hide from list");
    delBtn.onclick = () => {
      if (!confirm("Remove " + p.name + " from the app?")) return;
      if (p._src === "custom") { save(LS.custom, load(LS.custom,[]).filter(x=>x.id!==p.id)); }
      else { const dd = load(LS.deleted,[]); dd.push(p.id); save(LS.deleted, dd); }
      closeModal(); toast("Removed"); render();
    };
    del.appendChild(delBtn);
    modal.appendChild(del);
    modal.querySelector("#closeModal").onclick = closeModal;
    $("#modalBackdrop").hidden = false;
  }
  function closeModal() { $("#modalBackdrop").hidden = true; }

  /* ---------- settings ---------- */
  function openSettings() {
    $("#setLeader").value = settings.leader;
    $("#setCC").value = settings.cc;
    $("#setTemplate").value = settings.template;
    $("#setNotify").checked = !!settings.notify;
    $("#settingsDrawer").hidden = false; $("#drawerBackdrop").hidden = false;
  }
  function closeSettings() {
    settings.leader = $("#setLeader").value.trim() || "Rakesh Kaka";
    settings.cc = $("#setCC").value.replace(/\D/g,"") || "91";
    settings.template = $("#setTemplate").value;
    settings.notify = $("#setNotify").checked;
    save(LS.settings, settings);
    $("#settingsDrawer").hidden = true; $("#drawerBackdrop").hidden = true;
    render();
  }

  /* ---------- notifications ---------- */
  function maybeNotify() {
    if (!settings.notify) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const list = allPeople().filter(isToday);
    if (!list.length) return;
    const names = list.map(p=>p.name.split(/\s+/)[0]).join(", ");
    try { new Notification(`🎂 ${list.length} birthday${list.length>1?"s":""} today`, { body: names, icon: "icons/icon-192.png" }); } catch {}
  }

  /* ---------- misc ---------- */
  function debounce(fn, ms) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  function setActiveTab() {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === currentView));
  }

  /* ---------- init ---------- */
  function init() {
    $("#todayDate").textContent = `${DOW[today.getDay()]}, ${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
    $("#versionLine").textContent = "Version " + VERSION + " • " + (window.BIRTHDAY_DATA||[]).length + " contacts in master list";

    document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
      currentView = t.dataset.view; setActiveTab(); render();
    });
    $("#settingsBtn").onclick = openSettings;
    $("#closeSettings").onclick = closeSettings;
    $("#drawerBackdrop").onclick = closeSettings;
    $("#modalBackdrop").onclick = e => { if (e.target.id === "modalBackdrop") closeModal(); };
    $("#resetCustom").onclick = () => {
      if (!confirm("Clear all contacts you added or hid? Master list stays intact.")) return;
      localStorage.removeItem(LS.custom); localStorage.removeItem(LS.deleted); localStorage.removeItem(LS.edits);
      toast("Cleared"); render();
    };
    $("#enableNotifBtn").onclick = () => {
      if (!("Notification" in window)) { toast("Not supported on this device"); return; }
      Notification.requestPermission().then(p => { toast(p === "granted" ? "Notifications on ✔" : "Not allowed"); if (p==="granted") maybeNotify(); });
    };

    // install prompt
    let deferred;
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("#installBtn").hidden = false; });
    $("#installBtn").onclick = async () => {
      if (!deferred) { toast("Use browser menu → Add to Home screen"); return; }
      deferred.prompt(); await deferred.userChoice; deferred = null; $("#installBtn").hidden = true;
    };
    window.addEventListener("appinstalled", () => { $("#installBtn").hidden = true; toast("Installed ✔"); });

    render();
    setTimeout(maybeNotify, 800);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
