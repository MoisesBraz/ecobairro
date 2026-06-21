import { createFileRoute } from '@tanstack/react-router'
import { PublicNavbar, PublicFooter } from './_layoutpublic.home'

export const Route = createFileRoute('/_layoutpublic/acessibilidade')({
  component: AcessibilidadePage,
})

function AcessibilidadePage() {
  return (
    <div className="min-h-svh flex flex-col bg-background pt-24">
      <PublicNavbar alwaysSolid={true} />
      <main className="flex-1 max-w-[800px] mx-auto px-6 py-12 w-full space-y-8 text-foreground">
        <h1 className="text-4xl font-black mb-8">Declaração de Acessibilidade</h1>
        
        <section className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            O ecoBairro tem o compromisso de garantir que a sua plataforma digital é acessível a todos os cidadãos, independentemente das suas capacidades ou necessidades especiais, promovendo uma participação cívica verdadeiramente inclusiva.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">1. Conformidade e Legislação</h2>
          <p className="text-muted-foreground leading-relaxed">
            Trabalhamos continuamente para que a nossa plataforma esteja em conformidade com as diretrizes de acessibilidade para conteúdos web (WCAG) 2.1, nível AA, desenvolvidas pelo W3C (World Wide Web Consortium).
            A nossa atuação guia-se pelo cumprimento das disposições do <strong>Decreto-Lei n.º 83/2018</strong>, de 19 de outubro, que define os requisitos de acessibilidade dos sítios web e das aplicações móveis do setor público em Portugal.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">2. Funcionalidades de Acessibilidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma ecoBairro integra as seguintes boas práticas de acessibilidade:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong>Contraste Adequado:</strong> Disponibilização de um modo escuro (*Dark Mode*) e cores de destaque testadas para garantir o rácio de contraste ideal para leitura.</li>
            <li><strong>Compatibilidade com Leitores de Ecrã:</strong> Uso de *labels*, tags ARIA e estrutura HTML semântica para facilitar a leitura por software de assistência (como o NVDA ou o VoiceOver).</li>
            <li><strong>Navegação por Teclado:</strong> Todas as secções críticas da plataforma, incluindo submissão de reportes e navegação de menus, são utilizáveis utilizando exclusivamente o teclado.</li>
            <li><strong>Evitar intermitências:</strong> Redução de animações disruptivas para utilizadores com sensibilidade visual.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">3. Esforço Contínuo</h2>
          <p className="text-muted-foreground leading-relaxed">
            Acessibilidade é um processo contínuo. Apesar dos nossos esforços para tornar todas as páginas e conteúdos totalmente acessíveis, alguns recursos ou conteúdos gerados por outros utilizadores (ex: descrições no mercado de partilhas) podem nem sempre estar perfeitamente otimizados.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">4. Feedback e Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            A sua experiência e a sua opinião são muito importantes para nós. Se encontrar dificuldades de acesso a qualquer conteúdo ou funcionalidade da plataforma ecoBairro, agradecemos que entre em contacto connosco para que possamos corrigir o problema rapidamente.
            <br/><br/>
            Contacte-nos através do e-mail:{' '}
            <a href="mailto:acessibilidade@ecobairro.pt" className="text-[var(--primary)] hover:underline">acessibilidade@ecobairro.pt</a>.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
