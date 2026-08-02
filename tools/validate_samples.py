#!/usr/bin/env python3
"""Validate the connected project-charter and risk-register samples."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(relative: str):
    with (ROOT / relative).open("r", encoding="utf-8") as handle:
        return json.load(handle)


errors: list[str] = []
checks = 0


def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


interview = load("samples/car-control-app/interview.json")
tree = load("samples/car-control-app/reasoning-tree.json")
charter_schema = load("schemas/project-charter.schema.json")
charter = load("samples/car-control-app/project-charter.json")
risk_schema = load("schemas/risk-register.schema.json")
rules = load("schemas/risk-scoring-rules.json")
register = load("samples/car-control-app/risk-register.json")
stakeholder_schema = load("schemas/stakeholder-register.schema.json")
stakeholder_register = load("samples/car-control-app/stakeholder-register.json")

# Common project identity.
project_ids = {
    interview["projectId"],
    tree["projectId"],
    charter["projectId"],
    register["projectId"],
    stakeholder_register["projectId"],
}
check(len(project_ids) == 1, f"Project ids do not agree: {sorted(project_ids)}")
check(charter["templateId"] == charter_schema["id"], "Charter template id does not match schema")
check(register["templateId"] == risk_schema["id"], "Risk register template id does not match schema")
check(register["scoringRulesRef"] == rules["id"], "Risk scoring rule id does not match")
check(
    stakeholder_register["templateId"] == stakeholder_schema["id"],
    "Stakeholder register template id does not match schema",
)

# Interview and reasoning graph integrity.
answer_ids = [answer["id"] for answer in interview["answers"]]
open_ids = [item["id"] for item in interview["openQuestions"]]
node_ids = [node["id"] for node in tree["nodes"]]
check(len(answer_ids) == len(set(answer_ids)), "Interview answer ids are not unique")
check(len(open_ids) == len(set(open_ids)), "Open-question ids are not unique")
check(len(node_ids) == len(set(node_ids)), "Reasoning node ids are not unique")
check(tree["rootNodeId"] in set(node_ids), "Reasoning root node does not exist")

known_fact_sources = set(answer_ids) | set(open_ids) | set(node_ids)
for edge in tree["edges"]:
    check(edge["from"] in set(node_ids), f"Reasoning edge has missing source node: {edge}")
    check(edge["to"] in set(node_ids), f"Reasoning edge has missing target node: {edge}")
for node in tree["nodes"]:
    for source_id in node.get("sourceIds", []):
        check(source_id in known_fact_sources, f"Node {node['id']} has unknown source {source_id}")
for binding in tree["autofillBindings"]:
    for source_id in binding["sourceIds"]:
        check(source_id in known_fact_sources, f"Binding {binding['targetField']} has unknown source {source_id}")

# Charter completeness and traceability.
schema_field_ids = {
    field["id"]
    for section in charter_schema["sections"]
    for field in section["fields"]
}
instance_field_ids = set(charter["fields"])
check(instance_field_ids == schema_field_ids, "Charter instance fields differ from schema fields")
allowed_statuses = set(charter_schema["valueEnvelope"]["statusEnum"])
for field_id, envelope in charter["fields"].items():
    check(envelope["status"] in allowed_statuses, f"Charter field {field_id} has invalid status")
    for source_id in envelope.get("sourceIds", []):
        is_external_ref = source_id.startswith(("note.", "domain.", "system.", "risk-register."))
        check(source_id in known_fact_sources or is_external_ref, f"Charter field {field_id} has unknown source {source_id}")

check(charter["validation"]["canExportDraft"] is True, "Charter draft should be exportable")
check(charter["validation"]["canApprove"] is False, "Charter must not be approvable while blockers remain")
check(charter["fields"]["approved_budget_total"]["status"] == "missing", "Budget must remain missing")
check(charter["fields"]["project_manager"]["status"] == "missing", "Project manager must remain missing")
check(charter["fields"]["sponsor"]["status"] != "confirmed", "Sponsor identity must not be presented as confirmed")
for trace in charter["autofillTrace"]:
    for fact_id in trace.get("inputFacts", []):
        check(fact_id in known_fact_sources, f"Autofill trace has unknown fact {fact_id}")
    for reasoning_id in trace.get("reasoningIds", []):
        check(reasoning_id in set(node_ids), f"Autofill trace has unknown reasoning node {reasoning_id}")

# Risk scoring, matrix and summary.
dimensions = rules["impactDimensions"]
thresholds = rules["calculations"]["ratingThresholds"]
minimum_rating = rules["calculations"]["safetyComplianceFloor"]["minimumRating"]
rating_rank = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}


def base_rating(score: int) -> str:
    for threshold in thresholds:
        if threshold["min"] <= score <= threshold["max"]:
            return threshold["rating"]
    raise ValueError(f"Score outside configured range: {score}")


def derived(probability: int, impacts: dict[str, int]) -> tuple[int, int, str]:
    impact = max(impacts[dimension] for dimension in dimensions)
    score = probability * impact
    rating = base_rating(score)
    if impacts["safety"] == 5 or impacts["compliance"] == 5:
        if rating_rank[rating] < rating_rank[minimum_rating]:
            rating = minimum_rating
    return impact, score, rating


matrix_rows = {row["probability"]: row for row in rules["matrix"]["rows"]}
for probability, row in matrix_rows.items():
    for impact, configured_rating in enumerate(row["cells"], start=1):
        check(configured_rating == base_rating(probability * impact), f"Matrix mismatch at P={probability}, I={impact}")

risk_ids = [risk["id"] for risk in register["risks"]]
check(len(risk_ids) == len(set(risk_ids)), "Risk ids are not unique")
inherent_counts: Counter[str] = Counter()
residual_counts: Counter[str] = Counter()
type_counts: Counter[str] = Counter()
for risk in register["risks"]:
    type_counts[risk["riskType"]] += 1
    for dimension in dimensions:
        check(dimension in risk["impacts"], f"{risk['id']} lacks inherent impact {dimension}")
        check(dimension in risk["residualImpacts"], f"{risk['id']} lacks residual impact {dimension}")
    impact, score, rating = derived(risk["probability"], risk["impacts"])
    check(risk["overallImpact"] == impact, f"{risk['id']} inherent overall impact is incorrect")
    check(risk["baseScore"] == score, f"{risk['id']} inherent score is incorrect")
    check(risk["rating"] == rating, f"{risk['id']} inherent rating is incorrect")
    residual_impact, residual_score, residual_rating = derived(risk["residualProbability"], risk["residualImpacts"])
    check(risk["residualOverallImpact"] == residual_impact, f"{risk['id']} residual overall impact is incorrect")
    check(risk["residualScore"] == residual_score, f"{risk['id']} residual score is incorrect")
    check(risk["residualRating"] == residual_rating, f"{risk['id']} residual rating is incorrect")
    if rating in {"High", "Critical"}:
        check(bool(risk.get("ownerRole")), f"{risk['id']} high risk lacks owner")
        check(bool(risk.get("responseActions")), f"{risk['id']} high risk lacks response actions")
        check(bool(risk.get("dueDate")), f"{risk['id']} high risk lacks due date")
    if risk["riskType"] == "threat" and (
        risk["residualProbability"] > risk["probability"]
        or residual_impact > impact
    ):
        check(bool(risk.get("residualExplanation")), f"{risk['id']} increased threat lacks explanation")
    if risk["riskType"] == "opportunity" and residual_score > score:
        check(bool(risk.get("residualExplanation")), f"{risk['id']} enhanced opportunity lacks explanation")
    for source_id in risk.get("sourceIds", []):
        check(source_id in known_fact_sources, f"{risk['id']} has unknown source {source_id}")
    inherent_counts[rating] += 1
    residual_counts[residual_rating] += 1

check(register["summary"]["threatCount"] == type_counts["threat"], "Threat summary count is incorrect")
check(register["summary"]["opportunityCount"] == type_counts["opportunity"], "Opportunity summary count is incorrect")
for rating in rating_rank:
    check(register["summary"]["inherentRatings"][rating] == inherent_counts[rating], f"Inherent {rating} summary is incorrect")
    check(register["summary"]["residualRatings"][rating] == residual_counts[rating], f"Residual {rating} summary is incorrect")

# Stakeholder register, power-interest quadrant and engagement matrix.
stakeholder_ids = [item["id"] for item in stakeholder_register["stakeholders"]]
check(len(stakeholder_ids) == len(set(stakeholder_ids)), "Stakeholder ids are not unique")
engagement_order = {
    item["id"]: item["order"]
    for item in stakeholder_schema["engagementLevels"]
}
quadrant_counts: Counter[str] = Counter()
internal_external_counts: Counter[str] = Counter()
engagement_gap_count = 0


def stakeholder_quadrant(power: int, interest: int) -> str:
    if power >= 4 and interest >= 4:
        return "manage-closely"
    if power >= 4 and interest <= 3:
        return "keep-satisfied"
    if power <= 3 and interest >= 4:
        return "keep-informed"
    return "monitor"


stakeholder_sources = known_fact_sources | set(risk_ids)
for stakeholder in stakeholder_register["stakeholders"]:
    check(1 <= stakeholder["power"] <= 5, f"{stakeholder['id']} power is outside 1-5")
    check(1 <= stakeholder["interest"] <= 5, f"{stakeholder['id']} interest is outside 1-5")
    expected_quadrant = stakeholder_quadrant(stakeholder["power"], stakeholder["interest"])
    check(stakeholder["quadrant"] == expected_quadrant, f"{stakeholder['id']} quadrant is incorrect")
    check(stakeholder["currentEngagement"] in engagement_order, f"{stakeholder['id']} current engagement is invalid")
    check(stakeholder["desiredEngagement"] in engagement_order, f"{stakeholder['id']} desired engagement is invalid")
    if engagement_order[stakeholder["desiredEngagement"]] > engagement_order[stakeholder["currentEngagement"]]:
        engagement_gap_count += 1
        check(bool(stakeholder["strategy"]), f"{stakeholder['id']} engagement gap lacks strategy")
    for source_id in stakeholder["sourceIds"]:
        is_artifact_ref = source_id.startswith(("project-charter.", "DEL-"))
        check(
            source_id in stakeholder_sources or is_artifact_ref,
            f"{stakeholder['id']} has unknown source {source_id}",
        )
    quadrant_counts[stakeholder["quadrant"]] += 1
    internal_external_counts[stakeholder["internalExternal"]] += 1

stakeholder_summary = stakeholder_register["summary"]
check(stakeholder_summary["total"] == len(stakeholder_ids), "Stakeholder total summary is incorrect")
check(stakeholder_summary["internal"] == internal_external_counts["internal"], "Internal stakeholder summary is incorrect")
check(stakeholder_summary["external"] == internal_external_counts["external"], "External stakeholder summary is incorrect")
for quadrant_id in {rule["id"] for rule in stakeholder_schema["quadrantRules"]}:
    check(
        stakeholder_summary["quadrants"][quadrant_id] == quadrant_counts[quadrant_id],
        f"Stakeholder quadrant {quadrant_id} summary is incorrect",
    )
check(stakeholder_summary["engagementGapCount"] == engagement_gap_count, "Engagement gap summary is incorrect")

# Charter top-risk references resolve to the register.
register_ids = set(risk_ids)
charter_risk_ids = {
    risk["riskId"] for risk in charter["fields"]["overall_risk_summary"]["value"]
}
check(charter_risk_ids <= register_ids, f"Charter references unknown risks: {sorted(charter_risk_ids - register_ids)}")

if errors:
    print(f"FAILED: {len(errors)} error(s) across {checks} checks")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"PASS: {checks} checks")
print(f"Project: {next(iter(project_ids))}")
print(f"Interview answers: {len(answer_ids)}; reasoning nodes: {len(node_ids)}; edges: {len(tree['edges'])}")
print(f"Charter fields: {len(instance_field_ids)}; approval blockers: {len(charter['validation']['blockingIssues'])}")
print(f"Risks: {len(risk_ids)}; inherent={dict(inherent_counts)}; residual={dict(residual_counts)}")
print(f"Stakeholders: {len(stakeholder_ids)}; quadrants={dict(quadrant_counts)}; engagement gaps={engagement_gap_count}")
