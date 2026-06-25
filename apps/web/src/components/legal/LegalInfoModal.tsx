import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

export type LegalDocument = 'terms' | 'privacy' | 'accessibility'

interface LegalInfoModalProps {
  document: LegalDocument | null
  onOpenChange: (open: boolean) => void
}

const titles: Record<LegalDocument, string> = {
  terms: 'Termos de Uso',
  privacy: 'Política de Privacidade',
  accessibility: 'Declaração de Acessibilidade',
}

const sectionClassName = 'space-y-3'
const headingClassName = 'text-lg font-bold text-foreground'
const textClassName = 'text-sm leading-relaxed text-muted-foreground'
const listClassName = 'list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground'

function TermsContent() {
  return (
    <>
      <section className={sectionClassName}>
        <h3 className={headingClassName}>1. Objeto e Aceitação</h3>
        <p className={textClassName}>
          Os presentes Termos de Uso regulam o acesso e a utilização da plataforma ecoBairro. Ao aceder, registar-se ou utilizar a plataforma, o utilizador concorda expressamente e sem reservas com as regras aqui estipuladas. Caso não concorde com alguma destas condições, não deverá utilizar a plataforma.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>2. Registo e Conta de Utilizador</h3>
        <p className={textClassName}>
          O registo é obrigatório para aceder à maioria das funcionalidades (Reportes, Partilhas, Gamificação). O utilizador compromete-se a fornecer informações verdadeiras e atualizadas. A conta é pessoal e intransmissível, sendo o utilizador o único responsável pela confidencialidade das suas credenciais.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>3. Deveres e Regras de Conduta</h3>
        <p className={textClassName}>Ao utilizar o ecoBairro, o utilizador obriga-se a:</p>
        <ul className={listClassName}>
          <li>Submeter reportes verídicos e precisos sobre o espaço público.</li>
          <li><strong>Não incluir fotografias que contenham pessoas identificáveis, matrículas de veículos ou informações privadas de terceiros,</strong> respeitando o direito à imagem e à privacidade.</li>
          <li>Adotar um comportamento cívico e respeitoso na área de &quot;Partilhas na sua zona&quot;.</li>
          <li>Não utilizar a plataforma para a promoção de atividades comerciais ilegais, ofensivas ou discriminatórias.</li>
        </ul>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>4. Isenção de Responsabilidade (Partilhas)</h3>
        <p className={textClassName}>
          A secção &quot;Partilhas na sua zona&quot; funciona como um espaço de conexão comunitária. O ecoBairro não atua como intermediário nas trocas ou doações, nem garante a qualidade, segurança ou legalidade dos artigos anunciados. Qualquer transação ou interação é da exclusiva responsabilidade dos utilizadores envolvidos.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>5. Suspensão ou Cancelamento</h3>
        <p className={textClassName}>
          O ecoBairro reserva-se o direito de suspender ou cancelar, temporária ou definitivamente, contas de utilizadores que violem os presentes Termos de Uso (ex: submissão repetida de reportes falsos, linguagem abusiva, partilha de conteúdos inadequados) sem necessidade de aviso prévio.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>6. Propriedade Intelectual</h3>
        <p className={textClassName}>
          Todo o conteúdo da plataforma (código, design, marcas, logótipos) é propriedade exclusiva do ecoBairro ou dos seus licenciadores. Ao submeter fotografias para efeitos de reporte, o utilizador concede à plataforma e à respetiva autarquia uma licença não-exclusiva, gratuita e por tempo indeterminado para utilizar essa imagem na gestão da ocorrência.
        </p>
      </section>
    </>
  )
}

function PrivacyContent() {
  return (
    <>
      <section className={sectionClassName}>
        <h3 className={headingClassName}>1. Responsável pelo Tratamento</h3>
        <p className={textClassName}>
          O ecoBairro (doravante &quot;Plataforma&quot;) é a entidade responsável pelo tratamento dos seus dados pessoais. O nosso compromisso é garantir a transparência, segurança e privacidade no tratamento dos dados dos nossos utilizadores, em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD - Regulamento (UE) 2016/679) e a legislação portuguesa aplicável (Lei n.º 58/2019).
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>2. Dados Recolhidos e Finalidade</h3>
        <p className={textClassName}>A Plataforma recolhe apenas os dados estritamente necessários para o seu funcionamento:</p>
        <ul className={listClassName}>
          <li><strong>Dados de Conta:</strong> Nome e endereço de e-mail (para autenticação, contacto e identificação comunitária).</li>
          <li><strong>Dados de Localização (GPS):</strong> Recolhidos apenas aquando da submissão de um &quot;Reporte&quot;, para georreferenciar corretamente as anomalias no espaço público.</li>
          <li><strong>Fotografias:</strong> Submetidas pelo utilizador para evidenciar reportes no espaço público ou itens para partilha local.</li>
        </ul>
        <p className={textClassName}>
          Estes dados são utilizados exclusivamente para encaminhamento de reportes às entidades municipais competentes, funcionamento do mercado de partilhas e gestão da gamificação (atribuição de pontos).
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>3. Base de Licitude</h3>
        <p className={textClassName}>
          O tratamento dos seus dados baseia-se no seu <strong>consentimento expresso</strong> (art. 6.º, n.º 1, alínea a) do RGPD) ao registar-se na plataforma, e no <strong>interesse público</strong> (art. 6.º, n.º 1, alínea e) do RGPD) no que respeita à gestão e manutenção do espaço público municipal através da recolha de reportes.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>4. Partilha de Dados</h3>
        <p className={textClassName}>
          Os dados relativos aos reportes (fotografia e localização) poderão ser partilhados de forma anonimizada com a Câmara Municipal e respetivos serviços técnicos para efeitos de resolução das ocorrências. Não vendemos, alugamos ou partilhamos os seus dados pessoais com terceiros para fins comerciais.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>5. Prazos de Conservação</h3>
        <p className={textClassName}>
          Os seus dados pessoais serão conservados apenas durante o período necessário para as finalidades para as quais foram recolhidos, ou seja, enquanto mantiver a sua conta ativa. Quando a conta for eliminada, os reportes anteriores poderão ser mantidos de forma anonimizada (apenas para efeitos estatísticos), sendo eliminada qualquer ligação à sua identidade.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>6. Direitos dos Titulares dos Dados</h3>
        <p className={textClassName}>
          Ao abrigo do RGPD, assiste-lhe o direito de solicitar à Plataforma o acesso aos dados pessoais que lhe digam respeito, bem como a sua retificação, apagamento (direito a ser esquecido), limitação do tratamento, o direito de se opor ao tratamento e o direito à portabilidade dos dados.
          <br /><br />
          Para exercer qualquer um destes direitos, contacte-nos através do e-mail:{' '}
          <a href="mailto:privacidade@ecobairro.pt" className="text-[var(--primary)] hover:underline">privacidade@ecobairro.pt</a>.
        </p>
      </section>
    </>
  )
}

