import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ─── Helpers ───────────────────────────────────────────────────────────────

const getDaysLeft = (preparedAt, shelfLifeDays) => {
  const expiry = new Date(preparedAt)
  expiry.setDate(expiry.getDate() + shelfLifeDays)
  return Math.ceil((expiry - new Date()) / 86400000)
}

const getStatus = (d) => d <= 0 ? 'red' : d === 1 ? 'yellow' : 'green'

const STATUS_COLOR = { red: '#ff3b30', yellow: '#ff9500', green: '#34c759' }

const sortItems = (items) => {
  const p = { red: 0, yellow: 1, green: 2 }
  return [...items].sort((a, b) => {
    const da = getDaysLeft(a.prepared_at, a.shelf_life_days)
    const db = getDaysLeft(b.prepared_at, b.shelf_life_days)
    const sa = getStatus(da), sb = getStatus(db)
    if (p[sa] !== p[sb]) return p[sa] - p[sb]
    return da - db
  })
}

const fmtDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const fmtExpiry = (preparedAt, shelfLifeDays) => {
  const e = new Date(preparedAt)
  e.setDate(e.getDate() + shelfLifeDays)
  return e.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

const CAN_UPDATE = ['super_admin', 'head_chef', 'head_manager', 'cook']
const CAN_EDIT   = ['super_admin', 'head_chef', 'head_manager']

const ROLE_LABEL = {
  super_admin:  'Super Admin',
  head_chef:    'Head Chef',
  head_manager: 'Head Manager',
  cook:         'Cook',
  bartender:    'Bartender',
}

// ─── Theme ─────────────────────────────────────────────────────────────────

const T = (dark) => ({
  bg:          dark ? '#111111' : '#f2f2f7',
  card:        dark ? '#1c1c1e' : '#ffffff',
  header:      dark ? '#1c1c1e' : '#ffffff',
  text:        dark ? '#ffffff' : '#1a1a1a',
  sub:         dark ? '#8e8e93' : '#6d6d72',
  border:      dark ? '#2c2c2e' : '#e5e5ea',
  tabBg:       dark ? '#2c2c2e' : '#e5e5ea',
  tabActive:   dark ? '#3a3a3c' : '#ffffff',
  input:       dark ? '#2c2c2e' : '#f2f2f7',
  inputBorder: dark ? '#3a3a3c' : '#dddddd',
})

// ─── Modal wrapper ─────────────────────────────────────────────────────────

const Modal = ({ dark, onClose, children }) => {
  const t = T(dark)
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.card, borderRadius: 20, padding: 24,
        width: '100%', maxWidth: 480,
        boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── Prep Row ──────────────────────────────────────────────────────────────

const PrepRow = ({ item, role, dark, onUpdateDate, onEdit, onDelete }) => {
  const t = T(dark)
  const daysLeft = getDaysLeft(item.prepared_at, item.shelf_life_days)
  const status   = getStatus(daysLeft)
  const color    = STATUS_COLOR[status]
  const canUpd   = CAN_UPDATE.includes(role)
  const canEd    = CAN_EDIT.includes(role)

  const startX = useRef(null)
  const [offset, setOffset] = useState(0)
  const THRESH = 80

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX }
  const onTouchMove  = (e) => {
    if (startX.current === null) return
    const dx = e.touches[0].clientX - startX.current
    setOffset(Math.max(-THRESH * 1.2, Math.min(THRESH * 1.2, dx)))
  }
  const onTouchEnd = () => {
    if (canEd) {
      if (offset >= THRESH)  onEdit(item)
      if (offset <= -THRESH) onDelete(item)
    }
    setOffset(0)
    startX.current = null
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', marginBottom: 1 }}>
      {canEd && (
        <>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: THRESH,
            background: '#34c759', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 0,
          }}>
            <span style={{ fontSize: 22 }}>✏️</span>
          </div>
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: THRESH,
            background: '#ff3b30', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 0,
          }}>
            <span style={{ fontSize: 22 }}>🗑️</span>
          </div>
        </>
      )}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          background: t.card,
          transform: `translateX(${offset}px)`,
          transition: offset === 0 ? 'transform 0.3s ease' : 'none',
          display: 'flex', alignItems: 'center',
          padding: '14px 16px', position: 'relative', zIndex: 1,
        }}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, marginRight: 12, flexShrink: 0,
        }} />

        <div
          style={{ flex: 1, cursor: canUpd ? 'pointer' : 'default' }}
          onClick={() => canUpd && onUpdateDate(item)}
        >
          <div style={{ fontSize: 16, fontWeight: 500, color: t.text }}>{item.name}</div>
          <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>
            {daysLeft <= 0
              ? '⚠️ Expired!'
              : daysLeft === 1
              ? '⚠️ Expires tomorrow'
              : `Expires ${fmtExpiry(item.prepared_at, item.shelf_life_days)}`}
            {' · '}{item.shelf_life_days}d shelf life
          </div>
        </div>

        <div style={{
          background: color + '22', color, borderRadius: 8,
          padding: '4px 9px', fontSize: 13, fontWeight: 700, marginLeft: 8,
        }}>
          {daysLeft <= 0 ? '0d' : `${daysLeft}d`}
        </div>
      </div>
    </div>
  )
}

