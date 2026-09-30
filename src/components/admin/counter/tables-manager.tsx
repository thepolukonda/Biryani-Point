'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { removeTable, saveTable } from '@/app/admin/_actions/counter';
import type { FormState } from '@/app/admin/_actions/settings';
import { useForm } from '../settings/shared';
import { Card, Check, FormMessage, inputClass, Labeled, SubmitButton } from '../ui';
import type { DiningTable } from '../orders-board';

/** Owner page: add, rename, pause or remove the restaurant's tables. */
export function TablesManager({ tables, busy }: { tables: DiningTable[]; busy: string[] }) {
  const nextOrder = tables.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1;
  // Shown above the list: the removed table's own row is gone by the time it arrives.
  const [removed, setRemoved] = useState<FormState>({});
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Tables</h1>
        <p className="text-muted">
          Tables appear on the Orders page, where staff start and close table orders. A paused table
          is hidden there; a removed table keeps its name on past orders.
        </p>
      </div>
      <Card title="Add a table">
        <TableForm next={nextOrder} />
      </Card>
      <Card
        title={`Your tables (${tables.length})`}
        description="Tables are shown in this order (lowest number first)."
      >
        <FormMessage state={removed} />
        {tables.length === 0 ? (
          <p className="text-muted">No tables yet. Add the first one above.</p>
        ) : (
          <ul className="grid gap-2">
            {tables.map((t) => (
              <li key={t.id} className="bg-soft rounded-xl p-3">
                <TableForm
                  table={t}
                  busy={busy.includes(t.id)}
                  next={nextOrder}
                  onRemoved={setRemoved}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TableForm({
  table,
  busy = false,
  next,
  onRemoved,
}: {
  table?: DiningTable;
  busy?: boolean;
  next: number;
  onRemoved?: (state: FormState) => void;
}) {
  const [state, action, pending] = useForm(saveTable);
  const [removing, start] = useTransition();
  const [removeState, setRemoveState] = useState<FormState>({});
  const formRef = useRef<HTMLFormElement>(null);
  // After adding a table, clear the form for the next one (the message stays).
  useEffect(() => {
    if (state.ok && !table) formRef.current?.reset();
  }, [state, table]);
  return (
    <form ref={formRef} action={action} className="grid gap-3">
      {table && <input type="hidden" name="id" value={table.id} />}
      <div className="grid items-end gap-3 sm:grid-cols-[1.2fr_0.6fr_1fr_0.6fr_auto]">
        <Labeled label="Name *" hint="e.g. 4, T4 or Window">
          <input
            name="name"
            defaultValue={table?.name ?? ''}
            required
            maxLength={40}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Seats">
          <input
            name="seats"
            type="number"
            min={1}
            max={50}
            defaultValue={table?.seats ?? 4}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Area" hint="Optional, e.g. Terrace">
          <input
            name="area"
            defaultValue={table?.area ?? ''}
            maxLength={40}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Order">
          <input
            name="sort_order"
            type="number"
            min={0}
            max={9999}
            defaultValue={table?.sort_order ?? next}
            className={inputClass}
          />
        </Labeled>
        <Check
          name="is_active"
          defaultChecked={table?.is_active ?? true}
          label="In use"
          className="pb-0.5"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pending={pending}>{table ? 'Save' : 'Add table'}</SubmitButton>
        {table && (
          <button
            type="button"
            disabled={removing || busy}
            title={busy ? 'This table has an open order' : undefined}
            onClick={() => {
              if (!window.confirm(`Remove table ${table.name}?`)) return;
              start(async () => {
                const result = await removeTable(table.id);
                if (result.ok) onRemoved?.(result);
                else setRemoveState(result);
              });
            }}
            className="text-danger min-h-11 rounded-md px-3 font-semibold disabled:opacity-50"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        )}
        {busy && <span className="text-gold-text text-sm font-semibold">Open order now</span>}
      </div>
      <FormMessage state={removeState.error ? removeState : state} />
    </form>
  );
}
