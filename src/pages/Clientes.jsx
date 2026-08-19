import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const card = {
  background: '#fff', borderRadius: '1rem', padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
}
const inputCss = {
  width: '100%', padding: '0.65rem 0.875rem', border: '1.5px solid #e2e8f0',
  borderRadius: '0.625rem', fontSize: '0.9rem', outline: 'none',
  boxSizing: 'border-box', color: '#1e293b', background: '#f8fafc',
}
const btnPrimary = {
  padding: '0.6rem 1.25rem', background: '#C0272D', color: '#fff',
  border: 'none', borderRadius: '0.625rem', fontSize: '0.875rem',
  fontWeight: '600', cursor: 'pointer',
}
const btnSecondary = {
  padding: '0.6rem 1.25rem', background: '#f1f5f9', color: '#475569',
  border: '1.5px solid #e2e8f0', borderRadius: '0.625rem', fontSize: '0.875rem',
  fontWeight: '600', cursor: 'pointer',
}
const Label = ({ children }) => (
  <label style={{
    display: 'block', fontSize: '0.8rem', fontWeight: '600',
    color: '#475569', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px',
  }}>{children}</label>
)

const FORM_INIT = { nome: '', cpf: '', telefone: '', endereco: '' }

export default function Clientes() {
  const { isAdmin } = useAuth()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_INIT)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState(null)

  function showToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('clientes').select('*').order('nome', { nullsFirst: false })
    setClientes(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setForm(FORM_INIT)
    setEditId(null)
    setShowForm(true)
  }

  function abrirEdicao(c) {
    setForm({ nome: c.nome || '', cpf: c.cpf || '', telefone: c.telefone || '', endereco: c.endereco || '' })
    setEditId(c.id)
    setShowForm(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nome:     form.nome     || null,
      cpf:      form.cpf      || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
    }
    let error
    if (editId) {
      ;({ error } = await supabase.from('clientes').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('clientes').insert(payload))
    }
    setSaving(false)
    if (error) {
      showToast('Erro ao salvar: ' + error.message, 'err')
    } else {
      showToast(editId ? 'Cliente atualizado!' : 'Cliente cadastrado!')
      setShowForm(false)
      carregar()
    }
  }

  async function excluir(id) {
    if (!window.confirm('Confirma exclusão deste cliente?')) return
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) {
      showToast('Erro ao excluir: ' + error.message, 'err')
    } else {
      showToast('Cliente excluído.')
      carregar()
    }
  }

  const listaFiltrada = clientes.filter(c => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return (
      (c.nome     || '').toLowerCase().includes(b) ||
      (c.cpf      || '').includes(b) ||
      (c.telefone || '').includes(b)
    )
  })

  return (
    <div className="pg">
      {toast && (
        <div style={{
          position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 9999,
          padding: '0.75rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem',
          fontWeight: '600', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          background: toast.tipo === 'err' ? '#dc2626' : '#16a34a', maxWidth: '320px',
        }}>{toast.msg}</div>
      )}

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f2d4a', margin: 0, letterSpacing: '-0.3px' }}>
          Cadastro de Clientes
        </h1>
        {!showForm && (
          <button style={btnPrimary} onClick={abrirNovo}>+ Novo Cliente</button>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <div style={{ ...card, marginBottom: '1.5rem', borderLeft: '4px solid #C0272D' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f2d4a', margin: '0 0 1.25rem' }}>
            {editId ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <Label>Nome</Label>
                <input style={inputCss} placeholder="Nome do cliente"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <Label>CPF</Label>
                <input style={inputCss} placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <input style={inputCss} placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Endereço completo</Label>
              <input style={inputCss} placeholder="Rua, número, bairro, cidade, estado, CEP"
                value={form.endereco}
                onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" style={btnPrimary} disabled={saving}>
                {saving ? 'Salvando...' : (editId ? 'Atualizar' : 'Cadastrar')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Busca */}
      <div style={{ ...card, marginBottom: '1rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="search" placeholder="Buscar por nome, CPF ou telefone…"
            value={busca} onChange={e => setBusca(e.target.value)}
            style={{ ...inputCss, maxWidth: '360px' }}
          />
          {!loading && (
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {listaFiltrada.length} cliente{listaFiltrada.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div style={card}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem 0' }}>Carregando...</div>
        ) : listaFiltrada.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
            <div style={{ fontWeight: '600' }}>
              {clientes.length === 0
                ? 'Nenhum cliente cadastrado. Clique em "+ Novo Cliente" para começar.'
                : 'Nenhum resultado para a busca.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Nome', 'CPF', 'Telefone', 'Endereço', 'Ações'].map(h => (
                    <th key={h} style={{
                      padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.75rem',
                      fontWeight: '700', color: '#64748b', textTransform: 'uppercase',
                      letterSpacing: '0.4px', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '0.7rem 0.75rem', fontWeight: '600', color: '#1e293b' }}>
                      {c.nome || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', color: '#475569', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {c.cpf || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem' }}>
                      {c.telefone
                        ? <a href={`tel:${c.telefone}`} style={{ color: '#0f2d4a', textDecoration: 'none', fontWeight: '500' }}>{c.telefone}</a>
                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', color: '#64748b', fontSize: '0.82rem', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.endereco || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => abrirEdicao(c)}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontWeight: '600', borderRadius: '0.4rem', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}>
                          Editar
                        </button>
                        {isAdmin && (
                          <button onClick={() => excluir(c.id)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontWeight: '600', borderRadius: '0.4rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
