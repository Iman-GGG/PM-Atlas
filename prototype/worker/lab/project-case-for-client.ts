import type {
  EventMaterial,
  EventMaterials,
  PublicScenarioCard,
  VisibleScenarioProjection,
} from "../../lib/lab/contracts";
import { privateLabCasePackage } from "../generated/lab-case-private.generated";

export type ScenarioVisibilityContext = {
  scenarioId: string;
  currentWeek: number;
  visibleMaterialIds: readonly string[];
  cardsUnlocked: boolean;
};

function filterMaterials(materials: EventMaterial[], visibleMaterialIds: Set<string>): EventMaterial[] {
  return materials.filter((material) => visibleMaterialIds.has(material.id));
}

function toPublicCard(card: {
  id: string;
  column: PublicScenarioCard["column"];
  referenceId: string;
  title: string;
}): PublicScenarioCard {
  return {
    id: card.id,
    column: card.column,
    referenceId: card.referenceId,
    title: card.title,
  };
}

export function projectScenarioForClient(context: ScenarioVisibilityContext): VisibleScenarioProjection | null {
  const scenario = privateLabCasePackage.sourceFiles.scenarioPlan.scenarios.find(({ id }) => id === context.scenarioId);
  if (!scenario || context.currentWeek < scenario.week) return null;

  const visibleMaterialIds = new Set(context.visibleMaterialIds);
  const eventMaterials: EventMaterials = {
    primaryClues: filterMaterials(scenario.eventMaterials.primaryClues, visibleMaterialIds),
    corroboratingClues: filterMaterials(scenario.eventMaterials.corroboratingClues, visibleMaterialIds),
    dashboardAnomalies: filterMaterials(scenario.eventMaterials.dashboardAnomalies, visibleMaterialIds),
  };

  return {
    id: scenario.id,
    week: scenario.week,
    title: scenario.title,
    eventMaterials,
    cards: context.cardsUnlocked ? scenario.cards.map(toPublicCard) : [],
  };
}
