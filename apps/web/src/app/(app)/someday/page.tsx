import { TaskList } from '@/components/task-list';
import { ViewHeader } from '@/components/view-header';

export default function SomedayPage() {
  return (
    <>
      <ViewHeader title="Someday" />
      <TaskList view="someday" />
    </>
  );
}
