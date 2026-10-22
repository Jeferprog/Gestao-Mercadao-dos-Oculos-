import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logErro } from '../lib/erros'
import { C, F, card, inputCss, btnPrimary, btnGhost, btnSecondary, pill } from '../lib/ds'
import { TIPOS_AGENDA, hojeISO, textoPeriodo, situacaoAgenda } from '../lib/agenda'
import ProgramacaoSemana from '../components/ProgramacaoSemana'

const SITUACAO = {
  andamento:  { rotulo: 'Em andamento', tipo: 'success' },
  programada: { rotulo: 'Programada',   tipo: 'info' },
  encerrada:  { rotulo: 'Encerrada',    tipo: 'default' },
}
const ORDEM_SIT = { andamento: 0, programada: 1, encerrada: 2 }

const rotuloCss = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: C.onSurfaceVariant, fontFamily: F.body, marginBottom: '0.3rem' }

export default function Agenda() {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semanaAberta, setSemanaAberta] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('agenda').select('*').order('data_inicio', { ascending: false }).limit(1000)
    if (error) { logErro('Carregar agenda', error); setErro(error.message) } else setErro('')
    setItens(data || [])
    setCarregando(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="pg">
      {semanaAberta && <ProgramacaoSemana onFechar={() => setSemanaAberta(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.25rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: F.headline, color: C.onSurface, margin: 0, letterSpacing: '-0.3px' }}>
          Agenda
        </h1>
        <button type="button" onClick={() => setSemanaAberta(true)} style={btnSecondary}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_view_week</span>
          Programação da semana
        </button>
      </div>
      <p style={{ color: C.onSurfaceVariant, fontFamily: F.body, margin: '0 0 1.25rem', fontSize: '0.85rem' }}>
        Cadastre as ações e promoções da loja. No período informado, elas aparecem em destaque no início do Dashboard.
      </p>

      {erro && (
        <div style={{ background: C.statusDangerBg, color: C.statusDanger, borderRadius: '0.5rem', padding: '0.75rem 1rem', fontFamily: F.body, fontSize: '0.85rem', marginBottom: '1rem' }}>
          Não foi possível carregar a agenda: {erro}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1rem', alignItems: 'start' }}>
        {Object.keys(TIPOS_AGENDA).map(tipo => (
          <BlocoAgenda key={tipo} tipo={tipo} carregando={carregando}
            itens={itens.filter(i => i.tipo === tipo)} recarregar={carregar} />
        ))}
      </div>
    </div>
  )
}

function BlocoAgenda({ tipo, itens, carregando, recarregar }) {
  const { profile, isAdmin } = useAuth()
  const meta = TIPOS_AGENDA[tipo]
  const vazio = { id: null, data_inicio: hojeISO(), data_fim: hojeISO(), texto: '' }
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)  // { tipo: 'ok' | 'erro', texto }
  const [verEncerradas, setVerEncerradas] = useState(false)

  const hoje = hojeISO()
  const ordenados = [...itens].sort((a, b) => {
    const sa = situacaoAgenda(a, hoje), sb = situacaoAgenda(b, hoje)
    if (sa !== sb) return ORDEM_SIT[sa] - ORDEM_SIT[sb]
    return sa === 'encerrada' ? b.data_fim.localeCompare(a.data_fim) : a.data_inicio.localeCompare(b.data_inicio)
  })
  const encerradas = ordenados.filter(i => situacaoAgenda(i, hoje) === 'encerrada')
  const ativos = ordenados.filter(i => situacaoAgenda(i, hoje) !== 'encerrada')
  const visiveis = verEncerradas ? ordenados : ativos

  function alterarInicio(v) {
    setForm(f => ({ ...f, data_inicio: v, data_fim: !f.data_fim || f.data_fim < v ? v : f.data_fim }))
  }

  async function salvar(e) {
    e.preventDefault()
    const texto = form.texto.trim()
    if (!texto) return setMsg({ tipo: 'erro', texto: `Escreva qual é a ${meta.singular}.` })
    if (!form.data_inicio || !form.data_fim) return setMsg({ tipo: 'erro', texto: 'Informe as datas de início e fim.' })
    if (form.data_fim < form.data_inicio) return setMsg({ tipo: 'erro', texto: 'A data final não pode ser antes da data inicial.' })

    setSalvando(true)
    setMsg(null)
    const dados = { data_inicio: form.data_inicio, data_fim: form.data_fim, texto: texto.slice(0, 2000) }
    const { error } = form.id
      ? await supabase.from('agenda').update({ ...dados, updated_at: new Date().toISOString() }).eq('id', form.id)
      : await supabase.from('agenda').insert({ ...dados, tipo, autor_nome: profile?.nome || null })
    setSalvando(false)
    if (error) {
      logErro('Salvar agenda', error)
      return setMsg({ tipo: 'erro', texto: 'Não foi possível salvar: ' + error.message })
    }
    setMsg({ tipo: 'ok', texto: form.id ? 'Alterações salvas.' : `${meta.singular[0].toUpperCase() + meta.singular.slice(1)} salva.` })
    setForm(vazio)
    recarregar()
  }

  async function excluir(item) {
    if (!window.confirm(`Excluir esta ${meta.singular}?\n\n"${item.texto}"`)) return
    const { error } = await supabase.from('agenda').delete().eq('id', item.id)
    if (error) {
      logErro('Excluir agenda', error)
      return setMsg({ tipo: 'erro', texto: 'Não foi possível excluir: ' + error.message })
    }
    if (form.id === item.id) setForm(vazio)
    setMsg({ tipo: 'ok', texto: 'Excluída.' })
    recarregar()
  }

  function editar(item) {
    setForm({ id: item.id, data_inicio: item.data_inicio, data_fim: item.data_fim, texto: item.texto })
    setMsg(null)
  }

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ width: '34px', height: '34px', borderRadius: '0.5rem', background: meta.fundo, color: meta.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{meta.icone}</span>
        </span>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', fontFamily: F.headline, color: C.onSurface }}>{meta.titulo}</h2>
      </div>

      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: form.id ? C.statusWarningBg : C.surfaceContainerLow, borderRadius: '0.5rem', padding: '0.9rem' }}>
        {form.id && (
          <div style={{ fontFamily: F.body, fontSize: '0.8rem', fontWeight: '700', color: C.statusWarning }}>
            Editando {meta.singular}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label>
            <span style={rotuloCss}>De</span>
            <input type="date" value={form.data_inicio} onChange={e => alterarInicio(e.target.value)} style={inputCss} required />
          </label>
          <label>
            <span style={rotuloCss}>Até</span>
            <input type="date" value={form.data_fim} min={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} style={inputCss} required />
          </label>
        </div>
        <label>
          <span style={rotuloCss}>Qual é a {meta.singular}?</span>
          <textarea value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
            rows={3} maxLength={2000}
            placeholder={tipo === 'acao' ? 'Ex.: Panfletagem no centro, das 9h às 12h' : 'Ex.: Armação + lentes com 20% de desconto'}
            style={{ ...inputCss, resize: 'vertical', minHeight: '76px' }} />
        </label>
        {msg && (
          <div style={{ fontFamily: F.body, fontSize: '0.8rem', fontWeight: '600', color: msg.tipo === 'ok' ? C.statusSuccess : C.error }}>
            {msg.texto}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="submit" disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{form.id ? 'save' : 'add'}</span>
            {salvando ? 'Salvando...' : form.id ? 'Salvar alterações' : `Salvar ${meta.singular}`}
          </button>
          {form.id && (
            <button type="button" onClick={() => { setForm(vazio); setMsg(null) }} style={btnGhost}>Cancelar</button>
          )}
        </div>
      </form>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontFamily: F.body, fontSize: '0.78rem', fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Cadastradas
          </span>
          {encerradas.length > 0 && (
            <button type="button" onClick={() => setVerEncerradas(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.secondary, fontFamily: F.body, fontSize: '0.78rem', fontWeight: '600', padding: 0 }}>
              {verEncerradas ? 'Ocultar encerradas' : `Mostrar encerradas (${encerradas.length})`}
            </button>
          )}
        </div>

        {carregando ? (
          <p style={{ fontFamily: F.body, fontSize: '0.85rem', color: C.onSurfaceVariant, margin: 0 }}>Carregando…</p>
        ) : visiveis.length === 0 ? (
          <p style={{ fontFamily: F.body, fontSize: '0.85rem', color: C.onSurfaceVariant, margin: 0 }}>
            Nenhuma {meta.singular} em andamento ou programada.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {visiveis.map(item => {
              const sit = SITUACAO[situacaoAgenda(item, hoje)]
              return (
                <div key={item.id} style={{
                  border: `1px solid ${form.id === item.id ? C.statusWarning : C.borderSubtle}`, borderRadius: '0.5rem',
                  padding: '0.7rem 0.8rem', opacity: sit.tipo === 'default' ? 0.7 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <span style={pill(sit.tipo)}>{sit.rotulo}</span>
                    <span style={{ fontFamily: F.body, fontSize: '0.8rem', fontWeight: '600', color: C.onSurface, fontVariantNumeric: 'tabular-nums' }}>
                      {textoPeriodo(item)}
                    </span>
                    {isAdmin && (
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                        <button type="button" onClick={() => editar(item)} title="Editar" aria-label="Editar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.secondary, padding: '0.15rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                        </button>
                        <button type="button" onClick={() => excluir(item)} title="Excluir" aria-label="Excluir"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.statusDanger, padding: '0.15rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                        </button>
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: '0.875rem', color: C.onSurface, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                    {item.texto}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: '0.72rem', color: C.onSurfaceVariant, marginTop: '0.35rem' }}>
                    Cadastrada por {item.autor_nome || '—'} em {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
