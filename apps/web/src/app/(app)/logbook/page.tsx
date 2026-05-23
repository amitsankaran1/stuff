import { TaskList } from '@/components/task-list';
import { ViewHeader } from '@/components/view-header';

export default function LogbookPage() {
  return (
    <>
      <ViewHeader title="Logbook" />
      <TaskList view="logbook" />
    </>
  );
}
