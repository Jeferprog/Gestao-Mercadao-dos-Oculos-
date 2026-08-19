import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/* ── helpers ── */
function todayISO() { return new Date().toISOString().slice(0, 10) }

function normalizarNome(nome) {
  return String(nome || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

function parseBRL(val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  const s = String(val).trim()
  if (!s || s === '-' || s === '—') return null
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(s.replace(/[^\d.]/g, '')) || 0
}

function parseDataBR(val) {
  if (!val) return null
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    const y = val.getFullYear(), m = val.getMonth() + 1, d = val.getDate()
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }
  const s = String(val).trim()
  if (!s || s === '-' || s === '—') return null
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m}-${d}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function fBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).split('-')
  return `${d}/${m}/${y}`
}
function diffDias(isoA, isoB) {
  return Math.round((new Date(isoA) - new Date(isoB)) / 86400000)
}

function statusStyle(s) {
  return {
    'Novo':         { bg: '#fee2e2', color: '#991b1b' },
    'Em andamento': { bg: '#dbeafe', color: '#1e40af' },
    'Negociado':    { bg: '#fef3c7', color: '#92400e' },
    'Protestado':   { bg: '#f3e8ff', color: '#6b21a8' },
    'Quitado':      { bg: '#dcfce7', color: '#166534' },
  }[s] || { bg: '#f1f5f9', color: '#475569' }
}

/* ── detectar colunas pelo cabeçalho ── */
function detectarColunas(headerRow) {
  const col = {}
  headerRow.forEach((cell, j) => {
    const raw = String(cell ?? '').trim()
    const c = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (/^cart(eira)?$/i.test(raw)) col.carteira = j
    if (/n[o°º]\.?\s*doc/i.test(raw) && !c.includes('nosso')) col.numero_doc = j
    if (c.includes('nosso')) col.nosso_numero = j
    if (/^txid$/i.test(raw)) col.txid = j
    if (/^pagador$/i.test(raw)) col.nome_pagador = j
    if (c.includes('vencimento')) col.data_vencimento = j
    if (c.includes('data') && c.includes('liquidac')) col.data_liquidacao = j
    if (c.includes('valor') && !c.includes('liquidac')) col.valor = j
    if (c.includes('liquidac') && !c.includes('data') && !c.includes('valor')) col.valor_liquidacao = j
    if (c.includes('situac')) col.situacao_boleto = j
    if (/^motivo$/i.test(raw)) col.motivo = j
  })
  return col
}

/* ── parsear arquivo xlsx / csv ── */
async function parseFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })

  let headerIdx = -1
  let colMap = {}
  for (let i = 0; i < rows.length; i++) {
    const row = (rows[i] || []).map(c => (c != null ? String(c) : ''))
    const temNosso  = row.some(c => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes('nosso'))
    const temPagador = row.some(c => /^pagador$/i.test(c.trim()))
    if (temNosso && temPagador) {
      headerIdx = i
      colMap = detectarColunas(rows[i] || [])
      break
    }
  }
  if (headerIdx === -1) throw new Error('Cabeçalho não encontrado. Verifique se o arquivo contém as colunas "Nosso Nº" e "Pagador".')

  const boletos = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const nomePagador = String(row[colMap.nome_pagador] ?? '').trim()
    if (!nomePagador) continue
    boletos.push({
      carteira:        String(row[colMap.carteira]        ?? '').trim() || null,
      numero_doc:      String(row[colMap.numero_doc]      ?? '').trim() || null,
      nosso_numero:    String(row[colMap.nosso_numero]    ?? '').trim() || null,
      txid:            String(row[colMap.txid]            ?? '').trim() || null,
      nome_pagador:    nomePagador,
      data_vencimento: parseDataBR(row[colMap.data_vencimento]),
      data_liquidacao: parseDataBR(row[colMap.data_liquidacao]) || null,
      valor:           parseBRL(row[colMap.valor]),
      valor_liquidacao:parseBRL(row[colMap.valor_liquidacao]),
      situacao_boleto: String(row[colMap.situacao_boleto] ?? '').trim() || null,
      motivo:          String(row[colMap.motivo]          ?? '').trim() || null,
    })
  }
  if (boletos.length === 0) throw new Error('Nenhuma linha de boleto encontrada após o cabeçalho.')
  return boletos
}

