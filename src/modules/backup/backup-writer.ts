import fs from "node:fs";
import path from "node:path";

import type { RuntimeConfig } from "../config/runtime-config.ts";
import { LwsError } from "../../shared/errors.ts";
import type { JobRunContext } from "../../services/job-service.ts";

export type BackupWriterResult = {
  backup_id: string;
  backup_path: string;
  created_at: string;
  included_roots: string[];
  manifest_path: string;
};

export class BackupWriter {
  private readonly config: RuntimeConfig;

  constructor(config: RuntimeConfig) {
    this.config = config;
  }

  writeSnapshot(
    options: { backupId?: string } = {},
    job?: Pick<JobRunContext<BackupWriterResult>, "updateProgress" | "checkCanceled">
  ): BackupWriterResult {
    const createdAt = new Date().toISOString();
    const backupId = options.backupId ?? `backup.${createdAt.slice(0, 10).replaceAll("-", "")}.${crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 12)
      .toUpperCase()}`;
    const backupPath = this.resolveBackupPath(backupId);

    job?.checkCanceled();
    job?.updateProgress({ phase: "prepare", current: 0, total: 3, message: "Preparing backup snapshot" });
    fs.mkdirSync(backupPath, { recursive: true });
    const includedRoots: string[] = [];
    job?.checkCanceled();
    includedRoots.push(this.copyRoot(this.config.roots.knowledge, path.join(backupPath, "knowledge")));
    job?.updateProgress({ phase: "copy", current: 1, total: 3, message: "Knowledge root copied" });
    job?.checkCanceled();
    includedRoots.push(this.copyRoot(this.config.roots.data, path.join(backupPath, "data")));
    job?.updateProgress({ phase: "copy", current: 2, total: 3, message: "Data root copied" });

    const manifestPath = path.join(backupPath, "manifest.json");
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify(
        {
          backup_id: backupId,
          created_at: createdAt,
          app_name: this.config.appName,
          included_roots: includedRoots,
          source_roots: {
            knowledge: "<redacted>",
            data: "<redacted>"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    job?.updateProgress({ phase: "manifest", current: 3, total: 3, message: "Backup manifest written" });

    return {
      backup_id: backupId,
      backup_path: backupPath,
      created_at: createdAt,
      included_roots: includedRoots,
      manifest_path: manifestPath
    };
  }

  private resolveBackupPath(backupId: string): string {
    if (!/^backup\.[A-Za-z0-9.]+$/.test(backupId)) {
      throw new LwsError("PATH_OUTSIDE_ROOT", "Backup id is invalid or unsafe.", { backup_id: backupId });
    }

    const backupPath = path.resolve(this.config.roots.backup, backupId);
    const relative = path.relative(this.config.roots.backup, backupPath);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new LwsError("PATH_OUTSIDE_ROOT", "Backup path escaped LWS_BACKUP_ROOT.", {
        root: this.config.roots.backup,
        backup_path: backupPath
      });
    }

    return backupPath;
  }

  private copyRoot(sourceRoot: string, targetRoot: string): string {
    assertTargetOutsideSource(sourceRoot, targetRoot);

    if (!fs.existsSync(sourceRoot)) {
      fs.mkdirSync(targetRoot, { recursive: true });
      return targetRoot;
    }

    fs.cpSync(sourceRoot, targetRoot, {
      recursive: true,
      force: true,
      errorOnExist: false
    });
    return targetRoot;
  }
}

function assertTargetOutsideSource(sourceRoot: string, targetRoot: string): void {
  const relative = path.relative(path.resolve(sourceRoot), path.resolve(targetRoot));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new LwsError("CONFIG_INVALID", "Backup target must not be inside a copied source root.", {
      source_root: sourceRoot,
      target_root: targetRoot
    });
  }
}
