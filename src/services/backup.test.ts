import { describe, expect, it } from 'vitest';
import { importBackup } from './backup';
import type { Movie } from '@/types';

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'id-1',
    title: 'Arrival',
    year: '2016',
    status: 'seen',
    palette: 0,
    addedAt: 1,
    ...overrides,
  };
}

function backupFile(movies: unknown[]): File {
  return new File([JSON.stringify({ schemaVersion: 1, app: 'frame', movies })], 'backup.json', {
    type: 'application/json',
  });
}

describe('importBackup', () => {
  it('merges new movies and skips duplicates', async () => {
    const result = await importBackup(
      backupFile([movie(), movie({ id: 'id-2', title: 'Dune', year: '2021' })]),
      [movie()],
      'merge',
    );
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.movies).toHaveLength(2);
  });

  it('replaces the collection in replace mode', async () => {
    const result = await importBackup(backupFile([movie({ title: 'Dune' })]), [movie()], 'replace');
    expect(result.replaced).toBe(1);
    expect(result.movies).toHaveLength(1);
    expect(result.movies[0].title).toBe('Dune');
  });

  it('drops invalid rows and reports them', async () => {
    const result = await importBackup(backupFile([movie(), { id: 'broken' }]), [], 'merge');
    expect(result.invalid).toBe(1);
    expect(result.movies).toHaveLength(1);
  });

  it('accepts a bare array', async () => {
    const file = new File([JSON.stringify([movie()])], 'backup.json');
    const result = await importBackup(file, [], 'merge');
    expect(result.added).toBe(1);
  });

  it('rejects invalid JSON and empty backups', async () => {
    await expect(importBackup(new File(['not json'], 'backup.json'), [], 'merge')).rejects.toThrow(
      'This is not a valid JSON file.',
    );
    await expect(importBackup(new File(['{"movies":[]}'], 'backup.json'), [], 'merge')).rejects.toThrow(
      'No valid movies found in this backup file.',
    );
  });
});
