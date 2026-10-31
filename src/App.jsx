import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { SUBJECTS, DEFAULT_LEVELS } from './config'

const subj = (key) => SUBJECTS.find((s) => s.key === key) || { key, label: key, levels: DEFAULT_LEVELS, color: '#868e96', core: false }
const label = (key) => subj(key).label
const levelLabel = (key, n) => subj(key).levels[n - 1] || `Level ${n}`

/* ---------------- Auth ---------------- */
function Auth() {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg('')
    const { error, data } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
        : await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name } } })
    if (error) setMsg(error.message)
    else if (mode === 'signup' && !data.session) setMsg('Account created. Check your email to confirm, then log in.')
    setBusy(false)
  }

  return (
    <main style={{ maxWidth: 400 }}>
      <form className="card" onSubmit={submit}>
        <h2>Robin Hood Academy</h2>
        <p className="mut">Paathshala volunteer portal</p>
        {mode === 'signup' && (<><label>Full name</label><input required value={f.name} onChange={set('name')} /></>)}
        <label>Email</label><input type="email" required value={f.email} onChange={set('email')} />
        <label>Password</label><input type="password" minLength={6} required value={f.password} onChange={set('password')} />
        {msg && <p className="err">{msg}</p>}
        <p><button disabled={busy}>{mode === 'login' ? 'Log in' : 'Sign up'}</button></p>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'New volunteer? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </main>
  )
}

/* ---------------- Student list ---------------- */
function Students({ onOpen }) {
  const [students, setStudents] = useState([])
  const [logs, setLogs] = useState([])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [nf, setNf] = useState({ name: '', age: '', camp: '' })
  const [err, setErr] = useState('')

  async function load() {
    const s = await supabase.from('students').select('*').order('name')
    const l = await supabase.from('progress_logs')
      .select('student_id,subject,level,topic,next_steps,session_date,created_at')
      .order('session_date', { ascending: false }).order('created_at', { ascending: false })
    if (s.error || l.error) setErr((s.error || l.error).message)
    setStudents(s.data || []); setLogs(l.data || [])
  }
  useEffect(() => { load() }, [])

  const summary = useMemo(() => {
    const m = {}
    logs.forEach((l) => {
      const e = (m[l.student_id] ||= { last: l, levels: {} })
      if (!e.levels[l.subject]) e.levels[l.subject] = l.level
    })
    return m
  }, [logs])

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('students').insert({ name: nf.name, age: nf.age || null, camp: nf.camp })
    if (error) return setErr(error.message)
    setNf({ name: '', age: '', camp: '' }); setAdding(false); load()
  }

  const shown = students.filter((s) => (s.name + (s.camp || '')).toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <div className="card row" style={{ alignItems: 'center' }}>
        <input placeholder="Search student or camp..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 3 }} />
        <button onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ Add student'}</button>
      </div>
      {err && <p className="err">{err}</p>}
      {adding && (
        <form className="card" onSubmit={add}>
          <div className="row">
            <div><label>Name</label><input required value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} /></div>
            <div><label>Age</label><input type="number" min="3" max="25" value={nf.age} onChange={(e) => setNf({ ...nf, age: e.target.value })} /></div>
            <div><label>Labour camp</label><input value={nf.camp} onChange={(e) => setNf({ ...nf, camp: e.target.value })} /></div>
          </div>
          <p><button>Save student</button></p>
        </form>
      )}
      {shown.map((s) => {
        const sm = summary[s.id]
        return (
          <div key={s.id} className="card student" onClick={() => onOpen(s)}>
            <b>{s.name}</b> <span className="mut">{s.age ? `- ${s.age} yrs` : ''} {s.camp ? `- ${s.camp}` : ''}</span>
            <div>
              {sm && Object.entries(sm.levels).map(([key, lv]) => (
                <span className="badge" key={key}>{label(key)}: L{lv}</span>
              ))}
            </div>
            {sm?.last?.next_steps && <div className="next"><b>Next:</b> {sm.last.next_steps}</div>}
            {!sm && <div className="mut">No sessions logged yet</div>}
          </div>
        )
      })}
      {!shown.length && <p className="mut">No students found.</p>}
    </>
  )
}

/* ---------------- Insights ---------------- */
const DAY = 86400000
const dayNum = (d) => Math.floor(Date.parse(d) / DAY)
const weekIdx = (n) => Math.floor((n + 3) / 7)
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

