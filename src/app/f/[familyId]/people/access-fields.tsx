"use client";

import { useState } from "react";
import {
  AREA_LABEL,
  CARE_AREAS,
  HELPER_PRESETS,
  ROLE_HINT,
  ROLE_LABEL,
  ROLES,
  normalizeAreas,
  type CareArea,
  type Role,
} from "@/lib/access";
import styles from "./people.module.css";

type Props = {
  idPrefix: string;
  role?: Role;
  helperLabel?: string | null;
  view?: CareArea[];
  edit?: CareArea[];
};

/** Choose a role, and for helpers, exactly what they can see and change. */
export function AccessFields({ idPrefix, role: initialRole = "family", helperLabel = "", view = [], edit = [] }: Props) {
  const [role, setRole] = useState<Role>(initialRole);
  const [label, setLabel] = useState(helperLabel ?? "");
  const [areas, setAreas] = useState(() => normalizeAreas(view, edit));

  const toggle = (kind: "view" | "edit", area: CareArea, on: boolean) => {
    const nextView = kind === "view" ? (on ? [...areas.view, area] : areas.view.filter((a) => a !== area)) : areas.view;
    const nextEdit =
      kind === "edit"
        ? on
          ? [...areas.edit, area]
          : areas.edit.filter((a) => a !== area)
        : on
          ? areas.edit
          : areas.edit.filter((a) => a !== area); // unseeing an area also stops changing it
    setAreas(normalizeAreas(nextView, nextEdit));
  };

  return (
    <>
      <fieldset className="field">
        <legend>What they can do</legend>
        {ROLES.map((r) => (
          <label key={r} className="choice">
            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
            <span>
              <b>{ROLE_LABEL[r]}</b>
              <br />
              <span className="muted small">{ROLE_HINT[r]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {role === "helper" ? (
        <div className={styles.helper}>
          <div className="field">
            <span className="muted small">Start from</span>
            <div className="actions">
              {HELPER_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn small"
                  aria-pressed={label === p.label}
                  onClick={() => {
                    setLabel(p.label);
                    setAreas(normalizeAreas(p.view, p.edit));
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-label`}>Their role in the care team</label>
            <input
              id={`${idPrefix}-label`}
              name="helperLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              placeholder="Home nurse, speech therapist, sitter"
            />
          </div>
          <table className={styles.areas}>
            <thead>
              <tr>
                <th scope="col">Part of the app</th>
                <th scope="col">Can see</th>
                <th scope="col">Can add and change</th>
              </tr>
            </thead>
            <tbody>
              {CARE_AREAS.map((a) => (
                <tr key={a}>
                  <th scope="row">{AREA_LABEL[a]}</th>
                  <td>
                    <input
                      type="checkbox"
                      name="view"
                      value={a}
                      aria-label={`See ${AREA_LABEL[a]}`}
                      checked={areas.view.includes(a)}
                      onChange={(e) => toggle("view", a, e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      name="edit"
                      value={a}
                      aria-label={`Add and change ${AREA_LABEL[a]}`}
                      checked={areas.edit.includes(a)}
                      onChange={(e) => toggle("edit", a, e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
