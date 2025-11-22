import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { TaskRecord } from "./types.js";
import { dirname, resolve } from "path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";

export class TaskDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath?: string) {
    // Determine the actual database path
    this.dbPath = this.resolveDbPath(dbPath);

    // Create directory if it doesn't exist
    const dir = dirname(this.dbPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(`Failed to create database directory ${dir}:`, err);
      throw new Error(`Cannot create database directory: ${dir}`);
    }
  }

  private resolveDbPath(dbPath?: string): string {
    // If custom path provided via KIE_AI_DB_PATH, use it
    if (dbPath) {
      return resolve(dbPath);
    }

    // Default: use home directory for reliability with npx
    const homeDir = homedir();
    return resolve(homeDir, ".kie-ai", "tasks.db");
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.db) {
      return;
    }

    const SQL = await initSqlJs();
    
    // Load existing database if exists
    if (existsSync(this.dbPath)) {
      try {
        const buffer = readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
      } catch {
        // If loading fails, create new database
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.initializeDatabase();
    this.initialized = true;
  }

  private initializeDatabase(): void {
    if (!this.db) return;
    
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT UNIQUE NOT NULL,
        api_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        result_url TEXT,
        error_message TEXT
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_task_id ON tasks(task_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON tasks(status)`);
    this.save();
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  async createTask(
    taskData: Omit<TaskRecord, "id" | "created_at" | "updated_at">,
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;
    
    this.db.run(
      `INSERT INTO tasks (task_id, api_type, status, result_url, error_message)
       VALUES (?, ?, ?, ?, ?)`,
      [
        taskData.task_id,
        taskData.api_type,
        taskData.status,
        taskData.result_url || null,
        taskData.error_message || null,
      ]
    );
    this.save();
  }

  async getTask(taskId: string): Promise<TaskRecord | null> {
    await this.ensureInitialized();
    if (!this.db) return null;
    
    const stmt = this.db.prepare(`SELECT * FROM tasks WHERE task_id = ?`);
    stmt.bind([taskId]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as TaskRecord;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  async updateTask(
    taskId: string,
    updates: Partial<TaskRecord>,
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;
    
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      updateFields.push("status = ?");
      values.push(updates.status);
    }

    if (updates.result_url) {
      updateFields.push("result_url = ?");
      values.push(updates.result_url);
    }

    if (updates.error_message) {
      updateFields.push("error_message = ?");
      values.push(updates.error_message);
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(taskId);

    if (updateFields.length > 1) {
      this.db.run(
        `UPDATE tasks SET ${updateFields.join(", ")} WHERE task_id = ?`,
        values
      );
      this.save();
    }
  }

  async getAllTasks(limit: number = 100): Promise<TaskRecord[]> {
    await this.ensureInitialized();
    if (!this.db) return [];
    
    const stmt = this.db.prepare(
      `SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?`
    );
    stmt.bind([limit]);
    
    const results: TaskRecord[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as TaskRecord);
    }
    stmt.free();
    return results;
  }

  async getTasksByStatus(
    status: string,
    limit: number = 50,
  ): Promise<TaskRecord[]> {
    await this.ensureInitialized();
    if (!this.db) return [];
    
    const stmt = this.db.prepare(
      `SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?`
    );
    stmt.bind([status, limit]);
    
    const results: TaskRecord[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as TaskRecord);
    }
    stmt.free();
    return results;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}
