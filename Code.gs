/**
 * TEKZITHON 2027 — Google Apps Script backend
 * Bound to the Google Sheet (Extensions > Apps Script).
 * Run setup() once, set ADMIN_PASSWORD in Script Properties, then deploy as Web App
 * (Execute as: Me, Who has access: Anyone).
 */

const SHEETS = {
  Config: ['key', 'value'],
  Domains: ['id', 'title', 'description', 'order', 'active'],
  Abstracts: ['ref', 'submittedAt', 'teamName', 'leaderEmail', 'title', 'domain', 'abstract', 'keywords',
    'diagramFileId', 'diagramName', 'pdfFileId', 'pdfName', 'status', 'note'],
  Registrations: ['regId', 'ref', 'createdAt', 'teamName', 'leaderName', 'leaderEmail', 'leaderPhone', 'refPhone',
    'college', 'year', 'department', 'state', 'p2', 'p3', 'p4', 'participants', 'amount', 'paymentStatus',
    'status', 'paymentRef'],
  Resources: ['id', 'title', 'description', 'url', 'order', 'published'],
  Leaderboard: ['id', 'team', 'project', 'domain', 'score', 'rank', 'label', 'visible'],
  Announcements: ['id', 'title', 'body', 'date', 'published'],
  AuditLog: ['time', 'admin', 'action', 'detail']
};

const EDITABLE = ['Domains', 'Resources', 'Leaderboard', 'Announcements'];

const DEFAULT_CONFIG = {
  eventName: 'TEKZITHON 2027',
  eventDate: '2027-01-22',
  eventStart: '2027-01-22T00:00:00+05:30',
  timeConfirmed: 'FALSE',
  timerMode: 'published',            // published | paused | hidden
  abstractDeadline: '2026-12-15T23:59:59+05:30',
  shortlistDate: '2026-12-26',
  feePerPerson: '399',
  maxTeam: '4',
  contactEmail: 'hod.ece@stpetershyd.com',
  abstractPdfEnabled: 'FALSE',
  registrationOpen: 'TRUE',
  leaderboardPublished: 'FALSE',
  paymentInstructions: '',           // PRIVATE until a team is shortlisted
  contacts: ''                       // optional JSON override of coordinators
};
const PUBLIC_KEYS = ['eventName', 'eventDate', 'eventStart', 'timeConfirmed', 'timerMode', 'abstractDeadline',
  'shortlistDate', 'feePerPerson', 'maxTeam', 'contactEmail', 'abstractPdfEnabled', 'registrationOpen',
  'leaderboardPublished', 'contacts'];

const DEFAULT_DOMAINS = [
  ['Embedded Systems and IoT', 'Microcontroller-based devices, firmware and connected systems.'],
  ['Robotics and Automation', 'Autonomous machines, actuators and industrial automation.'],
  ['Sensor and Biomedical Electronics', 'Sensing, signal conditioning and health-monitoring hardware.'],
  ['Smart Energy and Green Electronics', 'Efficient power, energy harvesting and sustainable hardware.'],
  ['AI, Edge Computing and Intelligent Electronics', 'On-device intelligence and smart embedded decision-making.'],
  ['Electronic Circuit Design and Prototyping', 'Analog and digital circuits, PCBs and rapid prototyping.'],
  ['Communication and Wireless Systems', 'Wireless links, protocols and communication hardware.'],
  ['VLSI, FPGA and Digital Electronics', 'Digital design, FPGA implementations and logic systems.'],
  ['Antennas and RF Systems', 'Antenna design, RF front-ends and propagation experiments.'],
  ['Open Innovation', 'Multidisciplinary, emerging technologies, and cross-domain hardware solutions.']
];

const MAX_IMG_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

