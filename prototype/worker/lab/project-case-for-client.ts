import type {
  EventMaterial,
  EventMaterials,
  PublicScenarioCard,
  ScenarioCard,
  ScenarioDefinition,
  VisibleScenarioProjection,
} from "../../lib/lab/contracts";

export type ScenarioVisibilityContext = {
  scenarioId: string;
  currentWeek: number;
  visibleMaterialIds: readonly string[];
  cardsUnlocked: boolean;
};

function filterMaterials(materials: EventMaterial[], visibleMaterialIds: Set<string>): EventMaterial[] {
  return materials.filter((material) => visibleMaterialIds.has(material.id));
}

function isPublicCard(card: ScenarioCard): card is ScenarioCard & { column: PublicScenarioCard["column"] } {
  return card.column !== "execution_action";
}

function toPublicCard(card: ScenarioCard & { column: PublicScenarioCard["column"] }): PublicScenarioCard {
  return {
    id: card.id,
    column: card.column,
    referenceId: card.referenceId,
    title: card.title,
  };
}

export function projectScenarioForClient(
  scenarios: readonly ScenarioDefinition[],
  context: ScenarioVisibilityContext,
): VisibleScenarioProjection | null {
  const scenario = scenarios.find(({ id }) => id === context.scenarioId);
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
    cards: context.cardsUnlocked ? scenario.cards.filter(isPublicCard).map(toPublicCard) : [],
  };
}
