import { useState, useEffect, useCallback } from 'react'
import { supabase, createSignupClient } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { C, F, card as dsCard, inputCss, btnPrimary, btnSecondary } from '../lib/ds'

/* card with marginBottom preserved from original */
const cardMb = { ...dsCard, marginBottom: '1.5rem' }

function Label({ children }) {
  return (
    <label style={{
      display: 'block', fontSize: '0.8rem', fontWeight: '600',
      color: C.onSurfaceVariant, marginBottom: '0.4rem',
      textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F.body,
    }}>
      {children}
    </label>
  )
}

/* ── Toast ── */
function Toast({ msg }) {
  if (!msg) return null
  const isError = msg.toLowerCase().includes('erro')
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      padding: '0.875rem 1.25rem',
      background: isError ? C.statusDanger : C.statusSuccess,
      color: C.onPrimary, borderRadius: '0.75rem',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)', fontSize: '0.875rem',
      fontWeight: '600', fontFamily: F.body, zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '340px',
    }}>
      {isError ? '❌' : '✅'} {msg}
    </div>
  )
}

/* ── Modal ── */
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,45,74,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 500, padding: '1rem',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: C.surfaceContainerLowest, borderRadius: '1.25rem',
        padding: 'clamp(1rem, 5vw, 2rem)', width: '100%', maxWidth: '480px',
        maxHeight: '90dvh', overflowY: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: C.onSurface, fontFamily: F.headline }}>{title}</h3>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.onSurfaceVariant, fontSize: '1.25rem', lineHeight: 1 }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Aba: Sistema ── */
