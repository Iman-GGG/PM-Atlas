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
  lockVersion: number;
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

export type StoredRoundDraft = {
  id: string;
  branchId: string;
  roundNumber: number;
  scenarioId: string;
  selectedCardIdsJson: string;
  connectionsJson: string;
  reasoningJson: string;
  updatedAt: string | null;
};

export type StoredStateSnapshot = {
  roundNumber: number;
  week: number;
  scenarioId: string | null;
  stateJson: string;
  stateHash: string;
};

export type StoredRoundSubmission = {
  roundNumber: number;
  scenarioId: string;
  ruleResultJson: string;
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
      b.lock_version AS lockVersion,
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

export async function readRoundDraft(
  db: LabD1,
  branchId: string,
  roundNumber: number,
): Promise<StoredRoundDraft | null> {
  return db.prepare(`
    SELECT
      id,
      branch_id AS branchId,
      round_number AS roundNumber,
      scenario_id AS scenarioId,
      selected_card_ids_json AS selectedCardIdsJson,
      connections_json AS connectionsJson,
      reasoning_json AS reasoningJson,
      updated_at AS updatedAt
    FROM lab_round_drafts
    WHERE branch_id = ? AND round_number = ?
    LIMIT 1
  `).bind(branchId, roundNumber).first<StoredRoundDraft>();
}

export type SaveRoundDraft = {
  id: string;
  branchId: string;
  roundNumber: number;
  scenarioId: string;
  selectedCardIdsJson: string;
  connectionsJson: string;
  reasoningJson: string;
};

export async function saveRoundDraft(db: LabD1, draft: SaveRoundDraft): Promise<void> {
  await db.prepare(`
    INSERT INTO lab_round_drafts (
      id, branch_id, round_number, scenario_id,
      selected_card_ids_json, connections_json, reasoning_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(branch_id, round_number) DO UPDATE SET
      scenario_id = excluded.scenario_id,
      selected_card_ids_json = excluded.selected_card_ids_json,
      connections_json = excluded.connections_json,
      reasoning_json = excluded.reasoning_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    draft.id,
    draft.branchId,
    draft.roundNumber,
    draft.scenarioId,
    draft.selectedCardIdsJson,
    draft.connectionsJson,
    draft.reasoningJson,
  ).run();
}

export async function readCurrentStateSnapshot(
  db: LabD1,
  branchId: string,
  roundNumber: number,
): Promise<StoredStateSnapshot | null> {
  return db.prepare(`
    SELECT
      round_number AS roundNumber,
      week,
      scenario_id AS scenarioId,
      state_json AS stateJson,
      state_hash AS stateHash
    FROM lab_state_snapshots
    WHERE branch_id = ? AND round_number = ?
    LIMIT 1
  `).bind(branchId, roundNumber).first<StoredStateSnapshot>();
}

export async function findRoundSubmissionByIdempotency(
  db: LabD1,
  branchId: string,
  idempotencyKey: string,
): Promise<StoredRoundSubmission | null> {
  return db.prepare(`
    SELECT
      round_number AS roundNumber,
      scenario_id AS scenarioId,
      rule_result_json AS ruleResultJson
    FROM lab_round_submissions
    WHERE branch_id = ? AND idempotency_key = ?
    LIMIT 1
  `).bind(branchId, idempotencyKey).first<StoredRoundSubmission>();
}

export async function readRoundSubmission(
  db: LabD1,
  branchId: string,
  roundNumber: number,
): Promise<StoredRoundSubmission | null> {
  return db.prepare(`
    SELECT
      round_number AS roundNumber,
      scenario_id AS scenarioId,
      rule_result_json AS ruleResultJson
    FROM lab_round_submissions
    WHERE branch_id = ? AND round_number = ?
    LIMIT 1
  `).bind(branchId, roundNumber).first<StoredRoundSubmission>();
}

export type CommitRoundRecords = {
  branchId: string;
  expectedCurrentRoundNumber: number;
  expectedLockVersion: number;
  nextRoundNumber: number;
  nextWeek: number;
  branchStatus: "active" | "completed" | "failed";
  outcomeClassification: string | null;
  submissionId: string;
  scenarioId: string;
  submissionJson: string;
  reasoningJson: string;
  ruleResultJson: string;
  idempotencyKey: string;
  snapshotId: string;
  stateJson: string;
  stateHash: string;
  eventId: string;
  eventPayloadJson: string;
  documentDeltas: Array<{
    id: string;
    documentId: string;
    patchJson: string;
    reason: string;
  }>;
};

export async function commitRoundRecords(db: LabD1, records: CommitRoundRecords): Promise<void> {
  const statements = [
    db.prepare(`
      UPDATE lab_branches
      SET
        current_week = ?,
        current_round_number = ?,
        lock_version = lock_version + 1,
        status = ?,
        outcome_classification = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND current_round_number = ? AND lock_version = ? AND status = 'active'
    `).bind(
      records.nextWeek,
      records.nextRoundNumber,
      records.branchStatus,
      records.outcomeClassification,
      records.branchId,
      records.expectedCurrentRoundNumber,
      records.expectedLockVersion,
    ),
    db.prepare(`
      INSERT INTO lab_round_submissions (
        id, branch_id, round_number, scenario_id, submission_json,
        reasoning_json, rule_result_json, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      records.submissionId,
      records.branchId,
      records.nextRoundNumber,
      records.scenarioId,
      records.submissionJson,
      records.reasoningJson,
      records.ruleResultJson,
      records.idempotencyKey,
    ),
    db.prepare(`
      INSERT INTO lab_state_snapshots (
        id, branch_id, round_number, week, scenario_id, state_json, state_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      records.snapshotId,
      records.branchId,
      records.nextRoundNumber,
      records.nextWeek,
      records.scenarioId,
      records.stateJson,
      records.stateHash,
    ),
    db.prepare(`
      INSERT INTO lab_events (
        id, branch_id, round_number, week, event_type, payload_json, visibility
      ) VALUES (?, ?, ?, ?, 'round_settled', ?, 'user')
    `).bind(
      records.eventId,
      records.branchId,
      records.nextRoundNumber,
      records.nextWeek,
      records.eventPayloadJson,
    ),
    db.prepare(`
      DELETE FROM lab_round_drafts
      WHERE branch_id = ? AND round_number = ?
    `).bind(records.branchId, records.nextRoundNumber),
    ...records.documentDeltas.map((delta) => db.prepare(`
      INSERT INTO lab_document_deltas (
        id, branch_id, round_number, document_id, week, patch_json, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      delta.id,
      records.branchId,
      records.nextRoundNumber,
      delta.documentId,
      records.nextWeek,
      delta.patchJson,
      delta.reason,
    )),
  ];
  await db.batch(statements);
}
