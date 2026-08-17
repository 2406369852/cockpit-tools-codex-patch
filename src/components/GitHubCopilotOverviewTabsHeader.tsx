import { PlatformOverviewTabsHeader, PlatformOverviewTab } from './platform/PlatformOverviewTabsHeader';

export type GitHubCopilotTab = PlatformOverviewTab;

interface GitHubCopilotOverviewTabsHeaderProps {
  active: GitHubCopilotTab;
  onTabChange?: (tab: GitHubCopilotTab) => void;
}

export function GitHubCopilotOverviewTabsHeader({
  active,
  onTabChange,
}: GitHubCopilotOverviewTabsHeaderProps) {
  return (
    <PlatformOverviewTabsHeader
      platform="github-copilot"
      active={active}
      onTabChange={onTabChange}
    />
  );
}
