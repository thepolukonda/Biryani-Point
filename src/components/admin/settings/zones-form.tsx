'use client';

import { useState, useTransition } from 'react';
import { deleteZone, saveZone } from '@/app/admin/_actions/settings';
import { formatAmount } from '@/lib/domain/money';
import { Card, Check, FormMessage, inputClass, Labeled, SubmitButton } from '../ui';
import { useForm, type SettingsData, type Tables } from './shared';

function ZoneForm({ zone }: { zone?: Tables['delivery_zones']['Row'] }) {
  const [state, action, pending] = useForm(saveZone);
  const [kind, setKind] = useState(zone?.kind ?? 'radius');
  return (
    <form
      action={action}
      className="bg-soft grid gap-3 rounded-lg p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <Labeled label="Name">
        <input
          name="name"
          defaultValue={zone?.name ?? ''}
          required
          placeholder="e.g. City centre"
          className={inputClass}
        />
      </Labeled>
      <Labeled label="Type">
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as 'radius' | 'polygon')}
          className={inputClass}
        >
          <option value="radius">Distance from the restaurant</option>
          <option value="polygon">Area on the map (polygon)</option>
        </select>
      </Labeled>
      {kind === 'radius' ? (
        <Labeled label="Radius (km)">
          <input
            name="radius_km"
            defaultValue={zone?.radius_km ?? 5}
            inputMode="decimal"
            className={inputClass}
          />
        </Labeled>
      ) : (
        <Labeled label="Points" hint="[[41.64, 41.60], [41.66, 41.60], [41.66, 41.63]]">
          <textarea
            name="polygon"
            defaultValue={zone?.polygon ? JSON.stringify(zone.polygon) : ''}
            rows={2}
            className={inputClass}
          />
        </Labeled>
      )}
      <Labeled label="Order" hint="Lower = checked first">
        <input
          name="sort_order"
          type="number"
          defaultValue={zone?.sort_order ?? 0}
          className={inputClass}
        />
      </Labeled>
      <Labeled label="Fee (GEL)" hint="Empty = default fee">
        <input
          name="fee"
          defaultValue={zone?.fee_tetri != null ? formatAmount(zone.fee_tetri) : ''}
          inputMode="decimal"
          className={inputClass}
        />
      </Labeled>
      <Labeled label="Minimum order (GEL)" hint="Empty = default">
        <input
          name="min"
          defaultValue={zone?.min_order_tetri != null ? formatAmount(zone.min_order_tetri) : ''}
          inputMode="decimal"
          className={inputClass}
        />
      </Labeled>
      <Check
        name="is_active"
        label="Active"
        defaultChecked={zone?.is_active ?? true}
        className="self-end"
      />
      <div className="self-end">
        <SubmitButton pending={pending}>{zone ? 'Save zone' : 'Add zone'}</SubmitButton>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ZonesEditor({ data }: { data: SettingsData }) {
  const [removing, start] = useTransition();
  return (
    <Card
      title="Delivery zones"
      description="Checked when a customer shares their location. The first matching zone (lowest order) sets the fee. No zones = deliver anywhere."
    >
      <div className="grid gap-3">
        {data.zones.map((zone) => (
          <div key={zone.id} className="grid gap-2">
            <ZoneForm zone={zone} />
            <button
              type="button"
              disabled={removing}
              onClick={() =>
                window.confirm(`Delete "${zone.name}"?`) &&
                start(async () => void (await deleteZone(zone.id)))
              }
              className="text-danger justify-self-end text-sm font-semibold"
            >
              Delete zone
            </button>
          </div>
        ))}
        <h3 className="mt-2 font-bold">Add a zone</h3>
        <ZoneForm />
      </div>
    </Card>
  );
}
