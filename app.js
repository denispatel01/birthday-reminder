/* Birthday Reminder — app logic */
(function () {
  "use strict";
  const LS = {
    custom: "br_custom_v1",      // added contacts
    edits: "br_edits_v1",        // edits to base contacts {id:{...}}
    deleted: "br_deleted_v1",    // hidden base ids
    settings: "br_settings_v1",
  };
  const VERSION = "1.8.3";
  const PASSCODE = "1708";
  const UNLOCK_KEY = "br_unlocked_v1";
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  /* ---------- storage ---------- */
  const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let settings = Object.assign({ leader: "Rakesh Bhai", cc: "91", template: "rakesh", notify: true }, load(LS.settings, {}));

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

  /* ---------- edit / flags ---------- */
  function updatePerson(p, changes) {
    if (p._src === "custom") {
      const custom = load(LS.custom, []);
      const i = custom.findIndex(x => x.id === p.id);
      if (i >= 0) { Object.assign(custom[i], changes); save(LS.custom, custom); }
    } else {
      const edits = load(LS.edits, {});
      edits[p.id] = Object.assign({}, edits[p.id] || {}, changes);
      save(LS.edits, edits);
    }
    Object.assign(p, changes); // reflect immediately on the in-memory object
  }
  function removePerson(p) {
    if (p._src === "custom") save(LS.custom, load(LS.custom, []).filter(x => x.id !== p.id));
    else { const d = load(LS.deleted, []); if (!d.includes(p.id)) d.push(p.id); save(LS.deleted, d); }
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
    const dateTag = el("button", "tag tag-date", "🎂 " + dOrd + " ✏️");
    dateTag.title = "Tap to correct birthday";
    dateTag.onclick = e => { e.stopPropagation(); openQuickDate(p); };
    meta.appendChild(dateTag);
    if (age != null) meta.appendChild(el("span", "tag", (opts.showToday ? "turns " : "") + age + " yrs"));
    if (p.priority === "high") meta.appendChild(el("span", "tag badge-prio", "⭐ Priority"));
    if (p.followup) meta.appendChild(el("span", "tag badge-follow", "🔎 Follow-up"));
    if (p.remark) meta.appendChild(el("span", "tag badge-remark", "📝 Note"));
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
       <div class="stat"><b>${w}</b><span>WEEK</span></div>
       <div class="stat"><b>${mth}</b><span>MONTH</span></div>
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
    const flagSel = el("select");
    flagSel.appendChild(new Option("Everyone", ""));
    flagSel.appendChild(new Option("⭐ Priority", "priority"));
    flagSel.appendChild(new Option("🔎 Follow-up", "followup"));
    fr.appendChild(flagSel); fr.appendChild(sortSel); fr.appendChild(kkSel);
    m.appendChild(fr);

    const holder = el("div"); m.appendChild(holder);
    const draw = () => {
      holder.innerHTML = "";
      const q = inp.value.trim().toLowerCase();
      let list = allPeople();
      if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.mobile||"").includes(q) || (p.kkName||"").toLowerCase().includes(q));
      if (kkSel.value) list = list.filter(p => p.kkName === kkSel.value);
      if (flagSel.value === "priority") list = list.filter(p => p.priority === "high");
      else if (flagSel.value === "followup") list = list.filter(p => p.followup);
      if (sortSel.value === "soon") list.sort((a,b)=>daysUntil(a)-daysUntil(b));
      else if (sortSel.value === "date") list.sort((a,b)=>a.bmonth-b.bmonth || a.bday-b.bday);
      else list.sort((a,b)=>a.name.localeCompare(b.name));
      holder.appendChild(el("div","section-title",`${list.length} contact${list.length!==1?"s":""}`));
      if (!list.length) { holder.appendChild(emptyState("🔍","No matches.")); return; }
      list.slice(0, 300).forEach(p => holder.appendChild(personCard(p, { countdown: daysUntil(p), showToday: isToday(p) })));
      if (list.length > 300) holder.appendChild(el("p","muted small",`Showing first 300 of ${list.length}. Refine your search.`));
    };
    inp.oninput = debounce(draw, 150); kkSel.onchange = draw; sortSel.onchange = draw; flagSel.onchange = draw;
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
      <label class="field"><span>Karyakarta name (optional)</span><input id="aNote" placeholder="e.g. Tejas Patel"></label>
      <label class="field"><span>Karyakarta mobile (optional)</span><input id="aKKm" inputmode="numeric" placeholder="for follow-up messages"></label>
      <label class="field"><span>📝 Remark (optional)</span><input id="aRemark" placeholder="your note about this devotee"></label>
      <div class="form-grid">
        <label class="field"><span>Priority</span><select id="aPrio"><option value="">Normal</option><option value="high">⭐ High priority</option></select></label>
        <label class="field switch-field" style="align-self:end;margin-top:4px"><span>🔎 Good devotee / follow-up</span><input type="checkbox" id="aFollow"></label>
      </div>
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
        kkMobile: f.querySelector("#aKKm").value.replace(/\D/g,""),
        priority: f.querySelector("#aPrio").value,
        followup: f.querySelector("#aFollow").checked,
        remark: f.querySelector("#aRemark").value.trim(),
        mandal: "", address: ""
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
      p.category ? ["Category", p.category] : null,
      p.gender ? ["Gender", p.gender] : null,
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
    if (p.remark) {
      const note = el("div", "remark-box");
      note.innerHTML = `<span class="remark-label">📝 Remark</span>${esc(p.remark)}`;
      modal.appendChild(note);
    }
    modal.appendChild(actionButtons(p));

    // quick flag toggles
    const flags = el("div", "flag-toggles");
    const prioBtn = el("button", "flag-btn" + (p.priority === "high" ? " on" : ""), (p.priority === "high" ? "⭐ Priority ✓" : "☆ Mark priority"));
    prioBtn.onclick = () => { updatePerson(p, { priority: p.priority === "high" ? "" : "high" }); openPerson(p); render(); };
    const followBtn = el("button", "flag-btn" + (p.followup ? " on" : ""), (p.followup ? "🔎 Follow-up ✓" : "👍 Good devotee / follow-up"));
    followBtn.onclick = () => { updatePerson(p, { followup: !p.followup }); openPerson(p); render(); };
    flags.appendChild(prioBtn); flags.appendChild(followBtn);
    modal.appendChild(flags);

    // ask karyakarta to follow up
    const fu = el("div", "msg-actions");
    const askBtn = el("button", "btn ghost", "📲 Ask karyakarta to follow up");
    askBtn.onclick = () => askKaryakarta(p);
    fu.appendChild(askBtn);
    modal.appendChild(fu);

    // personal wish + copy number
    const extra = el("div","msg-actions");
    const pw = el("button","btn ghost","📋 Copy wish");
    pw.onclick = () => copyText(personalWish(p));
    extra.appendChild(pw);
    if (p.mobile) {
      const copyNum = el("button","btn ghost","📞 Copy number");
      copyNum.onclick = () => copyText(p.mobile);
      extra.appendChild(copyNum);
    }
    modal.appendChild(extra);

    // edit + delete
    const ed = el("div","msg-actions");
    const editBtn = el("button","btn primary","✏️ Edit details");
    editBtn.onclick = () => openEditForm(p);
    ed.appendChild(editBtn);
    const delBtn = el("button","btn danger ghost", p._src === "custom" ? "🗑 Delete" : "🙈 Hide");
    delBtn.onclick = () => {
      if (!confirm("Remove " + p.name + " from the app?" + (p._src !== "custom" ? "\n(This hides the contact; you can restore from Settings.)" : ""))) return;
      removePerson(p);
      closeModal(); toast("Removed"); render();
    };
    ed.appendChild(delBtn);
    modal.appendChild(ed);
    modal.querySelector("#closeModal").onclick = closeModal;
    $("#modalBackdrop").hidden = false;
  }
  function closeModal() { $("#modalBackdrop").hidden = true; }

  /* ---------- edit form ---------- */
  function openEditForm(p) {
    const modal = $("#personModal");
    modal.innerHTML = `
      <div class="modal-head">
        <div class="avatar">${initials(p.name)}</div>
        <div style="flex:1"><h2>Edit details</h2><div class="muted small">${esc(p.name)}</div></div>
        <button class="icon-btn" id="closeModal" style="background:var(--line);color:var(--text)">✕</button>
      </div>
      <label class="field"><span>Full name *</span><input id="eName"></label>
      <label class="field"><span>Mobile number</span><input id="eMobile" inputmode="numeric"></label>
      <div class="form-grid">
        <label class="field"><span>Birth month</span><select id="eMonth"></select></label>
        <label class="field"><span>Birth day</span><select id="eDay"></select></label>
      </div>
      <label class="field"><span>Birth year (optional)</span><input id="eYear" inputmode="numeric"></label>
      <label class="field"><span>Email (optional)</span><input id="eEmail" type="email"></label>
      <label class="field"><span>Karyakarta name</span><input id="eKK"></label>
      <label class="field"><span>Karyakarta mobile</span><input id="eKKm" inputmode="numeric"></label>
      <label class="field"><span>Address</span><textarea id="eAddr" rows="2"></textarea></label>
      <label class="field"><span>📝 Remark (your note)</span><textarea id="eRemark" rows="2" placeholder="e.g. Interested, must visit / Wrong no / Shifted to..."></textarea></label>
      <div class="form-grid">
        <label class="field"><span>Priority</span><select id="ePrio"><option value="">Normal</option><option value="high">⭐ High priority</option></select></label>
        <label class="field switch-field" style="align-self:end;margin-top:4px"><span>🔎 Good devotee / follow-up</span><input type="checkbox" id="eFollow"></label>
      </div>
      <div class="msg-actions">
        <button class="btn primary" id="eSave">💾 Save changes</button>
        <button class="btn ghost" id="eCancel">Cancel</button>
      </div>`;
    const mo = modal.querySelector("#eMonth"), da = modal.querySelector("#eDay");
    MONTHS.forEach((mn,i)=>mo.appendChild(new Option(mn, i+1)));
    for (let i=1;i<=31;i++) da.appendChild(new Option(i, i));
    modal.querySelector("#eName").value = p.name || "";
    modal.querySelector("#eMobile").value = p.mobile || "";
    mo.value = p.bmonth || 1; da.value = p.bday || 1;
    modal.querySelector("#eYear").value = p.byear || "";
    modal.querySelector("#eEmail").value = p.email || "";
    modal.querySelector("#eKK").value = p.kkName || "";
    modal.querySelector("#eKKm").value = p.kkMobile || "";
    modal.querySelector("#eAddr").value = p.address || "";
    modal.querySelector("#eRemark").value = p.remark || "";
    modal.querySelector("#ePrio").value = p.priority === "high" ? "high" : "";
    modal.querySelector("#eFollow").checked = !!p.followup;
    modal.querySelector("#closeModal").onclick = closeModal;
    modal.querySelector("#eCancel").onclick = () => openPerson(p);
    modal.querySelector("#eSave").onclick = () => {
      const name = modal.querySelector("#eName").value.trim();
      if (!name) { toast("Name is required"); return; }
      updatePerson(p, {
        name,
        mobile: modal.querySelector("#eMobile").value.replace(/\D/g,""),
        bmonth: +mo.value, bday: +da.value,
        byear: +modal.querySelector("#eYear").value || null,
        email: modal.querySelector("#eEmail").value.trim(),
        kkName: modal.querySelector("#eKK").value.trim(),
        kkMobile: modal.querySelector("#eKKm").value.replace(/\D/g,""),
        address: modal.querySelector("#eAddr").value.trim(),
        remark: modal.querySelector("#eRemark").value.trim(),
        priority: modal.querySelector("#ePrio").value,
        followup: modal.querySelector("#eFollow").checked
      });
      toast("Saved ✔"); render(); openPerson(p);
    };
    $("#modalBackdrop").hidden = false;
  }

  /* ---------- quick birthday correction (one tap from card) ---------- */
  function openQuickDate(p) {
    const modal = $("#personModal");
    modal.innerHTML = `
      <div class="modal-head">
        <div class="avatar">${initials(p.name)}</div>
        <div style="flex:1"><h2>Correct birthday</h2><div class="muted small">${esc(p.name)}</div></div>
        <button class="icon-btn" id="closeModal" style="background:var(--line);color:var(--text)">✕</button>
      </div>
      <p class="muted small" style="margin:-4px 0 12px">Currently: <b>${p.bday ? p.bday + " " + MONTHS[p.bmonth-1] + (p.byear ? " " + p.byear : "") : "not set"}</b></p>
      <div class="form-grid">
        <label class="field"><span>Month</span><select id="qMonth"></select></label>
        <label class="field"><span>Day</span><select id="qDay"></select></label>
      </div>
      <label class="field"><span>Year (optional)</span><input id="qYear" inputmode="numeric" placeholder="e.g. 1990"></label>
      <div class="msg-actions">
        <button class="btn primary" id="qSave">💾 Save birthday</button>
        <button class="btn ghost" id="qCancel">Cancel</button>
      </div>`;
    const mo = modal.querySelector("#qMonth"), da = modal.querySelector("#qDay");
    MONTHS.forEach((mn,i)=>mo.appendChild(new Option(mn, i+1)));
    for (let i=1;i<=31;i++) da.appendChild(new Option(i, i));
    mo.value = p.bmonth || 1; da.value = p.bday || 1;
    modal.querySelector("#qYear").value = p.byear || "";
    modal.querySelector("#closeModal").onclick = closeModal;
    modal.querySelector("#qCancel").onclick = closeModal;
    modal.querySelector("#qSave").onclick = () => {
      updatePerson(p, { bmonth: +mo.value, bday: +da.value, byear: +modal.querySelector("#qYear").value || null });
      toast("Birthday updated ✔"); closeModal(); render();
    };
    $("#modalBackdrop").hidden = false;
  }

  /* ---------- ask karyakarta to follow up ---------- */
  function askKaryakarta(p) {
    // Open WhatsApp with the message ready; Rakesh Bhai picks the karyakarta from his contacts — no typing a number.
    const bday = p.bday ? `\nBirthday: ${p.bday} ${MONTHS[p.bmonth-1]}` : "";
    const msg = `Jai Swaminarayan 🙏\n\nKindly do follow-up with P. B. ${p.name}${p.mobile ? " (" + p.mobile + ")" : ""}.${bday}${p.address ? "\nAddress: " + p.address : ""}\n\nThank you 🙏`;
    toast("Pick the karyakarta in WhatsApp");
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  /* ---------- settings ---------- */
  function openSettings() {
    $("#setLeader").value = settings.leader;
    $("#setCC").value = settings.cc;
    $("#setTemplate").value = settings.template;
    $("#setNotify").checked = !!settings.notify;
    $("#settingsDrawer").hidden = false; $("#drawerBackdrop").hidden = false;
  }
  function closeSettings() {
    settings.leader = $("#setLeader").value.trim() || "Rakesh Bhai";
    settings.cc = $("#setCC").value.replace(/\D/g,"") || "91";
    settings.template = $("#setTemplate").value;
    settings.notify = $("#setNotify").checked;
    save(LS.settings, settings);
    $("#settingsDrawer").hidden = true; $("#drawerBackdrop").hidden = true;
    render();
  }

  /* ---------- share / invite ---------- */
  function installMessage() {
    const url = location.origin + location.pathname;
    const leader = settings.leader || "Rakesh Bhai";
    return `Jai Swaminarayan ${leader} 🙏\n\n`
      + `I have made a *Birthday Reminder* app for you 🎂\n`
      + `It shows today's, this week's and this month's birthdays, and lets you wish every devotee by WhatsApp, call, SMS or email in one tap — plus a ready birthday message to copy.\n\n`
      + `🔗 Open: ${url}\n`
      + `🔑 Passcode: ${PASSCODE} (asked only once)\n\n`
      + `📲 To keep it like an app on your iPhone:\n`
      + `1. *Important:* open this link in *Safari* (if it opens inside WhatsApp, tap ••• at top-right → Open in Safari / Browser)\n`
      + `2. In Safari, tap the *Share* button (square with ↑ at the bottom)\n`
      + `3. Scroll down and tap *Add to Home Screen*\n`
      + `4. Tap *Add* — now open it from your home screen anytime\n\n`
      + `(On Android: open the link in Chrome → menu ⋮ → *Add to Home screen*.)\n\n`
      + `Jai Swaminarayan 🙏`;
  }

  /* ---------- install help (manual steps) ---------- */
  function showInstallHelp() {
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const inApp = /FBAN|FBAV|Instagram|Line|WhatsApp|WebView|; wv\)/i.test(ua);
    let steps;
    if (inApp) {
      steps = `<li>This page is open <b>inside another app</b>. First tap the <b>•••</b> or <b>Share</b> menu (top of the screen) → <b>Open in Safari</b> (iPhone) or <b>Open in Chrome</b> (Android).</li>
               <li>Then use the browser's menu to add it to your home screen (see below).</li>`;
    } else if (isIOS) {
      steps = `<li>Make sure you are in <b>Safari</b>.</li>
               <li>Tap the <b>Share</b> button — the square with an ↑ arrow, at the bottom of Safari.</li>
               <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
               <li>Tap <b>Add</b> (top-right). The app icon appears on your home screen. 🎉</li>`;
    } else {
      steps = `<li>Tap the browser menu — the <b>⋮</b> (three dots), usually top-right.</li>
               <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
               <li>Tap <b>Install / Add</b>. The app icon appears on your home screen. 🎉</li>`;
    }
    const modal = $("#personModal");
    modal.innerHTML = `
      <div class="modal-head">
        <div class="avatar">📲</div>
        <div style="flex:1"><h2>Install this app</h2><div class="muted small">Keep it on your home screen like a normal app</div></div>
        <button class="icon-btn" id="closeModal" style="background:var(--line);color:var(--text)">✕</button>
      </div>
      <ol class="install-steps">${steps}</ol>
      <p class="muted small">Once added, open it from your home screen anytime — the passcode is asked only once.</p>
      <div class="msg-actions"><button class="btn primary" id="okInstall">Got it 🙏</button></div>`;
    modal.querySelector("#closeModal").onclick = closeModal;
    modal.querySelector("#okInstall").onclick = closeModal;
    $("#modalBackdrop").hidden = false;
  }

  /* ---------- iOS install hint ---------- */
  function showIosInstallHint() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    if (!isIOS || standalone) return;
    if (load("br_ios_hint_dismissed", false)) return;
    // in-app browsers (WhatsApp/Instagram/etc.) can't Add to Home Screen — tell them to open in Safari
    const inApp = /FBAN|FBAV|Instagram|Line|WhatsApp|WebView|; wv\)/i.test(navigator.userAgent);
    const tip = el("div", "ios-tip");
    tip.innerHTML =
      `<button class="ios-tip-x" aria-label="Close">✕</button>
       <b>📲 Add to your Home Screen</b>
       ${inApp
         ? `<span>This is open inside another app. First tap the <b>•••</b> (or Share) menu → <b>Open in Safari</b>, then follow the steps below.</span>`
         : `<span>In <b>Safari</b>: tap the <b>Share</b> button (the square with ↑ at the bottom), scroll down, then tap <b>Add to Home Screen</b>.</span>`}`;
    tip.querySelector(".ios-tip-x").onclick = () => { save("br_ios_hint_dismissed", true); tip.remove(); };
    document.body.insertBefore(tip, $("#tabs"));
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

  /* ---------- welcome greeting ---------- */
  function showWelcome() {
    const w = $("#welcome"); if (!w) return;
    const h = today.getHours ? new Date().getHours() : 12;
    const partOfDay = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const leader = settings.leader || "Rakesh Kaka";
    $("#welcomeHi").innerHTML = `Jai Swaminarayan,<br>${esc(leader)} 🙏`;
    $("#welcomeTime").textContent = `${partOfDay} • ${DOW[today.getDay()]}, ${today.getDate()} ${MONTHS[today.getMonth()]}`;

    const ppl = allPeople();
    const todayCount = ppl.filter(isToday).length;
    const weekCount = ppl.filter(p => { const d = daysUntil(p); return d >= 0 && d <= 7; }).length;
    let countHtml;
    if (todayCount > 0) {
      countHtml = `<div class="count">🎂 <b>${todayCount}</b> ${todayCount === 1 ? "devotee has" : "devotees have"} a birthday <b>today</b>.<br>Let's make ${todayCount === 1 ? "them" : "them all"} feel special! 🎉</div>`;
    } else if (weekCount > 0) {
      countHtml = `<div class="count">No birthdays today 🙂<br><b>${weekCount}</b> coming up in the next 7 days.</div>`;
    } else {
      countHtml = `<div class="count">No birthdays in the coming week.<br>Have a blessed day! 🙏</div>`;
    }
    $("#welcomeMsg").innerHTML =
      `This app is made with love, just for you — to help you wish every devotee a very happy birthday on their special day. 🎂${countHtml}`;

    w.hidden = false;
    $("#welcomeBtn").onclick = () => { w.hidden = true; };
  }

  /* ---------- misc ---------- */
  function debounce(fn, ms) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  function setActiveTab() {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === currentView));
  }

  /* ---------- passcode gate ---------- */
  function gate() {
    const unlocked = (() => { try { return localStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; } })();
    if (unlocked) { startApp(); return; }
    const lock = $("#lockScreen"), inp = $("#lockInput"), err = $("#lockError"), btn = $("#lockBtn");
    lock.hidden = false;
    setTimeout(() => inp.focus(), 100);
    const tryUnlock = () => {
      if (inp.value.trim() === PASSCODE) {
        try { localStorage.setItem(UNLOCK_KEY, "1"); } catch {}
        lock.hidden = true;
        startApp();
      } else {
        err.hidden = false; inp.value = ""; inp.focus();
      }
    };
    btn.onclick = tryUnlock;
    inp.addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });
    inp.addEventListener("input", () => {
      err.hidden = true;
      // Auto-unlock as soon as the full correct passcode is entered (no button tap needed)
      if (inp.value.trim() === PASSCODE) tryUnlock();
    });
  }

  /* ---------- init ---------- */
  function startApp() {
    $("#todayDate").textContent = `${DOW[today.getDay()].slice(0,3)}, ${today.getDate()} ${MONTHS[today.getMonth()].slice(0,3)} ${today.getFullYear()}`;
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
    $("#shareAppBtn").onclick = () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(installMessage())}`, "_blank");
    };
    $("#copyInviteBtn").onclick = () => copyText(installMessage());
    $("#enableNotifBtn").onclick = () => {
      if (!("Notification" in window)) { toast("Not supported on this device"); return; }
      Notification.requestPermission().then(p => { toast(p === "granted" ? "Notifications on ✔" : "Not allowed"); if (p==="granted") maybeNotify(); });
    };

    // install prompt
    let deferred;
    const standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    // Show the Install button everywhere (desktop + mobile) unless already installed.
    $("#installBtn").hidden = standalone;
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("#installBtn").hidden = false; });
    $("#installBtn").onclick = async () => {
      if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $("#installBtn").hidden = true; return; }
      showInstallHelp();   // iOS / browsers without the install API → show steps
    };
    window.addEventListener("appinstalled", () => { $("#installBtn").hidden = true; toast("Installed ✔"); });

    render();
    showWelcome();
    showIosInstallHint();
    setTimeout(maybeNotify, 800);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  }
  document.addEventListener("DOMContentLoaded", gate);
})();
