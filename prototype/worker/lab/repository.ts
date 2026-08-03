export type D1Result<T> = {
  results?: T[];
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
};

export type LabD1 = {
  prepare(query: string): D1PreparedStatement;
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
