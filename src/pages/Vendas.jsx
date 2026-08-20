import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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

/* ── estilos ── */
const card = {
  background: '#fff',
  borderRadius: '1rem',
  padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid #f1f5f9',
}
const inputCss = {
  width: '100%',
  padding: '0.65rem 0.875rem',
  border: '1.5px solid #e2e8f0',
  borderRadius: '0.625rem',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
  color: '#1e293b',
  background: '#f8fafc',
}
const btnPrimary = {
  padding: '0.6rem 1.25rem',
  background: '#C0272D',
  color: '#fff',
  border: 'none',
  borderRadius: '0.625rem',
  fontSize: '0.875rem',
  fontWeight: '600',
  cursor: 'pointer',
}
const btnSecondary = {
  padding: '0.6rem 1.25rem',
  background: '#f1f5f9',
  color: '#475569',
  border: '1.5px solid #e2e8f0',
  borderRadius: '0.625rem',
  fontSize: '0.875rem',
  fontWeight: '600',
  cursor: 'pointer',
}
const Label = ({ children }) => (
  <label style={{
    display: 'block', fontSize: '0.8rem', fontWeight: '600',
    color: '#475569', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px',
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
  forma_pagamento: '',
}

/* ── FormVenda ── */
function FormVenda({ form, onChange, vendedores, filiais, formasPagamento, isAdmin, onSubmit, onCancel, saving, editando }) {
  function handleBrutoDesc(field, val) {
    const next = { ...form, [field]: val }
    const bruto = parseFloat(String(next.valor_bruto).replace(',', '.')) || 0
    const desc = parseFloat(String(next.desconto).replace(',', '.')) || 0
    next.valor_final = Math.max(0, bruto - desc).toFixed(2)
    onChange(next)
  }

  const bruto = parseFloat(String(form.valor_bruto).replace(',', '.')) || 0
  const desc = parseFloat(String(form.desconto).replace(',', '.')) || 0
  const isGrau = form.tipo_venda === 'Grau'

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>

        {/* Tipo de Venda */}
        <div>
          <Label>Tipo de Venda</Label>
          <select style={inputCss}
            value={form.tipo_venda}
            onChange={e => onChange({ ...form, tipo_venda: e.target.value, os_numero: e.target.value === 'Solar' ? '' : form.os_numero })}>
            <option value="Grau">Óculos de Grau</option>
            <option value="Solar">Solar</option>
          </select>
        </div>

        {/* O.S. — somente para Grau */}
        {isGrau && (
          <div>
            <Label>Nº O.S.</Label>
            <input style={{ ...inputCss, background: '#f1f5f9', color: '#94a3b8' }}
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
              onChange={e => onChange({ ...form, filial_id: e.target.value })}>
              <option value="">Sem filial</option>
              {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        ) : filiais.length > 1 && (
          <div>
            <Label>Filial</Label>
            <input style={{ ...inputCss, background: '#f1f5f9', color: '#64748b' }}
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
            <input style={{ ...inputCss, background: '#f1f5f9', color: '#64748b' }}
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
            <span style={{ color: '#dc2626', fontSize: '0.78rem' }}>Desconto maior que o valor bruto</span>
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
            onChange={e => onChange({ ...form, forma_pagamento: e.target.value })}>
            <option value="">Selecione...</option>
            {formasPagamento.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
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
  const [dataSel, setDataSel] = useState(todayISO())
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

  /* dias com movimento no mês atual */
  const carregarDias = useCallback(async () => {
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
  }, [dataSel, filtroFilial, isAdmin, profile?.id])

  /* vendas do dia selecionado */
  const carregarVendas = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('vendas')
      .select('*')
      .eq('data_venda', dataSel)
      .order('os_numero', { nullsLast: true })
    if (filtroFilial) q = q.eq('filial_id', filtroFilial)
    else if (!isAdmin) q = q.eq('vendedor_id', profile?.id || '')
    const { data, error } = await q
    if (!error && data) setVendas(data)
    setLoading(false)
  }, [dataSel, filtroFilial, isAdmin, profile?.id])

  useEffect(() => {
    carregarDias()
    carregarVendas()
  }, [carregarDias, carregarVendas])

  /* próximo O.S. por filial */
  async function getProximoOs(filialId) {
    let q = supabase
      .from('vendas')
      .select('os_numero')
      .not('os_numero', 'is', null)
      .order('os_numero', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (filialId) q = supabase.from('vendas').select('os_numero').eq('filial_id', filialId).not('os_numero', 'is', null).order('os_numero', { ascending: false }).limit(1).maybeSingle()

    const { data: maxRow } = await q
    if (maxRow) return maxRow.os_numero + 1

    // fallback: os_numero_inicial da filial ou configurações globais
    if (filialId) {
      const { data: fil } = await supabase.from('filiais').select('os_numero_inicial').eq('id', filialId).maybeSingle()
      if (fil) return fil.os_numero_inicial || 1
    }
    const { data: cfgRows } = await supabase.from('configuracoes').select('*')
    if (cfgRows) {
      const map = Object.fromEntries(cfgRows.map(r => [r.chave, r.valor]))
      return parseInt(map.os_numero_inicial) || 1
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
      data_venda: dataSel,
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

    setSaving(true)
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

  function podeAlterar(v) {
    return isAdmin || v.vendedor_id === profile?.id
  }

  const totBruto = vendas.reduce((s, v) => s + (v.valor_bruto || 0), 0)
  const totDesc = vendas.reduce((s, v) => s + (v.desconto || 0), 0)
  const totFinal = vendas.reduce((s, v) => s + (v.valor_final || 0), 0)
  const vendedorMap = Object.fromEntries(vendedores.map(v => [v.id, v.nome]))
  const filialMap = Object.fromEntries(filiais.map(f => [f.id, f.nome]))

  function navegarDia(delta) {
    const d = new Date(dataSel + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDataSel(d.toISOString().slice(0, 10))
  }

  const hoje = todayISO()

  return (
    <div className="pg">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 9999,
          padding: '0.75rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem',
          fontWeight: '600', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          background: toast.tipo === 'err' ? '#dc2626' : '#16a34a',
          maxWidth: '320px',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f2d4a', margin: 0, letterSpacing: '-0.3px' }}>
          Vendas Diárias
        </h1>
        {!showForm && (
          <button style={btnPrimary} onClick={abrirNovaVenda}>
            + Nova Venda
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <div style={{ ...card, marginBottom: '1.5rem', borderLeft: '4px solid #C0272D' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f2d4a', margin: '0 0 1.25rem' }}>
            {editId ? 'Editar Venda' : 'Nova Venda'}
          </h2>
          <FormVenda
            form={form}
            onChange={setForm}
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
      )}

      {/* Filtro de filial (admin + múltiplas filiais) */}
      {isAdmin && filiais.length > 1 && (
        <div style={{ ...card, marginBottom: '1rem', padding: '1rem 1.5rem' }}>
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

      {/* Seletor de Data */}
      <div style={{ ...card, marginBottom: '1rem' }}>
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
              background: dataSel === hoje ? '#C0272D' : '#f1f5f9',
              color: dataSel === hoje ? '#fff' : '#475569',
              border: dataSel === hoje ? 'none' : '1.5px solid #e2e8f0',
            }}>
            Hoje
          </button>
        </div>

        {/* Pills — dias com movimento */}
        {diasComVendas.length > 0 && (
          <div style={{ marginTop: '0.875rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Dias com movimento
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '4px' }}>
              {diasComVendas.map(d => (
                <button key={d} onClick={() => setDataSel(d)}
                  style={{
                    flexShrink: 0, padding: '0.3rem 0.7rem', borderRadius: '2rem',
                    border: 'none', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                    background: d === dataSel ? '#C0272D' : '#f1f5f9',
                    color: d === dataSel ? '#fff' : '#475569',
                  }}>
                  {fDateBR(d)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div style={{ ...card }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: '700', color: '#0f2d4a', fontSize: '0.95rem' }}>
            {fDateBR(dataSel)}
            {vendas.length > 0 && (
              <span style={{ marginLeft: '0.5rem', color: '#64748b', fontWeight: '400', fontSize: '0.85rem' }}>
                — {vendas.length} venda{vendas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem 0' }}>Carregando...</div>
        ) : vendas.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontWeight: '600' }}>Nenhuma venda neste dia</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Clique em "+ Nova Venda" para registrar</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Tipo', 'O.S.', 'N. Fiscal', 'Cliente', 'Data', 'Vendedor', ...(filiais.length > 1 ? ['Filial'] : []), 'Valor Bruto', 'Desconto', 'Valor Final', 'Pagamento', 'Ações'].map(h => (
                    <th key={h} style={{
                      padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.75rem',
                      fontWeight: '700', color: '#64748b', textTransform: 'uppercase',
                      letterSpacing: '0.4px', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendas.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{
                        background: v.tipo_venda === 'Solar' ? '#fef3c7' : '#eff6ff',
                        color: v.tipo_venda === 'Solar' ? '#92400e' : '#1d4ed8',
                        borderRadius: '0.4rem', padding: '0.2rem 0.55rem',
                        fontSize: '0.75rem', fontWeight: '600',
                      }}>{v.tipo_venda || 'Grau'}</span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: '700', color: '#0f2d4a' }}>
                      {v.os_numero ? `#${v.os_numero}` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#475569' }}>{v.nota_fiscal || '—'}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#475569' }}>{v.nome_cliente || '—'}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>{fDateBR(v.data_venda)}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#475569' }}>{vendedorMap[v.vendedor_id] || '—'}</td>
                    {filiais.length > 1 && (
                      <td style={{ padding: '0.65rem 0.75rem', color: '#475569', fontSize: '0.82rem' }}>
                        {filialMap[v.filial_id] || '—'}
                      </td>
                    )}
                    <td style={{ padding: '0.65rem 0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>{fBRL(v.valor_bruto)}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: v.desconto > 0 ? '#dc2626' : '#94a3b8', whiteSpace: 'nowrap' }}>
                      {v.desconto > 0 ? `- ${fBRL(v.desconto)}` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: '700', color: '#16a34a', whiteSpace: 'nowrap' }}>{fBRL(v.valor_final)}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#475569' }}>
                      <span style={{
                        background: '#f1f5f9', borderRadius: '0.4rem',
                        padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: '600',
                      }}>{v.forma_pagamento}</span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      {podeAlterar(v) && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => abrirEdicao(v)}
                            style={{
                              padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontWeight: '600',
                              borderRadius: '0.4rem', border: '1.5px solid #e2e8f0',
                              background: '#f8fafc', color: '#475569', cursor: 'pointer',
                            }}>Editar</button>
                          <button onClick={() => excluir(v.id)}
                            style={{
                              padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontWeight: '600',
                              borderRadius: '0.4rem', border: '1.5px solid #fecaca',
                              background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
                            }}>Excluir</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                  <td colSpan={filiais.length > 1 ? 7 : 6} style={{ padding: '0.65rem 0.75rem', fontWeight: '700', color: '#0f2d4a', fontSize: '0.82rem' }}>
                    TOTAL — {vendas.length} venda{vendas.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: '700', color: '#0f2d4a', whiteSpace: 'nowrap' }}>{fBRL(totBruto)}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: '700', color: '#dc2626', whiteSpace: 'nowrap' }}>
                    {totDesc > 0 ? `- ${fBRL(totDesc)}` : '—'}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: '800', color: '#16a34a', whiteSpace: 'nowrap' }}>{fBRL(totFinal)}</td>
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
