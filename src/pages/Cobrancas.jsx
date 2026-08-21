import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { C, F, card as dsCard, inputCss as dsInputCss } from '../lib/ds'

/* inputCss sem width — usado em células de tabela com larguras variadas */
const { width: _w, ...inputCss } = dsInputCss

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
function fBytes(b) {
  if (!b) return '—'
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}
function tipoIcon(tipo) {
  if (!tipo) return '📎'
  if (tipo.includes('pdf')) return '📄'
  if (tipo.includes('image')) return '🖼️'
  if (tipo.includes('word') || tipo.includes('docx')) return '📝'
  return '📎'
}
function diffDias(isoA, isoB) {
  return Math.round((new Date(isoA) - new Date(isoB)) / 86400000)
}

function statusStyle(s) {
  return {
    'Novo':         { bg: C.statusDangerBg,  color: C.statusDanger  },
    'Em andamento': { bg: C.statusInfoBg,    color: C.statusInfo    },
    'Negociado':    { bg: C.statusWarningBg, color: C.statusWarning },
    'Protestado':   { bg: '#f3e8ff',         color: '#6b21a8'       },
    'Quitado':      { bg: C.statusSuccessBg, color: C.statusSuccess },
  }[s] || { bg: C.surfaceContainerHigh, color: C.onSurfaceVariant }
}

/* ── detectar período do relatório (linhas antes do cabeçalho ou min/max vencimento) ── */
function detectarPeriodo(preHeaderRows, boletos) {
  const re = /(\d{2}\/\d{2}\/\d{4})\s+(?:a|até|ate)\s+(\d{2}\/\d{2}\/\d{4})/i
  for (const row of preHeaderRows) {
    const text = (row || []).map(c => (c != null ? String(c) : '')).join(' ')
    const m = re.exec(text)
    if (m) {
      const [d1, mo1, y1] = m[1].split('/'), [d2, mo2, y2] = m[2].split('/')
      return {
        periodoInicio: `${y1}-${mo1}-${d1}`,
        periodoFim:    `${y2}-${mo2}-${d2}`,
      }
    }
  }
  const datas = boletos.map(b => b.data_vencimento).filter(Boolean).sort()
  return { periodoInicio: datas[0] || null, periodoFim: datas[datas.length - 1] || null }
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
    const temNosso   = row.some(c => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes('nosso'))
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
      carteira:         String(row[colMap.carteira]        ?? '').trim() || null,
      numero_doc:       String(row[colMap.numero_doc]      ?? '').trim() || null,
      nosso_numero:     String(row[colMap.nosso_numero]    ?? '').trim() || null,
      txid:             String(row[colMap.txid]            ?? '').trim() || null,
      nome_pagador:     nomePagador,
      data_vencimento:  parseDataBR(row[colMap.data_vencimento]),
      data_liquidacao:  parseDataBR(row[colMap.data_liquidacao]) || null,
      valor:            parseBRL(row[colMap.valor]),
      valor_liquidacao: parseBRL(row[colMap.valor_liquidacao]),
      situacao_boleto:  String(row[colMap.situacao_boleto] ?? '').trim() || null,
      motivo:           String(row[colMap.motivo]          ?? '').trim() || null,
    })
  }
  if (boletos.length === 0) throw new Error('Nenhuma linha de boleto encontrada após o cabeçalho.')
  const { periodoInicio, periodoFim } = detectarPeriodo(rows.slice(0, headerIdx), boletos)
  return { boletos, periodoInicio, periodoFim }
}

