import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { clientEnv } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetch-json'
import type { GetNoticiaResponse, NoticiaRecord } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutpublic/noticia/$id')({
  component: NoticiaPublicPage,
})

function NoticiaPublicPage() {
  const { id } = Route.useParams()
  const [noticia, setNoticia] = useState<NoticiaRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchJson<GetNoticiaResponse>(`/v1/noticias/${id}`, {
          baseUrl: clientEnv.apiBaseUrl,
        })
        setNoticia(res.noticia)
      } catch {
        setError('Não foi possível carregar a notícia.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !noticia) {
    return (
      <div className="container mx-auto px-4 py-20 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Oops!</h1>
        <p className="text-gray-600 mb-8">{error || 'Notícia não encontrada'}</p>
        <Link to="/" className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/90">
          Voltar à Home
        </Link>
      </div>
    )
  }

  return (
    <article className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
      <Link to="/" className="inline-flex items-center text-primary hover:underline mb-8">
        &larr; Voltar
      </Link>

      <header className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
            {noticia.tag}
          </span>
          <span className="text-gray-500 text-sm">
            {new Date(noticia.data).toLocaleDateString('pt-PT')}
          </span>
          <span className="text-gray-500 text-sm flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            {noticia.tempo_leitura_min} min de leitura
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
          {noticia.titulo}
        </h1>
        <p className="text-xl text-gray-600 leading-relaxed">
          {noticia.resumo}
        </p>
      </header>

      {noticia.imagem_url && (
        <div className="w-full aspect-video rounded-2xl overflow-hidden mb-12 shadow-lg">
          <img
            src={noticia.imagem_url}
            alt={noticia.titulo}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div 
        className="prose prose-lg max-w-none prose-primary text-gray-700 leading-loose"
        dangerouslySetInnerHTML={{ __html: noticia.conteudo }}
      />
    </article>
  )
}