function TabSistema({ showToast }) {
  const [formas, setFormas] = useState([])
  const [novaForma, setNovaForma] = useState('')
  const [categorias, setCategorias] = useState([])
  const [novaCategoria, setNovaCategoria] = useState('')
  const [situacoes, setSituacoes] = useState([])
  const [novaSituacao, setNovaSituacao] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from('configuracoes').select('*')
    if (data) {
      const map = Object.fromEntries(data.map(r => [r.chave, r.valor]))
      setFormas((map.formas_pagamento || '').split(',').filter(Boolean))
      setCategorias((map.categorias_despesa || '').split(',').filter(Boolean))
      setSituacoes((map.situacoes_cobranca || '').split(',').filter(Boolean))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

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
    if (f && !formas.includes(f)) { setFormas(prev => [...prev, f]); setNovaForma('') }
  }
  function removeForma(f) { setFormas(prev => prev.filter(x => x !== f)) }

  async function salvarCategorias() {
    if (categorias.length === 0) return
    setSaving(true)
    const { error } = await supabase
      .from('configuracoes')
      .update({ valor: categorias.join(',') })
      .eq('chave', 'categorias_despesa')
    showToast(error ? 'Erro ao salvar categorias.' : 'Categorias salvas!')
    setSaving(false)
  }

  function addCategoria() {
    const c = novaCategoria.trim()
    if (c && !categorias.includes(c)) { setCategorias(prev => [...prev, c]); setNovaCategoria('') }
  }
  function removeCategoria(c) { setCategorias(prev => prev.filter(x => x !== c)) }

  async function salvarSituacoes() {
    if (situacoes.length === 0) return
    setSaving(true)
    const { error } = await supabase
      .from('configuracoes')
      .update({ valor: situacoes.join(',') })
      .eq('chave', 'situacoes_cobranca')
    showToast(error ? 'Erro ao salvar situações.' : 'Situações de cobrança salvas!')
    setSaving(false)
  }

  function addSituacao() {
    const s = novaSituacao.trim()
    if (s && !situacoes.includes(s)) { setSituacoes(prev => [...prev, s]); setNovaSituacao('') }
  }
  function removeSituacao(s) { setSituacoes(prev => prev.filter(x => x !== s)) }

  if (loading) return <p style={{ color: C.onSurfaceVariant, fontFamily: F.body }}>Carregando configurações...</p>

  return (
    <>
      {/* Formas de Pagamento */}
      <div style={cardMb}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '700', color: C.onSurface, fontFamily: F.headline }}>
          Formas de Pagamento
        </h3>
        <p style={{ color: C.onSurfaceVariant, fontSize: '0.82rem', margin: '0 0 1.25rem', lineHeight: '1.5', fontFamily: F.body }}>
          Gerencie as opções disponíveis no cadastro de vendas.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', minHeight: '36px' }}>
          {formas.map(f => (
            <span key={f} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              background: C.statusInfoBg, color: C.statusInfo,
              padding: '0.3rem 0.75rem', borderRadius: '999px',
              fontSize: '0.82rem', fontWeight: '500', fontFamily: F.body,
            }}>
              {f}
              <button onClick={() => removeForma(f)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.statusInfo, fontSize: '1rem', lineHeight: 1, padding: 0, opacity: 0.6 }}
                title={`Remover ${f}`}>×</button>
            </span>
          ))}
          {formas.length === 0 && (
            <span style={{ color: C.outlineVariant, fontSize: '0.85rem', fontFamily: F.body }}>Nenhuma forma cadastrada.</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input type="text" value={novaForma} onChange={e => setNovaForma(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addForma())}
            placeholder="Ex: Transferência" style={{ ...inputCss, flex: 1 }} />
          <button onClick={addForma} style={btnSecondary}>+ Adicionar</button>
        </div>
        <button onClick={salvarFormas} disabled={saving || formas.length === 0} style={btnPrimary}>
          {saving ? 'Salvando...' : 'Salvar Formas de Pagamento'}
        </button>
      </div>

      {/* Categorias de Despesa */}
      <div style={cardMb}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '700', color: C.onSurface, fontFamily: F.headline }}>
          Categorias de Despesa
        </h3>
        <p style={{ color: C.onSurfaceVariant, fontSize: '0.82rem', margin: '0 0 1.25rem', lineHeight: '1.5', fontFamily: F.body }}>
          Gerencie as categorias disponíveis no módulo de Contas a Pagar.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', minHeight: '36px' }}>
          {categorias.map(c => (
            <span key={c} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              background: C.statusDangerBg, color: C.statusDanger,
              padding: '0.3rem 0.75rem', borderRadius: '999px',
              fontSize: '0.82rem', fontWeight: '500', fontFamily: F.body,
            }}>
              {c}
              <button onClick={() => removeCategoria(c)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.statusDanger, fontSize: '1rem', lineHeight: 1, padding: 0, opacity: 0.6 }}
                title={`Remover ${c}`}>×</button>
            </span>
          ))}
          {categorias.length === 0 && (
            <span style={{ color: C.outlineVariant, fontSize: '0.85rem', fontFamily: F.body }}>Nenhuma categoria cadastrada.</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input type="text" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategoria())}
            placeholder="Ex: Manutenção" style={{ ...inputCss, flex: 1 }} />
          <button onClick={addCategoria} style={btnSecondary}>+ Adicionar</button>
        </div>
        <button onClick={salvarCategorias} disabled={saving || categorias.length === 0} style={btnPrimary}>
          {saving ? 'Salvando...' : 'Salvar Categorias'}
        </button>
      </div>

      {/* Situações de Cobrança */}
      <div style={cardMb}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '700', color: C.onSurface, fontFamily: F.headline }}>
          Situações de Cobrança
        </h3>
        <p style={{ color: C.onSurfaceVariant, fontSize: '0.82rem', margin: '0 0 1.25rem', lineHeight: '1.5', fontFamily: F.body }}>
          Opções disponíveis no campo "Situação Atual" de cada boleto no módulo de Cobranças.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', minHeight: '36px' }}>
          {situacoes.map(s => (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              background: 'rgba(157,5,24,0.08)', color: '#9d0518',
              padding: '0.3rem 0.75rem', borderRadius: '999px',
              fontSize: '0.82rem', fontWeight: '500', fontFamily: F.body,
            }}>
              {s}
              <button onClick={() => removeSituacao(s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9d0518', fontSize: '1rem', lineHeight: 1, padding: 0, opacity: 0.6 }}
                title={`Remover ${s}`}>×</button>
            </span>
          ))}
          {situacoes.length === 0 && (
            <span style={{ color: C.outlineVariant, fontSize: '0.85rem', fontFamily: F.body }}>Nenhuma situação cadastrada.</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input type="text" value={novaSituacao} onChange={e => setNovaSituacao(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSituacao())}
            placeholder="Ex: Renegociado" style={{ ...inputCss, flex: 1 }} />
          <button onClick={addSituacao} style={btnSecondary}>+ Adicionar</button>
        </div>
        <button onClick={salvarSituacoes} disabled={saving || situacoes.length === 0} style={btnPrimary}>
          {saving ? 'Salvando...' : 'Salvar Situações de Cobrança'}
        </button>
      </div>
    </>
  )
}

