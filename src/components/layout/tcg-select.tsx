import { PanelSelect } from "./panel-select";
import {
  OWNER_STORAGE_KEY,
  TCG_KEYS,
  TCG_LABELS,
  defaultOwnerForTcg,
  isTcgKey,
} from "../../config/owners";
import { TCG_UI_PREFIX, currentPanelTcg } from "../../config/routes";

const TCG_OPTIONS = TCG_KEYS.map((tcg) => ({ value: tcg, label: TCG_LABELS[tcg] }));

/** Cambia de superficie TCG. Cada una conserva su menú y su dueño. */
export function TcgSelect() {
  return (
    <PanelSelect
      id="tcg-select-label"
      label="TCG"
      value={currentPanelTcg()}
      options={TCG_OPTIONS}
      onChange={(next) => {
        if (!isTcgKey(next) || next === currentPanelTcg()) return;
        try {
          localStorage.setItem(OWNER_STORAGE_KEY, defaultOwnerForTcg(next));
        } catch {
          /* ignore */
        }
        window.location.assign(TCG_UI_PREFIX[next]);
      }}
    />
  );
}