// ─── Login Screen ──────────────────────────────────────────────────────────

const LoginScreen = ({ dark }) => {
  const t = T(dark)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [name, setName]           = useState('')
  const [isSignUp, setIsSignUp]   = useState(false)
  const [isForgot, setIsForgot]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [message, setMessage]     = useState('')
  const [showPass, setShowPass]   = useState(false)

  const inp = {
    width: '100%', padding: '12px 14px',
    background: t.input, border: `1px solid ${t.inputBorder}`,
    borderRadius: 10, fontSize: 16, color: t.text,
    marginBottom: 12, boxSizing: 'border-box', outline: 'none',
  }

  const handleForgot = async () => {
    if (!email) { setError('Enter your email above'); return }
    setLoading(true); setError(''); setMessage('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://misetag.vercel.app',
    })
    if (err) setError(err.message)
    else setMessage('✅ Check your email for a reset link!')
    setLoading(false)
  }

  const handleAuth = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return }
    setLoading(true); setError(''); setMessage('')

    if (isSignUp) {
      const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (signUpErr) { setError(signUpErr.message) }
      else if (data.user) {
        const { error: profErr } = await supabase.from('profiles').insert({
          id: data.user.id,
          name: name.trim() || email.split('@')[0],
          role: 'bartender',
        })
        if (profErr) setError(profErr.message)
        else setMessage('✅ Account created! You can sign in now.')
      }
    } else {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) setError(signInErr.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: t.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          width: 76, height: 76, borderRadius: 20,
          background: '#1a1a1a', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          <span style={{ color: '#fff', fontSize: 30, fontWeight: 800 }}>M</span>
        </div>
        <h1 style={{ color: t.text, fontSize: 28, fontWeight: 700, margin: 0 }}>MiseTag</h1>
        <p style={{ color: t.sub, fontSize: 14, margin: '4px 0 0' }}>Kitchen Prep Tracker</p>
      </div>

      <div style={{
        background: t.card, borderRadius: 18, padding: 24,
        width: '100%', maxWidth: 360,
        boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
      }}>
        {isForgot ? (
          <>
            <h3 style={{ color: t.text, fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Reset Password</h3>
            <p style={{ color: t.sub, fontSize: 13, margin: '0 0 16px' }}>We'll send a reset link to your email</p>
            <input type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} style={inp} />
            {error   && <p style={{ color: '#ff3b30', fontSize: 13, marginBottom: 10 }}>{error}</p>}
            {message && <p style={{ color: '#34c759', fontSize: 13, marginBottom: 10 }}>{message}</p>}
            <button onClick={handleForgot} disabled={loading} style={{
              width: '100%', padding: 14,
              background: loading ? '#999' : '#1a1a1a', color: '#fff',
              border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            }}>
              {loading ? '...' : 'Send Reset Link'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16, color: t.sub, fontSize: 14 }}>
              <span onClick={() => { setIsForgot(false); setError(''); setMessage('') }}
                style={{ color: '#007aff', cursor: 'pointer', fontWeight: 500 }}>
                Back to Sign In
              </span>
            </p>
          </>
        ) : (
          <>
            {isSignUp && (
              <input placeholder="Your name" value={name}
                onChange={e => setName(e.target.value)} style={inp} />
            )}
            <input type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} style={inp} />

            {/* Password field with eye toggle */}
            <div style={{ position: 'relative', marginBottom: 4 }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                style={{ ...inp, marginBottom: 0, paddingRight: 46 }}
              />
              <button onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, padding: 4, color: t.sub,
              }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>

            {!isSignUp && (
              <p style={{ textAlign: 'right', margin: '6px 0 12px' }}>
                <span onClick={() => { setIsForgot(true); setError(''); setMessage('') }}
                  style={{ color: '#007aff', fontSize: 13, cursor: 'pointer' }}>
                  Forgot password?
                </span>
              </p>
            )}

            {error   && <p style={{ color: '#ff3b30', fontSize: 13, marginBottom: 10 }}>{error}</p>}
            {message && <p style={{ color: '#34c759', fontSize: 13, marginBottom: 10 }}>{message}</p>}

            <button onClick={handleAuth} disabled={loading} style={{
              width: '100%', padding: 14,
              background: loading ? '#999' : '#1a1a1a', color: '#fff',
              border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              marginBottom: isSignUp ? 0 : 4,
            }}>
              {loading ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 16, color: t.sub, fontSize: 14 }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <span onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
                style={{ color: '#007aff', cursor: 'pointer', fontWeight: 500 }}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession]       = useState(null)
  const [profile, setProfile]       = useState(null)
  const [appLoading, setAppLoading] = useState(true)
  const [prepItems, setPrepItems]   = useState([])
  const [dark, setDark]             = useState(false)
  const [tab, setTab]               = useState('dinner')
  const [category, setCategory]     = useState('all')
  const [activityLog, setActivityLog] = useState([])
  const [showLog, setShowLog]       = useState(false)

  // Modals
  const [updateModal, setUpdateModal] = useState(null)
  const [editModal, setEditModal]     = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [addModal, setAddModal]       = useState(false)

  // Form state
  const [formName, setFormName]           = useState('')
  const [formCategory, setFormCategory]   = useState('prepared')
  const [formShelfLife, setFormShelfLife] = useState('4')
  const [formSection, setFormSection]     = useState('dinner')

  const t = T(dark)

  // ── Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAppLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Fetch profile when session changes
  useEffect(() => {
    if (session?.user) fetchProfile(session.user.id)
    else { setProfile(null); setPrepItems([]) }
  }, [session])

  // ── Real-time subscription once profile is ready
  useEffect(() => {
    if (!profile) return
    fetchPrepItems()
    const channel = supabase.channel('prep-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prep_items' }, fetchPrepItems)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data || null)
  }

  const fetchPrepItems = async () => {
    const { data } = await supabase.from('prep_items').select('*')
    if (data) setPrepItems(data)
  }

  const logActivity = async (action, itemName) => {
    await supabase.from('activity_log').insert({
      action, item_name: itemName, performed_by: profile?.name || 'Unknown',
    })
  }

  // ── CRUD handlers
  const handleUpdateDate = async (item) => {
    await supabase.from('prep_items').update({
      prepared_at: new Date().toISOString(),
      updated_by_name: profile?.name,
    }).eq('id', item.id)
    await logActivity('updated', item.name)
    setUpdateModal(null)
  }

  const handleEdit = async () => {
    await supabase.from('prep_items').update({
      name: formName.trim(),
      category: formCategory,
      shelf_life_days: parseInt(formShelfLife),
    }).eq('id', editModal.id)
    await logActivity('edited', formName.trim())
    setEditModal(null)
  }

  const handleDelete = async () => {
    await supabase.from('prep_items').delete().eq('id', deleteModal.id)
    await logActivity('deleted', deleteModal.name)
    setDeleteModal(null)
  }

  const handleAdd = async () => {
    if (!formName.trim()) return
    await supabase.from('prep_items').insert({
      name: formName.trim(),
      category: formCategory,
      shelf_life_days: parseInt(formShelfLife),
      menu_section: formSection,
      updated_by_name: profile?.name,
    })
    await logActivity('added', formName.trim())
    setAddModal(false)
    setFormName(''); setFormCategory('prepared'); setFormShelfLife('4')
  }

  const openActivityLog = async () => {
    const { data } = await supabase.from('activity_log').select('*')
      .order('performed_at', { ascending: false }).limit(60)
    if (data) setActivityLog(data)
    setShowLog(true)
  }

  // ── Filtered + sorted items
  const visible = sortItems(
    prepItems.filter(i =>
      i.menu_section === tab &&
      (category === 'all' || i.category === category)
    )
  )

  const canEdit  = CAN_EDIT.includes(profile?.role)
  const canSeeLog = ['super_admin', 'head_chef', 'head_manager'].includes(profile?.role)

  // Shared input style
  const inp = (extra = {}) => ({
    width: '100%', padding: '12px 14px',
    background: t.input, border: `1px solid ${t.inputBorder}`,
    borderRadius: 10, fontSize: 15, color: t.text,
    marginBottom: 12, boxSizing: 'border-box', outline: 'none', ...extra,
  })

  // ── Render ────────────────────────────────────────────────────────────────

  if (appLoading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: '#f2f2f7',
    }}>
      <div style={{ fontSize: 16, color: '#1a1a1a' }}>Loading...</div>
    </div>
  )

  if (!session) return <LoginScreen dark={dark} />

  if (!profile) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: t.bg, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: t.text, marginBottom: 8 }}>
        Setting up your account...
      </div>
      <div style={{ fontSize: 14, color: t.sub, marginBottom: 24 }}>
        Please confirm your email, then refresh this page.
      </div>
      <button onClick={() => supabase.auth.signOut()} style={{
        padding: '10px 20px', background: t.tabBg, border: 'none',
        borderRadius: 10, color: t.text, fontSize: 14, cursor: 'pointer',
      }}>Sign Out</button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: t.bg, maxWidth: 480, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: t.header, padding: '16px 16px 0',
        borderBottom: `1px solid ${t.border}`,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: '#1a1a1a', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginRight: 10,
          }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>M</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>MiseTag</div>
            <div style={{ fontSize: 11, color: t.sub }}>
              {profile.name} · {ROLE_LABEL[profile.role]}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {canSeeLog && (
              <button onClick={openActivityLog} style={{
                background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 20, padding: 4,
              }}>🕐</button>
            )}
            <button onClick={() => setDark(!dark)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(90deg, #1a1a1a 50%, #f2f2f7 50%)',
                border: '1.5px solid #aaa',
              }} />
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{
              background: 'none', border: `1px solid ${t.border}`,
              color: t.sub, borderRadius: 8,
              padding: '4px 10px', fontSize: 12, cursor: 'pointer',
            }}>Out</button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4,
          background: t.tabBg, borderRadius: 10, padding: 3, marginBottom: 10,
        }}>
          {['dinner', 'brunch', 'lunch'].map(s => (
            <button key={s} onClick={() => setTab(s)} style={{
              flex: 1, padding: '7px 0',
              background: tab === s ? t.tabActive : 'transparent',
              border: 'none', borderRadius: 8,
              color: tab === s ? t.text : t.sub,
              fontWeight: tab === s ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
              textTransform: 'capitalize',
              boxShadow: tab === s ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>{s}</button>
          ))}
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 10, overflowX: 'auto' }}>
          {['all', 'prepared', 'sauces'].map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: '5px 14px',
              background: category === c ? '#1a1a1a' : t.tabBg,
              color: category === c ? '#fff' : t.sub,
              border: 'none', borderRadius: 20,
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Status Summary Cards ───────────────────────────────────────── */}
      {(() => {
        const expired  = visible.filter(i => getDaysLeft(i.prepared_at, i.shelf_life_days) <= 0).length
        const expiring = visible.filter(i => getDaysLeft(i.prepared_at, i.shelf_life_days) === 1).length
        const fresh    = visible.filter(i => getDaysLeft(i.prepared_at, i.shelf_life_days) >= 2).length
        const cards = [
          { label: 'Expired',  count: expired,  color: '#ff3b30', bg: '#ff3b3015' },
          { label: 'Expiring', count: expiring, color: '#ff9500', bg: '#ff950015' },
          { label: 'Fresh',    count: fresh,    color: '#34c759', bg: '#34c75915' },
        ]
        return (
          <div style={{ display: 'flex', gap: 10, padding: '14px 14px 4px' }}>
            {cards.map(({ label, count, color, bg }) => (
              <div key={label} style={{
                flex: 1, background: bg,
                border: `1.5px solid ${color}33`,
                borderRadius: 14, padding: '12px 8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color, marginTop: 4, opacity: 0.85 }}>{label}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── List ───────────────────────────────────────────────────────── */}
      <div style={{ paddingBottom: 100 }}>
        {visible.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '70px 20px',
            color: t.sub, fontSize: 15,
          }}>
            No prep items here yet
            {canEdit && <div style={{ marginTop: 8, fontSize: 13 }}>Tap + to add</div>}
          </div>
        ) : (
          visible.map(item => (
            <PrepRow
              key={item.id}
              item={item}
              role={profile.role}
              dark={dark}
              onUpdateDate={() => setUpdateModal(item)}
              onEdit={() => {
                setFormName(item.name)
                setFormCategory(item.category)
                setFormShelfLife(String(item.shelf_life_days))
                setEditModal(item)
              }}
              onDelete={() => setDeleteModal(item)}
            />
          ))
        )}
      </div>

      {/* ── FAB ────────────────────────────────────────────────────────── */}
      {canEdit && (
        <button
          onClick={() => { setFormName(''); setFormSection(tab); setAddModal(true) }}
          style={{
            position: 'fixed', bottom: 32, right: 20,
            width: 54, height: 54, borderRadius: '50%',
            background: '#1a1a1a', color: '#fff',
            border: 'none', fontSize: 30, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
      )}

      {/* ── UPDATE DATE modal ──────────────────────────────────────────── */}
      {updateModal && (
        <Modal dark={dark} onClose={() => setUpdateModal(null)}>
          <h3 style={{ color: t.text, margin: '0 0 6px', fontSize: 18 }}>Update Date</h3>
          <p style={{ color: t.sub, fontSize: 14, margin: '0 0 18px' }}>{updateModal.name}</p>
          <div style={{
            background: t.input, borderRadius: 10,
            padding: '12px 14px', fontSize: 15, color: t.text, marginBottom: 20,
          }}>
            📅 {fmtDate(new Date().toISOString())}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setUpdateModal(null)} style={{
              flex: 1, padding: 13, background: t.tabBg, border: 'none',
              borderRadius: 12, color: t.text, fontSize: 15, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={() => handleUpdateDate(updateModal)} style={{
              flex: 1, padding: 13, background: '#34c759', border: 'none',
              borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>Save</button>
          </div>
        </Modal>
      )}

      {/* ── EDIT modal ─────────────────────────────────────────────────── */}
      {editModal && (
        <Modal dark={dark} onClose={() => setEditModal(null)}>
          <h3 style={{ color: t.text, margin: '0 0 16px', fontSize: 18 }}>Edit Item</h3>
          <input autoFocus value={formName} onChange={e => setFormName(e.target.value)}
            style={inp({ border: '1.5px solid #34c759' })} />
          <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
            style={inp()}>
            <option value="prepared">Prepared</option>
            <option value="sauces">Sauces</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ color: t.text, fontSize: 14, flex: 1 }}>Shelf life (days):</span>
            <input type="number" min="1" max="30" value={formShelfLife}
              onChange={e => setFormShelfLife(e.target.value)}
              style={{ ...inp(), width: 72, marginBottom: 0 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditModal(null)} style={{
              flex: 1, padding: 13, background: t.tabBg, border: 'none',
              borderRadius: 12, color: t.text, fontSize: 15, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleEdit} style={{
              flex: 1, padding: 13, background: '#34c759', border: 'none',
              borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>Save</button>
          </div>
        </Modal>
      )}

      {/* ── DELETE modal ───────────────────────────────────────────────── */}
      {deleteModal && (
        <Modal dark={dark} onClose={() => setDeleteModal(null)}>
          <h3 style={{ color: t.text, margin: '0 0 8px', fontSize: 18 }}>Delete Item?</h3>
          <p style={{ color: t.sub, fontSize: 14, margin: '0 0 20px' }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: t.text }}>{deleteModal.name}</strong>?
            This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDeleteModal(null)} style={{
              flex: 1, padding: 13, background: t.tabBg, border: 'none',
              borderRadius: 12, color: t.text, fontSize: 15, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleDelete} style={{
              flex: 1, padding: 13, background: '#ff3b30', border: 'none',
              borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>Delete</button>
          </div>
        </Modal>
      )}

      {/* ── ADD modal ──────────────────────────────────────────────────── */}
      {addModal && (
        <Modal dark={dark} onClose={() => setAddModal(false)}>
          <h3 style={{ color: t.text, margin: '0 0 16px', fontSize: 18 }}>Add Prep Item</h3>
          <input autoFocus placeholder="Item name" value={formName}
            onChange={e => setFormName(e.target.value)} style={inp()} />
          <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
            style={inp()}>
            <option value="prepared">Prepared</option>
            <option value="sauces">Sauces</option>
          </select>
          <select value={formSection} onChange={e => setFormSection(e.target.value)}
            style={inp()}>
            <option value="dinner">Dinner</option>
            <option value="brunch">Brunch</option>
            <option value="lunch">Lunch</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ color: t.text, fontSize: 14, flex: 1 }}>Shelf life (days):</span>
            <input type="number" min="1" max="30" value={formShelfLife}
              onChange={e => setFormShelfLife(e.target.value)}
              style={{ ...inp(), width: 72, marginBottom: 0 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setAddModal(false)} style={{
              flex: 1, padding: 13, background: t.tabBg, border: 'none',
              borderRadius: 12, color: t.text, fontSize: 15, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleAdd} style={{
              flex: 1, padding: 13, background: '#1a1a1a', border: 'none',
              borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>Add</button>
          </div>
        </Modal>
      )}

      {/* ── ACTIVITY LOG ───────────────────────────────────────────────── */}
      {showLog && (
        <Modal dark={dark} onClose={() => setShowLog(false)}>
          <h3 style={{ color: t.text, margin: '0 0 16px', fontSize: 18 }}>Activity Log</h3>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {activityLog.length === 0 ? (
              <p style={{ color: t.sub, fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                No activity yet
              </p>
            ) : activityLog.map(log => (
              <div key={log.id} style={{
                padding: '10px 0', borderBottom: `1px solid ${t.border}`,
              }}>
                <div style={{ fontSize: 14, color: t.text, fontWeight: 500 }}>
                  {log.item_name}
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase',
                    color: log.action === 'deleted' ? '#ff3b30'
                         : log.action === 'added'   ? '#34c759'
                         : '#007aff',
                  }}>{log.action}</span>
                </div>
                <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>
                  {log.performed_by} · {fmtDate(log.performed_at)}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setShowLog(false)} style={{
            width: '100%', padding: 13, background: t.tabBg, border: 'none',
            borderRadius: 12, color: t.text, fontSize: 15, cursor: 'pointer', marginTop: 16,
          }}>Close</button>
        </Modal>
      )}

    </div>
  )
}