/* ── importar boletos no Supabase ── */
async function importarBoletos(boletos) {
  const hoje = todayISO()

  const uniqueNorm = [...new Set(boletos.map(b => normalizarNome(b.nome_pagador)).filter(Boolean))]
  if (uniqueNorm.length === 0) throw new Error('Nenhum pagador válido encontrado.')

  // Buscar devedores já existentes que aparecem no arquivo
  const { data: existentesDB, error: e1 } = await supabase
    .from('cobrancas_devedores').select('id, nome_normalizado').in('nome_normalizado', uniqueNorm)
  if (e1) throw new Error(e1.message)

  const mapId = {}
  existentesDB?.forEach(d => { mapId[d.nome_normalizado] = d.id })

  // Inserir devedores novos
  const novosNorm  = uniqueNorm.filter(n => !mapId[n])
  const novosNomes = novosNorm.map(norm =>
    boletos.find(b => normalizarNome(b.nome_pagador) === norm)?.nome_pagador || norm
  )
  if (novosNorm.length > 0) {
    const { data: inseridos, error: e2 } = await supabase
      .from('cobrancas_devedores')
      .insert(novosNorm.map((norm, i) => ({
        nome_pagador:      novosNomes[i],
        nome_normalizado:  norm,
        status_cobranca:   'Novo',
        primeiro_registro: hoje,
        ultima_atualizacao: hoje,
      })))
      .select('id, nome_normalizado')
    if (e2) throw new Error(e2.message)
    inseridos?.forEach(d => { mapId[d.nome_normalizado] = d.id })

    // Sincronizar novos devedores com a tabela de clientes
    if (novosNomes.length > 0) {
      await supabase.from('clientes').insert(novosNomes.map(nome => ({ nome })))
    }
  }

  // Atualizar ultima_atualizacao dos existentes
  const idsExistentes = existentesDB?.map(d => d.id) || []
  if (idsExistentes.length > 0) {
    await supabase.from('cobrancas_devedores')
      .update({ ultima_atualizacao: hoje }).in('id', idsExistentes)
  }

  // Boletos: split por nosso_numero disponível
  const nossoNums = boletos.map(b => b.nosso_numero).filter(Boolean)
  const setExistentes = new Set()
  if (nossoNums.length > 0) {
    const { data: boletosDB } = await supabase
      .from('cobrancas_boletos').select('nosso_numero').in('nosso_numero', nossoNums)
    boletosDB?.forEach(b => { setExistentes.add(b.nosso_numero) })
  }

  const paraInserir  = []
  const paraAtualizar = []
  boletos.forEach(b => {
    const devedorId = mapId[normalizarNome(b.nome_pagador)]
    if (!devedorId) return
    const payload = {
      devedor_id: devedorId, carteira: b.carteira, numero_doc: b.numero_doc,
      nosso_numero: b.nosso_numero, txid: b.txid,
      data_vencimento: b.data_vencimento, data_liquidacao: b.data_liquidacao,
      valor: b.valor, valor_liquidacao: b.valor_liquidacao,
      situacao_boleto: b.situacao_boleto, motivo: b.motivo,
    }
    if (b.nosso_numero && setExistentes.has(b.nosso_numero)) paraAtualizar.push(payload)
    else paraInserir.push(payload)
  })

  if (paraInserir.length > 0) {
    const { error: e3 } = await supabase.from('cobrancas_boletos').insert(paraInserir)
    if (e3) throw new Error(e3.message)
  }
  for (const b of paraAtualizar) {
    await supabase.from('cobrancas_boletos').update({
      data_vencimento: b.data_vencimento, data_liquidacao: b.data_liquidacao,
      valor: b.valor, valor_liquidacao: b.valor_liquidacao,
      situacao_boleto: b.situacao_boleto, motivo: b.motivo,
    }).eq('nosso_numero', b.nosso_numero)
  }

  return {
    total: boletos.length,
    inseridos: paraInserir.length,
    atualizados: paraAtualizar.length,
    novosDevedores: novosNomes,
    devedoresAtualizados: idsExistentes.length,
  }
}

/* ── constantes de estilo ── */
const card = {
  background: '#fff', borderRadius: '1rem', padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
}
const inputCss = {
  padding: '0.6rem 0.875rem', border: '1.5px solid #e2e8f0',
  borderRadius: '0.625rem', fontSize: '0.875rem', outline: 'none',
  background: '#f8fafc', color: '#1e293b', boxSizing: 'border-box',
}
const STATUS_OPTS = ['Novo', 'Em andamento', 'Negociado', 'Protestado', 'Quitado']

