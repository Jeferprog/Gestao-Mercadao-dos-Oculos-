import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/vendas',
    label: 'Vendas',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    to: '/resumo',
    label: 'Resumo',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3 3v18h18" />
        <path d="M18 9l-5 5-4-4-3 3" />
      </svg>
    ),
  },
  {
    to: '/vendedores',
    label: 'Vendedores',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="3" />
        <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M21 20c0-2.761-1.791-5-4-5" />
      </svg>
    ),
  },
  {
    to: '/cobrancas',
    label: 'Cobranças',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    ),
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

const BG = '#0f2d4a'
const ACTIVE = '#C0272D'
const HOVER = 'rgba(255,255,255,0.08)'
const TEXT = 'rgba(255,255,255,0.72)'
const TEXT_ACTIVE = '#ffffff'

export default function Sidebar({ isMobile = false, isOpen = false, onClose = () => {} }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  // No mobile: sidebar é um drawer fixo que desliza da esquerda
  // No desktop: sidebar é parte normal do layout (posição relativa)
  const asideStyle = isMobile
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: '270px',
        zIndex: 50,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.26s ease',
      }
    : {
        width: '260px',
        minWidth: '260px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
      }

  return (
    <aside style={{
      ...asideStyle,
      background: BG,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: isMobile ? '4px 0 24px rgba(0,0,0,0.3)' : 'none',
    }}>
      {/* Logo + botão fechar (só no mobile) */}
      <div style={{
        padding: '1.25rem 1.25rem 1.1rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Logo"
            style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }}
            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'inline' }}
          />
          <span style={{ fontSize: '1.75rem', display: 'none' }}>👓</span>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem', lineHeight: '1.2' }}>
              Mercadão dos Óculos
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', marginTop: '1px' }}>
              Sistema de Gestão
            </div>
          </div>
        </div>

        {/* Botão X — somente no mobile */}
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '0.5rem',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={isMobile ? onClose : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.7rem 0.75rem',
              borderRadius: '0.625rem',
              marginBottom: '0.125rem',
              color: isActive ? TEXT_ACTIVE : TEXT,
              background: isActive ? ACTIVE : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? '600' : '400',
              fontSize: '0.9rem',
              transition: 'all 0.15s',
            })}
            onMouseEnter={e => {
              const isActive = e.currentTarget.getAttribute('aria-current') === 'page'
              if (!isActive) e.currentTarget.style.background = HOVER
            }}
            onMouseLeave={e => {
              const isActive = e.currentTarget.getAttribute('aria-current') === 'page'
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuário + Sair */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            {profile?.nome || 'Usuário'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
            {profile?.papel === 'admin' ? 'Administrador' : 'Vendedor'}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '0.55rem',
            background: 'rgba(255,255,255,0.08)',
            color: TEXT,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.color = TEXT
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sair
        </button>
      </div>
    </aside>
  )
}
