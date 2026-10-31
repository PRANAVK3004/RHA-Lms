import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const LEVELS = {
  english: ['1 – Alphabets & sounds', '2 – Simple words', '3 – Short sentences', '4 – Reading paragraphs', '5 – Conversation & writing'],
  math: ['1 – Numbers 1–100', '2 – Addition & subtraction', '3 – Multiplication tables', '4 – Division', '5 – Fractions & word problems'],
}
const SUBJECTS = ['english', 'math']
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

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
        <h2>🏹 Roobin Hood Academy</h2>
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
        <input placeholder="Search student or camp…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 3 }} />
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
            <b>{s.name}</b> <span className="mut">{s.age ? `· ${s.age} yrs` : ''} {s.camp ? `· ${s.camp}` : ''}</span>
            <div>
              {SUBJECTS.map((sub) => (
                <span className="badge" key={sub}>{cap(sub)}: {sm?.levels[sub] ? `L${sm.levels[sub]}` : 'not started'}</span>
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

/* ---------------- Student detail ---------------- */
function StudentDetail({ student, onBack }) {
  const [logs, setLogs] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const blank = { subject: 'english', topic: '', level: 1, understanding: 3, notes: '', next_steps: '', session_date: new Date().toISOString().slice(0, 10) }
  const [f, setF] = useState(blank)
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
    if (error) setErr(error.message); else { setF(blank); load() }
    setBusy(false)
  }

  const current = {}
  logs.forEach((l) => { if (!current[l.subject]) current[l.subject] = l })

  return (
    <>
      <button className="link" onClick={onBack}>← All students</button>
      <div className="card" style={{ marginTop: 10 }}>
        <h2>{student.name}</h2>
        <div className="mut">{student.age ? `${student.age} yrs` : ''} {student.camp ? `· ${student.camp}` : ''}</div>
        {SUBJECTS.map((sub) => (
          <div key={sub} style={{ marginTop: 10 }}>
            <b>{cap(sub)}:</b> {current[sub] ? LEVELS[sub][current[sub].level - 1] : 'Not started'}
            {current[sub]?.next_steps && <div className="next"><b>Next volunteer, please:</b> {current[sub].next_steps}</div>}
          </div>
        ))}
      </div>

      <form className="card" onSubmit={save}>
        <h3>Log today's session</h3>
        <div className="row">
          <div><label>Date</label><input type="date" required value={f.session_date} onChange={set('session_date')} /></div>
          <div><label>Subject</label>
            <select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value, level: 1 })}>
              {SUBJECTS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select></div>
        </div>
        <label>Topic taught</label><input required placeholder="e.g. Tables of 2 and 3" value={f.topic} onChange={set('topic')} />
        <div className="row">
          <div><label>Student's level now</label>
            <select value={f.level} onChange={set('level')}>
              {LEVELS[f.subject].map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
            </select></div>
          <div><label>Understanding today</label>
            <select value={f.understanding} onChange={set('understanding')}>
              <option value={1}>1 – Struggled</option><option value={2}>2 – Needs practice</option>
              <option value={3}>3 – Okay</option><option value={4}>4 – Good</option><option value={5}>5 – Mastered</option>
            </select></div>
        </div>
        <label>Observations</label><textarea value={f.notes} onChange={set('notes')} placeholder="What went well, difficulties, behaviour…" />
        <label>Next steps for the next volunteer</label><textarea required value={f.next_steps} onChange={set('next_steps')} placeholder="What should the next volunteer teach / revise?" />
        {err && <p className="err">{err}</p>}
        <p><button disabled={busy}>Save session</button></p>
      </form>

      <h3>History</h3>
      {logs.map((l) => (
        <div key={l.id} className="card">
          <b>{cap(l.subject)}</b> – {l.topic} <span className="badge">L{l.level}</span><span className="badge">Understanding {l.understanding}/5</span>
          <div className="mut">{l.session_date} · by {l.profiles?.full_name || 'Volunteer'}</div>
          {l.notes && <p>{l.notes}</p>}
          {l.next_steps && <div className="next"><b>Next:</b> {l.next_steps}</div>}
        </div>
      ))}
      {!logs.length && <p className="mut">No sessions yet. Be the first to log one!</p>}
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

  if (session === undefined) return <main>Loading…</main>
  if (!session) return <Auth />

  return (
    <>
      <header>
        <h1>🏹 RHA Paathshala LMS</h1>
        <span>{session.user.user_metadata?.full_name || session.user.email}{' '}
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Log out</button></span>
      </header>
      <main>
        {student ? <StudentDetail student={student} onBack={() => setStudent(null)} /> : <Students onOpen={setStudent} />}
      </main>
    </>
  )
}
