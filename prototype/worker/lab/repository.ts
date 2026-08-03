export type D1Result<T> = {
  results?: T[];
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run<T>(): Promise<D1Result<T>>;
};

export type LabD1 = {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
};

export type OwnedBranch = {
  id: string;
  caseId: string;
  caseVersion: string;
  contentHash: string;
  currentWeek: number;
  currentRoundNumber: number;
  status: string;
};

export type StoredCaseVersion = {
  contentHash: string;
};

export type StoredLabUser = {
  id: string;
};

export type BranchEvent = {
  eventType: string;
  payloadJson: string;
};

export async function findOwnedBranch(db: LabD1, branchId: string, identityKey: string): Promise<OwnedBranch | null> {
  return db.prepare(`
    SELECT
      b.id,
      b.case_id AS caseId,
      b.case_version AS caseVersion,
      cv.content_hash AS contentHash,
      b.current_week AS currentWeek,
      b.current_round_number AS currentRoundNumber,
      b.status
    FROM lab_branches b
    INNER JOIN lab_users u ON u.id = b.user_id
    INNER JOIN lab_case_versions cv
      ON cv.case_id = b.case_id AND cv.case_version = b.case_version
    WHERE b.id = ? AND u.identity_key = ?
    LIMIT 1
  `).bind(branchId, identityKey).first<OwnedBranch>();
}

export async function readBranchEvents(db: LabD1, branchId: string, currentWeek: number): Promise<BranchEvent[]> {
  const result = await db.prepare(`
    SELECT event_type AS eventType, payload_json AS payloadJson
    FROM lab_events
    WHERE branch_id = ? AND week <= ? AND visibility = 'user'
    ORDER BY week ASC, created_at ASC
  `).bind(branchId, currentWeek).all<BranchEvent>();
  return result.results ?? [];
}

export async function findStoredCaseVersion(
  db: LabD1,
  caseId: string,
  caseVersion: string,
): Promise<StoredCaseVersion | null> {
  return db.prepare(`
    SELECT content_hash AS contentHash
    FROM lab_case_versions
    WHERE case_id = ? AND case_version = ?
    LIMIT 1
  `).bind(caseId, caseVersion).first<StoredCaseVersion>();
}

export async function findLabUser(db: LabD1, identityKey: string): Promise<StoredLabUser | null> {
  return db.prepare(`
    SELECT id
    FROM lab_users
    WHERE identity_key = ?
    LIMIT 1
  `).bind(identityKey).first<StoredLabUser>();
}

export type CreateBranchRecords = {
  caseId: string;
  caseVersion: string;
  contentHash: string;
  userId: string;
  identityKey: string;
  displayName: string;
  progressId: string;
  branchId: string;
  scenarioId: string;
  forkWeek: number;
  snapshotId: string;
  stateJson: string;
  stateHash: string;
  eventId: string;
  eventPayloadJson: string;
};

export async function createBranchRecords(db: LabD1, records: CreateBranchRecords): Promise<void> {
  await db.batch([
    db.prepare(`
      INSERT INTO lab_case_versions (case_id, case_version, content_hash)
      VALUES (?, ?, ?)
      ON CONFLICT(case_id, case_version) DO NOTHING
    `).bind(records.caseId, records.caseVersion, records.contentHash),
    db.prepare(`
      INSERT INTO lab_users (id, identity_key, display_name)
      VALUES (?, ?, ?)
      ON CONFLICT(identity_key) DO UPDATE SET
        display_name = excluded.display_name,
        updated_at = CURRENT_TIMESTAMP
    `).bind(records.userId, records.identityKey, records.displayName),
    db.prepare(`
      INSERT INTO lab_progress (id, user_id, case_id, case_version, highest_unlocked_week)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, case_id, case_version) DO UPDATE SET
        highest_unlocked_week = MAX(highest_unlocked_week, excluded.highest_unlocked_week),
        updated_at = CURRENT_TIMESTAMP
    `).bind(records.progressId, records.userId, records.caseId, records.caseVersion, records.forkWeek),
    db.prepare(`
      INSERT OR IGNORE INTO lab_branches (
        id, user_id, case_id, case_version, fork_week, fork_round_number,
        current_week, current_round_number, lock_version, status
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, 'active')
    `).bind(
      records.branchId,
      records.userId,
      records.caseId,
      records.caseVersion,
      records.forkWeek,
      records.forkWeek,
    ),
    db.prepare(`
      INSERT OR IGNORE INTO lab_state_snapshots (
        id, branch_id, round_number, week, scenario_id, state_json, state_hash
      ) VALUES (?, ?, 0, ?, ?, ?, ?)
    `).bind(
      records.snapshotId,
      records.branchId,
      records.forkWeek,
      records.scenarioId,
      records.stateJson,
      records.stateHash,
    ),
    db.prepare(`
      INSERT OR IGNORE INTO lab_events (
        id, branch_id, round_number, week, event_type, payload_json, visibility
      ) VALUES (?, ?, 0, ?, 'scenario_started', ?, 'user')
    `).bind(
      records.eventId,
      records.branchId,
      records.forkWeek,
      records.eventPayloadJson,
    ),
  ]);
}

export type RecordMaterialView = {
  branchId: string;
  roundNumber: number;
  week: number;
  scenarioId: string;
  materialId: string;
  unlockCards: boolean;
};

export async function recordMaterialView(db: LabD1, record: RecordMaterialView): Promise<void> {
  const statements = [
    db.prepare(`
      INSERT OR IGNORE INTO lab_events (
        id, branch_id, round_number, week, event_type, payload_json, visibility
      ) VALUES (?, ?, ?, ?, 'scenario_material_viewed', ?, 'user')
    `).bind(
      `${record.branchId}:material-viewed:${record.materialId}`,
      record.branchId,
      record.roundNumber,
      record.week,
      JSON.stringify({ scenarioId: record.scenarioId, materialId: record.materialId }),
    ),
  ];
  if (record.unlockCards) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO lab_events (
        id, branch_id, round_number, week, event_type, payload_json, visibility
      ) VALUES (?, ?, ?, ?, 'scenario_cards_unlocked', ?, 'user')
    `).bind(
      `${record.branchId}:scenario-cards-unlocked:${record.scenarioId}`,
      record.branchId,
      record.roundNumber,
      record.week,
      JSON.stringify({ scenarioId: record.scenarioId, cardsUnlocked: true }),
    ));
  }
  await db.batch(statements);
}
