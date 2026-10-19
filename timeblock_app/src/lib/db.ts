/**
 * IndexedDB 版本的 db 层 —— 取代 window.lingguang.db
 * 表映射：time_blocks / tags
 */

const DB_NAME = 'timeblock.local';
const DB_VER = 1;
let _db: IDBDatabase | null = null;

type BlockRow = {
  id: string;
  title: string;
  record_date: string; // 'YYYY-MM-DD'
  start_minute: number;
  end_minute: number;
  tag_id?: string;
  note?: string;
  zone_mode?: number; // 0/1
  zone_name?: string;
  zone_color?: string;
  zone_note?: string;
  created_at: number;
  updated_at: number;
};

type TagRow = {
  id: string;
  name: string;
  color: string;
  parent_id?: string;
  sort_order: number;
  created_at: number;
};

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('time_blocks')) {
        const s = db.createObjectStore('time_blocks', { keyPath: 'id' });
        s.createIndex('by_date', 'record_date', { unique: false });
        s.createIndex('by_tag', 'tag_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('tags')) {
        const s = db.createObjectStore('tags', { keyPath: 'id' });
        s.createIndex('by_parent', 'parent_id', { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db!); };
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | null): Promise<T> {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    if (!req) { resolve(null as unknown as T); return; }
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    t.onerror = () => reject(t.error);
  }));
}

export async function loadBlocksByDateRange(startDate: string, endDate: string): Promise<TimeBlock[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('time_blocks', 'readonly');
    const idx = t.objectStore('time_blocks').index('by_date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const req = idx.getAll(range);
    req.onsuccess = () => {
      const rows = (req.result || []) as BlockRow[];
      rows.sort((a, b) => a.record_date.localeCompare(b.record_date) || a.start_minute - b.start_minute || a.created_at - b.created_at);
      resolve(rows.map((r) => ({
        id: r.id,
        title: r.title,
        recordDate: r.record_date,
        startMinute: r.start_minute,
        endMinute: r.end_minute,
        tagId: r.tag_id ?? '',
        note: r.note ?? '',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        zoneMode: !!r.zone_mode,
        zoneName: r.zone_name ?? '',
        zoneColor: r.zone_color ?? '',
        zoneNote: r.zone_note ?? '',
      })));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function upsertBlock(block: TimeBlock): Promise<void> {
  const existing = await tx<BlockRow | undefined>('time_blocks', 'readonly', (s) => s.get(block.id));
  const now = Date.now();
  const row: BlockRow = {
    id: block.id,
    title: block.title,
    record_date: block.recordDate,
    start_minute: block.startMinute,
    end_minute: block.endMinute,
    tag_id: block.tagId,
    note: block.note,
    zone_mode: block.zoneMode ? 1 : 0,
    zone_name: block.zoneName,
    zone_color: block.zoneColor,
    zone_note: block.zoneNote,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await tx('time_blocks', 'readwrite', (s) => { s.put(row); return null; });
}

export async function deleteBlock(id: string): Promise<void> {
  await tx('time_blocks', 'readwrite', (s) => { s.delete(id); return null; });
}

export async function loadTags(): Promise<Tag[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('tags', 'readonly');
    const req = t.objectStore('tags').getAll();
    req.onsuccess = () => {
      const rows = (req.result || []) as TagRow[];
      rows.sort((a, b) => a.sort_order - b.sort_order || a.created_at - b.created_at);
      resolve(rows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        parentId: r.parent_id ?? '',
        sortOrder: r.sort_order,
        createdAt: r.created_at,
      })));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function upsertTag(tag: Tag): Promise<void> {
  const existing = await tx<TagRow | undefined>('tags', 'readonly', (s) => s.get(tag.id));
  const now = Date.now();
  const row: TagRow = {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    parent_id: tag.parentId,
    sort_order: tag.sortOrder,
    created_at: existing?.created_at ?? now,
  };
  await tx('tags', 'readwrite', (s) => { s.put(row); return null; });
}

export async function deleteTagWithBlocks(tagId: string, childIds: string[]): Promise<void> {
  const ids = [tagId, ...childIds];
  const db = await openDB();
  // 1. 清空 time_blocks.tag_id = '' for all matching
  const blocks = await loadBlocksByDateRange('1970-01-01', '9999-12-31');
  for (const b of blocks) {
    if (ids.includes(b.tagId)) {
      b.tagId = '';
      await upsertBlock(b);
    }
  }
  // 2. 删 tags
  for (const id of ids) {
    await tx('tags', 'readwrite', (s) => { s.delete(id); return null; });
  }
}

// 重新导出时间块 / 标签类型供调用方
import type { TimeBlock, Tag } from '../types';
export type { TimeBlock, Tag };