/* ── Aba: Filiais ── */
const FILIAL_INIT = { nome: '', os_numero_inicial: '1' }

function TabFiliais({ showToast }) {
  const [filiais, setFiliais] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(FILIAL_INIT)
  const [saving, setSaving] = useState(false)

  const loadFiliais = useCallback(async () => {
    const { data } = await supabase.from('filiais').select('*').order('nome')
    setFiliais(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadFiliais() }, [loadFiliais])

  function openAdd() { setForm(FILIAL_INIT); setModal('add') }
  function openEdit(f) {
    setForm({ nome: f.nome, os_numero_inicial: String(f.os_numero_inicial || 1) })
    setModal({ type: 'edit', data: f })
  }

  async function handleSave() {
    if (!form.nome.trim()) return showToast('Erro: informe o nome da filial.')
    setSaving(true)
    const payload = { nome: form.nome.trim(), os_numero_inicial: parseInt(form.os_numero_inicial) || 1 }
    let error
    if (modal === 'add') {
      ;({ error } = await supabase.from('filiais').insert(payload))
    } else {
      ;({ error } = await supabase.from('filiais').update(payload).eq('id', modal.data.id))
    }
    setSaving(false)
    if (error) {
      showToast('Erro ao salvar: ' + error.message)
    } else {
      showToast(modal === 'add' ? 'Filial criada!' : 'Filial atualizada!')
      setModal(null)
      await loadFiliais()
    }
  }

  async function excluir(f) {
    if (!window.confirm(`Excluir filial "${f.nome}"? Dados vinculados perderão a referência.`)) return
    const { error } = await supabase.from('filiais').delete().eq('id', f.id)
    if (error) {
      showToast('Erro ao excluir: ' + error.message)
    } else {
      showToast('Filial excluída.')
      await loadFiliais()
    }
  }

  if (loading) return <p style={{ color: C.onSurfaceVariant, fontFamily: F.body }}>Carregando filiais...</p>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: C.onSurfaceVariant, fontSize: '0.875rem', fontFamily: F.body }}>
          {filiais.length} {filiais.length === 1 ? 'filial cadastrada' : 'filiais cadastradas'}
        </p>
        <button onClick={openAdd} style={btnPrimary}>+ Nova Filial</button>
      </div>

      <div style={{
        background: C.surfaceContainerLowest, borderRadius: '0.5rem',
        border: `1px solid ${C.borderSubtle}`, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tableHeader, borderBottom: `1px solid ${C.borderSubtle}` }}>
              {['Nome', 'N.º O.S. Inicial', 'Ações'].map(col => (
                <th key={col} style={{
                  textAlign: 'left', padding: '0.875rem 1rem',
                  fontSize: '0.7rem', fontWeight: '600', color: C.onSurfaceVariant,
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: F.body,
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filiais.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '2.5rem', textAlign: 'center', color: C.outlineVariant, fontSize: '0.9rem', fontFamily: F.body }}>
                  Nenhuma filial cadastrada. Clique em "+ Nova Filial" para começar.
                </td>
              </tr>
            )}
            {filiais.map((f, i) => (
              <tr key={f.id}
                style={{ borderBottom: i < filiais.length - 1 ? `1px solid ${C.borderSubtle}` : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceContainerLow}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '0.875rem 1rem', fontWeight: '600', color: C.onSurface, fontFamily: F.body }}>{f.nome}</td>
                <td style={{ padding: '0.875rem 1rem', color: C.onSurfaceVariant, fontFamily: F.mono }}>{f.os_numero_inicial}</td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => openEdit(f)}
                      style={{ padding: '0.3rem 0.75rem', background: 'none', border: `1.5px solid ${C.borderSubtle}`, borderRadius: '0.5rem', color: C.onSurfaceVariant, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
                      Editar
                    </button>
                    <button onClick={() => excluir(f)}
                      style={{ padding: '0.3rem 0.75rem', background: 'none', border: `1.5px solid ${C.outlineVariant}`, borderRadius: '0.5rem', color: C.statusDanger, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', background: C.statusInfoBg, border: `1px solid ${C.secondaryContainer}`, borderRadius: '0.75rem', padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: C.statusInfo, lineHeight: '1.5', fontFamily: F.body }}>
        ℹ️ O <strong>N.º O.S. Inicial</strong> define a partir de qual número as ordens de serviço de <strong>Óculos de Grau</strong> são geradas para cada filial.
        Vendas do tipo <strong>Solar</strong> não recebem número de O.S.
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Nova Filial' : 'Editar Filial'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <Label>Nome da Filial *</Label>
              <input type="text" style={inputCss} autoFocus
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Filial Centro" />
            </div>
            <div>
              <Label>N.º O.S. Inicial</Label>
              <input type="number" min="1" style={{ ...inputCss, width: '130px' }}
                value={form.os_numero_inicial}
                onChange={e => setForm(p => ({ ...p, os_numero_inicial: e.target.value }))} />
              <p style={{ margin: '0.3rem 0 0', color: C.onSurfaceVariant, fontSize: '0.75rem', fontFamily: F.body }}>
                O próximo número será sempre o maior já registrado nesta filial + 1 (ou este valor se não houver nenhum).
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setModal(null)} style={{ ...btnSecondary, flex: 1 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ── Aba: Vendedores ── */
const PAPEL_LABEL = { admin: 'Administrador', vendedor: 'Vendedor' }
const FORM_INITIAL = { nome: '', email: '', senha: '', papel: 'vendedor', comissao_percentual: '0', filial_id: '' }

function TabVendedores({ showToast }) {
  const [vendedores, setVendedores] = useState([])
  const [filiais, setFiliais] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false)

  const loadVendedores = useCallback(async () => {
    const [{ data: perfis }, { data: fils }] = await Promise.all([
      supabase.from('profiles').select('*').order('nome'),
      supabase.from('filiais').select('*').order('nome'),
    ])
    setVendedores(perfis || [])
    setFiliais(fils || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadVendedores() }, [loadVendedores])

  function openAdd() { setForm(FORM_INITIAL); setModalError(''); setModal('add') }
  function openEdit(v) {
    setForm({ id: v.id, nome: v.nome, email: v.email || '', senha: '', papel: v.papel, comissao_percentual: String(v.comissao_percentual ?? 0), filial_id: v.filial_id || '' })
    setModalError('')
    setModal({ type: 'edit', data: v })
  }
  function fecharModal() { setModal(null); setModalError('') }
  function setField(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function handleAdd() {
    if (!form.nome.trim() || !form.email.trim() || !form.senha) {
      setModalError('Preencha nome, e-mail e senha.'); return
    }
    if (form.senha.length < 6) { setModalError('A senha deve ter pelo menos 6 caracteres.'); return }
    setSaving(true); setModalError('')
    // Cria o usuário num cliente isolado, para não substituir a sessão do admin.
    const signupClient = createSignupClient()
    const { data, error } = await signupClient.auth.signUp({
      email: form.email.trim(), password: form.senha,
      options: { data: { nome: form.nome.trim() } },
    })
    if (error) { setModalError('Erro ao criar usuário: ' + error.message); setSaving(false); return }
    if (data.user) {
      // O papel/comissão/filial são definidos pelo admin (cliente principal),
      // pois só o admin tem permissão para gravar esses campos.
      const { error: upErr } = await supabase.from('profiles').update({
        nome: form.nome.trim(), papel: form.papel,
        comissao_percentual: parseFloat(form.comissao_percentual) || 0,
        filial_id: form.filial_id || null,
      }).eq('id', data.user.id)
      if (upErr) { setModalError('Usuário criado, mas houve erro ao definir o perfil: ' + upErr.message); setSaving(false); await loadVendedores(); return }
    }
    setSaving(false); fecharModal(); await loadVendedores()
    showToast('Vendedor criado com sucesso!')
  }

  async function handleEdit() {
    if (!form.nome.trim()) { setModalError('O nome não pode estar vazio.'); return }
    setSaving(true); setModalError('')
    const { error } = await supabase.from('profiles').update({
      nome: form.nome.trim(), papel: form.papel,
      comissao_percentual: parseFloat(form.comissao_percentual) || 0,
      filial_id: form.filial_id || null,
    }).eq('id', form.id)
    if (error) { setModalError('Erro ao atualizar: ' + error.message); setSaving(false); return }
    setSaving(false); fecharModal(); await loadVendedores()
    showToast('Vendedor atualizado com sucesso!')
  }

  async function toggleAtivo(v) {
    await supabase.from('profiles').update({ ativo: !v.ativo }).eq('id', v.id)
    await loadVendedores()
    showToast(v.ativo ? 'Vendedor desativado.' : 'Vendedor ativado!')
  }

  async function excluir(v) {
    if (!window.confirm(
      `Excluir o cadastro de "${v.nome}"?\n\n` +
      `Ele deixará de aparecer na lista e não poderá mais acessar o sistema.\n` +
      `As vendas e captações que ele lançou CONTINUAM visíveis para você.\n\n` +
      `Você pode restaurar o cadastro depois, se precisar.`
    )) return
    const { error } = await supabase.from('profiles')
      .update({ excluido: true, ativo: false }).eq('id', v.id)
    if (error) { showToast('Erro ao excluir: ' + error.message, 'err'); return }
    await loadVendedores()
    showToast('Cadastro excluído. O histórico foi preservado.')
  }

  async function restaurar(v) {
    const { error } = await supabase.from('profiles')
      .update({ excluido: false, ativo: true }).eq('id', v.id)
    if (error) { showToast('Erro ao restaurar: ' + error.message, 'err'); return }
    await loadVendedores()
    showToast('Cadastro restaurado!')
  }

  const filialMap = Object.fromEntries(filiais.map(f => [f.id, f.nome]))
  const qtdExcluidos = vendedores.filter(v => v.excluido).length
  const vendedoresVisiveis = mostrarExcluidos ? vendedores : vendedores.filter(v => !v.excluido)

  if (loading) return <p style={{ color: C.onSurfaceVariant, fontFamily: F.body }}>Carregando vendedores...</p>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <p style={{ margin: 0, color: C.onSurfaceVariant, fontSize: '0.875rem', fontFamily: F.body }}>
            {vendedoresVisiveis.length} {vendedoresVisiveis.length === 1 ? 'pessoa' : 'pessoas'}
          </p>
          {qtdExcluidos > 0 && (
            <button onClick={() => setMostrarExcluidos(v => !v)}
              style={{ padding: '0.3rem 0.7rem', background: 'none', border: `1.5px solid ${C.borderSubtle}`, borderRadius: '0.5rem', color: C.onSurfaceVariant, fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
              {mostrarExcluidos ? 'Ocultar excluídos' : `Ver excluídos (${qtdExcluidos})`}
            </button>
          )}
        </div>
        <button onClick={openAdd} style={btnPrimary}>+ Adicionar Vendedor</button>
      </div>

      <div style={{
        background: C.surfaceContainerLowest, borderRadius: '0.5rem',
        border: `1px solid ${C.borderSubtle}`, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.tableHeader, borderBottom: `1px solid ${C.borderSubtle}` }}>
                {['Nome', 'E-mail', 'Papel', 'Filial', 'Comissão', 'Status', 'Ações'].map(col => (
                  <th key={col} style={{
                    textAlign: 'left', padding: '0.875rem 1rem',
                    fontSize: '0.7rem', fontWeight: '600', color: C.onSurfaceVariant,
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontFamily: F.body,
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendedoresVisiveis.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: C.outlineVariant, fontSize: '0.9rem', fontFamily: F.body }}>
                    Nenhum vendedor cadastrado ainda.
                  </td>
                </tr>
              )}
              {vendedoresVisiveis.map((v, i) => (
                <tr key={v.id}
                  style={{ borderBottom: i < vendedoresVisiveis.length - 1 ? `1px solid ${C.borderSubtle}` : 'none', transition: 'background 0.1s', opacity: v.excluido ? 0.6 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceContainerLow}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.875rem 1rem', fontWeight: '600', color: C.onSurface, fontSize: '0.875rem', fontFamily: F.body }}>
                    {v.nome}
                    {v.excluido && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: '700', color: C.statusDanger, fontFamily: F.body }}>EXCLUÍDO</span>}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: C.onSurfaceVariant, fontSize: '0.875rem', fontFamily: F.body }}>{v.email || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '999px',
                      fontSize: '0.75rem', fontWeight: '600', fontFamily: F.body,
                      background: v.papel === 'admin' ? '#faf5ff' : C.statusInfoBg,
                      color: v.papel === 'admin' ? '#7c3aed' : C.statusInfo,
                    }}>
                      {PAPEL_LABEL[v.papel] || v.papel}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: C.onSurfaceVariant, fontSize: '0.875rem', fontFamily: F.body }}>
                    {filialMap[v.filial_id] || '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: C.onSurfaceVariant, fontSize: '0.875rem', fontFamily: F.mono }}>
                    {v.comissao_percentual ?? 0}%
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '999px',
                      fontSize: '0.75rem', fontWeight: '600', fontFamily: F.body,
                      background: v.ativo ? C.statusSuccessBg : C.surfaceContainerLow,
                      color: v.ativo ? C.statusSuccess : C.onSurfaceVariant,
                    }}>
                      {v.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {v.excluido ? (
                        <button onClick={() => restaurar(v)}
                          style={{ padding: '0.3rem 0.75rem', background: 'none', border: `1.5px solid ${C.statusSuccessBg}`, borderRadius: '0.5rem', color: C.statusSuccess, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
                          Restaurar
                        </button>
                      ) : (
                        <>
                          <button onClick={() => openEdit(v)}
                            style={{ padding: '0.3rem 0.75rem', background: 'none', border: `1.5px solid ${C.borderSubtle}`, borderRadius: '0.5rem', color: C.onSurfaceVariant, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
                            Editar
                          </button>
                          <button onClick={() => toggleAtivo(v)}
                            style={{ padding: '0.3rem 0.75rem', background: 'none', border: `1.5px solid ${v.ativo ? C.outlineVariant : C.statusSuccessBg}`, borderRadius: '0.5rem', color: v.ativo ? C.statusDanger : C.statusSuccess, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
                            {v.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                          <button onClick={() => excluir(v)}
                            style={{ padding: '0.3rem 0.75rem', background: 'none', border: `1.5px solid ${C.outlineVariant}`, borderRadius: '0.5rem', color: C.statusDanger, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', fontFamily: F.body }}>
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '1rem', background: C.statusWarningBg, border: `1px solid ${C.outlineVariant}`, borderRadius: '0.75rem', padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: C.statusWarning, lineHeight: '1.5', fontFamily: F.body }}>
        ⚠️ <strong>Atenção:</strong> Ao adicionar um novo vendedor, ele receberá um e-mail de confirmação para ativar a conta.
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Adicionar Vendedor' : 'Editar Vendedor'}
          onClose={fecharModal}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <Label>Nome completo *</Label>
              <input type="text" value={form.nome} onChange={e => setField('nome', e.target.value)}
                style={inputCss} placeholder="João da Silva" autoFocus />
            </div>
            {modal === 'add' && (
              <>
                <div>
                  <Label>E-mail *</Label>
                  <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
                    style={inputCss} placeholder="joao@exemplo.com" />
                </div>
                <div>
                  <Label>Senha inicial *</Label>
                  <input type="password" value={form.senha} onChange={e => setField('senha', e.target.value)}
                    style={inputCss} placeholder="Mínimo 6 caracteres" />
                  <p style={{ margin: '0.3rem 0 0', color: C.onSurfaceVariant, fontSize: '0.75rem', fontFamily: F.body }}>
                    O vendedor poderá trocar a senha depois de confirmar o e-mail.
                  </p>
                </div>
              </>
            )}
            <div>
              <Label>Papel</Label>
              <select value={form.papel} onChange={e => setField('papel', e.target.value)} style={inputCss}>
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <Label>Filial</Label>
              <select value={form.filial_id} onChange={e => setField('filial_id', e.target.value)} style={inputCss}>
                <option value="">Sem filial</option>
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <Label>Comissão (%)</Label>
              <input type="number" value={form.comissao_percentual}
                onChange={e => setField('comissao_percentual', e.target.value)}
                style={{ ...inputCss, width: '130px' }} min="0" max="100" step="0.5" />
            </div>
            {modalError && (
              <div style={{ background: C.statusDangerBg, border: `1px solid ${C.outlineVariant}`, borderRadius: '0.5rem', padding: '0.625rem 0.875rem', color: C.statusDanger, fontSize: '0.82rem', fontFamily: F.body }}>
                {modalError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={fecharModal} style={{ ...btnSecondary, flex: 1 }}>Cancelar</button>
              <button onClick={modal === 'add' ? handleAdd : handleEdit} disabled={saving}
                style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ── Página principal ── */
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
          background: C.statusDangerBg, border: `1px solid ${C.outlineVariant}`,
          borderRadius: '1rem', padding: '2rem', textAlign: 'center', color: C.statusDanger,
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontFamily: F.headline }}>Acesso Restrito</h2>
          <p style={{ margin: 0, color: C.statusDanger, fontSize: '0.875rem', fontFamily: F.body }}>
            Apenas administradores podem acessar as Configurações.
          </p>
        </div>
      </div>
    )
  }

  const tabStyle = (active) => ({
    padding: '0.75rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '0.9rem', fontFamily: F.body,
    fontWeight: active ? '700' : '500',
    color: active ? C.primaryContainer : C.onSurfaceVariant,
    borderBottom: active ? `2.5px solid ${C.primaryContainer}` : '2.5px solid transparent',
    transition: 'all 0.15s',
  })

  return (
    <div className="pg">
      <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: C.onSurface, margin: '0 0 1.5rem', letterSpacing: '-0.3px', fontFamily: F.headline }}>
        Configurações
      </h1>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${C.borderSubtle}`, marginBottom: '1.75rem', display: 'flex' }}>
        <button onClick={() => setActiveTab('sistema')} style={tabStyle(activeTab === 'sistema')}>
          ⚙️ Sistema
        </button>
        <button onClick={() => setActiveTab('filiais')} style={tabStyle(activeTab === 'filiais')}>
          🏪 Filiais
        </button>
        <button onClick={() => setActiveTab('vendedores')} style={tabStyle(activeTab === 'vendedores')}>
          👥 Vendedores
        </button>
      </div>

      {activeTab === 'sistema'    && <TabSistema    showToast={showToast} />}
      {activeTab === 'filiais'    && <TabFiliais    showToast={showToast} />}
      {activeTab === 'vendedores' && <TabVendedores showToast={showToast} />}

      <Toast msg={toast} />
    </div>
  )
}
