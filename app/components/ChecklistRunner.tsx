'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import Link from 'next/link';

type ChecklistType = 'opening' | 'closing';

type ChecklistDef = {
  name: string;
  items: { id: string; title: string; required?: boolean }[];
};

const DEFAULTS: Record<ChecklistType, ChecklistDef> = {
  opening: {
    name: 'Opening Checklist',
    items: [
      { id: 'clock-in-pos', title: 'Clock into POS', required: true },
      { id: 'brew-drip', title: 'Brew drip coffee', required: true },
      { id: 'setout-tools', title: 'Set out portafilters, milk pitchers, shot glasses, etc.', required: true },
      { id: 'setout-syrups', title: 'Set out syrups and chocolate sauce', required: true },
      { id: 'dial-in-espresso', title: 'Dial in the espresso machine — adjust grinder as needed', required: true },
      { id: 'fill-pastry-case', title: 'Fill the pastry case (FIFO) — note any day 2 pastries', required: true },
      { id: 'update-toast-pastry', title: 'Update pastry inventory in Toast; make sure quantities are accurate', required: true },
      { id: 'setout-cust-trash', title: 'Set out the customer trash bin', required: true },
      { id: 'prep-patio', title: 'Prepare patio — open umbrellas; wipe down chairs & tables', required: true },
      { id: 'wipe-exterior-shelves', title: 'Wipe down exterior customer shelves', required: true },
      { id: 'unlock-open-windows', title: 'Unlock and open windows and shelves', required: true },
      { id: 'setout-napkins-merch', title: 'Set out napkin dispenser, sugar tray, and merchandise', required: true },
      { id: 'inventory-low-stock', title: 'Perform an inventory check; note low stock on whiteboard', required: true },
      { id: 'fill-freshwater-1', title: 'Fill the freshwater tank', required: true },
      { id: 'leave-trash-recycle', title: '(Before leaving) Take out trash and recycling', required: true },
      { id: 'leave-restock-customer-shelf', title: '(Before leaving) Restock customer shelf — sugars, sleeves, napkins', required: true },
      { id: 'leave-restock-stations', title: '(Before leaving) Restock drip & espresso stations — cups, lids, sleeves', required: true },
      { id: 'leave-check-patio', title: '(Before leaving) Check patio — wipe down tables and chairs', required: true },
      { id: 'fill-freshwater-2', title: '(Before leaving) Fill the freshwater tank (top off)', required: true }
    ],
  },
  closing: {
    name: 'Closing Checklist',
    items: [
      { id: 'plants-away', title: 'Put our plants away', required: true },
      { id: 'collect-organizers', title: 'Collect napkins, sugar and sleeve organizer, and merch', required: true },
      { id: 'close-lock-windows', title: 'Close and lock windows', required: true },
      { id: 'wipe-syrup-bottles', title: 'Wipe down syrup bottles and store in fridge', required: true },
      { id: 'soak-steam-wands', title: 'Soak steaming wands in dairy cleaner for 10 mins, then wipe down', required: true },
      { id: 'clean-brewers', title: 'Clean coffee brewers', required: true },
      { id: 'discard-leftover-coffee', title: 'Discard any leftover coffee in dispensers', required: true },
      { id: 'tabz-tablet', title: 'Place one Tabz tablet in brew basket and run brew cycle', required: true },
      { id: 'rinse-brew', title: 'Discard solution and run a second brew cycle (hot water only)', required: true },
      { id: 'clean-espresso-station', title: 'Clean espresso station', required: true },
      { id: 'run-clean-cycle-groups', title: 'With blind baskets, run cleaning cycle on both group heads', required: true },
      { id: 'backflush-powder', title: 'Add cleaning powder (dime size) and backflush 5× for 10s', required: true },
      { id: 'soak-pfs-baskets', title: 'Soak portafilters & baskets in hot water + powder for 10 mins', required: true },
      { id: 'rinse-wipe-pfs', title: 'Rinse and wipe with clean, dry microfiber cloth', required: true },
      { id: 'wash-drain-tray-espresso', title: 'Wash & rinse drain tray; wipe down espresso machine', required: true },
      { id: 'rinse-pitcher-rinser', title: 'Rinse and wipe down pitcher rinser', required: true },
      { id: 'wipe-surfaces-espresso', title: 'Wipe down counter and surfaces around espresso equipment', required: true },
      { id: 'store-pastries-wash-trays', title: 'Store leftover pastries; wash & rinse plastic trays', required: true },
      { id: 'wash-sanitize-dishes', title: 'Wash, rinse, and sanitize dishes (shot glasses, pitchers, whisks, etc.)', required: true },
      { id: 'sanitize-counters-fridges', title: 'Clean and sanitize counters, fridges, and surfaces as needed', required: true },
      { id: 'prep-drip-decaf', title: 'Prep drip coffee beans and decaf grounds', required: true },
      { id: 'sweep-mop', title: 'Sweep and mop the floor', required: true },
      { id: 'fill-fresh-water', title: 'Fill the fresh water tank', required: true },
      { id: 'trash-out', title: 'Take out the trash', required: true },
      { id: 'clock-out-pos', title: 'Clock out of POS', required: true },
      { id: 'lock-door', title: 'LOCK the door', required: true }
    ],
  },
};

