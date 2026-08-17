import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import type { Icd10CodeRef } from "@scribe/shared-types";

export interface NoteVersionRow {
  id: string;
  encounter_id: string;
  version_number: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10_codes: Icd10CodeRef[];
  author_id: string;
  author_name: string;
  created_at: Date;
}

@Injectable()
export class NotesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * INSERT-only — see AGENTS.md [VERSION-IMMUTABILITY]. No UPDATE/DELETE of an
   * existing note_versions row exists anywhere in this codebase. An advisory
   * lock serializes concurrent saves on the same encounter so version numbers
   * never collide or skip under a race.
   */
  async insertNextVersion(input: {
    encounterId: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    icd10Codes: Icd10CodeRef[];
    authorId: string;
  }): Promise<NoteVersionRow> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.encounterId]);

      const nextVersionResult = await client.query<{ next: number }>(
        "SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM note_versions WHERE encounter_id = $1",
        [input.encounterId],
      );
      const nextVersion = nextVersionResult.rows[0].next;

      const inserted = await client.query<Omit<NoteVersionRow, "author_name">>(
        `INSERT INTO note_versions
           (encounter_id, version_number, subjective, objective, assessment, plan, icd10_codes, author_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.encounterId,
          nextVersion,
          input.subjective,
          input.objective,
          input.assessment,
          input.plan,
          JSON.stringify(input.icd10Codes),
          input.authorId,
        ],
      );

      await client.query("COMMIT");

      const authorResult = await client.query<{ name: string }>("SELECT name FROM providers WHERE id = $1", [
        input.authorId,
      ]);

      return { ...inserted.rows[0], author_name: authorResult.rows[0]?.name ?? "" };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async listVersions(encounterId: string): Promise<NoteVersionRow[]> {
    const result = await this.pool.query<NoteVersionRow>(
      `SELECT nv.*, p.name AS author_name
       FROM note_versions nv
       JOIN providers p ON p.id = nv.author_id
       WHERE nv.encounter_id = $1
       ORDER BY nv.version_number ASC`,
      [encounterId],
    );
    return result.rows;
  }

  async getVersion(encounterId: string, versionNumber: number): Promise<NoteVersionRow | null> {
    const result = await this.pool.query<NoteVersionRow>(
      `SELECT nv.*, p.name AS author_name
       FROM note_versions nv
       JOIN providers p ON p.id = nv.author_id
       WHERE nv.encounter_id = $1 AND nv.version_number = $2`,
      [encounterId, versionNumber],
    );
    return result.rows[0] ?? null;
  }

  /** A provider's own most recently saved notes, across all their encounters — used to learn a
   * writing-style preference (pioneer.writing_style). Never reads another provider's rows
   * (AGENTS.md [TENANT-ISOLATION]). */
  async getRecentByAuthor(authorId: string, limit: number): Promise<Pick<NoteVersionRow, "subjective" | "plan">[]> {
    const result = await this.pool.query<Pick<NoteVersionRow, "subjective" | "plan">>(
      `SELECT subjective, plan
       FROM note_versions
       WHERE author_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [authorId, limit],
    );
    return result.rows;
  }

  /** Most recent saved note per encounter, for a set of encounters (prior-history lookups). */
  async getLatestPerEncounter(encounterIds: string[]): Promise<NoteVersionRow[]> {
    if (encounterIds.length === 0) return [];
    const result = await this.pool.query<NoteVersionRow>(
      `SELECT DISTINCT ON (nv.encounter_id) nv.*, p.name AS author_name
       FROM note_versions nv
       JOIN providers p ON p.id = nv.author_id
       WHERE nv.encounter_id = ANY($1::uuid[])
       ORDER BY nv.encounter_id, nv.version_number DESC`,
      [encounterIds],
    );
    return result.rows;
  }
}