/* ---------- one-time setup ---------- */
function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    let s = book.getSheetByName(name);
    if (!s) s = book.insertSheet(name);
    const h = SHEETS[name];
    s.getRange(1, 1, s.getMaxRows(), h.length).setNumberFormat('@');
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    s.setFrozenRows(1);
  });
  const def = book.getSheetByName('Sheet1');
  if (def && book.getSheets().length > 1 && def.getLastRow() === 0) book.deleteSheet(def);

  if (rowsWithIndex('Config').length === 0) {
    Object.keys(DEFAULT_CONFIG).forEach(function (k) { append('Config', { key: k, value: DEFAULT_CONFIG[k] }); });
  }
  if (rowsWithIndex('Domains').length === 0) {
    DEFAULT_DOMAINS.forEach(function (d, i) {
      append('Domains', { id: 'D' + (i + 1), title: d[0], description: d[1], order: i + 1, active: 'TRUE' });
    });
  }
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FOLDER_ID')) {
    const root = DriveApp.createFolder('TEKZITHON 2027 — Private Submissions');
    props.setProperty('FOLDER_ID', root.getId());
  }
  Logger.log('Setup complete. Now add ADMIN_PASSWORD in Project Settings > Script Properties.');
}

/* ---------- sheet helpers ---------- */
function sh(n) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }
function rowsWithIndex(n) {
  const s = sh(n), v = s.getDataRange().getValues(), h = v.shift(), out = [];
  v.forEach(function (r, i) {
    if (r.join('') === '') return;
    const o = { _row: i + 2 };
    h.forEach(function (k, j) { o[k] = String(r[j]); });
    out.push(o);
  });
  return out;
}
function clean(v, max) {
  let s = String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (max) s = s.substring(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function append(n, o) {
  const h = SHEETS[n];
  sh(n).appendRow(h.map(function (k) { return o[k] === undefined ? '' : String(o[k]); }));
}
function updateRow(n, row, o) {
  const h = SHEETS[n], rg = sh(n).getRange(row, 1, 1, h.length), cur = rg.getValues()[0];
  rg.setValues([h.map(function (k, i) { return o[k] === undefined ? cur[i] : String(o[k]); })]);
}
function config() {
  const c = {};
  Object.keys(DEFAULT_CONFIG).forEach(function (k) { c[k] = DEFAULT_CONFIG[k]; });
  rowsWithIndex('Config').forEach(function (r) { c[r.key] = r.value; });
  return c;
}
function isTrue(v) { return String(v).toUpperCase() === 'TRUE'; }
function wordCount(t) { const m = String(t).trim().match(/\S+/g); return m ? m.length : 0; }
function uid(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase(); }
function refCode(prefix, existing) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = prefix;
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  } while (existing.indexOf(code) !== -1);
  return code;
}
function audit(admin, action, detail) {
  append('AuditLog', { time: new Date().toISOString(), admin: admin, action: action, detail: clean(detail, 500) });
}
function rateLimit(key, max, seconds) {
  const cache = CacheService.getScriptCache(), k = 'rl_' + key;
  const n = Number(cache.get(k) || 0);
  if (n >= max) throw new Error('Too many attempts. Please wait a few minutes and try again.');
  cache.put(k, String(n + 1), seconds);
}

