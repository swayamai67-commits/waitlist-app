/*
 * QBite data layer.
 *
 * This file is the single source of truth for QBite's data. Every read and
 * write of localStorage happens here; the UI (script.js) only talks to the
 * QBiteData object exported at the bottom.
 *
 * Stored shape (one localStorage key):
 * {
 *   version: 1,
 *   day: { date: 'YYYY-MM-DD', lastQueueNumber: 7 },   // current restaurant day
 *   settings: { restaurantName, turnoverMinutes },
 *   customers: [ { id, queueNumber, serviceDate, customerName, phone, partySize,
 *                  tablePreference, joinedAt, calledAt, seatedAt, cancelledAt,
 *                  status, autoClosed } ]
 * }
 *
 * Timestamps are epoch milliseconds. Dates are local-time 'YYYY-MM-DD' keys
 * built from the browser's local clock (never from toISOString, which is UTC).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'qbite.state.v1';
  var BACKUP_KEY = 'qbite.backup.corrupt';
  var SCHEMA_VERSION = 1;
  var HISTORY_RETENTION_DAYS = 30;

  var STATUS = Object.freeze({
    WAITING: 'WAITING',
    CALLED: 'CALLED',
    SEATED: 'SEATED',
    CANCELLED: 'CANCELLED'
  });

  // The only allowed status changes.
  var TRANSITIONS = Object.freeze({
    WAITING: ['CALLED', 'CANCELLED'],
    CALLED: ['SEATED', 'CANCELLED'],
    SEATED: [],
    CANCELLED: []
  });

  var TABLE_PREFERENCES = Object.freeze([
    { value: 'any', label: 'Any', capacity: Infinity },
    { value: '2', label: '2-seater', capacity: 2 },
    { value: '4', label: '4-seater', capacity: 4 },
    { value: '6', label: '6-seater', capacity: 6 },
    { value: '8+', label: '8+ seater', capacity: Infinity }
  ]);

  var LIMITS = Object.freeze({
    nameMin: 2,
    nameMax: 60,
    phoneDigitsMin: 10,
    phoneDigitsMax: 15,
    partyMin: 1,
    partyMax: 20,
    restaurantNameMax: 60,
    turnoverMin: 1,
    turnoverMax: 120
  });

  var DEFAULT_SETTINGS = Object.freeze({
    restaurantName: 'QBite Restaurant',
    turnoverMinutes: 10
  });

  /* ------------------------------------------------------------------ */
  /* Date helpers (local time only)                                      */
  /* ------------------------------------------------------------------ */

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function toDateKey(date) {
    var d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function isDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var d = dateFromKey(value);
    return toDateKey(d) === value;
  }

  function dateFromKey(key) {
    var parts = key.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function endOfDayMs(key) {
    var d = dateFromKey(key);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  }

  function shiftDateKey(key, days) {
    var d = dateFromKey(key);
    return toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
  }

  /* ------------------------------------------------------------------ */
  /* Storage adapter                                                     */
  /* ------------------------------------------------------------------ */

  var storageAvailable = (function () {
    try {
      var probe = '__qbite_probe__';
      global.localStorage.setItem(probe, probe);
      global.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  })();

  // Used only when localStorage is blocked (e.g. some private modes), so the
  // app keeps working for the current page session instead of crashing.
  var memoryStore = {};

  // Messages about recovered/repaired data, shown once by the UI.
  var pendingNotices = [];
  var noticesSeen = {};

  function addNotice(message) {
    if (noticesSeen[message]) return;
    noticesSeen[message] = true;
    pendingNotices.push(message);
  }

  function readRaw(key) {
    if (!storageAvailable) return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    try {
      return global.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeRaw(key, value) {
    if (!storageAvailable) {
      memoryStore[key] = value;
      return true;
    }
    try {
      global.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function removeRaw(key) {
    if (!storageAvailable) {
      delete memoryStore[key];
      return;
    }
    try {
      global.localStorage.removeItem(key);
    } catch {
      /* nothing else we can do */
    }
  }

  /* ------------------------------------------------------------------ */
  /* State loading, validation and recovery                              */
  /* ------------------------------------------------------------------ */

  function createEmptyState(now) {
    return {
      version: SCHEMA_VERSION,
      day: { date: toDateKey(now || new Date()), lastQueueNumber: 0 },
      settings: { restaurantName: DEFAULT_SETTINGS.restaurantName, turnoverMinutes: DEFAULT_SETTINGS.turnoverMinutes },
      customers: []
    };
  }

  function isFiniteTime(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  function isPositiveInt(value) {
    return typeof value === 'number' && Math.floor(value) === value && value >= 1;
  }

  function isValidPreference(value) {
    return TABLE_PREFERENCES.some(function (p) { return p.value === value; });
  }

  // Returns a clean customer record, or null when the record is unusable.
  function sanitizeCustomer(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.id !== 'string' || !raw.id) return null;
    if (!isPositiveInt(raw.queueNumber)) return null;
    if (typeof raw.customerName !== 'string' || !raw.customerName.trim()) return null;
    if (!isFiniteTime(raw.joinedAt)) return null;
    if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, raw.status)) return null;

    var c = {
      id: raw.id,
      queueNumber: raw.queueNumber,
      serviceDate: isDateKey(raw.serviceDate) ? raw.serviceDate : toDateKey(raw.joinedAt),
      customerName: raw.customerName.trim().slice(0, LIMITS.nameMax),
      phone: typeof raw.phone === 'string' ? raw.phone.slice(0, 20) : '',
      partySize: isPositiveInt(raw.partySize) ? Math.min(raw.partySize, 99) : 1,
      tablePreference: isValidPreference(raw.tablePreference) ? raw.tablePreference : 'any',
      joinedAt: raw.joinedAt,
      calledAt: isFiniteTime(raw.calledAt) ? raw.calledAt : null,
      seatedAt: isFiniteTime(raw.seatedAt) ? raw.seatedAt : null,
      cancelledAt: isFiniteTime(raw.cancelledAt) ? raw.cancelledAt : null,
      status: raw.status,
      autoClosed: raw.autoClosed === true
    };

    // Keep timestamps consistent with the status.
    if (c.status === STATUS.CALLED && !c.calledAt) c.calledAt = c.joinedAt;
    if (c.status === STATUS.SEATED) {
      if (!c.calledAt) c.calledAt = c.joinedAt;
      if (!c.seatedAt) c.seatedAt = c.calledAt;
    }
    if (c.status === STATUS.CANCELLED && !c.cancelledAt) c.cancelledAt = c.calledAt || c.joinedAt;
    return c;
  }

  function sanitizeSettings(raw) {
    var s = { restaurantName: DEFAULT_SETTINGS.restaurantName, turnoverMinutes: DEFAULT_SETTINGS.turnoverMinutes };
    if (!raw || typeof raw !== 'object') return s;
    if (typeof raw.restaurantName === 'string' && raw.restaurantName.trim()) {
      s.restaurantName = raw.restaurantName.trim().slice(0, LIMITS.restaurantNameMax);
    }
    if (isPositiveInt(raw.turnoverMinutes) && raw.turnoverMinutes <= LIMITS.turnoverMax) {
      s.turnoverMinutes = raw.turnoverMinutes;
    }
    return s;
  }

  // Returns { state, dropped } or null when the stored value is unusable.
  function sanitizeState(parsed) {
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.customers)) return null;

    var seenIds = {};
    var seenNumbers = {};
    var customers = [];
    var dropped = 0;

    parsed.customers.forEach(function (raw) {
      var c = sanitizeCustomer(raw);
      var numberKey = c ? c.serviceDate + '#' + c.queueNumber : '';
      if (!c || seenIds[c.id] || seenNumbers[numberKey]) {
        dropped += 1;
        return;
      }
      seenIds[c.id] = true;
      seenNumbers[numberKey] = true;
      customers.push(c);
    });

    var day = parsed.day && typeof parsed.day === 'object' ? parsed.day : {};
    var state = {
      version: SCHEMA_VERSION,
      day: {
        date: isDateKey(day.date) ? day.date : toDateKey(new Date()),
        lastQueueNumber: typeof day.lastQueueNumber === 'number' && day.lastQueueNumber >= 0 ? Math.floor(day.lastQueueNumber) : 0
      },
      settings: sanitizeSettings(parsed.settings),
      customers: customers
    };
    return { state: state, dropped: dropped };
  }

  function maxQueueNumberFor(state, dateKey) {
    return state.customers.reduce(function (max, c) {
      return c.serviceDate === dateKey && c.queueNumber > max ? c.queueNumber : max;
    }, 0);
  }

  /*
   * Starts a new restaurant day when the local date has changed.
   * Customers from earlier days who were never seated are closed as
   * CANCELLED (a valid transition from WAITING/CALLED) so they leave the
   * active queue but stay in that day's history. Returns true if anything
   * changed.
   */
  function applyDayRollover(state, now) {
    var today = toDateKey(now);
    var nowMs = now.getTime();
    var changed = false;

    state.customers.forEach(function (c) {
      if (c.serviceDate !== today && (c.status === STATUS.WAITING || c.status === STATUS.CALLED)) {
        c.status = STATUS.CANCELLED;
        c.cancelledAt = Math.max(c.calledAt || c.joinedAt, Math.min(nowMs, endOfDayMs(c.serviceDate)));
        c.autoClosed = true;
        changed = true;
      }
    });

    if (state.day.date !== today) {
      state.day = { date: today, lastQueueNumber: 0 };
      changed = true;
    }

    // Never hand out a number that is already used today.
    var maxToday = maxQueueNumberFor(state, today);
    if (state.day.lastQueueNumber < maxToday) {
      state.day.lastQueueNumber = maxToday;
      changed = true;
    }

    // Keep storage small: drop records older than the retention window.
    var cutoff = shiftDateKey(today, -HISTORY_RETENTION_DAYS);
    var before = state.customers.length;
    state.customers = state.customers.filter(function (c) { return c.serviceDate >= cutoff; });
    if (state.customers.length !== before) changed = true;

    return changed;
  }

  function saveState(state) {
    return writeRaw(STORAGE_KEY, JSON.stringify(state));
  }

  // Reads, validates and (if needed) repairs the stored state.
  function loadState() {
    var now = new Date();
    var raw = readRaw(STORAGE_KEY);
    var state;
    var needsSave = false;

    if (raw === null) {
      state = createEmptyState(now);
    } else {
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      var result = sanitizeState(parsed);
      if (!result) {
        writeRaw(BACKUP_KEY, raw);
        addNotice('Saved QBite data was unreadable, so the app started with an empty queue. A copy of the old data was kept in this browser.');
        state = createEmptyState(now);
        needsSave = true;
      } else {
        state = result.state;
        if (result.dropped > 0) {
          addNotice(result.dropped + ' damaged record' + (result.dropped === 1 ? ' was' : 's were') + ' found in saved data and skipped.');
          needsSave = true;
        }
      }
    }

    if (applyDayRollover(state, now)) needsSave = true;
    if (needsSave) saveState(state);
    return state;
  }

  /* ------------------------------------------------------------------ */
  /* Domain helpers                                                      */
  /* ------------------------------------------------------------------ */

  function isActive(c) {
    return c.status === STATUS.WAITING || c.status === STATUS.CALLED;
  }

  function byQueueNumber(a, b) {
    return a.queueNumber - b.queueNumber;
  }

  function copy(c) {
    var out = {};
    Object.keys(c).forEach(function (k) { out[k] = c[k]; });
    return out;
  }

  function canTransition(from, to) {
    return Boolean(TRANSITIONS[from]) && TRANSITIONS[from].indexOf(to) !== -1;
  }

  function preferenceFor(value) {
    for (var i = 0; i < TABLE_PREFERENCES.length; i++) {
      if (TABLE_PREFERENCES[i].value === value) return TABLE_PREFERENCES[i];
    }
    return TABLE_PREFERENCES[0];
  }

  /*
   * Estimated wait, in minutes, for a party with `customersAhead` WAITING
   * parties in front of it. Deliberately simple and deterministic: one
   * average table turnover per party ahead. Replace this function to plug in
   * a smarter model later; everything else calls it.
   */
  function estimateWaitMinutes(customersAhead, turnoverMinutes) {
    var ahead = Math.max(0, Math.floor(customersAhead) || 0);
    var turnover = Math.max(1, Math.floor(turnoverMinutes) || DEFAULT_SETTINGS.turnoverMinutes);
    return ahead * turnover;
  }

  function generateId(existing) {
    var id;
    do {
      if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        id = global.crypto.randomUUID();
      } else {
        id = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      }
    } while (existing.some(function (c) { return c.id === id; }));
    return id;
  }

  function digitsOf(value) {
    return String(value).replace(/\D/g, '');
  }

  // Validates Add Customer input. Returns { values, errors }.
  function validateCustomerInput(input, state) {
    var errors = {};
    var values = {};
    input = input || {};

    var name = String(input.customerName == null ? '' : input.customerName).replace(/\s+/g, ' ').trim();
    if (!name) {
      errors.customerName = "Enter the customer's name.";
    } else if (name.length < LIMITS.nameMin) {
      errors.customerName = 'Name must be at least ' + LIMITS.nameMin + ' characters.';
    } else if (name.length > LIMITS.nameMax) {
      errors.customerName = 'Name must be ' + LIMITS.nameMax + ' characters or fewer.';
    } else if (!/[A-Za-zÀ-￿]/.test(name)) {
      errors.customerName = 'Name must contain letters.';
    }
    values.customerName = name;

    var phoneInput = String(input.phone == null ? '' : input.phone).trim();
    var digits = digitsOf(phoneInput);
    if (!phoneInput) {
      errors.phone = 'Enter a phone number.';
    } else if (!/^\+?[\d\s\-().]+$/.test(phoneInput)) {
      errors.phone = 'Use digits only. Spaces, dashes and a leading + are allowed.';
    } else if (digits.length < LIMITS.phoneDigitsMin || digits.length > LIMITS.phoneDigitsMax) {
      errors.phone = 'Phone number must have ' + LIMITS.phoneDigitsMin + ' to ' + LIMITS.phoneDigitsMax + ' digits (you entered ' + digits.length + ').';
    }
    values.phone = (phoneInput.charAt(0) === '+' ? '+' : '') + digits;

    var partyInput = String(input.partySize == null ? '' : input.partySize).trim();
    var party = Number(partyInput);
    if (!partyInput) {
      errors.partySize = 'Enter the party size.';
    } else if (!/^\d+$/.test(partyInput) || party < LIMITS.partyMin || party > LIMITS.partyMax) {
      errors.partySize = 'Party size must be a whole number from ' + LIMITS.partyMin + ' to ' + LIMITS.partyMax + '.';
    }
    values.partySize = party;

    var pref = input.tablePreference == null || input.tablePreference === '' ? 'any' : String(input.tablePreference);
    if (!isValidPreference(pref)) {
      errors.tablePreference = 'Choose a table preference.';
    } else if (!errors.partySize && party > preferenceFor(pref).capacity) {
      errors.tablePreference = 'A ' + preferenceFor(pref).label + ' cannot fit a party of ' + party + '. Choose a larger table or "Any".';
    }
    values.tablePreference = pref;

    if (!errors.phone && state) {
      var today = state.day.date;
      var duplicate = state.customers.filter(function (c) {
        return c.serviceDate === today && isActive(c) && digitsOf(c.phone) === digits;
      })[0];
      if (duplicate) {
        errors.phone = 'This number is already in the queue as ' + formatQueueNumber(duplicate.queueNumber) + ' (' + duplicate.customerName + ').';
      }
    }

    return { values: values, errors: errors };
  }

  function formatQueueNumber(n) {
    return '#' + (n < 1000 ? ('00' + n).slice(-3) : String(n));
  }

  function ok(customer) {
    return { ok: true, customer: customer ? copy(customer) : null };
  }

  function fail(message, extra) {
    var result = { ok: false, message: message };
    if (extra) Object.keys(extra).forEach(function (k) { result[k] = extra[k]; });
    return result;
  }

  var SAVE_ERROR = 'Could not save to browser storage. Your change was not recorded.';

  /* ------------------------------------------------------------------ */
  /* Public API: reads                                                   */
  /* ------------------------------------------------------------------ */

  function getSettings() {
    return copy(loadState().settings);
  }

  function withQueueInfo(waitingSorted, settings) {
    return waitingSorted.map(function (c, index) {
      var out = copy(c);
      out.position = index + 1;
      out.customersAhead = index;
      out.estimatedWaitMinutes = estimateWaitMinutes(index, settings.turnoverMinutes);
      return out;
    });
  }

  function todaysCustomers(state) {
    return state.customers.filter(function (c) { return c.serviceDate === state.day.date; });
  }

  // Active queue for today: WAITING (with position/estimate) and CALLED.
  function getQueue() {
    return buildQueue(loadState());
  }

  function buildQueue(state) {
    var today = todaysCustomers(state).sort(byQueueNumber);
    var waiting = today.filter(function (c) { return c.status === STATUS.WAITING; });
    var called = today.filter(function (c) { return c.status === STATUS.CALLED; });
    return {
      waiting: withQueueInfo(waiting, state.settings),
      called: called.map(copy)
    };
  }

  function buildStats(state) {
    var stats = { waiting: 0, called: 0, seated: 0, cancelled: 0, totalToday: 0 };
    todaysCustomers(state).forEach(function (c) {
      stats.totalToday += 1;
      if (c.status === STATUS.WAITING) stats.waiting += 1;
      else if (c.status === STATUS.CALLED) stats.called += 1;
      else if (c.status === STATUS.SEATED) stats.seated += 1;
      else if (c.status === STATUS.CANCELLED) stats.cancelled += 1;
    });
    return stats;
  }

  function getStats() {
    return buildStats(loadState());
  }

  /*
   * Finished (SEATED / CANCELLED) customers for one day, newest first.
   * filter: 'all' | 'seated' | 'cancelled'
   */
  function getHistory(options) {
    var state = loadState();
    options = options || {};
    var date = isDateKey(options.date) ? options.date : state.day.date;
    var filter = options.filter === 'seated' || options.filter === 'cancelled' ? options.filter : 'all';

    var finished = state.customers.filter(function (c) {
      return c.serviceDate === date && (c.status === STATUS.SEATED || c.status === STATUS.CANCELLED);
    });
    var counts = {
      all: finished.length,
      seated: finished.filter(function (c) { return c.status === STATUS.SEATED; }).length,
      cancelled: finished.filter(function (c) { return c.status === STATUS.CANCELLED; }).length
    };
    var entries = finished
      .filter(function (c) { return filter === 'all' || c.status.toLowerCase() === filter; })
      .sort(function (a, b) { return b.queueNumber - a.queueNumber; })
      .map(copy);
    return { date: date, filter: filter, entries: entries, counts: counts };
  }

  // Dates that have history, newest first. Today is always included.
  function getHistoryDates() {
    var state = loadState();
    var dates = {};
    dates[state.day.date] = true;
    state.customers.forEach(function (c) {
      if (c.status === STATUS.SEATED || c.status === STATUS.CANCELLED) dates[c.serviceDate] = true;
    });
    return Object.keys(dates).sort().reverse();
  }

  // Everything the staff dashboard needs, read from storage once.
  function getSnapshot() {
    var state = loadState();
    var queue = buildQueue(state);
    var nextWaiting = queue.waiting.length ? queue.waiting[0] : null;
    return {
      today: state.day.date,
      settings: copy(state.settings),
      waiting: queue.waiting,
      called: queue.called,
      stats: buildStats(state),
      nextUp: nextWaiting,
      // Estimate for a party that joins right now.
      newPartyEstimateMinutes: estimateWaitMinutes(queue.waiting.length, state.settings.turnoverMinutes)
    };
  }

  // Looks up one of today's customers for the customer view.
  function findTodayCustomer(queueNumber) {
    var state = loadState();
    var n = Number(queueNumber);
    if (!isPositiveInt(n)) return null;
    var match = todaysCustomers(state).filter(function (c) { return c.queueNumber === n; })[0];
    if (!match) return null;
    if (match.status === STATUS.WAITING) {
      var queue = buildQueue(state);
      return queue.waiting.filter(function (c) { return c.id === match.id; })[0];
    }
    return copy(match);
  }

  function takeNotices() {
    var notices = pendingNotices.slice();
    pendingNotices.length = 0;
    return notices;
  }

  /* ------------------------------------------------------------------ */
  /* Public API: writes                                                  */
  /* ------------------------------------------------------------------ */

  function addCustomer(input) {
    var state = loadState();
    var checked = validateCustomerInput(input, state);
    if (Object.keys(checked.errors).length) {
      return fail('Please fix the highlighted fields.', { errors: checked.errors });
    }
    var v = checked.values;
    var queueNumber = state.day.lastQueueNumber + 1;
    var customer = {
      id: generateId(state.customers),
      queueNumber: queueNumber,
      serviceDate: state.day.date,
      customerName: v.customerName,
      phone: v.phone,
      partySize: v.partySize,
      tablePreference: v.tablePreference,
      joinedAt: Date.now(),
      calledAt: null,
      seatedAt: null,
      cancelledAt: null,
      status: STATUS.WAITING,
      autoClosed: false
    };
    state.customers.push(customer);
    state.day.lastQueueNumber = queueNumber;
    if (!saveState(state)) return fail(SAVE_ERROR);
    return ok(customer);
  }

  var TIMESTAMP_FIELD = { CALLED: 'calledAt', SEATED: 'seatedAt', CANCELLED: 'cancelledAt' };
  var VERB = { CALLED: 'called', SEATED: 'seated', CANCELLED: 'cancelled' };

  /*
   * Moves a customer to a new status, enforcing the allowed transitions.
   * Always reads the latest stored data first, so a stale screen (or a
   * double click) can never apply an invalid change.
   */
  function updateCustomer(id, toStatus) {
    if (!TIMESTAMP_FIELD[toStatus]) return fail('Unknown status: ' + toStatus + '.');
    var state = loadState();
    var customer = state.customers.filter(function (c) { return c.id === id; })[0];
    if (!customer) return fail('That customer is no longer in the queue.');
    if (customer.serviceDate !== state.day.date) return fail(customer.customerName + ' is from a previous day and can no longer be changed.');
    if (!canTransition(customer.status, toStatus)) {
      return fail(customer.customerName + ' (' + formatQueueNumber(customer.queueNumber) + ') is ' +
        customer.status.toLowerCase() + ' and cannot be ' + VERB[toStatus] + '.', { customer: copy(customer) });
    }
    customer.status = toStatus;
    customer[TIMESTAMP_FIELD[toStatus]] = Date.now();
    if (!saveState(state)) return fail(SAVE_ERROR);
    return ok(customer);
  }

  function callCustomer(id) { return updateCustomer(id, STATUS.CALLED); }
  function seatCustomer(id) { return updateCustomer(id, STATUS.SEATED); }
  function cancelCustomer(id) { return updateCustomer(id, STATUS.CANCELLED); }

  // Calls the earliest WAITING customer of the day.
  function callNext() {
    var queue = getQueue();
    if (!queue.waiting.length) return fail('No customers are currently waiting.', { code: 'EMPTY' });
    return callCustomer(queue.waiting[0].id);
  }

  function saveSettings(input) {
    input = input || {};
    var errors = {};
    var name = String(input.restaurantName == null ? '' : input.restaurantName).replace(/\s+/g, ' ').trim();
    if (!name) errors.restaurantName = 'Enter the restaurant name.';
    else if (name.length > LIMITS.restaurantNameMax) errors.restaurantName = 'Use ' + LIMITS.restaurantNameMax + ' characters or fewer.';

    var turnoverInput = String(input.turnoverMinutes == null ? '' : input.turnoverMinutes).trim();
    var turnover = Number(turnoverInput);
    if (!/^\d+$/.test(turnoverInput) || turnover < LIMITS.turnoverMin || turnover > LIMITS.turnoverMax) {
      errors.turnoverMinutes = 'Enter a whole number of minutes from ' + LIMITS.turnoverMin + ' to ' + LIMITS.turnoverMax + '.';
    }
    if (Object.keys(errors).length) return fail('Please fix the highlighted fields.', { errors: errors });

    var state = loadState();
    state.settings = { restaurantName: name, turnoverMinutes: turnover };
    if (!saveState(state)) return fail(SAVE_ERROR);
    return { ok: true, settings: copy(state.settings) };
  }

  // Removes all QBite data from this browser.
  function clearData() {
    removeRaw(STORAGE_KEY);
    removeRaw(BACKUP_KEY);
    return { ok: true };
  }

  var DEMO_CUSTOMERS = [
    // name, party, preference, status, joined (min ago), called (min ago), finished (min ago)
    ['Aarav Mehta', 2, '2', 'SEATED', 95, 82, 79],
    ['Priya Nair', 4, '4', 'SEATED', 88, 70, 67],
    ['Daniel Brooks', 3, 'any', 'CANCELLED', 80, null, 64],
    ['Sneha Kulkarni', 6, '6', 'SEATED', 72, 55, 51],
    ['Kabir Singh', 2, 'any', 'SEATED', 60, 40, 37],
    ['Meera Iyer', 5, '6', 'CALLED', 45, 4, null],
    ['Leo Fernandes', 2, '2', 'CANCELLED', 38, 20, 12],
    ['Ananya Rao', 4, '4', 'WAITING', 25, null, null],
    ['Vikram Joshi', 8, '8+', 'WAITING', 14, null, null],
    ['Sara Thomas', 3, 'any', 'WAITING', 6, null, null]
  ];

  // Replaces all queue data with fictional customers for today. Settings are kept.
  function loadDemoData() {
    var current = loadState();
    var now = new Date();
    var nowMs = now.getTime();
    var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    // Squeeze the demo timeline if it is shortly after midnight so every
    // timestamp still falls on today's date.
    var span = 96 * 60000;
    var scale = Math.min(1, (nowMs - startOfDay) / span);
    function ago(minutes) {
      return minutes == null ? null : Math.round(nowMs - minutes * 60000 * scale);
    }

    var state = createEmptyState(now);
    state.settings = current.settings;
    DEMO_CUSTOMERS.forEach(function (row, index) {
      var status = row[3];
      state.customers.push({
        id: generateId(state.customers),
        queueNumber: index + 1,
        serviceDate: state.day.date,
        customerName: row[0],
        phone: '900000' + ('000' + (index + 1) * 111).slice(-4),
        partySize: row[1],
        tablePreference: row[2],
        joinedAt: ago(row[4]),
        calledAt: ago(row[5]),
        seatedAt: status === STATUS.SEATED ? ago(row[6]) : null,
        cancelledAt: status === STATUS.CANCELLED ? ago(row[6]) : null,
        status: status,
        autoClosed: false
      });
    });
    state.day.lastQueueNumber = DEMO_CUSTOMERS.length;
    if (!saveState(state)) return fail(SAVE_ERROR);
    return { ok: true, count: DEMO_CUSTOMERS.length };
  }

  function hasData() {
    return loadState().customers.length > 0;
  }

  global.QBiteData = Object.freeze({
    STATUS: STATUS,
    TABLE_PREFERENCES: TABLE_PREFERENCES,
    STORAGE_KEY: STORAGE_KEY,
    isStorageAvailable: function () { return storageAvailable; },
    toDateKey: toDateKey,
    dateFromKey: dateFromKey,
    formatQueueNumber: formatQueueNumber,
    preferenceFor: preferenceFor,
    canTransition: canTransition,
    estimateWaitMinutes: estimateWaitMinutes,
    getQueue: getQueue,
    getStats: getStats,
    getHistory: getHistory,
    getHistoryDates: getHistoryDates,
    getSettings: getSettings,
    getSnapshot: getSnapshot,
    findTodayCustomer: findTodayCustomer,
    takeNotices: takeNotices,
    hasData: hasData,
    addCustomer: addCustomer,
    updateCustomer: updateCustomer,
    callCustomer: callCustomer,
    seatCustomer: seatCustomer,
    cancelCustomer: cancelCustomer,
    callNext: callNext,
    saveSettings: saveSettings,
    loadDemoData: loadDemoData,
    clearData: clearData
  });
})(window);
