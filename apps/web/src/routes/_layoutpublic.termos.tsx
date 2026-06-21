import { createFileRoute } from '@tanstack/react-router'
import { PublicNavbar, PublicFooter } from './_layoutpublic.home'

export const Route = createFileRoute('/_layoutpublic/termos')({
  component: TermosPage,
})

function TermosPage() {
  return (
    <div className="min-h-svh flex flex-col bg-background pt-24">
      <PublicNavbar alwaysSolid={true} />
      <main className="flex-1 max-w-[800px] mx-auto px-6 py-12 w-full space-y-8 text-foreground">
        <h1 className="text-4xl font-black mb-8">Termos de Uso</h1>
        
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">1. Objeto e Aceitação</h2>
          <p className="text-muted-foreground leading-relaxed">
            Os presentes Termos de Uso regulam o acesso e a utilização da plataforma ecoBairro. Ao aceder, registar-se ou utilizar a plataforma, o utilizador concorda expressamente e sem reservas com as regras aqui estipuladas. Caso não concorde com alguma destas condições, não deverá utilizar a plataforma.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">2. Registo e Conta de Utilizador</h2>
          <p className="text-muted-foreground leading-relaxed">
            O registo é obrigatório para aceder à maioria das funcionalidades (Reportes, Partilhas, Gamificação). O utilizador compromete-se a fornecer informações verdadeiras e atualizadas. A conta é pessoal e intransmissível, sendo o utilizador o único responsável pela confidencialidade das suas credenciais.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">3. Deveres e Regras de Conduta</h2>
          <p className="text-muted-foreground leading-relaxed">
            Ao utilizar o ecoBairro, o utilizador obriga-se a:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Submeter reportes verídicos e precisos sobre o espaço público.</li>
            <li><strong>Não incluir fotografias que contenham pessoas identificáveis, matrículas de veículos ou informações privadas de terceiros,</strong> respeitando o direito à imagem e à privacidade.</li>
            <li>Adotar um comportamento cívico e respeitoso na área de "Partilhas na sua zona".</li>
            <li>Não utilizar a plataforma para a promoção de atividades comerciais ilegais, ofensivas ou discriminatórias.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">4. Isenção de Responsabilidade (Partilhas)</h2>
          <p className="text-muted-foreground leading-relaxed">
            A secção "Partilhas na sua zona" funciona como um espaço de conexão comunitária. O ecoBairro não atua como intermediário nas trocas ou doações, nem garante a qualidade, segurança ou legalidade dos artigos anunciados. Qualquer transação ou interação é da exclusiva responsabilidade dos utilizadores envolvidos.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">5. Suspensão ou Cancelamento</h2>
          <p className="text-muted-foreground leading-relaxed">
            O ecoBairro reserva-se o direito de suspender ou cancelar, temporária ou definitivamente, contas de utilizadores que violem os presentes Termos de Uso (ex: submissão repetida de reportes falsos, linguagem abusiva, partilha de conteúdos inadequados) sem necessidade de aviso prévio.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">6. Propriedade Intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            Todo o conteúdo da plataforma (código, design, marcas, logótipos) é propriedade exclusiva do ecoBairro ou dos seus licenciadores. Ao submeter fotografias para efeitos de reporte, o utilizador concede à plataforma e à respetiva autarquia uma licença não-exclusiva, gratuita e por tempo indeterminado para utilizar essa imagem na gestão da ocorrência.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
