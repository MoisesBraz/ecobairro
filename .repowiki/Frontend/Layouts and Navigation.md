---
tags: [layout, navigation, accessibility, responsive]
category: Frontend
wiki_version: 1.0
generated: 2026-06-15
sources: apps/web/src/routes/_layoutmain.tsx, apps/web/src/components/layout/DashboardLayout.tsx
---

# Layouts e Navegação (Layouts and Navigation)

## Table of Contents
- [[Frontend/Routing Architecture]]
- [[Frontend/Layouts and Navigation]]
- [[Frontend/UI Components Library]]
- [[Frontend/State Management Flow]]

## Estrutura de Layout do Painel (Dashboard)

A aplicação do **Ecobairro** possui uma interface de utilizador rica e responsiva assente em componentes de layout estruturais. A estrutura principal é definida através da rota de layout `_layoutmain.tsx` e do componente utilitário reutilizável `DashboardLayout.tsx`. 

Ambos implementam o padrão de **Layout Vertical** contendo:
- **Navbar (Barra Superior):** Apresenta o contexto do utilizador ativo, ações rápidas e o botão de acionamento do menu móvel (hamburger).
- **Navigation / Sidebar (Barra Lateral):** Menu de navegação primário que lista as secções da plataforma às quais o utilizador tem permissão de aceder.
- **Área de Conteúdo Principal:** Zona adaptável onde as páginas internas são injetadas (via `<Outlet />` no router ou `{children}` no componente).
- **Footer (Rodapé):** Secção informativa no final do ecrã.

### Arquitetura de Componentes de Layout

```mermaid
graph TD
    subgraph Navegador [Janela de Visualização]
        direction TB
        subgraph Topo [Navbar / Barra Superior]
            MenuToggle["Botão Hamburguer (Mobile)"]
            UserContext["Contexto & Perfil do Utilizador"]
        end
        
        subgraph Corpo [Estrutura de Conteúdo]
            direction LR
            subgraph Lateral [Sidebar / Navigation (Desktop)]
                NavLinks["Links de Navegação (Filtro por Role)"]
            end
            
            subgraph Principal [Conteúdo Principal]
                SkipLink["Skip Link (Acessibilidade)"]
                OutletArea["Área Dinâmica (Outlet / Children)"]
                Rodape["Footer (Rodapé)"]
            end
        end
    end
    
    MenuToggle -.->|"Abre (Mobile)"| MobileDrawer["Sheet / Mobile Drawer"]
    MobileDrawer --> MobileNav["Navigation (Versão Mobile)"]
```

---

## Comportamento Responsivo e Gaveta Mobile (Mobile Drawer)

Para suportar múltiplos tamanhos de ecrã (desktops, tablets e telemóveis), o layout implementa um controlo de estado local duplicado para gerir a visibilidade do menu lateral:

1. **Estado `collapsed` (Desktop):** Um valor booleano (`true`/`false`) que recolhe a barra lateral para maximizar o espaço de trabalho em ecrãs médios e grandes (`md:`).
2. **Estado `mobileOpen` (Mobile):** Um valor booleano que controla a exibição de uma folha flutuante (**`Sheet`** do shadcn/ui baseada no Radix UI) que desliza a partir da esquerda (`side="left"`), atuando como um menu drawer em dispositivos móveis.

### Exemplo de Implementação de Controlo de Estados

```typescript
const [collapsed, setCollapsed] = useState(false)
const [mobileOpen, setMobileOpen] = useState(false)
```

No ecrã móvel, o menu lateral fixo é ocultado via CSS (`hidden md:flex`) e o botão hamburger na `Navbar` ativa `setMobileOpen(true)`.

---

## Navegação Baseada em Perfis (Role-Based Navigation)

O componente de navegação (`Navigation` ou `Sidebar`) recebe o papel (role) do utilizador autenticado (`user.role`). Esta propriedade é crucial para filtrar dinamicamente os links visíveis no menu. 

Por exemplo:
* Um utilizador com o papel **`admin`** tem acesso visual a links como `/admin` (Administração) e `/audit` (Auditoria).
* Técnicos da autarquia (**`tecnico_autarquia`**) ou CCDR (**`tecnico_ccdr`**) são encaminhados prioritariamente para o `/analytics`.
* Cidadãos gerais (**`cidadao`**) visualizam apenas links públicos ou de participação direta como `/home` ou `/reportes`.

Esta filtragem visual no layout complementa as restrições rigorosas feitas no carregamento de dados e na proteção de rotas (`requireRole`), garantindo uma experiência de utilizador limpa e coerente.

---

## Acessibilidade (a11y) no Layout

A acessibilidade é tratada como uma prioridade na estrutura dos layouts:

1. **Skip Links (Links de Salto):** Logo no início do layout do dashboard, existe um link invisível por padrão que se torna visível apenas ao focar com o teclado (tecla `Tab`). Este link permite saltar a navegação repetitiva diretamente para o conteúdo principal:
   ```html
   <a href="#layout-main" className="sr-only focus:not-sr-only focus:fixed ...">
     Ir para o conteúdo principal
   </a>
   ```
2. **Acessibilidade do Mobile Drawer:** O componente `SheetContent` inclui um cabeçalho invisível para leitores de ecrã (`SheetHeader className="sr-only"`) contendo um título (`SheetTitle`), satisfazendo os requisitos WAI-ARIA para caixas de diálogo sem comprometer a estética visual.

> **Sources:** apps/web/src/routes/_layoutmain.tsx:L40-L76, apps/web/src/components/layout/DashboardLayout.tsx:L12-L42

---
*[[index|← Back to Index]] · Generated by repowiki*
