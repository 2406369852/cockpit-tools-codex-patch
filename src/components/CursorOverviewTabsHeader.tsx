import { PlatformOverviewTabsHeader, PlatformOverviewTab } from './platform/PlatformOverviewTabsHeader';

export type CursorTab = PlatformOverviewTab;

interface CursorOverviewTabsHeaderProps {
  active: CursorTab;
  onTabChange?: (tab: CursorTab) => void;
}

export function CursorOverviewTabsHeader({
  active,
  onTabChange,
}: CursorOverviewTabsHeaderProps) {
  return (
    <PlatformOverviewTabsHeader platform="cursor" active={active} onTabChange={onTabChange} />
  );
}
