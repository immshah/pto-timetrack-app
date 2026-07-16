let currentUser = null;
let currentView = 'clock';
let adminTab = 'team';

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : '';
}
function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString() : '';
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

// ---------------- Boot ----------------
async function boot() {
  const token = Api.token();
  if (!token) return showLogin();
  try {
    const { user } = await Api.get('/api/auth/me');
    currentUser = user;
    showApp();
  } catch (e) {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('who-name').textContent = `${currentUser.name} (${currentUser.role})`;
  renderNav();
  currentView = 'clock';
  renderView();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const { token } = await Api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', token);
    const { user } = await Api.get('/api/auth/me');
    currentUser = user;
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  currentUser = null;
  showLogin();
});

// ---------------- Nav ----------------
function renderNav() {
  const nav = document.getElementById('main-nav');
  const items = [
    { id: 'clock', label: 'Clock' },
    { id: 'timesheet', label: 'Timesheet' },
    { id: 'pto', label: 'PTO' },
  ];
  if (['admin', 'manager'].includes(currentUser.role)) items.push({ id: 'admin', label: 'Admin' });

  nav.innerHTML = '';
  items.forEach((it) => {
    const btn = document.createElement('button');
    btn.textContent = it.label;
    btn.className = currentView === it.id ? 'active' : '';
    btn.addEventListener('click', () => { currentView = it.id; renderView(); });
    nav.appendChild(btn);
  });
}

function renderView() {
  renderNav();
  const root = document.getElementById('view-root');
  root.innerHTML = '<p class="muted">Loading…</p>';
  const renderers = { clock: renderClockView, timesheet: renderTimesheetView, pto: renderPtoView, admin: renderAdminView };
  (renderers[currentView] || renderClockView)(root).catch((err) => {
    root.innerHTML = `<div class="card"><p class="error">${err.message}</p></div>`;
  });
}

// ---------------- Clock view ----------------
async function renderClockView(root) {
  const [{ open }, { entries, totalHours }] = await Promise.all([
    Api.get('/api/timesheets/status'),
    Api.get(`/api/timesheets/me?start=${firstOfMonthStr()}&end=${todayStr()}`),
  ]);

  root.innerHTML = `
    <div class="card">
      <h2>Clock</h2>
      ${open
        ? `<div class="clock-big">Clocked in</div>
           <p class="muted">Since ${fmtDateTime(open.clock_in)}</p>
           <button id="clock-btn" class="danger">Clock out</button>`
        : `<div class="clock-big">Not clocked in</div>
           <button id="clock-btn" class="ok">Clock in</button>`}
    </div>

    <div class="card">
      <h2>This month</h2>
      <div class="stat-grid">
        <div class="stat"><div class="num">${totalHours}</div><div class="label">Hours logged</div></div>
        <div class="stat"><div class="num">${currentUser.pto_balance_hours ?? '—'}</div><div class="label">PTO hours available</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Add a manual entry</h2>
      <p class="muted small">Forgot to clock in or out? Log hours directly for a specific day.</p>
      <form id="manual-form" class="row">
        <label class="field">Date<input type="date" name="work_date" value="${todayStr()}" required /></label>
        <label class="field">Hours<input type="number" step="0.25" min="0.25" name="hours" required /></label>
        <label class="field">Notes<input type="text" name="notes" placeholder="optional" /></label>
        <button type="submit">Add</button>
      </form>
    </div>

    <div class="card">
      <h2>Recent entries</h2>
      ${renderEntriesTable(entries.slice(0, 10))}
    </div>
  `;

  document.getElementById('clock-btn').addEventListener('click', async () => {
    try {
      if (open) {
        const r = await Api.post('/api/timesheets/clock-out');
        toast(`Clocked out — ${r.hours}h logged`);
      } else {
        await Api.post('/api/timesheets/clock-in');
        toast('Clocked in');
      }
      renderView();
    } catch (e) { toast(e.message); }
  });

  document.getElementById('manual-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await Api.post('/api/timesheets/manual', {
        work_date: fd.get('work_date'),
        hours: fd.get('hours'),
        notes: fd.get('notes'),
      });
      toast('Entry added');
      renderView();
    } catch (err) { toast(err.message); }
  });
}

