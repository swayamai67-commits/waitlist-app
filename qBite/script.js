/*
 * QBite UI layer.
 *
 * All data comes from QBiteData (data.js). This file never touches
 * localStorage directly. Every change follows the same path:
 *   QBiteData.<action>()  ->  state is validated and persisted  ->  render()
 */
(function () {
  'use strict';

  var D = window.QBiteData;
  var ROUTES = ['dashboard', 'waitlist', 'history', 'customer', 'settings'];
  var ROUTE_TITLES = {
    dashboard: 'Dashboard',
    waitlist: 'Waitlist',
    history: 'History',
    customer: 'Customer View',
    settings: 'Settings'
  };
  var TICK_MS = 30000;
  var DASHBOARD_PREVIEW_COUNT = 5;

  var ui = {
    route: 'dashboard',
    customerNumber: null,
    historyDate: null,
    historyFilter: 'all',
    settingsDirty: false
  };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function formatDateKey(key, style) {
    var options = style === 'short'
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return D.dateFromKey(key).toLocaleDateString([], options);
  }

  function minutesBetween(from, to) {
    return Math.max(0, Math.floor((to - from) / 60000));
  }

  function formatDuration(minutes) {
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return minutes + ' min';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }

  function formatEstimate(minutes, long) {
    if (minutes <= 0) return long ? "You're next" : 'Next in line';
    return '~' + minutes + (long ? ' minutes' : ' min');
  }

  function formatPhone(phone) {
    if (/^\d{10}$/.test(phone)) return phone.slice(0, 5) + ' ' + phone.slice(5);
    return phone || '—';
  }

  function partyLabel(size) {
    return 'Party of ' + size;
  }

  function statusBadge(status) {
    return '<span class="badge badge-' + status.toLowerCase() + '">' + escapeHtml(status) + '</span>';
  }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                              */
  /* ------------------------------------------------------------------ */

  function toast(message, variant) {
    var region = $('toasts');
    var el = document.createElement('div');
    el.className = 'toast toast-' + (variant || 'success');
    el.textContent = message;
    region.appendChild(el);
    while (region.children.length > 2) region.removeChild(region.firstChild);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, variant === 'error' ? 6000 : 4000);
  }

  function showNotices() {
    D.takeNotices().forEach(function (message) { toast(message, 'error'); });
  }

  /* ------------------------------------------------------------------ */
  /* Confirmation dialog                                                 */
  /* ------------------------------------------------------------------ */

  var confirmResolver = null;

  function confirmAction(options) {
    var dialog = $('confirm-dialog');
    if (dialog.open) return Promise.resolve(false);
    $('confirm-title').textContent = options.title;
    $('confirm-message').textContent = options.message;
    $('confirm-cancel').textContent = options.cancelLabel || 'Go back';
    var okButton = $('confirm-ok');
    okButton.textContent = options.confirmLabel;
    okButton.className = 'btn ' + (options.danger ? 'btn-danger' : 'btn-primary');
    dialog.returnValue = '';
    return new Promise(function (resolve) {
      confirmResolver = resolve;
      dialog.showModal();
    });
  }

  $('confirm-dialog').addEventListener('close', function () {
    var resolve = confirmResolver;
    confirmResolver = null;
    if (resolve) resolve($('confirm-dialog').returnValue === 'confirm');
  });

  /* ------------------------------------------------------------------ */
  /* Routing                                                             */
  /* ------------------------------------------------------------------ */

  function parseHash() {
    var parts = window.location.hash.replace(/^#\/?/, '').split('/');
    var route = ROUTES.indexOf(parts[0]) !== -1 ? parts[0] : 'dashboard';
    var number = null;
    if (route === 'customer' && /^\d{1,6}$/.test(parts[1] || '')) number = Number(parts[1]);
    return { route: route, number: number };
  }

  function applyRoute(moveFocus) {
    var parsed = parseHash();
    var routeChanged = parsed.route !== ui.route;
    ui.route = parsed.route;
    ui.customerNumber = parsed.number;
    if (routeChanged) ui.settingsDirty = false;

    var isCustomer = ui.route === 'customer';
    $('staff-app').hidden = isCustomer;
    $('customer-screen').hidden = !isCustomer;
    document.body.classList.toggle('is-customer-view', isCustomer);

    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (view) {
      view.hidden = view.getAttribute('data-view') !== ui.route;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.nav-link'), function (link) {
      if (link.getAttribute('data-route') === ui.route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = ROUTE_TITLES[ui.route] + ' · QBite';

    render();

    if (moveFocus) {
      var target = isCustomer ? $('cv-main') : document.querySelector('#view-' + ui.route + ' .page-title');
      if (target) target.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function actionButton(action, label, customer, style) {
    var name = customer.customerName + ' (' + D.formatQueueNumber(customer.queueNumber) + ')';
    var verbs = { call: 'Call', seat: 'Seat', cancel: 'Cancel' };
    return '<button type="button" class="btn btn-sm ' + style + '"' +
      ' data-action="' + action + '" data-id="' + escapeHtml(customer.id) + '"' +
      ' data-focus-key="' + action + ':' + escapeHtml(customer.id) + '"' +
      ' aria-label="' + escapeHtml(verbs[action] + ' ' + name) + '">' + label + '</button>';
  }

  function entryHtml(c, now, compact) {
    var called = c.status === D.STATUS.CALLED;
    var pref = D.preferenceFor(c.tablePreference);
    var meta = [partyLabel(c.partySize)];
    if (!compact) meta.push(pref.value === 'any' ? 'Any table' : pref.label);
    if (!compact) meta.push('<span class="nowrap">' + escapeHtml(formatPhone(c.phone)) + '</span>');

    var timing = called
      ? 'Joined ' + formatTime(c.joinedAt) + ' · waited ' + formatDuration(minutesBetween(c.joinedAt, c.calledAt))
      : 'Joined ' + formatTime(c.joinedAt) + ' · waiting ' + formatDuration(minutesBetween(c.joinedAt, now));

    var sinceCalled = minutesBetween(c.calledAt, now);
    var side = called
      ? '<span class="entry-side-label">Called</span><strong>' + (sinceCalled < 1 ? 'Just now' : formatDuration(sinceCalled) + ' ago') + '</strong>' +
        '<span class="entry-side-sub">at ' + formatTime(c.calledAt) + '</span>'
      : '<span class="entry-side-label">Est. wait</span><strong>' + formatEstimate(c.estimatedWaitMinutes) + '</strong>' +
        '<span class="entry-side-sub">#' + c.position + ' in line</span>';

    var actions = called
      ? actionButton('seat', 'Seat', c, 'btn-primary') + actionButton('cancel', 'Cancel', c, 'btn-ghost')
      : actionButton('call', 'Call', c, 'btn-secondary') + actionButton('cancel', 'Cancel', c, 'btn-ghost');

    return '<li class="entry entry-' + c.status.toLowerCase() + (compact ? ' entry-compact' : '') + '">' +
      '<span class="entry-number">' + D.formatQueueNumber(c.queueNumber) + '</span>' +
      '<div class="entry-main">' +
        '<p class="entry-name">' + escapeHtml(c.customerName) + '</p>' +
        '<p class="entry-meta">' + meta.join(' · ') + '</p>' +
        '<p class="entry-time">' + timing + '</p>' +
        (compact ? '' : '<a class="entry-link" href="#customer/' + c.queueNumber + '">Customer view</a>') +
      '</div>' +
      '<div class="entry-side">' + side + '</div>' +
      '<div class="entry-status">' + statusBadge(c.status) + '</div>' +
      '<div class="entry-actions">' + actions + '</div>' +
    '</li>';
  }

  function listHtml(customers, now, compact, emptyHtml) {
    if (!customers.length) return '<div class="empty">' + emptyHtml + '</div>';
    return '<ol class="entries">' + customers.map(function (c) { return entryHtml(c, now, compact); }).join('') + '</ol>';
  }

  function emptyQueueHtml(snap) {
    var html = '<p class="empty-title">No one is waiting</p>' +
      '<p class="muted">Add a walk-in customer to start the queue.</p>' +
      '<div class="empty-actions"><button type="button" class="btn btn-secondary btn-sm" data-action="open-add">Add customer</button>';
    if (snap.stats.totalToday === 0) {
      html += '<button type="button" class="btn btn-ghost btn-sm" data-action="load-demo">Load demo data</button>';
    }
    return html + '</div>';
  }

  function renderChrome(snap) {
    var active = snap.stats.waiting + snap.stats.called;
    var badge = $('nav-waitlist-badge');
    badge.hidden = active === 0;
    badge.textContent = String(active);
    badge.setAttribute('aria-label', active + ' active');
    $('sidebar-restaurant').textContent = snap.settings.restaurantName;
    $('topbar-restaurant').textContent = snap.settings.restaurantName;
    $('sidebar-date').textContent = formatDateKey(snap.today, 'short');
    $('storage-banner').hidden = D.isStorageAvailable();
  }

  function renderDashboard(snap, now) {
    $('dashboard-date').textContent = formatDateKey(snap.today) + ' · ' + snap.settings.restaurantName;
    $('stat-waiting').textContent = snap.stats.waiting;
    $('stat-called').textContent = snap.stats.called;
    $('stat-seated').textContent = snap.stats.seated;
    $('stat-total').textContent = snap.stats.totalToday;
    $('stat-waiting-note').textContent = snap.newPartyEstimateMinutes
      ? 'New parties wait ~' + snap.newPartyEstimateMinutes + ' min'
      : 'No wait for new parties';
    $('stat-total-note').textContent = snap.stats.cancelled + ' cancelled';

    var next = snap.nextUp;
    var nextHtml;
    if (next) {
      nextHtml =
        '<div class="next-body">' +
          '<span class="next-number">' + D.formatQueueNumber(next.queueNumber) + '</span>' +
          '<div class="next-info">' +
            '<p class="next-name">' + escapeHtml(next.customerName) + '</p>' +
            '<p class="muted">' + partyLabel(next.partySize) + ' · ' +
              escapeHtml(next.tablePreference === 'any' ? 'Any table' : D.preferenceFor(next.tablePreference).label) +
              ' · waiting ' + formatDuration(minutesBetween(next.joinedAt, now)) + '</p>' +
          '</div>' +
        '</div>';
    } else {
      nextHtml = '<div class="next-body next-empty"><p class="muted">No customers are currently waiting.</p></div>';
    }
    nextHtml += '<button type="button" class="btn btn-primary btn-lg btn-block" data-action="call-next" data-focus-key="call-next-hero">' +
      'Call next' + (next ? ' · ' + D.formatQueueNumber(next.queueNumber) : '') + '</button>';
    $('next-up').innerHTML = nextHtml;

    $('dash-called').innerHTML = listHtml(snap.called, now, true,
      '<p class="muted">No one has been called. Use <strong>Call next</strong> when a table is ready.</p>');

    var preview = snap.waiting.slice(0, DASHBOARD_PREVIEW_COUNT);
    var more = snap.waiting.length - preview.length;
    $('dash-waiting').innerHTML = listHtml(preview, now, true, emptyQueueHtml(snap)) +
      (more > 0 ? '<p class="list-more"><a class="link" href="#waitlist">+ ' + more + ' more waiting</a></p>' : '');
  }

  function renderWaitlist(snap, now) {
    var parts = [snap.stats.waiting + ' waiting', snap.stats.called + ' called'];
    if (snap.stats.waiting) parts.push('new parties wait ' + formatEstimate(snap.newPartyEstimateMinutes));
    $('waitlist-summary').textContent = parts.join(' · ');
    $('wl-called-count').textContent = snap.called.length;
    $('wl-waiting-count').textContent = snap.waiting.length;
    $('wl-called').innerHTML = listHtml(snap.called, now, false,
      '<p class="muted">No customers have been called. Called customers appear here until they are seated.</p>');
    $('wl-waiting').innerHTML = listHtml(snap.waiting, now, false, emptyQueueHtml(snap));
  }

  function renderHistory(snap) {
    var dates = D.getHistoryDates();
    if (!ui.historyDate || dates.indexOf(ui.historyDate) === -1) ui.historyDate = snap.today;

    $('history-date').innerHTML = dates.map(function (key) {
      var label = key === snap.today ? 'Today · ' + formatDateKey(key, 'short') : formatDateKey(key, 'short');
      return '<option value="' + key + '"' + (key === ui.historyDate ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');

    var history = D.getHistory({ date: ui.historyDate, filter: ui.historyFilter });
    Array.prototype.forEach.call(document.querySelectorAll('#history-filters .segment'), function (btn) {
      var filter = btn.getAttribute('data-filter');
      btn.setAttribute('aria-pressed', String(filter === history.filter));
      btn.querySelector('[data-count]').textContent = history.counts[filter];
    });

    var content = $('history-content');
    if (!history.entries.length) {
      var dayLabel = history.date === snap.today ? 'today' : 'on ' + formatDateKey(history.date, 'short');
      var what = history.filter === 'all' ? 'seated or cancelled customers' : history.filter + ' customers';
      content.innerHTML = '<div class="empty"><p class="empty-title">No history yet</p>' +
        '<p class="muted">There are no ' + what + ' ' + dayLabel + '. Customers appear here once they are seated or cancelled.</p></div>';
      return;
    }

    var rows = history.entries.map(function (c) {
      var statusNote = '';
      if (c.status === D.STATUS.CANCELLED) {
        statusNote = '<span class="cell-sub">' + (c.autoClosed ? 'Closed at end of day' : 'at ' + formatTime(c.cancelledAt)) + '</span>';
      }
      return '<tr>' +
        '<td data-label="Queue #"><span class="mono">' + D.formatQueueNumber(c.queueNumber) + '</span></td>' +
        '<td data-label="Customer"><span class="cell-strong">' + escapeHtml(c.customerName) + '</span>' +
          '<span class="cell-sub">' + escapeHtml(formatPhone(c.phone)) + '</span></td>' +
        '<td data-label="Party">' + c.partySize + '</td>' +
        '<td data-label="Joined">' + formatTime(c.joinedAt) + '</td>' +
        '<td data-label="Called">' + formatTime(c.calledAt) + '</td>' +
        '<td data-label="Seated">' + formatTime(c.seatedAt) + '</td>' +
        '<td data-label="Status">' + statusBadge(c.status) + statusNote + '</td>' +
      '</tr>';
    }).join('');

    content.innerHTML = '<table class="table">' +
      '<caption class="sr-only">History for ' + escapeHtml(formatDateKey(history.date)) + '</caption>' +
      '<thead><tr><th scope="col">Queue #</th><th scope="col">Customer</th><th scope="col">Party</th>' +
      '<th scope="col">Joined</th><th scope="col">Called</th><th scope="col">Seated</th><th scope="col">Status</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  function renderSettings(snap) {
    if (ui.settingsDirty) return;
    $('set-restaurant').value = snap.settings.restaurantName;
    $('set-turnover').value = snap.settings.turnoverMinutes;
  }

  var CUSTOMER_MESSAGES = {
    WAITING: "Please stay nearby. We'll call you as soon as your table is ready.",
    CALLED: 'Your table is ready! Please come to the host stand now.',
    SEATED: "You've been seated. Enjoy your meal!",
    CANCELLED: 'This place in line was cancelled. Please speak to the host if this is a mistake.'
  };

  function renderCustomerView(snap, now) {
    $('cv-restaurant').textContent = 'Welcome to ' + snap.settings.restaurantName;
    var content = $('cv-content');
    var input = $('cv-number');
    if (document.activeElement !== input) input.value = ui.customerNumber ? String(ui.customerNumber) : '';

    if (ui.customerNumber === null) {
      var lobby;
      if (snap.stats.waiting === 0 && snap.stats.called === 0) {
        lobby = '<p class="cv-lobby-title">No wait right now</p>' +
          '<p class="muted">There is no one in the queue. Please see the host to be added.</p>';
      } else {
        lobby = '<p class="cv-lobby-title">' + snap.stats.waiting + (snap.stats.waiting === 1 ? ' party' : ' parties') + ' waiting</p>' +
          '<p class="muted">Estimated wait for new parties: <strong>' +
          (snap.newPartyEstimateMinutes ? '~' + snap.newPartyEstimateMinutes + ' minutes' : 'no wait') + '</strong></p>';
      }
      content.innerHTML = '<div class="ticket ticket-lobby">' + lobby +
        '<p class="cv-hint">Already in line? Enter your queue number below.</p></div>';
      return;
    }

    var c = D.findTodayCustomer(ui.customerNumber);
    if (!c) {
      content.innerHTML = '<div class="ticket ticket-lobby">' +
        '<p class="cv-lobby-title">We couldn\'t find ' + D.formatQueueNumber(ui.customerNumber) + '</p>' +
        '<p class="muted">That number isn\'t in today\'s queue. Check your ticket or ask the host.</p></div>';
      return;
    }

    var facts = '';
    if (c.status === D.STATUS.WAITING) {
      facts = '<p class="ticket-line">Currently <strong>#' + c.position + '</strong> in line</p>' +
        '<div class="ticket-estimate"><span>Estimated wait</span><strong>' + formatEstimate(c.estimatedWaitMinutes, true) + '</strong></div>';
    } else if (c.status === D.STATUS.CALLED) {
      facts = '<p class="ticket-line">Called at ' + formatTime(c.calledAt) + '</p>';
    } else if (c.status === D.STATUS.SEATED) {
      facts = '<p class="ticket-line">Seated at ' + formatTime(c.seatedAt) + '</p>';
    }

    content.innerHTML =
      '<article class="ticket ticket-' + c.status.toLowerCase() + '" aria-label="Your queue ticket">' +
        '<p class="ticket-label">Your queue</p>' +
        '<p class="ticket-number">' + D.formatQueueNumber(c.queueNumber) + '</p>' +
        '<p class="ticket-name">' + escapeHtml(c.customerName) + '</p>' +
        '<p class="ticket-party">' + partyLabel(c.partySize) + '</p>' +
        facts +
        '<div class="ticket-status"><span class="ticket-status-label">Status</span>' + statusBadge(c.status) + '</div>' +
        '<p class="ticket-message">' + CUSTOMER_MESSAGES[c.status] + '</p>' +
      '</article>' +
      '<p class="cv-updated">Updated ' + formatTime(now) + ' · refreshes automatically</p>';
  }

  function render() {
    var active = document.activeElement;
    var focusKey = active && active.getAttribute ? active.getAttribute('data-focus-key') : null;

    var snap = D.getSnapshot();
    var now = Date.now();
    renderChrome(snap);
    if (ui.route === 'dashboard') renderDashboard(snap, now);
    else if (ui.route === 'waitlist') renderWaitlist(snap, now);
    else if (ui.route === 'history') renderHistory(snap);
    else if (ui.route === 'settings') renderSettings(snap);
    else if (ui.route === 'customer') renderCustomerView(snap, now);

    // Re-rendered lists replace their buttons; keep keyboard focus in place.
    // Falls back to the same customer's next action (Call -> Seat), then the heading.
    if (focusKey && !document.body.contains(active)) {
      var id = active.getAttribute('data-id');
      var target = document.querySelector('[data-focus-key="' + CSS.escape(focusKey) + '"]') ||
        (id ? document.querySelector('#view-' + ui.route + ' [data-id="' + CSS.escape(id) + '"]') : null) ||
        document.querySelector('#view-' + ui.route + ' .page-title');
      if (target) target.focus({ preventScroll: true });
    }
    showNotices();
  }

  /* ------------------------------------------------------------------ */
  /* Queue actions                                                       */
  /* ------------------------------------------------------------------ */

  function reportResult(result, successMessage) {
    if (result.ok) toast(successMessage(result.customer), 'success');
    else toast(result.message, result.code === 'EMPTY' ? 'info' : 'error');
    render();
  }

  function describe(c) {
    return c.customerName + ' (' + D.formatQueueNumber(c.queueNumber) + ')';
  }

  function handleCallNext() {
    reportResult(D.callNext(), function (c) { return 'Called ' + describe(c) + ' · ' + partyLabel(c.partySize) + '.'; });
  }

  function handleCall(id) {
    reportResult(D.callCustomer(id), function (c) { return 'Called ' + describe(c) + '.'; });
  }

  function handleSeat(id) {
    reportResult(D.seatCustomer(id), function (c) { return 'Seated ' + describe(c) + '.'; });
  }

  function findActive(id) {
    var snap = D.getSnapshot();
    return snap.waiting.concat(snap.called).filter(function (c) { return c.id === id; })[0] || null;
  }

  function handleCancel(id) {
    var customer = findActive(id);
    if (!customer) {
      toast('That customer is no longer in the active queue.', 'error');
      render();
      return;
    }
    confirmAction({
      title: 'Cancel ' + describe(customer) + '?',
      message: 'They will be removed from the active queue and kept in today\'s history as cancelled. This cannot be undone.',
      confirmLabel: 'Cancel customer',
      cancelLabel: 'Keep in queue',
      danger: true
    }).then(function (confirmed) {
      if (!confirmed) return;
      reportResult(D.cancelCustomer(id), function (c) { return 'Cancelled ' + describe(c) + '.'; });
    });
  }

  function handleLoadDemo() {
    var proceed = D.hasData()
      ? confirmAction({
        title: 'Replace current data with demo data?',
        message: 'All customers and history in this browser will be replaced with 10 fictional customers. Your settings are kept.',
        confirmLabel: 'Load demo data',
        cancelLabel: 'Keep my data',
        danger: true
      })
      : Promise.resolve(true);
    proceed.then(function (confirmed) {
      if (!confirmed) return;
      var result = D.loadDemoData();
      if (!result.ok) {
        toast(result.message, 'error');
        return;
      }
      toast('Loaded ' + result.count + ' demo customers.', 'success');
      ui.historyDate = null;
      if (ui.route === 'dashboard') render();
      else window.location.hash = '#dashboard';
    });
  }

  function handleClearData() {
    confirmAction({
      title: 'Clear all QBite data?',
      message: 'This permanently removes every customer, all history and your settings from this browser.',
      confirmLabel: 'Clear data',
      cancelLabel: 'Keep data',
      danger: true
    }).then(function (confirmed) {
      if (!confirmed) return;
      D.clearData();
      ui.settingsDirty = false;
      ui.historyDate = null;
      toast('All QBite data was cleared.', 'success');
      render();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Forms                                                               */
  /* ------------------------------------------------------------------ */

  var ADD_FIELDS = {
    customerName: { input: 'add-name', error: 'add-name-error' },
    phone: { input: 'add-phone', error: 'add-phone-error' },
    partySize: { input: 'add-party', error: 'add-party-error' },
    tablePreference: { input: 'add-pref', error: 'add-pref-error' }
  };

  var SETTINGS_FIELDS = {
    restaurantName: { input: 'set-restaurant', error: 'set-restaurant-error' },
    turnoverMinutes: { input: 'set-turnover', error: 'set-turnover-error' }
  };

  function setFieldErrors(fields, errors) {
    var firstInvalid = null;
    Object.keys(fields).forEach(function (name) {
      var input = $(fields[name].input);
      var message = errors[name] || '';
      $(fields[name].error).textContent = message;
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        if (!firstInvalid) firstInvalid = input;
      } else {
        input.removeAttribute('aria-invalid');
      }
    });
    return firstInvalid;
  }

  function clearFieldErrorOnInput(fields) {
    Object.keys(fields).forEach(function (name) {
      var clear = function () {
        $(fields[name].error).textContent = '';
        $(fields[name].input).removeAttribute('aria-invalid');
      };
      $(fields[name].input).addEventListener('input', clear);
      $(fields[name].input).addEventListener('change', clear);
    });
  }

  $('add-pref').innerHTML = D.TABLE_PREFERENCES.map(function (p) {
    return '<option value="' + escapeHtml(p.value) + '">' + escapeHtml(p.label) + '</option>';
  }).join('');

  function updateAddEstimate() {
    var snap = D.getSnapshot();
    var ahead = snap.waiting.length;
    $('add-estimate').textContent = ahead
      ? 'Estimated wait if added now: ~' + snap.newPartyEstimateMinutes + ' min (' + ahead + (ahead === 1 ? ' party' : ' parties') + ' ahead).'
      : 'No one is waiting — this party will be next in line.';
  }

  function openAdd() {
    var dialog = $('add-dialog');
    if (dialog.open) return;
    $('add-form').reset();
    $('add-party').value = '2';
    $('add-pref').value = 'any';
    setFieldErrors(ADD_FIELDS, {});
    updateAddEstimate();
    dialog.showModal();
    $('add-name').focus();
  }

  function closeAdd() {
    var dialog = $('add-dialog');
    if (dialog.open) dialog.close();
  }

  $('add-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var form = event.target;
    var result = D.addCustomer({
      customerName: form.elements.customerName.value,
      phone: form.elements.phone.value,
      partySize: form.elements.partySize.value,
      tablePreference: form.elements.tablePreference.value
    });
    if (!result.ok) {
      if (result.errors) {
        var first = setFieldErrors(ADD_FIELDS, result.errors);
        if (first) first.focus();
      } else {
        toast(result.message, 'error');
      }
      return;
    }
    closeAdd();
    var c = result.customer;
    var queued = D.getQueue().waiting.filter(function (w) { return w.id === c.id; })[0];
    toast('Added ' + describe(c) + (queued ? ' · est. wait ' + formatEstimate(queued.estimatedWaitMinutes).toLowerCase() : '') + '.', 'success');
    render();
  });

  $('settings-form').addEventListener('input', function () { ui.settingsDirty = true; });

  $('settings-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var form = event.target;
    var result = D.saveSettings({
      restaurantName: form.elements.restaurantName.value,
      turnoverMinutes: form.elements.turnoverMinutes.value
    });
    if (!result.ok) {
      if (result.errors) {
        var first = setFieldErrors(SETTINGS_FIELDS, result.errors);
        if (first) first.focus();
      } else {
        toast(result.message, 'error');
      }
      return;
    }
    setFieldErrors(SETTINGS_FIELDS, {});
    ui.settingsDirty = false;
    toast('Settings saved.', 'success');
    render();
  });

  clearFieldErrorOnInput(ADD_FIELDS);
  clearFieldErrorOnInput(SETTINGS_FIELDS);

  $('cv-lookup').addEventListener('submit', function (event) {
    event.preventDefault();
    var input = $('cv-number');
    var match = /^#?\s*0*(\d{1,6})$/.exec(input.value.trim());
    if (!match || Number(match[1]) < 1) {
      $('cv-number-error').textContent = 'Enter the number on your ticket, for example 7 or #007.';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    $('cv-number-error').textContent = '';
    input.removeAttribute('aria-invalid');
    input.blur();
    var hash = '#customer/' + Number(match[1]);
    if (window.location.hash === hash) render();
    else window.location.hash = hash;
  });

  $('cv-number').addEventListener('input', function () {
    $('cv-number-error').textContent = '';
    $('cv-number').removeAttribute('aria-invalid');
  });

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  document.addEventListener('click', function (event) {
    var el = event.target.closest('[data-action]');
    if (!el) return;
    var id = el.getAttribute('data-id');
    switch (el.getAttribute('data-action')) {
      case 'open-add': openAdd(); break;
      case 'close-add': closeAdd(); break;
      case 'call-next': handleCallNext(); break;
      case 'call': handleCall(id); break;
      case 'seat': handleSeat(id); break;
      case 'cancel': handleCancel(id); break;
      case 'load-demo': handleLoadDemo(); break;
      case 'clear-data': handleClearData(); break;
    }
  });

  $('history-filters').addEventListener('click', function (event) {
    var btn = event.target.closest('[data-filter]');
    if (!btn) return;
    ui.historyFilter = btn.getAttribute('data-filter');
    render();
  });

  $('history-date').addEventListener('change', function (event) {
    ui.historyDate = event.target.value;
    render();
  });

  $('skip-link').addEventListener('click', function (event) {
    event.preventDefault();
    var target = ui.route === 'customer' ? $('cv-main') : $('main');
    target.focus();
  });

  window.addEventListener('hashchange', function () { applyRoute(true); });

  // Another tab (e.g. the customer view) changed the data: re-render.
  window.addEventListener('storage', function (event) {
    if (event.key === null || event.key === D.STORAGE_KEY) render();
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) render();
  });

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) render();
  });

  // Keeps waiting times fresh and notices a new day while the app is open.
  window.setInterval(function () {
    if (document.hidden) return;
    if (ui.route === 'dashboard' || ui.route === 'waitlist' || ui.route === 'customer') render();
    else renderChrome(D.getSnapshot());
  }, TICK_MS);

  applyRoute(false);
})();
