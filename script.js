// ================= CONFIG =================
const STORAGE_KEY = "crew-interview-slots";
const MEMBERS_KEY = "crew-interview-members";
const ADMIN_PASS = "crew2026"; // change this to your own passcode
const SUPABASE_URL = "https://hyaobkidijsxpofaxszf.supabase.co";
const SUPABASE_KEY = "sb_publishable_piTNNGu_Rva3iObyHfsx0Q_Nn9sezZX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let backendReady = false;
let slotsCache = readLocal(STORAGE_KEY, []);
let membersCache = readLocal(MEMBERS_KEY, []);

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ================= STORAGE HELPERS =================
function loadSlots() {
  return slotsCache;
}

function saveSlots(slots) {
  slotsCache = slots;
  writeLocal(STORAGE_KEY, slots);
  if (backendReady) syncSlots(slots);
}

function loadMembers() {
  return membersCache;
}

function saveMembers(members) {
  membersCache = members;
  writeLocal(MEMBERS_KEY, members);
  if (backendReady) syncMembers(members);
}

async function syncSlots(slots) {
  const { data: remoteSlots } = await supabaseClient.from("interview_slots").select("id");
  const currentIds = new Set(slots.map((slot) => slot.id));
  const removedIds = (remoteSlots || []).map((row) => row.id).filter((id) => !currentIds.has(id));
  if (removedIds.length) await supabaseClient.from("interview_slots").delete().in("id", removedIds);

  const rows = slots.map((slot) => ({
    id: slot.id,
    date: slot.date,
    time: slot.time,
    duration: slot.duration || 20,
    interviewers: slot.interviewers || [],
    bookings: slot.bookings || [],
  }));
  const { error } = await supabaseClient.from("interview_slots").upsert(rows);
  if (error) console.error("Could not sync slots:", error.message);
}

async function syncMembers(members) {
  const { data: remoteMembers, error } = await supabaseClient.from("interview_members").select("name");
  if (error) {
    console.error("Could not sync members:", error.message);
    return;
  }

  const removed = remoteMembers.filter((row) => !members.includes(row.name)).map((row) => row.name);
  if (removed.length) await supabaseClient.from("interview_members").delete().in("name", removed);
  if (members.length) await supabaseClient.from("interview_members").upsert(members.map((name) => ({ name })));
}

async function bootstrapBackend() {
  const [{ data: remoteSlots, error: slotsError }, { data: remoteMembers, error: membersError }] = await Promise.all([
    supabaseClient.from("interview_slots").select("*").order("date").order("time"),
    supabaseClient.from("interview_members").select("name").order("name"),
  ]);

  if (slotsError || membersError) {
    console.error("Supabase is not ready. Run supabase-schema.sql first.", slotsError?.message || membersError?.message);
    return;
  }

  backendReady = true;
  if (remoteSlots.length === 0 && slotsCache.length) await syncSlots(slotsCache);
  else {
    slotsCache = remoteSlots;
    writeLocal(STORAGE_KEY, slotsCache);
  }

  if (remoteMembers.length === 0 && membersCache.length) await syncMembers(membersCache);
  else {
    membersCache = remoteMembers.map((row) => row.name);
    writeLocal(MEMBERS_KEY, membersCache);
  }
  renderBookingView();
  if (isAdminAuthed) renderAdminDashboard();
}

async function refreshSharedData() {
  if (!backendReady) return;

  const [{ data: remoteSlots, error: slotsError }, { data: remoteMembers, error: membersError }] = await Promise.all([
    supabaseClient.from("interview_slots").select("*").order("date").order("time"),
    supabaseClient.from("interview_members").select("name").order("name"),
  ]);

  if (slotsError || membersError) return;
  slotsCache = remoteSlots;
  membersCache = remoteMembers.map((row) => row.name);
  writeLocal(STORAGE_KEY, slotsCache);
  writeLocal(MEMBERS_KEY, membersCache);
  renderBookingView();
  if (isAdminAuthed) renderAdminDashboard();
}

let idleRefreshTimer;

function resetIdleRefreshTimer() {
  window.clearTimeout(idleRefreshTimer);
  idleRefreshTimer = window.setTimeout(async () => {
    await refreshSharedData();
    resetIdleRefreshTimer();
  }, 10000);
}

["pointerdown", "keydown", "touchstart", "scroll"].forEach((eventName) => {
  window.addEventListener(eventName, resetIdleRefreshTimer, { passive: true });
});

