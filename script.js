/* =========================================================
   frommylens — site behaviour
   Talks to /api/availability and /api/bookings (Vercel
   serverless functions backed by Neon — see /api and
   neon-setup.sql). If those routes aren't deployed yet or the
   DATABASE_URL env var isn't set, calls fail gracefully: the
   calendar still shows and dates can be picked, but
   availability won't reflect real bookings and submissions
   will tell the visitor to reach out directly instead.
   ========================================================= */

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- internal anchor navigation ----------
   Two native-browser quirks make plain <a href="#x"> unreliable here:
   1) #top targets the fixed header, and browsers are inconsistent
      about scrolling to a position:fixed element (it's always "in
      view", so the jump can silently do nothing).
   2) If the URL fragment is already "#book" (say, from an earlier
      click) and the visitor scrolls away and clicks a #book link
      again, most browsers don't fire a navigation at all, because
      the fragment hasn't changed — so nothing happens.
   Handling every internal link explicitly on click sidesteps both. */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  const id = a.getAttribute('href').slice(1);
  if (!id) return;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    history.pushState(null, '', `#${id}`);
  });
});

/* ---------- mobile nav ---------- */
const navToggle = document.getElementById('navToggle');
const mobileNav = document.getElementById('mobileNav');
navToggle.addEventListener('click', () => {
  const open = mobileNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});
mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mobileNav.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}));

/* ---------- backend availability flag ----------
   Flips to false the first time a call to /api fails outright
   (e.g. the functions aren't deployed yet), so we stop pretending
   the calendar is live and tell the visitor plainly instead. */
let backendAvailable = true;

/* ---------- calendar state ---------- */
const calendarGrid = document.getElementById('calendarGrid');
const calMonthLabel = document.getElementById('calMonthLabel');
const calendarStatus = document.getElementById('calendarStatus');
const prevBtn = document.getElementById('prevMonth');
const nextBtn = document.getElementById('nextMonth');
const fDate = document.getElementById('fDate');

const today = new Date();
today.setHours(0,0,0,0);
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed
let selectedDateISO = null;
let bookedDates = new Set(); // 'YYYY-MM-DD'

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isoDate(y, m, d){
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

async function fetchBookedDates(){
  calendarStatus.textContent = 'Loading calendar\u2026';
  try {
    const res = await fetch('/api/availability');
    if (!res.ok) throw new Error(`availability ${res.status}`);
    const { dates } = await res.json();
    bookedDates = new Set(dates || []);
    calendarStatus.textContent = 'Pick an open date to start a request.';
  } catch (e) {
    console.error(e);
    backendAvailable = false;
    calendarStatus.textContent = 'Live availability isn\u2019t connected yet — every open date shown is provisional.';
  }
}

function renderCalendar(){
  calMonthLabel.textContent = `${monthNames[viewMonth]} ${viewYear}`;
  calendarGrid.innerHTML = '';

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell empty';
    calendarGrid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-cell';
    cell.textContent = d;

    const cellDate = new Date(viewYear, viewMonth, d);
    cellDate.setHours(0,0,0,0);
    const iso = isoDate(viewYear, viewMonth, d);

    if (cellDate < today) {
      cell.classList.add('past');
      cell.disabled = true;
    } else if (bookedDates.has(iso)) {
      cell.classList.add('booked');
      cell.disabled = true;
      cell.title = 'Already booked';
    } else {
      cell.classList.add('open');
      cell.addEventListener('click', () => selectDate(iso, cell));
    }

    if (iso === selectedDateISO) cell.classList.add('selected');

    calendarGrid.appendChild(cell);
  }

  // don't allow navigating earlier than the current month
  prevBtn.disabled = (viewYear < today.getFullYear()) ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth());
}

function selectDate(iso, cellEl){
  selectedDateISO = iso;
  const d = new Date(iso + 'T00:00:00');
  fDate.value = d.toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  renderCalendar();
  document.getElementById('fName').focus({ preventScroll:true });
}

prevBtn.addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
nextBtn.addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});

renderCalendar();
fetchBookedDates().then(renderCalendar);

/* ---------- booking form ---------- */
const bookingForm = document.getElementById('bookingForm');
const submitBtn = document.getElementById('submitBtn');
const formStatus = document.getElementById('formStatus');
const formSuccess = document.getElementById('formSuccess');

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formStatus.textContent = '';
  formStatus.className = 'form-status';

  if (!selectedDateISO) {
    formStatus.textContent = 'Pick a date on the calendar first.';
    formStatus.classList.add('is-error');
    return;
  }

  const payload = {
    shoot_date: selectedDateISO,
    name: document.getElementById('fName').value.trim(),
    package: document.getElementById('fPackage').value,
    email: document.getElementById('fEmail').value.trim(),
    phone: document.getElementById('fPhone').value.trim(),
    message: document.getElementById('fMessage').value.trim(),
    status: 'pending'
  };

  if (!payload.name || !payload.package || !payload.email || !payload.phone) {
    formStatus.textContent = 'Please fill in every required field.';
    formStatus.classList.add('is-error');
    return;
  }

  if (!backendAvailable) {
    formStatus.textContent = 'Booking storage isn\u2019t connected yet — please reach out on Instagram or WhatsApp directly for now.';
    formStatus.classList.add('is-error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending\u2026';

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.status === 409) {
      formStatus.textContent = 'That date was just taken — please pick another.';
      formStatus.classList.add('is-error');
      await fetchBookedDates();
      renderCalendar();
    } else if (!res.ok) {
      throw new Error(`bookings ${res.status}`);
    } else {
      bookingForm.hidden = true;
      formSuccess.hidden = false;
    }
  } catch (err) {
    console.error(err);
    formStatus.textContent = 'Something went wrong sending your request — please try again or message directly.';
    formStatus.classList.add('is-error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Request this date';
  }
});
