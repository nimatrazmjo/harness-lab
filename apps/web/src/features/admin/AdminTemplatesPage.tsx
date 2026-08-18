import { useEffect, useState, type FormEvent } from "react";
import type { Template } from "@scribe/shared-types";
import { templatesApi } from "../../api/templates";

const EMPTY_FORM = { name: "", encounterType: "", promptInstructions: "" };

export function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    templatesApi.listActive().then(setTemplates).catch(() => setError("Could not load templates."));
  }

  useEffect(load, []);

  function onEdit(template: Template) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      encounterType: template.encounterType,
      promptInstructions: template.promptInstructions,
    });
  }

  function onCancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await templatesApi.update(editingId, form);
      } else {
        await templatesApi.create(form);
      }
      onCancelEdit();
      load();
    } catch {
      setError("Could not save this template.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await templatesApi.remove(id);
      if (editingId === id) onCancelEdit();
      load();
    } catch {
      setError("Could not delete this template.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h2>Templates</h2>
      <form className="admin-inline-form admin-inline-form--stacked" onSubmit={onSubmit}>
        <label htmlFor="tpl-name">Name</label>
        <input
          id="tpl-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <label htmlFor="tpl-type">Encounter type</label>
        <input
          id="tpl-type"
          value={form.encounterType}
          onChange={(e) => setForm({ ...form, encounterType: e.target.value })}
          required
        />
        <label htmlFor="tpl-instructions">Prompt instructions</label>
        <textarea
          id="tpl-instructions"
          value={form.promptInstructions}
          onChange={(e) => setForm({ ...form, promptInstructions: e.target.value })}
          required
          rows={4}
        />
        <div className="admin-inline-form__actions">
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create template"}
          </button>
          {editingId && (
            <button type="button" onClick={onCancelEdit} disabled={saving}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Encounter type</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.encounterType}</td>
              <td>
                <button type="button" onClick={() => onEdit(t)}>
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(t.id)} disabled={busyId === t.id}>
                  {busyId === t.id ? "Deleting..." : "Delete"}
                </button>
              </td>
            </tr>
          ))}
          {templates.length === 0 && (
            <tr>
              <td colSpan={3} className="admin-table__empty">
                No templates yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
