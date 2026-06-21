import { createFileRoute } from '@tanstack/react-router'
import { PublicNavbar, PublicFooter } from './_layoutpublic.home'

export const Route = createFileRoute('/_layoutpublic/privacidade')({
  component: PrivacidadePage,
})

function PrivacidadePage() {
  return (
    <div className="min-h-svh flex flex-col bg-background pt-24">
      <PublicNavbar alwaysSolid={true} />
      <main className="flex-1 max-w-[800px] mx-auto px-6 py-12 w-full space-y-8 text-foreground">
        <h1 className="text-4xl font-black mb-8">Política de Privacidade</h1>
        
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">1. Responsável pelo Tratamento</h2>
          <p className="text-muted-foreground leading-relaxed">
            O ecoBairro (doravante "Plataforma") é a entidade responsável pelo tratamento dos seus dados pessoais. O nosso compromisso é garantir a transparência, segurança e privacidade no tratamento dos dados dos nossos utilizadores, em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD - Regulamento (UE) 2016/679) e a legislação portuguesa aplicável (Lei n.º 58/2019).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">2. Dados Recolhidos e Finalidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            A Plataforma recolhe apenas os dados estritamente necessários para o seu funcionamento:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong>Dados de Conta:</strong> Nome e endereço de e-mail (para autenticação, contacto e identificação comunitária).</li>
            <li><strong>Dados de Localização (GPS):</strong> Recolhidos apenas aquando da submissão de um "Reporte", para georreferenciar corretamente as anomalias no espaço público.</li>
            <li><strong>Fotografias:</strong> Submetidas pelo utilizador para evidenciar reportes no espaço público ou itens para partilha local.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Estes dados são utilizados exclusivamente para encaminhamento de reportes às entidades municipais competentes, funcionamento do mercado de partilhas e gestão da gamificação (atribuição de pontos).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">3. Base de Licitude</h2>
          <p className="text-muted-foreground leading-relaxed">
            O tratamento dos seus dados baseia-se no seu <strong>consentimento expresso</strong> (art. 6.º, n.º 1, alínea a) do RGPD) ao registar-se na plataforma, e no <strong>interesse público</strong> (art. 6.º, n.º 1, alínea e) do RGPD) no que respeita à gestão e manutenção do espaço público municipal através da recolha de reportes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">4. Partilha de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Os dados relativos aos reportes (fotografia e localização) poderão ser partilhados de forma anonimizada com a Câmara Municipal e respetivos serviços técnicos para efeitos de resolução das ocorrências. Não vendemos, alugamos ou partilhamos os seus dados pessoais com terceiros para fins comerciais.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">5. Prazos de Conservação</h2>
          <p className="text-muted-foreground leading-relaxed">
            Os seus dados pessoais serão conservados apenas durante o período necessário para as finalidades para as quais foram recolhidos, ou seja, enquanto mantiver a sua conta ativa. Quando a conta for eliminada, os reportes anteriores poderão ser mantidos de forma anonimizada (apenas para efeitos estatísticos), sendo eliminada qualquer ligação à sua identidade.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">6. Direitos dos Titulares dos Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Ao abrigo do RGPD, assiste-lhe o direito de solicitar à Plataforma o acesso aos dados pessoais que lhe digam respeito, bem como a sua retificação, apagamento (direito a ser esquecido), limitação do tratamento, o direito de se opor ao tratamento e o direito à portabilidade dos dados.
            <br/><br/>
            Para exercer qualquer um destes direitos, contacte-nos através do e-mail:{' '}
            <a href="mailto:privacidade@ecobairro.pt" className="text-[var(--primary)] hover:underline">privacidade@ecobairro.pt</a>.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