/* ── importar boletos no Supabase (com filial) ── */
async function importarBoletos(boletos, filialId, { periodoInicio, periodoFim, nomeArquivo, importadoPor } = {}) {
  const hoje = todayISO()

  const uniqueNorm = [...new Set(boletos.map(b => normalizarNome(b.nome_pagador)).filter(Boolean))]
  if (uniqueNorm.length === 0) throw new Error('Nenhum pagador válido encontrado.')

  // nome_normalizado é globalmente único — busca sem filtro de filial
  const { data: existentesDB, error: e1 } = await supabase
    .from('cobrancas_devedores').select('id, nome_normalizado, filial_id').in('nome_normalizado', uniqueNorm)
  if (e1) throw new Error(e1.message)

  const mapId = {}
  existentesDB?.forEach(d => { mapId[d.nome_normalizado] = d.id })

  const novosNorm  = uniqueNorm.filter(n => !mapId[n])
  const novosNomes = novosNorm.map(norm =>
    boletos.find(b => normalizarNome(b.nome_pagador) === norm)?.nome_pagador || norm
  )
  if (novosNorm.length > 0) {
    const { data: inseridos, error: e2 } = await supabase
      .from('cobrancas_devedores')
      .insert(novosNorm.map((norm, i) => ({
        nome_pagador:       novosNomes[i],
        nome_normalizado:   norm,
        filial_id:          filialId || null,
        status_cobranca:    'Novo',
        primeiro_registro:  hoje,
        ultima_atualizacao: hoje,
      })))
      .select('id, nome_normalizado')
    if (e2) throw new Error(e2.message)
    inseridos?.forEach(d => { mapId[d.nome_normalizado] = d.id })

    if (novosNomes.length > 0) {
      await supabase.from('clientes').insert(novosNomes.map(nome => ({ nome })))
    }
  }

  const idsExistentes = existentesDB?.map(d => d.id) || []
  if (idsExistentes.length > 0) {
    if (filialId) {
      // vincula à filial os devedores que ainda não têm filial; os demais só atualiza data
      const semFilial = existentesDB.filter(d => !d.filial_id).map(d => d.id)
      const comFilial = existentesDB.filter(d =>  d.filial_id).map(d => d.id)
      if (semFilial.length > 0)
        await supabase.from('cobrancas_devedores').update({ ultima_atualizacao: hoje, filial_id: filialId }).in('id', semFilial)
      if (comFilial.length > 0)
        await supabase.from('cobrancas_devedores').update({ ultima_atualizacao: hoje }).in('id', comFilial)
    } else {
      await supabase.from('cobrancas_devedores').update({ ultima_atualizacao: hoje }).in('id', idsExistentes)
    }
  }

  const nossoNums = boletos.map(b => b.nosso_numero).filter(Boolean)
  const setExistentes = new Set()
  if (nossoNums.length > 0) {
    let qBol = supabase.from('cobrancas_boletos').select('nosso_numero').in('nosso_numero', nossoNums)
    if (filialId) qBol = qBol.eq('filial_id', filialId)
    const { data: boletosDB } = await qBol
    boletosDB?.forEach(b => { setExistentes.add(b.nosso_numero) })
  }

  const paraInserir   = []
  const paraAtualizar = []
  boletos.forEach(b => {
    const devedorId = mapId[normalizarNome(b.nome_pagador)]
    if (!devedorId) return
    const payload = {
      devedor_id: devedorId, filial_id: filialId || null,
      carteira: b.carteira, numero_doc: b.numero_doc,
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
    const patch = {
      data_vencimento:  b.data_vencimento,
      data_liquidacao:  b.data_liquidacao,
      valor:            b.valor,
      valor_liquidacao: b.valor_liquidacao,
    }
    if (b.situacao_boleto) patch.situacao_boleto = b.situacao_boleto
    if (b.motivo)          patch.motivo          = b.motivo
    let q = supabase.from('cobrancas_boletos').update(patch).eq('nosso_numero', b.nosso_numero)
    if (filialId) q = q.eq('filial_id', filialId)
    await q
  }

  // log import (silently ignore if table doesn't exist yet)
  try {
    await supabase.from('cobrancas_importacoes').insert({
      filial_id:       filialId        || null,
      periodo_inicio:  periodoInicio   || null,
      periodo_fim:     periodoFim      || null,
      nome_arquivo:    nomeArquivo     || null,
      importado_por:   importadoPor    || null,
      total_boletos:   boletos.length,
      inseridos:       paraInserir.length,
      atualizados:     paraAtualizar.length,
      novos_devedores: novosNomes.length,
    })
  } catch (_) { /* tabela ainda não criada */ }

  return {
    total: boletos.length,
    inseridos: paraInserir.length,
    atualizados: paraAtualizar.length,
    novosDevedores: novosNomes,
    devedoresAtualizados: idsExistentes.length,
  }
}

const STATUS_OPTS = ['Novo', 'Em andamento', 'Negociado', 'Protestado', 'Quitado']
const SITUACAO_BOLETO_OPTS = ['Em aberto', 'Vencido', 'Acordo parcial', 'Liquidado', 'Cancelado', 'Protestado']

/* ════════════════════════════════ COMPONENTE PRINCIPAL ════════════════════════════════ */
export default function Cobrancas() {
  const { isAdmin, profile } = useAuth()
  const fileRef    = useRef()
  const docFileRef = useRef()

  const [view,             setView]             = useState('lista')
  const [devedores,        setDevedores]        = useState([])
  const [filiais,          setFiliais]          = useState([])
  const [filtroFilial,     setFiltroFilial]     = useState('')
  const [loading,          setLoading]          = useState(true)
  const [editForm,         setEditForm]         = useState({})
  const [salvando,         setSalvando]         = useState(false)
  const [importando,       setImportando]       = useState(false)
  const [importErr,        setImportErr]        = useState(null)
  const [resultado,        setResultado]        = useState(null)
  const [copied,           setCopied]           = useState(false)

  const [modalDev,         setModalDev]         = useState(null)
  const [boletoEdits,      setBoletoEdits]      = useState({})
  const [savingBoleto,     setSavingBoleto]     = useState(new Set())

  const [importStep,           setImportStep]           = useState('closed') // 'closed' | 'selecting' | 'preview'
  const [importFilialId,       setImportFilialId]       = useState('')
  const [importParsed,         setImportParsed]         = useState(null)
  const [importPeriodoInicio,  setImportPeriodoInicio]  = useState('')
  const [importPeriodoFim,     setImportPeriodoFim]     = useState('')
  const [importFileName,       setImportFileName]       = useState('')
  const [historico,            setHistorico]            = useState([])
  const [loadingHistorico,     setLoadingHistorico]     = useState(false)

  const [filtros, setFiltros] = useState({
    busca: '', status: '', somenteNovos: false, somentePC: false, somenteAudiencia: false,
  })
  const [filtroVencInicio, setFiltroVencInicio] = useState('')
  const [filtroVencFim,    setFiltroVencFim]    = useState('')

  const [docs,         setDocs]         = useState([])
  const [loadingDocs,  setLoadingDocs]  = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docDescricao, setDocDescricao] = useState('')
  const [docDragOver,  setDocDragOver]  = useState(false)
  const [docErr,       setDocErr]       = useState(null)

  /* ── carregamento ── */
  const carregar = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('cobrancas_devedores')
      .select(`
        id, nome_pagador, telefone, filial_id, status_cobranca, primeiro_registro, ultima_atualizacao,
        pequenas_causas, data_audiencia, situacao_audiencia, observacoes,
        cobrancas_boletos (
          id, data_vencimento, data_liquidacao, valor, valor_liquidacao,
          situacao_boleto, motivo, numero_doc, nosso_numero, carteira
        )
      `)
      .order('ultima_atualizacao', { ascending: false })
    if (filtroFilial) q = q.eq('filial_id', filtroFilial)
    else if (!isAdmin && profile?.filial_id) q = q.eq('filial_id', profile.filial_id)
    const { data } = await q
    setDevedores(data || [])
    setLoading(false)
  }, [filtroFilial, isAdmin, profile?.filial_id])

  useEffect(() => {
    supabase.from('filiais').select('*').order('nome').then(({ data }) => {
      setFiliais(data || [])
      setImportFilialId(data?.[0]?.id || '')
    })
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
    if (filtroVencInicio || filtroVencFim) {
      const match = (dev.cobrancas_boletos || []).some(b => {
        if (!b.data_vencimento) return false
        if (filtroVencInicio && b.data_vencimento < filtroVencInicio) return false
        if (filtroVencFim    && b.data_vencimento > filtroVencFim)    return false
        return true
      })
      if (!match) return false
    }
    return true
  })

  /* ── modal do devedor ── */
  function abrirModal(dev) {
    const edits = {}
    ;(dev.cobrancas_boletos || []).forEach(b => {
      edits[b.id] = { situacao_boleto: b.situacao_boleto || '', motivo: b.motivo || '', dirty: false }
    })
    setBoletoEdits(edits)
    setEditForm({
      status_cobranca:    dev.status_cobranca    || 'Novo',
      telefone:           dev.telefone           || '',
      pequenas_causas:    dev.pequenas_causas    || false,
      data_audiencia:     dev.data_audiencia     || '',
      situacao_audiencia: dev.situacao_audiencia || '',
      observacoes:        dev.observacoes        || '',
    })
    setModalDev(dev)
    if (isAdmin) carregarDocs(dev.id)
  }

  function fecharModal() {
    setModalDev(null); setBoletoEdits({}); setEditForm({})
    setDocs([]); setDocErr(null); setDocDescricao('')
  }

  function updateBoletoEdit(boletoId, field, value) {
    setBoletoEdits(prev => ({ ...prev, [boletoId]: { ...prev[boletoId], [field]: value, dirty: true } }))
  }

  async function salvarBoleto(boletoId) {
    const edit = boletoEdits[boletoId]
    if (!edit) return
    setSavingBoleto(prev => new Set(prev).add(boletoId))
    const { error } = await supabase.from('cobrancas_boletos').update({
      situacao_boleto: edit.situacao_boleto || null,
      motivo:          edit.motivo          || null,
    }).eq('id', boletoId)
    setSavingBoleto(prev => { const s = new Set(prev); s.delete(boletoId); return s })
    if (!error) {
      const patchBoletos = (bols) => (bols || []).map(b =>
        b.id === boletoId ? { ...b, situacao_boleto: edit.situacao_boleto || null, motivo: edit.motivo || null } : b
      )
      setModalDev(prev => prev ? { ...prev, cobrancas_boletos: patchBoletos(prev.cobrancas_boletos) } : null)
      setDevedores(prev => prev.map(d =>
        d.id === modalDev?.id ? { ...d, cobrancas_boletos: patchBoletos(d.cobrancas_boletos) } : d
      ))
      setBoletoEdits(prev => ({ ...prev, [boletoId]: { ...prev[boletoId], dirty: false } }))
    }
  }

  /* ── importar arquivo ── */
  async function carregarHistorico() {
    setLoadingHistorico(true)
    const { data } = await supabase
      .from('cobrancas_importacoes')
      .select('id, created_at, nome_arquivo, filial_id, periodo_inicio, periodo_fim, total_boletos, inseridos, atualizados')
      .order('created_at', { ascending: false })
      .limit(3)
    setHistorico(data || [])
    setLoadingHistorico(false)
  }

  function clickImportar() {
    setImportStep('selecting')
    setImportParsed(null)
    setImportFileName('')
    setImportPeriodoInicio('')
    setImportPeriodoFim('')
    setImportErr(null)
    carregarHistorico()
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportando(true)
    setImportErr(null)
    try {
      const { boletos, periodoInicio, periodoFim } = await parseFile(file)
      setImportParsed({ boletos })
      setImportFileName(file.name)
      setImportPeriodoInicio(periodoInicio || '')
      setImportPeriodoFim(periodoFim || '')
      setImportStep('preview')
    } catch (err) {
      setImportErr(err.message)
    } finally {
      setImportando(false)
    }
  }

  async function confirmarImport() {
    if (!importParsed) return
    setImportando(true)
    setImportErr(null)
    setResultado(null)
    try {
      const res = await importarBoletos(importParsed.boletos, importFilialId || null, {
        periodoInicio: importPeriodoInicio || null,
        periodoFim:    importPeriodoFim    || null,
        nomeArquivo:   importFileName      || null,
        importadoPor:  profile?.id         || null,
      })
      setResultado(res)
      setImportStep('closed')
      await carregar()
    } catch (err) {
      setImportErr(err.message)
    } finally {
      setImportando(false)
    }
  }

  /* ── salvar devedor ── */
  async function salvarDevedor() {
    if (!modalDev) return
    setSalvando(true)
    await supabase.from('cobrancas_devedores').update({
      status_cobranca:    editForm.status_cobranca,
      telefone:           editForm.telefone || null,
      pequenas_causas:    editForm.pequenas_causas,
      data_audiencia:     editForm.data_audiencia || null,
      situacao_audiencia: editForm.situacao_audiencia || null,
      observacoes:        editForm.observacoes || null,
      ultima_atualizacao: todayISO(),
    }).eq('id', modalDev.id)

    const nomeDev = modalDev.nome_pagador
    if (nomeDev) {
      const { data: cli } = await supabase.from('clientes').select('id, telefone').ilike('nome', nomeDev).limit(1)
      if (cli?.length) {
        if (editForm.telefone && !cli[0].telefone) {
          await supabase.from('clientes').update({ telefone: editForm.telefone }).eq('id', cli[0].id)
        }
      } else {
        await supabase.from('clientes').insert({ nome: nomeDev, telefone: editForm.telefone || null })
      }
    }

    await carregar()
    setSalvando(false)
    setModalDev(prev => prev ? {
      ...prev,
      status_cobranca:    editForm.status_cobranca,
      telefone:           editForm.telefone || null,
      pequenas_causas:    editForm.pequenas_causas,
      data_audiencia:     editForm.data_audiencia || null,
      situacao_audiencia: editForm.situacao_audiencia || null,
      observacoes:        editForm.observacoes || null,
    } : null)
  }

  /* ── documentos ── */
  async function carregarDocs(devedorId) {
    setLoadingDocs(true)
    const { data } = await supabase
      .from('cobrancas_documentos')
      .select('id, nome_arquivo, caminho, tipo, tamanho, descricao, created_at')
      .eq('devedor_id', devedorId)
      .order('created_at', { ascending: false })
    setDocs(data || [])
    setLoadingDocs(false)
  }

  async function handleDocUpload(file) {
    if (!file) return
    setDocErr(null)
    const tiposOk = [
      'application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!tiposOk.includes(file.type)) {
      return setDocErr('Tipo não permitido. Use PDF, JPG, PNG ou DOCX.')
    }
    if (file.size > 10 * 1024 * 1024) {
      return setDocErr('Arquivo muito grande. O limite é 10 MB.')
    }
    if (!modalDev) return
    setUploadingDoc(true)
    try {
      const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const caminho = `${modalDev.id}/${Date.now()}-${nomeSeguro}`
      const { error: upErr } = await supabase.storage
        .from('cobrancas-documentos')
        .upload(caminho, file, { contentType: file.type })
      if (upErr) throw new Error(upErr.message)
      const { error: dbErr } = await supabase.from('cobrancas_documentos').insert({
        devedor_id:   modalDev.id,
        nome_arquivo: file.name,
        caminho,
        tipo:         file.type,
        tamanho:      file.size,
        descricao:    docDescricao || null,
        enviado_por:  profile?.id || null,
      })
      if (dbErr) throw new Error(dbErr.message)
      setDocDescricao('')
      await carregarDocs(modalDev.id)
    } catch (err) {
      setDocErr(err.message)
    } finally {
      setUploadingDoc(false)
    }
  }

  async function visualizarDoc(doc) {
    const { data, error } = await supabase.storage
      .from('cobrancas-documentos')
      .createSignedUrl(doc.caminho, 3600)
    if (error) return setDocErr('Não foi possível gerar o link de acesso.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function excluirDoc(doc) {
    if (!window.confirm(`Excluir "${doc.nome_arquivo}"?\nEsta ação não pode ser desfeita.`)) return
    const { error: stErr } = await supabase.storage
      .from('cobrancas-documentos')
      .remove([doc.caminho])
    if (stErr) return setDocErr('Erro ao excluir arquivo: ' + stErr.message)
    const { error: dbErr } = await supabase.from('cobrancas_documentos').delete().eq('id', doc.id)
    if (dbErr) return setDocErr('Erro ao excluir registro: ' + dbErr.message)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  /* ── copiar cobrança ── */
  function copiarCobranca(dev) {
    const lista = abertos(dev).sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
    const total = valorAberto(dev)
    const linhas = lista.map(b =>
      `• Venc. ${fDate(b.data_vencimento)} — ${fBRL(b.valor)}${b.situacao_boleto ? ` [${b.situacao_boleto}]` : ''}`
    ).join('\n')
    const telLinha = dev.telefone ? `\nTelefone: ${dev.telefone}` : ''
    const txt = `*COBRANÇA — ${dev.nome_pagador}*${telLinha}\n\nBoleto(s) em aberto:\n${linhas}\n\n*Total em aberto: ${fBRL(total)}*\n\nEntre em contato para regularizar sua situação.`
    navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200) })
  }

  /* ── audiências ── */
  const comAudiencia = [...devedores].filter(d => d.data_audiencia).sort((a, b) => a.data_audiencia.localeCompare(b.data_audiencia))
  const filialMap = Object.fromEntries(filiais.map(f => [f.id, f.nome]))
  const temFiltrosVenc = filtroVencInicio || filtroVencFim

  /* ════════════════════ RENDER ════════════════════ */

  return (
    <div className="pg">

      {/* ── Modal de importação (selecionar / preview) ── */}
      {importStep !== 'closed' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,45,74,0.50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={() => importStep === 'selecting' && setImportStep('closed')}>
          <div style={{
            background: C.surfaceContainerLowest, borderRadius: '1rem', padding: '1.75rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: '480px',
          }} onClick={e => e.stopPropagation()}>

            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: '800', color: C.onSurface, fontSize: '1.05rem', fontFamily: F.headline }}>
                {importStep === 'selecting' ? '⬆️ Importar relatório' : '✅ Confirmar importação'}
              </div>
              <button onClick={() => setImportStep('closed')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.onSurfaceVariant, fontSize: '1.1rem', lineHeight: 1, padding: '0.2rem 0.4rem' }}>
                ✕
              </button>
            </div>

            {/* Erro */}
            {importErr && (
              <div style={{ background: C.statusDangerBg, border: `1px solid ${C.statusDanger}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ color: C.statusDanger, fontSize: '0.82rem', fontFamily: F.body }}>{importErr}</span>
                <button onClick={() => setImportErr(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.statusDanger, fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>
            )}

            {importStep === 'selecting' ? (
              <>
                {/* Filial */}
                {filiais.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: C.onSurfaceVariant, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body }}>Filial</label>
                    <select value={importFilialId} onChange={e => setImportFilialId(e.target.value)}
                      style={{ ...inputCss, width: '100%' }}>
                      <option value="">Sem filial</option>
                      {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </div>
                )}

                {/* Botão selecionar arquivo */}
                <button onClick={() => fileRef.current?.click()} disabled={importando}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.6rem', background: C.primaryContainer, color: C.onPrimary, border: 'none', fontSize: '0.9rem', fontWeight: '700', cursor: importando ? 'not-allowed' : 'pointer', opacity: importando ? 0.7 : 1, fontFamily: F.body, marginBottom: '1.5rem' }}>
                  {importando ? '⏳ Lendo arquivo…' : '📂 Selecionar arquivo (.xlsx / .csv)'}
                </button>

                {/* Histórico */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.625rem', fontFamily: F.body }}>
                    Últimas importações
                  </div>
                  {loadingHistorico ? (
                    <div style={{ color: C.onSurfaceVariant, fontSize: '0.82rem', fontFamily: F.body }}>Carregando…</div>
                  ) : historico.length === 0 ? (
                    <div style={{ color: C.outlineVariant, fontSize: '0.82rem', fontFamily: F.body }}>Nenhuma importação registrada ainda.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {historico.map(h => {
                        const filNome = filiais.find(f => f.id === h.filial_id)?.nome
                        return (
                          <div key={h.id} style={{ background: C.surfaceContainerLow, borderRadius: '0.5rem', padding: '0.6rem 0.75rem', border: `1px solid ${C.borderSubtle}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '600', color: C.onSurface, fontSize: '0.82rem', fontFamily: F.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                📄 {h.nome_arquivo || 'Arquivo'}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: C.onSurfaceVariant, fontFamily: F.body, whiteSpace: 'nowrap' }}>
                                {h.created_at ? new Date(h.created_at).toLocaleDateString('pt-BR') : ''}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: C.onSurfaceVariant, fontFamily: F.body, marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {filNome && <span style={{ background: C.surfaceContainerHigh, borderRadius: '0.3rem', padding: '1px 5px' }}>{filNome}</span>}
                              {(h.periodo_inicio || h.periodo_fim) && (
                                <span>{fDate(h.periodo_inicio)} – {fDate(h.periodo_fim)}</span>
                              )}
                              <span>· {h.total_boletos} boleto{h.total_boletos !== 1 ? 's' : ''}</span>
                              <span>· {h.inseridos} novo{h.inseridos !== 1 ? 's' : ''}</span>
                              <span>· {h.atualizados} atualizado{h.atualizados !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── Preview / confirmar ── */
              <>
                {/* Resumo do arquivo */}
                <div style={{ background: C.surfaceContainerLow, borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1.25rem', border: `1px solid ${C.borderSubtle}` }}>
                  <div style={{ fontWeight: '600', color: C.onSurface, fontSize: '0.85rem', fontFamily: F.body, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📄 {importFileName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: C.onSurfaceVariant, fontFamily: F.body }}>
                    {importParsed?.boletos?.length ?? 0} boleto{(importParsed?.boletos?.length ?? 0) !== 1 ? 's' : ''} encontrado{(importParsed?.boletos?.length ?? 0) !== 1 ? 's' : ''}
                    {importFilialId && filiais.find(f => f.id === importFilialId) && (
                      <span> · Filial: <strong>{filiais.find(f => f.id === importFilialId)?.nome}</strong></span>
                    )}
                  </div>
                </div>

                {/* Período */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: C.onSurfaceVariant, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body }}>
                    Período do relatório
                    {importPeriodoInicio && importPeriodoFim && (
                      <span style={{ marginLeft: '0.5rem', fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: C.statusSuccess, fontSize: '0.72rem' }}>
                        ✓ detectado automaticamente
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="date" value={importPeriodoInicio} onChange={e => setImportPeriodoInicio(e.target.value)}
                      style={{ ...inputCss, flex: 1 }} />
                    <span style={{ color: C.onSurfaceVariant, fontFamily: F.body, fontSize: '0.82rem' }}>até</span>
                    <input type="date" value={importPeriodoFim} onChange={e => setImportPeriodoFim(e.target.value)}
                      style={{ ...inputCss, flex: 1 }} />
                  </div>
                </div>

                {/* Botões */}
                <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setImportStep('selecting')} disabled={importando}
                    style={{ padding: '0.55rem 1rem', borderRadius: '0.6rem', background: C.surfaceContainerLow, color: C.onSurfaceVariant, border: 'none', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
                    ← Voltar
                  </button>
                  <button onClick={confirmarImport} disabled={importando}
                    style={{ padding: '0.55rem 1.25rem', borderRadius: '0.6rem', background: C.primaryContainer, color: C.onPrimary, border: 'none', fontSize: '0.875rem', fontWeight: '700', cursor: importando ? 'not-allowed' : 'pointer', opacity: importando ? 0.7 : 1, fontFamily: F.body }}>
                    {importando ? '⏳ Importando…' : '✅ Confirmar importação'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ── Modal do devedor ── */}
      {modalDev && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,45,74,0.50)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem',
          overflowY: 'auto',
        }} onClick={fecharModal}>
          <div style={{
            background: C.surfaceContainerLowest, borderRadius: '1.25rem', width: '100%', maxWidth: '900px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.28)', border: `2px solid ${C.borderSubtle}`,
            margin: 'auto',
          }} onClick={e => e.stopPropagation()}>

            {/* cabeçalho do modal */}
            <div style={{ padding: '1.5rem 1.75rem', borderBottom: `1px solid ${C.borderSubtle}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: '800', color: C.onSurface, fontSize: '1.15rem', fontFamily: F.headline }}>{modalDev.nome_pagador}</div>
                <div style={{ fontSize: '0.8rem', color: C.onSurfaceVariant, marginTop: '2px', fontFamily: F.body }}>
                  {abertos(modalDev).length} boleto{abertos(modalDev).length !== 1 ? 's' : ''} em aberto
                  {' · '}Total: <strong style={{ color: C.statusDanger, fontFamily: F.mono }}>{fBRL(valorAberto(modalDev))}</strong>
                  {modalDev.filial_id && filialMap[modalDev.filial_id] && (
                    <span style={{ marginLeft: '0.5rem', background: C.surfaceContainerLow, borderRadius: '0.35rem', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: '600', color: C.onSurfaceVariant }}>
                      {filialMap[modalDev.filial_id]}
                    </span>
                  )}
                  {isAdmin && docs.length > 0 && (
                    <span style={{ marginLeft: '0.5rem', background: '#9d0518', color: '#fff', borderRadius: '0.35rem', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: '700' }}>
                      {docs.length} doc{docs.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button onClick={() => copiarCobranca(modalDev)}
                  style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', background: copied ? C.statusSuccess : C.surfaceContainerLow, color: copied ? C.onPrimary : C.onSurfaceVariant, border: 'none', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontFamily: F.body }}>
                  {copied ? '✓ Copiado!' : '📋 Copiar cobrança'}
                </button>
                <button onClick={fecharModal}
                  style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', background: 'none', border: `1.5px solid ${C.borderSubtle}`, color: C.onSurfaceVariant, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
                  ✕ Fechar
                </button>
              </div>
            </div>

            <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Boletos */}
              <div>
                <div style={{ fontWeight: '700', color: C.onSurfaceVariant, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.625rem', fontFamily: F.body }}>
                  Boletos
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: C.tableHeader, borderBottom: `1.5px solid ${C.borderSubtle}` }}>
                        {['Nosso Nº', 'Vencimento', 'Valor', 'Situação', 'Motivo', 'Data Liquidação', 'Valor Liquidado', ''].map(h => (
                          <th key={h} style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: C.onSurfaceVariant, textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: F.body }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...(modalDev.cobrancas_boletos || [])]
                        .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
                        .map(b => {
                          const emAberto = !b.data_liquidacao
                          const edit = boletoEdits[b.id] || { situacao_boleto: b.situacao_boleto || '', motivo: b.motivo || '', dirty: false }
                          const isSaving = savingBoleto.has(b.id)
                          return (
                            <tr key={b.id} style={{ borderBottom: `1px solid ${C.borderSubtle}`, background: emAberto ? 'transparent' : C.statusSuccessBg + '33' }}>
                              <td style={{ padding: '0.5rem 0.75rem', color: C.onSurfaceVariant, whiteSpace: 'nowrap', fontFamily: F.mono, fontSize: '0.8rem' }}>
                                {b.nosso_numero || <span style={{ color: C.outlineVariant }}>—</span>}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: C.onSurface, whiteSpace: 'nowrap', fontFamily: F.mono }}>
                                {fDate(b.data_vencimento)}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: emAberto ? C.statusDanger : C.onSurfaceVariant, whiteSpace: 'nowrap', fontFamily: F.mono }}>
                                {fBRL(b.valor)}
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem', minWidth: '140px' }}>
                                <select value={edit.situacao_boleto}
                                  onChange={e => updateBoletoEdit(b.id, 'situacao_boleto', e.target.value)}
                                  style={{ ...inputCss, padding: '0.3rem 0.5rem', fontSize: '0.78rem', width: '100%' }}>
                                  <option value="">—</option>
                                  {SITUACAO_BOLETO_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                                  {edit.situacao_boleto && !SITUACAO_BOLETO_OPTS.includes(edit.situacao_boleto) && (
                                    <option value={edit.situacao_boleto}>{edit.situacao_boleto}</option>
                                  )}
                                </select>
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem', minWidth: '160px' }}>
                                <input value={edit.motivo}
                                  onChange={e => updateBoletoEdit(b.id, 'motivo', e.target.value)}
                                  placeholder="Motivo..."
                                  style={{ ...inputCss, padding: '0.3rem 0.5rem', fontSize: '0.78rem', width: '100%' }} />
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', color: C.onSurfaceVariant, whiteSpace: 'nowrap', fontFamily: F.mono }}>{fDate(b.data_liquidacao)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: C.statusSuccess, whiteSpace: 'nowrap', fontFamily: F.mono }}>
                                {b.valor_liquidacao != null ? fBRL(b.valor_liquidacao) : <span style={{ color: C.outlineVariant }}>—</span>}
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>
                                {edit.dirty && (
                                  <button onClick={() => salvarBoleto(b.id)} disabled={isSaving}
                                    style={{ padding: '0.3rem 0.65rem', background: C.primaryContainer, color: C.onPrimary, border: 'none', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: '700', cursor: isSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: isSaving ? 0.7 : 1, fontFamily: F.body }}>
                                    {isSaving ? '…' : 'Salvar'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                    {abertos(modalDev).length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${C.borderSubtle}`, background: C.surfaceContainerLow }}>
                          <td colSpan={2} style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: C.onSurface, fontSize: '0.75rem', fontFamily: F.body }}>TOTAL EM ABERTO</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '800', color: C.statusDanger, whiteSpace: 'nowrap', fontFamily: F.mono }}>{fBRL(valorAberto(modalDev))}</td>
                          <td colSpan={5} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Formulário de cobrança */}
              <div style={{ borderTop: `1px solid ${C.borderSubtle}`, paddingTop: '1.25rem' }}>
                <div style={{ fontWeight: '700', color: C.onSurfaceVariant, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', fontFamily: F.body }}>Dados da cobrança</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem 1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: C.onSurfaceVariant, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body }}>Telefone</label>
                    <input type="text" placeholder="(00) 00000-0000" value={editForm.telefone || ''}
                      onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))}
                      style={{ ...inputCss, width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: C.onSurfaceVariant, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body }}>Status</label>
                    <select value={editForm.status_cobranca || 'Novo'}
                      onChange={e => setEditForm(f => ({ ...f, status_cobranca: e.target.value }))}
                      style={{ ...inputCss, width: '100%' }}>
                      {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: C.onSurfaceVariant, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body }}>Data da audiência</label>
                    <input type="date" value={editForm.data_audiencia || ''}
                      onChange={e => setEditForm(f => ({ ...f, data_audiencia: e.target.value }))}
                      style={{ ...inputCss, width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingTop: '1.35rem' }}>
                    <input type="checkbox" id="pc-check-modal" checked={!!editForm.pequenas_causas}
                      onChange={e => setEditForm(f => ({ ...f, pequenas_causas: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: C.primaryContainer }} />
                    <label htmlFor="pc-check-modal" style={{ fontSize: '0.875rem', fontWeight: '600', color: C.onSurfaceVariant, cursor: 'pointer', fontFamily: F.body }}>⚖️ Pequenas causas</label>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: C.onSurfaceVariant, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body }}>Situação da audiência</label>
                    <input type="text" placeholder="Ex: Aguardando pauta, Realizada..." value={editForm.situacao_audiencia || ''}
                      onChange={e => setEditForm(f => ({ ...f, situacao_audiencia: e.target.value }))}
                      style={{ ...inputCss, width: '100%' }} />
                  </div>
                </div>
                <div style={{ marginTop: '0.875rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: C.onSurfaceVariant, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body }}>Observações</label>
                  <textarea rows={3} placeholder="Anotações sobre negociação, contatos, acordo..."
                    value={editForm.observacoes || ''}
                    onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))}
                    style={{ ...inputCss, width: '100%', resize: 'vertical', fontFamily: F.body }} />
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <button onClick={salvarDevedor} disabled={salvando}
                    style={{ padding: '0.6rem 1.25rem', background: C.primaryContainer, color: C.onPrimary, border: 'none', borderRadius: '0.6rem', fontSize: '0.875rem', fontWeight: '700', cursor: salvando ? 'not-allowed' : 'pointer', opacity: salvando ? 0.7 : 1, fontFamily: F.body }}>
                    {salvando ? 'Salvando…' : 'Salvar dados da cobrança'}
                  </button>
                </div>
              </div>

              {/* ── Documentos (somente admin) ── */}
              {isAdmin && (
                <div style={{ borderTop: `1px solid ${C.borderSubtle}`, paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem' }}>
                    <div style={{ fontWeight: '700', color: C.onSurfaceVariant, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body }}>
                      Documentos
                    </div>
                    {docs.length > 0 && (
                      <span style={{ background: '#9d0518', color: '#fff', borderRadius: '9999px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: '700', fontFamily: F.body }}>
                        {docs.length}
                      </span>
                    )}
                  </div>

                  {/* Erro de upload */}
                  {docErr && (
                    <div style={{ background: C.statusDangerBg, border: `1px solid ${C.statusDanger}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ color: C.statusDanger, fontSize: '0.82rem', fontFamily: F.body }}>{docErr}</span>
                      <button onClick={() => setDocErr(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.statusDanger, fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
                    </div>
                  )}

                  {/* Campo de descrição */}
                  <div style={{ marginBottom: '0.625rem' }}>
                    <input
                      type="text"
                      placeholder="Descrição do documento (ex: Acordo assinado)"
                      value={docDescricao}
                      onChange={e => setDocDescricao(e.target.value)}
                      style={{ ...inputCss, width: '100%' }}
                    />
                  </div>

                  {/* Zona de upload */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDocDragOver(true) }}
                    onDragLeave={() => setDocDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDocDragOver(false); handleDocUpload(e.dataTransfer.files[0]) }}
                    onClick={() => !uploadingDoc && docFileRef.current?.click()}
                    style={{
                      border: `2px dashed ${docDragOver ? '#9d0518' : C.borderSubtle}`,
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      textAlign: 'center',
                      cursor: uploadingDoc ? 'not-allowed' : 'pointer',
                      background: docDragOver ? 'rgba(157,5,24,0.05)' : C.surfaceContainerLow,
                      transition: 'all 0.15s',
                      marginBottom: '1rem',
                    }}
                  >
                    <input
                      ref={docFileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                      onChange={e => { handleDocUpload(e.target.files[0]); e.target.value = '' }}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>📎</div>
                    {uploadingDoc ? (
                      <div style={{ color: C.onSurfaceVariant, fontSize: '0.85rem', fontFamily: F.body }}>Enviando arquivo…</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: '600', color: C.onSurface, fontSize: '0.85rem', fontFamily: F.body }}>
                          Clique ou arraste um arquivo aqui
                        </div>
                        <div style={{ color: C.onSurfaceVariant, fontSize: '0.75rem', marginTop: '0.2rem', fontFamily: F.body }}>
                          PDF, JPG, PNG, DOCX · máximo 10 MB por arquivo
                        </div>
                      </>
                    )}
                  </div>

                  {/* Lista de documentos */}
                  {loadingDocs ? (
                    <div style={{ color: C.onSurfaceVariant, fontSize: '0.82rem', fontFamily: F.body, padding: '0.5rem 0', textAlign: 'center' }}>Carregando documentos…</div>
                  ) : docs.length === 0 ? (
                    <div style={{ color: C.outlineVariant, fontSize: '0.82rem', fontFamily: F.body, textAlign: 'center', padding: '1rem 0' }}>
                      Nenhum documento anexado ainda.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {docs.map(doc => (
                        <div key={doc.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          background: C.surfaceContainerLow, borderRadius: '0.625rem',
                          padding: '0.625rem 0.875rem', border: `1px solid ${C.borderSubtle}`,
                        }}>
                          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{tipoIcon(doc.tipo)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '600', color: C.onSurface, fontSize: '0.82rem', fontFamily: F.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.nome_arquivo}
                            </div>
                            <div style={{ color: C.onSurfaceVariant, fontSize: '0.72rem', fontFamily: F.body, display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {doc.descricao && <span style={{ fontStyle: 'italic' }}>{doc.descricao}</span>}
                              {doc.descricao && <span>·</span>}
                              <span>{fBytes(doc.tamanho)}</span>
                              <span>·</span>
                              <span>{fDate(doc.created_at?.slice(0, 10))}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                            <button
                              onClick={() => visualizarDoc(doc)}
                              style={{ padding: '0.3rem 0.65rem', borderRadius: '0.4rem', background: C.surfaceContainerHigh, color: C.onSurface, border: 'none', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}
                            >
                              Ver / Baixar
                            </button>
                            <button
                              onClick={() => excluirDoc(doc)}
                              style={{ padding: '0.3rem 0.65rem', borderRadius: '0.4rem', background: C.statusDangerBg, color: '#9d0518', border: `1px solid #9d051830`, fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: C.onSurface, margin: 0, letterSpacing: '-0.3px', fontFamily: F.headline }}>
          Cobranças
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setView('lista')}
            style={{ padding: '0.55rem 1rem', borderRadius: '0.6rem', border: '1.5px solid', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', fontFamily: F.body, ...(view === 'lista' ? { background: C.onSurface, color: C.surfaceContainerLowest, borderColor: C.onSurface } : { background: C.surfaceContainerLowest, color: C.onSurfaceVariant, borderColor: C.borderSubtle }) }}
          >📋 Devedores</button>
          <button
            onClick={() => setView('audiencias')}
            style={{ padding: '0.55rem 1rem', borderRadius: '0.6rem', border: '1.5px solid', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', fontFamily: F.body, ...(view === 'audiencias' ? { background: C.onSurface, color: C.surfaceContainerLowest, borderColor: C.onSurface } : { background: C.surfaceContainerLowest, color: C.onSurfaceVariant, borderColor: C.borderSubtle }) }}
          >📅 Audiências {comAudiencia.length > 0 && `(${comAudiencia.length})`}</button>
          <button
            onClick={clickImportar} disabled={importando}
            style={{ padding: '0.55rem 1.1rem', borderRadius: '0.6rem', background: C.primaryContainer, color: C.onPrimary, border: 'none', fontSize: '0.85rem', fontWeight: '700', cursor: importando ? 'not-allowed' : 'pointer', opacity: importando ? 0.7 : 1, fontFamily: F.body }}
          >{importando ? '⏳ Importando...' : '⬆️ Importar relatório'}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
        </div>
      </div>

      {/* ── Banners de importação ── */}
      {importErr && (
        <div style={{ ...dsCard, borderLeft: `4px solid ${C.statusDanger}`, marginBottom: '1rem', background: C.statusDangerBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p style={{ fontWeight: '700', color: C.statusDanger, margin: '0 0 0.25rem', fontFamily: F.body }}>Erro na importação</p>
              <p style={{ color: C.statusDanger, margin: 0, fontSize: '0.875rem', fontFamily: F.body }}>{importErr}</p>
            </div>
            <button onClick={() => setImportErr(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.statusDanger, fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        </div>
      )}
      {resultado && (
        <div style={{ ...dsCard, borderLeft: `4px solid ${C.statusSuccess}`, marginBottom: '1rem', background: C.statusSuccessBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p style={{ fontWeight: '700', color: C.statusSuccess, margin: '0 0 0.5rem', fontFamily: F.body }}>
                ✅ Importação concluída — {resultado.total} boleto{resultado.total !== 1 ? 's' : ''} processado{resultado.total !== 1 ? 's' : ''}
                {resultado.filialNome && <span style={{ marginLeft: '0.5rem', fontWeight: '400' }}>· Filial: <strong>{resultado.filialNome}</strong></span>}
              </p>
              <div style={{ fontSize: '0.85rem', color: C.statusSuccess, display: 'flex', flexDirection: 'column', gap: '0.2rem', fontFamily: F.body }}>
                <span>📥 {resultado.inseridos} boleto{resultado.inseridos !== 1 ? 's' : ''} novo{resultado.inseridos !== 1 ? 's' : ''} inserido{resultado.inseridos !== 1 ? 's' : ''} · ♻️ {resultado.atualizados} atualizado{resultado.atualizados !== 1 ? 's' : ''}</span>
                {resultado.novosDevedores.length > 0 && (
                  <span>🆕 {resultado.novosDevedores.length} devedor{resultado.novosDevedores.length > 1 ? 'es' : ''} novo{resultado.novosDevedores.length > 1 ? 's' : ''}: <strong>{resultado.novosDevedores.join(', ')}</strong></span>
                )}
                {resultado.devedoresAtualizados > 0 && (
                  <span>🔄 {resultado.devedoresAtualizados} devedor{resultado.devedoresAtualizados > 1 ? 'es' : ''} existente{resultado.devedoresAtualizados > 1 ? 's' : ''} atualizado{resultado.devedoresAtualizados > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <button onClick={() => setResultado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.statusSuccess, fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        </div>
      )}

      {/* ════════ VIEW: LISTA ════════ */}
      {view === 'lista' && (
        <>
          {/* Filtros */}
          <div style={{ ...dsCard, marginBottom: '1rem', padding: '1rem 1.25rem' }}>
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
              {filiais.length > 1 && (
                <select value={filtroFilial} onChange={e => setFiltroFilial(e.target.value)}
                  style={{ ...inputCss, minWidth: '160px' }}>
                  <option value="">Todas as filiais</option>
                  {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              )}
              {[
                { key: 'somenteNovos',     label: 'Somente novos' },
                { key: 'somentePC',        label: 'Pequenas causas' },
                { key: 'somenteAudiencia', label: 'Com audiência' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: C.onSurfaceVariant, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', fontFamily: F.body }}>
                  <input type="checkbox" checked={filtros[key]}
                    onChange={e => setFiltros(f => {
                      const next = { ...f, [key]: e.target.checked }
                      if (key === 'somenteNovos' && e.target.checked) next.status = ''
                      return next
                    })} />
                  {label}
                </label>
              ))}
              {(filtros.busca || filtros.status || filtros.somenteNovos || filtros.somentePC || filtros.somenteAudiencia || temFiltrosVenc) && (
                <button onClick={() => { setFiltros({ busca: '', status: '', somenteNovos: false, somentePC: false, somenteAudiencia: false }); setFiltroVencInicio(''); setFiltroVencFim('') }}
                  style={{ fontSize: '0.8rem', color: C.statusDanger, background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.3rem 0.5rem', fontFamily: F.body }}>
                  ✕ Limpar
                </button>
              )}
              <span style={{ fontSize: '0.8rem', color: C.onSurfaceVariant, marginLeft: 'auto', fontFamily: F.body }}>
                {loading ? '…' : `${listaFiltrada.length} devedor${listaFiltrada.length !== 1 ? 'es' : ''}`}
              </span>
            </div>

            {/* Filtro por vencimento */}
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${C.borderSubtle}`, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.625rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center', whiteSpace: 'nowrap', fontFamily: F.body }}>
                Vencimento:
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: C.onSurfaceVariant, fontWeight: '600', marginBottom: '0.2rem', fontFamily: F.body }}>De</div>
                <input type="date" value={filtroVencInicio} onChange={e => setFiltroVencInicio(e.target.value)}
                  style={{ ...inputCss, padding: '0.4rem 0.6rem', fontSize: '0.82rem' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: C.onSurfaceVariant, fontWeight: '600', marginBottom: '0.2rem', fontFamily: F.body }}>Até</div>
                <input type="date" value={filtroVencFim} onChange={e => setFiltroVencFim(e.target.value)}
                  style={{ ...inputCss, padding: '0.4rem 0.6rem', fontSize: '0.82rem' }} />
              </div>
              {temFiltrosVenc && (
                <button onClick={() => { setFiltroVencInicio(''); setFiltroVencFim('') }}
                  style={{ fontSize: '0.78rem', color: C.statusDanger, background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.3rem 0.5rem', fontFamily: F.body }}>
                  ✕ Limpar datas
                </button>
              )}
            </div>
          </div>

          {/* Tabela de devedores */}
          <div style={{ ...dsCard, marginBottom: '1rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: C.onSurfaceVariant, padding: '3rem 0', fontFamily: F.body }}>Carregando…</div>
            ) : listaFiltrada.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.onSurfaceVariant, padding: '3rem 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</div>
                <div style={{ fontWeight: '600', fontFamily: F.body }}>
                  {devedores.length === 0 ? 'Nenhum devedor cadastrado. Importe um relatório para começar.' : 'Nenhum resultado com os filtros aplicados.'}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: C.tableHeader, borderBottom: `1.5px solid ${C.borderSubtle}` }}>
                      {['Devedor', 'Telefone', 'Em aberto', 'Valor em aberto', 'Status', 'P. Causas', 'Audiência', 'Atualização'].map(h => (
                        <th key={h} style={{ padding: '0.65rem 0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontFamily: F.body }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.map(dev => {
                      const qtdAbertos = abertos(dev).length
                      const valAberto  = valorAberto(dev)
                      const sStyle     = statusStyle(dev.status_cobranca)
                      return (
                        <tr
                          key={dev.id}
                          onClick={() => abrirModal(dev)}
                          style={{ borderBottom: `1px solid ${C.borderSubtle}`, cursor: 'pointer', transition: 'background 0.12s' }}
                          onMouseEnter={e => e.currentTarget.style.background = C.surfaceContainerLow}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '0.8rem 0.875rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: C.surfaceContainerHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: '700', color: C.onSurfaceVariant, fontFamily: F.headline }}>
                                {dev.nome_pagador.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: C.onSurface, fontSize: '0.875rem', fontFamily: F.body }}>{dev.nome_pagador}</div>
                                {dev.status_cobranca === 'Novo' && (
                                  <span style={{ fontSize: '0.68rem', fontWeight: '800', background: C.primaryContainer, color: C.onPrimary, padding: '1px 6px', borderRadius: '9999px', letterSpacing: '0.5px', fontFamily: F.body }}>NOVO</span>
                                )}
                                {dev.filial_id && filialMap[dev.filial_id] && (
                                  <span style={{ fontSize: '0.68rem', fontWeight: '600', background: C.surfaceContainerLow, color: C.onSurfaceVariant, padding: '1px 6px', borderRadius: '9999px', marginLeft: '4px', fontFamily: F.body }}>
                                    {filialMap[dev.filial_id]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', color: C.onSurfaceVariant, fontSize: '0.85rem', whiteSpace: 'nowrap', fontFamily: F.body }}>
                            {dev.telefone
                              ? <a href={`tel:${dev.telefone}`} onClick={e => e.stopPropagation()} style={{ color: C.secondary, textDecoration: 'none', fontWeight: '500' }}>{dev.telefone}</a>
                              : <span style={{ color: C.outlineVariant }}>—</span>}
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', fontWeight: '700', color: qtdAbertos > 0 ? C.onSurface : C.outlineVariant, fontFamily: F.mono }}>{qtdAbertos}</td>
                          <td style={{ padding: '0.8rem 0.875rem', fontWeight: '700', color: valAberto > 0 ? C.statusDanger : C.outlineVariant, whiteSpace: 'nowrap', fontFamily: F.mono }}>{fBRL(valAberto)}</td>
                          <td style={{ padding: '0.8rem 0.875rem' }}>
                            <span style={{ background: sStyle.bg, color: sStyle.color, borderRadius: '0.4rem', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: '700', fontFamily: F.body }}>
                              {dev.status_cobranca || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', textAlign: 'center', fontSize: '1rem' }}>
                            {dev.pequenas_causas ? '⚖️' : <span style={{ color: C.outlineVariant }}>—</span>}
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                            {dev.data_audiencia ? (
                              <span style={{
                                fontWeight: '600', fontFamily: F.body,
                                color: dev.data_audiencia < todayISO() ? C.onSurfaceVariant :
                                       dev.data_audiencia === todayISO() ? C.statusDanger :
                                       diffDias(dev.data_audiencia, todayISO()) <= 7 ? C.statusWarning : C.onSurface
                              }}>
                                {dev.data_audiencia === todayISO() ? '🔴 ' : diffDias(dev.data_audiencia, todayISO()) <= 7 && dev.data_audiencia > todayISO() ? '🟡 ' : ''}
                                {fDate(dev.data_audiencia)}
                              </span>
                            ) : <span style={{ color: C.outlineVariant }}>—</span>}
                          </td>
                          <td style={{ padding: '0.8rem 0.875rem', color: C.onSurfaceVariant, fontSize: '0.8rem', whiteSpace: 'nowrap', fontFamily: F.mono }}>
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
        </>
      )}

      {/* ════════ VIEW: AUDIÊNCIAS ════════ */}
      {view === 'audiencias' && (
        <div style={dsCard}>
          <div style={{ fontWeight: '700', color: C.onSurface, fontSize: '0.95rem', marginBottom: '1rem', fontFamily: F.headline }}>
            Audiências marcadas — {comAudiencia.length} devedor{comAudiencia.length !== 1 ? 'es' : ''}
          </div>
          {comAudiencia.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.onSurfaceVariant, padding: '2.5rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
              <div style={{ fontWeight: '600', fontFamily: F.body }}>Nenhuma audiência marcada.</div>
              <div style={{ fontSize: '0.82rem', marginTop: '0.25rem', fontFamily: F.body }}>Clique em um devedor e preencha a data da audiência.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: C.tableHeader, borderBottom: `1.5px solid ${C.borderSubtle}` }}>
                    {['Data', 'Devedor', 'Situação da audiência', 'Status cobrança', 'Em aberto'].map(h => (
                      <th key={h} style={{ padding: '0.55rem 0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontFamily: F.body }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comAudiencia.map(dev => {
                    const hoje = todayISO()
                    const dias = diffDias(dev.data_audiencia, hoje)
                    const isHoje    = dev.data_audiencia === hoje
                    const isProxima = dias > 0 && dias <= 7
                    const isPassada = dev.data_audiencia < hoje
                    const rowBg = isHoje ? C.statusDangerBg : isProxima ? C.statusWarningBg : 'transparent'
                    const sStyle = statusStyle(dev.status_cobranca)
                    return (
                      <tr
                        key={dev.id}
                        onClick={() => { setView('lista'); abrirModal(dev) }}
                        style={{ borderBottom: `1px solid ${C.borderSubtle}`, background: rowBg, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        <td style={{ padding: '0.7rem 0.875rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '800', color: isHoje ? C.statusDanger : isProxima ? C.statusWarning : isPassada ? C.onSurfaceVariant : C.onSurface, fontSize: '0.9rem', fontFamily: F.body }}>
                            {isHoje ? '🔴 HOJE' : isProxima ? `🟡 ${fDate(dev.data_audiencia)}` : fDate(dev.data_audiencia)}
                          </div>
                          {isHoje    && <div style={{ fontSize: '0.72rem', color: C.statusDanger, fontWeight: '600', fontFamily: F.body }}>Audiência hoje!</div>}
                          {isProxima && <div style={{ fontSize: '0.72rem', color: C.statusWarning, fontFamily: F.body }}>em {dias} dia{dias > 1 ? 's' : ''}</div>}
                          {isPassada && <div style={{ fontSize: '0.72rem', color: C.onSurfaceVariant, fontFamily: F.body }}>há {Math.abs(dias)} dia{Math.abs(dias) > 1 ? 's' : ''}</div>}
                        </td>
                        <td style={{ padding: '0.7rem 0.875rem', fontWeight: '700', color: C.onSurface, fontFamily: F.body }}>{dev.nome_pagador}</td>
                        <td style={{ padding: '0.7rem 0.875rem', color: C.onSurfaceVariant, fontSize: '0.82rem', fontFamily: F.body }}>{dev.situacao_audiencia || <span style={{ color: C.outlineVariant }}>—</span>}</td>
                        <td style={{ padding: '0.7rem 0.875rem' }}>
                          <span style={{ background: sStyle.bg, color: sStyle.color, borderRadius: '0.4rem', padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: '700', fontFamily: F.body }}>
                            {dev.status_cobranca}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem 0.875rem', fontWeight: '700', color: C.statusDanger, whiteSpace: 'nowrap', fontFamily: F.mono }}>
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
