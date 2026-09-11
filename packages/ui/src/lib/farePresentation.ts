/**
 * Présentation compacte des montants tarifaires déjà validés par le contrat.
 *
 * Ce module ne décide jamais qu'un tarif s'applique à un trajet. Il reçoit la liste que le
 * résolveur a classée (applicable ou indécidable) et ne fait qu'empêcher deux pertes d'information
 * dans l'interface : tronquer une grille après deux lignes, ou confondre deux marques opérées sous
 * des préfixes de vol différents (Transavia HV / TO).
 */

type MonetaryAmount = { amount: number; currency: string };
type FareLike = {
  price?: { kind?: string; amounts?: MonetaryAmount[] };
  scope_label?: string;
};

export interface FarePresentationOptions {
  locale: string;
  minimumLabel: string;
}

const money = (amount: number, currency: string, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
};

const preferredCurrency = (fares: FareLike[], locale: string): string | null => {
  const coverage = new Map<string, number>();
  for (const fare of fares) {
    const currencies = new Set((fare.price?.amounts ?? []).map((a) => a.currency));
    for (const currency of currencies) coverage.set(currency, (coverage.get(currency) ?? 0) + 1);
  }
  if (!coverage.size) return null;
  const localePreference = locale.startsWith("en") ? "USD" : "EUR";
  return [...coverage].sort(([a, countA], [b, countB]) =>
    countB - countA || Number(b === localePreference) - Number(a === localePreference) || a.localeCompare(b)
  )[0][0];
};

/** Rend les montants sans ajouter de promesse d'applicabilité. */
export function presentNumericFares(fares: FareLike[], options: FarePresentationOptions): string | null {
  const numeric = fares.filter((fare) => (fare.price?.amounts?.length ?? 0) > 0);
  if (!numeric.length) return null;

  /* Une grille zonée doit rester entière. La page ne connaît pas encore la zone commerciale du
     trajet : on publie donc son amplitude officielle, jamais les deux premières lignes seulement. */
  if (numeric.every((fare) => fare.price?.kind === "matrix")) {
    const currency = preferredCurrency(numeric, options.locale);
    if (!currency) return null;
    const values = [...new Set(numeric.flatMap((fare) =>
      (fare.price?.amounts ?? []).filter((a) => a.currency === currency).map((a) => a.amount)
    ))].sort((a, b) => a - b);
    if (!values.length) return null;
    if (values.length === 1) return money(values[0], currency, options.locale);
    return `${money(values[0], currency, options.locale)}–${money(values[values.length - 1], currency, options.locale)}`;
  }

  const currency = preferredCurrency(numeric, options.locale);
  const ordered = [...numeric].sort((a, b) => {
    const ca = a.price?.amounts?.[0]?.currency ?? "";
    const cb = b.price?.amounts?.[0]?.currency ?? "";
    return Number(cb === currency) - Number(ca === currency) || ca.localeCompare(cb);
  });
  const scopes = ordered.map((fare) => fare.scope_label?.trim() ?? "");
  const showScopes = (ordered.length > 1 && scopes.every((scope) => scope.length > 0 && scope.length <= 24)
    && new Set(scopes).size === ordered.length)
    /* Les codes de vols et d'aéroports ne demandent aucune traduction. Cette branche permet de
       dire qu'un montant isolé est un SUPPLÉMENT de transit, sans publier le long libellé source. */
    || (ordered.length === 1 && /^[A-Z0-9][A-Z0-9/·+(). >-]{1,23}$/.test(scopes[0]));

  return ordered.slice(0, 3).map((fare, index) => {
    const amounts = fare.price?.amounts ?? [];
    let value: string;
    if (fare.price?.kind === "minimum") {
      value = `${options.minimumLabel} ${money(amounts[0].amount, amounts[0].currency, options.locale)}`;
    } else if (fare.price?.kind === "range" && amounts.length >= 2) {
      value = `${money(amounts[0].amount, amounts[0].currency, options.locale)}–${money(amounts[amounts.length - 1].amount, amounts[amounts.length - 1].currency, options.locale)}`;
    } else {
      value = amounts.map((amount) => money(amount.amount, amount.currency, options.locale)).join(" / ");
    }
    return showScopes ? `${value} (${scopes[index]})` : value;
  }).join(" / ");
}
