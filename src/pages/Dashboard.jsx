import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { C, F, card as dsCard } from '../lib/ds'

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
function em7DiasISO() {
  const d = new Date(); d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}
function fBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fDateBR(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function diffDias(iso) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(iso + 'T00:00:00') - hoje) / 86400000)
}
function buildChartData(vendas) {
  const now  = new Date()
  const ano  = now.getFullYear()
  const mes  = now.getMonth()
  const dias = new Date(ano, mes + 1, 0).getDate()
  const pfx  = `${ano}-${String(mes + 1).padStart(2, '0')}-`
  const map  = {}
  ;(vendas || []).forEach(v => { if (v.data_venda) map[v.data_venda] = (map[v.data_venda] || 0) + (v.valor_final || 0) })
  return Array.from({ length: dias }, (_, i) => ({
    dia: i + 1,
    total: map[pfx + String(i + 1).padStart(2, '0')] || 0,
  }))
}
function calcStats(vHoje, vMes, bols, devs) {
  const bs = new Set(bols.map(b => b.devedor_id))
  return {
    totHoje: vHoje.reduce((s, v) => s + (v.valor_final || 0), 0), qtdHoje: vHoje.length,
    totMes:  vMes.reduce((s, v)  => s + (v.valor_final || 0), 0), qtdMes:  vMes.length,
    totBolAberto:  bols.reduce((s, b) => s + (b.valor || 0), 0), qtdDevsAberto: bs.size,
    qtdDevsNovos:  devs.filter(d => d.status_cobranca === 'Novo').length,
  }
}