function computeInsights(logs) {
  const t = Math.floor(Date.now() / DAY)
  const keys = [...new Set([...SUBJECTS.map((s) => s.key), ...logs.map((l) => l.subject)])]
  const per = {}
  keys.forEach((key) => {
    const L = logs.filter((l) => l.subject === key) // newest first
    if (!L.length) { per[key] = { count: 0 }; return }
    const u = (l) => l.understanding || 3
    const level = L[0].level
    let atLevel = 0
    for (const l of L) { if (l.level === level) atLevel++; else break }
    const recent = L.slice(0, 3).map(u)
    const prev = L.slice(3, 6).map(u)
    per[key] = {
      count: L.length, level, atLevel,
      daysSince: t - dayNum(L[0].session_date),
      recentAvg: avg(recent),
      trend: prev.length ? avg(recent) - avg(prev) : null,
      last2: L.slice(0, 2).map(u),
      topics: [...new Set(L.map((l) => l.topic.trim()))].slice(0, 12),
      series: [...L].reverse().map((l) => l.level),
    }
  })

  // Subjects that matter for this student: core subjects plus anything already started
  const considered = keys.filter((k) => subj(k).core || per[k].count > 0)
  const started = considered.filter((k) => per[k].count > 0)
  const notStarted = SUBJECTS.filter((s) => !s.core && per[s.key].count === 0).map((s) => s.label)

  let focus = null, reason = ''
  if (!logs.length) {
    reason = 'New student. Start with a quick assessment to find the right level.'
  } else {
    const byCount = [...considered].sort((a, b) => per[a].count - per[b].count)
    const lo = byCount[0], hi = byCount[byCount.length - 1]
    const byGap = [...started].sort((a, b) => per[b].daysSince - per[a].daysSince)
    const byAvg = [...started].sort((a, b) => per[a].recentAvg - per[b].recentAvg)
    if (per[lo].count === 0 || per[hi].count - per[lo].count >= 3) {
      focus = lo
      reason = `${label(lo)} has only ${per[lo].count} session${per[lo].count === 1 ? '' : 's'} versus ${per[hi].count} for ${label(hi)}. Give it more time today.`
    } else if (started.length > 1 && per[byGap[0]].daysSince - per[byGap[byGap.length - 1]].daysSince >= 14) {
      focus = byGap[0]
      reason = `${label(focus)} was last taught ${per[focus].daysSince} days ago, much longer than the other subjects.`
    } else if (started.length > 1 && per[byAvg[byAvg.length - 1]].recentAvg - per[byAvg[0]].recentAvg >= 1) {
      focus = byAvg[0]
      reason = `Recent understanding in ${label(focus)} (${per[focus].recentAvg.toFixed(1)} / 5) is the lowest among the subjects taught.`
    } else {
      reason = 'Subjects look balanced. Continue with whichever the student prefers today.'
    }
  }

  const weeks = new Set(logs.filter((l) => t - dayNum(l.session_date) <= 56).map((l) => weekIdx(dayNum(l.session_date))))
  return {
    per, considered, notStarted, focus, reason,
    total: logs.length,
    volunteers: new Set(logs.map((l) => l.volunteer_id)).size,
    activeWeeks: weeks.size,
    lastGap: logs.length ? t - dayNum(logs[0].session_date) : null,
  }
}

function tipsFor(key, p) {
  const name = label(key)
  if (!p.count) return [{ kind: 'warn', text: `${name} has not been started. Begin with a 5-minute assessment to find the right level.` }]
  const T = []
  if (p.daysSince > 21) T.push({ kind: 'warn', text: `${name} was not taught for ${p.daysSince} days. Revise the last topic before moving ahead.` })
  if (p.count >= 2 && p.last2.every((x) => x <= 2)) T.push({ kind: 'warn', text: `Struggled with ${name} in the last two sessions. Go back a step and use real-life examples.` })
  if (p.atLevel >= 4 && p.recentAvg < 4) T.push({ kind: 'warn', text: `Stuck at Level ${p.level} for ${p.atLevel} sessions. Try a different method: games, drawing, or pairing with another student.` })
  if (p.count >= 2 && p.last2.every((x) => x >= 4) && p.level < 5) T.push({ kind: 'good', text: `Understanding is strong. Ready to move up to Level ${p.level + 1}.` })
  if (p.level === 5 && p.recentAvg >= 4) T.push({ kind: 'good', text: 'Top level reached. Give challenge problems or let the student help others.' })
  if (p.trend !== null && p.trend >= 0.7) T.push({ kind: 'good', text: `Improving: understanding is up ${p.trend.toFixed(1)} points over recent sessions.` })
  if (p.trend !== null && p.trend <= -0.7) T.push({ kind: 'warn', text: `Declining: understanding is down ${Math.abs(p.trend).toFixed(1)} points recently. Check for gaps or attendance issues.` })
  if (!T.length) T.push({ kind: 'info', text: `${name} is on track. Continue from the last topic.` })
  return T
}

