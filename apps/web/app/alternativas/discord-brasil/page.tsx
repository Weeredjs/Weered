import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../../components/MarketingHeader";

const TITLE = "Discord sem vídeo no Brasil: o que aconteceu e o que fazer (2026) | Weered";
const DESC =
  "Desde 17 de agosto de 2026, câmera, compartilhamento de tela e Go Live estão desativados no Discord no Brasil por determinação da ANPD. O que foi bloqueado, o que continua funcionando, e as alternativas — inclusive as gratuitas.";
const URL = "https://weered.ca/alternativas/discord-brasil";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    type: "article",
    siteName: "Weered",
    locale: "pt_BR",
    images: [{ url: "https://weered.ca/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["https://weered.ca/og"],
  },
};

/**
 * PT-BR page for the ANPD video suspension.
 *
 * Positioning note, because it is easy to get wrong later: this page does NOT
 * compete on "free instant screen share". Kosmi, WorkAdventure and
 * CompartilharTela already own that, they are free and need no signup, and for
 * someone who just needs to share a screen tonight they are the right answer.
 * The page says so by name.
 *
 * What none of them say is the thing worth saying: every one of those is a
 * patch that assumes the block is short, and nobody has named an end date. The
 * argument here is a home versus a patch, aimed at communities rather than at
 * one evening.
 *
 * The FAQ renders from the same object that feeds the FAQPage JSON-LD, so the
 * structured data cannot drift from the visible copy.
 */
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: "pt-BR",
  mainEntity: [
    {
      "@type": "Question",
      name: "O que exatamente foi bloqueado no Discord no Brasil?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Câmera, compartilhamento de tela e Go Live — em mensagens diretas, grupos, canais de voz e canais de palco. Voz e texto continuam funcionando normalmente. A ANPD adotou a medida preventiva em 12 de agosto de 2026 e o Discord passou a cumpri-la em 17 de agosto.",
      },
    },
    {
      "@type": "Question",
      name: "Por quanto tempo o Discord vai ficar sem vídeo no Brasil?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ninguém sabe. O Discord diz que a suspensão é temporária, mas não há data anunciada. A medida faz parte de uma investigação da ANPD sob o ECA Digital, ou seja, é uma decisão regulatória e não uma falha técnica.",
      },
    },
    {
      "@type": "Question",
      name: "A Weered é gratuita?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Usar a Weered é gratuito: lobbies, salas, voz, vídeo e presença. Criar e administrar o seu próprio lobby é um plano pago de 6 dólares por mês. Ter um lobby construído sob medida, com os seus bots virando recurso nativo, a sua marca e o seu domínio, é orçado pelo tamanho da comunidade.",
      },
    },
    {
      "@type": "Question",
      name: "Meus membros precisam de conta no Discord ou em outra plataforma?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não. Uma conta Weered funciona em qualquer lobby da Weered. Não há plataforma-mãe para se cadastrar antes.",
      },
    },
    {
      "@type": "Question",
      name: "A Weered também pode ser bloqueada no Brasil?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A medida da ANPD é dirigida ao Discord, dentro de uma investigação específica, e não somos parte dela. Dito isso, ninguém honesto promete o que um regulador vai decidir. O que dá para prometer é o seguinte: os dados da sua comunidade são exportáveis a qualquer momento e não há contrato prendendo você.",
      },
    },
    {
      "@type": "Question",
      name: "Onde a Weered é hospedada?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No Canadá.",
      },
    },
  ],
};

const PATCHES: [string, string, string][] = [
  ["Kosmi", "kosmi.io", "Sala no navegador, tela e vídeo, sem instalar nada."],
  ["WorkAdventure", "workadventu.re", "Voz, vídeo e tela no navegador, grátis até 10 pessoas."],
  [
    "CompartilharTela",
    "compartilhartela.com.br",
    "Brasileiro, foco em dividir a tela mantendo o Discord aberto.",
  ],
];

const WHO: [string, string][] = [
  [
    "Salas de estudo",
    "ENEM, concursos, faculdade — a sala de estudo do Discord vivia de tela compartilhada.",
  ],
  ["Mesas de RPG", "Mapa, ficha, mestre mostrando a cena. Sem tela, a mesa para."],
  [
    "Comunidades de desenvolvimento",
    "Revisão de código e pareamento acontecem olhando a tela de alguém.",
  ],
  ["Arte e música", "Mostrar o processo era metade da comunidade."],
  ["Times e organizações de esports", "Revisão de VOD, briefing, transmissão interna."],
  [
    "Ligas de automobilismo virtual",
    "Analisar um incidente sem poder mostrar o replay não é análise.",
  ],
];