function subscribeToChanges() {
  supabaseClient
    .channel("crew-interview-live-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "interview_slots" }, async () => {
      const { data } = await supabaseClient.from("interview_slots").select("*").order("date").order("time");
      if (data) {
        slotsCache = data;
        writeLocal(STORAGE_KEY, slotsCache);
        renderBookingView();
        if (isAdminAuthed) renderAdminDashboard();
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "interview_members" }, async () => {
      const { data } = await supabaseClient.from("interview_members").select("name").order("name");
      if (data) {
        membersCache = data.map((row) => row.name);
        writeLocal(MEMBERS_KEY, membersCache);
        if (isAdminAuthed) renderAdminDashboard();
      }
    })
    .subscribe();
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDateHeading(dateStr) {
  return new Date(dateStr + "T00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ================= TAB SWITCHING =================
const tabBook = document.getElementById("tab-book");
const tabAdmin = document.getElementById("tab-admin");
const viewBook = document.getElementById("view-book");
const viewAdmin = document.getElementById("view-admin");

tabBook.addEventListener("click", () => {
  tabBook.classList.add("active");
  tabAdmin.classList.remove("active");
  viewBook.classList.remove("hidden");
  viewAdmin.classList.add("hidden");
  renderBookingView();
});

tabAdmin.addEventListener("click", () => {
  tabAdmin.classList.add("active");
  tabBook.classList.remove("active");
  viewAdmin.classList.remove("hidden");
  viewBook.classList.add("hidden");
  renderAdminView();
});

// ================= ADMIN GATE =================
const adminGate = document.getElementById("admin-gate");
const adminContent = document.getElementById("admin-content");
const adminPassInput = document.getElementById("admin-pass");
const adminEnterBtn = document.getElementById("admin-enter");
const adminGateError = document.getElementById("admin-gate-error");

let isAdminAuthed = false;

function tryAdminLogin() {
  if (adminPassInput.value === ADMIN_PASS) {
    isAdminAuthed = true;
    adminGate.classList.add("hidden");
    adminContent.classList.remove("hidden");
    renderAdminDashboard();
  } else {
    adminGateError.classList.remove("hidden");
  }
}

adminEnterBtn.addEventListener("click", tryAdminLogin);
adminPassInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryAdminLogin();
});

function renderAdminView() {
  if (isAdminAuthed) {
    adminGate.classList.add("hidden");
    adminContent.classList.remove("hidden");
    renderAdminDashboard();
  } else {
    adminGate.classList.remove("hidden");
    adminContent.classList.add("hidden");
  }
}

// ================= ADMIN SCHEDULING =================
let selectedAdminDate = new Date().toISOString().slice(0, 10);
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function renderAdminDashboard() {
  renderCalendar();
  renderMembers();
  renderAdminSlots();
}

function renderCalendar() {
  const monthLabel = document.getElementById("calendar-month");
  const grid = document.getElementById("calendar-grid");
  const selectedLabel = document.getElementById("selected-date-label");
  const slots = loadSlots();
  const slotDates = new Set(slots.map((slot) => slot.date));
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  monthLabel.textContent = calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  grid.innerHTML = "";

  for (let index = 0; index < firstDay; index += 1) {
    const spacer = document.createElement("span");
    spacer.className = "calendar-day empty";
    grid.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(year, month, day);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = day;
    button.setAttribute("aria-label", fmtDateHeading(key));
    if (key === selectedAdminDate) button.classList.add("selected");
    if (slotDates.has(key)) button.classList.add("has-slots");
    button.addEventListener("click", () => {
      selectedAdminDate = key;
      renderAdminDashboard();
    });
    grid.appendChild(button);
  }

  selectedLabel.textContent = `Selected: ${fmtDateHeading(selectedAdminDate)}`;
  document.getElementById("availability-title").textContent = fmtDateHeading(selectedAdminDate);
}

function renderMembers() {
  const members = loadMembers();
  const memberList = document.getElementById("member-list");
  const availabilityMembers = document.getElementById("availability-members");
  memberList.innerHTML = "";
  availabilityMembers.innerHTML = "";

  if (members.length === 0) {
    memberList.innerHTML = '<p class="hint">No members yet. Add your interview team above.</p>';
    availabilityMembers.innerHTML = '<p class="hint">Add members to choose who is free.</p>';
    return;
  }

  members.forEach((member) => {
    const memberRow = document.createElement("div");
    memberRow.className = "member-row";
    memberRow.innerHTML = `<span>${escapeHtml(member)}</span><button class="btn-link" type="button" data-remove-member="${escapeHtml(member)}">Remove</button>`;
    memberList.appendChild(memberRow);

    const label = document.createElement("label");
    label.className = "member-option";
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(member)}" checked /><span>${escapeHtml(member)}</span>`;
    availabilityMembers.appendChild(label);
  });

  memberList.querySelectorAll("[data-remove-member]").forEach((button) => {
    button.addEventListener("click", () => {
      const member = button.getAttribute("data-remove-member");
      saveMembers(loadMembers().filter((name) => name !== member));
      renderMembers();
    });
  });
}

