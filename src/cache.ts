import type { CfmEntry } from "./schema.js";

export interface CachedEntry {
    entry: CfmEntry;
    mtimeMs: number;
}

export class CfmCache {
    private cache = new Map<string, CachedEntry>();
    private projectRoot: string | null = null;

    get(filePath: string): CachedEntry | undefined {
        return this.cache.get(filePath);
    }

    set(filePath: string, entry: CachedEntry): void {
        this.cache.set(filePath, entry);
    }

    invalidate(filePath: string): void {
        this.cache.delete(filePath);
    }

    clear(newProjectRoot: string): void {
        this.cache.clear();
        this.projectRoot = newProjectRoot;
    }

    isRootChanged(rootDir: string): boolean {
        return this.projectRoot !== rootDir;
    }
}

export const cfmCache = new CfmCache();
