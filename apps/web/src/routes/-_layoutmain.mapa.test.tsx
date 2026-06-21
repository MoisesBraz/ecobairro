import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './_layoutmain.mapa'
import { fetchJson } from '@/lib/http/fetch-json'

// Mock react-router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
    createFileRoute: () => (config: any) => ({
      component: config.component,
      useRouteContext: () => ({ user: null })
    }),
  }
})

// Mock fetchJson
vi.mock('@/lib/http/fetch-json', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http/fetch-json')>()
  return {
    ...actual,
    fetchJson: vi.fn(),
  }
})

// Mock global.fetch
const mockFetch = vi.fn()
Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  configurable: true,
})

// Mock the Map component to verify props
vi.mock('react-map-gl/maplibre', () => {
  return {
    default: ({ mapStyle, terrain }: any) => (
      <div data-testid="mock-map" data-style={typeof mapStyle === 'string' ? mapStyle : 'object'} data-terrain={JSON.stringify(terrain)}>
        Mocked MapLibre
      </div>
    ),
    Marker: () => <div data-testid="mock-marker" />,
    Popup: () => <div data-testid="mock-popup" />,
    NavigationControl: () => <div data-testid="mock-nav" />,
    FullscreenControl: () => <div data-testid="mock-fs" />,
  }
})

const MapaPage = (Route as any).component as React.ComponentType

describe('MapaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchJson).mockImplementation(async (url: string) => {
      if (url.includes('/v1/ecopontos')) {
        return { ecopontos: [], total: 0 } as any;
      }
      return [];
    })
    // Set up mock fetch to return style JSON
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/tiles/styles/basic-preview/style.json')) {
        return new Response(JSON.stringify({
          version: 8,
          sources: {},
          layers: [],
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
        }))
      }
      return new Response('Not Found', { status: 404 })
    })
  })

  it('uses internal tileserver endpoint for MapLibre styles and terrain', async () => {
    render(<MapaPage />)

    // Wait for the map to be rendered
    const mapEl = await screen.findByTestId('mock-map')
    expect(mapEl).toBeInTheDocument()
    
    // Test 1: Fetch was called for style JSON
    expect(mockFetch).toHaveBeenCalledWith('/tiles/styles/basic-preview/style.json')

    // Test 2: Terrain 3D is configured
    const terrainProp = mapEl.getAttribute('data-terrain')
    expect(terrainProp).toContain('terrainSource')
  })
})
