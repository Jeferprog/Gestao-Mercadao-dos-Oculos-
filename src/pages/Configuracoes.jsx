import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/* ─────────────────────────────────────────── helpers de estilo ── */

const card = {
  background: '#fff',
  borderRadius: '1rem',
  padding: '1.75rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid #f1f5f9',
  marginBottom: '1.5rem',
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
  background: '#1e5799',
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

function Label({ children }) {
  return (
    <label style={{
      display: 'block',
      fontSize: '0.8rem',
      fontWeight: '600',
      color: '#475569',
      marginBottom: '0.4rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      {children}
    </label>
  )
}

/* ─────────────────────────────────────────── Toast ── */

function Toast({ msg }) {
  if (!msg) return null
  const isError = msg.toLowerCase().includes('erro')
  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      padding: '0.875rem 1.25rem',
      background: isError ? '#dc2626' : '#16a34a',
      color: '#fff',
      borderRadius: '0.75rem',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      fontSize: '0.875rem',
      fontWeight: '600',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      maxWidth: '340px',
    }}>
      {isError ? '❌' : '✅'} {msg}
    </div>
  )
}

/* ─────────────────────────────────────────── Modal ── */

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,45,74,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 500,
      padding: '1rem',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: '1.25rem',
        padding: 'clamp(1rem, 5vw, 2rem)',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90dvh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f2d4a' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.25rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── Aba: Sistema ── */