/* ---------- HTTP entry points ---------- */
function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  try {
    const a = (e.parameter && e.parameter.action) || 'config';
    if (a === 'config') return out({ ok: true, data: publicConfig() });
    return out({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return out({ ok: false, error: 'Unable to load data.' });
  }
}
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const a = body.action;
    if (a === 'config') return out({ ok: true, data: publicConfig() });
    if (a === 'submitAbstract') return out({ ok: true, data: submitAbstract(body) });
    if (a === 'status') return out({ ok: true, data: statusLookup(body) });
    if (a === 'register') return out({ ok: true, data: registerTeam(body) });
    if (a === 'adminLogin') return out({ ok: true, data: adminLogin(body) });
    if (a.indexOf('admin_') === 0) return out({ ok: true, data: adminAction(a, body) });
    return out({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    const known = err && err.userFacing;
    return out({ ok: false, error: known ? err.message : (err && err.message && err.message.indexOf('Too many') === 0 ? err.message : 'Something went wrong. Please try again.') });
  }
}
function fail(msg) { const e = new Error(msg); e.userFacing = true; return e; }

/* ---------- public data ---------- */
function publicConfig() {
  const c = config(), pub = {};
  PUBLIC_KEYS.forEach(function (k) { pub[k] = c[k]; });
  const domains = rowsWithIndex('Domains').filter(function (d) { return isTrue(d.active); })
    .sort(function (a, b) { return Number(a.order) - Number(b.order); })
    .map(function (d) { return { id: d.id, title: d.title, description: d.description }; });
  const resources = rowsWithIndex('Resources').filter(function (r) { return isTrue(r.published); })
    .sort(function (a, b) { return Number(a.order) - Number(b.order); })
    .map(function (r) { return { id: r.id, title: r.title, description: r.description, url: r.url }; });
  const announcements = rowsWithIndex('Announcements').filter(function (r) { return isTrue(r.published); })
    .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
    .map(function (r) { return { id: r.id, title: r.title, body: r.body, date: r.date }; });
  let leaderboard = [];
  if (isTrue(c.leaderboardPublished)) {
    leaderboard = rowsWithIndex('Leaderboard').filter(function (r) { return isTrue(r.visible); })
      .map(function (r) { return { team: r.team, project: r.project, domain: r.domain, score: r.score, rank: r.rank, label: r.label }; });
  }
  return { settings: pub, domains: domains, resources: resources, announcements: announcements, leaderboard: leaderboard };
}

/* ---------- uploads ---------- */
function decodeUpload(f, kinds, maxBytes) {
  if (!f || !f.data) throw fail('A required file is missing.');
  const bytes = Utilities.base64Decode(f.data);
  if (bytes.length > maxBytes) throw fail('File is too large. Maximum size is 5 MB.');
  const b = bytes.map(function (x) { return x & 255; });
  let mime = '';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) mime = 'image/png';
  else if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) mime = 'image/jpeg';
  else if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) mime = 'application/pdf';
  if (!mime || kinds.indexOf(mime) === -1) throw fail('Unsupported file type.');
  return { bytes: bytes, mime: mime };
}
function saveToDrive(up, name, ref) {
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
  const ext = up.mime === 'image/png' ? '.png' : up.mime === 'image/jpeg' ? '.jpg' : '.pdf';
  const blob = Utilities.newBlob(up.bytes, up.mime, ref + '_' + name.replace(/[^\w\-]/g, '_').substring(0, 40) + ext);
  return folder.createFile(blob).getId();
}

