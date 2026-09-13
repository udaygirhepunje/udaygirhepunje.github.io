import rss from '@astrojs/rss';
import { getJournal } from '../lib/data';

export async function GET(context) {
  const entries = await getJournal();
  return rss({
    title: 'Uday Girhepunje · Journal',
    description: 'Notes on engineering and things made outside the ticket.',
    site: context.site,
    items: entries.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.publishedAt,
      link: `/journal/${entry.id.replace(/\.(md|mdx)$/, '')}/`,
    })),
  });
}
