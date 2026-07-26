"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { MaterialIcon } from "./helpers";

export default function PollCreator({
  onCreate,
  onCancel,
}: {
  onCreate: (question: string, options: string[], multiChoice: boolean) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiChoice, setMultiChoice] = useState(false);

  const addOption = () => {
    if (options.length < 10) setOptions([...options, ""]);
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, value: string) => {
    setOptions(options.map((o, i) => (i === idx ? value : o)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim() || validOptions.length < 2) return;
    onCreate(question.trim(), validOptions, multiChoice);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-2 bg-surface-container rounded-xl p-3 space-y-2"
    >
      <div>
        <label className="block text-label-sm text-on-surface-variant mb-1">
          Pregunta
    </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="¿Qué votamos?"
          className="w-full bg-surface-container-low rounded-xl px-4 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40"
        />
  </div>
      <div className="space-y-1">
        <label className="block text-label-sm text-on-surface-variant mb-1">
          Opciones
    </label>
        {options.map((opt, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Opción ${idx + 1}`}
              className="flex-1 bg-surface-container-low rounded-xl px-4 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant"
              >
                <MaterialIcon name="remove" className="text-lg" />
       </button>
            )}
    </div>
        ))}
        {options.length < 10 && (
          <button
            type="button"
            onClick={addOption}
            className="w-full py-2 text-label-sm text-primary hover:bg-surface-container-high rounded-xl transition-colors"
          >
            <MaterialIcon name="add" className="text-lg mr-1" /> Agregar opción
      </button>
        )}
  </div>
      <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
        <input
          type="checkbox"
          checked={multiChoice}
          onChange={(e) => setMultiChoice(e.target.checked)}
          className="w-4 h-4 accent-primary"
        />
        Permitir múltiples votos
  </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
    </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={
            !question.trim() || options.filter((o) => o.trim()).length < 2
          }
        >
          Crear encuesta
    </Button>
  </div>
</form>
  );
}