document.getElementById("add-member").addEventListener("click", () => {
  const input = document.getElementById("member-name");
  const name = input.value.trim();
  if (!name) return;

  const members = loadMembers();
  if (!members.some((member) => member.toLowerCase() === name.toLowerCase())) {
    members.push(name);
    saveMembers(members);
  }
  input.value = "";
  renderMembers();
});

document.getElementById("member-name").addEventListener("keydown", (event) => {
  if (event.key === "Enter") document.getElementById("add-member").click();
});

document.getElementById("calendar-prev").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById("calendar-next").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});

function updateAvailabilityEnd() {
  const start = document.getElementById("availability-start").value;
  const duration = Number(document.getElementById("slot-duration").value);
  const end = minutesToTime(timeToMinutes(start) + duration);
  document.getElementById("availability-end").value = end;
  document.getElementById("availability-preview").textContent = `Interview ends at ${fmtClock(end)}.`;
}

function updateAvailabilityPreview() {
  const start = document.getElementById("availability-start").value;
  const duration = Number(document.getElementById("slot-duration").value);
  const preview = document.getElementById("availability-preview");
  if (!start || !preview) return;

  const end = minutesToTime(timeToMinutes(start) + duration);
  document.getElementById("availability-end").value = end;
  preview.textContent = `First interview ends at ${fmtClock(end)}.`;
}

