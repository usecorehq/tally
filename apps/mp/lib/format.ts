// Money and quantities arrive from the API as decimal strings; format them
// without passing through a float (as mobile's core/utils/naira.dart).

/** "2500.50" → "₦2,500.50", "45000" → "₦45,000". */
export function formatNaira(amount: string): string {
  const [whole = "0", fraction = ""] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const kobo = fraction.padEnd(2, "0").slice(0, 2);
  return kobo === "00" ? `₦${grouped}` : `₦${grouped}.${kobo}`;
}

/** "12.000" → "12", "2.500" → "2.5". */
export function formatQuantity(quantity: string): string {
  if (!quantity.includes(".")) return quantity;
  return quantity.replace(/0+$/, "").replace(/\.$/, "");
}

/** Sum of quantity strings at 3 decimals (the column's scale), as a quantity string. */
export function sumQuantities(quantities: string[]): string {
  const thousandths = quantities.reduce((sum, q) => {
    const [w = "0", f = ""] = q.split(".");
    return sum + BigInt(w) * 1000n + BigInt(f.padEnd(3, "0").slice(0, 3) || "0");
  }, 0n);
  const whole = thousandths / 1000n;
  const rest = (thousandths % 1000n).toString().padStart(3, "0");
  return formatQuantity(`${whole}.${rest}`);
}
