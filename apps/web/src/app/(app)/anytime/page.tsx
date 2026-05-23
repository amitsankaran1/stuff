import { TaskList } from '@/components/task-list';
import { ViewHeader } from '@/components/view-header';

export default function AnytimePage() {
  return (
    <>
      <ViewHeader title="Anytime" />
      <TaskList view="anytime" />
    </>
  );
}
