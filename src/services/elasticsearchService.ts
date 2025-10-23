import { Client } from '@elastic/elasticsearch';
import { EmailDoc } from '../types/email'

const ES_INDEX = process.env.ELASTICSEARCH_INDEX || 'emails'
const client = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });

// Ensure index with mapping exists
async function ensureIndex() {
  try {
    const exists = await client.indices.exists({ index: ES_INDEX })
    if (!exists) {
      await client.indices.create({
        index: ES_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              from: { type: 'keyword' },
              to: { type: 'keyword' },
              date: { type: 'date' },
              category: { type: 'keyword' },
              folder: { type: 'keyword' },
              account: { type: 'keyword' }
            }
          }
        }
      })
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('Elasticsearch ensureIndex failed:', err.message || err)
  }
}

ensureIndex().catch(() => {})

export async function indexEmail(doc: EmailDoc) {
  try {
    // use id as document id if available
    const params: any = { index: ES_INDEX, document: doc }
    if (doc.id) params.id = doc.id
    return await client.index(params)
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('Elasticsearch indexEmail error:', err.message || err)
    throw err
  }
}

export type SearchResult = {
  total: number
  hits: EmailDoc[]
}

export async function searchEmails(query: string, filters: { folder?: string; account?: string } = {}): Promise<SearchResult> {
  try {
    const must: any[] = []
    if (query && query !== '*') {
      must.push({
        multi_match: {
          query,
          fields: ['subject^3', 'body']
        }
      })
    }
    const filterClauses: any[] = []
    if (filters.folder) filterClauses.push({ term: { folder: filters.folder } })
    if (filters.account) filterClauses.push({ term: { account: filters.account } })

    const body: any = {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter: filterClauses
        }
      }
    }

    const resp = await client.search({ index: ES_INDEX, body })
    const hits = (resp.hits?.hits || []).map((h: any) => ({ ...(h._source || {}), id: h._id })) as EmailDoc[]
  const totalRaw = resp.hits?.total
  const total = typeof totalRaw === 'number' ? totalRaw : (totalRaw?.value || hits.length)
  return { total, hits }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('Elasticsearch searchEmails failed:', err.message || err)
    // rethrow so callers can fallback if desired
    throw err
  }
}