function AccessibilityContent() {
  return (
    <>
      <section className={sectionClassName}>
        <p className={textClassName}>
          O ecoBairro tem o compromisso de garantir que a sua plataforma digital é acessível a todos os cidadãos, independentemente das suas capacidades ou necessidades especiais, promovendo uma participação cívica verdadeiramente inclusiva.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>1. Conformidade e Legislação</h3>
        <p className={textClassName}>
          Trabalhamos continuamente para que a nossa plataforma esteja em conformidade com as diretrizes de acessibilidade para conteúdos web (WCAG) 2.1, nível AA, desenvolvidas pelo W3C (World Wide Web Consortium). A nossa atuação guia-se pelo cumprimento das disposições do <strong>Decreto-Lei n.º 83/2018</strong>, de 19 de outubro, que define os requisitos de acessibilidade dos sítios web e das aplicações móveis do setor público em Portugal.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>2. Funcionalidades de Acessibilidade</h3>
        <p className={textClassName}>A plataforma ecoBairro integra as seguintes boas práticas de acessibilidade:</p>
        <ul className={listClassName}>
          <li><strong>Contraste Adequado:</strong> Disponibilização de um modo escuro (Dark Mode) e cores de destaque testadas para garantir o rácio de contraste ideal para leitura.</li>
          <li><strong>Compatibilidade com Leitores de Ecrã:</strong> Uso de labels, tags ARIA e estrutura HTML semântica para facilitar a leitura por software de assistência (como o NVDA ou o VoiceOver).</li>
          <li><strong>Navegação por Teclado:</strong> Todas as secções críticas da plataforma, incluindo submissão de reportes e navegação de menus, são utilizáveis utilizando exclusivamente o teclado.</li>
          <li><strong>Evitar intermitências:</strong> Redução de animações disruptivas para utilizadores com sensibilidade visual.</li>
        </ul>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>3. Esforço Contínuo</h3>
        <p className={textClassName}>
          Acessibilidade é um processo contínuo. Apesar dos nossos esforços para tornar todas as páginas e conteúdos totalmente acessíveis, alguns recursos ou conteúdos gerados por outros utilizadores (ex: descrições no mercado de partilhas) podem nem sempre estar perfeitamente otimizados.
        </p>
      </section>

      <section className={sectionClassName}>
        <h3 className={headingClassName}>4. Feedback e Contacto</h3>
        <p className={textClassName}>
          A sua experiência e a sua opinião são muito importantes para nós. Se encontrar dificuldades de acesso a qualquer conteúdo ou funcionalidade da plataforma ecoBairro, agradecemos que entre em contacto connosco para que possamos corrigir o problema rapidamente.
          <br /><br />
          Contacte-nos através do e-mail:{' '}
          <a href="mailto:acessibilidade@ecobairro.pt" className="text-[var(--primary)] hover:underline">acessibilidade@ecobairro.pt</a>.
        </p>
      </section>
    </>
  )
}

function LegalContent({ document }: { document: LegalDocument }) {
  if (document === 'terms') return <TermsContent />
  if (document === 'privacy') return <PrivacyContent />
  return <AccessibilityContent />
}

export function LegalInfoModal({ document, onOpenChange }: LegalInfoModalProps) {
  return (
    <Dialog.Root open={document !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        {document && (
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[110] flex max-h-[85svh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="pr-8 text-xl font-semibold leading-none tracking-tight text-foreground">
              {titles[document]}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Informação sobre {titles[document].toLowerCase()} do ecoBairro.
            </Dialog.Description>

            <div className="min-h-0 space-y-6 overflow-y-auto pr-3">
              <LegalContent document={document} />
            </div>

            <div className="flex justify-end border-t pt-4">
              <Dialog.Close asChild>
                <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                  Fechar
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Close asChild>
              <button
                aria-label="Fechar"
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
