import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/* ── helpers ── */
function todayISO() { return new Date().toISOString().slice(0, 10) }
function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function lastOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}
function fBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fDateBR(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/* ── Card de estatística ── */
function StatCard({ icon, label, value, sub, color, bg, shimmer }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '1rem', padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '0.75rem', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem',
      }}>{icon}</div>
      <div>
        <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.25rem' }}>
          {label}
        </p>
        {shimmer ? (
          <div style={{ height: '28px', width: '110px', background: '#f1f5f9', borderRadius: '0.5rem', animation: 'pulse 1.5s infinite' }} />
        ) : (
          <>
            <p style={{ color: color || '#1e293b', fontSize: '1.45rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              {value}
            </p>
            {sub && <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{sub}</p>}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Dashboard ── */
export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentVendas, setRecentVendas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return

    async function load() {
      setLoading(true)
      const hoje = todayISO()
      const inicio = firstOfMonth()
      const fim = lastOfMonth()

      /* ── vendas ── */
      let qHoje = supabase.from('vendas').select('valor_final').eq('data_venda', hoje)
      let qMes = supabase.from('vendas').select('valor_final').gte('data_venda', inicio).lte('data_venda', fim)
      let qRecentes = supabase.from('vendas')
        .select('os_numero, data_venda, valor_final, forma_pagamento')
        .order('os_numero', { ascending: false })
        .limit(5)

      if (!isAdmin) {
        qHoje = qHoje.eq('vendedor_id', profile.id)
        qMes = qMes.eq('vendedor_id', profile.id)
        qRecentes = qRecentes.eq('vendedor_id', profile.id)
      }

      const [
        { data: vHoje },
        { data: vMes },
        { data: recentes },
      ] = await Promise.all([qHoje, qMes, qRecentes])

      const totHoje = (vHoje || []).reduce((s, v) => s + (v.valor_final || 0), 0)
      const qtdHoje = (vHoje || []).length
      const totMes = (vMes || []).reduce((s, v) => s + (v.valor_final || 0), 0)
      const qtdMes = (vMes || []).length

      /* ── despesas (admin only — pode não existir ainda) ── */
      let qtdAberto = null, totAberto = null, qtdAtrasadas = null
      if (isAdmin) {
        const [{ data: dAberto }, { data: dAtrasadas }] = await Promise.all([
          supabase.from('despesas').select('valor').eq('pago', false),
          supabase.from('despesas').select('id').eq('pago', false).lt('data_vencimento', hoje),
        ])
        if (dAberto) {
          qtdAberto = dAberto.length
          totAberto = dAberto.reduce((s, d) => s + (d.valor || 0), 0)
        }
        if (dAtrasadas) qtdAtrasadas = dAtrasadas.length
      }

      setStats({ totHoje, qtdHoje, totMes, qtdMes, qtdAberto, totAberto, qtdAtrasadas })
      setRecentVendas(recentes || [])
      setLoading(false)
    }

    load()
  }, [profile, isAdmin])

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="pg">
      {/* Cabeçalho */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f2d4a', margin: '0 0 0.25rem', letterSpacing: '-0.3px' }}>
          Olá, {profile?.nome?.split(' ')[0] || 'seja bem-vindo'} 👋
        </h1>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem', textTransform: 'capitalize' }}>
          {hoje}
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard
          icon="💰"
          label={isAdmin ? 'Vendas Hoje' : 'Minhas Vendas Hoje'}
          value={fBRL(stats?.totHoje)}
          sub={stats?.qtdHoje > 0 ? `${stats.qtdHoje} O.S.` : null}
          bg="#fff0f0" color="#C0272D"
          shimmer={loading}
        />
        <StatCard
          icon="📈"
          label={isAdmin ? 'Total do Mês' : 'Meu Total do Mês'}
          value={fBRL(stats?.totMes)}
          sub={stats?.qtdMes > 0 ? `${stats.qtdMes} O.S.` : null}
          bg="#f0fdf4" color="#15803d"
          shimmer={loading}
        />

        {isAdmin ? (
          <>
            <StatCard
              icon="💳"
              label="Contas em Aberto"
              value={stats?.qtdAberto != null ? String(stats.qtdAberto) : '—'}
              sub={stats?.totAberto > 0 ? fBRL(stats.totAberto) : null}
              bg="#fffbeb" color="#d97706"
              shimmer={loading}
            />
            <StatCard
              icon="⚠️"
              label="Contas Atrasadas"
              value={stats?.qtdAtrasadas != null ? String(stats.qtdAtrasadas) : '—'}
              bg="#fef2f2" color="#dc2626"
              shimmer={loading}
            />
          </>
        ) : (
          <>
            <StatCard
              icon="📋"
              label="Minhas O.S. Hoje"
              value={loading ? '…' : String(stats?.qtdHoje ?? 0)}
              bg="#eff6ff" color="#1d4ed8"
              shimmer={loading}
            />
            <StatCard
              icon="📊"
              label="Minhas O.S. do Mês"
              value={loading ? '…' : String(stats?.qtdMes ?? 0)}
              bg="#fdf4ff" color="#7e22ce"
              shimmer={loading}
            />
          </>
        )}
      </div>

      {/* Últimas vendas */}
      {!loading && recentVendas.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <div style={{ fontWeight: '700', color: '#0f2d4a', marginBottom: '1rem', fontSize: '0.95rem' }}>
            {isAdmin ? 'Últimas Vendas Registradas' : 'Minhas Últimas Vendas'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['O.S.', 'Data', 'Valor Final', 'Pagamento'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentVendas.map(v => (
                  <tr key={v.os_numero} style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f2d4a' }}>#{v.os_numero}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>{fDateBR(v.data_venda)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#16a34a', whiteSpace: 'nowrap' }}>{fBRL(v.valor_final)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>
                      {v.forma_pagamento
                        ? <span style={{ background: '#f1f5f9', borderRadius: '0.4rem', padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: '600' }}>{v.forma_pagamento}</span>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && recentVendas.length === 0 && (
        <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Nenhuma venda registrada ainda. Acesse <strong>Vendas</strong> para lançar a primeira O.S.
          </p>
        </div>
      )}
    </div>
  )
}
