import { useAuth } from '../contexts/AuthContext'

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '1rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      border: '1px solid #f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '0.75rem',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
      }}>
        {icon}
      </div>
      <div>
        <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.25rem' }}>
          {label}
        </p>
        <p style={{ color: color || '#1e293b', fontSize: '1.75rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
          {value}
        </p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f2d4a', margin: '0 0 0.25rem', letterSpacing: '-0.3px' }}>
          Olá, {profile?.nome?.split(' ')[0] || 'seja bem-vindo'} 👋
        </h1>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.875rem', textTransform: 'capitalize' }}>
          {today}
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem',
      }}>
        <StatCard
          icon="💰"
          label="Vendas Hoje"
          value="R$ —"
          bg="#eff6ff"
          color="#1d4ed8"
        />
        <StatCard
          icon="📈"
          label="Total do Mês"
          value="R$ —"
          bg="#f0fdf4"
          color="#15803d"
        />
        <StatCard
          icon="📋"
          label="Cobranças em Aberto"
          value="—"
          bg="#fff7ed"
          color="#c2410c"
        />
        <StatCard
          icon="⚖️"
          label="Próximas Audiências"
          value="—"
          bg="#fdf4ff"
          color="#7e22ce"
        />
      </div>

      {/* Aviso de construção */}
      <div style={{
        background: '#fff',
        border: '1px dashed #cbd5e1',
        borderRadius: '1rem',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        color: '#94a3b8',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: '1.6' }}>
          📊 Os dados dos cartões serão preenchidos nas próximas etapas do projeto,
          conforme os módulos de Vendas e Cobranças forem implementados.
        </p>
      </div>
    </div>
  )
}