function Spark({ series, color }) {
  if (!series || series.length < 2) return <span className="mut">Needs 2+ sessions</span>
  const w = 160, h = 40
  const pts = series.slice(-12).map((v, i, a) => `${(i / (a.length - 1)) * (w - 8) + 4},${h - 4 - ((v - 1) / 4) * (h - 8)}`).join(' ')
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" /></svg>
}

function Pie({ slices }) {
  const total = slices.reduce((a, x) => a + x.value, 0)
  const live = slices.filter((x) => x.value > 0)
  const c = 70, r = 62
  if (!live.length) return <svg width="140" height="140"><circle cx={c} cy={c} r={r} fill="#e5e7eb" /></svg>
  if (live.length === 1) return <svg width="140" height="140"><circle cx={c} cy={c} r={r} fill={live[0].color}><title>{live[0].label}: {live[0].value}</title></circle></svg>
  let a = -Math.PI / 2
  return (
    <svg width="140" height="140">
      {live.map((x) => {
        const ang = (x.value / total) * 2 * Math.PI
        const x1 = c + r * Math.cos(a), y1 = c + r * Math.sin(a)
        a += ang
        const x2 = c + r * Math.cos(a), y2 = c + r * Math.sin(a)
        return (
          <path key={x.key} d={`M${c},${c} L${x1},${y1} A${r},${r} 0 ${ang > Math.PI ? 1 : 0} 1 ${x2},${y2} Z`} fill={x.color} stroke="#fff" strokeWidth="2">
            <title>{x.label}: {x.value}</title>
          </path>
        )
      })}
    </svg>
  )
}

