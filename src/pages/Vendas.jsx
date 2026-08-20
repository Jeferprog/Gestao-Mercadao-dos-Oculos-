import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { C, F, card as dsCard, inputCss, btnPrimary, btnSecondary } from '../lib/ds'

/* ── helpers ── */
function fBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fDateBR(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function firstOfMonthISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const Label = ({ children }) => (
  <label style={{
    display: 'block', fontSize: '0.8rem', fontWeight: '600', fontFamily: F.body,
    color: C.onSurfaceVariant, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px',
  }}>{children}</label>
)

const FORM_INIT = {
  tipo_venda: 'Grau',
  os_numero: '',
  nota_fiscal: '',
  nome_cliente: '',
  data_venda: todayISO(),
  vendedor_id: '',
  filial_id: '',
  valor_bruto: '',
  desconto: '0',
  valor_final: '',
  forma_pagamento: 'Entrada e Saldo',
  entrada_valor: '',
  entrada_forma: '',
  saldo_valor: '',
  saldo_forma: '',
  efetivada: true,
  motivo_nao_efetivada: '',
}

/* ── FormVenda ── */
function FormVenda({ form, onChange, onFilialChange, onTipoVendaChange, vendedores, filiais, formasPagamento, isAdmin, onSubmit, onCancel, saving, editando }) {
  function handleBrutoDesc(field, val) {
    const next = { ...form, [field]: val }
    const bruto = parseFloat(String(next.valor_bruto).replace(',', '.')) || 0
    const desc = parseFloat(String(next.desconto).replace(',', '.')) || 0
    next.valor_final = Math.max(0, bruto - desc).toFixed(2)
    onChange(next)
  }

  const bruto = parseFloat(String(form.valor_bruto).replace(',', '.')) || 0
  const desc = parseFloat(String(form.desconto).replace(',', '.')) || 0
  const final = parseFloat(String(form.valor_final).replace(',', '.')) || 0
  const isGrau = form.tipo_venda === 'Grau'
  const isEntradaSaldo = form.forma_pagamento === 'Entrada e Saldo'

  const entV = parseFloat(String(form.entrada_valor).replace(',', '.')) || 0
  const salV = parseFloat(String(form.saldo_valor).replace(',', '.')) || 0
  const entradaSaldoOk = !isEntradaSaldo || Math.abs(entV + salV - final) < 0.01

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>

        {/* Tipo de Venda */}
        <div>
          <Label>Tipo de Venda</Label>
          <select style={inputCss}
            value={form.tipo_venda}
            onChange={e => onTipoVendaChange(e.target.value)}>
            <option value="Grau">Óculos de Grau</option>
            <option value="Solar">Solar</option>
          </select>
        </div>

        {/* O.S. — somente para Grau */}
        {isGrau && (
          <div>
            <Label>Nº O.S.</Label>
            <input style={{ ...inputCss, background: C.surfaceContainerLow, color: C.onSurfaceVariant, cursor: 'default' }}
              value={form.os_numero} readOnly />
          </div>
        )}

        {/* Nota Fiscal */}
        <div>
          <Label>Nota Fiscal</Label>
          <input style={inputCss} placeholder="Opcional"
            value={form.nota_fiscal}
            onChange={e => onChange({ ...form, nota_fiscal: e.target.value })} />
        </div>

        {/* Nome do Cliente */}
        <div>
          <Label>Nome do Cliente</Label>
          <input style={inputCss} placeholder="Opcional"
            value={form.nome_cliente}
            onChange={e => onChange({ ...form, nome_cliente: e.target.value })} />
        </div>

        {/* Data */}
        <div>
          <Label>Data</Label>
          <input type="date" style={inputCss} required
            value={form.data_venda}
            onChange={e => onChange({ ...form, data_venda: e.target.value })} />
        </div>

        {/* Filial */}
        {isAdmin ? (
          <div>
            <Label>Filial</Label>
            <select style={inputCss}
              value={form.filial_id}
              onChange={e => onFilialChange(e.target.value)}>
              <option value="">Sem filial</option>
              {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        ) : filiais.length > 1 && (
          <div>
            <Label>Filial</Label>
            <input style={{ ...inputCss, background: C.surfaceContainerLow, color: C.onSurfaceVariant, cursor: 'default' }}
              value={filiais.find(f => f.id === form.filial_id)?.nome || '—'}
              readOnly />
          </div>
        )}

        {/* Vendedor */}
        {isAdmin ? (
          <div>
            <Label>Vendedor</Label>
            <select style={inputCss} required
              value={form.vendedor_id}
              onChange={e => onChange({ ...form, vendedor_id: e.target.value })}>
              <option value="">Selecione...</option>
              {vendedores.map(v => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <Label>Vendedor</Label>
            <input style={{ ...inputCss, background: C.surfaceContainerLow, color: C.onSurfaceVariant, cursor: 'default' }}
              value={vendedores.find(v => v.id === form.vendedor_id)?.nome || ''}
              readOnly />
          </div>
        )}

        {/* Valor Bruto */}
        <div>
          <Label>Valor Bruto (R$)</Label>
          <input style={inputCss} type="number" min="0.01" step="0.01" required placeholder="0,00"
            value={form.valor_bruto}
            onChange={e => handleBrutoDesc('valor_bruto', e.target.value)} />
        </div>

        {/* Desconto */}
        <div>
          <Label>Desconto (R$)</Label>
          <input style={inputCss} type="number" min="0" step="0.01" placeholder="0,00"
            value={form.desconto}
            onChange={e => handleBrutoDesc('desconto', e.target.value)} />
          {desc > bruto && bruto > 0 && (
            <span style={{ color: C.error, fontSize: '0.78rem', fontFamily: F.body }}>Desconto maior que o valor bruto</span>
          )}
        </div>

        {/* Valor Final */}
        <div>
          <Label>Valor Final (R$)</Label>
          <input style={inputCss} type="number" min="0" step="0.01" required placeholder="0,00"
            value={form.valor_final}
            onChange={e => onChange({ ...form, valor_final: e.target.value })} />
        </div>

        {/* Forma de Pagamento */}
        <div>
          <Label>Forma de Pagamento</Label>
          <select style={inputCss} required
            value={form.forma_pagamento}
            onChange={e => onChange({ ...form, forma_pagamento: e.target.value, entrada_valor: '', entrada_forma: '', saldo_valor: '', saldo_forma: '' })}>
            <option value="">Selecione...</option>
            {formasPagamento.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
            <option value="Entrada e Saldo">Entrada e Saldo</option>
          </select>
        </div>
      </div>

      {/* Bloco Entrada e Saldo */}
      {isEntradaSaldo && (
        <div style={{ background: C.statusDangerBg, border: `1.5px solid ${C.outlineVariant}`, borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', fontFamily: F.body, color: C.statusDanger, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Entrada e Saldo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <Label>Entrada — Valor (R$)</Label>
              <input style={inputCss} type="number" min="0" step="0.01" placeholder="0,00" required={isEntradaSaldo}
                value={form.entrada_valor}
                onChange={e => onChange({ ...form, entrada_valor: e.target.value })} />
            </div>
            <div>
              <Label>Entrada — Forma</Label>
              <select style={inputCss} required={isEntradaSaldo}
                value={form.entrada_forma}
                onChange={e => onChange({ ...form, entrada_forma: e.target.value })}>
                <option value="">Selecione...</option>
                {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label>Saldo — Valor (R$)</Label>
              <input style={inputCss} type="number" min="0" step="0.01" placeholder="0,00" required={isEntradaSaldo}
                value={form.saldo_valor}
                onChange={e => onChange({ ...form, saldo_valor: e.target.value })} />
            </div>
            <div>
              <Label>Saldo — Forma</Label>
              <select style={inputCss} required={isEntradaSaldo}
                value={form.saldo_forma}
                onChange={e => onChange({ ...form, saldo_forma: e.target.value })}>
                <option value="">Selecione...</option>
                {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          {!entradaSaldoOk && entV + salV > 0 && (
            <div style={{ color: C.error, fontFamily: F.body, fontSize: '0.82rem', fontWeight: '600' }}>
              ⚠ Entrada ({fBRL(entV)}) + Saldo ({fBRL(salV)}) = {fBRL(entV + salV)} — deve ser igual ao Valor Final ({fBRL(final)})
            </div>
          )}
          {entradaSaldoOk && entV + salV > 0 && (
            <div style={{ color: C.statusSuccess, fontFamily: F.body, fontSize: '0.82rem', fontWeight: '600' }}>
              ✓ Soma confere com o Valor Final ({fBRL(final)})
            </div>
          )}
        </div>
      )}

      {/* Venda não efetivada */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox"
            checked={!form.efetivada}
            onChange={e => onChange({ ...form, efetivada: !e.target.checked, motivo_nao_efetivada: e.target.checked ? form.motivo_nao_efetivada : '' })}
            style={{ width: '1rem', height: '1rem', accentColor: C.statusDanger }} />
          <span style={{ fontSize: '0.88rem', fontFamily: F.body, fontWeight: '600', color: C.statusDanger }}>Venda não efetivada</span>
        </label>
        {!form.efetivada && (
          <div>
            <Label>Motivo (obrigatório)</Label>
            <textarea style={{ ...inputCss, minHeight: '80px', resize: 'vertical' }} required={!form.efetivada}
              placeholder="Descreva o motivo da venda não ter sido efetivada..."
              value={form.motivo_nao_efetivada}
              onChange={e => onChange({ ...form, motivo_nao_efetivada: e.target.value })} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
        <button type="button" style={btnSecondary} onClick={onCancel}>Cancelar</button>
        <button type="submit" style={btnPrimary} disabled={saving}>
          {saving ? 'Salvando...' : (editando ? 'Atualizar Venda' : 'Registrar Venda')}
        </button>
      </div>
    </form>
  )
}

/* ── componente principal ── */
export default function Vendas() {
  const { profile, isAdmin } = useAuth()
  const [viewMode, setViewMode] = useState('dia') // 'dia' | 'periodo'
  const [dataSel, setDataSel] = useState(todayISO())
  const [periodoInicio, setPeriodoInicio] = useState(firstOfMonthISO())
  const [periodoFim, setPeriodoFim] = useState(todayISO())
  const [vendas, setVendas] = useState([])
  const [diasComVendas, setDiasComVendas] = useState([])
  const [loading, setLoading] = useState(true)
  const [formasPagamento, setFormasPagamento] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [filiais, setFiliais] = useState([])
  const [filtroFilial, setFiltroFilial] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_INIT)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  /* carrega configurações, vendedores e filiais (uma vez) */
  useEffect(() => {
    async function init() {
      const [{ data: cfgRows }, { data: vends }, { data: fils }] = await Promise.all([
        supabase.from('configuracoes').select('*'),
        supabase.from('profiles').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('filiais').select('*').order('nome'),
      ])
      if (cfgRows) {
        const map = Object.fromEntries(cfgRows.map(r => [r.chave, r.valor]))
        setFormasPagamento((map.formas_pagamento || '').split(',').filter(Boolean))
      }
      if (vends) setVendedores(vends)
      if (fils) setFiliais(fils)
    }
    init()
  }, [])

  /* dias com movimento no mês da data selecionada (somente modo dia) */
  const carregarDias = useCallback(async () => {
    if (viewMode !== 'dia') return
    const mes = dataSel.slice(0, 7)
    let q = supabase
      .from('vendas')
      .select('data_venda')
      .gte('data_venda', `${mes}-01`)
      .lte('data_venda', `${mes}-31`)
    if (filtroFilial) q = q.eq('filial_id', filtroFilial)
    else if (!isAdmin) q = q.eq('vendedor_id', profile?.id || '')
    const { data } = await q
    if (data) {
      const unique = [...new Set(data.map(r => r.data_venda))].sort()
      setDiasComVendas(unique)
    }
  }, [dataSel, filtroFilial, isAdmin, profile?.id, viewMode])

  /* vendas do dia ou período selecionado */
  const carregarVendas = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('vendas')
      .select('*')
      .order('data_venda', { ascending: false })
      .order('os_numero', { nullsLast: true })

    if (viewMode === 'dia') {
      q = q.eq('data_venda', dataSel)
    } else {
      q = q.gte('data_venda', periodoInicio).lte('data_venda', periodoFim)
    }

    if (filtroFilial) q = q.eq('filial_id', filtroFilial)
    else if (!isAdmin) q = q.eq('vendedor_id', profile?.id || '')
    const { data, error } = await q
    if (!error && data) setVendas(data)
    setLoading(false)
  }, [dataSel, periodoInicio, periodoFim, viewMode, filtroFilial, isAdmin, profile?.id])

  useEffect(() => {
    carregarDias()
    carregarVendas()
  }, [carregarDias, carregarVendas])

  /* recalcula O.S. ao trocar filial no formulário (somente venda nova de Grau) */
  async function handleFilialChange(newFilialId) {
    const nextOs = form.tipo_venda === 'Grau' ? await getProximoOs(newFilialId) : ''
    setForm(f => ({ ...f, filial_id: newFilialId, os_numero: nextOs }))
  }

  /* recalcula O.S. ao trocar tipo de venda */
  async function handleTipoVendaChange(novoTipo) {
    if (novoTipo === 'Grau') {
      const nextOs = await getProximoOs(form.filial_id)
      setForm(f => ({ ...f, tipo_venda: novoTipo, os_numero: nextOs }))
    } else {
      setForm(f => ({ ...f, tipo_venda: novoTipo, os_numero: '' }))
    }
  }

  /* próximo O.S. por filial — respeita os_numero_inicial como piso mínimo */
  async function getProximoOs(filialId) {
    if (filialId) {
      const [{ data: fil }, { data: maxRow }] = await Promise.all([
        supabase.from('filiais').select('os_numero_inicial').eq('id', filialId).maybeSingle(),
        supabase.from('vendas').select('os_numero').eq('filial_id', filialId)
          .not('os_numero', 'is', null).order('os_numero', { ascending: false }).limit(1).maybeSingle(),
      ])
      const inicial = fil?.os_numero_inicial || 1
      if (maxRow) return Math.max(maxRow.os_numero + 1, inicial)
      return inicial
    }
    return 1
  }

  async function abrirNovaVenda() {
    const filialId = profile?.filial_id || (filiais.length === 1 ? filiais[0].id : '')
    const proximo = await getProximoOs(filialId)
    setForm({
      ...FORM_INIT,
      tipo_venda: 'Grau',
      os_numero: proximo,
      data_venda: viewMode === 'dia' ? dataSel : todayISO(),
      vendedor_id: profile?.id || '',
      filial_id: filialId,
    })
    setEditId(null)
    setShowForm(true)
  }

  function abrirEdicao(v) {
    setForm({
      tipo_venda: v.tipo_venda || 'Grau',
      os_numero: v.os_numero || '',
      nota_fiscal: v.nota_fiscal || '',
      nome_cliente: v.nome_cliente || '',
      data_venda: v.data_venda,
      vendedor_id: v.vendedor_id,
      filial_id: v.filial_id || '',
      valor_bruto: v.valor_bruto,
      desconto: v.desconto || 0,
      valor_final: v.valor_final,
      forma_pagamento: v.forma_pagamento,
      entrada_valor: v.entrada_valor || '',
      entrada_forma: v.entrada_forma || '',
      saldo_valor: v.saldo_valor || '',
      saldo_forma: v.saldo_forma || '',
      efetivada: v.efetivada !== false,
      motivo_nao_efetivada: v.motivo_nao_efetivada || '',
    })
    setEditId(v.id)
    setShowForm(true)
  }

  async function salvar(e) {
    e.preventDefault()
    const bruto = parseFloat(String(form.valor_bruto).replace(',', '.')) || 0
    const desc = parseFloat(String(form.desconto).replace(',', '.')) || 0
    const final = parseFloat(String(form.valor_final).replace(',', '.')) || 0
    if (bruto <= 0) return showToast('Valor Bruto deve ser maior que zero.', 'err')
    if (desc > bruto) return showToast('Desconto não pode ser maior que o Valor Bruto.', 'err')
    if (form.tipo_venda === 'Grau' && !form.os_numero) {
      return showToast('Número de O.S. é obrigatório para vendas de Óculos de Grau.', 'err')
    }

    if (!form.efetivada && !form.motivo_nao_efetivada?.trim()) {
      return showToast('Informe o motivo da venda não efetivada.', 'err')
    }

    if (form.forma_pagamento === 'Entrada e Saldo') {
      const entV = parseFloat(String(form.entrada_valor).replace(',', '.')) || 0
      const salV = parseFloat(String(form.saldo_valor).replace(',', '.')) || 0
      if (Math.abs(entV + salV - final) >= 0.01) {
        return showToast(`Entrada + Saldo (${fBRL(entV + salV)}) deve ser igual ao Valor Final (${fBRL(final)}).`, 'err')
      }
      if (!form.entrada_forma) return showToast('Selecione a forma de pagamento da Entrada.', 'err')
      if (!form.saldo_forma) return showToast('Selecione a forma de pagamento do Saldo.', 'err')
    }

    setSaving(true)
    const isEntradaSaldo = form.forma_pagamento === 'Entrada e Saldo'
    const payload = {
      tipo_venda: form.tipo_venda || 'Grau',
      os_numero: form.tipo_venda === 'Grau' ? (form.os_numero || null) : null,
      nota_fiscal: form.nota_fiscal || null,
      nome_cliente: form.nome_cliente || null,
      data_venda: form.data_venda,
      vendedor_id: form.vendedor_id,
      filial_id: form.filial_id || null,
      valor_bruto: bruto,
      desconto: desc,
      valor_final: final,
      forma_pagamento: form.forma_pagamento,
      entrada_valor: isEntradaSaldo ? (parseFloat(String(form.entrada_valor).replace(',', '.')) || null) : null,
      entrada_forma: isEntradaSaldo ? (form.entrada_forma || null) : null,
      saldo_valor: isEntradaSaldo ? (parseFloat(String(form.saldo_valor).replace(',', '.')) || null) : null,
      saldo_forma: isEntradaSaldo ? (form.saldo_forma || null) : null,
      efetivada: form.efetivada !== false,
      motivo_nao_efetivada: !form.efetivada ? (form.motivo_nao_efetivada || null) : null,
    }

    let error
    if (editId) {
      ;({ error } = await supabase.from('vendas').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('vendas').insert(payload))
    }

    setSaving(false)
    if (error) {
      showToast('Erro ao salvar: ' + error.message, 'err')
    } else {
      showToast(editId ? 'Venda atualizada!' : 'Venda registrada!')
      if (form.nome_cliente?.trim()) {
        const n = form.nome_cliente.trim()
        const { data: exist } = await supabase.from('clientes').select('id').ilike('nome', n).limit(1)
        if (!exist?.length) {
          const { error: errCli } = await supabase.from('clientes').insert({ nome: n })
          if (errCli) showToast('Aviso: não foi possível sincronizar com Clientes.', 'err')
        }
      }
      setShowForm(false)
      carregarVendas()
      carregarDias()
    }
  }

  async function excluir(id) {
    if (!window.confirm('Confirma exclusão desta venda?')) return
    const { error } = await supabase.from('vendas').delete().eq('id', id)
    if (error) {
      showToast('Erro ao excluir: ' + error.message, 'err')
    } else {
      showToast('Venda excluída.')
      carregarVendas()
      carregarDias()
    }
  }

  async function toggleConferido(v) {
    const novoValor = !v.conferido
    const payload = {
      conferido: novoValor,
      conferido_em: novoValor ? new Date().toISOString() : null,
    }
    setVendas(prev => prev.map(x => x.id === v.id ? { ...x, ...payload } : x))
    const { error } = await supabase.from('vendas').update(payload).eq('id', v.id)
    if (error) {
      showToast('Erro ao atualizar conferido: ' + error.message, 'err')
      setVendas(prev => prev.map(x => x.id === v.id ? { ...x, conferido: v.conferido, conferido_em: v.conferido_em } : x))
    }
  }

  function podeAlterar(v) {
    return isAdmin || v.vendedor_id === profile?.id
  }

  /* totais apenas das vendas efetivadas */
  const vendasEfetivadas = vendas.filter(v => v.efetivada !== false)
  const totBruto = vendasEfetivadas.reduce((s, v) => s + (v.valor_bruto || 0), 0)
  const totDesc = vendasEfetivadas.reduce((s, v) => s + (v.desconto || 0), 0)
  const totFinal = vendasEfetivadas.reduce((s, v) => s + (v.valor_final || 0), 0)
  const vendedorMap = Object.fromEntries(vendedores.map(v => [v.id, v.nome]))
  const filialMap = Object.fromEntries(filiais.map(f => [f.id, f.nome]))

  function navegarDia(delta) {
    const d = new Date(dataSel + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDataSel(d.toISOString().slice(0, 10))
  }

  const hoje = todayISO()

  const tituloTabela = viewMode === 'dia'
    ? fDateBR(dataSel)
    : `${fDateBR(periodoInicio)} a ${fDateBR(periodoFim)}`

  const colsFixas = 6 + (filiais.length > 1 ? 1 : 0) + (isAdmin ? 1 : 0)

  return (
    <div className="pg">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 9999,
          padding: '0.75rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.875rem',
          fontFamily: F.body, fontWeight: '600', color: '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          background: toast.tipo === 'err' ? C.statusDanger : C.statusSuccess,
          maxWidth: '320px',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Slide-over backdrop */}
      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 199,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Slide-over panel */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, right: 0,
          height: '100%',
          width: 'min(640px, 100vw)',
          zIndex: 200,
          background: C.surfaceContainerLowest,
          boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: `1px solid ${C.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            background: C.surfaceContainerLowest,
          }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontFamily: F.headline, fontWeight: '700', color: C.onSurface }}>
              {editId ? 'Editar Venda' : 'Nova Venda'}
            </h2>
            <button
              onClick={() => setShowForm(false)}
              aria-label="Fechar"
              style={{
                background: C.surfaceContainerHigh,
                border: 'none',
                borderRadius: '0.375rem',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: C.onSurfaceVariant,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
          {/* Panel body (scrollable) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <FormVenda
              form={form}
              onChange={setForm}
              onFilialChange={handleFilialChange}
              onTipoVendaChange={handleTipoVendaChange}
              vendedores={vendedores}
              filiais={filiais}
              formasPagamento={formasPagamento}
              isAdmin={isAdmin}
              onSubmit={salvar}
              onCancel={() => setShowForm(false)}
              saving={saving}
              editando={!!editId}
            />
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: F.headline, color: C.onSurface, margin: 0, letterSpacing: '-0.3px' }}>
          Vendas Diárias
        </h1>
        <button style={btnPrimary} onClick={abrirNovaVenda}>
          + Nova Venda
        </button>
      </div>

      {/* Filtro de filial (admin + múltiplas filiais) */}
      {isAdmin && filiais.length > 1 && (
        <div style={{ ...dsCard, marginBottom: '1rem', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <Label>Filial</Label>
              <select style={{ ...inputCss, width: 'auto', minWidth: '160px' }}
                value={filtroFilial}
                onChange={e => setFiltroFilial(e.target.value)}>
                <option value="">Todas</option>
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Seletor de Data / Período */}
      <div style={{ ...dsCard, marginBottom: '1rem' }}>
        {/* Toggle modo */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem' }}>
          {['dia', 'periodo'].map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: '2rem', border: 'none',
                fontSize: '0.8rem', fontFamily: F.body, fontWeight: '700', cursor: 'pointer',
                background: viewMode === m ? C.primaryContainer : C.surfaceContainerHigh,
                color: viewMode === m ? '#fff' : C.onSurfaceVariant,
              }}>
              {m === 'dia' ? 'Por dia' : 'Por período'}
            </button>
          ))}
        </div>

        {viewMode === 'dia' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={() => navegarDia(-1)}
                style={{ ...btnSecondary, padding: '0.5rem 0.875rem', fontSize: '1.1rem' }}
                title="Dia anterior">‹</button>

              <input type="date" value={dataSel}
                onChange={e => setDataSel(e.target.value)}
                style={{ ...inputCss, width: 'auto', minWidth: '145px' }} />

              <button onClick={() => navegarDia(1)}
                style={{ ...btnSecondary, padding: '0.5rem 0.875rem', fontSize: '1.1rem' }}
                title="Próximo dia">›</button>

              <button onClick={() => setDataSel(hoje)}
                style={{
                  ...btnSecondary, padding: '0.5rem 0.875rem',
                  background: dataSel === hoje ? C.primaryContainer : C.surfaceContainerHigh,
                  color: dataSel === hoje ? '#fff' : C.onSurfaceVariant,
                  border: dataSel === hoje ? 'none' : `1.5px solid ${C.secondary}`,
                }}>
                Hoje
              </button>
            </div>

            {/* Pills — dias com movimento */}
            {diasComVendas.length > 0 && (
              <div style={{ marginTop: '0.875rem' }}>
                <div style={{ fontSize: '0.75rem', color: C.onSurfaceVariant, fontFamily: F.body, fontWeight: '600', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Dias com movimento
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '4px' }}>
                  {diasComVendas.map(d => (
                    <button key={d} onClick={() => setDataSel(d)}
                      style={{
                        flexShrink: 0, padding: '0.3rem 0.7rem', borderRadius: '2rem',
                        border: 'none', fontSize: '0.8rem', fontFamily: F.body, fontWeight: '600', cursor: 'pointer',
                        background: d === dataSel ? C.primaryContainer : C.surfaceContainerHigh,
                        color: d === dataSel ? '#fff' : C.onSurfaceVariant,
                      }}>
                      {fDateBR(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <Label>Data inicial</Label>
              <input type="date" value={periodoInicio}
                onChange={e => setPeriodoInicio(e.target.value)}
                style={{ ...inputCss, width: 'auto', minWidth: '145px' }} />
            </div>
            <div>
              <Label>Data final</Label>
              <input type="date" value={periodoFim}
                onChange={e => setPeriodoFim(e.target.value)}
                style={{ ...inputCss, width: 'auto', minWidth: '145px' }} />
            </div>
            <button style={btnPrimary} onClick={carregarVendas}>Filtrar</button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div style={{ ...dsCard }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: '700', fontFamily: F.headline, color: C.onSurface, fontSize: '0.95rem' }}>
            {tituloTabela}
            {vendas.length > 0 && (
              <span style={{ marginLeft: '0.5rem', color: C.onSurfaceVariant, fontFamily: F.body, fontWeight: '400', fontSize: '0.85rem' }}>
                — {vendas.length} venda{vendas.length !== 1 ? 's' : ''}
                {vendas.some(v => v.efetivada === false) && (
                  <span style={{ color: C.statusDanger }}>
                    {' '}({vendas.filter(v => v.efetivada === false).length} não efetivada{vendas.filter(v => v.efetivada === false).length !== 1 ? 's' : ''})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: C.onSurfaceVariant, fontFamily: F.body, padding: '2.5rem 0' }}>Carregando...</div>
        ) : vendas.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.onSurfaceVariant, fontFamily: F.body, padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontWeight: '600' }}>Nenhuma venda {viewMode === 'dia' ? 'neste dia' : 'neste período'}</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Clique em "+ Nova Venda" para registrar</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: C.tableHeader, borderBottom: `1.5px solid ${C.borderSubtle}` }}>
                  {[
                    'Tipo', 'O.S.', 'N. Fiscal', 'Cliente', 'Data', 'Vendedor',
                    ...(filiais.length > 1 ? ['Filial'] : []),
                    ...(isAdmin ? ['Conf.'] : []),
                    'Valor Bruto', 'Desconto', 'Valor Final', 'Pagamento', 'Ações',
                  ].map(h => (
                    <th key={h} style={{
                      padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.7rem',
                      fontFamily: F.body, fontWeight: '600', color: C.onSurfaceVariant,
                      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendas.map(v => {
                  const naoEfetivada = v.efetivada === false
                  return (
                    <tr key={v.id}
                      style={{ borderBottom: `1px solid ${C.borderSubtle}`, opacity: naoEfetivada ? 0.55 : 1 }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceContainerLow}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{
                            background: v.tipo_venda === 'Solar' ? C.statusWarningBg : C.statusInfoBg,
                            color: v.tipo_venda === 'Solar' ? C.statusWarning : C.statusInfo,
                            borderRadius: '0.375rem', padding: '0.2rem 0.55rem',
                            fontSize: '0.75rem', fontFamily: F.body, fontWeight: '600', display: 'inline-block',
                          }}>{v.tipo_venda || 'Grau'}</span>
                          {naoEfetivada && (
                            <span style={{
                              background: C.statusDangerBg, color: C.statusDanger,
                              borderRadius: '0.375rem', padding: '0.15rem 0.45rem',
                              fontSize: '0.7rem', fontFamily: F.body, fontWeight: '700', display: 'inline-block',
                            }}>Não efetivada</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.mono, fontWeight: '700', color: C.statusInfo }}>
                        {v.os_numero ? `#${v.os_numero}` : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.body, color: C.onSurfaceVariant }}>{v.nota_fiscal || '—'}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.body, color: C.onSurfaceVariant }}>{v.nome_cliente || '—'}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.body, color: C.onSurfaceVariant, whiteSpace: 'nowrap' }}>{fDateBR(v.data_venda)}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.body, color: C.onSurfaceVariant }}>{vendedorMap[v.vendedor_id] || '—'}</td>
                      {filiais.length > 1 && (
                        <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.body, color: C.onSurfaceVariant, fontSize: '0.82rem' }}>
                          {filialMap[v.filial_id] || '—'}
                        </td>
                      )}
                      {isAdmin && (
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <button
                            onClick={() => toggleConferido(v)}
                            title={v.conferido ? `Conferido em ${v.conferido_em ? new Date(v.conferido_em).toLocaleString('pt-BR') : ''}` : 'Marcar como conferido'}
                            style={{
                              width: '2rem', height: '2rem', borderRadius: '0.375rem', border: 'none',
                              fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: v.conferido ? C.statusSuccessBg : C.surfaceContainerHigh,
                              color: v.conferido ? C.statusSuccess : C.onSurfaceVariant,
                            }}>
                            {v.conferido ? '✓' : '○'}
                          </button>
                        </td>
                      )}
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.mono, color: C.onSurface, whiteSpace: 'nowrap' }}>{fBRL(v.valor_bruto)}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.mono, color: v.desconto > 0 ? C.statusDanger : C.onSurfaceVariant, whiteSpace: 'nowrap' }}>
                        {v.desconto > 0 ? `- ${fBRL(v.desconto)}` : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.mono, fontWeight: '700', color: naoEfetivada ? C.onSurfaceVariant : C.statusSuccess, whiteSpace: 'nowrap' }}>
                        {fBRL(v.valor_final)}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.body, color: C.onSurfaceVariant }}>
                        {v.forma_pagamento === 'Entrada e Saldo' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ background: C.statusDangerBg, borderRadius: '0.375rem', padding: '0.15rem 0.45rem', fontSize: '0.73rem', fontWeight: '600', color: C.statusDanger, display: 'inline-block' }}>
                              Entrada {fBRL(v.entrada_valor)} — {v.entrada_forma}
                            </span>
                            <span style={{ background: C.statusInfoBg, borderRadius: '0.375rem', padding: '0.15rem 0.45rem', fontSize: '0.73rem', fontWeight: '600', color: C.statusInfo, display: 'inline-block' }}>
                              Saldo {fBRL(v.saldo_valor)} — {v.saldo_forma}
                            </span>
                          </div>
                        ) : (
                          <span style={{
                            background: C.surfaceContainerHigh, borderRadius: '0.375rem',
                            padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontFamily: F.body, fontWeight: '600',
                          }}>{v.forma_pagamento}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        {podeAlterar(v) && (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => abrirEdicao(v)}
                              style={{
                                padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontFamily: F.body, fontWeight: '600',
                                borderRadius: '0.375rem', border: `1.5px solid ${C.borderSubtle}`,
                                background: C.surfaceContainerLow, color: C.onSurfaceVariant, cursor: 'pointer',
                              }}>Editar</button>
                            <button onClick={() => excluir(v.id)}
                              style={{
                                padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontFamily: F.body, fontWeight: '600',
                                borderRadius: '0.375rem', border: `1.5px solid ${C.outlineVariant}`,
                                background: C.statusDangerBg, color: C.statusDanger, cursor: 'pointer',
                              }}>Excluir</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${C.borderSubtle}`, background: C.tableHeader }}>
                  <td colSpan={colsFixas} style={{ padding: '0.65rem 0.75rem', fontFamily: F.body, fontWeight: '700', color: C.onSurface, fontSize: '0.82rem' }}>
                    TOTAL EFETIVADO — {vendasEfetivadas.length} venda{vendasEfetivadas.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.mono, fontWeight: '700', color: C.onSurface, whiteSpace: 'nowrap' }}>{fBRL(totBruto)}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.mono, fontWeight: '700', color: C.statusDanger, whiteSpace: 'nowrap' }}>
                    {totDesc > 0 ? `- ${fBRL(totDesc)}` : '—'}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: F.mono, fontWeight: '800', color: C.statusSuccess, whiteSpace: 'nowrap' }}>{fBRL(totFinal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
