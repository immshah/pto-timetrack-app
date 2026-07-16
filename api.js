:root {
  --bg: #f5f6f8;
  --card: #ffffff;
  --ink: #1b1f27;
  --muted: #6b7280;
  --line: #e4e6eb;
  --primary: #2f6fed;
  --primary-ink: #ffffff;
  --danger: #d64545;
  --ok: #2a9d5c;
  --warn: #c98a1d;
  --radius: 10px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--ink);
}

.screen { min-height: 100vh; }

/* ---------- Login ---------- */
#login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-card {
  background: var(--card);
  padding: 32px;
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  width: 320px;
}
.login-card h1 { margin: 0 0 20px; font-size: 20px; }
.login-card form { display: flex; flex-direction: column; gap: 14px; }
.login-card label { font-size: 13px; color: var(--muted); display: flex; flex-direction: column; gap: 6px; }

input, select, textarea {
  font: inherit;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--ink);
}
button {
  font: inherit;
  cursor: pointer;
  border: none;
  border-radius: 6px;
  padding: 9px 14px;
  background: var(--primary);
  color: var(--primary-ink);
}
button.secondary { background: #eef1f6; color: var(--ink); }
button.danger { background: var(--danger); color: #fff; }
button.ok { background: var(--ok); color: #fff; }
button:disabled { opacity: 0.5; cursor: default; }
.link-btn { background: none; color: var(--muted); padding: 0; text-decoration: underline; }
.error { color: var(--danger); font-size: 13px; min-height: 16px; }

/* ---------- App shell ---------- */
.topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: var(--card);
  border-bottom: 1px solid var(--line);
}
.brand { font-weight: 700; }
#main-nav { display: flex; gap: 4px; flex: 1; }
#main-nav button {
  background: none;
  color: var(--muted);
  padding: 8px 12px;
  border-radius: 6px;
}
#main-nav button.active { background: var(--bg); color: var(--ink); font-weight: 600; }
.who { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--muted); }

.view-root { max-width: 1000px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }

.card {
  background: var(--card);
  border-radius: var(--radius);
  border: 1px solid var(--line);
  padding: 20px;
}
.card h2 { margin: 0 0 14px; font-size: 16px; }
.card h3 { margin: 0 0 10px; font-size: 14px; color: var(--muted); }

.row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
.row > * { flex: 1; min-width: 140px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); }

table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; }
tr:last-child td { border-bottom: none; }

.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.badge.pending { background: #fdf1de; color: var(--warn); }
.badge.approved { background: #e3f6ea; color: var(--ok); }
.badge.denied { background: #fbe9e9; color: var(--danger); }
.badge.cancelled { background: #eef1f6; color: var(--muted); }

.clock-big { font-size: 42px; font-weight: 700; margin: 10px 0; }
.stat-grid { display: flex; gap: 16px; flex-wrap: wrap; }
.stat { background: var(--bg); border-radius: var(--radius); padding: 14px 18px; min-width: 140px; }
.stat .num { font-size: 24px; font-weight: 700; }
.stat .label { font-size: 12px; color: var(--muted); }

.tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid var(--line); }
.tabs button { background: none; color: var(--muted); border-radius: 6px 6px 0 0; padding: 8px 14px; }
.tabs button.active { color: var(--ink); font-weight: 600; border-bottom: 2px solid var(--primary); }

.toast {
  position: fixed; bottom: 20px; right: 20px;
  background: var(--ink); color: #fff; padding: 10px 16px;
  border-radius: 8px; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  animation: fadein 0.15s ease-out;
}
@keyframes fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.muted { color: var(--muted); }
.small { font-size: 12px; }
textarea.csv { width: 100%; min-height: 100px; font-family: ui-monospace, monospace; font-size: 12px; }
.actions { display: flex; gap: 8px; }
