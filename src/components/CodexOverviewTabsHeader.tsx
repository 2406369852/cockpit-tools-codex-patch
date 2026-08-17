import { PlatformOverviewTabsHeader, PlatformOverviewTab } from './platform/PlatformOverviewTabsHeader';

export type CodexTab = PlatformOverviewTab;

interface CodexOverviewTabsHeaderProps {
  active: CodexTab;
  onTabChange?: (tab: CodexTab) => void;
  tabs?: CodexTab[];
}

export function CodexOverviewTabsHeader({
  active,
  onTabChange,
  tabs,
}: CodexOverviewTabsHeaderProps) {
  return (
    <PlatformOverviewTabsHeader
      platform="codex"
      active={active}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
}
