import { useMutation } from "@apollo/client/react";
import { Settings } from "lucide-react";
import { useState } from "react";
import { ScheduleEditor } from "#components/ScheduleEditor";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { DASHBOARD_STATS_QUERY, HABITS_QUERY, UPDATE_HABIT_MUTATION } from "#graphql/habits";
import type { Habit, HabitSchedule } from "#graphql/types";

export function EditHabitDialog({ habit }: { habit: Habit }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(habit.name);
  const [unit, setUnit] = useState(habit.unit ?? "");
  const [targetValue, setTargetValue] = useState(habit.targetValue?.toString() ?? "");
  const [startTime, setStartTime] = useState(habit.startTime ?? "");
  const [schedule, setSchedule] = useState<HabitSchedule>(habit.schedule);

  const [updateHabit, { loading }] = useMutation(UPDATE_HABIT_MUTATION, {
    refetchQueries: [{ query: HABITS_QUERY }, { query: DASHBOARD_STATS_QUERY }],
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset the form to the habit's current values each time it's opened,
      // so a cancelled edit never leaves stale draft state for next time.
      setName(habit.name);
      setUnit(habit.unit ?? "");
      setTargetValue(habit.targetValue?.toString() ?? "");
      setStartTime(habit.startTime ?? "");
      setSchedule(habit.schedule);
    }
    setOpen(next);
  }

  async function handleSave() {
    await updateHabit({
      variables: {
        id: habit.id,
        input: {
          name: name.trim() || habit.name,
          unit: unit.trim() || null,
          targetValue: targetValue.trim() === "" ? null : Number(targetValue),
          startTime: startTime === "" ? null : startTime,
          schedule,
        },
      },
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="size-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit habit</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="edit-unit">Unit</Label>
              <Input
                id="edit-unit"
                placeholder="e.g. glasses"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="edit-target">Target</Label>
              <Input
                id="edit-target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-start-time">Start time (for the day calendar)</Label>
            <Input
              id="edit-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <ScheduleEditor value={schedule} onChange={setSchedule} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