function renderEntriesTable(entries) {
  if (!entries.length) return '<p class="muted">No entries yet.</p>';
  return `
    <table>
      <thead><tr><th>Date</th><th>Hours</th><th>Source</th><th>Notes</th><th></th></tr></thead>
      <tbody>
        ${entries.map((e) => `
          <tr>
            <td>${fmtDate(e.work_date)}</td>
            <td>${e.hours ?? '—'}</td>
            <td>${e.source}</td>
            <td>${e.notes || ''}</td>
            <td><button class="link-btn small" onclick="deleteEntry(${e.id})">delete</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  try {
    await Api.del(`/api/timesheets/${id}`);
    toast('Deleted');
    renderView();
  } catch (e) { toast(e.message); }
}

// ---------------- Timesheet view ----------------
async function renderTimesheetView(root) {
  const start = document.getElementById('ts-start')?.value || firstOfMonthStr();
  const end = document.getElementById('ts-end')?.value || todayStr();
  const { entries, totalHours } = await Api.get(`/api/timesheets/me?start=${start}&end=${end}`);

  root.innerHTML = `
    <div class="card">
      <h2>My timesheet</h2>
      <div class="row">
        <label class="field">From<input type="date" id="ts-start" value="${start}" /></label>
        <label class="field">To<input type="date" id="ts-end" value="${end}" /></label>
        <button id="ts-filter">Filter</button>
      </div>
      <p class="muted">Total: <strong>${totalHours}</strong> hours</p>
      ${renderEntriesTable(entries)}
    </div>
  `;
  document.getElementById('ts-filter').addEventListener('click', () => renderView());
}

