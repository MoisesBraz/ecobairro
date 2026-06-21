import { useState, useEffect, useMemo } from 'react'

export type MapType = 'default' | 'satellite' | 'dark'

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics'
    }
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 22
    }
  ]
}


export function useMapStyle() {
  const [mapType, setMapType] = useState<MapType>('default')
  const [defaultStyle, setDefaultStyle] = useState<any | null>(null)

  useEffect(() => {
    fetch('/tiles/styles/basic-preview/style.json')
      .then(res => res.json())
      .then(style => {
        style.glyphs = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
        setDefaultStyle(style)
      })
      .catch(err => {
        console.error('Failed to load default map style', err)
      })
  }, [])

  const mapStyle = useMemo(() => {
    if (!defaultStyle) return null

    // Layer 3D de edifícios (fill-extrusion) baseada na fonte vectorial (openmaptiles)
    const building3dLayer = {
      id: '3d-buildings',
      source: 'openmaptiles',
      'source-layer': 'building',
      filter: ['!=', ['get', 'hide_3d'], true],
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': mapType === 'dark' ? '#334155' : '#e2e8f0',
        'fill-extrusion-height': ['get', 'render_height'],
        'fill-extrusion-base': ['get', 'render_min_height'],
        'fill-extrusion-opacity': mapType === 'satellite' ? 0.7 : 0.9,
      },
    }

    if (mapType === 'satellite') {
      // Cria um estilo híbrido: Satélite (Raster) + Edifícios 3D
      return {
        ...SATELLITE_STYLE,
        sources: {
          ...SATELLITE_STYLE.sources,
          openmaptiles: defaultStyle.sources.openmaptiles // Injeta os dados vectoriais do tileserver local
        },
        layers: [
          ...SATELLITE_STYLE.layers,
          building3dLayer // Sobrepõe os edifícios 3D semi-transparentes
        ]
      }
    }

    if (mapType === 'dark') {
      // Carto Dark Matter (mais claro que o dark_all, mas ainda raster) com 3D buildings
      const DARK_MATTER = {
        version: 8,
        sources: {
          carto: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: 'Map tiles by Carto, under CC BY 3.0. Data by OpenStreetMap, under ODbL.'
          },
          openmaptiles: defaultStyle.sources.openmaptiles // Fonte vectorial para ruas/edifícios
        },
        layers: [
          {
            id: 'carto-dark',
            type: 'raster',
            source: 'carto',
            minzoom: 0,
            maxzoom: 22,
            paint: {
              'raster-brightness-min': 0.15, // Torna o mapa base ligeiramente mais claro (menos preto puro)
              'raster-contrast': 0.8
            }
          },
          // Adiciona as ruas em cima (linha) para não ficarem "escondidas" pelo fundo preto
          {
            id: 'roads-dark',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'transportation',
            paint: {
              'line-color': '#475569',
              'line-width': 1.5,
              'line-opacity': 0.4
            }
          },
          building3dLayer
        ]
      }
      return DARK_MATTER
    }

    // Default Map (Ruas) - Adicionamos 3D buildings ao estilo padrão caso não existam
    const styleClone = JSON.parse(JSON.stringify(defaultStyle))
    const has3D = styleClone.layers.some((l: any) => l.type === 'fill-extrusion')
    if (!has3D) {
      styleClone.layers.push(building3dLayer)
    }
    return styleClone
  }, [mapType, defaultStyle])

  return { mapType, setMapType, mapStyle }
}

export const MAP_TYPES = [
  { value: 'default', label: 'Ruas' },
  { value: 'satellite', label: 'Satélite' },
  { value: 'dark', label: 'Escuro' },
] as const