/* ---------- abstract submission ---------- */
function submitAbstract(b) {
  const c = config();
  if (new Date() > new Date(c.abstractDeadline)) throw fail('The abstract submission deadline has passed.');
  const team = clean(b.teamName, 80), email = clean(b.leaderEmail, 120).toLowerCase(),
    title = clean(b.title, 150), domain = clean(b.domain, 120), abstract = clean(b.abstract, 6000);
  if (team.length < 2) throw fail('Please enter a team name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Please enter a valid team leader email.');
  if (title.length < 3) throw fail('Please enter a project title.');
  const active = rowsWithIndex('Domains').filter(function (d) { return isTrue(d.active); }).map(function (d) { return d.title; });
  if (active.indexOf(domain) === -1) throw fail('Please choose a valid project domain.');
  const wc = wordCount(abstract);
  if (wc < 20) throw fail('Please write a fuller abstract.');
  if (wc > 500) throw fail('The abstract must be 500 words or fewer.');
  const kws = String(b.keywords || '').split(',').map(function (k) { return clean(k, 40); }).filter(Boolean);
  const uniq = kws.filter(function (k, i) { return kws.map(function (x) { return x.toLowerCase(); }).indexOf(k.toLowerCase()) === i; });
  if (uniq.length !== 5) throw fail('Please provide exactly five distinct keywords.');

  const img = decodeUpload(b.diagram, ['image/png', 'image/jpeg'], MAX_IMG_BYTES);
  let pdf = null;
  if (b.pdf && b.pdf.data) {
    if (!isTrue(c.abstractPdfEnabled)) throw fail('PDF upload is not enabled for this event.');
    pdf = decodeUpload(b.pdf, ['application/pdf'], MAX_PDF_BYTES);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    rateLimit('sub_' + email, 5, 600);
    const existing = rowsWithIndex('Abstracts');
    const dup = existing.some(function (r) {
      return r.leaderEmail.toLowerCase() === email || r.teamName.toLowerCase() === team.toLowerCase();
    });
    if (dup) throw fail('An abstract has already been submitted for this team name or leader email.');
    const ref = refCode('TKZ27-', existing.map(function (r) { return r.ref; }));
    const diagramId = saveToDrive(img, 'diagram', ref);
    const pdfId = pdf ? saveToDrive(pdf, 'abstract', ref) : '';
    append('Abstracts', {
      ref: ref, submittedAt: new Date().toISOString(), teamName: team, leaderEmail: email, title: title,
      domain: domain, abstract: abstract, keywords: uniq.join(', '),
      diagramFileId: diagramId, diagramName: clean(b.diagram.name, 80),
      pdfFileId: pdfId, pdfName: pdf ? clean(b.pdf.name, 80) : '',
      status: 'Pending Review', note: ''
    });
    try {
      MailApp.sendEmail(email, c.eventName + ' — abstract received',
        'Your abstract for "' + title + '" was received.\nSubmission reference: ' + ref +
        '\nStatus: Pending Review.\nShortlist announcement expected: ' + c.shortlistDate +
        '\nNo payment is required unless your team is shortlisted.');
    } catch (mailErr) { /* email is best-effort */ }
    return { ref: ref, status: 'Pending Review' };
  } finally { lock.releaseLock(); }
}

/* ---------- status + registration ---------- */
function findAbstract(ref, email) {
  const r = rowsWithIndex('Abstracts').filter(function (x) {
    return x.ref === clean(ref, 30).toUpperCase() && x.leaderEmail.toLowerCase() === clean(email, 120).toLowerCase();
  })[0];
  return r || null;
}
function derive(abs, reg) {
  if (abs.status !== 'Shortlisted') return abs.status;
  if (!reg) return 'Registration Pending';
  if (reg.status === 'Confirmed') return 'Confirmed';
  if (reg.paymentStatus === 'Paid') return 'Paid';
  return 'Payment Pending';
}
function statusLookup(b) {
  rateLimit('st_' + clean(b.email, 120).toLowerCase(), 12, 600);
  const abs = findAbstract(b.ref, b.email);
  if (!abs) throw fail('No submission found for that reference and email.');
  const c = config();
  const reg = rowsWithIndex('Registrations').filter(function (r) { return r.ref === abs.ref; })[0] || null;
  const res = {
    ref: abs.ref, teamName: abs.teamName, title: abs.title, domain: abs.domain,
    abstractStatus: abs.status, status: derive(abs, reg), shortlisted: abs.status === 'Shortlisted',
    feePerPerson: Number(c.feePerPerson), maxTeam: Number(c.maxTeam), registered: !!reg
  };
  if (abs.status === 'Shortlisted') {
    res.paymentInstructions = c.paymentInstructions || '';
    if (reg) { res.registration = { regId: reg.regId, participants: reg.participants, amount: reg.amount, paymentStatus: reg.paymentStatus }; }
  }
  return res;
}
function registerTeam(b) {
  const c = config();
  if (!isTrue(c.registrationOpen)) throw fail('Team registration is currently closed.');
  const abs = findAbstract(b.ref, b.leaderEmail);
  if (!abs) throw fail('No submission found for that reference and email.');
  if (abs.status !== 'Shortlisted') throw fail('Only shortlisted teams can register.');
  const f = {
    leaderName: clean(b.leaderName, 80), leaderPhone: clean(b.leaderPhone, 20), refPhone: clean(b.refPhone, 20),
    college: clean(b.college, 120), year: clean(b.year, 20), department: clean(b.department, 80), state: clean(b.state, 60),
    p2: clean(b.p2, 80), p3: clean(b.p3, 80), p4: clean(b.p4, 80)
  };
  ['leaderName', 'leaderPhone', 'refPhone', 'college', 'year', 'department', 'state'].forEach(function (k) {
    if (!f[k]) throw fail('Please fill all required fields.');
  });
  if (!/^[+\d][\d\s\-]{8,18}$/.test(f.leaderPhone) || !/^[+\d][\d\s\-]{8,18}$/.test(f.refPhone)) throw fail('Please enter valid phone numbers.');
  const participants = 1 + [f.p2, f.p3, f.p4].filter(Boolean).length;
  if (participants > Number(c.maxTeam)) throw fail('A team can have at most ' + c.maxTeam + ' participants.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const regs = rowsWithIndex('Registrations');
    if (regs.some(function (r) { return r.ref === abs.ref; })) throw fail('This team has already registered.');
    const amount = participants * Number(c.feePerPerson);
    const regId = refCode('TKZR-', regs.map(function (r) { return r.regId; }));
    append('Registrations', {
      regId: regId, ref: abs.ref, createdAt: new Date().toISOString(), teamName: abs.teamName, leaderName: f.leaderName,
      leaderEmail: abs.leaderEmail, leaderPhone: f.leaderPhone, refPhone: f.refPhone, college: f.college, year: f.year,
      department: f.department, state: f.state, p2: f.p2, p3: f.p3, p4: f.p4, participants: participants,
      amount: amount, paymentStatus: 'Pending', status: 'Payment Pending', paymentRef: ''
    });
    return { regId: regId, participants: participants, feePerPerson: Number(c.feePerPerson), amount: amount,
      status: 'Payment Pending', paymentInstructions: c.paymentInstructions || '' };
  } finally { lock.releaseLock(); }
}

