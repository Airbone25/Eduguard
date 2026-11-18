// RFC 4180-style parser: quoted commas/newlines and doubled quotes are preserved.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  let closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += ch;
      continue;
    }
    if (ch === '"') {
      if (value || closed) throw new Error("Unexpected quote in CSV.");
      quoted = true;
      continue;
    }
    if (ch === "," || ch === "\n" || ch === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (ch !== ",") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
      }
    } else {
      if (closed) throw new Error("Unexpected text after a closing CSV quote.");
      value += ch;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  if (value || row.length || closed) {
    row.push(value);
    rows.push(row);
  }
  if (rows.length > 101)
    throw new Error("Import at most 100 student rows at a time.");
  if (rows.length < 2)
    throw new Error("Include a header and at least one data row.");
  if (new Set(rows[0]).size !== rows[0].length)
    throw new Error("Duplicate CSV headers are not allowed.");
  if (rows.some((r) => r.length !== rows[0].length))
    throw new Error(
      "Every row must have the same number of columns as the header.",
    );
  return rows;
}