type ItemState = {
  id: string;
  title: string;
  required?: boolean;
  completedAt?: string;
  initials?: string;
};

type RunState = {
  runId: string;
  location: string;
  type: ChecklistType;
  dateLocalISO: string;
  items: ItemState[];
  startedAt?: string;
  completedAt?: string;
  by?: string;
};

const LS_KEY = 'cenizo-checklist-runs-v1';

function todayLocalISODate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}
function makeRunId(location: string, type: ChecklistType) {
  return location + '__' + type + '__' + todayLocalISODate();
}
function loadRuns(): Record<string, RunState> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveRun(run: RunState) {
  const all = loadRuns(); all[run.runId] = run;
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}
function suggestInitials(from?: string | null) {
  if (!from) return '';
  const user = from.includes('@') ? from.split('@')[0] : from;
  const parts = user.split(/[\.\_\- ]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || user[1] || '')).toUpperCase();
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function toLocal(dtISO?: string) { return dtISO ? new Date(dtISO).toLocaleString() : ''; }
function csvEscape(s: string) { return '\"' + (s || '').replace(/\"/g, '\"\"') + '\"'; }

function buildCSV(run: RunState) {
  const lines: string[] = [];
  lines.push('Location,' + csvEscape(run.location));
  lines.push('Type,' + csvEscape(run.type));
  lines.push('Run ID,' + csvEscape(run.runId));
  lines.push('Started At,' + csvEscape(toLocal(run.startedAt)));
  lines.push('Completed At,' + csvEscape(toLocal(run.completedAt)));
  lines.push('By,' + csvEscape(run.by || ''));
  lines.push('');
  lines.push(['Item Title','Required','Completed At','Initials'].join(','));
  run.items.forEach(i => {
    lines.push([
      csvEscape(i.title),
      i.required ? 'Yes' : 'No',
      csvEscape(toLocal(i.completedAt)),
      csvEscape(i.initials || '')
    ].join(','));
  });
  return lines.join('\n');
}

export default function ChecklistRunner() {
  const [location, setLocation] = useState('Easton Park');
  const [type, setType] = useState<ChecklistType>('opening');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try { const u = await getCurrentUser(); setUserEmail(u?.username ?? null); }
      catch { setUserEmail(null); } finally { setReady(true); }
    })();
  }, []);

  const baseItems = useMemo(() => DEFAULTS[type].items.map(i => ({ ...i })), [type]);

  useEffect(() => {
    if (!ready) return;
    const runId = makeRunId(location, type);
    const existing = loadRuns()[runId];
    if (existing) { setRun(existing); return; }
    const now = new Date().toISOString();
    const newRun: RunState = {
      runId, location, type, dateLocalISO: todayLocalISODate(),
      items: baseItems.map(it => ({ ...it })), startedAt: now, by: userEmail || undefined
    };
    saveRun(newRun); setRun(newRun);
  }, [location, type, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || !run) return <div className="p-6">Loading…</div>;

  const allDone = run.items.every(i => i.completedAt || !i.required);

  function completeItem(id: string, initialsInput?: string) {
    const initials = (initialsInput || suggestInitials(userEmail)).toUpperCase();
    if (!initials) return;
    const now = new Date().toISOString();
    const updated: RunState = { ...run, items: run.items.map(i => i.id === id ? { ...i, completedAt: now, initials } : i) };
    setRun(updated); saveRun(updated);
  }
  function undoItem(id: string) {
    const updated: RunState = { ...run, items: run.items.map(i => i.id === id ? { ...i, completedAt: undefined, initials: undefined } : i) };
    setRun(updated); saveRun(updated);
  }
  function exportCSV(updated: RunState) {
    const csv = buildCSV(updated);
    const file = updated.type + '_' + updated.location.replace(/[^a-z0-9]+/gi,'-') + '_' + new Date().toISOString().slice(0,10) + '.csv';
    download(file, csv, 'text/csv');
  }
  function finalizeRun() {
    const firstTime = !run.completedAt;
    const updated: RunState = { ...run, completedAt: new Date().toISOString() };
    setRun(updated); saveRun(updated);
    if (firstTime) {
      exportCSV(updated); // auto-download once upon first completion
      alert('Checklist saved. CSV downloaded.');
    } else {
      alert('Checklist already completed. Use the Download CSV button if needed.');
    }
  }
  function resetRun() {
    if (!confirm('Clear this run for today?')) return;
    const newRun: RunState = { ...run, items: baseItems.map(it => ({ ...it })), startedAt: new Date().toISOString(), completedAt: undefined };
    setRun(newRun); saveRun(newRun);
  }

  const completeBtnClass =
    (allDone ? 'bg-green-600 hover:bg-green-700 ' : 'bg-gray-400 cursor-not-allowed ') +
    'px-4 py-2 rounded-xl text-white';

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Checklists</h1>
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Location</label>
          <select className="w-full rounded-lg border p-2" value={location} onChange={e => setLocation(e.target.value)}>
            <option>Easton Park</option><option>Del Valle</option><option>Old Lockhart</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select className="w-full rounded-lg border p-2" value={type} onChange={e => setType(e.target.value as ChecklistType)}>
            <option value="opening">Opening</option><option value="closing">Closing</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">User</label>
          <div className="w-full rounded-lg border p-2 bg-gray-50">{userEmail || 'Unknown'}</div>
        </div>
      </div>

      <div className="rounded-2xl border shadow-sm">
        <div className="px-4 py-3 border-b">
          <div className="font-medium">{DEFAULTS[type].name}</div>
          <div className="text-xs text-gray-500">Run ID: {run.runId}</div>
        </div>

        <ul className="divide-y">
          {run.items.map(it => {
            const done = !!it.completedAt;
            return (
              <li key={it.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {it.title} {it.required && <span className="text-red-500">*</span>}
                  </div>
                  {done ? (
                    <div className="text-xs text-green-700">
                      Done by {it.initials} at {new Date(it.completedAt!).toLocaleTimeString()}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">Not completed</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!done ? (
                    <CompleteButton onComplete={initials => completeItem(it.id, initials)} defaultInitials={suggestInitials(userEmail)} />
                  ) : (
                    <button className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={() => undoItem(it.id)}>Undo</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <button className={completeBtnClass} disabled={!allDone} onClick={finalizeRun}>
          Complete checklist
        </button>
        <button className="px-4 py-2 rounded-xl border hover:bg-gray-50" onClick={resetRun}>Reset for today</button>
        <button className="px-4 py-2 rounded-xl border hover:bg-gray-50" onClick={() => exportCSV(run!)}>
          Download CSV
        </button>
      </div>

      <details className="text-sm text-gray-600">
        <summary className="cursor-pointer">Export today&apos;s run JSON</summary>
        <pre className="mt-2 bg-gray-50 p-3 rounded-lg overflow-auto text-xs">{JSON.stringify(run, null, 2)}</pre>
      </details>
    </div>
  );
}

function CompleteButton({ onComplete, defaultInitials }: { onComplete: (initials: string) => void; defaultInitials?: string; }) {
  const [editing, setEditing] = useState(false);
  const [initials, setInitials] = useState((defaultInitials || '').toUpperCase());
  if (!editing) return <button className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => setEditing(true)}>Complete</button>;
  return (
    <div className="flex items-center gap-2">
      <input value={initials} onChange={e => setInitials(e.target.value.toUpperCase())} placeholder="Initials" maxLength={4} className="w-24 rounded-md border p-1.5" autoFocus />
      <button className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700" onClick={() => initials && onComplete(initials)}>Save</button>
      <button className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}
