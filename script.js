// ================= CONFIG =================
const STORAGE_KEY = "crew-interview-slots";
const MEMBERS_KEY = "crew-interview-members";
const ADMIN_PASS = "crew2026"; // change this to your own passcode

// ================= STORAGE HELPERS =================
function loadSlots() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSlots(slots) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

function loadMembers() {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMembers(members) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
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

document.getElementById("add-availability").addEventListener("click", () => {
  const start = document.getElementById("availability-start").value;
  const end = document.getElementById("availability-end").value;
  const duration = Number(document.getElementById("slot-duration").value);
  const members = [...document.querySelectorAll("#availability-members input:checked")].map((input) => input.value);
  const status = document.getElementById("admin-form-status");

  if (!start || !end || start >= end) {
    setStatus(status, "Choose a valid start and end time.", "error");
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
              <td class="booking-candidate">${escapeHtml(b.candidate)}</td>
              <td class="booking-interviewer">with ${escapeHtml(b.interviewer)}</td>
              <td class="booking-remove">
                <button class="btn-link" data-remove-booking="${slot.id}|${b.id}">Remove</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody></table>`
      : "";

    card.innerHTML = `
      <div class="slot-row">
        <div>
          <strong>${fmtDateHeading(slot.date)}, ${fmtTime(slot.date, slot.time)}</strong>
          <div class="slot-meta">
            ${slot.duration || 30}-minute interview ·
            ${slot.interviewers.length} parallel room${slot.interviewers.length !== 1 ? "s" : ""}:
            ${escapeHtml(slot.interviewers.join(", "))}
          </div>
        </div>
        <button class="btn-danger" data-delete-slot="${slot.id}">Delete slot</button>
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
      const [slotId, bookingId] = btn.getAttribute("data-remove-booking").split("|");
      const updated = loadSlots().map((s) =>
        s.id === slotId
          ? { ...s, bookings: s.bookings.filter((b) => b.id !== bookingId) }
          : s
      );
      saveSlots(updated);
      renderAdminSlots();
    });
  });
}

// ================= RENDER: CANDIDATE BOOKING VIEW =================
function renderBookingView() {
  const container = document.getElementById("slots-list");
  const slots = loadSlots();
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

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="slot-row">
            <div>
              <span class="slot-time">${fmtTime(slot.date, slot.time)}</span>
              <div class="slot-meta">${slot.duration || 30}-minute interview</div>
              <div>
                <span class="pill ${full ? "full" : "open"}">
                  ${full ? "Full" : `${remaining} spot${remaining !== 1 ? "s" : ""} open`}
                </span>
              </div>
            </div>
            <button class="btn" data-book-slot="${slot.id}" ${full ? "disabled" : ""}>
              ${full ? "Full" : "Book this slot"}
            </button>
          </div>
        `;
        container.appendChild(card);
      });
    });

  container.querySelectorAll("[data-book-slot]").forEach((btn) => {
    btn.addEventListener("click", () => bookSlot(btn.getAttribute("data-book-slot")));
  });
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