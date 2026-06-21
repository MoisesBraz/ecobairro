import { useEffect, useId, useRef, useState } from 'react'
import { MapPin, Loader2, AlertCircle } from 'lucide-react'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken } from '@/lib/auth'
import type { GeocodeResult, GeocodeSearchResponse } from '@ecobairro/contracts'

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (result: GeocodeResult) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  id?: string
  ariaInvalid?: boolean
}

/**
 * Campo de pesquisa de morada/rua em Portugal. Usa o
 * endpoint /v1/geocoding/search (Nominatim/OSM) e apresenta as ruas
 * correspondentes; se nenhuma existir mostra uma mensagem de erro.
 * Reutilizável em ecopontos, partilhas e recolhas.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Pesquisar por rua ou código postal...',
  className = '',
  inputClassName,
  id,
  ariaInvalid,
}: AddressAutocompleteProps) {
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [semResultados, setSemResultados] = useState(false)
  const listboxId = useId()
  // Evita reabrir a lista logo após uma seleção.
  const acabouDeSelecionar = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (acabouDeSelecionar.current) {
      acabouDeSelecionar.current = false
      return
    }
    const termo = value.trim()
    if (termo.length < 3) {
      setResults([])
      setSemResultados(false)
      setErro(null)
      return
    }
    const t = setTimeout(() => {
      setLoading(true)
      setErro(null)
      fetchJson<GeocodeSearchResponse>('/v1/geocoding/search', {
        baseUrl: clientEnv.apiBaseUrl,
        params: { q: termo },
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
        .then((resp) => {
          setResults(resp.results)
          setSemResultados(resp.results.length === 0)
          setAberto(true)
        })
        .catch((err) => {
          setResults([])
          setSemResultados(false)
          setErro(getApiErrorMessage(err, 'Não foi possível pesquisar a morada.'))
        })
        .finally(() => setLoading(false))
    }, 350)
    return () => clearTimeout(t)
  }, [value])

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  function escolher(r: GeocodeResult) {
    acabouDeSelecionar.current = true
    onChange(r.rua ?? r.label)
    onSelect(r)
    setResults([])
    setSemResultados(false)
    setAberto(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={ariaInvalid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setAberto(true) }}
          onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false) }}
          placeholder={placeholder}
          className={
            inputClassName ??
            `w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${ariaInvalid ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-[var(--primary)]/30'}`
          }
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {aberto && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg"
        >
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => escolher(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{r.rua ?? r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.codigo_postal ? `${r.codigo_postal} · ` : ''}{r.label}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && semResultados && value.trim().length >= 3 && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" /> Nenhuma rua encontrada com esse termo.
        </p>
      )}
      {erro && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {erro}
        </p>
      )}
    </div>
  )
}
