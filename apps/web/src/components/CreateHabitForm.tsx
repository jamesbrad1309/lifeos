import { useMutation } from "@apollo/client/react";
import { type FormEvent, useState } from "react";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { CREATE_HABIT_MUTATION, DASHBOARD_STATS_QUERY, HABITS_QUERY } from "#graphql/habits";
import { cn } from "#lib/utils";

export function CreateHabitForm({ className }: { className?: string }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [createHabit, { loading }] = useMutation(CREATE_HABIT_MUTATION, {
    refetchQueries: [{ query: HABITS_QUERY }, { query: DASHBOARD_STATS_QUERY }],
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createHabit({
      variables: {
        input: {
          name: name.trim(),
          unit: unit.trim() || undefined,
          schedule: { type: "daily" },
        },
      },
    }).then(() => {
      setName("");
      setUnit("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex gap-2", className)}>
      <Input
        placeholder="New habit (e.g. Read)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
      />
      <Input
        placeholder="unit (optional)"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        className="w-32"
      />
      <Button type="submit" disabled={loading || !name.trim()}>
        Add habit
      </Button>
    </form>
  );
}