export default function DiscordBrasilPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <MarketingHeader ctaHref="/lobby" ctaLabel="Abrir a Weered" />

      {/* The root layout declares lang="en". Scoping pt-BR here keeps search
          engines and screen readers from reading this page as English. */}
      <main className="mkt" lang="pt-BR">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Discord sem vídeo no Brasil</span>
            <h1 className="mkt-h1">
              O Discord perdeu o vídeo no Brasil. Sua comunidade{" "}
              <span className="accent">não precisa perder o lugar dela</span>.
            </h1>
            <p className="mkt-sub">
              Desde 17 de agosto de 2026, câmera, compartilhamento de tela e Go Live estão
              desativados no Discord para quem está no Brasil, por determinação da ANPD. Voz e texto
              continuam. O resto, não — e ninguém disse até quando.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby" className="mkt-cta-primary">
                Ver os lobbies
              </Link>
              <Link href="/contact" className="mkt-cta-secondary">
                Falar com quem construiu
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">O que aconteceu, exatamente</h2>
            <ul className="mkt-bullet-list">
              <li>
                <strong>12 de agosto de 2026.</strong> A ANPD adota medida preventiva determinando
                que o Discord suspenda o Go Live e qualquer recurso equivalente de transmissão e
                compartilhamento de vídeo no Brasil.
              </li>
              <li>
                <strong>17 de agosto de 2026.</strong> O Discord passa a cumprir. Câmera desativada,
                compartilhamento de tela indisponível na região.
              </li>
              <li>
                <strong>O que foi atingido:</strong> mensagens diretas, grupos, canais de voz e
                canais de palco. Todos.
              </li>
              <li>
                <strong>O que continua:</strong> voz e texto, normalmente.
              </li>
              <li>
                <strong>Por quê:</strong> uma investigação sob o ECA Digital. É uma decisão de
                regulador, não uma queda de servidor.
              </li>
            </ul>
            <div className="mkt-callout">
              O Discord diz que a suspensão é temporária.{" "}
              <strong>Nenhuma data foi anunciada.</strong> Vale planejar para semanas, não para o
              fim de semana.
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Se você só precisa dividir a tela hoje à noite</h2>
            <p className="mkt-p">
              Use uma destas. São gratuitas, abrem no navegador e não pedem cadastro. Não somos nós,
              e tudo bem — para resolver uma noite, elas resolvem melhor.
            </p>
            <div className="mkt-grid-3">
              {PATCHES.map(([name, host, what]) => (
                <div className="mkt-card" key={name}>
                  <h3>{name}</h3>
                  <p>
                    {what}
                    <br />
                    <span style={{ opacity: 0.6 }}>{host}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mkt-p">
              O resto desta página é para quem tem <strong>uma comunidade</strong>, e não um
              problema de uma noite.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">A diferença entre um remendo e um lugar</h2>
            <p className="mkt-p">
              Todas as alternativas acima partem do mesmo pressuposto: que isto acaba logo. Enquanto
              não acaba, a sua comunidade abre o Discord para falar, abre outra aba para mostrar a
              tela, avisa quem não achou o link, e repete isso toda semana.
            </p>
            <p className="mkt-p">
              Funciona. Só cobra um pedágio toda vez — e revela uma coisa desconfortável: o lugar
              onde a sua comunidade mora não é seu. As regras podem mudar sem você, e mudaram.
            </p>
            <p className="mkt-p">
              A Weered não é um remendo. É um <strong>lobby próprio</strong> para a sua comunidade:
              salas de voz e vídeo que funcionam aqui, sala de co-watch para assistir junto, canais
              e cargos, e o seu domínio na barra de endereço. Os bots que você usa hoje viram
              recurso nativo — é só dizer o que cada um faz.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Isto não é só sobre jogos</h2>
            <p className="mkt-p">
              O bloqueio não escolheu público. Atingiu todo mundo que usava o Discord para mostrar
              alguma coisa.
            </p>
            <ul className="mkt-bullet-list">
              {WHO.map(([who, why]) => (
                <li key={who}>
                  <strong>{who}.</strong> {why}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Usar é grátis. Ter um feito sob medida, não.</h2>
            <p className="mkt-p">
              Lobbies, salas, voz, vídeo e presença não custam nada para usar. Criar e administrar o
              seu próprio lobby é um plano de 6 dólares por mês. E, se você quiser,{" "}
              <strong>a gente constrói o lobby da sua comunidade</strong>: seus bots virando recurso
              nativo, sua marca, suas regras, seu domínio — orçado pelo tamanho da comunidade, nunca
              por membro e nunca por impulso.
            </p>
            <p className="mkt-p">
              Sem contrato, mês a mês, e os dados da sua comunidade são exportáveis quando você
              quiser.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Perguntas frequentes</h2>
            {faqLd.mainEntity.map((q) => (
              <div key={q.name}>
                <h3 className="mkt-h3">{q.name}</h3>
                <p className="mkt-p">{q.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>A sua comunidade continua existindo. Ela só precisa de um lugar.</h2>
            <p>
              Conte o que os seus bots faziam e como a sua comunidade funciona. A gente monta o
              lobby em volta disso.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby" className="mkt-cta-primary">
                Criar seu lobby
              </Link>
              <Link href="/contact" className="mkt-cta-secondary">
                Falar com quem construiu
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