function fmtClock(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

document.getElementById("availability-start").addEventListener("input", updateAvailabilityPreview);
document.getElementById("slot-duration").addEventListener("change", updateAvailabilityPreview);

document.getElementById("add-availability").addEventListener("click", () => {
  const start = document.getElementById("availability-start").value;
  const end = document.getElementById("availability-window-end").value;
  const duration = Number(document.getElementById("slot-duration").value);
  const members = [...document.querySelectorAll("#availability-members input:checked")].map((input) => input.value);
  const status = document.getElementById("admin-form-status");

  if (!start || !end || start >= end) {
    setStatus(status, "Choose a valid start and end time.", "error");
    return;
  }
  if (`${selectedAdminDate}T${start}` <= currentTimeKey()) {
    setStatus(status, "Past times cannot be opened.", "error");
    return;
  }
  if (members.length === 0) {
    setStatus(status, "Choose at least one available member.", "error");
    return;
  }

  const slots = loadSlots();
  let created = 0;
  let cursorMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  while (cursorMinutes + duration <= endMinutes) {
    const time = minutesToTime(cursorMinutes);
    const existing = slots.find((slot) => slot.date === selectedAdminDate && slot.time === time);
    if (existing) {
      existing.duration = duration;
      existing.interviewers = [...new Set([...existing.interviewers, ...members])];
    } else {
      slots.push({ id: uid(), date: selectedAdminDate, time, duration, interviewers: [...members], bookings: [] });
      created += 1;
    }
    cursorMinutes += duration;
  }

  if (created === 0) {
    setStatus(status, "Those times already exist and were updated.", "success");
  } else {
    setStatus(status, `${created} open time${created === 1 ? "" : "s"} added.`, "success");
  }
  slots.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
  saveSlots(slots);
  renderAdminDashboard();
});

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

// ================= RENDER: ADMIN SLOTS LIST =================
function renderAdminSlots() {
  const container = document.getElementById("admin-slots-list");
  const slots = loadSlots();
  container.innerHTML = "";

  if (slots.length === 0) {
    container.innerHTML = '<p class="hint">No slots yet. Add one above.</p>';
    return;
  }

  slots.forEach((slot) => {
    const card = document.createElement("div");
    card.className = "card";

    const bookingsHtml = slot.bookings.length
      ? `<table class="booking-table"><tbody>
          ${slot.bookings
            .map(
              (b) => `
            <tr>
              <td><input class="compact-edit" data-booking-candidate="${slot.id}|${b.id}" value="${escapeHtml(b.candidate)}" aria-label="Candidate name" /></td>
              <td><input class="compact-edit" data-booking-email="${slot.id}|${b.id}" value="${escapeHtml(b.email || "")}" aria-label="Candidate email" /></td>
              <td><input class="compact-edit" data-booking-interviewer="${slot.id}|${b.id}" value="${escapeHtml(b.interviewer)}" aria-label="Interviewer" /></td>
              <td class="booking-remove">
                <button class="btn-link" data-save-booking="${slot.id}|${b.id}">Save</button>
                <button class="btn-link" data-remove-booking="${slot.id}|${b.id}">Remove this person</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody></table>`
      : "";

    card.innerHTML = `
      <div class="slot-row">
        <div class="slot-edit-grid">
          <input type="date" data-slot-date="${slot.id}" value="${slot.date}" aria-label="Slot date" />
          <input type="time" data-slot-time="${slot.id}" value="${slot.time}" aria-label="Slot start time" />
          <select data-slot-duration="${slot.id}" aria-label="Slot duration">
            ${[15, 20, 30, 45, 60].map((minutes) => `<option value="${minutes}" ${Number(slot.duration || 20) === minutes ? "selected" : ""}>${minutes} min</option>`).join("")}
          </select>
          <span class="slot-range">${fmtTime(slot.date, slot.time)} - ${fmtTime(slot.date, minutesToTime(timeToMinutes(slot.time) + Number(slot.duration || 20)))}</span>
          <button class="btn-link" data-save-slot="${slot.id}">Save slot</button>
          <button class="btn-danger" data-delete-slot="${slot.id}">Delete</button>
        </div>
      </div>
      ${bookingsHtml}
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-delete-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete-slot");
      const updated = loadSlots().filter((s) => s.id !== id);
      saveSlots(updated);
      renderAdminSlots();
    });
  });

  container.querySelectorAll("[data-remove-booking]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeBooking(btn.getAttribute("data-remove-booking"), renderAdminSlots);
    });
  });

  container.querySelectorAll("[data-save-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-save-slot");
      const date = container.querySelector(`[data-slot-date="${id}"]`).value;
      const time = container.querySelector(`[data-slot-time="${id}"]`).value;
      const duration = Number(container.querySelector(`[data-slot-duration="${id}"]`).value);
      if (!date || !time || `${date}T${time}` <= currentTimeKey()) return;
      const updated = loadSlots().map((slot) => slot.id === id ? { ...slot, date, time, duration } : slot);
      saveSlots(updated);
      renderAdminSlots();
    });
  });

  container.querySelectorAll("[data-save-booking]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [slotId, bookingId] = btn.getAttribute("data-save-booking").split("|");
      const candidate = container.querySelector(`[data-booking-candidate="${slotId}|${bookingId}"]`).value.trim();
      const email = container.querySelector(`[data-booking-email="${slotId}|${bookingId}"]`).value.trim();
      const interviewer = container.querySelector(`[data-booking-interviewer="${slotId}|${bookingId}"]`).value.trim();
      const updated = loadSlots().map((slot) => slot.id === slotId ? { ...slot, bookings: slot.bookings.map((booking) => booking.id === bookingId ? { ...booking, candidate, email, interviewer } : booking) } : slot);
      saveSlots(updated);
      renderAdminSlots();
    });
  });
}

// ================= RENDER: CANDIDATE BOOKING VIEW =================
function renderBookingView() {
  const container = document.getElementById("slots-list");
  const slots = loadSlots().filter((slot) => !isSlotPast(slot));
  container.innerHTML = "";

  if (slots.length === 0) {
    container.innerHTML = '<p class="hint">No interview slots are open yet — check back soon.</p>';
    return;
  }

  const grouped = {};
  slots.forEach((s) => {
    grouped[s.date] = grouped[s.date] || [];
    grouped[s.date].push(s);
  });

  Object.keys(grouped)
    .sort()
    .forEach((date) => {
      const heading = document.createElement("h4");
      heading.className = "date-heading";
      heading.textContent = fmtDateHeading(date);
      container.appendChild(heading);

      grouped[date].forEach((slot) => {
        const remaining = slot.interviewers.length - slot.bookings.length;
        const full = remaining <= 0;
        const currentEmail = document.getElementById("candidate-email").value.trim().toLowerCase();
        const currentName = document.getElementById("candidate-name").value.trim().toLowerCase();
        const ownBooking = slot.bookings.find((booking) =>
          booking.email?.toLowerCase() === currentEmail && booking.candidate?.toLowerCase() === currentName
        );

        if (full && !ownBooking) return;

        const card = document.createElement("div");
        card.className = "card";
        const statusText = ownBooking ? "Booked" : `${remaining} spot${remaining !== 1 ? "s" : ""} open`;
        const statusClass = ownBooking ? "open" : "open";
        const action = ownBooking
          ? `<button class="btn-danger" data-cancel-booking="${slot.id}|${ownBooking.id}">Remove this person</button>`
          : `<button class="btn" data-book-slot="${slot.id}">Book this slot</button>`;
        card.innerHTML = `
          <div class="slot-row">
            <div>
              <span class="slot-time">${fmtTime(slot.date, slot.time)}</span>
              <div class="slot-meta">${slot.duration || 20}-minute interview</div>
              <div>
                <span class="pill ${statusClass}">${statusText}</span>
              </div>
            </div>
            ${action}
          </div>
        `;
        container.appendChild(card);
      });
    });

  container.querySelectorAll("[data-book-slot]").forEach((btn) => {
    btn.addEventListener("click", () => bookSlot(btn.getAttribute("data-book-slot")));
  });

  container.querySelectorAll("[data-cancel-booking]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeBooking(btn.getAttribute("data-cancel-booking"), () => {
        setStatus(document.getElementById("book-status"), "Booking removed.", "success");
        renderBookingView();
      });
    });
  });
}

