import { saveStudioEquipment } from "@/app/admin/equipment-actions";
import { ActionForm } from "@/components/action-form";
import { PortalTitle } from "@/components/portal";
import { Badge, Check, Field, Notice, Select } from "@/components/ui";
import { CONTENT, money } from "@/lib/model";
import { EQUIPMENT_KINDS, equipmentImage, equipmentName, readEquipment, type StudioEquipment } from "@/lib/studio-equipment";
import { requireStaff } from "@/lib/supabase";

function EquipmentForm({ item }: { item?: StudioEquipment }) {
  return <ActionForm action={saveStudioEquipment} submit={item ? "Save equipment" : "Add equipment"}>
    <input type="hidden" name="id" value={item?.id ?? ""} />
    {item ? <><input type="hidden" name="kind" value={item.kind} /><p className="small muted">{EQUIPMENT_KINDS[item.kind]}</p></>
      : <Select name="kind" label="Category">
      {Object.entries(EQUIPMENT_KINDS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
    </Select>}
    <div className="form-grid">
      <Field name="brand" label="Brand" required maxLength={45} defaultValue={item?.brand} placeholder="e.g. Wavlink" />
      <Field name="model" label="Model" required maxLength={65} defaultValue={item?.model} />
      <Field name="price" label="Unit price in naira" type="number" min={0} max={50_000_000} step=".01"
        defaultValue={item?.price_kobo == null ? "" : item.price_kobo/100} hint="Blank shows Quote required." />
      <Field name="radius" label="AP planning radius (m)" type="number" min={20} max={600} defaultValue={item?.radius_m ?? undefined}
        hint="For outdoor access points. Use a documented or surveyed value." />
      <Field name="watts" label="Inverter continuous watts" type="number" min={500} max={50_000} defaultValue={item?.watts ?? undefined} />
      <Field name="surge" label="Inverter surge watts" type="number" min={500} max={100_000} defaultValue={item?.surge_watts ?? undefined} />
      <Select name="voltage" label="Inverter DC battery voltage" defaultValue={item?.voltage ?? ""}>
        <option value="">Select voltage</option><option value={24}>24 V</option><option value={48}>48 V</option>
      </Select>
      <Field name="image" label="Product photo (optional)" type="file" accept="image/jpeg,image/png,image/webp" hint="Up to 2 MB." />
    </div>
    <Check name="active" defaultChecked={item?.active ?? true}>Show this model in the studio</Check>
  </ActionForm>;
}

export default async function EquipmentAdmin() {
  const { db } = await requireStaff(CONTENT);
  const result = await db.from("studio_equipment").select("*").order("kind").order("brand").order("model");
  const items = readEquipment(result.data);
  return <><PortalTitle title="Studio equipment">Manage product models, photos and per-unit prices for Network Studio and the solar inverter planner.</PortalTitle>
    {result.error && <Notice tone="error">The equipment catalogue could not be loaded.</Notice>}
    <div className="split split-even">
      <section className="panel stack"><h2>Add a product model</h2><EquipmentForm /></section>
      <section className="panel stack"><h2>Catalogue</h2>
        {items.length ? items.map((item) => <details className="fieldset" key={item.id}>
          <summary>{equipmentName(item)} · {item.price_kobo === null ? "Quote required" : money(item.price_kobo)}</summary>
          <div className="stack">
            <Badge tone={item.active ? "green" : "neutral"}>{item.active ? "Available in studio" : "Hidden"}</Badge>
            {equipmentImage(item) && <img className="equipment-thumbnail" src={equipmentImage(item)} alt={equipmentName(item)} loading="lazy" />}
            <EquipmentForm item={item} />
          </div>
        </details>) : <p className="muted">Custom models will appear here.</p>}
      </section>
    </div>
  </>;
}
