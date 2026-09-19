import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'INXSocial',
    short_name: 'INXSocial',
    description: 'Intelligent social publishing, scheduling, analytics and AI creation.',
    start_url: '/',
    display: 'standalone',
    background_color: '#04131e',
    theme_color: '#04131e',
  }
}
