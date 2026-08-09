/* Shared accent-insensitive autocomplete combobox, used by every onboard tool (Finder, Destinations,
 * Crate, Heat). Retest 09/08/2026, point 9 : chaque outil dupliquait sa propre version, dont certaines
 * (HeatCalculator) sans le moindre attribut ARIA (`role="listbox"`/`role="option"` absents) et TOUTES
 * sans `aria-controls`/`aria-activedescendant` — un lecteur d'écran ou une navigation clavier ne pouvait
 * pas savoir quelle option de la liste était actuellement mise en avant. Centralisé ici pour que le
 * correctif (et les suivants) s'applique une seule fois, au lieu de re-diverger outil par outil.
 *
 * Implements the WAI-ARIA 1.2 "combobox with listbox popup" pattern: the input keeps
 * role="combobox" + aria-autocomplete="list" (set in the markup), this module manages
 * aria-expanded, aria-controls (pointing at the generated listbox id) and aria-activedescendant
 * (pointing at the currently-highlighted option id) as the user types or moves with the arrow keys.
 */

export interface ComboItem {
  /** Text shown in the dropdown (may carry extra context, e.g. "Paris (CDG) — France"). */
  display: string;
  /** Value written into the input once chosen (may be shorter than `display`). */
  value: string;
}

export interface AttachComboboxOptions {
  input: HTMLInputElement;
  /** Returns the (already filtered/sliced) items to show for the current query. Empty query → full list. */
  getItems: (query: string) => ComboItem[];
  /** CSS selector for the positioning host (must be a `position: relative` ancestor). Falls back to input.parentElement. */
  hostSelector?: string;
  /** Called after the input's value is set and (unless disabled) a "change" event is dispatched. */
  onChoose?: (value: string) => void;
  /** Dispatch a bubbling "change" event on the input after a choice — default true (existing behaviour). */
  emitChange?: boolean;
}

const escHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));

export function attachCombobox(o: AttachComboboxOptions): void {
  const { input } = o;
  const emitChange = o.emitChange !== false;
  const field = (o.hostSelector ? input.closest(o.hostSelector) : null) as HTMLElement | null ?? input.parentElement;
  if (!field) return;
  field.classList.add("ac-host");

  const listId = `${input.id || "ac"}-listbox`;
  const optId = (i: number) => `${listId}-opt-${i}`;

  const box = document.createElement("ul");
  box.className = "ac-list";
  box.id = listId;
  box.setAttribute("role", "listbox");
  box.hidden = true;
  field.appendChild(box);
  input.setAttribute("aria-controls", listId);

  let cur = -1;
  let shown: ComboItem[] = [];

  const close = () => {
    box.hidden = true;
    box.innerHTML = "";
    cur = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const mark = () => {
    [...box.children].forEach((el, i) => {
      const on = i === cur;
      el.classList.toggle("is-cur", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (cur >= 0) {
      input.setAttribute("aria-activedescendant", optId(cur));
      (box.children[cur] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const openWith = (q: string) => {
    shown = o.getItems(q);
    if (!shown.length) { close(); return; }
    box.innerHTML = shown
      .map((it, i) => `<li class="ac-item" role="option" id="${optId(i)}" aria-selected="false">${escHtml(it.display)}</li>`)
      .join("");
    box.hidden = false;
    cur = -1;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
  };

  const choose = (i: number) => {
    const it = shown[i];
    if (!it) return;
    input.value = it.value;
    close();
    if (emitChange) input.dispatchEvent(new Event("change", { bubbles: true }));
    o.onChoose?.(it.value);
  };

  input.addEventListener("input", () => openWith(input.value));
  input.addEventListener("focus", () => openWith(input.value));
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (box.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); cur = Math.min(cur + 1, shown.length - 1); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cur = Math.max(cur - 1, 0); mark(); }
    else if (e.key === "Enter" && cur >= 0) { e.preventDefault(); choose(cur); }
    else if (e.key === "Escape") { close(); }
  });
  box.addEventListener("mousedown", (e: MouseEvent) => {
    const li = (e.target as HTMLElement).closest(".ac-item") as HTMLElement | null;
    if (!li) return;
    const idx = [...box.children].indexOf(li);
    if (idx >= 0) { e.preventDefault(); choose(idx); }
  });
  document.addEventListener("click", (e) => { if (!field!.contains(e.target as Node)) close(); });
}