/* ── Gráfico de barras (SVG inline) ── */
function BarChart({ dados, shimmer }) {
  if (shimmer) return (
    <div style={{ height: '155px', background: C.surfaceContainerLow, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '90%', height: '80%', background: `linear-gradient(90deg,${C.surfaceContainerHigh} 30%,${C.borderSubtle} 50%,${C.surfaceContainerHigh} 70%)`, backgroundSize: '200% 100%', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
    </div>
  )

  const hojeNum = new Date().getDate()
  const maxVal  = Math.max(...dados.map(d => d.total), 1)
  const allZero = dados.every(d => d.total === 0)
  const n       = dados.length

  const W = 760, padL = 50, padR = 6, padT = 10, padB = 24, chartH = 128
  const chartW = W - padL - padR
  const slotW  = chartW / n
  const barW   = Math.max(slotW - 1.5, 1.5)

  const yLines = [1, 0.5, 0.25].map(p => ({
    y: padT + chartH * (1 - p),
    v: maxVal * p,
  }))

  return (
    <svg viewBox={`0 0 ${W} ${padT + chartH + padB}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {yLines.map((gl, i) => (
        <g key={i}>
          <line x1={padL} y1={gl.y} x2={padL + chartW} y2={gl.y} stroke={C.surfaceContainerHigh} strokeWidth="1" />
          <text x={padL - 4} y={gl.y + 3.5} textAnchor="end" fontSize="9" fill={C.onSurfaceVariant}>
            {gl.v >= 1000 ? (gl.v / 1000).toFixed(gl.v >= 10000 ? 0 : 1) + 'k' : Math.round(gl.v)}
          </text>
        </g>
      ))}
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke={C.borderSubtle} strokeWidth="1" />
      <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke={C.borderSubtle} strokeWidth="1" />
      {dados.map((d, i) => {
        const barH = allZero ? 0 : Math.max((d.total / maxVal) * chartH, d.total > 0 ? 2 : 0)
        const x    = padL + i * slotW + (slotW - barW) / 2
        const y    = padT + chartH - barH
        const isHj = d.dia === hojeNum
        return (
          <g key={i}>
            {d.total > 0 && (
              <rect x={x} y={y} width={barW} height={barH} rx="2"
                fill={isHj ? C.statusInfo : C.statusDanger} opacity="0.82">
                <title>{`Dia ${d.dia}: ${fBRL(d.total)}`}</title>
              </rect>
            )}
            {(d.dia === 1 || d.dia % 5 === 0 || d.dia === n) && (
              <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fontSize="9"
                fill={isHj ? C.statusInfo : C.onSurfaceVariant} fontWeight={isHj ? '700' : '400'}>
                {d.dia}
              </text>
            )}
          </g>
        )
      })}
      {allZero && (
        <text x={padL + chartW / 2} y={padT + chartH / 2 + 4}
          textAnchor="middle" fontSize="11" fill={C.onSurfaceVariant}>
          Sem vendas registradas no mês
        </text>
      )}
    </svg>
  )
}

/* ── Card de indicador ── */
function StatCard({ icon, label, value, sub, alert, alertColor, color, bg, shimmer, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.surfaceContainerLowest, borderRadius: '0.75rem', padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${C.borderSubtle}`,
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s, transform 0.12s',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' } }}
    >
      <div style={{ width: '44px', height: '44px', borderRadius: '0.75rem', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem' }}>
        {icon}
      </div>
      <div>
        <p style={{ color: C.onSurfaceVariant, fontSize: '0.75rem', fontFamily: F.body, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.25rem' }}>
          {label}
        </p>
        {shimmer ? (
          <div style={{ height: '28px', width: '110px', background: C.surfaceContainerHigh, borderRadius: '0.5rem', animation: 'pulse 1.5s infinite' }} />
        ) : (
          <>
            <p style={{ color: color || C.onSurface, fontSize: '1.45rem', fontFamily: F.headline, fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              {value}
            </p>
            {sub   && <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', fontFamily: F.body, color: C.onSurfaceVariant }}>{sub}</p>}
            {alert && <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', fontFamily: F.body, fontWeight: '700', color: alertColor || C.statusDanger }}>{alert}</p>}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Shimmer para lembretes ── */
function LembreteShimmer() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {[100, 80, 90].map(w => (
        <div key={w} style={{ height: '14px', width: `${w}%`, background: C.surfaceContainerHigh, borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )
}

/* ── Seção de uma filial (cards + gráfico) ── */
function FilialSection({ nome, stats, chartData, loading, navigate, mesTit, showDesp = false, isTotal = false }) {
  const borderColor = isTotal ? '#9d0518' : C.borderSubtle
  const titleColor  = isTotal ? '#9d0518' : C.onSurface

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Cabeçalho da seção */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        marginBottom: '1rem', paddingBottom: '0.5rem',
        borderBottom: `2px solid ${borderColor}`,
      }}>
        <span style={{ fontWeight: '800', fontSize: '0.95rem', fontFamily: F.headline, color: titleColor }}>
          {isTotal ? '📊' : '🏪'} {nome}
        </span>
        {isTotal && (
          <span style={{ fontSize: '0.7rem', fontFamily: F.body, fontWeight: '700', color: '#9d0518', background: 'rgba(157,5,24,0.08)', borderRadius: '0.35rem', padding: '1px 8px' }}>
            consolidado
          </span>
        )}
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <StatCard
          icon="💰" bg={C.statusDangerBg} color={C.statusDanger}
          label="Vendas Hoje"
          value={fBRL(stats.totHoje)}
          sub={stats.qtdHoje > 0 ? `${stats.qtdHoje} O.S.` : 'Sem vendas hoje'}
          shimmer={loading}
          onClick={() => navigate('/vendas')}
        />
        <StatCard
          icon="📈" bg={C.statusSuccessBg} color={C.statusSuccess}
          label="Vendas do Mês"
          value={fBRL(stats.totMes)}
          sub={stats.qtdMes > 0 ? `${stats.qtdMes} O.S. no mês` : 'Sem vendas no mês'}
          shimmer={loading}
          onClick={() => navigate('/vendas')}
        />
        {showDesp && (
          <StatCard
            icon="💳" bg={C.statusWarningBg} color={C.statusWarning}
            label="Contas a Pagar"
            value={fBRL(stats.totDespAberto)}
            sub={`${stats.qtdDespAberto ?? 0} conta${stats.qtdDespAberto !== 1 ? 's' : ''} em aberto`}
            alert={stats.totDespAtrasado > 0 ? `⚠️ ${fBRL(stats.totDespAtrasado)} atrasado` : null}
            alertColor={C.statusDanger}
            shimmer={loading}
            onClick={() => navigate('/resumo')}
          />
        )}
        <StatCard
          icon="⚖️" bg={C.statusDangerBg} color={C.statusDanger}
          label="Cobranças em Aberto"
          value={fBRL(stats.totBolAberto)}
          sub={`${stats.qtdDevsAberto ?? 0} devedor${stats.qtdDevsAberto !== 1 ? 'es' : ''} em aberto`}
          alert={stats.qtdDevsNovos > 0 ? `🆕 ${stats.qtdDevsNovos} novo${stats.qtdDevsNovos > 1 ? 's' : ''}` : null}
          alertColor={C.statusDanger}
          shimmer={loading}
          onClick={() => navigate('/cobrancas')}
        />
      </div>

      {/* Gráfico */}
      <div style={{ ...dsCard }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: '700', fontFamily: F.headline, color: C.onSurface, fontSize: '0.9rem' }}>
            Vendas por Dia —&nbsp;<span style={{ textTransform: 'capitalize', fontWeight: '500', color: C.onSurfaceVariant }}>{mesTit}</span>
          </div>
          {!loading && (
            <div style={{ display: 'flex', gap: '0.875rem', fontSize: '0.72rem', fontFamily: F.body, color: C.onSurfaceVariant }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: C.statusDanger, borderRadius: '2px', opacity: 0.82 }} />
                Outros dias
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: C.statusInfo, borderRadius: '2px' }} />
                Hoje
              </span>
            </div>
          )}
        </div>
        <BarChart dados={chartData.length > 0 ? chartData : buildChartData([])} shimmer={loading} />
      </div>
    </div>
  )
}

/* ════════════════════ DASHBOARD ════════════════════ */
export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [loading,      setLoading]      = useState(true)
  const [filiais,      setFiliais]      = useState([])
  const [filtroFilial, setFiltroFilial] = useState('')

  /* admin "Todas" view */
  const [filiaisDash,  setFiliaisDash]  = useState([])
  const [statsTotal,   setStatsTotal]   = useState({})
  const [chartTotal,   setChartTotal]   = useState([])

  /* vendedor ou admin filial específica */
  const [stats,        setStats]        = useState({})
  const [chartData,    setChartData]    = useState([])

  const [despProximas, setDespProximas] = useState([])
  const [audiencias,   setAudiencias]   = useState([])

  useEffect(() => {
    if (!profile) return

    async function load() {
      setLoading(true)
      const hoje  = todayISO()
      const inicio = firstOfMonth()
      const fim   = lastOfMonth()
      const em7   = em7DiasISO()

      /* ── VENDEDOR ── */
      if (!isAdmin) {
        const [rH, rM] = await Promise.all([
          supabase.from('vendas').select('valor_final').eq('data_venda', hoje).eq('efetivada', true).eq('vendedor_id', profile.id),
          supabase.from('vendas').select('data_venda, valor_final').gte('data_venda', inicio).lte('data_venda', fim).eq('efetivada', true).eq('vendedor_id', profile.id),
        ])
        const vH = rH.data || [], vM = rM.data || []
        setStats({ totHoje: vH.reduce((s, v) => s + (v.valor_final || 0), 0), qtdHoje: vH.length, totMes: vM.reduce((s, v) => s + (v.valor_final || 0), 0), qtdMes: vM.length })
        setChartData(buildChartData(vM))
        setLoading(false)
        return
      }

      /* ── ADMIN: carregar filiais ── */
      let currentFiliais = filiais
      if (currentFiliais.length === 0) {
        const { data } = await supabase.from('filiais').select('*').order('nome')
        currentFiliais = data || []
        setFiliais(currentFiliais)
      }

      /* ── ADMIN filial específica ── */
      if (filtroFilial) {
        const [rH, rM, rDA, rDAtr, rDPrx, rBol, rDevs, rAud] = await Promise.all([
          supabase.from('vendas').select('valor_final').eq('data_venda', hoje).eq('efetivada', true).eq('filial_id', filtroFilial),
          supabase.from('vendas').select('data_venda, valor_final').gte('data_venda', inicio).lte('data_venda', fim).eq('efetivada', true).eq('filial_id', filtroFilial),
          supabase.from('despesas').select('valor').eq('pago', false).eq('filial_id', filtroFilial),
          supabase.from('despesas').select('valor').eq('pago', false).lt('data_vencimento', hoje).eq('filial_id', filtroFilial),
          supabase.from('despesas').select('descricao, data_vencimento, valor').eq('pago', false).gte('data_vencimento', hoje).lte('data_vencimento', em7).order('data_vencimento').limit(8),
          supabase.from('cobrancas_boletos').select('valor, devedor_id').is('data_liquidacao', null).eq('filial_id', filtroFilial),
          supabase.from('cobrancas_devedores').select('id, status_cobranca').eq('filial_id', filtroFilial),
          supabase.from('cobrancas_devedores').select('nome_pagador, data_audiencia, filial_id').gte('data_audiencia', hoje).lte('data_audiencia', em7).order('data_audiencia').limit(8),
        ])
        const vH = rH.data || [], vM = rM.data || []
        const dA = rDA.data || [], dAtr = rDAtr.data || []
        const bols = rBol.data || [], devs = rDevs.data || []
        const bs = new Set(bols.map(b => b.devedor_id))
        setStats({
          ...calcStats(vH, vM, bols, devs),
          totDespAberto:   dA.reduce((s, d)   => s + (d.valor || 0), 0), qtdDespAberto:   dA.length,
          totDespAtrasado: dAtr.reduce((s, d) => s + (d.valor || 0), 0), qtdDespAtrasado: dAtr.length,
          qtdDevsAberto: bs.size,
        })
        setChartData(buildChartData(vM))
        setDespProximas(rDPrx.data || [])
        setAudiencias(rAud.data || [])
        setLoading(false)
        return
      }

      /* ── ADMIN: todas as filiais ── */
      const [rH, rM, rDA, rDAtr, rDPrx, rBol, rDevs, rAud] = await Promise.all([
        supabase.from('vendas').select('valor_final, filial_id').eq('data_venda', hoje).eq('efetivada', true),
        supabase.from('vendas').select('data_venda, valor_final, filial_id').gte('data_venda', inicio).lte('data_venda', fim).eq('efetivada', true),
        supabase.from('despesas').select('valor, filial_id').eq('pago', false),
        supabase.from('despesas').select('valor, filial_id').eq('pago', false).lt('data_vencimento', hoje),
        supabase.from('despesas').select('descricao, data_vencimento, valor').eq('pago', false).gte('data_vencimento', hoje).lte('data_vencimento', em7).order('data_vencimento').limit(8),
        supabase.from('cobrancas_boletos').select('valor, devedor_id, filial_id').is('data_liquidacao', null),
        supabase.from('cobrancas_devedores').select('id, status_cobranca, filial_id'),
        supabase.from('cobrancas_devedores').select('nome_pagador, data_audiencia, filial_id').gte('data_audiencia', hoje).lte('data_audiencia', em7).order('data_audiencia').limit(8),
      ])

      const vHAll  = rH.data  || [], vMAll  = rM.data  || []
      const dA     = rDA.data || [], dAtr   = rDAtr.data || []
      const bolAll = rBol.data || [], devsAll = rDevs.data || []

      /* ── dados por filial ── */
      const fd = currentFiliais.map(f => {
        const vH  = vHAll.filter(v => v.filial_id === f.id)
        const vM  = vMAll.filter(v => v.filial_id === f.id)
        const bL  = bolAll.filter(b => b.filial_id === f.id)
        const dL  = devsAll.filter(d => d.filial_id === f.id)
        const dFL = dA.filter(d => d.filial_id === f.id)
        const dFLa = dAtr.filter(d => d.filial_id === f.id)
        return {
          id: f.id, nome: f.nome,
          stats: {
            ...calcStats(vH, vM, bL, dL),
            totDespAberto:   dFL.reduce((s, d)  => s + (d.valor || 0), 0), qtdDespAberto:   dFL.length,
            totDespAtrasado: dFLa.reduce((s, d) => s + (d.valor || 0), 0), qtdDespAtrasado: dFLa.length,
          },
          chartData: buildChartData(vM),
        }
      })
      setFiliaisDash(fd)

      /* ── total consolidado ── */
      const bsAll = new Set(bolAll.map(b => b.devedor_id))
      setStatsTotal({
        ...calcStats(vHAll, vMAll, bolAll, devsAll),
        totDespAberto:   dA.reduce((s, d)   => s + (d.valor || 0), 0), qtdDespAberto:   dA.length,
        totDespAtrasado: dAtr.reduce((s, d) => s + (d.valor || 0), 0), qtdDespAtrasado: dAtr.length,
        qtdDevsAberto: bsAll.size,
      })
      setChartTotal(buildChartData(vMAll))
      setDespProximas(rDPrx.data || [])
      setAudiencias(rAud.data || [])
      setLoading(false)
    }

    load()
  }, [profile, isAdmin, filtroFilial]) // eslint-disable-line react-hooks/exhaustive-deps

  const hoje   = todayISO()
  const mesTit = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const greet  = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const filialMap = Object.fromEntries(filiais.map(f => [f.id, f.nome]))

  /* filial selecionada (admin + specific) */
  const filialSelecionadaNome = filiais.find(f => f.id === filtroFilial)?.nome || ''

  /* ── modo de exibição ── */
  const modoTodasFiliais = isAdmin && !filtroFilial && filiais.length > 1

  return (
    <div className="pg">

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: F.headline, color: C.onSurface, margin: '0 0 0.25rem', letterSpacing: '-0.3px' }}>
            Olá, {profile?.nome?.split(' ')[0] || 'seja bem-vindo'} 👋
          </h1>
          <p style={{ color: C.onSurfaceVariant, fontFamily: F.body, margin: 0, fontSize: '0.85rem', textTransform: 'capitalize' }}>{greet}</p>
        </div>
        {isAdmin && filiais.length > 1 && (
          <select
            value={filtroFilial}
            onChange={e => setFiltroFilial(e.target.value)}
            style={{
              padding: '0.5rem 0.875rem', border: `1.5px solid ${C.borderSubtle}`,
              borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: F.body,
              outline: 'none', background: C.surfaceContainerLow, color: C.onSurface,
              cursor: 'pointer', minWidth: '160px',
            }}
          >
            <option value="">Todas as filiais</option>
            {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
      </div>

      {/* ════════ ADMIN VIEW ════════ */}
      {isAdmin && (
        <>
          {modoTodasFiliais ? (
            /* ── Modo: todas as filiais ── */
            <>
              {/* Seção total consolidada */}
              <FilialSection
                nome="Total — Todas as Filiais"
                stats={statsTotal}
                chartData={chartTotal}
                loading={loading}
                navigate={navigate}
                mesTit={mesTit}
                showDesp
                isTotal
              />

              {/* Uma seção por filial */}
              {filiaisDash.map(f => (
                <FilialSection
                  key={f.id}
                  nome={f.nome}
                  stats={f.stats}
                  chartData={f.chartData}
                  loading={loading}
                  navigate={navigate}
                  mesTit={mesTit}
                  showDesp
                />
              ))}
            </>
          ) : (
            /* ── Modo: filial específica (ou única filial) ── */
            <FilialSection
              nome={filialSelecionadaNome || (filiais[0]?.nome || 'Visão Geral')}
              stats={filtroFilial ? stats : statsTotal}
              chartData={filtroFilial ? chartData : chartTotal}
              loading={loading}
              navigate={navigate}
              mesTit={mesTit}
              showDesp
              isTotal={!filtroFilial}
            />
          )}

          {/* ── Lembretes (contas + audiências) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem', marginTop: '0.25rem' }}>

            {/* Contas a vencer */}
            <div style={dsCard}>
              <div style={{ fontWeight: '700', fontFamily: F.headline, color: C.onSurface, fontSize: '0.88rem', marginBottom: '0.875rem' }}>
                📅 Contas a Vencer nos Próximos 7 Dias
              </div>
              {loading ? <LembreteShimmer /> : despProximas.length === 0 ? (
                <p style={{ color: C.onSurfaceVariant, fontFamily: F.body, fontSize: '0.82rem', margin: 0 }}>Nenhuma conta nos próximos 7 dias.</p>
              ) : (
                <div>
                  {despProximas.map((d, i) => {
                    const dias = diffDias(d.data_vencimento)
                    const isHj = dias === 0
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0', borderBottom: i < despProximas.length - 1 ? `1px solid ${C.borderSubtle}` : 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontFamily: F.body, fontSize: '0.82rem', color: isHj ? C.statusDanger : C.onSurface, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {isHj && '🔴 '}{d.descricao}
                          </div>
                          <div style={{ fontSize: '0.72rem', fontFamily: F.body, color: C.onSurfaceVariant, marginTop: '1px' }}>
                            {fDateBR(d.data_vencimento)}{dias === 0 ? ' — hoje' : dias === 1 ? ' — amanhã' : ` — em ${dias} dias`}
                          </div>
                        </div>
                        <div style={{ fontWeight: '700', fontFamily: F.mono, color: C.statusWarning, fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {fBRL(d.valor)}
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                    <button onClick={() => navigate('/resumo')}
                      style={{ background: 'none', border: 'none', color: C.statusDanger, fontFamily: F.body, fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}>
                      Ver todas →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audiências */}
            <div style={dsCard}>
              <div style={{ fontWeight: '700', fontFamily: F.headline, color: C.onSurface, fontSize: '0.88rem', marginBottom: '0.875rem' }}>
                ⚖️ Próximas Audiências (7 Dias)
              </div>
              {loading ? <LembreteShimmer /> : audiencias.length === 0 ? (
                <p style={{ color: C.onSurfaceVariant, fontFamily: F.body, fontSize: '0.82rem', margin: 0 }}>Nenhuma audiência nos próximos 7 dias.</p>
              ) : (
                <div>
                  {audiencias.map((a, i) => {
                    const dias = diffDias(a.data_audiencia)
                    const isHj = a.data_audiencia === hoje
                    const filNome = a.filial_id && filialMap[a.filial_id] ? filialMap[a.filial_id] : null
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0', borderBottom: i < audiencias.length - 1 ? `1px solid ${C.borderSubtle}` : 'none', background: isHj ? C.statusDangerBg : 'transparent', borderRadius: isHj ? '0.4rem' : 0, paddingLeft: isHj ? '0.5rem' : 0 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '600', fontFamily: F.body, fontSize: '0.82rem', color: isHj ? C.statusDanger : C.onSurface }}>
                              {a.nome_pagador}
                            </span>
                            {filNome && (
                              <span style={{ fontSize: '0.65rem', fontWeight: '600', background: C.surfaceContainerHigh, color: C.onSurfaceVariant, borderRadius: '0.3rem', padding: '1px 5px', fontFamily: F.body }}>
                                {filNome}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', fontFamily: F.body, color: C.onSurfaceVariant, marginTop: '1px' }}>
                            {fDateBR(a.data_audiencia)}{dias === 0 ? ' — hoje' : dias === 1 ? ' — amanhã' : ` — em ${dias} dias`}
                          </div>
                        </div>
                        {isHj && (
                          <span style={{ background: C.statusDanger, color: '#fff', borderRadius: '9999px', fontSize: '0.62rem', fontFamily: F.body, fontWeight: '800', padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            HOJE
                          </span>
                        )}
                      </div>
                    )
                  })}
                  <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                    <button onClick={() => navigate('/cobrancas')}
                      style={{ background: 'none', border: 'none', color: C.statusDanger, fontFamily: F.body, fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}>
                      Ver todas →
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* ════════ VENDEDOR VIEW ════════ */}
      {!isAdmin && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <StatCard
              icon="💰" bg={C.statusDangerBg} color={C.statusDanger}
              label="Minhas Vendas Hoje"
              value={fBRL(stats.totHoje)}
              sub={stats.qtdHoje > 0 ? `${stats.qtdHoje} O.S.` : 'Sem vendas hoje'}
              shimmer={loading}
              onClick={() => navigate('/vendas')}
            />
            <StatCard
              icon="📈" bg={C.statusSuccessBg} color={C.statusSuccess}
              label="Minhas Vendas do Mês"
              value={fBRL(stats.totMes)}
              sub={stats.qtdMes > 0 ? `${stats.qtdMes} O.S. no mês` : 'Sem vendas no mês'}
              shimmer={loading}
              onClick={() => navigate('/vendas')}
            />
          </div>
          <div style={{ ...dsCard }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontWeight: '700', fontFamily: F.headline, color: C.onSurface, fontSize: '0.9rem' }}>
                Minhas Vendas por Dia —&nbsp;<span style={{ textTransform: 'capitalize', fontWeight: '500', color: C.onSurfaceVariant }}>{mesTit}</span>
              </div>
              {!loading && (
                <div style={{ display: 'flex', gap: '0.875rem', fontSize: '0.72rem', fontFamily: F.body, color: C.onSurfaceVariant }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', background: C.statusDanger, borderRadius: '2px', opacity: 0.82 }} />
                    Outros dias
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', background: C.statusInfo, borderRadius: '2px' }} />
                    Hoje
                  </span>
                </div>
              )}
            </div>
            <BarChart dados={chartData.length > 0 ? chartData : buildChartData([])} shimmer={loading} />
          </div>
        </>
      )}
    </div>
  )
}