function removeBooking(reference, afterRemove) {
  const [slotId, bookingId] = reference.split("|");
  const updated = loadSlots().map((slot) =>
    slot.id === slotId
      ? { ...slot, bookings: slot.bookings.filter((booking) => booking.id !== bookingId) }
      : slot
  );
  saveSlots(updated);
  afterRemove();
}

// ================= BOOKING LOGIC =================
function bookSlot(slotId) {
  const statusEl = document.getElementById("book-status");
  const nameInput = document.getElementById("candidate-name");
  const emailInput = document.getElementById("candidate-email");
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();

  if (!name) {
    setStatus(statusEl, "Enter your name before booking.", "error");
    return;
  }

  if (!email || !emailInput.checkValidity()) {
    setStatus(statusEl, "Enter a valid email before booking.", "error");
    emailInput.focus();
    return;
  }

  const slots = loadSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return;

  if (isSlotPast(slot)) {
    setStatus(statusEl, "That interview time has passed. Pick another slot.", "error");
    renderBookingView();
    return;
  }

  const taken = new Set(slot.bookings.map((b) => b.interviewer));
  const openInterviewer = slot.interviewers.find((i) => !taken.has(i));

  if (!openInterviewer) {
    setStatus(statusEl, "That slot just filled up — pick another.", "error");
    renderBookingView();
    return;
  }

  slot.bookings.push({ id: uid(), candidate: name, email, interviewer: openInterviewer });
  saveSlots(slots);
  renderBookingView();

  setStatus(
    statusEl,
    `Booked! You'll interview with ${openInterviewer} at ${fmtTime(slot.date, slot.time)}.`,
    "success"
  );
}

function setStatus(el, text, type) {
  el.textContent = text;
  el.className = "status " + type;
}

function currentTimeKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: selectedTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function isSlotPast(slot) {
  return `${slot.date}T${slot.time}` <= currentTimeKey();
}

let selectedTimezone = "Asia/Karachi";

function updateTimezone() {
  const timeEl = document.getElementById("timezone-time");
  if (!timeEl) return;

  timeEl.textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: selectedTimezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function setTimezone(timezone, name) {
  selectedTimezone = timezone;
  document.getElementById("timezone-name").textContent = name;
  document.getElementById("timezone-control").setAttribute("aria-label", `Selected time zone: ${name}`);
  document.getElementById("timezone-options").classList.add("hidden");
  document.getElementById("timezone-control").setAttribute("aria-expanded", "false");
  updateTimezone();
  renderBookingView();
}

const timezoneControl = document.getElementById("timezone-control");
const timezoneOptions = document.getElementById("timezone-options");

timezoneControl.addEventListener("click", () => {
  const isOpen = timezoneControl.getAttribute("aria-expanded") === "true";
  timezoneControl.setAttribute("aria-expanded", String(!isOpen));
  timezoneOptions.classList.toggle("hidden", isOpen);
});

timezoneOptions.querySelectorAll("[data-timezone]").forEach((option) => {
  option.addEventListener("click", () => {
    setTimezone(option.dataset.timezone, option.dataset.timezoneName);
  });
});

// ================= UTIL =================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ================= INIT =================
renderBookingView();
updateTimezone();
setInterval(updateTimezone, 30000);
subscribeToChanges();
bootstrapBackend();
resetIdleRefreshTimer();