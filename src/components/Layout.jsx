import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  )
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()

  function close() { setSidebarOpen(false) }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Backdrop escuro quando o menu está aberto no celular */}
      {isMobile && sidebarOpen && (
        <div
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 40,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar (desktop: sempre visível / mobile: drawer deslizante) */}
      <Sidebar isMobile={isMobile} isOpen={sidebarOpen} onClose={close} />

      {/* Área principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Barra superior — só aparece no celular */}
        {isMobile && (
          <header style={{
            background: '#0f2d4a',
            height: '56px',
            padding: '0 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexShrink: 0,
            zIndex: 10,
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '0.5rem',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {/* Ícone hambúrguer */}
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" viewBox="0 0 24 24">
                <line x1="3" y1="6"  x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.95rem' }}>
              👓 Mercadão dos Óculos
            </span>
          </header>
        )}

        <main style={{ flex: 1, overflow: 'auto', background: '#f0f4f8' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