function TabSistema({ showToast }) {
  const [osNumero, setOsNumero] = useState('')
  const [formas, setFormas] = useState([])
  const [novaForma, setNovaForma] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from('configuracoes').select('*')
    if (data) {
      const map = Object.fromEntries(data.map(r => [r.chave, r.valor]))
      setOsNumero(map.os_numero_inicial || '1')
      setFormas((map.formas_pagamento || '').split(',').filter(Boolean))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  async function salvarOs() {
    if (!osNumero || parseInt(osNumero) < 1) return
    setSaving(true)
    const { error } = await supabase
      .from('configuracoes')
      .update({ valor: String(parseInt(osNumero)) })
      .eq('chave', 'os_numero_inicial')
    showToast(error ? 'Erro ao salvar número inicial.' : 'Número inicial salvo!')
    setSaving(false)
  }

  async function salvarFormas() {
    if (formas.length === 0) return
    setSaving(true)
    const { error } = await supabase
      .from('configuracoes')
      .update({ valor: formas.join(',') })
      .eq('chave', 'formas_pagamento')
    showToast(error ? 'Erro ao salvar formas de pagamento.' : 'Formas de pagamento salvas!')
    setSaving(false)
  }

  function addForma() {
    const f = novaForma.trim()
    if (f && !formas.includes(f)) {
      setFormas(prev => [...prev, f])
      setNovaForma('')
    }
  }

  function removeForma(f) {
    setFormas(prev => prev.filter(x => x !== f))
  }

  if (loading) return <p style={{ color: '#94a3b8' }}>Carregando configurações...</p>

  return (
    <>
      {/* Número Inicial da O.S. */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
          Número Inicial da Ordem de Serviço
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 1.25rem', lineHeight: '1.5' }}>
          Define a partir de qual número as O.S. serão geradas.
          O próximo número sempre será o maior já cadastrado + 1 (ou este valor, se não houver nenhuma venda).
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
          <div>
            <Label>Número inicial</Label>
            <input
              type="number"
              value={osNumero}
              onChange={e => setOsNumero(e.target.value)}
              min="1"
              style={{ ...inputCss, width: '120px' }}
            />
          </div>
          <button onClick={salvarOs} disabled={saving} style={btnPrimary}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Formas de Pagamento */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
          Formas de Pagamento
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 1.25rem', lineHeight: '1.5' }}>
          Gerencie as opções disponíveis no cadastro de vendas.
        </p>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', minHeight: '36px' }}>
          {formas.map(f => (
            <span key={f} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              background: '#eff6ff',
              color: '#1d4ed8',
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.82rem',
              fontWeight: '500',
            }}>
              {f}
              <button
                onClick={() => removeForma(f)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#93c5fd',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: 0,
                }}
                title={`Remover ${f}`}
              >
                ×
              </button>
            </span>
          ))}
          {formas.length === 0 && (
            <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Nenhuma forma cadastrada.</span>
          )}
        </div>

        {/* Adicionar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input
            type="text"
            value={novaForma}
            onChange={e => setNovaForma(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addForma())}
            placeholder="Ex: Transferência"
            style={{ ...inputCss, flex: 1 }}
          />
          <button onClick={addForma} style={btnSecondary}>+ Adicionar</button>
        </div>

        <button onClick={salvarFormas} disabled={saving || formas.length === 0} style={btnPrimary}>
          {saving ? 'Salvando...' : 'Salvar Formas de Pagamento'}
        </button>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────── Aba: Vendedores ── */

const PAPEL_LABEL = { admin: 'Administrador', vendedor: 'Vendedor' }

const FORM_INITIAL = { nome: '', email: '', senha: '', papel: 'vendedor', comissao_percentual: '0' }

function TabVendedores({ showToast }) {
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | { type:'edit', data:obj }
  const [form, setForm] = useState(FORM_INITIAL)
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadVendedores = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('nome')
    setVendedores(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadVendedores() }, [loadVendedores])

  function openAdd() {
    setForm(FORM_INITIAL)
    setModalError('')
    setModal('add')
  }

  function openEdit(v) {
    setForm({
      id: v.id,
      nome: v.nome,
      email: v.email || '',
      senha: '',
      papel: v.papel,
      comissao_percentual: String(v.comissao_percentual ?? 0),
    })
    setModalError('')
    setModal({ type: 'edit', data: v })
  }

  function fecharModal() {
    setModal(null)
    setModalError('')
  }

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleAdd() {
    if (!form.nome.trim() || !form.email.trim() || !form.senha) {
      setModalError('Preencha nome, e-mail e senha.')
      return
    }
    if (form.senha.length < 6) {
      setModalError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setSaving(true)
    setModalError('')

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.senha,
      options: {
        data: {
          nome: form.nome.trim(),
          papel: form.papel,
        },
      },
    })

    if (error) {
      setModalError('Erro ao criar usuário: ' + error.message)
      setSaving(false)
      return
    }

    // Atualiza perfil com comissão (nome e papel já foram definidos pelo trigger)
    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          nome: form.nome.trim(),
          papel: form.papel,
          comissao_percentual: parseFloat(form.comissao_percentual) || 0,
        })
        .eq('id', data.user.id)
    }

    setSaving(false)
    fecharModal()
    await loadVendedores()
    showToast('Vendedor criado! Um e-mail de confirmação foi enviado.')
  }

  async function handleEdit() {
    if (!form.nome.trim()) {
      setModalError('O nome não pode estar vazio.')
      return
    }
    setSaving(true)
    setModalError('')

    const { error } = await supabase
      .from('profiles')
      .update({
        nome: form.nome.trim(),
        papel: form.papel,
        comissao_percentual: parseFloat(form.comissao_percentual) || 0,
      })
      .eq('id', form.id)

    if (error) {
      setModalError('Erro ao atualizar: ' + error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    fecharModal()
    await loadVendedores()
    showToast('Vendedor atualizado com sucesso!')
  }

  async function toggleAtivo(v) {
    await supabase.from('profiles').update({ ativo: !v.ativo }).eq('id', v.id)
    await loadVendedores()
    showToast(v.ativo ? 'Vendedor desativado.' : 'Vendedor ativado!')
  }

  if (loading) return <p style={{ color: '#94a3b8' }}>Carregando vendedores...</p>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
          {vendedores.length} {vendedores.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}
        </p>
        <button onClick={openAdd} style={btnPrimary}>
          + Adicionar Vendedor
        </button>
      </div>

      {/* Tabela */}
      <div style={{
        background: '#fff',
        borderRadius: '1rem',
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['Nome', 'E-mail', 'Papel', 'Comissão', 'Status', 'Ações'].map(col => (
                  <th key={col} style={{
                    textAlign: 'left',
                    padding: '0.875rem 1rem',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendedores.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#cbd5e1', fontSize: '0.9rem' }}>
                    Nenhum vendedor cadastrado ainda.
                  </td>
                </tr>
              )}
              {vendedores.map((v, i) => (
                <tr key={v.id} style={{
                  borderBottom: i < vendedores.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.875rem 1rem', fontWeight: '600', color: '#1e293b', fontSize: '0.875rem' }}>
                    {v.nome}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#64748b', fontSize: '0.875rem' }}>
                    {v.email || '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.625rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: v.papel === 'admin' ? '#faf5ff' : '#eff6ff',
                      color: v.papel === 'admin' ? '#7c3aed' : '#1d4ed8',
                    }}>
                      {PAPEL_LABEL[v.papel] || v.papel}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#64748b', fontSize: '0.875rem' }}>
                    {v.comissao_percentual ?? 0}%
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.625rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: v.ativo ? '#f0fdf4' : '#f8fafc',
                      color: v.ativo ? '#16a34a' : '#94a3b8',
                    }}>
                      {v.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => openEdit(v)}
                        style={{
                          padding: '0.3rem 0.75rem',
                          background: 'none',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: '0.5rem',
                          color: '#475569',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleAtivo(v)}
                        style={{
                          padding: '0.3rem 0.75rem',
                          background: 'none',
                          border: `1.5px solid ${v.ativo ? '#fecaca' : '#bbf7d0'}`,
                          borderRadius: '0.5rem',
                          color: v.ativo ? '#dc2626' : '#16a34a',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        {v.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aviso sobre criação de usuários */}
      <div style={{
        marginTop: '1rem',
        background: '#fefce8',
        border: '1px solid #fde68a',
        borderRadius: '0.75rem',
        padding: '0.875rem 1.25rem',
        fontSize: '0.8rem',
        color: '#854d0e',
        lineHeight: '1.5',
      }}>
        ⚠️ <strong>Atenção:</strong> Ao adicionar um novo vendedor, ele receberá um e-mail de confirmação
        para ativar a conta. Para que isso funcione, certifique-se de que as confirmações de e-mail estejam
        ativadas no Supabase (Authentication → Providers → Email → "Confirm email").
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Adicionar Vendedor' : 'Editar Vendedor'}
          onClose={fecharModal}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <Label>Nome completo *</Label>
              <input
                type="text"
                value={form.nome}
                onChange={e => setField('nome', e.target.value)}
                style={inputCss}
                placeholder="João da Silva"
                autoFocus
              />
            </div>

            {modal === 'add' && (
              <>
                <div>
                  <Label>E-mail *</Label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    style={inputCss}
                    placeholder="joao@exemplo.com"
                  />
                </div>
                <div>
                  <Label>Senha inicial *</Label>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={e => setField('senha', e.target.value)}
                    style={inputCss}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <p style={{ margin: '0.3rem 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>
                    O vendedor poderá trocar a senha depois de confirmar o e-mail.
                  </p>
                </div>
              </>
            )}

            <div>
              <Label>Papel</Label>
              <select
                value={form.papel}
                onChange={e => setField('papel', e.target.value)}
                style={inputCss}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <Label>Comissão (%)</Label>
              <input
                type="number"
                value={form.comissao_percentual}
                onChange={e => setField('comissao_percentual', e.target.value)}
                style={{ ...inputCss, width: '130px' }}
                min="0"
                max="100"
                step="0.5"
              />
            </div>

            {modalError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '0.625rem 0.875rem',
                color: '#dc2626',
                fontSize: '0.82rem',
              }}>
                {modalError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={fecharModal} style={{ ...btnSecondary, flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={modal === 'add' ? handleAdd : handleEdit}
                disabled={saving}
                style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ─────────────────────────────────────────── Página principal ── */

export default function Configuracoes() {
  const { isAdmin, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('sistema')
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  if (loading) return null

  if (!isAdmin) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          color: '#dc2626',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Acesso Restrito</h2>
          <p style={{ margin: 0, color: '#ef4444', fontSize: '0.875rem' }}>
            Apenas administradores podem acessar as Configurações.
          </p>
        </div>
      </div>
    )
  }

  const tabStyle = (active) => ({
    padding: '0.75rem 1.5rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: active ? '700' : '500',
    color: active ? '#1e5799' : '#64748b',
    borderBottom: active ? '2.5px solid #1e5799' : '2.5px solid transparent',
    transition: 'all 0.15s',
  })

  return (
    <div className="pg">
      <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f2d4a', margin: '0 0 1.5rem', letterSpacing: '-0.3px' }}>
        Configurações
      </h1>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '1.75rem', display: 'flex' }}>
        <button onClick={() => setActiveTab('sistema')} style={tabStyle(activeTab === 'sistema')}>
          ⚙️ Sistema
        </button>
        <button onClick={() => setActiveTab('vendedores')} style={tabStyle(activeTab === 'vendedores')}>
          👥 Vendedores
        </button>
      </div>

      {activeTab === 'sistema' && <TabSistema showToast={showToast} />}
      {activeTab === 'vendedores' && <TabVendedores showToast={showToast} />}

      <Toast msg={toast} />
    </div>
  )
}
