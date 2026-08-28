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
  outcomeClassification?: string | null;
};

export type OwnedBranchSummary = OwnedBranch & {
  forkWeek: number;
  scenarioId: string;
  createdAt: string;
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

export type OwnedBranchContext = {
  branch: OwnedBranch;
  events: BranchEvent[];
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

export type StoredBranchPathRound = StoredStateSnapshot & {
  ruleResultJson: string | null;
  submittedAt: string | null;
};

export type StoredRoundSubmission = {
  roundNumber: number;
  scenarioId: string;
  ruleResultJson: string;
};

export type StoredActionChainSubmission = {
  roundNumber: number;
  submissionJson: string;
};

export type StoredDocumentDelta = {
  documentId: string;
  roundNumber: number;
  week: number;
  patchJson: string;
  reason: string;
};

export type StoredAiReview = { status: string; reviewJson: string | null; stateHash: string; errorCode: string | null };

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
      , b.outcome_classification AS outcomeClassification
    FROM lab_branches b
    INNER JOIN lab_users u ON u.id = b.user_id
    INNER JOIN lab_case_versions cv
      ON cv.case_id = b.case_id AND cv.case_version = b.case_version
    WHERE b.id = ? AND u.identity_key = ?
    LIMIT 1
  `).bind(branchId, identityKey).first<OwnedBranch>();
}

export async function listOwnedBranches(
  db: LabD1,
  identityKey: string,
  caseId: string,
  caseVersion: string,
): Promise<OwnedBranchSummary[]> {
  const result = await db.prepare(`
    SELECT
      b.id,
      b.case_id AS caseId,
      b.case_version AS caseVersion,
      cv.content_hash AS contentHash,
      b.fork_week AS forkWeek,
      b.current_week AS currentWeek,
      b.current_round_number AS currentRoundNumber,
      b.lock_version AS lockVersion,
      b.status,
      b.outcome_classification AS outcomeClassification,
      initial.scenario_id AS scenarioId,
      b.created_at AS createdAt
    FROM lab_branches b
    INNER JOIN lab_users u ON u.id = b.user_id
    INNER JOIN lab_case_versions cv
      ON cv.case_id = b.case_id AND cv.case_version = b.case_version
    INNER JOIN lab_state_snapshots initial
      ON initial.branch_id = b.id AND initial.round_number = b.fork_round_number
    WHERE u.identity_key = ? AND b.case_id = ? AND b.case_version = ? AND b.status <> 'archived'
    ORDER BY b.created_at DESC, b.id DESC
  `).bind(identityKey, caseId, caseVersion).all<OwnedBranchSummary>();
  return result.results ?? [];
}

export async function listOwnedCaseBranches(
  db: LabD1,
  identityKey: string,
  caseId: string,
): Promise<OwnedBranchSummary[]> {
  const result = await db.prepare(`
    SELECT
      b.id,
      b.case_id AS caseId,
      b.case_version AS caseVersion,
      cv.content_hash AS contentHash,
      b.fork_week AS forkWeek,
      b.current_week AS currentWeek,
      b.current_round_number AS currentRoundNumber,
      b.lock_version AS lockVersion,
      b.status,
      b.outcome_classification AS outcomeClassification,
      initial.scenario_id AS scenarioId,
      b.created_at AS createdAt
    FROM lab_branches b
    INNER JOIN lab_users u ON u.id = b.user_id
    INNER JOIN lab_case_versions cv
      ON cv.case_id = b.case_id AND cv.case_version = b.case_version
    INNER JOIN lab_state_snapshots initial
      ON initial.branch_id = b.id AND initial.round_number = b.fork_round_number
    WHERE u.identity_key = ? AND b.case_id = ? AND b.status <> 'archived'
    ORDER BY b.created_at DESC, b.id DESC
  `).bind(identityKey, caseId).all<OwnedBranchSummary>();
  return result.results ?? [];
}

export async function readOwnedBranchContext(
  db: LabD1,
  branchId: string,
  identityKey: string,
): Promise<OwnedBranchContext | null> {
  const result = await db.prepare(`
    SELECT
      b.id,
      b.case_id AS caseId,
      b.case_version AS caseVersion,
      cv.content_hash AS contentHash,
      b.current_week AS currentWeek,
      b.current_round_number AS currentRoundNumber,
      b.lock_version AS lockVersion,
      b.status,
      b.outcome_classification AS outcomeClassification,
      e.event_type AS eventType,
      e.payload_json AS payloadJson
    FROM lab_branches b
    INNER JOIN lab_users u ON u.id = b.user_id
    INNER JOIN lab_case_versions cv
      ON cv.case_id = b.case_id AND cv.case_version = b.case_version
    LEFT JOIN lab_events e
      ON e.branch_id = b.id
      AND e.week <= b.current_week
      AND e.visibility = 'user'
      AND e.event_type IN ('scenario_started', 'scenario_material_viewed', 'scenario_cards_unlocked')
    WHERE b.id = ? AND u.identity_key = ?
    ORDER BY e.week ASC, e.created_at ASC
  `).bind(branchId, identityKey).all<OwnedBranch & { eventType: string | null; payloadJson: string | null }>();
  const rows = result.results ?? [];
  const first = rows[0];
  if (!first) return null;
  return {
    branch: {
      id: first.id,
      caseId: first.caseId,
      caseVersion: first.caseVersion,
      contentHash: first.contentHash,
      currentWeek: first.currentWeek,
      currentRoundNumber: first.currentRoundNumber,
      lockVersion: first.lockVersion,
      status: first.status,
      outcomeClassification: first.outcomeClassification,
    },
    events: rows.flatMap((row) => row.eventType && row.payloadJson
      ? [{ eventType: row.eventType, payloadJson: row.payloadJson }]
      : []),
  };
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

export async function readBranchPathRounds(db: LabD1, branchId: string): Promise<StoredBranchPathRound[]> {
  const result = await db.prepare(`
    SELECT
      snapshots.round_number AS roundNumber,
      snapshots.week,
      snapshots.scenario_id AS scenarioId,
      snapshots.state_json AS stateJson,
      snapshots.state_hash AS stateHash,
      submissions.rule_result_json AS ruleResultJson,
      submissions.submitted_at AS submittedAt
    FROM lab_state_snapshots snapshots
    LEFT JOIN lab_round_submissions submissions
      ON submissions.branch_id = snapshots.branch_id
      AND submissions.round_number = snapshots.round_number
    WHERE snapshots.branch_id = ?
    ORDER BY snapshots.round_number ASC
  `).bind(branchId).all<StoredBranchPathRound>();
  return result.results ?? [];
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

export async function readScenarioActionChainSubmissions(
  db: LabD1,
  branchId: string,
  scenarioId: string,
): Promise<StoredActionChainSubmission[]> {
  const result = await db.prepare(`
    SELECT
      round_number AS roundNumber,
      submission_json AS submissionJson
    FROM lab_round_submissions
    WHERE branch_id = ? AND scenario_id = ?
    ORDER BY round_number ASC
  `).bind(branchId, scenarioId).all<StoredActionChainSubmission>();
  return result.results ?? [];
}

export async function readDocumentDeltas(db: LabD1, branchId: string, documentId?: string): Promise<StoredDocumentDelta[]> {
  const clause = documentId ? "AND document_id = ?" : "";
  const statement = db.prepare(`
    SELECT document_id AS documentId, round_number AS roundNumber, week, patch_json AS patchJson, reason
    FROM lab_document_deltas WHERE branch_id = ? ${clause}
    ORDER BY round_number ASC, document_id ASC
  `);
  const result = documentId
    ? await statement.bind(branchId, documentId).all<StoredDocumentDelta>()
    : await statement.bind(branchId).all<StoredDocumentDelta>();
  return result.results ?? [];
}

export async function readAiReview(db: LabD1, branchId: string, stateHash: string): Promise<StoredAiReview | null> {
  return db.prepare(`SELECT status, review_json AS reviewJson, state_hash AS stateHash, error_code AS errorCode FROM lab_ai_reviews WHERE branch_id = ? AND review_kind = 'scenario' AND state_hash = ? AND prompt_version = 'v1' LIMIT 1`).bind(branchId, stateHash).first<StoredAiReview>();
}

export async function saveAiReview(db: LabD1, record: { id: string; branchId: string; scenarioId: string; stateHash: string; status: "completed" | "failed"; reviewJson: string | null; errorCode: string | null }): Promise<void> {
  await db.prepare(`INSERT INTO lab_ai_reviews (id, branch_id, scenario_id, review_kind, status, state_hash, review_json, model_ref, prompt_version, error_code) VALUES (?, ?, ?, 'scenario', ?, ?, ?, 'deepseek-chat', 'v1', ?) ON CONFLICT(branch_id, review_kind, scenario_id, state_hash, prompt_version) DO UPDATE SET status = excluded.status, review_json = excluded.review_json, error_code = excluded.error_code, updated_at = CURRENT_TIMESTAMP`).bind(record.id, record.branchId, record.scenarioId, record.status, record.stateHash, record.reviewJson, record.errorCode).run();
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