// ---------------- PTO view ----------------
async function renderPtoView(root) {
  const { requests, balanceHours } = await Api.get('/api/pto/me');

  root.innerHTML = `
    <div class="card">
      <h2>PTO balance</h2>
      <div class="stat-grid">
        <div class="stat"><div class="num">${balanceHours}</div><div class="label">Hours available</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Request time off</h2>
      <form id="pto-form" class="row">
        <label class="field">Start<input type="date" name="start_date" required /></label>
        <label class="field">End<input type="date" name="end_date" required /></label>
        <label class="field">Type
          <select name="type">
            <option value="vacation">Vacation</option>
            <option value="sick">Sick</option>
            <option value="personal">Personal</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label class="field">Reason<input type="text" name="reason" placeholder="optional" /></label>
        <button type="submit">Submit request</button>
      </form>
    </div>

    <div class="card">
      <h2>My requests</h2>
      ${requests.length ? `
        <table>
          <thead><tr><th>Dates</th><th>Type</th><th>Hours</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${requests.map((r) => `
              <tr>
                <td>${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}</td>
                <td>${r.type}</td>
                <td>${r.hours_requested}</td>
                <td><span class="badge ${r.status}">${r.status}</span></td>
                <td>${r.status === 'pending' ? `<button class="link-btn small" onclick="cancelPto(${r.id})">cancel</button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="muted">No requests yet.</p>'}
    </div>
  `;

  document.getElementById('pto-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await Api.post('/api/pto/request', {
        start_date: fd.get('start_date'),
        end_date: fd.get('end_date'),
        type: fd.get('type'),
        reason: fd.get('reason'),
      });
      toast(`Requested ${r.hours_requested}h`);
      renderView();
    } catch (err) { toast(err.message); }
  });
}

async function cancelPto(id) {
  if (!confirm('Cancel this request?')) return;
  try {
    await Api.post(`/api/pto/${id}/cancel`);
    toast('Cancelled');
    renderView();
  } catch (e) { toast(e.message); }
}

// ---------------- Admin view ----------------
async function renderAdminView(root) {
  root.innerHTML = `
    <div class="tabs">
      <button data-tab="team" class="${adminTab === 'team' ? 'active' : ''}">Team</button>
      <button data-tab="approvals" class="${adminTab === 'approvals' ? 'active' : ''}">PTO approvals</button>
      <button data-tab="users" class="${adminTab === 'users' ? 'active' : ''}">Manage users</button>
      <button data-tab="reports" class="${adminTab === 'reports' ? 'active' : ''}">Reports</button>
    </div>
    <div id="admin-tab-root"></div>
  `;
  root.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => { adminTab = btn.dataset.tab; renderView(); });
  });

  const tabRoot = document.getElementById('admin-tab-root');
  const tabRenderers = { team: renderAdminTeam, approvals: renderAdminApprovals, users: renderAdminUsers, reports: renderAdminReports };
  await (tabRenderers[adminTab] || renderAdminTeam)(tabRoot);
}

async function renderAdminTeam(root) {
  const [{ users }, { entries }] = await Promise.all([
    Api.get('/api/admin/users'),
    Api.get(`/api/timesheets/all?start=${todayStr()}&end=${todayStr()}`),
  ]);
  const hoursToday = {};
  entries.forEach((e) => { hoursToday[e.user_id] = (hoursToday[e.user_id] || 0) + (e.hours || 0); });

  root.innerHTML = `
    <div class="card">
      <h2>Team (${users.length})</h2>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>PTO balance</th><th>Hours today</th><th>Status</th></tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td>${u.role}</td>
              <td>${u.pto_balance_hours}</td>
              <td>${Math.round((hoursToday[u.id] || 0) * 100) / 100}</td>
              <td>${u.active ? '' : '<span class="badge cancelled">inactive</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderAdminApprovals(root) {
  const { requests } = await Api.get('/api/pto/all?status=pending');
  root.innerHTML = `
    <div class="card">
      <h2>Pending PTO requests (${requests.length})</h2>
      ${requests.length ? `
        <table>
          <thead><tr><th>Name</th><th>Dates</th><th>Type</th><th>Hours</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            ${requests.map((r) => `
              <tr>
                <td>${r.user_name}</td>
                <td>${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}</td>
                <td>${r.type}</td>
                <td>${r.hours_requested}</td>
                <td>${r.reason || ''}</td>
                <td class="actions">
                  <button class="ok small" onclick="decidePto(${r.id}, 'approved')">Approve</button>
                  <button class="danger small" onclick="decidePto(${r.id}, 'denied')">Deny</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="muted">Nothing pending.</p>'}
    </div>
  `;
}

async function decidePto(id, decision) {
  try {
    await Api.post(`/api/pto/${id}/decide`, { decision });
    toast(`Request ${decision}`);
    renderView();
  } catch (e) { toast(e.message); }
}

async function renderAdminUsers(root) {
  const { users } = await Api.get('/api/admin/users');
  const isAdmin = currentUser.role === 'admin';

  root.innerHTML = `
    <div class="card">
      <h2>Users</h2>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>PTO balance</th><th>Active</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td>
                ${isAdmin ? `
                  <select onchange="updateUser(${u.id}, {role: this.value})">
                    <option value="associate" ${u.role === 'associate' ? 'selected' : ''}>associate</option>
                    <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>manager</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                  </select>
                ` : u.role}
              </td>
              <td>
                ${isAdmin
                  ? `<input type="number" step="1" style="width:80px" value="${u.pto_balance_hours}" onchange="updateUser(${u.id}, {pto_balance_hours: this.value})" />`
                  : u.pto_balance_hours}
              </td>
              <td>${isAdmin
                ? `<input type="checkbox" ${u.active ? 'checked' : ''} onchange="updateUser(${u.id}, {active: this.checked})" />`
                : (u.active ? 'yes' : 'no')}
              </td>
              ${isAdmin ? `<td><button class="link-btn small" onclick="resetPassword(${u.id})">reset password</button></td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${isAdmin ? `
    <div class="card">
      <h2>Add a user</h2>
      <form id="add-user-form" class="row">
        <label class="field">Name<input type="text" name="name" required /></label>
        <label class="field">Email<input type="email" name="email" required /></label>
        <label class="field">Temp password<input type="text" name="password" required minlength="8" /></label>
        <label class="field">Role
          <select name="role">
            <option value="associate">associate</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label class="field">PTO balance (hrs)<input type="number" name="pto_balance_hours" value="0" /></label>
        <button type="submit">Add user</button>
      </form>
    </div>

    <div class="card">
      <h2>Bulk import (CSV)</h2>
      <p class="muted small">One row per person: <code>name,email,password,role,pto_balance_hours</code>. Role and PTO balance are optional (defaults: associate, 0). No header row.</p>
      <textarea id="bulk-csv" class="csv" placeholder="Jane Doe,jane@company.com,TempPass123,associate,80
John Smith,john@company.com,TempPass123,manager,120"></textarea>
      <br /><br />
      <button id="bulk-import-btn">Import</button>
      <div id="bulk-result"></div>
    </div>
    ` : ''}
  `;

  if (isAdmin) {
    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await Api.post('/api/admin/users', {
          name: fd.get('name'),
          email: fd.get('email'),
          password: fd.get('password'),
          role: fd.get('role'),
          pto_balance_hours: fd.get('pto_balance_hours'),
        });
        toast('User added');
        renderView();
      } catch (err) { toast(err.message); }
    });

    document.getElementById('bulk-import-btn').addEventListener('click', async () => {
      const raw = document.getElementById('bulk-csv').value.trim();
      if (!raw) return;
      const rows = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      const users = rows.map((line) => {
        const [name, email, password, role, pto] = line.split(',').map((s) => (s || '').trim());
        return { name, email, password, role, pto_balance_hours: pto };
      });
      try {
        const result = await Api.post('/api/admin/users/bulk', { users });
        document.getElementById('bulk-result').innerHTML = `
          <p class="muted small">Created ${result.created.length}, skipped ${result.skipped.length}.</p>
          ${result.skipped.length ? `<p class="error small">${result.skipped.map((s) => `${s.email || '(blank)'}: ${s.reason}`).join('<br/>')}</p>` : ''}
        `;
        toast(`Imported ${result.created.length} users`);
        setTimeout(() => renderView(), 1200);
      } catch (err) { toast(err.message); }
    });
  }
}

async function updateUser(id, patch) {
  try {
    await Api.put(`/api/admin/users/${id}`, patch);
    toast('Updated');
  } catch (e) { toast(e.message); renderView(); }
}

async function resetPassword(id) {
  const pw = prompt('New temporary password (min 8 characters):');
  if (!pw) return;
  try {
    await Api.put(`/api/admin/users/${id}`, { password: pw });
    toast('Password reset');
  } catch (e) { toast(e.message); }
}

async function renderAdminReports(root) {
  const start = firstOfMonthStr();
  const end = todayStr();
  root.innerHTML = `
    <div class="card">
      <h2>Export reports</h2>
      <div class="row">
        <label class="field">From<input type="date" id="rep-start" value="${start}" /></label>
        <label class="field">To<input type="date" id="rep-end" value="${end}" /></label>
      </div>
      <div class="actions" style="margin-top:12px">
        <button id="export-timesheet">Download timesheet CSV</button>
        <button id="export-pto" class="secondary">Download PTO CSV</button>
      </div>
    </div>
  `;
  const download = (path) => {
    const s = document.getElementById('rep-start').value;
    const e = document.getElementById('rep-end').value;
    const url = `${path}?start=${s}&end=${e}`;
    fetch(url, { headers: { Authorization: `Bearer ${Api.token()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = path.includes('pto') ? `pto_${s}_${e}.csv` : `timesheet_${s}_${e}.csv`;
        a.click();
      });
  };
  document.getElementById('export-timesheet').addEventListener('click', () => download('/api/timesheets/report.csv'));
  document.getElementById('export-pto').addEventListener('click', () => download('/api/pto/report.csv'));
}

boot();
