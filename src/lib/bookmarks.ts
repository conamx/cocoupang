// 비회원 찜: localStorage에 저장(브라우저별). 서버/DB 불필요.
export type Bookmark = {
  key: string; // `${type}:${id}`
  type: 'product' | 'deal';
  id: string;
  title: string;
  image: string;
  href: string;
  price?: string;
  savedAt: number;
};

const KEY = 'bookmarks_v1';

export function readBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

function write(list: Bookmark[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('bookmarks-changed'));
  } catch {}
}

export function isBookmarked(key: string): boolean {
  return readBookmarks().some((b) => b.key === key);
}

export function toggleBookmark(item: Omit<Bookmark, 'savedAt'>): boolean {
  const list = readBookmarks();
  const idx = list.findIndex((b) => b.key === item.key);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  list.unshift({ ...item, savedAt: Date.now() });
  write(list);
  return true;
}

export function removeBookmark(key: string) {
  write(readBookmarks().filter((b) => b.key !== key));
}
