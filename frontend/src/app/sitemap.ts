import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastMod = new Date()
  return [
    { url: 'https://enrollalert.com/', lastModified: lastMod, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://enrollalert.com/courses', lastModified: lastMod},
    { url: 'https://enrollalert.com/my-courses', lastModified: lastMod},
    { url: 'https://enrollalert.com/about', lastModified: lastMod },
  ]
}

