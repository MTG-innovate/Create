"use client";

import Link from "next/link";
import { useRef } from "react";
import { Bubble } from "@/components/icons";
import styles from "./diary.module.css";

export type AddItem = { label: string; icon: string; color: string; href: string };

/**
 * The prototype's floating plus button and its "Add a moment" menu: the one
 * place on Home that asks for data.
 */
export function AddMenu({ groups }: { groups: { title: string; items: AddItem[] }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = groups.filter((g) => g.items.length);
  if (!shown.length) return null;

  return (
    <>
      <button className={styles.fab} type="button" aria-label="Add a moment" onClick={() => dialog.current?.showModal()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <dialog ref={dialog} className={styles.sheet} aria-labelledby="add-title" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className={styles.sheetBody}>
          <div className={styles.sheetHead}>
            <h2 id="add-title">Add a moment</h2>
            <button className={styles.close} type="button" aria-label="Close" onClick={() => dialog.current?.close()}>
              ×
            </button>
          </div>
          {shown.map((g) => (
            <section key={g.title}>
              <p className="eyebrow">{g.title}</p>
              <div className={styles.addGrid}>
                {g.items.map((item) => (
                  <Link key={item.label} className={styles.addTile} href={item.href} onClick={() => dialog.current?.close()}>
                    <Bubble name={item.icon} color={item.color} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