/* ════════════════════════════════ COMPONENTE PRINCIPAL ════════════════════════════════ */
export default function Cobrancas() {
  const { isAdmin } = useAuth()
  const fileRef = useRef()

  const [view,       setView]       = useState('lista')
  const [devedores,  setDevedores]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [editForm,   setEditForm]   = useState({})
  const [salvando,   setSalvando]   = useState(false)
  const [importando, setImportando] = useState(false)
  const [importErr,  setImportErr]  = useState(null)
  const [resultado,  setResultado]  = useState(null)
  const [copied,     setCopied]     = useState(false)
  const [filtros,    setFiltros]    = useState({
    busca: '', status: '', somenteNovos: false, somentePC: false, somenteAudiencia: false,
  })

  /* ── carregamento ── */
  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cobrancas_devedores')
      .select(`
        id, nome_pagador, telefone, status_cobranca, primeiro_registro, ultima_atualizacao,
        pequenas_causas, data_audiencia, situacao_audiencia, observacoes,
        cobrancas_boletos (
          id, data_vencimento, data_liquidacao, valor, valor_liquidacao,
          situacao_boleto, motivo, numero_doc, nosso_numero, carteira
        )
      `)
      .order('ultima_atualizacao', { ascending: false })
    setDevedores(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  /* ── helpers derivados ── */
  function abertos(dev) { return (dev.cobrancas_boletos || []).filter(b => !b.data_liquidacao) }
  function valorAberto(dev) { return abertos(dev).reduce((s, b) => s + (b.valor || 0), 0) }

  /* ── filtros ── */
  const listaFiltrada = devedores.filter(dev => {
    if (filtros.busca && !dev.nome_pagador.toLowerCase().includes(filtros.busca.toLowerCase())) return false
    if (filtros.status && dev.status_cobranca !== filtros.status) return false
    if (filtros.somenteNovos && dev.status_cobranca !== 'Novo') return false
    if (filtros.somentePC && !dev.pequenas_causas) return false
    if (filtros.somenteAudiencia && !dev.data_audiencia) return false
    return true
  })

  const selectedDev = devedores.find(d => d.id === selectedId)

  /* ── selecionar devedor ── */
  function selecionar(id) {
    if (selectedId === id) { setSelectedId(null); setEditForm({}); return }
    const dev = devedores.find(d => d.id === id)
    setSelectedId(id)
    setEditForm({
      status_cobranca:    dev?.status_cobranca    || 'Novo',
      telefone:           dev?.telefone           || '',
      pequenas_causas:    dev?.pequenas_causas    || false,
      data_audiencia:     dev?.data_audiencia     || '',
      situacao_audiencia: dev?.situacao_audiencia || '',
      observacoes:        dev?.observacoes        || '',
    })
    setTimeout(() => document.getElementById('detalhe-devedor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  /* ── importar arquivo ── */
  async function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportando(true); setImportErr(null); setResultado(null)
    try {
      const boletos = await parseFile(file)
      const res = await importarBoletos(boletos)
      setResultado(res)
      await carregar()
    } catch (err) {
      setImportErr(err.message)
    } finally {
      setImportando(false)
    }
  }

  /* ── salvar edição ── */
  async function salvarDevedor() {
    setSalvando(true)
    await supabase.from('cobrancas_devedores').update({
      status_cobranca:    editForm.status_cobranca,
      telefone:           editForm.telefone || null,
      pequenas_causas:    editForm.pequenas_causas,
      data_audiencia:     editForm.data_audiencia || null,
      situacao_audiencia: editForm.situacao_audiencia || null,
      observacoes:        editForm.observacoes || null,
      ultima_atualizacao: todayISO(),
    }).eq('id', selectedId)
    await carregar()
    setSalvando(false)
  }

  /* ── copiar cobrança ── */
  function copiarCobranca(dev) {
    const lista = abertos(dev)
      .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
    const total = valorAberto(dev)
    const linhas = lista.map(b =>
      `• Venc. ${fDate(b.data_vencimento)} — ${fBRL(b.valor)}${b.situacao_boleto ? ` [${b.situacao_boleto}]` : ''}`
    ).join('\n')
    const telLinha = dev.telefone ? `\nTelefone: ${dev.telefone}` : ''
    const txt = `*COBRANÇA — ${dev.nome_pagador}*${telLinha}\n\nBoleto(s) em aberto:\n${linhas}\n\n*Total em aberto: ${fBRL(total)}*\n\nEntre em contato para regularizar sua situação.`
    navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200) })
  }

  /* ── audiências ── */
  const comAudiencia = [...devedores]
    .filter(d => d.data_audiencia)
    .sort((a, b) => a.data_audiencia.localeCompare(b.data_audiencia))

  /* ════════════════════ RENDER ════════════════════ */

  if (!isAdmin) return (
    <div className="pg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
        <p style={{ fontWeight: '700', color: '#64748b' }}>Acesso restrito ao administrador.</p>
      </div>
    </div>
  )

  return (
    <div className="pg">
      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f2d4a', margin: 0, letterSpacing: '-0.3px' }}>
          Cobranças
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setView('lista')}
            style={{ padding: '0.55rem 1rem', borderRadius: '0.6rem', border: '1.5px solid', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', ...(view === 'lista' ? { background: '#0f2d4a', color: '#fff', borderColor: '#0f2d4a' } : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }) }}
          >📋 Devedores</button>
          <button
            onClick={() => setView('audiencias')}
            style={{ padding: '0.55rem 1rem', borderRadius: '0.6rem', border: '1.5px solid', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', ...(view === 'audiencias' ? { background: '#0f2d4a', color: '#fff', borderColor: '#0f2d4a' } : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }) }}
          >📅 Audiências {comAudiencia.length > 0 && `(${comAudiencia.length})`}</button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importando}
            style={{ padding: '0.55rem 1.1rem', borderRadius: '0.6rem', background: '#C0272D', color: '#fff', border: 'none', fontSize: '0.85rem', fontWeight: '700', cursor: importando ? 'not-allowed' : 'pointer', opacity: importando ? 0.7 : 1 }}
          >{importando ? '⏳ Importando...' : '⬆️ Importar relatório'}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ display: 'none' }} />
        </div>
      </div>

      {/* ── Banner de importação ── */}
      {importErr && (
        <div style={{ ...card, borderLeft: '4px solid #dc2626', marginBottom: '1rem', background: '#fef2f2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p style={{ fontWeight: '700', color: '#991b1b', margin: '0 0 0.25rem' }}>Erro na importação</p>
              <p style={{ color: '#dc2626', margin: 0, fontSize: '0.875rem' }}>{importErr}</p>
            </div>
            <button onClick={() => setImportErr(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        </div>
      )}

      {resultado && (
        <div style={{ ...card, borderLeft: '4px solid #16a34a', marginBottom: '1rem', background: '#f0fdf4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p style={{ fontWeight: '700', color: '#15803d', margin: '0 0 0.5rem' }}>
                ✅ Importação concluída — {resultado.total} boleto{resultado.total !== 1 ? 's' : ''} processado{resultado.total !== 1 ? 's' : ''}
              </p>
              <div style={{ fontSize: '0.85rem', color: '#166534', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span>📥 {resultado.inseridos} boleto{resultado.inseridos !== 1 ? 's' : ''} novo{resultado.inseridos !== 1 ? 's' : ''} inserido{resultado.inseridos !== 1 ? 's' : ''} · ♻️ {resultado.atualizados} atualizado{resultado.atualizados !== 1 ? 's' : ''}</span>
                {resultado.novosDevedores.length > 0 && (
                  <span>🆕 {resultado.novosDevedores.length} devedor{resultado.novosDevedores.length > 1 ? 'es' : ''} novo{resultado.novosDevedores.length > 1 ? 's' : ''}: <strong>{resultado.novosDevedores.join(', ')}</strong></span>
                )}
                {resultado.devedoresAtualizados > 0 && (
                  <span>🔄 {resultado.devedoresAtualizados} devedor{resultado.devedoresAtualizados > 1 ? 'es' : ''} existente{resultado.devedoresAtualizados > 1 ? 's' : ''} atualizado{resultado.devedoresAtualizados > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <button onClick={() => setResultado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        </div>
      )}

      {/* ════════ VIEW: LISTA ════════ */}
      {view === 'lista' && (
        <>
          {/* Filtros */}
          <div style={{ ...card, marginBottom: '1rem', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', alignItems: 'center' }}>
              <input
                type="search" placeholder="Buscar por nome…" value={filtros.busca}
                onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))}
                style={{ ...inputCss, minWidth: '180px', flex: '1 1 180px' }}
              />
              <select
                value={filtros.status}
                onChange={e => setFiltros(f => ({ ...f, status: e.target.value, somenteNovos: false }))}
                style={{ ...inputCss, minWidth: '160px' }}
              >
                <option value="">Todos os status</option>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {[
                { key: 'somenteNovos',     label: 'Somente novos' },
                { key: 'somentePC',        label: 'Pequenas causas' },
                { key: 'somenteAudiencia', label: 'Com audiência' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#475569', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={filtros[key]}
                    onChange={e => setFiltros(f => {
                      const next = { ...f, [key]: e.target.checked }
                      if (key === 'somenteNovos' && e.target.checked) next.status = ''
                      return next
                    })} />
                  {label}
                </label>
              ))}
              {(filtros.busca || filtros.status || filtros.somenteNovos || filtros.somentePC || filtros.somenteAudiencia) && (
                <button onClick={() => setFiltros({ busca: '', status: '', somenteNovos: false, somentePC: false, somenteAudiencia: false })}
                  style={{ fontSize: '0.8rem', color: '#C0272D', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.3rem 0.5rem' }}>
                  ✕ Limpar
                </button>
              )}
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: 'auto' }}>
                {loading ? '…' : `${listaFiltrada.length} devedor${listaFiltrada.length !== 1 ? 'es' : ''}`}
              </span>
            </div>
          </div>

          {/* Tabela de devedores */}
          <div style={{ ...card, marginBottom: '1rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>Carregando…</div>
            ) : listaFiltrada.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</div>
                <div style={{ fontWeight: '600' }}>
                  {devedores.length === 0 ? 'Nenhum devedor cadastrado. Importe um relatório para começar.' : 'Nenhum resultado com os filtros aplicados.'}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {['Devedor', 'Telefone', 'Em aberto', 'Valor em aberto', 'Status', 'P. Causas', 'Audiência', 'Atualização'].map(h => (
                        <th key={h} style={{ padding: '0.65rem 0.875rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.map(dev => {
                      const isSel = selectedId === dev.id
                      const qtdAbertos = abertos(dev).length
                      const valAberto  = valorAberto(dev)
                      const sStyle     = statusStyle(dev.status_cobranca)
                      return (
                        <tr
                          key={dev.id}
                          onClick={() => selecionar(dev.id)}
                          style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', borderLeft: `4px solid ${isSel ? '#C0272D' : 'transparent'}`, background: isSel ? '#fff5f5' : 'transparent', transition: 'background 0.12s' }}
                          onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#fafafa' }}
                          onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                        >
                          <td style={{ padding: '0.8rem 0.875rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: isSel ? '#C0272D' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: '700', color: isSel ? '#fff' : '#64748b' }}>
                                {dev.nome_pagador.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.875rem' }}>{dev.nome_pagador}</div>
                                {dev.status_cobranca === 'Novo' && (
                                  <span style={{ fontSize: '0.68rem', fontWeight: '800', background: '#C0272D', color: '#fff', padding: '1px 6px', borderRadius: '9999px', letterSpacing: '0.5px' }}>NOVO</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', color: '#475569', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                            {dev.telefone
                              ? <a href={`tel:${dev.telefone}`} onClick={e => e.stopPropagation()} style={{ color: '#0f2d4a', textDecoration: 'none', fontWeight: '500' }}>{dev.telefone}</a>
                              : <span style={{ color: '#e2e8f0' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', fontWeight: '700', color: qtdAbertos > 0 ? '#0f2d4a' : '#cbd5e1' }}>{qtdAbertos}</td>
                          <td style={{ padding: '0.8rem 0.875rem', fontWeight: '700', color: valAberto > 0 ? '#C0272D' : '#cbd5e1', whiteSpace: 'nowrap' }}>{fBRL(valAberto)}</td>
                          <td style={{ padding: '0.8rem 0.875rem' }}>
                            <span style={{ background: sStyle.bg, color: sStyle.color, borderRadius: '0.4rem', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: '700' }}>
                              {dev.status_cobranca || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', textAlign: 'center', fontSize: '1rem' }}>
                            {dev.pequenas_causas ? '⚖️' : <span style={{ color: '#e2e8f0' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                            {dev.data_audiencia ? (
                              <span style={{
                                fontWeight: '600',
                                color: dev.data_audiencia < todayISO() ? '#9ca3af' :
                                       dev.data_audiencia === todayISO() ? '#C0272D' :
                                       diffDias(dev.data_audiencia, todayISO()) <= 7 ? '#d97706' : '#475569'
                              }}>
                                {dev.data_audiencia === todayISO() ? '🔴 ' : diffDias(dev.data_audiencia, todayISO()) <= 7 && dev.data_audiencia > todayISO() ? '🟡 ' : ''}
                                {fDate(dev.data_audiencia)}
                              </span>
                            ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {fDate(dev.ultima_atualizacao)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Detalhe do devedor ── */}
          {selectedId && selectedDev && (
            <div id="detalhe-devedor" style={{ ...card, borderLeft: '4px solid #C0272D' }}>
              {/* cabeçalho do detalhe */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: '800', color: '#0f2d4a', fontSize: '1.05rem' }}>{selectedDev.nome_pagador}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    {abertos(selectedDev).length} boleto{abertos(selectedDev).length !== 1 ? 's' : ''} em aberto · Total: {fBRL(valorAberto(selectedDev))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => copiarCobranca(selectedDev)}
                    style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', background: copied ? '#16a34a' : '#f1f5f9', color: copied ? '#fff' : '#475569', border: 'none', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                  >{copied ? '✓ Copiado!' : '📋 Copiar cobrança'}</button>
                  <button
                    onClick={() => { setSelectedId(null); setEditForm({}) }}
                    style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', background: 'none', border: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}
                  >✕ Fechar</button>
                </div>
              </div>

              {/* Boletos */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Boletos</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                        {['Vencimento', 'Valor', 'Situação', 'Motivo', 'Data Liquidação', 'Valor Liquidado'].map(h => (
                          <th key={h} style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...(selectedDev.cobrancas_boletos || [])]
                        .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
                        .map(b => {
                          const emAberto = !b.data_liquidacao
                          return (
                            <tr key={b.id} style={{ borderBottom: '1px solid #f8fafc', background: emAberto ? 'transparent' : '#f8fffe' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: '#0f2d4a', whiteSpace: 'nowrap' }}>{fDate(b.data_vencimento)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: emAberto ? '#C0272D' : '#64748b', whiteSpace: 'nowrap' }}>{fBRL(b.valor)}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                {b.situacao_boleto
                                  ? <span style={{ background: emAberto ? '#fee2e2' : '#f0fdf4', color: emAberto ? '#991b1b' : '#166534', borderRadius: '0.35rem', padding: '0.15rem 0.5rem', fontSize: '0.75rem', fontWeight: '600' }}>{b.situacao_boleto}</span>
                                  : <span style={{ color: '#cbd5e1' }}>—</span>}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>{b.motivo || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                              <td style={{ padding: '0.5rem 0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>{fDate(b.data_liquidacao)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: '#16a34a', whiteSpace: 'nowrap' }}>
                                {b.valor_liquidacao != null ? fBRL(b.valor_liquidacao) : <span style={{ color: '#cbd5e1' }}>—</span>}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                    {abertos(selectedDev).length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#0f2d4a', fontSize: '0.75rem' }}>TOTAL EM ABERTO</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '800', color: '#C0272D', whiteSpace: 'nowrap' }}>{fBRL(valorAberto(selectedDev))}</td>
                          <td colSpan={4} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Formulário de cobrança */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                <div style={{ fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>Dados da cobrança</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem 1rem' }}>
                  {/* Telefone */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Telefone</label>
                    <input type="text" placeholder="(00) 00000-0000" value={editForm.telefone || ''}
                      onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))}
                      style={{ ...inputCss, width: '100%' }} />
                  </div>

                  {/* Status */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
                    <select value={editForm.status_cobranca || 'Novo'}
                      onChange={e => setEditForm(f => ({ ...f, status_cobranca: e.target.value }))}
                      style={{ ...inputCss, width: '100%' }}>
                      {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Data audiência */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data da audiência</label>
                    <input type="date" value={editForm.data_audiencia || ''}
                      onChange={e => setEditForm(f => ({ ...f, data_audiencia: e.target.value }))}
                      style={{ ...inputCss, width: '100%' }} />
                  </div>

                  {/* Pequenas causas */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingTop: '1.35rem' }}>
                    <input type="checkbox" id="pc-check" checked={!!editForm.pequenas_causas}
                      onChange={e => setEditForm(f => ({ ...f, pequenas_causas: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#C0272D' }} />
                    <label htmlFor="pc-check" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>⚖️ Pequenas causas</label>
                  </div>

                  {/* Situação audiência */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Situação da audiência</label>
                    <input type="text" placeholder="Ex: Aguardando pauta, Realizada..." value={editForm.situacao_audiencia || ''}
                      onChange={e => setEditForm(f => ({ ...f, situacao_audiencia: e.target.value }))}
                      style={{ ...inputCss, width: '100%' }} />
                  </div>
                </div>

                {/* Observações */}
                <div style={{ marginTop: '0.875rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observações</label>
                  <textarea rows={3} placeholder="Anotações sobre negociação, contatos, acordo..."
                    value={editForm.observacoes || ''}
                    onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))}
                    style={{ ...inputCss, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.625rem' }}>
                  <button
                    onClick={salvarDevedor} disabled={salvando}
                    style={{ padding: '0.6rem 1.25rem', background: '#C0272D', color: '#fff', border: 'none', borderRadius: '0.6rem', fontSize: '0.875rem', fontWeight: '700', cursor: salvando ? 'not-allowed' : 'pointer', opacity: salvando ? 0.7 : 1 }}
                  >{salvando ? 'Salvando…' : 'Salvar'}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════ VIEW: AUDIÊNCIAS ════════ */}
      {view === 'audiencias' && (
        <div style={card}>
          <div style={{ fontWeight: '700', color: '#0f2d4a', fontSize: '0.95rem', marginBottom: '1rem' }}>
            Audiências marcadas — {comAudiencia.length} devedor{comAudiencia.length !== 1 ? 'es' : ''}
          </div>

          {comAudiencia.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
              <div style={{ fontWeight: '600' }}>Nenhuma audiência marcada.</div>
              <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Edite um devedor e preencha a data da audiência.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Data', 'Devedor', 'Situação da audiência', 'Status cobrança', 'Em aberto'].map(h => (
                      <th key={h} style={{ padding: '0.55rem 0.875rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comAudiencia.map(dev => {
                    const hoje = todayISO()
                    const dias = diffDias(dev.data_audiencia, hoje)
                    const isHoje   = dev.data_audiencia === hoje
                    const isProxima = dias > 0 && dias <= 7
                    const isPassada = dev.data_audiencia < hoje
                    const rowBg = isHoje ? '#fff5f5' : isProxima ? '#fffbeb' : 'transparent'
                    const sStyle = statusStyle(dev.status_cobranca)
                    return (
                      <tr
                        key={dev.id}
                        onClick={() => { setView('lista'); selecionar(dev.id) }}
                        style={{ borderBottom: '1px solid #f8fafc', background: rowBg, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        <td style={{ padding: '0.7rem 0.875rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '800', color: isHoje ? '#C0272D' : isProxima ? '#d97706' : isPassada ? '#9ca3af' : '#0f2d4a', fontSize: '0.9rem' }}>
                            {isHoje ? '🔴 HOJE' : isProxima ? `🟡 ${fDate(dev.data_audiencia)}` : fDate(dev.data_audiencia)}
                          </div>
                          {isHoje   && <div style={{ fontSize: '0.72rem', color: '#C0272D', fontWeight: '600' }}>Audiência hoje!</div>}
                          {isProxima && <div style={{ fontSize: '0.72rem', color: '#d97706' }}>em {dias} dia{dias > 1 ? 's' : ''}</div>}
                          {isPassada && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>há {Math.abs(dias)} dia{Math.abs(dias) > 1 ? 's' : ''}</div>}
                        </td>
                        <td style={{ padding: '0.7rem 0.875rem', fontWeight: '700', color: '#1e293b' }}>{dev.nome_pagador}</td>
                        <td style={{ padding: '0.7rem 0.875rem', color: '#475569', fontSize: '0.82rem' }}>{dev.situacao_audiencia || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                        <td style={{ padding: '0.7rem 0.875rem' }}>
                          <span style={{ background: sStyle.bg, color: sStyle.color, borderRadius: '0.4rem', padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: '700' }}>
                            {dev.status_cobranca}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem 0.875rem', fontWeight: '700', color: '#C0272D', whiteSpace: 'nowrap' }}>
                          {fBRL(valorAberto(dev))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
