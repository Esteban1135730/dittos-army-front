import { PanelSelect } from "./panel-select";
import {
  OWNER_STORAGE_KEY,
  defaultOwnerForTcg,
  type TcgKey,
} from "../../config/owners";
import {
  panelBasenameForPath,
  YUGIOH_UI_PREFIX,
  PANEL_UI_PREFIX,
} from "../../config/routes";

const TCG_OPTIONS = [
  { value: "pokemon", label: "Pokémon" },
  { value: "yugioh", label: "Yu-Gi-Oh" },
];

function currentTcg(): TcgKey {
  return panelBasenameForPath(window.location.pathname) === YUGIOH_UI_PREFIX
    ? "yugioh"
    : "pokemon";
}

/** Cambia de superficie TCG. Cada una conserva su menú y su dueño. */
export function TcgSelect() {
  return (
    <PanelSelect
      id="tcg-select-label"
      label="TCG"
      value={currentTcg()}
      options={TCG_OPTIONS}
      onChange={(next) => {
        if (next === currentTcg()) return;
        const tcg = next as TcgKey;
        try {
          localStorage.setItem(OWNER_STORAGE_KEY, defaultOwnerForTcg(tcg));
        } catch {
          /* ignore */
        }
        window.location.assign(
          tcg === "yugioh" ? YUGIOH_UI_PREFIX : PANEL_UI_PREFIX,
        );
      }}
    />
  );
}
