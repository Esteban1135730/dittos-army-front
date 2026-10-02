import { ownersForTcg, type OwnerKey } from "../../config/owners";
import { currentPanelTcg } from "../../config/routes";
import { useOwner } from "./owner-context";
import { PanelSelect } from "../../components/layout/panel-select";

type OwnerSelectProps = {
  /** Called when user tries to switch owner; return false to abort. */
  onBeforeChange?: (next: OwnerKey) => boolean;
};

export function OwnerSelect({ onBeforeChange }: OwnerSelectProps) {
  const { owner, setOwner } = useOwner();
  const options = ownersForTcg(currentPanelTcg()).map((o) => ({
    value: o.key,
    label: o.label,
  }));

  return (
    <PanelSelect
      id="owner-select-label"
      label="Usuario"
      value={owner}
      options={options}
      onChange={(next) => {
        const ownerKey = next as OwnerKey;
        if (onBeforeChange && !onBeforeChange(ownerKey)) return;
        setOwner(ownerKey);
      }}
    />
  );
}
