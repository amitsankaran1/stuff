import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createStuffNotionClient } from '../client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
loadEnv({ path: resolve(root, '.env.local') });
loadEnv({ path: resolve(root, '.env') });
import {
  DB_TITLES,
  areasProperties,
  projectsProperties,
  tasksProperties,
} from '../schema';

const token = process.env.NOTION_TOKEN;
const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

if (!token) throw new Error('NOTION_TOKEN is required');
if (!parentPageId) throw new Error('NOTION_PARENT_PAGE_ID is required');

const { notion, enqueue } = createStuffNotionClient({ token });

async function findChildDatabase(title: string): Promise<string | null> {
  const res = await enqueue(() =>
    notion.search({
      query: title,
      filter: { property: 'object', value: 'database' },
      page_size: 25,
    }),
  );
  for (const r of res.results) {
    if (r.object !== 'database') continue;
    const t = (r as { title?: { plain_text: string }[] }).title;
    if (t && t.map((x) => x.plain_text).join('') === title) return r.id;
  }
  return null;
}

async function ensureDatabase(
  title: string,
  properties: Parameters<typeof notion.databases.create>[0]['properties'],
): Promise<string> {
  const existing = await findChildDatabase(title);
  if (existing) {
    console.log(`✓ ${title} exists (${existing})`);
    return existing;
  }
  const created = await enqueue(() =>
    notion.databases.create({
      parent: { type: 'page_id', page_id: parentPageId! },
      title: [{ type: 'text', text: { content: title } }],
      properties,
    }),
  );
  console.log(`+ ${title} created (${created.id})`);
  return created.id;
}

async function main() {
  const areasId = await ensureDatabase(DB_TITLES.areas, areasProperties);
  const projectsId = await ensureDatabase(DB_TITLES.projects, projectsProperties(areasId));
  const tasksId = await ensureDatabase(DB_TITLES.tasks, tasksProperties(areasId, projectsId));

  console.log('\nSet these in your .env.local:');
  console.log(`NOTION_AREAS_DB_ID=${areasId}`);
  console.log(`NOTION_PROJECTS_DB_ID=${projectsId}`);
  console.log(`NOTION_TASKS_DB_ID=${tasksId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