function Insights({ logs, onLog }) {
  const ins = useMemo(() => computeInsights(logs), [logs])
  return (
    <>
      <div className="card focus">
        <h3>Suggested focus for today: {ins.focus ? label(ins.focus) : logs.length ? 'Balanced' : 'Assessment'}</h3>
        <div>{ins.reason}</div>
        <p><button type="button" onClick={onLog}>Log today's session</button></p>
      </div>

      <div className="card">
        <h3>Teaching balance</h3>
        <div className="row" style={{ alignItems: 'center' }}>
          <div style={{ flex: '0 0 150px', minWidth: 150 }}>
            <Pie slices={Object.keys(ins.per).map((k) => ({ key: k, label: label(k), color: subj(k).color, value: ins.per[k].count }))} />
          </div>
          <div style={{ flex: 3 }}>
            {Object.keys(ins.per).map((k) => (
              <div key={k} style={{ margin: '4px 0' }}>
                <span className="dot" style={{ background: subj(k).color }} />
                {label(k)}: <b>{ins.per[k].count}</b> session{ins.per[k].count === 1 ? '' : 's'}
                {ins.total > 0 && ins.per[k].count > 0 ? <span className="mut"> ({Math.round((ins.per[k].count / ins.total) * 100)}%)</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {ins.considered.map((key) => {
        const p = ins.per[key]
        return (
          <div className="card" key={key}>
            <h3>{label(key)}</h3>
            {p.count > 0 && (
              <div className="row" style={{ alignItems: 'center' }}>
                <div><div className="mut">Level now</div><b>{levelLabel(key, p.level)}</b></div>
                <div><div className="mut">Last taught</div><b>{p.daysSince === 0 ? 'Today' : `${p.daysSince} days ago`}</b></div>
                <div><div className="mut">Avg. understanding (last 3)</div><b>{p.recentAvg.toFixed(1)} / 5</b></div>
                <div><div className="mut">Level trend</div><Spark series={p.series} color={subj(key).color} /></div>
              </div>
            )}
            {tipsFor(key, p).map((t, i) => <div key={i} className={`tip ${t.kind}`}>{t.text}</div>)}
            {p.count > 0 && (
              <>
                <div className="mut" style={{ marginTop: 10 }}>Already covered (avoid repeating):</div>
                <div>{p.topics.map((t) => <span className="badge" key={t}>{t}</span>)}</div>
              </>
            )}
          </div>
        )
      })}

      <div className="card">
        <h3>Attendance and continuity</h3>
        <div className="row">
          <div><div className="mut">Total sessions</div><b>{ins.total}</b></div>
          <div><div className="mut">Active weeks (last 8)</div><b>{ins.activeWeeks} / 8</b></div>
          <div><div className="mut">Different volunteers</div><b>{ins.volunteers}</b></div>
        </div>
        {ins.lastGap !== null && ins.lastGap > 21 && <div className="tip warn">No session for {ins.lastGap} days. Re-engage warmly and revise basics first.</div>}
        {ins.volunteers >= 3 && <div className="tip info">Taught by {ins.volunteers} different volunteers. Read the history notes before starting so the student feels continuity.</div>}
      </div>
    </>
  )
}

/* ---------------- Student detail ---------------- */
function StudentDetail({ student, onBack }) {
  const [logs, setLogs] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const blank = { subject: SUBJECTS[0].key, topic: '', level: 1, understanding: 3, notes: '', next_steps: '', session_date: new Date().toISOString().slice(0, 10) }
  const [f, setF] = useState(blank)
  const [tab, setTab] = useState('insights')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function load() {
    const { data, error } = await supabase.from('progress_logs')
      .select('*, profiles(full_name)').eq('student_id', student.id)
      .order('session_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) setErr(error.message)
    setLogs(data || [])
  }
  useEffect(() => { load() }, [student.id])

  async function save(e) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.from('progress_logs').insert({
      student_id: student.id, subject: f.subject, topic: f.topic,
      level: +f.level, understanding: +f.understanding,
      notes: f.notes, next_steps: f.next_steps, session_date: f.session_date,
    })
    if (error) setErr(error.message); else { setF(blank); load(); setTab('history') }
    setBusy(false)
  }

  const current = {}
  logs.forEach((l) => { if (!current[l.subject]) current[l.subject] = l })
  const shownSubjects = [...new Set([...SUBJECTS.filter((s) => s.core).map((s) => s.key), ...Object.keys(current)])]

  return (
    <>
      <button className="link" onClick={onBack}>&larr; All students</button>
      <div className="card" style={{ marginTop: 10 }}>
        <h2>{student.name}</h2>
        <div className="mut">{student.age ? `${student.age} yrs` : ''} {student.camp ? `- ${student.camp}` : ''}</div>
        {shownSubjects.map((key) => (
          <div key={key} style={{ marginTop: 10 }}>
            <b>{label(key)}:</b> {current[key] ? levelLabel(key, current[key].level) : 'Not started'}
            {current[key]?.next_steps && <div className="next"><b>Next volunteer, please:</b> {current[key].next_steps}</div>}
          </div>
        ))}
      </div>

      <div className="tabs">
        {[['insights', 'Insights'], ['log', 'Log session'], ['history', 'History']].map(([k, text]) => (
          <button type="button" key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{text}</button>
        ))}
      </div>

      {tab === 'insights' && <Insights logs={logs} onLog={() => setTab('log')} />}

      {tab === 'log' && (
        <form className="card" onSubmit={save}>
          <h3>Log today's session</h3>
          <div className="row">
            <div><label>Date</label><input type="date" required value={f.session_date} onChange={set('session_date')} /></div>
            <div><label>Subject</label>
              <select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value, level: 1 })}>
                {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select></div>
          </div>
          <label>Topic taught</label><input required placeholder="e.g. Tables of 2 and 3" value={f.topic} onChange={set('topic')} />
          <div className="row">
            <div><label>Student's level now</label>
              <select value={f.level} onChange={set('level')}>
                {subj(f.subject).levels.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
              </select></div>
            <div><label>Understanding today</label>
              <select value={f.understanding} onChange={set('understanding')}>
                <option value={1}>1 - Struggled</option><option value={2}>2 - Needs practice</option>
                <option value={3}>3 - Okay</option><option value={4}>4 - Good</option><option value={5}>5 - Mastered</option>
              </select></div>
          </div>
          <label>Observations</label><textarea value={f.notes} onChange={set('notes')} placeholder="What went well, difficulties, behaviour..." />
          <label>Next steps for the next volunteer</label><textarea required value={f.next_steps} onChange={set('next_steps')} placeholder="What should the next volunteer teach or revise?" />
          {err && <p className="err">{err}</p>}
          <p><button disabled={busy}>Save session</button></p>
        </form>
      )}

      {tab === 'history' && (
        <>
          <h3>History</h3>
          {logs.map((l) => (
            <div key={l.id} className="card">
              <b>{label(l.subject)}</b> - {l.topic} <span className="badge">L{l.level}</span><span className="badge">Understanding {l.understanding}/5</span>
              <div className="mut">{l.session_date} - by {l.profiles?.full_name || 'Volunteer'}</div>
              {l.notes && <p>{l.notes}</p>}
              {l.next_steps && <div className="next"><b>Next:</b> {l.next_steps}</div>}
            </div>
          ))}
          {!logs.length && <p className="mut">No sessions yet. Be the first to log one!</p>}
        </>
      )}
    </>
  )
}

/* ---------------- App ---------------- */
export default function App() {
  const [session, setSession] = useState(undefined)
  const [student, setStudent] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <main>Loading...</main>
  if (!session) return <Auth />

  return (
    <>
      <header>
        <h1>RHA Paathshala LMS</h1>
        <span>{session.user.user_metadata?.full_name || session.user.email}{' '}
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Log out</button></span>
      </header>
      <main>
        {student ? <StudentDetail student={student} onBack={() => setStudent(null)} /> : <Students onOpen={setStudent} />}
      </main>
    </>
  )
}
