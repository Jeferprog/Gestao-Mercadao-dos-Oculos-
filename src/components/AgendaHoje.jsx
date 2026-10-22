import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { logErro } from '../lib/erros'
import { C, F, card } from '../lib/ds'
import { TIPOS_AGENDA, hojeISO, fmtData } from '../lib/agenda'
import ProgramacaoSemana from './ProgramacaoSemana'

// Ações e promoções de hoje no início do Dashboard + acesso à grade da semana.
export default function AgendaHoje() {
  const [itens, setItens] = useState([])
  const [semanaAberta, setSemanaAberta] = useState(false)

  useEffect(() => {
    const hoje = hojeISO()
    supabase.from('agenda').select('id, tipo, data_inicio, data_fim, texto')
      .lte('data_inicio', hoje).gte('data_fim', hoje)
      .order('data_fim')
      .then(({ data, error }) => {
        if (error) logErro('Dashboard: agenda', error)
        setItens(data || [])
      })
  }, [])

  const hoje = hojeISO()

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {semanaAberta && <ProgramacaoSemana onFechar={() => setSemanaAberta(false)} />}
      <button type="button" onClick={() => setSemanaAberta(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer',
          padding: '0.55rem 1rem', marginBottom: itens.length ? '0.75rem' : 0, borderRadius: '0.5rem',
          border: `1.5px solid ${TIPOS_AGENDA.acao.cor}`, background: TIPOS_AGENDA.acao.fundo, color: TIPOS_AGENDA.acao.cor,
          fontFamily: F.body, fontSize: '0.86rem', fontWeight: '700',
        }}>
        <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>calendar_view_week</span>
        Programação da semana
      </button>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
      {Object.entries(TIPOS_AGENDA).map(([tipo, meta]) => {
        const lista = itens.filter(i => i.tipo === tipo)
        if (lista.length === 0) return null
        return (
          <div key={tipo} style={{ ...card, borderLeft: `4px solid ${meta.cor}`, background: meta.fundo }}>
            <button type="button" onClick={() => setSemanaAberta(true)} title="Ver a programação da semana"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: '0.7rem', color: meta.cor }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{meta.icone}</span>
              <span style={{ fontWeight: '800', fontFamily: F.headline, fontSize: '0.95rem' }}>
                {tipo === 'acao' ? 'Ações de hoje' : 'Promoções em vigor'}
              </span>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {lista.map(i => (
                <div key={i.id} style={{ background: C.surfaceContainerLowest, borderRadius: '0.4rem', padding: '0.6rem 0.75rem' }}>
                  <div style={{ fontFamily: F.body, fontSize: '0.9rem', fontWeight: '600', color: C.onSurface, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                    {i.texto}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: '0.74rem', color: C.onSurfaceVariant, marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
                    {i.data_inicio === i.data_fim ? 'Somente hoje'
                      : i.data_fim === hoje ? 'Último dia hoje'
                      : `Até ${fmtData(i.data_fim)}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
    </div>
  )
}
