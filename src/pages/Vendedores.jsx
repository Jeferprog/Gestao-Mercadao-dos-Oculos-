import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/* ── helpers ── */
function fBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fDateBR(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function lastOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}

/* ── estilos ── */
const card = {
  background: '#fff',
  borderRadius: '1rem',
  padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid #f1f5f9',
}
const inputCss = {
  padding: '0.65rem 0.875rem',
  border: '1.5px solid #e2e8f0',
  borderRadius: '0.625rem',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
  color: '#1e293b',
  background: '#f8fafc',
}
const Label = ({ children }) => (
  <label style={{
    display: 'block', fontSize: '0.8rem', fontWeight: '600',
    color: '#475569', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px',
  }}>{children}</label>
)

/* ── componente principal ── */
export default function Vendedores() {
  const { profile, isAdmin } = useAuth()

  const [dataInicio, setDataInicio] = useState(firstOfMonth())
  const [dataFim, setDataFim] = useState(lastOfMonth())
  const [vendedores, setVendedores] = useState([])
  const [vendas, setVendas] = useState([])
  const [filiais, setFiliais] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [filtroFilial, setFiltroFilial] = useState('')
  const [loading, setLoading] = useState(true)

  /* carrega perfis, vendas do período e filiais */
  const carregar = useCallback(async () => {
    setLoading(true)
    let qVendas = supabase
      .from('vendas')
      .select('id, os_numero, tipo_venda, data_venda, vendedor_id, filial_id, valor_final, forma_pagamento')
      .gte('data_venda', dataInicio)
      .lte('data_venda', dataFim)
    if (filtroFilial) qVendas = qVendas.eq('filial_id', filtroFilial)

    const [{ data: perfis }, { data: vendasData }, { data: fils }] = await Promise.all([
      supabase.from('profiles').select('id, nome, comissao_percentual, ativo').eq('ativo', true).order('nome'),
      qVendas,
      supabase.from('filiais').select('*').order('nome'),
    ])
    setVendedores(perfis || [])
    setVendas(vendasData || [])
    setFiliais(fils || [])
    setLoading(false)
  }, [dataInicio, dataFim, filtroFilial])

  useEffect(() => { carregar() }, [carregar])

  /* ── dados derivados ── */

  /* acumula totais por vendedor a partir das vendas carregadas */
  const statsMap = {}
  vendas.forEach(v => {
    if (!statsMap[v.vendedor_id]) statsMap[v.vendedor_id] = { qtd: 0, total: 0 }
    statsMap[v.vendedor_id].qtd++
    statsMap[v.vendedor_id].total += v.valor_final || 0
  })

  /* linhas da tabela principal — admin vê todos, vendedor só o próprio */
  const linhas = (isAdmin ? vendedores : vendedores.filter(v => v.id === profile?.id))
    .filter(v => !filtroVendedor || v.id === filtroVendedor)
    .map(v => {
      const s = statsMap[v.id] || { qtd: 0, total: 0 }
      const pct = v.comissao_percentual || 0
      return {
        id: v.id,
        nome: v.nome,
        pct,
        qtd: s.qtd,
        totalVendido: s.total,
        comissao: s.total * (pct / 100),
      }
    })

  /* totais do rodapé */
  const totVendido = linhas.reduce((s, r) => s + r.totalVendido, 0)
  const totComissao = linhas.reduce((s, r) => s + r.comissao, 0)
  const totQtd = linhas.reduce((s, r) => s + r.qtd, 0)

  /* vendas do vendedor selecionado, para o drill-down */
  const selectedVendedor = vendedores.find(v => v.id === selectedId)
  const selectedVendas = selectedId
    ? vendas
        .filter(v => v.vendedor_id === selectedId)
        .sort((a, b) => (a.os_numero || 0) - (b.os_numero || 0))
    : []

  function toggleSelecao(id) {
    setSelectedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="pg">
      {/* Cabeçalho */}
      <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f2d4a', margin: '0 0 1.5rem', letterSpacing: '-0.3px' }}>
        Vendedores e Comissões
      </h1>

      {/* Filtro de período */}
      <div style={{ ...card, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <Label>De</Label>
            <input type="date" style={{ ...inputCss, minWidth: '140px' }}
              value={dataInicio} onChange={e => { setDataInicio(e.target.value); setSelectedId(null) }} />
          </div>
          <div>
            <Label>Até</Label>
            <input type="date" style={{ ...inputCss, minWidth: '140px' }}
              value={dataFim} onChange={e => { setDataFim(e.target.value); setSelectedId(null) }} />
          </div>
          {isAdmin && filiais.length > 1 && (
            <div>
              <Label>Filial</Label>
              <select style={{ ...inputCss, minWidth: '160px' }}
                value={filtroFilial}
                onChange={e => { setFiltroFilial(e.target.value); setSelectedId(null) }}>
                <option value="">Todas</option>
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          )}
          {isAdmin && vendedores.length > 1 && (
            <div>
              <Label>Vendedor</Label>
              <select
                style={{ ...inputCss, minWidth: '160px' }}
                value={filtroVendedor}
                onChange={e => { setFiltroVendedor(e.target.value); setSelectedId(null) }}
              >
                <option value="">Todos</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ color: '#94a3b8', fontSize: '0.82rem', alignSelf: 'flex-end', paddingBottom: '0.7rem' }}>
            {!loading && `${vendas.length} venda${vendas.length !== 1 ? 's' : ''} no período`}
          </div>
        </div>
      </div>

      {/* Tabela principal */}
      <div style={{ ...card, marginBottom: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem 0' }}>Carregando...</div>
        ) : linhas.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
            <div style={{ fontWeight: '600' }}>Nenhum vendedor ativo encontrado</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Vendedor', 'Qtd. O.S.', 'Total Vendido', '% Comissão', 'Comissão a Receber'].map(h => (
                    <th key={h} style={{
                      padding: '0.65rem 0.875rem', textAlign: 'left', fontSize: '0.75rem',
                      fontWeight: '700', color: '#64748b', textTransform: 'uppercase',
                      letterSpacing: '0.4px', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(row => {
                  const isSelected = selectedId === row.id
                  return (
                    <tr
                      key={row.id}
                      onClick={() => toggleSelecao(row.id)}
                      style={{
                        borderBottom: '1px solid #f8fafc',
                        cursor: 'pointer',
                        borderLeft: isSelected ? '4px solid #C0272D' : '4px solid transparent',
                        background: isSelected ? '#fff5f5' : 'transparent',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#fafafa' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                      title="Clique para ver as vendas do período"
                    >
                      <td style={{ padding: '0.8rem 0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            background: isSelected ? '#C0272D' : '#f1f5f9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.82rem', fontWeight: '700',
                            color: isSelected ? '#fff' : '#64748b',
                          }}>
                            {row.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>{row.nome}</div>
                            {isSelected && (
                              <div style={{ fontSize: '0.72rem', color: '#C0272D', fontWeight: '600', marginTop: '1px' }}>
                                ▼ ver vendas
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.8rem 0.875rem', color: row.qtd === 0 ? '#cbd5e1' : '#0f2d4a', fontWeight: '700', fontSize: '1rem' }}>
                        {row.qtd}
                      </td>
                      <td style={{ padding: '0.8rem 0.875rem', fontWeight: '700', color: row.totalVendido === 0 ? '#cbd5e1' : '#1e293b', whiteSpace: 'nowrap' }}>
                        {fBRL(row.totalVendido)}
                      </td>
                      <td style={{ padding: '0.8rem 0.875rem', color: '#475569' }}>
                        {row.pct > 0 ? `${row.pct}%` : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.8rem 0.875rem', fontWeight: '800', color: row.comissao > 0 ? '#C0272D' : '#cbd5e1', whiteSpace: 'nowrap', fontSize: '0.95rem' }}>
                        {row.pct > 0 ? fBRL(row.comissao) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Rodapé totais */}
              {linhas.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <td style={{ padding: '0.75rem 0.875rem', fontWeight: '700', color: '#0f2d4a', fontSize: '0.82rem' }}>
                      TOTAL GERAL
                    </td>
                    <td style={{ padding: '0.75rem 0.875rem', fontWeight: '700', color: '#0f2d4a' }}>
                      {totQtd}
                    </td>
                    <td style={{ padding: '0.75rem 0.875rem', fontWeight: '800', color: '#0f2d4a', whiteSpace: 'nowrap' }}>
                      {fBRL(totVendido)}
                    </td>
                    <td style={{ padding: '0.75rem 0.875rem' }} />
                    <td style={{ padding: '0.75rem 0.875rem', fontWeight: '800', color: '#C0272D', whiteSpace: 'nowrap' }}>
                      {fBRL(totComissao)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Detalhe do vendedor selecionado */}
      {selectedId && (
        <div style={{ ...card, borderLeft: '4px solid #C0272D' }}>
          {/* cabeçalho do detalhe */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: '800', color: '#0f2d4a', fontSize: '1rem' }}>
                {selectedVendedor?.nome}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                {fDateBR(dataInicio)} a {fDateBR(dataFim)}
                {selectedVendas.length > 0 && ` · ${selectedVendas.length} O.S.`}
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              style={{
                background: 'none', border: '1.5px solid #e2e8f0', borderRadius: '0.5rem',
                padding: '0.35rem 0.75rem', fontSize: '0.82rem', color: '#64748b',
                cursor: 'pointer', fontWeight: '600',
              }}
            >
              ✕ Fechar
            </button>
          </div>

          {selectedVendas.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📋</div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Nenhuma venda neste período</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Tipo', 'O.S.', 'Data', 'Valor Final', 'Forma de Pagamento'].map(h => (
                      <th key={h} style={{
                        padding: '0.55rem 0.75rem', textAlign: 'left', fontSize: '0.75rem',
                        fontWeight: '700', color: '#64748b', textTransform: 'uppercase',
                        letterSpacing: '0.4px', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedVendas.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f8fafc' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <span style={{ background: v.tipo_venda === 'Solar' ? '#fef3c7' : '#eff6ff', color: v.tipo_venda === 'Solar' ? '#92400e' : '#1d4ed8', borderRadius: '0.4rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: '600' }}>
                          {v.tipo_venda || 'Grau'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f2d4a' }}>
                        {v.os_numero ? `#${v.os_numero}` : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>
                        {fDateBR(v.data_venda)}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#16a34a', whiteSpace: 'nowrap' }}>
                        {fBRL(v.valor_final)}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>
                        {v.forma_pagamento
                          ? <span style={{ background: '#f1f5f9', borderRadius: '0.4rem', padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: '600' }}>{v.forma_pagamento}</span>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* subtotal do vendedor selecionado */}
                <tfoot>
                  <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <td colSpan={3} style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f2d4a', fontSize: '0.82rem' }}>
                      SUBTOTAL — {selectedVendas.length} venda{selectedVendas.length !== 1 ? 's' : ''}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: '#16a34a', whiteSpace: 'nowrap' }}>
                      {fBRL(selectedVendas.reduce((s, v) => s + (v.valor_final || 0), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