/* ---------- admin ---------- */
function adminLogin(b) {
  rateLimit('login', 8, 900);
  const pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!pw) throw fail('Admin password is not configured on the server.');
  const given = String(b.password || '');
  let diff = given.length === pw.length ? 0 : 1;
  for (let i = 0; i < pw.length; i++) diff |= (given.charCodeAt(i) || 0) ^ pw.charCodeAt(i);
  if (diff !== 0) throw fail('Invalid credentials.');
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('tok_' + token, 'admin', 6 * 3600);
  audit('admin', 'login', '');
  return { token: token };
}
function requireAdmin(token) {
  if (!token || CacheService.getScriptCache().get('tok_' + token) !== 'admin') throw fail('Session expired. Please sign in again.');
}
function adminAction(a, b) {
  requireAdmin(b.token);
  switch (a) {
    case 'admin_stats': return adminStats();
    case 'admin_list': {
      const n = b.sheet;
      if (['Abstracts', 'Registrations', 'Domains', 'Resources', 'Leaderboard', 'Announcements', 'AuditLog'].indexOf(n) === -1) throw fail('Invalid sheet.');
      return rowsWithIndex(n).map(function (r) { delete r._row; return r; });
    }
    case 'admin_getConfig': return config();
    case 'admin_saveConfig': {
      const cur = rowsWithIndex('Config'), vals = b.values || {};
      Object.keys(vals).forEach(function (k) {
        if (!(k in DEFAULT_CONFIG)) return;
        const v = clean(vals[k], 3000);
        const hit = cur.filter(function (r) { return r.key === k; })[0];
        if (hit) updateRow('Config', hit._row, { value: v }); else append('Config', { key: k, value: v });
      });
      audit('admin', 'saveConfig', Object.keys(vals).join(','));
      return { saved: true };
    }
    case 'admin_setAbstractStatus': {
      if (['Pending Review', 'Shortlisted', 'Not Shortlisted'].indexOf(b.status) === -1) throw fail('Invalid status.');
      const r = rowsWithIndex('Abstracts').filter(function (x) { return x.ref === b.ref; })[0];
      if (!r) throw fail('Submission not found.');
      updateRow('Abstracts', r._row, { status: b.status, note: clean(b.note, 300) });
      audit('admin', 'abstractStatus', b.ref + ' -> ' + b.status);
      return { saved: true };
    }
    case 'admin_getFile': {
      const known = rowsWithIndex('Abstracts').some(function (x) { return x.diagramFileId === b.id || x.pdfFileId === b.id; });
      if (!known) throw fail('File not found.');
      const blob = DriveApp.getFileById(b.id).getBlob();
      return { mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
    }
    case 'admin_setPayment': {
      const r = rowsWithIndex('Registrations').filter(function (x) { return x.regId === b.regId; })[0];
      if (!r) throw fail('Registration not found.');
      const ps = b.paymentStatus;
      if (['Pending', 'Paid'].indexOf(ps) === -1) throw fail('Invalid payment status.');
      updateRow('Registrations', r._row, { paymentStatus: ps, paymentRef: clean(b.paymentRef, 80), status: ps === 'Paid' ? 'Paid' : 'Payment Pending' });
      audit('admin', 'payment', b.regId + ' -> ' + ps);
      return { saved: true };
    }
    case 'admin_confirmRegistration': {
      const r = rowsWithIndex('Registrations').filter(function (x) { return x.regId === b.regId; })[0];
      if (!r) throw fail('Registration not found.');
      if (r.paymentStatus !== 'Paid') throw fail('Payment must be verified before confirming.');
      updateRow('Registrations', r._row, { status: 'Confirmed' });
      audit('admin', 'confirm', b.regId);
      return { saved: true };
    }
    case 'admin_upsert': {
      const n = b.sheet;
      if (EDITABLE.indexOf(n) === -1) throw fail('Invalid sheet.');
      const row = b.row || {}, h = SHEETS[n], o = {};
      h.forEach(function (k) { if (row[k] !== undefined) o[k] = clean(row[k], k === 'body' || k === 'description' ? 1500 : 300); });
      if (n === 'Resources' && o.url && !/^https:\/\//i.test(o.url)) throw fail('Resource links must start with https://');
      const existing = row.id ? rowsWithIndex(n).filter(function (x) { return x.id === row.id; })[0] : null;
      if (existing) updateRow(n, existing._row, o);
      else { o.id = uid(n.charAt(0)); append(n, o); }
      audit('admin', 'upsert ' + n, o.title || o.team || o.id);
      return { saved: true };
    }
    case 'admin_remove': {
      const n = b.sheet;
      if (EDITABLE.indexOf(n) === -1) throw fail('Invalid sheet.');
      const r = rowsWithIndex(n).filter(function (x) { return x.id === b.id; })[0];
      if (!r) throw fail('Item not found.');
      sh(n).deleteRow(r._row);
      audit('admin', 'remove ' + n, b.id);
      return { saved: true };
    }
    default: throw fail('Unknown action.');
  }
}
function adminStats() {
  const a = rowsWithIndex('Abstracts'), r = rowsWithIndex('Registrations');
  const cnt = function (arr, f) { return arr.filter(f).length; };
  return {
    abstracts: a.length,
    pending: cnt(a, function (x) { return x.status === 'Pending Review'; }),
    shortlisted: cnt(a, function (x) { return x.status === 'Shortlisted'; }),
    notShortlisted: cnt(a, function (x) { return x.status === 'Not Shortlisted'; }),
    registrations: r.length,
    paid: cnt(r, function (x) { return x.paymentStatus === 'Paid'; }),
    confirmed: cnt(r, function (x) { return x.status === 'Confirmed'; }),
    revenue: r.filter(function (x) { return x.paymentStatus === 'Paid'; }).reduce(function (s, x) { return s + Number(x.amount || 0); }, 0)
  };
}
